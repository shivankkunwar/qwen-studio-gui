// Usage and billing data from /api/usage/* (server/scripts/modal_usage.py).
// Full data: month totals, per app/resource/day/hour, every generation (server cache 3 min).
// Live data: GPU workers up right now (polled every 10 s, costs tick every second in between).

export interface UsageGeneration {
  time: string
  app: string
  kind: 'image' | 'video'
  width: number
  height: number
  seconds: number
  seed: number
  steps?: number
  refs?: number
  frames?: number
  i2v?: boolean
  quality?: string
  est_gpu_cost: number
}

export interface UsageRow {
  app: string
  cost: number
  by_resource: Record<string, number>
  hour?: string
  day?: string
}

export interface UsageFull {
  generated_at: string
  cycle: { start: string; end: string; days_left: number; days_total: number }
  plan_credit: number
  metered: number
  billed: number
  remaining: number
  projected_month: number
  itemized: number
  not_itemized: number
  breakdown: Record<string, number>
  by_app: Record<string, number>
  by_resource: Record<string, number>
  daily: { day: string; cost: number; by_app: Record<string, number> }[]
  hourly: UsageRow[]
  gpu_rates: Record<string, number>
  counts: Record<string, { outputs: number; gpu_seconds: number }>
  generations: UsageGeneration[]
  cached?: boolean
}

export interface LiveContainer {
  container_id: string
  started_at: string
  uptime_seconds: number
  kind: 'gpu' | 'api'
  rate_per_hour: number
  cost_so_far: number
}

export interface LiveApp {
  app: string
  gpu: string
  gpu_rate_per_hour: number
  gpu_runners: number
  running_inputs: number
  backlog: number
  api_runners: number
  deployed: boolean
  containers: LiveContainer[]
}

export interface UsageLive {
  generated_at: string
  apps: LiveApp[]
  burn_rate_per_hour: number
}

// Fixed categorical order (dataviz palette, dark steps; validated on #10151c).
export const APP_META: Record<string, { name: string; short: string; color: string; unit: string }> = {
  'qwen-image-21': { name: 'Qwen-Image 2.1', short: 'Qwen', color: '#3987e5', unit: 'image' },
  'ltx-25-video': { name: 'LTX-2.5', short: 'LTX', color: '#d95926', unit: 'clip' },
  'fastwan-22-video': { name: 'FastWan 2.2', short: 'FastWan', color: '#199e70', unit: 'clip' }
}
export const OTHER_COLOR = '#64748b'
export const appName = (app: string) => APP_META[app]?.name ?? app
export const appColor = (app: string) => APP_META[app]?.color ?? OTHER_COLOR

export const useUsage = () => {
  const full = useState<UsageFull | null>('usage-full', () => null)
  const live = useState<UsageLive | null>('usage-live', () => null)
  const liveFetchedAt = useState('usage-live-at', () => 0)
  const fullError = useState<string | null>('usage-full-error', () => null)
  const liveError = useState<string | null>('usage-live-error', () => null)
  const loadingFull = useState('usage-loading-full', () => false)
  const now = ref(Date.now())

  const errorOf = (err: any) => err?.data?.statusMessage || err?.statusMessage || err?.message || 'request failed'

  const refreshFull = async (force = false) => {
    if (loadingFull.value) return
    loadingFull.value = true
    try {
      full.value = await $fetch<UsageFull>('/api/usage/full', { query: force ? { refresh: '1' } : {} })
      fullError.value = null
    } catch (err) {
      fullError.value = errorOf(err)
    } finally {
      loadingFull.value = false
    }
  }

  const refreshLive = async () => {
    try {
      live.value = await $fetch<UsageLive>('/api/usage/live')
      liveFetchedAt.value = Date.now()
      liveError.value = null
    } catch (err) {
      liveError.value = errorOf(err)
    }
  }

  // Live containers with uptime/cost advanced to "now" between polls.
  const liveApps = computed(() => {
    if (!live.value) return []
    const extra = Math.max((now.value - liveFetchedAt.value) / 1000, 0)
    return live.value.apps.map((a) => ({
      ...a,
      containers: a.containers.map((c) => {
        const uptime = c.uptime_seconds + extra
        return { ...c, uptime_seconds: uptime, cost_so_far: (uptime / 3600) * c.rate_per_hour }
      })
    }))
  })
  const liveSpend = computed(() =>
    liveApps.value.reduce((s, a) => s + a.containers.reduce((t, c) => t + c.cost_so_far, 0), 0)
  )
  const gpuOn = computed(() => liveApps.value.some((a) => a.gpu_runners > 0))

  /** Start polling. Returns a stop function. */
  const start = (opts: { live?: boolean } = {}) => {
    refreshFull()
    const timers: any[] = [setInterval(() => refreshFull(), 180_000), setInterval(() => (now.value = Date.now()), 1000)]
    if (opts.live) {
      refreshLive()
      timers.push(setInterval(refreshLive, 10_000))
    }
    return () => timers.forEach(clearInterval)
  }

  return { full, live, liveApps, liveSpend, gpuOn, fullError, liveError, loadingFull, now, refreshFull, refreshLive, start }
}

export const money = (d: number | undefined | null, digits = 2) => {
  if (d === undefined || d === null || Number.isNaN(d)) return '–'
  if (d > 0 && d < 0.01 && digits <= 2) return '<$0.01'
  return `$${d.toFixed(digits)}`
}

export const duration = (seconds: number) => {
  const s = Math.max(Math.round(seconds), 0)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ${String(s % 60).padStart(2, '0')}s`
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`
}
