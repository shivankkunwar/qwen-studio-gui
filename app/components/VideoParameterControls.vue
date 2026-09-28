<script setup lang="ts">
import { Sliders, Dices, ChevronDown, Volume2, VolumeX, Wand2, Timer } from '@lucide/vue'
import type { VideoAspectRatio, VideoQuality } from '~/types/api'
import type { VideoModelInfo } from '~/composables/useVideoApi'

const props = defineProps<{
  info: VideoModelInfo
  hasStartImage: boolean
  outputSize: [number, number] | null
  estimate: { warmSeconds: number; warmDollars: number; coldDollars: number }
}>()

const quality = defineModel<VideoQuality>('quality', { required: true })
const aspectRatio = defineModel<VideoAspectRatio>('aspectRatio', { required: true })
const followImageShape = defineModel<boolean>('followImageShape', { required: true })
const useCustomDimensions = defineModel<boolean>('useCustomDimensions', { required: true })
const customWidth = defineModel<number>('customWidth', { required: true })
const customHeight = defineModel<number>('customHeight', { required: true })
const duration = defineModel<number>('duration', { required: true })
const autoDuration = defineModel<boolean>('autoDuration', { required: true })
const minSeconds = defineModel<number>('minSeconds', { required: true })
const maxSeconds = defineModel<number>('maxSeconds', { required: true })
const frameRate = defineModel<number>('frameRate', { required: true })
const numVideos = defineModel<number>('numVideos', { required: true })
const seed = defineModel<number | null>('seed', { required: true })
const randomSeed = defineModel<boolean>('randomSeed', { required: true })
const enhancePrompt = defineModel<boolean>('enhancePrompt', { required: true })

const showAdvanced = ref(false)

const RATIO_ICONS: Record<VideoAspectRatio, { desc: string; w: number; h: number }> = {
  '16:9': { desc: 'Widescreen', w: 24, h: 13.5 },
  '9:16': { desc: 'Story/Reel', w: 13.5, h: 24 },
  '1:1': { desc: 'Square', w: 18, h: 18 },
  '4:3': { desc: 'Landscape', w: 20, h: 15 },
  '3:4': { desc: 'Portrait', w: 15, h: 20 }
}

const durations = computed(() => props.info.durations.filter((d) => d <= props.info.maxSeconds[quality.value]))
const sideStep = computed(() => (quality.value === 'hd' ? 64 : 32))
const snap = (val: number) => {
  const step = sideStep.value
  return Math.max(256, Math.min(props.info.maxSide, Math.round(val / step) * step))
}

const rollDice = () => {
  seed.value = Math.floor(Math.random() * 2147483647)
  randomSeed.value = false
}
const toggleRandomSeed = () => {
  randomSeed.value = !randomSeed.value
  if (!randomSeed.value && seed.value === null) rollDice()
}

const money = (d: number) => (d < 0.01 ? '<$0.01' : `$${d.toFixed(2)}`)
</script>

<template>
  <div class="params-panel">
    <!-- Shape -->
    <div class="param-group">
      <div class="param-group__label-row">
        <label class="param-group__label">Aspect Ratio</label>
        <button type="button" class="param-group__custom-toggle" @click="useCustomDimensions = !useCustomDimensions">
          {{ useCustomDimensions ? 'Use Presets' : 'Custom Dimensions' }}
        </button>
      </div>

      <div v-if="!useCustomDimensions" class="ratio-selector" :style="{ gridTemplateColumns: `repeat(${info.aspectRatios.length + (hasStartImage && info.features.imageToVideo ? 1 : 0)}, 1fr)` }">
        <button
          v-if="hasStartImage && info.features.imageToVideo"
          type="button"
          class="ratio-card"
          :class="{ 'ratio-card--active': followImageShape }"
          title="Closest preset to the start frame's shape"
          @click="followImageShape = true"
        >
          <div class="ratio-card__preview"><div class="ratio-card__box ratio-card__box--image" /></div>
          <span class="ratio-card__label">Auto</span>
          <span class="ratio-card__desc">From frame</span>
        </button>
        <button
          v-for="ar in info.aspectRatios"
          :key="ar"
          type="button"
          class="ratio-card"
          :class="{ 'ratio-card--active': aspectRatio === ar && !(hasStartImage && info.features.imageToVideo && followImageShape) }"
          @click="aspectRatio = ar; followImageShape = false"
        >
          <div class="ratio-card__preview">
            <div class="ratio-card__box" :style="{ width: `${RATIO_ICONS[ar].w}px`, height: `${RATIO_ICONS[ar].h}px` }" />
          </div>
          <span class="ratio-card__label">{{ ar }}</span>
          <span class="ratio-card__desc">{{ RATIO_ICONS[ar].desc }}</span>
        </button>
      </div>

      <div v-else class="custom-dims">
        <div class="dim-input-col">
          <label>Width (px)</label>
          <input type="number" :value="customWidth" :step="sideStep" min="256" :max="info.maxSide"
                 @change="customWidth = snap(parseInt(($event.target as HTMLInputElement).value, 10) || 256)" />
        </div>
        <span class="custom-dims__times">×</span>
        <div class="dim-input-col">
          <label>Height (px)</label>
          <input type="number" :value="customHeight" :step="sideStep" min="256" :max="info.maxSide"
                 @change="customHeight = snap(parseInt(($event.target as HTMLInputElement).value, 10) || 256)" />
        </div>
        <span class="custom-dims__hint">Multiple of {{ sideStep }} (256 – {{ info.maxSide }} px)</span>
      </div>

      <p class="param-group__note">
        Output:
        <span class="mono">{{ outputSize ? `${outputSize[0]}×${outputSize[1]}` : 'follows the start frame' }}</span>
        <span v-if="info.id === 'fastwan' && outputSize && (outputSize[0] !== 1280 && outputSize[1] !== 1280)">
          · trained at 1280×704, other sizes may lose quality
        </span>
      </p>
    </div>

    <!-- Quality & variations -->
    <div class="params-row">
      <div v-if="info.features.hd" class="param-group param-group--half">
        <label class="param-group__label">Quality</label>
        <div class="segmented-control">
          <button type="button" class="segmented-btn" :class="{ 'segmented-btn--active': quality === 'standard' }" @click="quality = 'standard'">
            <span class="segmented-btn__title">Standard</span>
            <span class="segmented-btn__sub">~0.5 MP · 1 pass</span>
          </button>
          <button type="button" class="segmented-btn" :class="{ 'segmented-btn--active': quality === 'hd' }" @click="quality = 'hd'">
            <span class="segmented-btn__title">HD 2×</span>
            <span class="segmented-btn__sub">Upscale pass · ~3× time</span>
          </button>
        </div>
      </div>

      <div class="param-group param-group--half">
        <label class="param-group__label">Clips (variations)</label>
        <div class="segmented-pills">
          <button v-for="n in [1, 2, 3, 4]" :key="n" type="button" class="pill-btn"
                  :class="{ 'pill-btn--active': numVideos === n }" @click="numVideos = n">
            {{ n }}
          </button>
        </div>
      </div>
    </div>

    <!-- Duration -->
    <div class="param-group">
      <div class="param-group__label-row">
        <label class="param-group__label">
          <Timer :size="14" />
          Duration: <span class="param-value-tag">{{ autoDuration ? `auto ${minSeconds}–${maxSeconds}s` : `${duration}s` }}</span>
        </label>
        <span class="param-group__hint">
          {{ info.features.audio ? 'Video + synced audio' : 'Video only, no audio' }}
          <Volume2 v-if="info.features.audio" :size="12" class="inline-icon" />
          <VolumeX v-else :size="12" class="inline-icon" />
        </span>
      </div>
      <div class="segmented-pills segmented-pills--wrap">
        <button
          v-if="info.features.autoDuration && quality !== 'hd'"
          type="button"
          class="pill-btn"
          :class="{ 'pill-btn--active': autoDuration }"
          title="The model's duration head picks a length that fits the prompt"
          @click="autoDuration = true"
        >
          Auto
        </button>
        <button v-for="d in durations" :key="d" type="button" class="pill-btn"
                :class="{ 'pill-btn--active': !autoDuration && duration === d }"
                @click="autoDuration = false; duration = d">
          {{ d }}s
        </button>
      </div>
      <div v-if="autoDuration" class="range-row animate-enter">
        <label>Between</label>
        <input type="number" class="param-input param-input--sm" min="1" max="19" step="1" :value="minSeconds"
               @change="minSeconds = Math.max(1, Math.min(maxSeconds - 1, parseFloat(($event.target as HTMLInputElement).value) || 1))" />
        <label>and</label>
        <input type="number" class="param-input param-input--sm" min="2" max="20" step="1" :value="maxSeconds"
               @change="maxSeconds = Math.min(20, Math.max(minSeconds + 1, parseFloat(($event.target as HTMLInputElement).value) || 10))" />
        <label>seconds</label>
      </div>
    </div>

    <!-- Prompt enhancement -->
    <div v-if="info.features.enhancePrompt" class="param-group">
      <label class="param-group__label">Prompt Enhancement</label>
      <button type="button" class="switch-btn" :class="{ 'switch-btn--on': enhancePrompt }" @click="enhancePrompt = !enhancePrompt">
        <span class="switch-btn__handle" />
        <Wand2 :size="13" />
        <span class="switch-btn__label">
          {{ enhancePrompt ? 'Gemma 4 rewrites your prompt into a detailed shot description (+~8s)' : 'Off · use my prompt as written' }}
        </span>
      </button>
    </div>

    <!-- Cost hint -->
    <div class="cost-hint">
      <span>~{{ estimate.warmSeconds }}s GPU on {{ info.gpu }}</span>
      <span class="cost-hint__sep">·</span>
      <span>{{ money(estimate.warmDollars) }} if warm</span>
      <span class="cost-hint__sep">·</span>
      <span>{{ money(estimate.coldDollars) }} with a cold start</span>
    </div>

    <!-- Advanced -->
    <div class="advanced-section">
      <button type="button" class="advanced-toggle-btn" @click="showAdvanced = !showAdvanced">
        <div class="advanced-toggle-btn__left">
          <Sliders :size="15" />
          <span>Advanced Generation Parameters</span>
        </div>
        <ChevronDown :size="16" class="advanced-toggle-btn__arrow" :class="{ 'advanced-toggle-btn__arrow--open': showAdvanced }" />
      </button>

      <div v-show="showAdvanced" class="advanced-body animate-enter">
        <div class="param-group">
          <div class="param-group__label-row">
            <label class="param-group__label">Seed</label>
            <div class="seed-toggles">
              <button type="button" class="seed-pill" :class="{ 'seed-pill--active': randomSeed }" @click="toggleRandomSeed">
                {{ randomSeed ? 'Random' : 'Fixed' }}
              </button>
              <button type="button" class="dice-btn" title="Roll new seed" @click="rollDice">
                <Dices :size="14" />
              </button>
            </div>
          </div>
          <input type="number" :value="seed ?? ''" placeholder="Random seed" :disabled="randomSeed" class="param-input"
                 @input="seed = parseInt(($event.target as HTMLInputElement).value, 10) || null" />
        </div>

        <div v-if="info.frameRates.length > 1" class="param-group">
          <label class="param-group__label">Frame Rate</label>
          <div class="segmented-pills">
            <button v-for="f in info.frameRates" :key="f" type="button" class="pill-btn"
                    :class="{ 'pill-btn--active': frameRate === f }" @click="frameRate = f">
              {{ f }} fps{{ f === 24 ? ' (trained)' : '' }}
            </button>
          </div>
        </div>

        <p class="param-group__note">
          {{ info.name }} is a distilled model: steps and guidance are fixed
          ({{ info.id === 'ltx' ? '8 sigmas, +3 in HD' : '3 DMD steps' }}), so there is no step or CFG slider.
        </p>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.params-panel {
  display: flex;
  flex-direction: column;
  gap: 18px;
  background-color: $color-bg-surface;
  border: 1px solid $color-border-subtle;
  border-radius: $radius-lg;
  padding: 18px 20px;
}

.param-group {
  display: flex;
  flex-direction: column;
  gap: 8px;

  &--half {
    flex: 1;
    min-width: 0;
  }

  &__label-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  &__label {
    font-size: $font-size-sm;
    font-weight: $font-weight-medium;
    color: $color-text-primary;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  &__custom-toggle {
    font-size: $font-size-xs;
    color: $color-accent;

    &:hover {
      text-decoration: underline;
    }
  }

  &__hint {
    font-size: $font-size-xs;
    color: $color-text-muted;
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }

  &__note {
    font-size: $font-size-xs;
    color: $color-text-muted;
    line-height: 1.5;
  }
}

.mono {
  font-family: var(--font-mono);
  color: $color-text-secondary;
}

.inline-icon {
  flex-shrink: 0;
}

.param-value-tag {
  font-family: var(--font-mono);
  font-size: $font-size-xs;
  font-weight: $font-weight-semibold;
  color: $color-accent;
  background-color: $color-accent-soft;
  padding: 1px 6px;
  border-radius: 4px;
}

.params-row {
  display: flex;
  gap: 16px;
  align-items: flex-start;

  @media (max-width: 520px) {
    flex-direction: column;
  }
}

.ratio-selector {
  display: grid;
  gap: 8px;

  @media (max-width: 520px) {
    grid-template-columns: repeat(3, 1fr) !important;
  }
}

.ratio-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 8px 6px;
  border-radius: $radius-md;
  background-color: $color-bg-subtle;
  border: 1px solid $color-border-subtle;
  transition: background-color $duration-fast ease, border-color $duration-fast ease;

  &:hover {
    background-color: $color-bg-card-hover;
    border-color: $color-border-default;
  }

  &--active {
    background-color: rgba(56, 189, 248, 0.08);
    border-color: $color-accent;

    .ratio-card__box {
      border-color: $color-accent;
      background-color: rgba(56, 189, 248, 0.2);
    }

    .ratio-card__label {
      color: $color-accent;
      font-weight: $font-weight-semibold;
    }
  }

  &__preview {
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  &__box {
    border: 1.5px solid $color-text-muted;
    border-radius: 2px;
    background-color: rgba(255, 255, 255, 0.05);

    &--image {
      width: 20px;
      height: 16px;
      border-style: dashed;
    }
  }

  &__label {
    font-size: $font-size-xs;
    font-weight: $font-weight-medium;
    color: $color-text-secondary;
    font-family: var(--font-mono);
  }

  &__desc {
    font-size: 10px;
    color: $color-text-dim;
  }
}

.custom-dims {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  background-color: $color-bg-subtle;
  padding: 12px 16px;
  border-radius: $radius-md;
  border: 1px solid $color-border-subtle;

  &__times {
    color: $color-text-dim;
    font-size: $font-size-lg;
    padding-top: 14px;
  }

  &__hint {
    font-size: $font-size-xs;
    color: $color-text-muted;
    margin-left: auto;
    font-family: var(--font-mono);
  }
}

.dim-input-col {
  display: flex;
  flex-direction: column;
  gap: 4px;

  label {
    font-size: 11px;
    color: $color-text-muted;
    font-weight: $font-weight-medium;
  }

  input {
    width: 100px;
    background-color: $color-bg-canvas;
    border: 1px solid $color-border-default;
    border-radius: $radius-sm;
    padding: 6px 10px;
    font-size: $font-size-sm;
    font-family: var(--font-mono);
  }
}

.segmented-control {
  display: flex;
  background-color: $color-bg-subtle;
  border: 1px solid $color-border-subtle;
  border-radius: $radius-md;
  padding: 3px;
  gap: 3px;
}

.segmented-btn {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 6px 10px;
  border-radius: $radius-sm;
  color: $color-text-secondary;

  &:hover {
    color: $color-text-primary;
  }

  &--active {
    background-color: $color-bg-surface;
    color: $color-text-primary;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);

    .segmented-btn__title {
      color: $color-accent;
    }
  }

  &__title {
    font-size: $font-size-xs;
    font-weight: $font-weight-semibold;
  }

  &__sub {
    font-size: 10px;
    color: $color-text-muted;
  }
}

.segmented-pills {
  display: flex;
  background-color: $color-bg-subtle;
  border: 1px solid $color-border-subtle;
  border-radius: $radius-md;
  padding: 3px;
  gap: 2px;

  &--wrap {
    flex-wrap: wrap;
  }
}

.pill-btn {
  flex: 1;
  padding: 6px 10px;
  border-radius: $radius-sm;
  font-size: $font-size-xs;
  font-weight: $font-weight-medium;
  color: $color-text-secondary;
  text-align: center;
  white-space: nowrap;

  &:hover {
    color: $color-text-primary;
  }

  &--active {
    background-color: $color-bg-surface;
    color: $color-accent;
    font-weight: $font-weight-semibold;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
  }
}

.range-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: $font-size-xs;
  color: $color-text-muted;
}

.param-input {
  width: 100%;
  background-color: $color-bg-canvas;
  border: 1px solid $color-border-default;
  border-radius: $radius-sm;
  padding: 8px 12px;
  font-size: $font-size-sm;
  font-family: var(--font-mono);

  &:disabled {
    opacity: 0.5;
  }

  &--sm {
    width: 64px;
    padding: 5px 8px;
  }
}

.switch-btn {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-radius: $radius-sm;
  background-color: $color-bg-subtle;
  border: 1px solid $color-border-subtle;
  color: $color-text-muted;
  text-align: left;

  &__handle {
    width: 14px;
    height: 14px;
    flex-shrink: 0;
    border-radius: 50%;
    background-color: $color-text-dim;
    transition: background-color $duration-fast ease, box-shadow $duration-fast ease;
  }

  &__label {
    font-size: $font-size-xs;
    font-weight: $font-weight-medium;
    color: $color-text-secondary;
  }

  &--on {
    border-color: rgba(52, 211, 153, 0.3);
    color: $color-success;

    .switch-btn__handle {
      background-color: $color-success;
      box-shadow: 0 0 8px rgba(52, 211, 153, 0.5);
    }

    .switch-btn__label {
      color: $color-text-primary;
    }
  }
}

.cost-hint {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border-radius: $radius-md;
  background-color: $color-bg-subtle;
  border: 1px solid $color-border-subtle;
  font-size: $font-size-xs;
  font-family: var(--font-mono);
  color: $color-text-muted;

  &__sep {
    color: $color-text-dim;
  }
}

.advanced-section {
  border-top: 1px solid $color-border-subtle;
  padding-top: 12px;
}

.advanced-toggle-btn {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px;
  border-radius: $radius-sm;
  color: $color-text-secondary;
  font-size: $font-size-sm;
  font-weight: $font-weight-medium;

  &:hover {
    background-color: $color-bg-subtle;
    color: $color-text-primary;
  }

  &__left {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  &__arrow {
    transition: transform $duration-fast ease;

    &--open {
      transform: rotate(180deg);
    }
  }
}

.advanced-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-top: 14px;
  padding-top: 6px;
}

.seed-toggles {
  display: flex;
  align-items: center;
  gap: 6px;
}

.seed-pill {
  padding: 2px 8px;
  border-radius: $radius-sm;
  font-size: 11px;
  font-weight: $font-weight-medium;
  background-color: $color-bg-subtle;
  color: $color-text-muted;

  &--active {
    background-color: $color-accent-soft;
    color: $color-accent;
  }
}

.dice-btn {
  padding: 4px 6px;
  border-radius: $radius-sm;
  color: $color-text-secondary;

  &:hover {
    background-color: $color-bg-subtle;
    color: $color-text-primary;
  }
}
</style>
