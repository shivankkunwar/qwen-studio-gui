<script setup lang="ts">
import { Loader2, AlertCircle, XCircle } from '@lucide/vue'
import type { JobProgress, JobStatus } from '~/types/api'

const props = defineProps<{
  status: JobStatus
  progress: JobProgress | null
  elapsedSeconds: number
  errorMessage?: string | null
  // Video mode passes its own text and percent (stages differ from Qwen's steps).
  titleOverride?: string
  detailOverride?: string
  percentOverride?: number
}>()

const emit = defineEmits<{
  (e: 'cancel'): void
}>()

const percent = computed(() => {
  if (props.percentOverride !== undefined) return props.percentOverride
  if (props.status === 'starting') return 12
  if (props.progress && props.progress.steps > 0) {
    const singleImagePercent = (props.progress.step / props.progress.steps) * 100
    const totalImages = props.progress.images || 1
    const currentImgIndex = (props.progress.image || 1) - 1
    const overall = (currentImgIndex * 100 + singleImagePercent) / totalImages
    return Math.min(Math.round(overall), 98)
  }
  return 20
})
</script>

<template>
  <div v-if="status === 'starting' || status === 'running' || status === 'failed'" class="progress-card animate-enter">
    <!-- Active Generation -->
    <div v-if="status === 'starting' || status === 'running'" class="progress-card__active">
      <div class="progress-card__header">
        <div class="progress-card__status-info">
          <Loader2 :size="18" class="progress-card__spinner spinner-fast" />
          <div>
            <div class="progress-card__title">
              <span v-if="titleOverride">{{ titleOverride }}</span>
              <span v-else-if="status === 'starting'">Initializing GPU Container...</span>
              <span v-else>
                Generating Image {{ progress?.image ?? 1 }} of {{ progress?.images ?? 1 }}
              </span>
            </div>
            <div class="progress-card__subtitle">
              <span v-if="detailOverride">{{ detailOverride }}</span>
              <span v-else-if="status === 'starting'">
                Waking L40S serverless worker (cold start takes ~30–60s if idle)
              </span>
              <span v-else-if="progress">
                Denoising step {{ progress.step }} of {{ progress.steps }} ({{ percent }}%)
              </span>
            </div>
          </div>
        </div>

        <div class="progress-card__timer">
          <span class="timer-tag">{{ elapsedSeconds }}s elapsed</span>
          <button type="button" class="cancel-link" @click="emit('cancel')">Stop</button>
        </div>
      </div>

      <!-- Animated Progress Bar -->
      <div class="progress-bar-track">
        <div
          class="progress-bar-fill"
          :class="{ 'progress-bar-fill--pulsing': status === 'starting' }"
          :style="{ width: `${percent}%` }"
        />
      </div>
    </div>

    <!-- Error State -->
    <div v-else-if="status === 'failed'" class="progress-card__error">
      <div class="error-icon">
        <AlertCircle :size="18" />
      </div>
      <div class="error-content">
        <span class="error-title">Generation Encountered an Error</span>
        <span class="error-desc">{{ errorMessage || 'An unexpected error occurred during model inference.' }}</span>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.progress-card {
  background-color: $color-bg-surface;
  border: 1px solid $color-border-default;
  border-radius: $radius-lg;
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);

  &__active {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  &__status-info {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  &__spinner {
    color: $color-accent;
    flex-shrink: 0;
  }

  &__title {
    font-size: $font-size-sm;
    font-weight: $font-weight-semibold;
    color: $color-text-primary;
  }

  &__subtitle {
    font-size: $font-size-xs;
    color: $color-text-muted;
  }

  &__timer {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  &__error {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    color: $color-danger;
  }
}

.timer-tag {
  font-size: $font-size-xs;
  font-family: var(--font-mono);
  color: $color-text-secondary;
  background-color: $color-bg-subtle;
  padding: 2px 8px;
  border-radius: $radius-sm;
  border: 1px solid $color-border-subtle;
}

.cancel-link {
  font-size: $font-size-xs;
  color: $color-danger;
  padding: 2px 6px;
  border-radius: 4px;

  &:hover {
    background-color: $color-danger-soft;
  }
}

.progress-bar-track {
  width: 100%;
  height: 6px;
  background-color: $color-bg-subtle;
  border-radius: 9999px;
  overflow: hidden;
  position: relative;
}

.progress-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #38bdf8, #3b82f6);
  border-radius: 9999px;
  transition: width 350ms $ease-out;

  &--pulsing {
    animation: progress-pulse 1.6s ease-in-out infinite alternate;
  }
}

@keyframes progress-pulse {
  from {
    opacity: 0.5;
  }
  to {
    opacity: 1;
  }
}

.error-icon {
  flex-shrink: 0;
  padding-top: 2px;
}

.error-content {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.error-title {
  font-size: $font-size-sm;
  font-weight: $font-weight-semibold;
  color: $color-danger;
}

.error-desc {
  font-size: $font-size-xs;
  color: rgba(248, 113, 113, 0.9);
}
</style>
