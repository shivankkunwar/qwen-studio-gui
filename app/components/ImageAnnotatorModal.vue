<script setup lang="ts">
import { X, Undo2, RotateCcw, Check, Sparkles } from '@lucide/vue'

const props = defineProps<{
  show: boolean
  imageSrc: string
  imageIndex: number
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'save', newImageDataUrl: string): void
}>()

const canvasRef = ref<HTMLCanvasElement | null>(null)
const containerRef = ref<HTMLDivElement | null>(null)

const currentColor = ref('#ef4444') // Red default
const brushSize = ref(6)
const colors = ['#ef4444', '#f59e0b', '#10b981', '#38bdf8', '#ffffff']

let isDrawing = false
let historyStack: ImageData[] = []
let baseImage: HTMLImageElement | null = null

const initCanvas = () => {
  if (!props.imageSrc || !canvasRef.value) return

  const canvas = canvasRef.value
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  baseImage = new Image()
  baseImage.crossOrigin = 'anonymous'
  baseImage.onload = () => {
    // Max display size
    const maxWidth = 760
    const maxHeight = 520
    let w = baseImage!.naturalWidth
    let h = baseImage!.naturalHeight

    const ratio = Math.min(maxWidth / w, maxHeight / h, 1)
    canvas.width = Math.round(w * ratio)
    canvas.height = Math.round(h * ratio)

    ctx.drawImage(baseImage!, 0, 0, canvas.width, canvas.height)
    historyStack = [ctx.getImageData(0, 0, canvas.width, canvas.height)]
  }
  baseImage.src = props.imageSrc
}

watch(
  () => props.show,
  (open) => {
    if (open) {
      nextTick(() => {
        initCanvas()
      })
    }
  }
)

const startDrawing = (e: MouseEvent | TouchEvent) => {
  const canvas = canvasRef.value
  if (!canvas) return
  isDrawing = true
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const rect = canvas.getBoundingClientRect()
  const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
  const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY

  ctx.beginPath()
  ctx.moveTo(clientX - rect.left, clientY - rect.top)
  ctx.strokeStyle = currentColor.value
  ctx.lineWidth = brushSize.value
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
}

const draw = (e: MouseEvent | TouchEvent) => {
  if (!isDrawing || !canvasRef.value) return
  const canvas = canvasRef.value
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const rect = canvas.getBoundingClientRect()
  const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
  const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY

  ctx.lineTo(clientX - rect.left, clientY - rect.top)
  ctx.stroke()
}

const stopDrawing = () => {
  if (!isDrawing || !canvasRef.value) return
  isDrawing = false
  const ctx = canvasRef.value.getContext('2d')
  if (!ctx) return

  historyStack.push(ctx.getImageData(0, 0, canvasRef.value.width, canvasRef.value.height))
}

const undo = () => {
  if (historyStack.length <= 1 || !canvasRef.value) return
  historyStack.pop()
  const prev = historyStack[historyStack.length - 1]
  const ctx = canvasRef.value.getContext('2d')
  if (ctx && prev) {
    ctx.putImageData(prev, 0, 0)
  }
}

const reset = () => {
  if (!baseImage || !canvasRef.value) return
  const canvas = canvasRef.value
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(baseImage, 0, 0, canvas.width, canvas.height)
  historyStack = [ctx.getImageData(0, 0, canvas.width, canvas.height)]
}

const save = () => {
  if (!canvasRef.value) return
  const dataUrl = canvasRef.value.toDataURL('image/png')
  emit('save', dataUrl)
  emit('close')
}

// Escape key listener
const onKeyDown = (e: KeyboardEvent) => {
  if (e.key === 'Escape' && props.show) {
    emit('close')
  }
}

onMounted(() => {
  window.addEventListener('keydown', onKeyDown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeyDown)
})
</script>

<template>
  <div v-if="show" class="annotator-overlay" @click.self="emit('close')">
    <div class="annotator-modal">
      <div class="annotator-modal__header">
        <div class="annotator-modal__title-group">
          <div class="annotator-modal__icon">
            <Sparkles :size="16" />
          </div>
          <div>
            <h3 class="annotator-modal__title">Markup Image {{ imageIndex + 1 }}</h3>
            <p class="annotator-modal__desc">
              Draw shapes or arrows to guide Qwen's edits (e.g. circle an object or draw an arrow)
            </p>
          </div>
        </div>

        <button type="button" class="annotator-modal__close" @click="emit('close')">
          <X :size="18" />
        </button>
      </div>

      <!-- Controls Toolbar -->
      <div class="annotator-modal__tools">
        <div class="annotator-modal__colors">
          <span class="annotator-modal__tool-label">Color:</span>
          <button
            v-for="c in colors"
            :key="c"
            type="button"
            class="color-btn"
            :class="{ 'color-btn--active': currentColor === c }"
            :style="{ backgroundColor: c }"
            @click="currentColor = c"
          />
        </div>

        <div class="annotator-modal__sizes">
          <span class="annotator-modal__tool-label">Stroke:</span>
          <button
            type="button"
            class="size-btn"
            :class="{ 'size-btn--active': brushSize === 3 }"
            @click="brushSize = 3"
          >
            Thin
          </button>
          <button
            type="button"
            class="size-btn"
            :class="{ 'size-btn--active': brushSize === 6 }"
            @click="brushSize = 6"
          >
            Med
          </button>
          <button
            type="button"
            class="size-btn"
            :class="{ 'size-btn--active': brushSize === 12 }"
            @click="brushSize = 12"
          >
            Thick
          </button>
        </div>

        <div class="annotator-modal__history-actions">
          <button
            type="button"
            class="action-tool-btn"
            :disabled="historyStack.length <= 1"
            title="Undo stroke"
            @click="undo"
          >
            <Undo2 :size="14" />
            <span>Undo</span>
          </button>
          <button
            type="button"
            class="action-tool-btn"
            title="Clear all drawings"
            @click="reset"
          >
            <RotateCcw :size="14" />
            <span>Reset</span>
          </button>
        </div>
      </div>

      <!-- Canvas Area -->
      <div ref="containerRef" class="annotator-modal__canvas-wrapper">
        <canvas
          ref="canvasRef"
          class="annotator-canvas"
          @mousedown="startDrawing"
          @mousemove="draw"
          @mouseup="stopDrawing"
          @mouseleave="stopDrawing"
          @touchstart.prevent="startDrawing"
          @touchmove.prevent="draw"
          @touchend.prevent="stopDrawing"
        />
      </div>

      <!-- Footer Buttons -->
      <div class="annotator-modal__footer">
        <button type="button" class="btn-secondary" @click="emit('close')">
          Cancel
        </button>
        <button type="button" class="btn-primary" @click="save">
          <Check :size="14" />
          <span>Apply Markup to Reference</span>
        </button>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.annotator-overlay {
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  z-index: 100;
}

.annotator-modal {
  width: 100%;
  max-width: 820px;
  background-color: $color-bg-surface;
  border: 1px solid $color-border-default;
  border-radius: $radius-lg;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: enter-modal $duration-fast $ease-out forwards;
  transform-origin: center;

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid $color-border-subtle;
  }

  &__title-group {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  &__icon {
    width: 32px;
    height: 32px;
    border-radius: $radius-sm;
    background-color: $color-accent-soft;
    color: $color-accent;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  &__title {
    font-size: $font-size-md;
    font-weight: $font-weight-semibold;
    color: $color-text-primary;
  }

  &__desc {
    font-size: $font-size-xs;
    color: $color-text-muted;
  }

  &__close {
    color: $color-text-muted;
    padding: 6px;
    border-radius: $radius-sm;

    &:hover {
      background-color: $color-bg-subtle;
      color: $color-text-primary;
    }
  }

  &__tools {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 20px;
    background-color: $color-bg-subtle;
    border-bottom: 1px solid $color-border-subtle;
    flex-wrap: wrap;
    gap: 12px;
  }

  &__tool-label {
    font-size: $font-size-xs;
    color: $color-text-muted;
    font-weight: $font-weight-medium;
  }

  &__colors, &__sizes, &__history-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  &__canvas-wrapper {
    background-color: #0b0f14;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    min-height: 360px;
    max-height: 540px;
    overflow: auto;
  }

  &__footer {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 10px;
    padding: 14px 20px;
    border-top: 1px solid $color-border-subtle;
  }
}

.annotator-canvas {
  cursor: crosshair;
  border-radius: $radius-sm;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
  touch-action: none;
}

.color-btn {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: 2px solid transparent;
  transition: transform $duration-fast $ease-out;

  &:hover {
    transform: scale(1.15);
  }

  &--active {
    border-color: #ffffff;
    box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.3);
  }
}

.size-btn {
  font-size: $font-size-xs;
  font-weight: $font-weight-medium;
  padding: 3px 8px;
  border-radius: $radius-sm;
  background-color: $color-bg-surface;
  border: 1px solid $color-border-subtle;
  color: $color-text-secondary;

  &:hover {
    background-color: $color-bg-card-hover;
    color: $color-text-primary;
  }

  &--active {
    background-color: $color-accent-soft;
    border-color: rgba(56, 189, 248, 0.4);
    color: $color-accent;
  }
}

.action-tool-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: $font-size-xs;
  font-weight: $font-weight-medium;
  padding: 4px 10px;
  border-radius: $radius-sm;
  background-color: $color-bg-surface;
  border: 1px solid $color-border-subtle;
  color: $color-text-secondary;

  &:hover:not(:disabled) {
    background-color: $color-bg-card-hover;
    color: $color-text-primary;
  }
}

.btn-secondary {
  padding: 7px 14px;
  font-size: $font-size-sm;
  font-weight: $font-weight-medium;
  border-radius: $radius-sm;
  color: $color-text-secondary;

  &:hover {
    background-color: $color-bg-subtle;
    color: $color-text-primary;
  }
}

.btn-primary {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 16px;
  font-size: $font-size-sm;
  font-weight: $font-weight-medium;
  border-radius: $radius-sm;
  background: linear-gradient(135deg, #2563eb, #1d4ed8);
  color: #ffffff;

  &:hover {
    background: linear-gradient(135deg, #3b82f6, #2563eb);
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
