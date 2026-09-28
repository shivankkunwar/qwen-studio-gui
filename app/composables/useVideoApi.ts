import type {
  VideoAspectRatio,
  VideoHistoryItem,
  VideoJobResponse,
  VideoModelId,
  VideoProgress,
  VideoQuality,
  VideoRequest,
  JobStatus
} from '~/types/api'

export interface VideoModelInfo {
  id: VideoModelId
  name: string
  badge: string
  gpu: string
  aspectRatios: VideoAspectRatio[]
  sizes: Record<VideoQuality, Partial<Record<VideoAspectRatio, [number, number]>>>
  durations: number[]
  maxSeconds: Record<VideoQuality, number>
  maxSide: number
  frameRates: number[]
  features: { audio: boolean; imageToVideo: boolean; autoDuration: boolean; hd: boolean; enhancePrompt: boolean }
  // Measured 2026-09-28 (video-modal/SETUP.md); used for the progress bar and cost hint.
  loadSeconds: number
  clipSeconds: number
  dollarsPerHour: number
}

// Mirrors the presets in video-modal/*.py. /v1/options returns the same data.
export const VIDEO_MODELS: Record<VideoModelId, VideoModelInfo> = {
  ltx: {
    id: 'ltx',
    name: 'LTX-2.5',
    badge: '22B · RTX PRO 6000',
    gpu: 'RTX PRO 6000',
    aspectRatios: ['16:9', '9:16', '1:1', '4:3', '3:4'],
    sizes: {
      standard: { '16:9': [960, 544], '9:16': [544, 960], '1:1': [768, 768], '4:3': [832, 640], '3:4': [640, 832] },
      hd: { '16:9': [1920, 1088], '9:16': [1088, 1920], '1:1': [1280, 1280], '4:3': [1664, 1280], '3:4': [1280, 1664] }
    },
    durations: [2, 3, 5, 8, 10, 15, 20],
    maxSeconds: { standard: 20, hd: 10 },
    maxSide: 1920,
    frameRates: [24, 25, 30],
    features: { audio: true, imageToVideo: true, autoDuration: true, hd: true, enhancePrompt: true },
    loadSeconds: 34,
    clipSeconds: 15,
    dollarsPerHour: 3.3
  },
  fastwan: {
    id: 'fastwan',
    name: 'FastWan 2.2',
    badge: '5B · 3-step · L40S',
    gpu: 'L40S',
    aspectRatios: ['16:9', '9:16', '1:1'],
    sizes: {
      standard: { '16:9': [1280, 704], '9:16': [704, 1280], '1:1': [960, 960] },
      hd: {}
    },
    durations: [2, 3, 4, 5],
    maxSeconds: { standard: 5, hd: 5 },
    maxSide: 1280,
    frameRates: [24],
    features: { audio: false, imageToVideo: false, autoDuration: false, hd: false, enhancePrompt: false },
    loadSeconds: 87,
    clipSeconds: 41,
    dollarsPerHour: 2.1
  }
}

const STAGE_LABELS: Record<string, string> = {
  enhancing: 'Enhancing prompt',
  denoising: 'Denoising',
  upscaling: 'Upscaling 2x (HD)',
  refining: 'Refining at full size (HD)',
  encoding: 'Encoding MP4'
}

/**
 * State and actions for the video models. Shares the Modal proxy-token keys
 * with the Qwen settings (the same keys work for every app in the workspace).
 */
export const useVideoApi = () => {
  // Same state keys as useQwenApi, so Settings in either studio apply to both.
  const endpointMode = useState<'nitro' | 'local' | 'custom'>('settings-endpoint-mode', () => 'nitro')
  const customEndpoint = useState('settings-custom-endpoint', () => 'https://shivankkunwar100--qwen-image-21-api.modal.run')
  const modalKey = useState('settings-modal-key', () => '')
  const modalSecret = useState('settings-modal-secret', () => '')
  // An image URL handed over by the image studio's "Animate" button.
  const pendingStartImage = useState<string | null>('video-pending-start-image', () => null)

  const model = ref<VideoModelId>('ltx')
  const info = computed(() => VIDEO_MODELS[model.value])

  // Form state
  const prompt = ref('')
  const startImage = ref<string | null>(null)
  const quality = ref<VideoQuality>('standard')
  const aspectRatio = ref<VideoAspectRatio>('16:9')
  const followImageShape = ref(true)
  const useCustomDimensions = ref(false)
  const customWidth = ref(960)
  const customHeight = ref(544)
  const duration = ref(5)
  const autoDuration = ref(false)
  const minSeconds = ref(2)
  const maxSeconds = ref(10)
  const frameRate = ref(24)
  const numVideos = ref(1)
  const seed = ref<number | null>(null)
  const randomSeed = ref(true)
  const enhancePrompt = ref(false)

  // Job state
  const isGenerating = ref(false)
  const activeJobId = ref<string | null>(null)
  const jobStatus = ref<JobStatus>('idle')
  const progress = ref<VideoProgress | null>(null)
  const elapsedSeconds = ref(0)
  const currentResult = ref<VideoJobResponse | null>(null)
  const currentRequest = ref<VideoRequest | null>(null)
  const errorMessage = ref<string | null>(null)
  const health = ref<Record<VideoModelId, boolean | null>>({ ltx: null, fastwan: null })
  const history = ref<VideoHistoryItem[]>([])

  let timerInterval: any = null
  let pollTimeout: any = null
  let startTime = 0
  let stageStartedAt = 0
  let stageKey = ''

  const headers = () => {
    const h: Record<string, string> = { 'Content-Type': 'application/json' }
    if (modalKey.value) h['x-modal-key'] = modalKey.value
    if (modalSecret.value) h['x-modal-secret'] = modalSecret.value
    return h
  }
  const base = (m: VideoModelId = model.value) => `/api/video/${m}`

  // Keep the form inside what the selected model supports.
  watch(model, () => {
    const i = info.value
    if (!i.features.hd) quality.value = 'standard'
    if (!i.aspectRatios.includes(aspectRatio.value)) aspectRatio.value = '16:9'
    if (!i.features.autoDuration) autoDuration.value = false
    if (!i.features.enhancePrompt) enhancePrompt.value = false
    if (!i.frameRates.includes(frameRate.value)) frameRate.value = i.frameRates[0]
    duration.value = Math.min(duration.value, i.maxSeconds[quality.value])
    customWidth.value = Math.min(customWidth.value, i.maxSide)
    customHeight.value = Math.min(customHeight.value, i.maxSide)
    saveUi()
  })
  watch(quality, (q) => {
    if (q === 'hd') autoDuration.value = false
    duration.value = Math.min(duration.value, info.value.maxSeconds[q])
  })

  const outputSize = computed<[number, number] | null>(() => {
    if (useCustomDimensions.value) return [customWidth.value, customHeight.value]
    if (startImage.value && followImageShape.value && info.value.features.imageToVideo) return null
    return info.value.sizes[quality.value][aspectRatio.value] ?? null
  })

  // Rough cost of this request: GPU + RAM while generating, plus one cold start + 60 s idle.
  const estimate = computed(() => {
    const i = info.value
    let clip = i.clipSeconds
    const seconds = autoDuration.value ? 5 : duration.value
    clip *= Math.max(seconds / 5, 0.4)
    if (quality.value === 'hd') clip *= 3
    if (enhancePrompt.value) clip += 8
    const warm = clip * numVideos.value
    const perSecond = i.dollarsPerHour / 3600
    return {
      warmSeconds: Math.round(warm),
      warmDollars: warm * perSecond,
      coldDollars: (warm + i.loadSeconds + 15 + 60) * perSecond
    }
  })

  const buildPayload = (): VideoRequest => {
    const i = info.value
    const p: VideoRequest = {
      prompt: prompt.value.trim(),
      aspect_ratio: null,
      width: null,
      height: null,
      duration: autoDuration.value ? null : duration.value,
      num_videos: numVideos.value,
      seed: randomSeed.value ? null : seed.value
    }
    if (useCustomDimensions.value) {
      p.width = customWidth.value
      p.height = customHeight.value
    } else if (!(startImage.value && followImageShape.value && i.features.imageToVideo)) {
      p.aspect_ratio = aspectRatio.value
    }
    if (i.features.imageToVideo) p.image = startImage.value
    if (i.features.hd) p.quality = quality.value
    if (i.features.autoDuration && autoDuration.value) {
      p.min_seconds = minSeconds.value
      p.max_seconds = maxSeconds.value
    }
    if (i.frameRates.length > 1) p.frame_rate = frameRate.value
    if (i.features.enhancePrompt) p.enhance_prompt = enhancePrompt.value
    return p
  }

  const stopTimers = () => {
    clearInterval(timerInterval)
    clearTimeout(pollTimeout)
  }

  const generate = async () => {
    if (!prompt.value.trim() || isGenerating.value) return
    errorMessage.value = null
    isGenerating.value = true
    jobStatus.value = 'starting'
    progress.value = null
    elapsedSeconds.value = 0
    startTime = Date.now()
    stageKey = ''
    clearInterval(timerInterval)
    timerInterval = setInterval(() => {
      elapsedSeconds.value = Math.floor((Date.now() - startTime) / 1000)
    }, 500)

    const payload = buildPayload()
    const jobModel = model.value
    try {
      const job: any = await $fetch(`${base(jobModel)}/jobs`, { method: 'POST', headers: headers(), body: payload })
      if (!job?.id) throw new Error('No job ID returned from API')
      activeJobId.value = job.id
      poll(job.id, jobModel, payload)
    } catch (err: any) {
      stopTimers()
      isGenerating.value = false
      jobStatus.value = 'failed'
      errorMessage.value = errorText(err)
    }
  }

  const errorText = (err: any) => {
    const detail = err?.data?.detail
    if (Array.isArray(detail)) return detail.map((d: any) => d.msg).join('; ')
    return detail || err?.data?.statusMessage || err?.statusMessage || err?.message || 'Generation failed'
  }

  const poll = async (jobId: string, jobModel: VideoModelId, payload: VideoRequest) => {
    if (!isGenerating.value || activeJobId.value !== jobId) return
    try {
      const res: any = await $fetch(`${base(jobModel)}/jobs/${jobId}`, { headers: headers() })
      if (res.status === 'starting' || res.status === 'running') {
        jobStatus.value = res.status
        const p: VideoProgress | null = res.progress || null
        const key = p ? `${p.video}:${p.stage}` : ''
        if (key !== stageKey) {
          stageKey = key
          stageStartedAt = Date.now()
        }
        progress.value = p
      } else if (res.status === 'done') {
        stopTimers()
        elapsedSeconds.value = Math.round((Date.now() - startTime) / 1000)
        jobStatus.value = 'done'
        isGenerating.value = false
        const result: VideoJobResponse = {
          ...res,
          videos: (res.videos || []).map((v: any, i: number) => ({ ...v, url: `${base(jobModel)}/jobs/${jobId}/videos/${i}` }))
        }
        currentResult.value = result
        currentRequest.value = payload
        addToHistory(result, payload, jobModel)
        return
      } else if (res.status === 'failed') {
        stopTimers()
        jobStatus.value = 'failed'
        isGenerating.value = false
        errorMessage.value = res.error || 'Job failed on the GPU worker'
        return
      }
      pollTimeout = setTimeout(() => poll(jobId, jobModel, payload), 2200)
    } catch (err) {
      console.error('Error polling video job', err)
      pollTimeout = setTimeout(() => poll(jobId, jobModel, payload), 3000)
    }
  }

  // Progress for the bar: step counts when the model reports them (LTX),
  // otherwise time against the measured clip time (FastWan has no step callback).
  const percent = computed(() => {
    void elapsedSeconds.value // re-evaluate every tick
    const p = progress.value
    if (jobStatus.value === 'starting' || !p) return 8
    const total = p.videos || 1
    const done = (p.video || 1) - 1
    let within = 0.5
    if (p.stage === 'enhancing') within = 0.03
    else if (p.steps && p.step) {
      const frac = p.step / p.steps
      within = p.stage === 'refining' ? 0.75 + 0.2 * frac : p.stage === 'denoising' && quality.value === 'hd' ? 0.6 * frac : 0.9 * frac
    } else if (p.stage === 'upscaling') within = 0.65
    else if (p.stage === 'encoding') within = 0.96
    else if (p.expected_seconds) within = Math.min((Date.now() - stageStartedAt) / 1000 / p.expected_seconds, 0.95)
    return Math.min(Math.round(((done + within) / total) * 100), 98)
  })

  const progressTitle = computed(() => {
    const p = progress.value
    if (jobStatus.value === 'starting' || !p) return 'Initializing GPU Container...'
    return `Generating Video ${p.video} of ${p.videos}`
  })

  const progressDetail = computed(() => {
    const p = progress.value
    if (jobStatus.value === 'starting' || !p) {
      return `Waking the ${info.value.gpu} worker (cold start ~${info.value.loadSeconds + 15}s if idle)`
    }
    const label = STAGE_LABELS[p.stage] || p.stage
    if (p.step && p.steps) return `${label} · step ${p.step} of ${p.steps} (${percent.value}%)`
    if (p.expected_seconds) return `${label} · 3 steps, ~${p.expected_seconds}s per clip`
    return label
  })

  const cancelGeneration = () => {
    // Stops polling only; the GPU finishes the job (and bills for it) regardless.
    stopTimers()
    isGenerating.value = false
    jobStatus.value = 'idle'
    activeJobId.value = null
  }

  const addToHistory = (res: VideoJobResponse, req: VideoRequest, m: VideoModelId) => {
    // Never store the start frame (a data URL) in localStorage: it would fill the quota.
    const { image, ...light } = req
    history.value.unshift({
      id: res.id,
      model: m,
      timestamp: Date.now(),
      request: { ...light, image: image ? '(start frame)' : null },
      response: res,
      durationSeconds: elapsedSeconds.value
    })
    saveHistory()
  }

  const reuseSettings = (item: VideoHistoryItem | { request: VideoRequest; model: VideoModelId }) => {
    const r = item.request
    model.value = item.model
    nextTick(() => {
      prompt.value = r.prompt
      if (r.quality) quality.value = r.quality
      if (r.width && r.height) {
        useCustomDimensions.value = true
        customWidth.value = r.width
        customHeight.value = r.height
      } else {
        useCustomDimensions.value = false
        if (r.aspect_ratio) aspectRatio.value = r.aspect_ratio
      }
      autoDuration.value = r.duration === null
      if (r.duration) duration.value = r.duration
      if (r.min_seconds) minSeconds.value = r.min_seconds
      if (r.max_seconds) maxSeconds.value = r.max_seconds
      if (r.frame_rate) frameRate.value = r.frame_rate
      numVideos.value = r.num_videos
      enhancePrompt.value = !!r.enhance_prompt
      const s = item.request.seed ?? (item as VideoHistoryItem).response?.videos?.[0]?.seed
      if (s !== null && s !== undefined) {
        seed.value = s
        randomSeed.value = false
      }
    })
  }

  // Grab a frame from a finished clip (first or last) as the next start frame.
  const frameError = ref<string | null>(null)
  const useFrameAsStart = async (videoUrl: string, which: 'first' | 'last') => {
    frameError.value = null
    const blob = await (await fetch(videoUrl, { headers: headers() })).blob()
    const src = URL.createObjectURL(blob)
    try {
      startImage.value = await new Promise<string>((resolve, reject) => {
        // Browsers can hold back media decoding (for example in a background tab).
        const timer = setTimeout(() => reject(new Error('the browser did not decode the video in time')), 15000)
        const v = document.createElement('video')
        v.muted = true
        v.preload = 'auto'
        v.src = src
        v.onloadedmetadata = () => {
          v.currentTime = which === 'first' ? 0 : Math.max(v.duration - 0.05, 0)
        }
        v.onseeked = () => {
          const c = document.createElement('canvas')
          c.width = v.videoWidth
          c.height = v.videoHeight
          c.getContext('2d')!.drawImage(v, 0, 0)
          clearTimeout(timer)
          resolve(c.toDataURL('image/png'))
        }
        v.onerror = () => {
          clearTimeout(timer)
          reject(new Error('could not read the video'))
        }
      })
      model.value = 'ltx' // only LTX does image-to-video
      followImageShape.value = true
    } catch (err: any) {
      frameError.value = `Could not take the ${which} frame: ${err?.message || err}`
      throw err
    } finally {
      URL.revokeObjectURL(src)
    }
  }

  // Turn any image URL (for example a Qwen result) into the start frame.
  const setStartImageFromUrl = async (url: string) => {
    const blob = await (await fetch(url)).blob()
    startImage.value = await new Promise<string>((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.readAsDataURL(blob)
    })
    model.value = 'ltx'
    followImageShape.value = true
  }

  const checkHealth = async (m: VideoModelId = model.value) => {
    try {
      const res: any = await $fetch(`${base(m)}/health`, { headers: headers() })
      health.value[m] = res?.ok === true
    } catch {
      health.value[m] = false
    }
    return health.value[m]
  }

  const saveHistory = () => {
    try {
      localStorage.setItem('video_gui_history', JSON.stringify(history.value.slice(0, 30)))
    } catch (err) {
      console.error('Failed to save video history', err)
    }
  }

  const saveUi = () => {
    try {
      localStorage.setItem('video_gui_model', model.value)
    } catch {}
  }

  const saveSettings = () => {
    try {
      localStorage.setItem('qwen_gui_settings', JSON.stringify({
        endpointMode: endpointMode.value,
        customEndpoint: customEndpoint.value,
        modalKey: modalKey.value,
        modalSecret: modalSecret.value
      }))
    } catch (err) {
      console.error('Failed to save settings to localStorage', err)
    }
  }

  onMounted(async () => {
    try {
      const settings = localStorage.getItem('qwen_gui_settings')
      if (settings) {
        const parsed = JSON.parse(settings)
        if (parsed.endpointMode) endpointMode.value = parsed.endpointMode
        if (parsed.customEndpoint) customEndpoint.value = parsed.customEndpoint
        if (parsed.modalKey) modalKey.value = parsed.modalKey
        if (parsed.modalSecret) modalSecret.value = parsed.modalSecret
      }
      const saved = localStorage.getItem('video_gui_history')
      if (saved) history.value = JSON.parse(saved)
      const m = localStorage.getItem('video_gui_model') as VideoModelId | null
      if (m && m in VIDEO_MODELS) model.value = m
    } catch (err) {
      console.error('Failed to load video settings', err)
    }
    if (pendingStartImage.value) {
      const url = pendingStartImage.value
      pendingStartImage.value = null
      await setStartImageFromUrl(url).catch((err) => console.error('Could not load the start frame', err))
    }
    checkHealth('ltx')
    checkHealth('fastwan')
  })

  onUnmounted(stopTimers)

  return {
    model, info,
    prompt, startImage, quality, aspectRatio, followImageShape, useCustomDimensions, customWidth, customHeight,
    duration, autoDuration, minSeconds, maxSeconds, frameRate, numVideos, seed, randomSeed, enhancePrompt,
    outputSize, estimate,
    isGenerating, jobStatus, progress, percent, progressTitle, progressDetail, elapsedSeconds,
    currentResult, currentRequest, errorMessage, frameError, health, history,
    endpointMode, customEndpoint, modalKey, modalSecret, saveSettings,
    generate, cancelGeneration, reuseSettings, useFrameAsStart, setStartImageFromUrl, checkHealth, saveHistory
  }
}
