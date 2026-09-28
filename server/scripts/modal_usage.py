"""
Usage and billing data for the GUI's /usage page.

Runs on the machine where the Modal CLI is logged in (it uses ~/.modal.toml),
with the Python that ships with the CLI:
    ~/.local/share/uv/tools/modal/bin/python modal_usage.py live
    ~/.local/share/uv/tools/modal/bin/python modal_usage.py full

  live - GPU workers up right now (runners, queue, uptime). ~2 s.
  full - month totals and remaining credit, cost per app / resource / day / hour,
         and every generation parsed from the app logs. ~10 s; the server caches it.
Prints one JSON object on stdout.
"""

import datetime as dt
import json
import re
import subprocess
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import modal

PLAN_CREDIT = 30.0  # Starter plan: $30/month of compute credit
# App name -> GPU class, GPU, log pattern for one output, output kind.
APPS = {
    "qwen-image-21": {"cls": "QwenImage", "gpu": "L40S", "kind": "image",
                      "pattern": "steps, seed",
                      "regex": r"(\d+)x(\d+) @ (\d+) steps, seed (\d+)(?:, (\d+) refs)?: ([\d.]+)s"},
    "ltx-25-video": {"cls": "LTX25", "gpu": "RTX-PRO-6000", "kind": "video",
                     "pattern": "f, seed",
                     "regex": r"(\d+)x(\d+) (\d+)f, seed (\d+)(?:, i2v=(\w+))?(?:, (\w+))?: ([\d.]+)s"},
    "fastwan-22-video": {"cls": "FastWan", "gpu": "L40S", "kind": "video",
                         "pattern": "f, seed",
                         "regex": r"(\d+)x(\d+) (\d+)f, seed (\d+)(?:, i2v=(\w+))?(?:, (\w+))?: ([\d.]+)s"},
}
FALLBACK_GPU_RATES = {"L40S": 1.95, "RTX-PRO-6000": 3.03}  # $/h, modal billing rates 2026-09-28
MODAL = [sys.executable, "-m", "modal"]
LOG_CACHE = Path.home() / ".cache" / "modal-usage"


def now_utc() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc)


def month_bounds(now: dt.datetime) -> tuple[dt.datetime, dt.datetime]:
    start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    end = (start + dt.timedelta(days=32)).replace(day=1)
    return start, end


def gpu_rates(workspace) -> dict[str, float]:
    """$/h per GPU from `modal billing rates`, falling back to known values."""
    rates = dict(FALLBACK_GPU_RATES)
    try:
        text = str(workspace.billing.rates())
        for label, key in (("L40S", "L40S"), ("RTX PRO 6000", "RTX-PRO-6000")):
            m = re.search(re.escape(label) + r"[^$]*\$([\d.]+)", text)
            if m:
                rates[key] = float(m.group(1))
    except Exception:
        pass
    return rates


def containers() -> list[dict]:
    out = subprocess.run(MODAL + ["container", "list", "--json"], capture_output=True, text=True, timeout=60)
    try:
        return json.loads(out.stdout or "[]")
    except json.JSONDecodeError:
        return []


def app_stats(name: str) -> dict:
    """GPU runners/queue for the app's GPU class, and runners for its CPU api."""
    spec = APPS[name]
    res = {"gpu_runners": 0, "running_inputs": 0, "backlog": 0, "api_runners": 0, "deployed": True}
    try:
        s = modal.Cls.from_name(name, spec["cls"])().generate.get_current_stats()
        res.update(gpu_runners=s.num_total_runners, running_inputs=s.num_running_inputs, backlog=s.backlog)
    except Exception:
        res["deployed"] = False
    try:
        res["api_runners"] = modal.Function.from_name(name, "api").get_current_stats().num_total_runners
    except Exception:
        pass
    return res


def container_has_gpu_logs(app_id: str, container_id: str) -> bool:
    """GPU workers print while loading; the CPU api container stays quiet."""
    out = subprocess.run(MODAL + ["app", "logs", app_id, "--container", container_id, "--tail", "40"],
                         capture_output=True, text=True, timeout=60)
    return bool(out.stdout.strip())


def live() -> dict:
    workspace = modal.Workspace.from_context()
    rates = gpu_rates(workspace)
    now = now_utc()
    running = containers()
    with ThreadPoolExecutor(8) as pool:
        stats = dict(zip(APPS, pool.map(app_stats, APPS)))

    apps = []
    for name, spec in APPS.items():
        st = stats[name]
        mine = [c for c in running if c.get("app_name") == name]
        items = []
        for c in mine:
            started = dt.datetime.fromisoformat(c["start_time"])
            items.append({"container_id": c["container_id"], "app_id": c["app_id"], "started_at": started.isoformat(),
                          "uptime_seconds": round((now - started).total_seconds())})
        # Label the GPU worker(s): only when the app has both kinds running is a log check needed.
        n_gpu = st["gpu_runners"]
        if n_gpu and len(items) > n_gpu:
            for it in items:
                it["kind"] = "gpu" if container_has_gpu_logs(it["app_id"], it["container_id"]) else "api"
        else:
            for it in items:
                it["kind"] = "gpu" if n_gpu else "api"
        rate = rates.get(spec["gpu"], 0.0)
        for it in items:
            it["rate_per_hour"] = rate if it["kind"] == "gpu" else 0.024  # api: 0.5 core + 1 GiB
            it["cost_so_far"] = round(it["uptime_seconds"] / 3600 * it["rate_per_hour"], 4)
        apps.append({"app": name, "gpu": spec["gpu"], "gpu_rate_per_hour": rate, **st, "containers": items})

    burn = sum(it["rate_per_hour"] for a in apps for it in a["containers"])
    return {"generated_at": now.isoformat(), "apps": apps, "burn_rate_per_hour": round(burn, 3)}


def fetch_generations(app_id: str, name: str, since: dt.datetime, stopped: bool) -> list[dict]:
    """Every output the app logged this month. Logs of stopped apps never change, so cache them."""
    LOG_CACHE.mkdir(parents=True, exist_ok=True)
    cache = LOG_CACHE / f"{app_id}_{since:%Y%m}.json"
    if stopped and cache.exists():
        return json.loads(cache.read_text())
    spec = APPS[name]
    out = subprocess.run(
        MODAL + ["app", "logs", app_id, "--since", since.strftime("%Y-%m-%dT%H:%M:%S"),
                 "--search", spec["pattern"], "--timestamps", "--tail", "5000"],
        capture_output=True, text=True, timeout=120)
    rows = []
    for line in out.stdout.splitlines():
        m_time = re.match(r"(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2})\s+(.*)", line)
        if not m_time:
            continue
        m = re.search(spec["regex"], m_time.group(2))
        if not m:
            continue
        g = m.groups()
        row = {"time": dt.datetime.fromisoformat(m_time.group(1)).isoformat(), "app": name, "app_id": app_id,
               "kind": spec["kind"], "width": int(g[0]), "height": int(g[1]), "seconds": float(g[-1])}
        if spec["kind"] == "image":
            row.update(steps=int(g[2]), seed=int(g[3]), refs=int(g[4] or 0))
        else:
            row.update(frames=int(g[2]), seed=int(g[3]), i2v=g[4] == "True", quality=g[5] or "standard")
        rows.append(row)
    if stopped:
        cache.write_text(json.dumps(rows))
    return rows


def full() -> dict:
    workspace = modal.Workspace.from_context()
    rates = gpu_rates(workspace)
    now = now_utc()
    m_start, m_end = month_bounds(now)

    summary = workspace.billing.summary()
    daily = workspace.billing.report(start=m_start, resolution="d")
    hour0 = (now - dt.timedelta(hours=48)).replace(minute=0, second=0, microsecond=0)
    hourly = workspace.billing.report(start=hour0, resolution="h")

    def rows(items, key):
        out = []
        for it in items:
            out.append({key: it.interval_start.isoformat(), "app": it.description, "app_id": it.object_id,
                        "cost": float(it.cost), "by_resource": {k: float(v) for k, v in it.cost_by_resource.items()}})
        return out

    # Reports hold full intervals only: the daily one stops at yesterday, the hourly
    # one at the last full hour. Month = finished days + today's finished hours;
    # the rest of `metered` (the current hour) is not itemized yet.
    day0 = now.replace(hour=0, minute=0, second=0, microsecond=0)
    daily_rows = rows(daily, "day")
    hourly_rows = rows(hourly, "hour")
    today_rows = [dict(r, day=day0.isoformat()) for r in hourly_rows if r["hour"] >= day0.isoformat()]
    month_rows = [r for r in daily_rows if r["day"] < day0.isoformat()] + today_rows
    by_app: dict[str, float] = {}
    by_resource: dict[str, float] = {}
    for r in month_rows:
        by_app[r["app"]] = by_app.get(r["app"], 0) + r["cost"]
        for k, v in r["by_resource"].items():
            by_resource[k] = by_resource.get(k, 0) + v
    days: dict[str, dict] = {}
    for r in month_rows:
        d = days.setdefault(r["day"][:10], {"day": r["day"][:10], "cost": 0.0, "by_app": {}})
        d["cost"] += r["cost"]
        d["by_app"][r["app"]] = d["by_app"].get(r["app"], 0) + r["cost"]

    # Generations from every app id this month: deployed apps and stopped CLI runs.
    # `modal app list` has them all at once; billing rows lag by up to an hour.
    listed = subprocess.run(MODAL + ["app", "list", "--json"], capture_output=True, text=True, timeout=60)
    try:
        app_list = json.loads(listed.stdout or "[]")
    except json.JSONDecodeError:
        app_list = []
    targets = {}  # app_id -> (name, stopped)
    for a in app_list:
        last = a.get("stopped_at") or now.isoformat()
        if a.get("description") in APPS and dt.datetime.fromisoformat(last) >= m_start:
            targets[a["app_id"]] = (a["description"], a.get("state") == "stopped")
    # The app list drops older stopped apps; billing rows still name them.
    for r in month_rows:
        if r["app"] in APPS and r["app_id"] not in targets:
            targets[r["app_id"]] = (r["app"], True)
    targets = [(aid, name, stopped) for aid, (name, stopped) in targets.items()]
    with ThreadPoolExecutor(6) as pool:
        futures = [pool.submit(fetch_generations, aid, name, m_start, stopped) for aid, name, stopped in targets]
        generations = [g for f in futures for g in f.result()]
    for g in generations:
        g["est_gpu_cost"] = round(g["seconds"] / 3600 * rates.get(APPS[g["app"]]["gpu"], 0), 5)
    generations.sort(key=lambda g: g["time"], reverse=True)

    counts = {name: {"outputs": 0, "gpu_seconds": 0.0} for name in APPS}
    for g in generations:
        counts[g["app"]]["outputs"] += 1
        counts[g["app"]]["gpu_seconds"] += g["seconds"]

    metered = float(summary.metered_cost)
    days_total = (m_end - m_start).days
    days_elapsed = max((now - m_start).total_seconds() / 86400, 0.01)
    return {
        "generated_at": now.isoformat(),
        "cycle": {"start": m_start.isoformat(), "end": m_end.isoformat(),
                  "days_left": round((m_end - now).total_seconds() / 86400, 2), "days_total": days_total},
        "plan_credit": PLAN_CREDIT,
        "metered": metered,
        "credits_applied": -float(summary.adjustments.get("Credits", 0)),
        "billed": float(summary.billed_cost),
        "remaining": round(PLAN_CREDIT - metered, 4),
        "projected_month": round(metered / days_elapsed * days_total, 2),
        "breakdown": {k: float(v) for k, v in summary.metered_cost_breakdown.items()},
        "itemized": round(sum(by_app.values()), 4),
        "not_itemized": round(max(metered - sum(by_app.values()), 0), 4),
        "by_app": by_app,
        "by_resource": by_resource,
        "daily": sorted(days.values(), key=lambda d: d["day"]),
        "hourly": hourly_rows,
        "gpu_rates": rates,
        "counts": counts,
        "generations": generations,
    }


if __name__ == "__main__":
    t0 = time.time()
    mode = sys.argv[1] if len(sys.argv) > 1 else "full"
    data = live() if mode == "live" else full()
    data["took_seconds"] = round(time.time() - t0, 2)
    print(json.dumps(data))
