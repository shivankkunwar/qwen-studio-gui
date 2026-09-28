<script setup lang="ts">
import { Sparkles, ImageIcon, Compass, Lightbulb } from '@lucide/vue'
import type { GenerationHistoryItem } from '~/types/api'

// Composable containing all state & actions
const qwen = useQwenApi()

// UI state
const showSettings = ref(false)
const showHistory = ref(false)
const annotatingIndex = ref<number | null>(null)

const annotatingImageSrc = computed(() => {
  if (annotatingIndex.value !== null && qwen.images.value[annotatingIndex.value]) {
    return qwen.images.value[annotatingIndex.value]
  }
  return ''
})

const onAnnotate = (index: number) => {
  annotatingIndex.value = index
}

const onSaveAnnotation = (newImageDataUrl: string) => {
  if (annotatingIndex.value !== null) {
    qwen.updateReferenceImage(annotatingIndex.value, newImageDataUrl)
    annotatingIndex.value = null
  }
}

const onSelectHistoryItem = (item: GenerationHistoryItem) => {
  qwen.reuseSettings(item)
  qwen.currentResult.value = item.response
  showHistory.value = false
}

// Sample inspiration prompts
const samplePrompts = [
  'A glowing neon shop sign that reads "OPEN LATE" in a rainy Tokyo alley at night, cinematic 35mm photo',
  'A red kite over a misty lake at sunrise, reflection in calm water, soft morning light',
  'Cozy wooden cabin surrounded by vibrant autumn trees and fallen leaves, morning fog',
  'Minimalist clay render of a futuristic ceramic vase with clean geometric lines, studio lighting'
]

const useSamplePrompt = (text: string) => {
  qwen.prompt.value = text
}

// "Animate": open the video studio with this image as the LTX-2.5 start frame.
const pendingStartImage = useState<string | null>('video-pending-start-image', () => null)
const onAnimate = (imageUrl: string) => {
  pendingStartImage.value = imageUrl
  navigateTo('/video')
}
</script>

<template>
  <div class="app-layout">
    <!-- Header Navigation -->
    <HeaderNav
      :is-healthy="qwen.isHealthy.value"
      :history-count="qwen.history.value.length"
      @open-settings="showSettings = true"
      @open-history="showHistory = true"
      @refresh-health="qwen.checkHealth"
    />

    <!-- Main Workspace -->
    <main class="app-main">
      <div class="workspace-grid">
        <!-- Left Column: Controls & Prompt Input -->
        <section class="controls-column">
          <!-- Prompt Box -->
          <PromptBar
            v-model="qwen.prompt.value"
            :is-generating="qwen.isGenerating.value"
            :elapsed-seconds="qwen.elapsedSeconds.value"
            :has-images="qwen.images.value.length > 0"
            @generate="qwen.generate"
            @cancel="qwen.cancelGeneration"
          />

          <!-- Reference Images -->
          <ReferenceImages
            :images="qwen.images.value"
            @add="qwen.addReferenceImage"
            @remove="qwen.removeReferenceImage"
            @move="qwen.moveReferenceImage"
            @annotate="onAnnotate"
            @clear="qwen.clearReferenceImages"
          />

          <!-- Parameters Panel -->
          <ParameterControls
            v-model:size="qwen.size.value"
            v-model:aspect-ratio="qwen.aspectRatio.value"
            v-model:use-custom-dimensions="qwen.useCustomDimensions.value"
            v-model:custom-width="qwen.customWidth.value"
            v-model:custom-height="qwen.customHeight.value"
            v-model:num-images="qwen.numImages.value"
            v-model:steps="qwen.steps.value"
            v-model:seed="qwen.seed.value"
            v-model:random-seed="qwen.randomSeed.value"
            v-model:transparent="qwen.transparent.value"
            v-model:negative-prompt="qwen.negativePrompt.value"
            v-model:guidance-scale="qwen.guidanceScale.value"
            v-model:output-format="qwen.outputFormat.value"
            v-model:quality="qwen.quality.value"
            v-model:use-kv-cache="qwen.useKvCache.value"
            v-model:execution-mode="qwen.executionMode.value"
            :has-references="qwen.images.value.length > 0"
          />
        </section>

        <!-- Right Column: Generation Monitor & Results -->
        <section class="results-column">
          <!-- Real-time Progress Card -->
          <GenerationProgress
            :status="qwen.jobStatus.value"
            :progress="qwen.progress.value"
            :elapsed-seconds="qwen.elapsedSeconds.value"
            :error-message="qwen.errorMessage.value"
            @cancel="qwen.cancelGeneration"
          />

          <!-- Active / Finished Result Viewer -->
          <ResultViewer
            v-if="qwen.currentResult.value && qwen.currentResult.value.images?.length"
            :result="qwen.currentResult.value"
            :transparent="qwen.transparent.value"
            @reuse-settings="qwen.reuseSettings(qwen.currentResult.value!)"
            @use-as-reference="qwen.useAsReference"
            @animate="onAnimate"
          />

          <!-- Empty Canvas Placeholder -->
          <div
            v-else-if="qwen.jobStatus.value === 'idle'"
            class="empty-state"
          >
            <div class="empty-state__icon-wrap">
              <Sparkles :size="28" class="empty-state__icon" />
            </div>
            <h2 class="empty-state__title">Studio Ready</h2>
            <p class="empty-state__desc">
              Enter a prompt or upload reference images to generate with Alibaba's Qwen-Image-2.1.
            </p>

            <div class="empty-state__suggestions">
              <span class="empty-state__suggestions-label">
                <Lightbulb :size="13" />
                <span>Try an example prompt:</span>
              </span>
              <div class="empty-state__pills">
                <button
                  v-for="(p, i) in samplePrompts"
                  :key="i"
                  type="button"
                  class="sample-pill"
                  @click="useSamplePrompt(p)"
                >
                  {{ p }}
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>

    <!-- Modals & Drawers -->
    <ImageAnnotatorModal
      :show="annotatingIndex !== null"
      :image-src="annotatingImageSrc"
      :image-index="annotatingIndex ?? 0"
      @close="annotatingIndex = null"
      @save="onSaveAnnotation"
    />

    <HistoryDrawer
      :show="showHistory"
      :history="qwen.history.value"
      @close="showHistory = false"
      @select="onSelectHistoryItem"
      @clear="qwen.history.value = []; qwen.saveSettings()"
    />

    <SettingsModal
      :show="showSettings"
      :endpoint-mode="qwen.endpointMode.value"
      :custom-endpoint="qwen.customEndpoint.value"
      :modal-key="qwen.modalKey.value"
      :modal-secret="qwen.modalSecret.value"
      @close="showSettings = false"
      @update:endpoint-mode="qwen.endpointMode.value = $event"
      @update:custom-endpoint="qwen.customEndpoint.value = $event"
      @update:modal-key="qwen.modalKey.value = $event"
      @update:modal-secret="qwen.modalSecret.value = $event"
      @save="qwen.saveSettings"
    />
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
  padding: 24px;
  max-width: 1440px;
  margin: 0 auto;
  width: 100%;
}

.workspace-grid {
  display: grid;
  grid-template-columns: 480px minmax(0, 1fr);
  gap: 24px;
  align-items: flex-start;

  @media (max-width: 1080px) {
    grid-template-columns: 1fr;
  }
}

.controls-column {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.results-column {
  display: flex;
  flex-direction: column;
  gap: 18px;
  min-width: 0;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 64px 32px;
  background-color: $color-bg-surface;
  border: 1px dashed $color-border-default;
  border-radius: $radius-lg;
  min-height: 480px;

  &__icon-wrap {
    width: 56px;
    height: 56px;
    border-radius: $radius-lg;
    background: linear-gradient(135deg, rgba(56, 189, 248, 0.15), rgba(52, 211, 153, 0.15));
    border: 1px solid rgba(56, 189, 248, 0.3);
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 16px;
  }

  &__icon {
    color: $color-accent;
  }

  &__title {
    font-size: $font-size-xl;
    font-weight: $font-weight-semibold;
    color: $color-text-primary;
    margin-bottom: 8px;
  }

  &__desc {
    font-size: $font-size-sm;
    color: $color-text-muted;
    max-width: 420px;
    line-height: 1.5;
    margin-bottom: 28px;
  }

  &__suggestions {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    max-width: 540px;

    &-label {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: $font-size-xs;
      font-weight: $font-weight-medium;
      color: $color-text-muted;
    }
  }

  &__pills {
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: 100%;
  }
}

.sample-pill {
  padding: 8px 14px;
  border-radius: $radius-md;
  background-color: $color-bg-subtle;
  border: 1px solid $color-border-subtle;
  color: $color-text-secondary;
  font-size: $font-size-xs;
  line-height: 1.4;
  text-align: left;
  transition: all $duration-fast ease;

  &:hover {
    background-color: $color-bg-card-hover;
    border-color: $color-border-default;
    color: $color-text-primary;
  }

  &:active {
    transform: scale(0.99);
  }
}
</style>
