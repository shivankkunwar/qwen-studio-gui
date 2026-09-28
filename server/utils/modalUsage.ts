import { execFile } from 'node:child_process'
import { homedir } from 'node:os'
import { join } from 'node:path'

// Billing data comes from the Modal CLI's own login (~/.modal.toml) through
// server/scripts/modal_usage.py, so it only works where `modal setup` was run.
// Proxy tokens (MODAL_KEY/SECRET) can't read billing.
const PYTHON = process.env.MODAL_PYTHON || join(homedir(), '.local/share/uv/tools/modal/bin/python')
const SCRIPT = join(process.cwd(), 'server/scripts/modal_usage.py')

const cache: Record<string, { at: number; data: any; pending?: Promise<any> }> = {}

function run(mode: 'live' | 'full'): Promise<any> {
  return new Promise((resolve, reject) => {
    execFile(PYTHON, [SCRIPT, mode], { timeout: 180_000, maxBuffer: 32 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) {
        const hint = String(stderr || err.message).trim().split('\n').slice(-3).join(' ')
        return reject(new Error(`modal_usage.py ${mode} failed: ${hint}`))
      }
      try {
        resolve(JSON.parse(stdout))
      } catch {
        reject(new Error(`modal_usage.py ${mode} printed invalid JSON`))
      }
    })
  })
}

/** Cached run: callers within `maxAgeMs` share one result; concurrent callers share one process. */
export async function modalUsage(mode: 'live' | 'full', maxAgeMs: number, force = false) {
  const entry = cache[mode]
  if (!force && entry?.data && Date.now() - entry.at < maxAgeMs) return { ...entry.data, cached: true }
  if (entry?.pending) return entry.pending
  const pending = run(mode)
    .then((data) => {
      cache[mode] = { at: Date.now(), data }
      return { ...data, cached: false }
    })
    .finally(() => {
      if (cache[mode]) delete cache[mode].pending
    })
  cache[mode] = { ...(entry || { at: 0, data: null }), pending }
  return pending
}
