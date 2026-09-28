<script setup lang="ts">
import { Activity, AlertTriangle, CalendarClock, Cpu, Gauge, RefreshCw, Wallet, TrendingUp, Zap } from '@lucide/vue'
import type { StackedBar } from '~/components/UsageStackedBars.vue'
import { APP_META, appColor, appName, duration, money, useUsage } from '~/composables/useUsage'

useHead({ title: 'Usage & Credits' })

const usage = useUsage()
const { full, liveApps, liveSpend, gpuOn, fullError, liveError, loadingFull, now } = usage

let stop: (() => void) | null = null
onMounted(() => (stop = usage.start({ live: true })))
onUnmounted(() => stop?.())

const f = computed(() => full.value)
const usedPct = computed(() => (f.value ? Math.min((f.value.metered / f.value.plan_credit) * 100, 100) : 0))
const resetDate = computed(() =>
  f.value ? new Date(f.value.cycle.end).toLocaleDateString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''
)
const burnPerHour = computed(() => liveApps.value.reduce((s, a) => s + a.containers.reduce((t, c) => t + c.rate_per_hour, 0), 0))
const updatedAgo = computed(() => (f.value ? duration((now.value - new Date(f.value.generated_at).getTime()) / 1000) : ''))

// Per-model capacity: what the credit left buys at this month's real cost per output,
// and at the warm (batched) cost from the measured GPU seconds.
const capacity = computed(() => {
  if (!f.value) return []
  return Object.entries(APP_META).map(([app, meta]) => {
    const c = f.value!.counts[app] || { outputs: 0, gpu_seconds: 0 }
    const cost = f.value!.by_app[app] || 0
    const gpu = app === 'ltx-25-video' ? 'RTX-PRO-6000' : 'L40S'
    const rate = f.value!.gpu_rates[gpu] || 0
    const avgSeconds = c.outputs ? c.gpu_seconds / c.outputs : 0
    const actualPer = c.outputs && cost ? cost / c.outputs : null
    const warmPer = avgSeconds ? (avgSeconds / 3600) * rate : null
    const left = f.value!.remaining
    return {
      app, meta, gpu, rate, outputs: c.outputs, gpuSeconds: c.gpu_seconds, cost, avgSeconds, actualPer, warmPer,
      leftActual: actualPer ? Math.floor(left / actualPer) : null,
      leftWarm: warmPer ? Math.floor(left / warmPer) : null
    }
  })
})

// Hourly: the last 48 full hours as stacked bars (local time labels).
const hourlyBars = computed<StackedBar[]>(() => {
  if (!f.value) return []
  const byHour = new Map<string, Record<string, number>>()
  for (const r of f.value.hourly) {
    const k = new Date(r.hour!).toISOString().slice(0, 13)
    const m = byHour.get(k) || {}
    m[r.app] = (m[r.app] || 0) + r.cost
    byHour.set(k, m)
  }
  const end = new Date(f.value.generated_at)
  end.setUTCMinutes(0, 0, 0)
  const bars: StackedBar[] = []
  for (let i = 47; i >= 1; i--) {
    const t = new Date(end.getTime() - i * 3600_000)
    const k = t.toISOString().slice(0, 13)
    const apps = byHour.get(k) || {}
    const local = t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    bars.push({
      key: k,
      label: t.getHours() % 6 === 0 ? local : '',
      title: `${t.toLocaleDateString([], { weekday: 'short', day: 'numeric' })} ${local}`,
      segments: Object.keys(APP_META).map((app) => ({ app, value: apps[app] || 0 }))
        .concat([{ app: 'other', value: Object.entries(apps).filter(([a]) => !(a in APP_META)).reduce((s, [, v]) => s + v, 0) }])
    })
  }
  return bars
})

// Daily: every day of the billing month.
const dailyBars = computed<StackedBar[]>(() => {
  if (!f.value) return []
  const byDay = new Map(f.value.daily.map((d) => [d.day, d.by_app]))
  const start = new Date(f.value.cycle.start)
  const bars: StackedBar[] = []
  for (let d = 0; d < f.value.cycle.days_total; d++) {
    const t = new Date(start.getTime() + d * 86400_000)
    const k = t.toISOString().slice(0, 10)
    const apps = byDay.get(k) || {}
    bars.push({
      key: k,
      label: (d + 1) % 5 === 0 || d === 0 ? String(t.getUTCDate()) : '',
      title: t.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' }),
      segments: Object.keys(APP_META).map((app) => ({ app, value: apps[app] || 0 }))
        .concat([{ app: 'other', value: Object.entries(apps).filter(([a]) => !(a in APP_META)).reduce((s, [, v]) => s + v, 0) }])
    })
  }
  return bars
})

const appRows = computed(() => {
  if (!f.value) return []
  const rows = Object.entries(f.value.by_app).map(([app, cost]) => ({ app, cost }))
  if (f.value.not_itemized > 0) rows.push({ app: 'not itemized yet', cost: f.value.not_itemized })
  return rows.sort((a, b) => b.cost - a.cost)
})
const resourceRows = computed(() =>
  f.value ? Object.entries(f.value.by_resource).map(([name, cost]) => ({ name, cost })).sort((a, b) => b.cost - a.cost) : []
)
const maxAppCost = computed(() => Math.max(...appRows.value.map((r) => r.cost), 0.0001))
const maxResourceCost = computed(() => Math.max(...resourceRows.value.map((r) => r.cost), 0.0001))

// Activity log (every generation, minute-level).
const appFilter = ref<string>('all')
const showAll = ref(false)
const activity = computed(() => {
  const g = f.value?.generations || []
  const filtered = appFilter.value === 'all' ? g : g.filter((x) => x.app === appFilter.value)
  return showAll.value ? filtered : filtered.slice(0, 40)
})
const activityTotal = computed(() => {
  const g = f.value?.generations || []
  return appFilter.value === 'all' ? g.length : g.filter((x) => x.app === appFilter.value).length
})
const detailOf = (g: any) =>
  g.kind === 'image'
    ? `${g.steps} steps${g.refs ? ` · ${g.refs} ref${g.refs > 1 ? 's' : ''}` : ''}`
    : `${(g.frames / 24).toFixed(1)}s clip${g.quality === 'hd' ? ' · HD' : ''}${g.i2v ? ' · i2v' : ''}`
const timeOf = (iso: string) => {
  const d = new Date(iso)
  return `${d.toLocaleDateString([], { day: 'numeric', month: 'short' })} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
}

const statusOf = (a: any) => {
  if (!a.deployed) return { label: 'Not deployed', tone: 'muted' }
  if (a.backlog > 0) return { label: `${a.backlog} queued`, tone: 'warn' }
  if (a.running_inputs > 0) return { label: 'Generating', tone: 'busy' }
  if (a.gpu_runners > 0) return { label: 'GPU warm · idle', tone: 'warn' }
  return { label: 'GPU off', tone: 'ok' }
}
</script>

<template>
  <div class="app-layout">
    <HeaderNav
      title="Usage & Credits"
      badge="Modal Starter · $30/mo"
      :is-healthy="fullError ? false : full ? true : null"
      :history-count="0"
      :show-history="false"
      :show-settings="false"
      @refresh-health="usage.refreshFull(true)"
    />

    <main class="app-main">
      <div v-if="fullError && !full" class="notice notice--error">
        <AlertTriangle :size="16" />
        <div>
          <strong>Could not read Modal billing.</strong>
          {{ fullError }}. The usage page needs the Modal CLI logged in on the machine that runs this GUI
          (<code>modal setup</code>); proxy tokens can't read billing.
        </div>
      </div>

      <div v-else-if="!full" class="notice">
        <RefreshCw :size="15" class="spin" />
        <span>Reading billing, containers and logs from Modal (about 10 s the first time)…</span>
      </div>

      <template v-if="full">
        <!-- KPI row -->
        <section class="kpis">
          <div class="kpi kpi--hero">
            <span class="kpi__label"><Wallet :size="14" /> Credit remaining</span>
            <span class="kpi__hero">{{ money(full.remaining) }}</span>
            <div class="meter" :title="`${money(full.metered)} of ${money(full.plan_credit)} used`">
              <div class="meter__fill" :style="{ width: `${usedPct}%` }" />
            </div>
            <span class="kpi__sub">{{ money(full.metered) }} of {{ money(full.plan_credit) }} used · {{ usedPct.toFixed(1) }}%</span>
          </div>
          <div class="kpi">
            <span class="kpi__label"><CalendarClock :size="14" /> Resets in</span>
            <span class="kpi__value">{{ full.cycle.days_left.toFixed(1) }} days</span>
            <span class="kpi__sub">{{ resetDate }} · unused credit may not carry over</span>
          </div>
          <div class="kpi">
            <span class="kpi__label"><TrendingUp :size="14" /> Month-end at this pace</span>
            <span class="kpi__value">{{ money(full.projected_month) }}</span>
            <span class="kpi__sub">{{ full.billed > 0 ? `${money(full.billed)} billed to card` : '$0 billed to card so far' }}</span>
          </div>
          <div class="kpi" :class="{ 'kpi--live': gpuOn }">
            <span class="kpi__label"><Zap :size="14" /> Burning now</span>
            <span class="kpi__value">{{ money(burnPerHour) }}/h</span>
            <span class="kpi__sub">{{ gpuOn ? `${money(liveSpend, 3)} spent by running containers` : 'No GPU running' }}</span>
          </div>
        </section>

        <!-- Live -->
        <section class="panel">
          <div class="panel__head">
            <h2><Activity :size="15" /> Live now</h2>
            <span class="panel__hint">
              {{ liveError ? `live data failed: ${liveError}` : 'Polled every 10 s · costs tick every second' }}
            </span>
          </div>
          <div class="live-grid">
            <div v-for="a in liveApps" :key="a.app" class="live-card">
              <div class="live-card__top">
                <span class="swatch" :style="{ backgroundColor: appColor(a.app) }" />
                <span class="live-card__name">{{ appName(a.app) }}</span>
                <span class="chip" :class="`chip--${statusOf(a).tone}`">{{ statusOf(a).label }}</span>
              </div>
              <span class="live-card__meta">{{ a.gpu }} · {{ money(a.gpu_rate_per_hour) }}/h while up</span>
              <div v-if="a.containers.length" class="live-card__containers">
                <div v-for="c in a.containers" :key="c.container_id" class="ctr">
                  <Cpu :size="12" />
                  <span>{{ c.kind === 'gpu' ? 'GPU worker' : 'API (CPU)' }}</span>
                  <span class="ctr__up">{{ duration(c.uptime_seconds) }}</span>
                  <span class="ctr__cost">{{ money(c.cost_so_far, 3) }}</span>
                </div>
              </div>
              <span v-else class="live-card__idle">No containers · costs $0</span>
            </div>
          </div>
        </section>

        <!-- Capacity -->
        <section class="panel">
          <div class="panel__head">
            <h2><Gauge :size="15" /> What {{ money(full.remaining) }} still buys</h2>
            <span class="panel__hint">Actual = this month's real cost per output (cold starts and idle time included) · Warm = GPU time only, when you batch</span>
          </div>
          <p v-if="full.not_itemized > 0.05" class="lag-warn">
            <AlertTriangle :size="13" />
            {{ money(full.not_itemized) }} of recent cost is not itemized per app yet (Modal reports lag up to ~1 h),
            so "Spent" and "Actual $/output" are too low for models used in the last hour, and "Left (actual)" is too high.
            The remaining credit at the top is already exact.
          </p>
          <div class="table-wrap">
            <table class="table">
              <thead>
                <tr>
                  <th>Model</th><th class="num">Made</th><th class="num">GPU time</th><th class="num">Avg / output</th>
                  <th class="num">Spent</th><th class="num">Actual $/output</th><th class="num">Left (actual)</th>
                  <th class="num">Warm $/output</th><th class="num">Left (warm)</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="r in capacity" :key="r.app">
                  <td><span class="swatch" :style="{ backgroundColor: r.meta.color }" /> {{ r.meta.name }}</td>
                  <td class="num">{{ r.outputs }} {{ r.meta.unit }}{{ r.outputs === 1 ? '' : 's' }}</td>
                  <td class="num">{{ duration(r.gpuSeconds) }}</td>
                  <td class="num">{{ r.avgSeconds ? `${r.avgSeconds.toFixed(1)}s` : '–' }}</td>
                  <td class="num">{{ money(r.cost, 3) }}</td>
                  <td class="num">{{ r.actualPer ? money(r.actualPer, 3) : '–' }}</td>
                  <td class="num strong">{{ r.leftActual ?? '–' }}</td>
                  <td class="num">{{ r.warmPer ? money(r.warmPer, 3) : '–' }}</td>
                  <td class="num strong">{{ r.leftWarm ?? '–' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <!-- Charts -->
        <section class="charts">
          <div class="panel">
            <div class="panel__head">
              <h2>Cost per hour · last 48 h</h2>
              <div class="legend">
                <span v-for="(m, app) in APP_META" :key="app" class="legend__item"><span class="swatch" :style="{ backgroundColor: m.color }" />{{ m.short }}</span>
                <span class="legend__item"><span class="swatch" :style="{ backgroundColor: '#64748b' }" />Other</span>
              </div>
            </div>
            <UsageStackedBars :bars="hourlyBars" :height="150" empty-text="No cost in the last 48 hours" />
            <p class="panel__foot">Modal itemizes cost per full hour. The current hour shows up after it ends
              ({{ money(full.not_itemized, 3) }} not itemized yet).</p>
          </div>
          <div class="panel">
            <div class="panel__head">
              <h2>Cost per day · this month</h2>
            </div>
            <UsageStackedBars :bars="dailyBars" :height="150" />
            <div class="split">
              <div class="split__col">
                <h3>By app</h3>
                <div v-for="r in appRows" :key="r.app" class="hbar">
                  <span class="hbar__label">{{ appName(r.app) }}</span>
                  <div class="hbar__track"><div class="hbar__fill" :style="{ width: `${(r.cost / maxAppCost) * 100}%`, backgroundColor: appColor(r.app) }" /></div>
                  <span class="hbar__val">{{ money(r.cost, 3) }}</span>
                </div>
              </div>
              <div class="split__col">
                <h3>By resource</h3>
                <div v-for="r in resourceRows" :key="r.name" class="hbar">
                  <span class="hbar__label">{{ r.name }}</span>
                  <div class="hbar__track"><div class="hbar__fill hbar__fill--neutral" :style="{ width: `${(r.cost / maxResourceCost) * 100}%` }" /></div>
                  <span class="hbar__val">{{ money(r.cost, 3) }}</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- Activity -->
        <section class="panel">
          <div class="panel__head">
            <h2>Every generation this month</h2>
            <div class="filters">
              <button type="button" class="filter" :class="{ 'filter--on': appFilter === 'all' }" @click="appFilter = 'all'">All</button>
              <button v-for="(m, app) in APP_META" :key="app" type="button" class="filter" :class="{ 'filter--on': appFilter === app }" @click="appFilter = app">
                <span class="swatch" :style="{ backgroundColor: m.color }" />{{ m.short }}
              </button>
            </div>
          </div>
          <div class="table-wrap">
            <table class="table">
              <thead>
                <tr><th>Time</th><th>Model</th><th>Output</th><th>Details</th><th class="num">GPU time</th><th class="num">GPU cost</th><th class="num">Seed</th></tr>
              </thead>
              <tbody>
                <tr v-for="g in activity" :key="`${g.time}-${g.seed}`">
                  <td class="mono">{{ timeOf(g.time) }}</td>
                  <td><span class="swatch" :style="{ backgroundColor: appColor(g.app) }" /> {{ APP_META[g.app]?.short ?? g.app }}</td>
                  <td class="mono">{{ g.width }}×{{ g.height }}</td>
                  <td>{{ detailOf(g) }}</td>
                  <td class="num">{{ g.seconds.toFixed(1) }}s</td>
                  <td class="num">{{ money(g.est_gpu_cost, 4) }}</td>
                  <td class="num mono dim">{{ g.seed }}</td>
                </tr>
                <tr v-if="!activity.length"><td colspan="7" class="dim">No generations yet.</td></tr>
              </tbody>
            </table>
          </div>
          <button v-if="activityTotal > 40" type="button" class="more" @click="showAll = !showAll">
            {{ showAll ? 'Show fewer' : `Show all ${activityTotal}` }}
          </button>
          <p class="panel__foot">GPU cost = generation seconds × GPU rate. It leaves out model loading and idle time,
            which is why the "actual" cost per output above is higher.</p>
        </section>

        <footer class="foot">
          <span>Updated {{ updatedAgo }} ago{{ full.cached ? ' (cached)' : '' }} · sources: <code>modal billing</code>, <code>modal container list</code>, app logs</span>
          <button type="button" class="refresh" :disabled="loadingFull" @click="usage.refreshFull(true)">
            <RefreshCw :size="13" :class="{ spin: loadingFull }" />
            <span>{{ loadingFull ? 'Refreshing…' : 'Refresh now' }}</span>
          </button>
        </footer>
      </template>
    </main>
  </div>
</template>

<style lang="scss" scoped>
.app-layout {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: $color-bg-canvas;
}

.app-main {
  flex: 1;
  width: 100%;
  max-width: 1440px;
  margin: 0 auto;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 18px;

  @media (max-width: 600px) {
    padding: 16px;
  }
}

.notice {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 14px 16px;
  border-radius: $radius-lg;
  background-color: $color-bg-surface;
  border: 1px solid $color-border-subtle;
  font-size: $font-size-sm;
  color: $color-text-secondary;

  &--error {
    border-color: rgba(248, 113, 113, 0.35);
    color: $color-danger;
  }

  code {
    font-family: var(--font-mono);
  }
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.kpis {
  display: grid;
  grid-template-columns: 1.4fr 1fr 1fr 1fr;
  gap: 12px;

  @media (max-width: 1080px) {
    grid-template-columns: 1fr 1fr;
  }

  @media (max-width: 560px) {
    grid-template-columns: 1fr;
  }
}

.kpi {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 16px 18px;
  border-radius: $radius-lg;
  background-color: $color-bg-surface;
  border: 1px solid $color-border-subtle;

  &--live {
    border-color: rgba(251, 191, 36, 0.35);
  }

  &__label {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: $font-size-xs;
    color: $color-text-muted;
    font-weight: $font-weight-medium;
  }

  &__hero {
    font-size: 44px;
    line-height: 1.05;
    font-weight: $font-weight-semibold;
    color: $color-text-primary;
    letter-spacing: -0.02em;
    font-variant-numeric: tabular-nums;
  }

  &__value {
    font-size: $font-size-3xl;
    font-weight: $font-weight-semibold;
    color: $color-text-primary;
    font-variant-numeric: tabular-nums;
  }

  &__sub {
    font-size: $font-size-xs;
    color: $color-text-muted;
  }
}

.meter {
  height: 8px;
  border-radius: $radius-full;
  background-color: $color-bg-subtle;
  overflow: hidden;

  &__fill {
    height: 100%;
    border-radius: $radius-full;
    background-color: #3987e5;
  }
}

.panel {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 18px 20px;
  border-radius: $radius-lg;
  background-color: $color-bg-surface;
  border: 1px solid $color-border-subtle;
  min-width: 0;

  &__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;

    h2 {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      font-size: $font-size-base;
      font-weight: $font-weight-semibold;
      color: $color-text-primary;
    }
  }

  &__hint,
  &__foot {
    font-size: $font-size-xs;
    color: $color-text-muted;
    line-height: 1.5;
  }
}

.live-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;

  @media (max-width: 900px) {
    grid-template-columns: 1fr;
  }
}

.live-card {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px 14px;
  border-radius: $radius-md;
  background-color: $color-bg-subtle;
  border: 1px solid $color-border-subtle;

  &__top {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  &__name {
    font-size: $font-size-sm;
    font-weight: $font-weight-semibold;
    color: $color-text-primary;
  }

  &__meta,
  &__idle {
    font-size: 11px;
    color: $color-text-muted;
    font-family: var(--font-mono);
  }

  &__containers {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
}

.ctr {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: $color-text-secondary;

  &__up {
    margin-left: auto;
    font-family: var(--font-mono);
  }

  &__cost {
    min-width: 58px;
    text-align: right;
    font-family: var(--font-mono);
    color: $color-text-primary;
  }
}

.chip {
  margin-left: auto;
  padding: 1px 8px;
  border-radius: $radius-full;
  font-size: 10px;
  font-weight: $font-weight-semibold;
  border: 1px solid $color-border-default;
  color: $color-text-secondary;
  white-space: nowrap;

  &--ok {
    color: $color-success;
    border-color: rgba(52, 211, 153, 0.3);
  }

  &--warn {
    color: $color-warning;
    border-color: rgba(251, 191, 36, 0.35);
  }

  &--busy {
    color: $color-accent;
    border-color: rgba(56, 189, 248, 0.35);
  }
}

.lag-warn {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 8px 12px;
  border-radius: $radius-md;
  background-color: $color-warning-soft;
  border: 1px solid rgba(251, 191, 36, 0.3);
  color: $color-warning;
  font-size: $font-size-xs;
  line-height: 1.5;

  svg {
    flex-shrink: 0;
    margin-top: 2px;
  }
}

.swatch {
  display: inline-block;
  width: 9px;
  height: 9px;
  border-radius: 2px;
  flex-shrink: 0;
  vertical-align: baseline;
}

.charts {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 18px;
  align-items: start;

  @media (max-width: 1080px) {
    grid-template-columns: 1fr;
  }
}

.legend {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;

  &__item {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 11px;
    color: $color-text-secondary;
  }
}

.split {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 18px;
  padding-top: 10px;
  border-top: 1px solid $color-border-subtle;

  @media (max-width: 560px) {
    grid-template-columns: 1fr;
  }

  h3 {
    font-size: $font-size-xs;
    font-weight: $font-weight-semibold;
    color: $color-text-secondary;
    margin-bottom: 8px;
  }

  &__col {
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 0;
  }
}

.hbar {
  display: grid;
  grid-template-columns: 110px 1fr 58px;
  align-items: center;
  gap: 8px;
  font-size: 11px;

  &__label {
    color: $color-text-secondary;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__track {
    height: 8px;
    border-radius: 0 4px 4px 0;
    background-color: $color-bg-subtle;
    overflow: hidden;
  }

  &__fill {
    height: 100%;
    border-radius: 0 4px 4px 0;

    &--neutral {
      background-color: #3987e5;
    }
  }

  &__val {
    text-align: right;
    font-family: var(--font-mono);
    color: $color-text-primary;
  }
}

.table-wrap {
  overflow-x: auto;
}

.table {
  width: 100%;
  border-collapse: collapse;
  font-size: $font-size-xs;

  th {
    text-align: left;
    font-weight: $font-weight-medium;
    color: $color-text-muted;
    padding: 6px 10px;
    border-bottom: 1px solid $color-border-default;
    white-space: nowrap;
  }

  td {
    padding: 7px 10px;
    border-bottom: 1px solid $color-border-subtle;
    color: $color-text-secondary;
    white-space: nowrap;
  }

  tbody tr:hover td {
    background-color: $color-bg-subtle;
  }

  .num {
    text-align: right;
    font-variant-numeric: tabular-nums;
    font-family: var(--font-mono);
  }

  .strong {
    color: $color-text-primary;
    font-weight: $font-weight-semibold;
  }
}

.mono {
  font-family: var(--font-mono);
}

.dim {
  color: $color-text-dim !important;
}

.filters {
  display: flex;
  gap: 4px;
  padding: 3px;
  border-radius: $radius-md;
  background-color: $color-bg-subtle;
  border: 1px solid $color-border-subtle;
}

.filter {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  border-radius: $radius-sm;
  font-size: 11px;
  font-weight: $font-weight-medium;
  color: $color-text-secondary;

  &--on {
    background-color: $color-bg-surface;
    color: $color-text-primary;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
  }
}

.more {
  align-self: center;
  font-size: $font-size-xs;
  color: $color-accent;

  &:hover {
    text-decoration: underline;
  }
}

.foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  font-size: $font-size-xs;
  color: $color-text-muted;

  code {
    font-family: var(--font-mono);
  }
}

.refresh {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: $radius-sm;
  background-color: $color-bg-surface;
  border: 1px solid $color-border-subtle;
  color: $color-text-secondary;
  font-size: $font-size-xs;

  &:hover:not(:disabled) {
    color: $color-text-primary;
    border-color: $color-border-default;
  }
}
</style>
