<script setup lang="ts">
import {
  Download,
  Copy,
  Check,
  Maximize2,
  RefreshCw,
  PlusCircle,
  Hash,
  Clock,
  Sparkles,
  Film,
  X
} from '@lucide/vue'
import type { JobResponse, JobImage } from '~/types/api'

const props = defineProps<{
  result: JobResponse
  transparent?: boolean
}>()

const emit = defineEmits<{
  (e: 'reuse-settings'): void
  (e: 'use-as-reference', imageUrl: string): void
  (e: 'animate', imageUrl: string): void
}>()

const copiedSeedIndex = ref<number | null>(null)
const copiedPrompt = ref(false)
const lightboxImage = ref<JobImage | null>(null)

const copySeed = async (seed: number, index: number) => {
  await navigator.clipboard.writeText(String(seed))
  copiedSeedIndex.value = index
  setTimeout(() => {
    copiedSeedIndex.value = null
  }, 1800)
}

const copyPromptText = async () => {
  if (props.result.prompt_used) {
    await navigator.clipboard.writeText(props.result.prompt_used)
    copiedPrompt.value = true
    setTimeout(() => {
      copiedPrompt.value = false
    }, 1800)
  }
}

const downloadImage = (img: JobImage) => {
  const link = document.createElement('a')
  link.href = img.url
  link.download = `qwen_${img.seed}.${img.format || 'png'}`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

const openLightbox = (img: JobImage) => {
  lightboxImage.value = img
}

const closeLightbox = () => {
  lightboxImage.value = null
}
</script>

<template>
  <div class="result-viewer animate-enter">
    <!-- Header with Prompt summary -->
    <div class="result-viewer__header">
      <div class="result-viewer__prompt-meta">
        <span class="result-viewer__eyebrow">Generation Complete</span>
        <h3 class="result-viewer__prompt-title">"{{ result.prompt_used }}"</h3>
      </div>

      <div class="result-viewer__top-actions">
        <button
          type="button"
          class="meta-btn"
          title="Copy prompt text"
          @click="copyPromptText"
        >
          <Check v-if="copiedPrompt" :size="13" class="text-success" />
          <Copy v-else :size="13" />
          <span>{{ copiedPrompt ? 'Copied' : 'Copy Prompt' }}</span>
        </button>

        <button
          type="button"
          class="meta-btn meta-btn--accent"
          title="Load settings used for this generation"
          @click="emit('reuse-settings')"
        >
          <RefreshCw :size="13" />
          <span>Reuse Settings</span>
        </button>
      </div>
    </div>

    <!-- Images Gallery Grid -->
    <div
      class="result-gallery"
      :class="{
        'result-gallery--single': (result.images?.length ?? 1) === 1,
        'result-gallery--multi': (result.images?.length ?? 1) > 1
      }"
    >
      <div
        v-for="(img, idx) in result.images || []"
        :key="img.seed || idx"
        class="image-card"
        :class="{ 'image-card--checker': transparent }"
      >
        <div class="image-card__wrapper" @click="openLightbox(img)">
          <img
            :src="img.url"
            :alt="`Qwen Image ${img.seed}`"
            loading="lazy"
            class="image-card__img"
          />
          <div class="image-card__overlay">
            <span class="image-card__zoom-hint">
              <Maximize2 :size="16" />
              <span>Inspect</span>
            </span>
          </div>
        </div>

        <!-- Image Info Footer -->
        <div class="image-card__footer">
          <div class="image-card__specs">
            <span class="spec-tag">{{ img.width }}×{{ img.height }}</span>
            <span v-if="img.seconds" class="spec-tag">
              <Clock :size="11" />
              <span>{{ img.seconds }}s</span>
            </span>
            <button
              type="button"
              class="spec-tag spec-tag--interactive"
              title="Click to copy seed"
              @click.stop="copySeed(img.seed, idx)"
            >
              <Hash :size="11" />
              <span>{{ copiedSeedIndex === idx ? 'Copied!' : img.seed }}</span>
            </button>
          </div>

          <div class="image-card__actions">
            <button
              type="button"
              class="action-icon-btn"
              title="Use as reference image for next edit"
              @click.stop="emit('use-as-reference', img.url)"
            >
              <PlusCircle :size="14" />
              <span>Iterate</span>
            </button>

            <button
              type="button"
              class="action-icon-btn"
              title="Animate this image with LTX-2.5 (image-to-video)"
              @click.stop="emit('animate', img.url)"
            >
              <Film :size="14" />
              <span>Animate</span>
            </button>

            <button
              type="button"
              class="action-icon-btn action-icon-btn--primary"
              title="Download full quality image"
              @click.stop="downloadImage(img)"
            >
              <Download :size="14" />
              <span>Save</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Fullscreen Lightbox Modal -->
    <div
      v-if="lightboxImage"
      class="lightbox-overlay"
      @click="closeLightbox"
    >
      <div class="lightbox-modal" @click.stop>
        <div class="lightbox-modal__header">
          <div class="lightbox-modal__meta">
            <span>{{ lightboxImage.width }} × {{ lightboxImage.height }} px</span>
            <span>Seed: {{ lightboxImage.seed }}</span>
          </div>

          <div class="lightbox-modal__actions">
            <button
              type="button"
              class="meta-btn meta-btn--accent"
              @click="downloadImage(lightboxImage)"
            >
              <Download :size="14" />
              <span>Download</span>
            </button>
            <button
              type="button"
              class="lightbox-modal__close"
              @click="closeLightbox"
            >
              <X :size="18" />
            </button>
          </div>
        </div>

        <div class="lightbox-modal__viewport" :class="{ 'image-card--checker': transparent }">
          <img :src="lightboxImage.url" class="lightbox-modal__img" />
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
  }

  &__eyebrow {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: $color-success;
    font-weight: $font-weight-semibold;
  }

  &__prompt-title {
    font-size: $font-size-base;
    font-weight: $font-weight-medium;
    color: $color-text-primary;
    line-height: 1.4;
  }

  &__top-actions {
    display: flex;
    align-items: center;
    gap: 8px;
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
    max-width: 800px;
    margin: 0 auto;
    width: 100%;
  }

  &--multi {
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  }
}

.image-card {
  background-color: $color-bg-canvas;
  border: 1px solid $color-border-default;
  border-radius: $radius-md;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  transition: transform $duration-normal $ease-out, border-color $duration-normal ease;

  &:hover {
    border-color: rgba(255, 255, 255, 0.22);
  }

  &--checker {
    .image-card__wrapper {
      background-image: linear-gradient(45deg, #18202b 25%, transparent 25%),
        linear-gradient(-45deg, #18202b 25%, transparent 25%),
        linear-gradient(45deg, transparent 75%, #18202b 75%),
        linear-gradient(-45deg, transparent 75%, #18202b 75%);
      background-size: 16px 16px;
      background-position: 0 0, 0 8px, 8px -8px, -8px 0px;
      background-color: #0f141c;
    }
  }

  &__wrapper {
    position: relative;
    width: 100%;
    cursor: zoom-in;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: #0b0f14;
    overflow: hidden;
  }

  &__img {
    width: 100%;
    height: auto;
    max-height: 580px;
    object-fit: contain;
    display: block;
  }

  &__overlay {
    position: absolute;
    inset: 0;
    background-color: rgba(0, 0, 0, 0.35);
    backdrop-filter: blur(2px);
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0;
    transition: opacity $duration-fast ease;

    &:hover {
      opacity: 1;
    }
  }

  &__zoom-hint {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    border-radius: $radius-full;
    background-color: rgba(0, 0, 0, 0.7);
    color: #ffffff;
    font-size: $font-size-xs;
    font-weight: $font-weight-medium;
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

  &__specs {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  &__actions {
    display: flex;
    align-items: center;
    gap: 6px;
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

// Lightbox Modal
.lightbox-overlay {
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.88);
  backdrop-filter: blur(10px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  z-index: 120;
}

.lightbox-modal {
  width: 100%;
  max-width: 1100px;
  max-height: 92vh;
  display: flex;
  flex-direction: column;
  background-color: $color-bg-surface;
  border: 1px solid $color-border-default;
  border-radius: $radius-lg;
  overflow: hidden;
  box-shadow: 0 25px 50px rgba(0, 0, 0, 0.6);
  transform-origin: center;
  animation: enter-modal $duration-fast $ease-out forwards;

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 18px;
    background-color: $color-bg-subtle;
    border-bottom: 1px solid $color-border-subtle;
  }

  &__meta {
    display: flex;
    align-items: center;
    gap: 14px;
    font-size: $font-size-xs;
    font-family: var(--font-mono);
    color: $color-text-secondary;
  }

  &__actions {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  &__close {
    padding: 6px;
    border-radius: $radius-sm;
    color: $color-text-muted;

    &:hover {
      color: $color-text-primary;
      background-color: $color-bg-card-hover;
    }
  }

  &__viewport {
    flex: 1;
    overflow: auto;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
    background-color: #080c10;
  }

  &__img {
    max-width: 100%;
    max-height: 80vh;
    object-fit: contain;
    border-radius: $radius-sm;
  }
}

@keyframes enter-modal {
  from {
    opacity: 0;
    transform: scale(0.96);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}
</style>
