export type AspectRatio = '1:1' | '4:3' | '3:4' | '3:2' | '2:3' | '16:9' | '9:16'

export type SizeTier = '1k' | '2k'

export type OutputFormat = 'png' | 'webp' | 'jpeg'

export interface GenerateRequest {
  prompt: string
  images: string[]
  size: SizeTier
  aspect_ratio: AspectRatio | null
  width: number | null
  height: number | null
  num_images: number
  steps: number
  seed: number | null
  transparent: boolean
  negative_prompt: string | null
  guidance_scale: number
  output_format: OutputFormat
  quality: number
  use_kv_cache: boolean
}

export interface JobProgress {
  image: number
  images: number
  step: number
  steps: number
}

export interface JobImage {
  seed: number
  width: number
  height: number
  format: OutputFormat | string
  seconds: number
  url: string
  data_url?: string
}

export type JobStatus = 'idle' | 'starting' | 'running' | 'done' | 'failed'

export interface JobResponse {
  id: string
  status: JobStatus
  status_url?: string
  progress?: JobProgress | null
  prompt_used?: string
  reference_images?: number
  seconds?: number
  images?: JobImage[]
  error?: string
}

export interface ApiOptions {
  size_presets: Record<SizeTier, Record<AspectRatio, { width: number; height: number }>>
  output_formats: OutputFormat[]
  limits: {
    min_side: number
    max_side: number
    side_multiple: number
    max_reference_images: number
    max_images_per_request: number
    max_upload_mb: number
  }
}

export interface GenerationHistoryItem {
  id: string
  timestamp: number
  request: GenerateRequest
  response: JobResponse
  durationSeconds: number
}

// ---------------------------------------------------------------------------
// Video models (video-modal/: LTX-2.5 and FastWan 2.2)
// ---------------------------------------------------------------------------
export type StudioMode = 'image' | VideoModelId

export type VideoModelId = 'ltx' | 'fastwan'

export type VideoAspectRatio = '16:9' | '9:16' | '1:1' | '4:3' | '3:4'

export type VideoQuality = 'standard' | 'hd'

export interface VideoRequest {
  prompt: string
  image?: string | null
  quality?: VideoQuality
  aspect_ratio: VideoAspectRatio | null
  width: number | null
  height: number | null
  duration: number | null
  min_seconds?: number
  max_seconds?: number
  frame_rate?: number
  num_videos: number
  seed: number | null
  enhance_prompt?: boolean
}

export interface VideoProgress {
  video: number
  videos: number
  stage: 'enhancing' | 'denoising' | 'upscaling' | 'refining' | 'encoding' | string
  step?: number | null
  steps?: number | null
  expected_seconds?: number
}

export interface JobVideo {
  seed: number
  width: number
  height: number
  num_frames: number
  fps: number
  duration: number
  has_audio: boolean
  seconds: number
  url: string
}

export interface VideoJobResponse {
  id: string
  status: JobStatus
  progress?: VideoProgress | null
  prompt_used?: string
  enhanced?: boolean
  image_to_video?: boolean
  seconds?: number
  videos?: JobVideo[]
  error?: string
}

export interface VideoHistoryItem {
  id: string
  model: VideoModelId
  timestamp: number
  request: VideoRequest
  response: VideoJobResponse
  durationSeconds: number
}
