import type {
  AspectRatio,
  SizeTier,
  OutputFormat,
  GenerateRequest,
  JobResponse,
  JobProgress,
  ApiOptions,
  GenerationHistoryItem
} from '~/types/api'

export const useQwenApi = () => {
  // Form State
  const prompt = ref('')
  const images = ref<string[]>([])
  const size = ref<SizeTier>('1k')
  const aspectRatio = ref<AspectRatio>('1:1')
  const useCustomDimensions = ref(false)
  const customWidth = ref<number>(1024)
  const customHeight = ref<number>(1024)
  const numImages = ref(1)
  const steps = ref(40)
  const seed = ref<number | null>(null)
  const randomSeed = ref(true)
  const transparent = ref(false)
  const negativePrompt = ref('')
  const guidanceScale = ref(1.0)
  const outputFormat = ref<OutputFormat>('png')
  const quality = ref(95)
  const useKvCache = ref(true)
  const executionMode = ref<'job' | 'sync'>('job')

  // Connection Settings (Persisted in localStorage; shared with the video studio via useState)
  const endpointMode = useState<'nitro' | 'local' | 'custom'>('settings-endpoint-mode', () => 'nitro')
  const customEndpoint = useState('settings-custom-endpoint', () => 'https://shivankkunwar100--qwen-image-21-api.modal.run')
  const modalKey = useState('settings-modal-key', () => '')
  const modalSecret = useState('settings-modal-secret', () => '')

  // Active Job State
  const isGenerating = ref(false)
  const activeJobId = ref<string | null>(null)
  const jobStatus = ref<'idle' | 'starting' | 'running' | 'done' | 'failed'>('idle')
  const progress = ref<JobProgress | null>(null)
  const elapsedSeconds = ref(0)
  const currentResult = ref<JobResponse | null>(null)
  const errorMessage = ref<string | null>(null)
  const isHealthy = ref<boolean | null>(null)

  // API Options (loaded from server)
  const apiOptions = ref<ApiOptions | null>(null)

  // Session History
  const history = ref<GenerationHistoryItem[]>([])

  // Timer reference for elapsed time & polling
  let timerInterval: any = null
  let pollTimeout: any = null
  let startTime = 0

  // Headers for client-to-server proxy communication
  const getHeaders = () => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    }
    if (modalKey.value) headers['x-modal-key'] = modalKey.value
    if (modalSecret.value) headers['x-modal-secret'] = modalSecret.value

    if (endpointMode.value === 'custom') {
      if (customEndpoint.value) headers['x-custom-endpoint'] = customEndpoint.value
    } else if (endpointMode.value === 'local') {
      headers['x-custom-endpoint'] = 'http://127.0.0.1:8787'
    }
    return headers
  }

  // Load Settings from LocalStorage
  const loadSettings = () => {
    if (import.meta.client) {
      try {
        const savedSettings = localStorage.getItem('qwen_gui_settings')
        if (savedSettings) {
          const parsed = JSON.parse(savedSettings)
          if (parsed.endpointMode) endpointMode.value = parsed.endpointMode
          if (parsed.customEndpoint) customEndpoint.value = parsed.customEndpoint
          if (parsed.modalKey) modalKey.value = parsed.modalKey
          if (parsed.modalSecret) modalSecret.value = parsed.modalSecret
        }

        const savedHistory = localStorage.getItem('qwen_gui_history')
        if (savedHistory) {
          history.value = JSON.parse(savedHistory)
        }
      } catch (err) {
        console.error('Failed to load local storage settings', err)
      }
    }
  }

  // Save Settings to LocalStorage
  const saveSettings = () => {
    if (import.meta.client) {
      try {
        localStorage.setItem(
          'qwen_gui_settings',
          JSON.stringify({
            endpointMode: endpointMode.value,
            customEndpoint: customEndpoint.value,
            modalKey: modalKey.value,
            modalSecret: modalSecret.value
          })
        )
      } catch (err) {
        console.error('Failed to save settings to localStorage', err)
      }
    }
  }

  // Save History to LocalStorage
  const saveHistory = () => {
    if (import.meta.client) {
      try {
        // Keep up to 30 items
        localStorage.setItem('qwen_gui_history', JSON.stringify(history.value.slice(0, 30)))
      } catch (err) {
        console.error('Failed to save history', err)
      }
    }
  }

  // Health Check
  const checkHealth = async () => {
    try {
      const res: any = await $fetch('/api/health', {
        headers: getHeaders()
      })
      isHealthy.value = res?.ok === true
      return isHealthy.value
    } catch (err) {
      isHealthy.value = false
      return false
    }
  }

  // Fetch Options
  const fetchOptions = async () => {
    try {
      const data: any = await $fetch('/api/options', {
        headers: getHeaders()
      })
      apiOptions.value = data
    } catch (err) {
      console.warn('Could not fetch /v1/options, using fallback defaults', err)
    }
  }

  // Build Payload
  const buildPayload = (): GenerateRequest => {
    const payload: GenerateRequest = {
      prompt: prompt.value.trim(),
      images: images.value,
      size: size.value,
      aspect_ratio: useCustomDimensions.value ? null : aspectRatio.value,
      width: useCustomDimensions.value ? customWidth.value : null,
      height: useCustomDimensions.value ? customHeight.value : null,
      num_images: numImages.value,
      steps: steps.value,
      seed: randomSeed.value ? null : seed.value,
      transparent: transparent.value,
      negative_prompt: guidanceScale.value > 1 && negativePrompt.value.trim() ? negativePrompt.value.trim() : null,
      guidance_scale: guidanceScale.value,
      output_format: outputFormat.value,
      quality: quality.value,
      use_kv_cache: useKvCache.value
    }
    return payload
  }

  // Start Generation
  const generate = async () => {
    if (!prompt.value.trim() || isGenerating.value) return

    errorMessage.value = null
    isGenerating.value = true
    jobStatus.value = 'starting'
    progress.value = null
    elapsedSeconds.value = 0
    startTime = Date.now()

    // Start timer counter
    clearInterval(timerInterval)
    timerInterval = setInterval(() => {
      elapsedSeconds.value = Math.floor((Date.now() - startTime) / 1000)
    }, 500)

    const payload = buildPayload()

    try {
      if (executionMode.value === 'sync') {
        // Synchronous /v1/generate call
        const response: any = await $fetch('/api/generate', {
          method: 'POST',
          headers: getHeaders(),
          body: payload
        })

        clearInterval(timerInterval)
        elapsedSeconds.value = Math.round((Date.now() - startTime) / 1000)
        jobStatus.value = 'done'
        isGenerating.value = false

        const resObj: JobResponse = {
          id: `sync-${Date.now()}`,
          status: 'done',
          prompt_used: payload.prompt,
          seconds: elapsedSeconds.value,
          images: (response.images || []).map((img: any) => ({
            ...img,
            url: img.data_url || img.url
          }))
        }
        currentResult.value = resObj
        addToHistory(resObj, payload)
      } else {
        // Job-based /v1/jobs flow
        const jobInit: any = await $fetch('/api/jobs', {
          method: 'POST',
          headers: getHeaders(),
          body: payload
        })

        if (!jobInit?.id) {
          throw new Error('No job ID returned from API')
        }

        activeJobId.value = jobInit.id
        jobStatus.value = 'starting'
        pollJob(jobInit.id, payload)
      }
    } catch (err: any) {
      clearInterval(timerInterval)
      isGenerating.value = false
      jobStatus.value = 'failed'
      errorMessage.value = err.data?.detail || err.statusMessage || err.message || 'Generation failed'
    }
  }

  // Poll Job Status
  const pollJob = async (jobId: string, originalPayload: GenerateRequest) => {
    if (!isGenerating.value || activeJobId.value !== jobId) return

    try {
      const res: any = await $fetch(`/api/jobs/${jobId}`, {
        headers: getHeaders()
      })

      if (res.status === 'starting') {
        jobStatus.value = 'starting'
        progress.value = null
      } else if (res.status === 'running') {
        jobStatus.value = 'running'
        progress.value = res.progress || null
      } else if (res.status === 'done') {
        clearInterval(timerInterval)
        elapsedSeconds.value = res.seconds || Math.round((Date.now() - startTime) / 1000)
        jobStatus.value = 'done'
        isGenerating.value = false

        // Resolve absolute or proxy image URLs
        const imagesWithUrls = (res.images || []).map((img: any, idx: number) => ({
          ...img,
          url: `/api/jobs/${jobId}/images/${idx}`
        }))

        currentResult.value = {
          ...res,
          images: imagesWithUrls
        }

        addToHistory(currentResult.value!, originalPayload)
        return
      } else if (res.status === 'failed') {
        clearInterval(timerInterval)
        jobStatus.value = 'failed'
        isGenerating.value = false
        errorMessage.value = res.error || 'Job failed on worker'
        return
      }

      // Schedule next poll (2.2 seconds)
      pollTimeout = setTimeout(() => {
        pollJob(jobId, originalPayload)
      }, 2200)
    } catch (err: any) {
      console.error('Error polling job', err)
      // Retry up to 3 times before failing
      pollTimeout = setTimeout(() => {
        pollJob(jobId, originalPayload)
      }, 3000)
    }
  }

  // Add Item to History
  const addToHistory = (res: JobResponse, req: GenerateRequest) => {
    const item: GenerationHistoryItem = {
      id: res.id,
      timestamp: Date.now(),
      request: req,
      response: res,
      durationSeconds: res.seconds || elapsedSeconds.value
    }
    history.value.unshift(item)
    saveHistory()
  }

  // Cancel generation
  const cancelGeneration = () => {
    clearInterval(timerInterval)
    clearTimeout(pollTimeout)
    isGenerating.value = false
    jobStatus.value = 'idle'
    activeJobId.value = null
  }

  // Reuse settings from a result or history item
  const reuseSettings = (item: GenerationHistoryItem | JobResponse, req?: GenerateRequest) => {
    const targetReq = req || ('request' in item ? (item as GenerationHistoryItem).request : null)
    if (targetReq) {
      prompt.value = targetReq.prompt
      size.value = targetReq.size
      if (targetReq.aspect_ratio) {
        aspectRatio.value = targetReq.aspect_ratio
        useCustomDimensions.value = false
      } else if (targetReq.width && targetReq.height) {
        useCustomDimensions.value = true
        customWidth.value = targetReq.width
        customHeight.value = targetReq.height
      }
      steps.value = targetReq.steps
      if (targetReq.seed !== null && targetReq.seed !== undefined) {
        seed.value = targetReq.seed
        randomSeed.value = false
      }
      transparent.value = targetReq.transparent
      guidanceScale.value = targetReq.guidance_scale
      negativePrompt.value = targetReq.negative_prompt || ''
      outputFormat.value = targetReq.output_format
      quality.value = targetReq.quality
      useKvCache.value = targetReq.use_kv_cache
    } else if ('prompt_used' in item && item.prompt_used) {
      prompt.value = item.prompt_used
      if (item.images && item.images[0]?.seed !== undefined) {
        seed.value = item.images[0].seed
        randomSeed.value = false
      }
    }
  }

  // Use generated image as reference
  const useAsReference = async (imageUrl: string) => {
    try {
      const response = await fetch(imageUrl)
      const blob = await response.blob()
      const reader = new FileReader()
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          if (images.value.length < 10) {
            images.value.push(reader.result)
          }
        }
      }
      reader.readAsDataURL(blob)
    } catch (err) {
      console.error('Failed to convert image to reference', err)
    }
  }

  // Add reference image (dataUrl)
  const addReferenceImage = (dataUrl: string) => {
    if (images.value.length < 10) {
      images.value.push(dataUrl)
    }
  }

  // Remove reference image
  const removeReferenceImage = (index: number) => {
    images.value.splice(index, 1)
  }

  // Move reference image order (order matters for Qwen!)
  const moveReferenceImage = (from: number, to: number) => {
    if (to < 0 || to >= images.value.length) return
    const [moved] = images.value.splice(from, 1)
    images.value.splice(to, 0, moved)
  }

  // Replace reference image (e.g. after drawing/annotating)
  const updateReferenceImage = (index: number, newDataUrl: string) => {
    if (index >= 0 && index < images.value.length) {
      images.value[index] = newDataUrl
    }
  }

  // Clear all images
  const clearReferenceImages = () => {
    images.value = []
  }

  onMounted(() => {
    loadSettings()
    checkHealth()
    fetchOptions()
  })

  onUnmounted(() => {
    clearInterval(timerInterval)
    clearTimeout(pollTimeout)
  })

  return {
    // Form
    prompt,
    images,
    size,
    aspectRatio,
    useCustomDimensions,
    customWidth,
    customHeight,
    numImages,
    steps,
    seed,
    randomSeed,
    transparent,
    negativePrompt,
    guidanceScale,
    outputFormat,
    quality,
    useKvCache,
    executionMode,

    // Settings
    endpointMode,
    customEndpoint,
    modalKey,
    modalSecret,
    saveSettings,

    // State
    isGenerating,
    activeJobId,
    jobStatus,
    progress,
    elapsedSeconds,
    currentResult,
    errorMessage,
    isHealthy,
    apiOptions,
    history,

    // Actions
    generate,
    cancelGeneration,
    checkHealth,
    fetchOptions,
    reuseSettings,
    useAsReference,
    addReferenceImage,
    removeReferenceImage,
    moveReferenceImage,
    updateReferenceImage,
    clearReferenceImages
  }
}
