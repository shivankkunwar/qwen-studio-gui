<script setup lang="ts">
import { Film, Lightbulb, Volume2, VolumeX, Zap, Crown } from '@lucide/vue'
import type { VideoHistoryItem, VideoModelId } from '~/types/api'
import { VIDEO_MODELS } from '~/composables/useVideoApi'

useHead({ title: 'Video Studio' })

const video = useVideoApi()

const showSettings = ref(false)
const showHistory = ref(false)

const MODEL_CARDS: Record<VideoModelId, { icon: any; score: string; license: string; bullets: string[] }> = {
  ltx: {
    icon: Crown,
    score: 'Arena Elo 1055 (with audio)',
    license: 'Free under $10M revenue',
    bullets: ['Synced audio', 'Image-to-video', 'HD 2× upscale', 'Up to 20 s', 'Auto length', 'Prompt enhancer']
  },
  fastwan: {
    icon: Zap,
    score: 'Below LTX-2 on the arena',
    license: 'Apache 2.0',
    bullets: ['3-step distilled', '1280×704 native', 'Up to 5 s', 'Text-to-video only']
  }
}

const startImages = computed(() => (video.startImage.value ? [video.startImage.value] : []))

const onSelectHistoryItem = (item: VideoHistoryItem) => {
  video.reuseSettings(item)
  video.currentResult.value = item.response
  video.currentRequest.value = item.request
  showHistory.value = false
}

const onReuseCurrent = () => {
  if (video.currentRequest.value) {
    const id = video.currentResult.value?.videos?.[0]?.url.split('/')[3] as VideoModelId | undefined
    video.reuseSettings({ request: video.currentRequest.value, model: id && id in VIDEO_MODELS ? id : video.model.value })
  }
}

const onUseFrame = async (url: string, which: 'first' | 'last') => {
  try {
    await video.useFrameAsStart(url, which)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  } catch (err) {
    console.error(err)
  }
}

const resultModelName = computed(() => {
  const id = video.currentResult.value?.videos?.[0]?.url.split('/')[3] as VideoModelId | undefined
  return id && id in VIDEO_MODELS ? VIDEO_MODELS[id].name : video.info.value.name
})

const samplePrompts = [
  'A slow dolly shot through a rain-soaked night market in Bengaluru, neon signs reflecting in puddles, steam rising from food stalls, the murmur of the crowd and sizzling pans',
  'Close-up of a barista pouring latte art in slow motion, warm morning light through the window, soft café chatter and the hiss of the steam wand',
  'An aerial drone shot gliding over misty green tea hills at sunrise, rows of bushes curving along the slopes, birdsong and a light breeze',
  'A golden retriever puppy chasing soap bubbles in a sunny backyard, camera at puppy height, playful barks and bubbles popping'
]

const promptPlaceholder = computed(() =>
  video.startImage.value && video.info.value.features.imageToVideo
    ? 'Describe what happens next in the start frame: the motion, the camera and the sound…'
    : 'Describe the shot in one paragraph: subject, motion, camera, lighting and sound…'
)
</script>

<template>
  <div class="app-layout">
    <HeaderNav
      title="Video Studio"
      :badge="video.info.value.badge"
      :is-healthy="video.health.value[video.model.value]"
      :history-count="video.history.value.length"
      @open-settings="showSettings = true"
      @open-history="showHistory = true"
      @refresh-health="video.checkHealth()"
    />

    <main class="app-main">
      <div class="workspace-grid">
        <section class="controls-column">
          <!-- Model picker -->
          <div class="model-picker">
            <button
              v-for="m in Object.values(VIDEO_MODELS)"
              :key="m.id"
              type="button"
              class="model-card"
              :class="{ 'model-card--active': video.model.value === m.id }"
              :disabled="video.isGenerating.value"
              @click="video.model.value = m.id"
            >
              <div class="model-card__top">
                <component :is="MODEL_CARDS[m.id].icon" :size="15" class="model-card__icon" />
                <span class="model-card__name">{{ m.name }}</span>
                <span class="model-card__status" :class="{
                  'model-card__status--ok': video.health.value[m.id] === true,
                  'model-card__status--bad': video.health.value[m.id] === false
                }" />
              </div>
              <span class="model-card__meta">{{ m.badge }}</span>
              <span class="model-card__meta">{{ MODEL_CARDS[m.id].score }}</span>
              <span class="model-card__meta">
                <Volume2 v-if="m.features.audio" :size="11" />
                <VolumeX v-else :size="11" />
                ~{{ m.clipSeconds }}s / 5 s clip · {{ MODEL_CARDS[m.id].license }}
              </span>
              <div class="model-card__chips">
                <span v-for="b in MODEL_CARDS[m.id].bullets" :key="b" class="model-card__chip">{{ b }}</span>
              </div>
            </button>
          </div>

          <PromptBar
            v-model="video.prompt.value"
            :is-generating="video.isGenerating.value"
            :elapsed-seconds="video.elapsedSeconds.value"
            :has-images="!!video.startImage.value"
            :placeholder="promptPlaceholder"
            @generate="video.generate"
            @cancel="video.cancelGeneration"
          />

          <ReferenceImages
            v-if="video.info.value.features.imageToVideo"
            :images="startImages"
            :max-images="1"
            :allow-markup="false"
            title="Start Frame"
            subtitle="Optional · the video begins from this image (image-to-video)"
            badge="Frame 1"
            @add="video.startImage.value = $event"
            @remove="video.startImage.value = null"
            @clear="video.startImage.value = null"
          />
          <p v-if="video.frameError.value" class="i2v-note i2v-note--error">{{ video.frameError.value }}</p>
          <p v-else-if="!video.info.value.features.imageToVideo" class="i2v-note">
            FastWan runs text-to-video only here: its 3-step pipeline ignores a start frame.
            Switch to LTX-2.5 to animate an image.
          </p>

          <VideoParameterControls
            v-model:quality="video.quality.value"
            v-model:aspect-ratio="video.aspectRatio.value"
            v-model:follow-image-shape="video.followImageShape.value"
            v-model:use-custom-dimensions="video.useCustomDimensions.value"
            v-model:custom-width="video.customWidth.value"
            v-model:custom-height="video.customHeight.value"
            v-model:duration="video.duration.value"
            v-model:auto-duration="video.autoDuration.value"
            v-model:min-seconds="video.minSeconds.value"
            v-model:max-seconds="video.maxSeconds.value"
            v-model:frame-rate="video.frameRate.value"
            v-model:num-videos="video.numVideos.value"
            v-model:seed="video.seed.value"
            v-model:random-seed="video.randomSeed.value"
            v-model:enhance-prompt="video.enhancePrompt.value"
            :info="video.info.value"
            :has-start-image="!!video.startImage.value"
            :output-size="video.outputSize.value"
            :estimate="video.estimate.value"
          />
        </section>

        <section class="results-column">
          <GenerationProgress
            :status="video.jobStatus.value"
            :progress="null"
            :elapsed-seconds="video.elapsedSeconds.value"
            :error-message="video.errorMessage.value"
            :title-override="video.progressTitle.value"
            :detail-override="video.progressDetail.value"
            :percent-override="video.percent.value"
            @cancel="video.cancelGeneration"
          />

          <VideoResultViewer
            v-if="video.currentResult.value && video.currentResult.value.videos?.length"
            :result="video.currentResult.value"
            :model-name="resultModelName"
            :can-use-frames="true"
            @reuse-settings="onReuseCurrent"
            @use-frame="onUseFrame"
          />

          <div v-else-if="video.jobStatus.value === 'idle'" class="empty-state">
            <div class="empty-state__icon-wrap">
              <Film :size="28" class="empty-state__icon" />
            </div>
            <h2 class="empty-state__title">Video Studio Ready</h2>
            <p class="empty-state__desc">
              Write a prompt, or add a start frame, to generate a clip with {{ video.info.value.name }}.
              Batch your ideas: the first clip pays for the cold start, the next ones reuse the warm GPU.
            </p>

            <div class="empty-state__suggestions">
              <span class="empty-state__suggestions-label">
                <Lightbulb :size="13" />
                <span>Try an example prompt:</span>
              </span>
              <div class="empty-state__pills">
                <button v-for="(p, i) in samplePrompts" :key="i" type="button" class="sample-pill" @click="video.prompt.value = p">
                  {{ p }}
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>

    <HistoryDrawer
      :show="showHistory"
      :history="video.history.value"
      kind="video"
      @close="showHistory = false"
      @select="onSelectHistoryItem"
      @clear="video.history.value = []; video.saveHistory()"
    />

    <SettingsModal
      :show="showSettings"
      :endpoint-mode="video.endpointMode.value"
      :custom-endpoint="video.customEndpoint.value"
      :modal-key="video.modalKey.value"
      :modal-secret="video.modalSecret.value"
      :health-url="`/api/video/${video.model.value}/health`"
      @close="showSettings = false"
      @update:endpoint-mode="video.endpointMode.value = $event"
      @update:custom-endpoint="video.customEndpoint.value = $event"
      @update:modal-key="video.modalKey.value = $event"
      @update:modal-secret="video.modalSecret.value = $event"
      @save="video.saveSettings"
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

  @media (max-width: 600px) {
    padding: 16px;
  }
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

.controls-column,
.results-column {
  display: flex;
  flex-direction: column;
  gap: 18px;
  min-width: 0;
}

.model-picker {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;

  @media (max-width: 520px) {
    grid-template-columns: 1fr;
  }
}

.model-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  padding: 12px 14px;
  border-radius: $radius-lg;
  background-color: $color-bg-surface;
  border: 1px solid $color-border-subtle;
  text-align: left;
  transition: border-color $duration-fast ease, background-color $duration-fast ease;

  &:hover:not(:disabled) {
    border-color: $color-border-default;
    background-color: $color-bg-card-hover;
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.7;
  }

  &--active {
    border-color: $color-accent;
    background-color: rgba(56, 189, 248, 0.06);

    .model-card__name,
    .model-card__icon {
      color: $color-accent;
    }
  }

  &__top {
    display: flex;
    align-items: center;
    gap: 7px;
    width: 100%;
    margin-bottom: 2px;
  }

  &__icon {
    color: $color-text-secondary;
  }

  &__name {
    font-size: $font-size-sm;
    font-weight: $font-weight-semibold;
    color: $color-text-primary;
  }

  &__status {
    margin-left: auto;
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background-color: $color-warning;

    &--ok {
      background-color: $color-success;
      box-shadow: 0 0 8px rgba(52, 211, 153, 0.4);
    }

    &--bad {
      background-color: $color-danger;
    }
  }

  &__meta {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    color: $color-text-muted;
    font-family: var(--font-mono);
  }

  &__chips {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-top: 6px;
  }

  &__chip {
    padding: 1px 7px;
    border-radius: $radius-full;
    background-color: $color-bg-subtle;
    border: 1px solid $color-border-subtle;
    color: $color-text-secondary;
    font-size: 10px;
  }
}

.i2v-note {
  padding: 10px 14px;
  border-radius: $radius-md;
  background-color: $color-bg-surface;
  border: 1px dashed $color-border-default;
  color: $color-text-muted;
  font-size: $font-size-xs;
  line-height: 1.5;

  &--error {
    border-color: rgba(248, 113, 113, 0.4);
    color: $color-danger;
  }
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
    max-width: 440px;
    line-height: 1.5;
    margin-bottom: 28px;
  }

  &__suggestions {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    max-width: 560px;

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
  transition: background-color $duration-fast ease, border-color $duration-fast ease, color $duration-fast ease;

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
