<script setup lang="ts">
import {
  Download,
  Copy,
  Check,
  RefreshCw,
  Hash,
  Clock,
  Film,
  Volume2,
  VolumeX,
  Wand2,
  SkipBack,
  SkipForward,
  Repeat
} from '@lucide/vue'
import type { JobVideo, VideoJobResponse } from '~/types/api'

const props = defineProps<{
  result: VideoJobResponse
  modelName: string
  canUseFrames: boolean
}>()

const emit = defineEmits<{
  (e: 'reuse-settings'): void
  (e: 'use-frame', url: string, which: 'first' | 'last'): void
}>()

// Fetch each MP4 once into a blob: seeking and looping then stay local instead of
// sending a Range request to Modal (~1-3 s each from India) for every scrub.
const blobUrls = ref<Record<string, string>>({})
const loadBlobs = async () => {
  for (const v of props.result.videos || []) {
    if (blobUrls.value[v.url]) continue
    try {
      const res = await fetch(v.url)
      if (!res.ok) continue
      blobUrls.value = { ...blobUrls.value, [v.url]: URL.createObjectURL(await res.blob()) }
    } catch (err) {
      console.warn('Could not prefetch video, streaming it instead', err)
    }
  }
}
const revokeBlobs = () => {
  Object.values(blobUrls.value).forEach((u) => URL.revokeObjectURL(u))
  blobUrls.value = {}
}
watch(() => props.result.id, () => { revokeBlobs(); loadBlobs() })
onMounted(loadBlobs)
onUnmounted(revokeBlobs)
const srcOf = (v: JobVideo) => blobUrls.value[v.url] || v.url

const copiedSeedIndex = ref<number | null>(null)
const copiedPrompt = ref(false)
const loop = ref(true)
const busyFrame = ref<string | null>(null)

const copySeed = async (seed: number, index: number) => {
  await navigator.clipboard.writeText(String(seed))
  copiedSeedIndex.value = index
  setTimeout(() => (copiedSeedIndex.value = null), 1800)
}

const copyPromptText = async () => {
  if (!props.result.prompt_used) return
  await navigator.clipboard.writeText(props.result.prompt_used)
  copiedPrompt.value = true
  setTimeout(() => (copiedPrompt.value = false), 1800)
}

const download = (v: JobVideo) => {
  const link = document.createElement('a')
  link.href = srcOf(v)
  link.download = `${props.modelName.toLowerCase().replace(/[^a-z0-9]+/g, '')}_${v.seed}.mp4`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

const useFrame = (v: JobVideo, which: 'first' | 'last') => {
  busyFrame.value = `${v.url}:${which}`
  emit('use-frame', srcOf(v), which) // the prefetched blob when ready: no second download
  setTimeout(() => (busyFrame.value = null), 1500)
}
</script>

<template>
  <div class="result-viewer animate-enter">
    <div class="result-viewer__header">
      <div class="result-viewer__prompt-meta">
        <span class="result-viewer__eyebrow">
          Generation Complete · {{ modelName }}{{ result.image_to_video ? ' · image-to-video' : '' }}
        </span>
        <span v-if="result.enhanced" class="result-viewer__enhanced">
          <Wand2 :size="12" />
          <span>Enhanced prompt</span>
        </span>
        <h3 class="result-viewer__prompt-title">"{{ result.prompt_used }}"</h3>
      </div>

      <div class="result-viewer__top-actions">
        <button type="button" class="meta-btn" :class="{ 'meta-btn--on': loop }" title="Loop playback" @click="loop = !loop">
          <Repeat :size="13" />
          <span>Loop</span>
        </button>
        <button type="button" class="meta-btn" title="Copy prompt text" @click="copyPromptText">
          <Check v-if="copiedPrompt" :size="13" class="text-success" />
          <Copy v-else :size="13" />
          <span>{{ copiedPrompt ? 'Copied' : 'Copy Prompt' }}</span>
        </button>
        <button type="button" class="meta-btn meta-btn--accent" title="Load settings used for this generation" @click="emit('reuse-settings')">
          <RefreshCw :size="13" />
          <span>Reuse Settings</span>
        </button>
      </div>
    </div>

    <div class="result-gallery" :class="(result.videos?.length ?? 1) === 1 ? 'result-gallery--single' : 'result-gallery--multi'">
      <div v-for="(v, idx) in result.videos || []" :key="v.url" class="video-card">
        <div class="video-card__wrapper">
          <video
            :src="srcOf(v)"
            class="video-card__video"
            controls
            playsinline
            :loop="loop"
            preload="metadata"
            :style="{ aspectRatio: `${v.width} / ${v.height}` }"
          />
        </div>

        <div class="video-card__footer">
          <div class="video-card__specs">
            <span class="spec-tag">{{ v.width }}×{{ v.height }}</span>
            <span class="spec-tag">
              <Film :size="11" />
              <span>{{ v.duration }}s · {{ v.fps }}fps</span>
            </span>
            <span class="spec-tag" :title="v.has_audio ? 'Has synced audio' : 'No audio track'">
              <Volume2 v-if="v.has_audio" :size="11" />
              <VolumeX v-else :size="11" />
            </span>
            <span v-if="v.seconds" class="spec-tag" title="GPU time for this clip">
              <Clock :size="11" />
              <span>{{ v.seconds }}s</span>
            </span>
            <button type="button" class="spec-tag spec-tag--interactive" title="Click to copy seed" @click="copySeed(v.seed, idx)">
              <Hash :size="11" />
              <span>{{ copiedSeedIndex === idx ? 'Copied!' : v.seed }}</span>
            </button>
          </div>

          <div class="video-card__actions">
            <template v-if="canUseFrames">
              <button type="button" class="action-icon-btn" title="Use the first frame as the start frame (LTX-2.5)" @click="useFrame(v, 'first')">
                <SkipBack :size="14" />
                <span>{{ busyFrame === `${v.url}:first` ? 'Loading…' : 'First frame' }}</span>
              </button>
              <button type="button" class="action-icon-btn" title="Continue this clip: its last frame becomes the next start frame (LTX-2.5)" @click="useFrame(v, 'last')">
                <SkipForward :size="14" />
                <span>{{ busyFrame === `${v.url}:last` ? 'Loading…' : 'Continue' }}</span>
              </button>
            </template>
            <button type="button" class="action-icon-btn action-icon-btn--primary" title="Download MP4" @click="download(v)">
              <Download :size="14" />
              <span>Save</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.result-viewer {
  display: flex;
  flex-direction: column;
  gap: 16px;
  background-color: $color-bg-surface;
  border: 1px solid $color-border-subtle;
  border-radius: $radius-lg;
  padding: 20px;

  &__header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    padding-bottom: 14px;
    border-bottom: 1px solid $color-border-subtle;
    flex-wrap: wrap;
  }

  &__prompt-meta {
    display: flex;
    flex-direction: column;
    gap: 4px;
    max-width: 650px;
    min-width: 0;
  }

  &__eyebrow {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: $color-success;
    font-weight: $font-weight-semibold;
  }

  &__enhanced {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    align-self: flex-start;
    padding: 1px 8px;
    border-radius: $radius-full;
    background-color: $color-accent-soft;
    color: $color-accent;
    font-size: 11px;
    font-weight: $font-weight-medium;
  }

  &__prompt-title {
    font-size: $font-size-base;
    font-weight: $font-weight-medium;
    color: $color-text-primary;
    line-height: 1.45;
    max-height: 8.7em;
    overflow-y: auto;
  }

  &__top-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }
}

.meta-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 6px 11px;
  border-radius: $radius-sm;
  background-color: $color-bg-subtle;
  border: 1px solid $color-border-subtle;
  color: $color-text-secondary;
  font-size: $font-size-xs;
  font-weight: $font-weight-medium;

  &:hover {
    background-color: $color-bg-card-hover;
    color: $color-text-primary;
    border-color: $color-border-default;
  }

  &--on {
    color: $color-success;
    border-color: rgba(52, 211, 153, 0.3);
  }

  &--accent {
    color: $color-accent;
    background-color: $color-accent-soft;

    &:hover {
      background-color: rgba(56, 189, 248, 0.2);
    }
  }
}

.text-success {
  color: $color-success;
}

.result-gallery {
  display: grid;
  gap: 16px;

  &--single {
    grid-template-columns: 1fr;
    max-width: 900px;
    margin: 0 auto;
    width: 100%;
  }

  &--multi {
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  }
}

.video-card {
  background-color: $color-bg-canvas;
  border: 1px solid $color-border-default;
  border-radius: $radius-md;
  overflow: hidden;
  display: flex;
  flex-direction: column;

  &__wrapper {
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: #0b0f14;
  }

  &__video {
    display: block;
    width: 100%;
    height: auto;
    max-height: 620px;
    object-fit: contain;
    background-color: #000;
  }

  &__footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 14px;
    background-color: $color-bg-surface;
    border-top: 1px solid $color-border-subtle;
    flex-wrap: wrap;
    gap: 8px;
  }

  &__specs,
  &__actions {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
  }
}

.spec-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 7px;
  border-radius: 4px;
  background-color: $color-bg-subtle;
  color: $color-text-muted;
  font-size: 11px;
  font-family: var(--font-mono);

  &--interactive {
    cursor: pointer;

    &:hover {
      color: $color-text-primary;
      background-color: $color-bg-card-hover;
    }
  }
}

.action-icon-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  border-radius: $radius-sm;
  background-color: $color-bg-subtle;
  border: 1px solid $color-border-subtle;
  color: $color-text-secondary;
  font-size: 11px;
  font-weight: $font-weight-medium;

  &:hover {
    background-color: $color-bg-card-hover;
    color: $color-text-primary;
  }

  &--primary {
    background: linear-gradient(135deg, #2563eb, #1d4ed8);
    color: #ffffff;
    border-color: transparent;

    &:hover {
      background: linear-gradient(135deg, #3b82f6, #2563eb);
    }
  }
}
</style>
