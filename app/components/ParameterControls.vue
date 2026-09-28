<script setup lang="ts">
import {
  Sliders,
  Dices,
  Maximize2,
  ChevronDown,
  Info,
  Layers,
  Sparkles,
  Zap,
  Image as ImageIcon
} from '@lucide/vue'
import type { AspectRatio, SizeTier, OutputFormat } from '~/types/api'

const props = defineProps<{
  size: SizeTier
  aspectRatio: AspectRatio | null
  useCustomDimensions: boolean
  customWidth: number
  customHeight: number
  numImages: number
  steps: number
  seed: number | null
  randomSeed: boolean
  transparent: boolean
  negativePrompt: string
  guidanceScale: number
  outputFormat: OutputFormat
  quality: number
  useKvCache: boolean
  executionMode: 'job' | 'sync'
  hasReferences: boolean
}>()

const emit = defineEmits<{
  (e: 'update:size', val: SizeTier): void
  (e: 'update:aspectRatio', val: AspectRatio | null): void
  (e: 'update:useCustomDimensions', val: boolean): void
  (e: 'update:customWidth', val: number): void
  (e: 'update:customHeight', val: number): void
  (e: 'update:numImages', val: number): void
  (e: 'update:steps', val: number): void
  (e: 'update:seed', val: number | null): void
  (e: 'update:randomSeed', val: boolean): void
  (e: 'update:transparent', val: boolean): void
  (e: 'update:negativePrompt', val: string): void
  (e: 'update:guidanceScale', val: number): void
  (e: 'update:outputFormat', val: OutputFormat): void
  (e: 'update:quality', val: number): void
  (e: 'update:useKvCache', val: boolean): void
  (e: 'update:executionMode', val: 'job' | 'sync'): void
}>()

const showAdvanced = ref(false)

const aspectRatios: { id: AspectRatio; label: string; desc: string; w: number; h: number }[] = [
  { id: '1:1', label: '1:1', desc: 'Square', w: 18, h: 18 },
  { id: '4:3', label: '4:3', desc: 'Landscape', w: 20, h: 15 },
  { id: '3:4', label: '3:4', desc: 'Portrait', w: 15, h: 20 },
  { id: '3:2', label: '3:2', desc: 'Photo 3:2', w: 21, h: 14 },
  { id: '2:3', label: '2:3', desc: 'Photo 2:3', w: 14, h: 21 },
  { id: '16:9', label: '16:9', desc: 'Widescreen', w: 24, h: 13.5 },
  { id: '9:16', label: '9:16', desc: 'Story/Reel', w: 13.5, h: 24 }
]

const rollDice = () => {
  const newSeed = Math.floor(Math.random() * 2147483647)
  emit('update:seed', newSeed)
  emit('update:randomSeed', false)
}

const toggleRandomSeed = () => {
  const next = !props.randomSeed
  emit('update:randomSeed', next)
  if (!next && props.seed === null) {
    rollDice()
  }
}

const snapToMultiple32 = (val: number) => {
  return Math.max(256, Math.min(2752, Math.round(val / 32) * 32))
}

const onWidthChange = (e: Event) => {
  const val = parseInt((e.target as HTMLInputElement).value, 10)
  if (!isNaN(val)) emit('update:customWidth', snapToMultiple32(val))
}

const onHeightChange = (e: Event) => {
  const val = parseInt((e.target as HTMLInputElement).value, 10)
  if (!isNaN(val)) emit('update:customHeight', snapToMultiple32(val))
}

const onTransparencyToggle = () => {
  const next = !props.transparent
  emit('update:transparent', next)
  if (next && props.outputFormat === 'jpeg') {
    emit('update:outputFormat', 'png')
  }
}
</script>

<template>
  <div class="params-panel">
    <!-- Aspect Ratio Picker -->
    <div class="param-group">
      <div class="param-group__label-row">
        <label class="param-group__label">Aspect Ratio</label>
        <button
          type="button"
          class="param-group__custom-toggle"
          @click="emit('update:useCustomDimensions', !useCustomDimensions)"
        >
          {{ useCustomDimensions ? 'Use Presets' : 'Custom Dimensions' }}
        </button>
      </div>

      <div v-if="!useCustomDimensions" class="ratio-selector">
        <button
          v-for="ar in aspectRatios"
          :key="ar.id"
          type="button"
          class="ratio-card"
          :class="{ 'ratio-card--active': aspectRatio === ar.id }"
          @click="emit('update:aspectRatio', ar.id)"
        >
          <div class="ratio-card__preview">
            <div
              class="ratio-card__box"
              :style="{ width: `${ar.w}px`, height: `${ar.h}px` }"
            />
          </div>
          <span class="ratio-card__label">{{ ar.label }}</span>
          <span class="ratio-card__desc">{{ ar.desc }}</span>
        </button>
      </div>

      <!-- Custom Dimensions -->
      <div v-else class="custom-dims">
        <div class="dim-input-col">
          <label>Width (px)</label>
          <input
            type="number"
            :value="customWidth"
            step="32"
            min="256"
            max="2752"
            @change="onWidthChange"
          />
        </div>
        <span class="custom-dims__times">×</span>
        <div class="dim-input-col">
          <label>Height (px)</label>
          <input
            type="number"
            :value="customHeight"
            step="32"
            min="256"
            max="2752"
            @change="onHeightChange"
          />
        </div>
        <span class="custom-dims__hint">Multiple of 32 (256 – 2752 px)</span>
      </div>

      <p v-if="hasReferences && !useCustomDimensions" class="param-group__note">
        💡 Note: If no shape is chosen with reference images, output adapts to Image 1's shape.
      </p>
    </div>

    <!-- Tier & Image Count Row -->
    <div class="params-row">
      <!-- Resolution Tier -->
      <div class="param-group param-group--half">
        <label class="param-group__label">Resolution Tier</label>
        <div class="segmented-control">
          <button
            type="button"
            class="segmented-btn"
            :class="{ 'segmented-btn--active': size === '1k' }"
            @click="emit('update:size', '1k')"
          >
            <span class="segmented-btn__title">1K Tier</span>
            <span class="segmented-btn__sub">~1 MP · Fast (~20s)</span>
          </button>
          <button
            type="button"
            class="segmented-btn"
            :class="{ 'segmented-btn--active': size === '2k' }"
            @click="emit('update:size', '2k')"
          >
            <span class="segmented-btn__title">2K Native</span>
            <span class="segmented-btn__sub">Native HD (~80s)</span>
          </button>
        </div>
      </div>

      <!-- Number of Variations -->
      <div class="param-group param-group--half">
        <label class="param-group__label">Variations</label>
        <div class="segmented-pills">
          <button
            v-for="n in [1, 2, 3, 4]"
            :key="n"
            type="button"
            class="pill-btn"
            :class="{ 'pill-btn--active': numImages === n }"
            @click="emit('update:numImages', n)"
          >
            {{ n }} {{ n === 1 ? 'Image' : 'Images' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Denoising Steps Slider -->
    <div class="param-group">
      <div class="param-group__label-row">
        <label class="param-group__label">
          Denoising Steps: <span class="param-value-tag">{{ steps }}</span>
        </label>
        <span class="param-group__hint">Recommended: 40</span>
      </div>
      <input
        type="range"
        min="1"
        max="100"
        :value="steps"
        class="custom-slider"
        @input="emit('update:steps', parseInt(($event.target as HTMLInputElement).value, 10))"
      />
    </div>

    <!-- Guidance Scale (CFG) Slider -->
    <div class="param-group">
      <div class="param-group__label-row">
        <label class="param-group__label">
          Guidance Scale (CFG): <span class="param-value-tag">{{ guidanceScale.toFixed(1) }}</span>
        </label>
        <span class="param-group__hint" :class="{ 'text-warn': guidanceScale > 1 }">
          {{ guidanceScale === 1.0 ? '1.0 (Recommended · Fast)' : 'Doubles compute time & enables negative prompt' }}
        </span>
      </div>
      <input
        type="range"
        min="1.0"
        max="10.0"
        step="0.5"
        :value="guidanceScale"
        class="custom-slider"
        @input="emit('update:guidanceScale', parseFloat(($event.target as HTMLInputElement).value))"
      />

      <!-- Expandable Negative Prompt (active when guidanceScale > 1) -->
      <div v-if="guidanceScale > 1.0" class="negative-prompt-box animate-enter">
        <label class="param-group__label">Negative Prompt (what to avoid)</label>
        <textarea
          :value="negativePrompt"
          rows="2"
          placeholder="e.g. blurry, low quality, artifacts, distorted hands..."
          class="negative-textarea"
          @input="emit('update:negativePrompt', ($event.target as HTMLTextAreaElement).value)"
        />
      </div>
    </div>

    <!-- Advanced Accordion Toggle -->
    <div class="advanced-section">
      <button
        type="button"
        class="advanced-toggle-btn"
        @click="showAdvanced = !showAdvanced"
      >
        <div class="advanced-toggle-btn__left">
          <Sliders :size="15" />
          <span>Advanced Generation Parameters</span>
        </div>
        <ChevronDown
          :size="16"
          class="advanced-toggle-btn__arrow"
          :class="{ 'advanced-toggle-btn__arrow--open': showAdvanced }"
        />
      </button>

      <div v-show="showAdvanced" class="advanced-body animate-enter">
        <!-- Seed Control -->
        <div class="param-group">
          <div class="param-group__label-row">
            <label class="param-group__label">Seed</label>
            <div class="seed-toggles">
              <button
                type="button"
                class="seed-pill"
                :class="{ 'seed-pill--active': randomSeed }"
                @click="toggleRandomSeed"
              >
                {{ randomSeed ? 'Random' : 'Fixed' }}
              </button>
              <button
                type="button"
                class="dice-btn"
                title="Roll new seed"
                @click="rollDice"
              >
                <Dices :size="14" />
              </button>
            </div>
          </div>
          <input
            type="number"
            :value="seed ?? ''"
            placeholder="Random seed"
            :disabled="randomSeed"
            class="param-input"
            @input="emit('update:seed', parseInt(($event.target as HTMLInputElement).value, 10) || null)"
          />
        </div>

        <!-- Format & Transparency -->
        <div class="params-row">
          <div class="param-group param-group--half">
            <label class="param-group__label">Output Format</label>
            <div class="segmented-pills">
              <button
                v-for="fmt in (['png', 'webp', 'jpeg'] as OutputFormat[])"
                :key="fmt"
                type="button"
                class="pill-btn"
                :class="{ 'pill-btn--active': outputFormat === fmt }"
                @click="emit('update:outputFormat', fmt)"
              >
                {{ fmt.toUpperCase() }}
              </button>
            </div>
          </div>

          <div class="param-group param-group--half">
            <label class="param-group__label">Transparent Background</label>
            <button
              type="button"
              class="switch-btn"
              :class="{ 'switch-btn--on': transparent }"
              @click="onTransparencyToggle"
            >
              <span class="switch-btn__handle" />
              <span class="switch-btn__label">{{ transparent ? 'Enabled (RGBA)' : 'Disabled' }}</span>
            </button>
          </div>
        </div>

        <!-- Quality slider for WebP/JPEG -->
        <div v-if="outputFormat !== 'png'" class="param-group">
          <div class="param-group__label-row">
            <label class="param-group__label">Quality: <span class="param-value-tag">{{ quality }}%</span></label>
          </div>
          <input
            type="range"
            min="1"
            max="100"
            :value="quality"
            class="custom-slider"
            @input="emit('update:quality', parseInt(($event.target as HTMLInputElement).value, 10))"
          />
        </div>

        <!-- KV Cache & Execution Mode -->
        <div class="params-row">
          <div class="param-group param-group--half">
            <label class="param-group__label">KV Cache</label>
            <button
              type="button"
              class="switch-btn"
              :class="{ 'switch-btn--on': useKvCache }"
              @click="emit('update:useKvCache', !useKvCache)"
            >
              <span class="switch-btn__handle" />
              <span class="switch-btn__label">{{ useKvCache ? 'Enabled (Faster)' : 'Disabled' }}</span>
            </button>
          </div>

          <div class="param-group param-group--half">
            <label class="param-group__label">API Mode</label>
            <div class="segmented-pills">
              <button
                type="button"
                class="pill-btn"
                :class="{ 'pill-btn--active': executionMode === 'job' }"
                @click="emit('update:executionMode', 'job')"
              >
                Job Polling
              </button>
              <button
                type="button"
                class="pill-btn"
                :class="{ 'pill-btn--active': executionMode === 'sync' }"
                @click="emit('update:executionMode', 'sync')"
              >
                Direct Sync
              </button>
            </div>
          </div>
        </div>
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

    &.text-warn {
      color: $color-warning;
    }
  }

  &__note {
    font-size: $font-size-xs;
    color: $color-text-muted;
    margin-top: 4px;
  }
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
}

.ratio-selector {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 8px;

  @media (max-width: 860px) {
    grid-template-columns: repeat(4, 1fr);
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
  transition: all $duration-fast ease;

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
    transition: all $duration-fast ease;
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
}

.pill-btn {
  flex: 1;
  padding: 6px 10px;
  border-radius: $radius-sm;
  font-size: $font-size-xs;
  font-weight: $font-weight-medium;
  color: $color-text-secondary;
  text-align: center;

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

.custom-slider {
  width: 100%;
  accent-color: $color-accent;
  cursor: pointer;
}

.negative-prompt-box {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 6px;
  padding: 10px 12px;
  border-radius: $radius-md;
  background-color: $color-bg-subtle;
  border: 1px solid $color-border-subtle;
}

.negative-textarea {
  width: 100%;
  background-color: $color-bg-canvas;
  border: 1px solid $color-border-subtle;
  border-radius: $radius-sm;
  padding: 8px 10px;
  font-size: $font-size-sm;
  color: $color-text-primary;
  resize: vertical;

  &:focus {
    border-color: $color-border-focus;
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
}

.switch-btn {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 12px;
  border-radius: $radius-sm;
  background-color: $color-bg-subtle;
  border: 1px solid $color-border-subtle;

  &__handle {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background-color: $color-text-dim;
    transition: all $duration-fast ease;
  }

  &__label {
    font-size: $font-size-xs;
    font-weight: $font-weight-medium;
    color: $color-text-secondary;
  }

  &--on {
    border-color: rgba(52, 211, 153, 0.3);

    .switch-btn__handle {
      background-color: $color-success;
      box-shadow: 0 0 8px rgba(52, 211, 153, 0.5);
    }

    .switch-btn__label {
      color: $color-text-primary;
    }
  }
}
</style>
