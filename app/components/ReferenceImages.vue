<script setup lang="ts">
import {
  Upload,
  X,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Image as ImageIcon,
  Trash2
} from '@lucide/vue'

const props = withDefaults(defineProps<{
  images: string[]
  maxImages?: number
  title?: string
  subtitle?: string
  badge?: string
  allowMarkup?: boolean
}>(), { allowMarkup: true })

const emit = defineEmits<{
  (e: 'add', dataUrl: string): void
  (e: 'remove', index: number): void
  (e: 'move', from: number, to: number): void
  (e: 'annotate', index: number): void
  (e: 'clear'): void
}>()

const max = computed(() => props.maxImages ?? 10)
const isDragging = ref(false)
const fileInputRef = ref<HTMLInputElement | null>(null)

const handleFiles = (files: FileList | File[]) => {
  Array.from(files).forEach((file) => {
    if (!file.type.startsWith('image/')) return
    if (props.images.length >= max.value) return

    const reader = new FileReader()
    reader.onload = (e) => {
      if (typeof e.target?.result === 'string') {
        emit('add', e.target.result)
      }
    }
    reader.readAsDataURL(file)
  })
}

const onDrop = (e: DragEvent) => {
  isDragging.value = false
  if (e.dataTransfer?.files) {
    handleFiles(e.dataTransfer.files)
  }
}

const onFileInputChange = (e: Event) => {
  const target = e.target as HTMLInputElement
  if (target.files) {
    handleFiles(target.files)
    target.value = ''
  }
}

// Global paste listener for pasting images directly from clipboard!
const onPaste = (e: ClipboardEvent) => {
  const items = e.clipboardData?.items
  if (!items) return
  for (let i = 0; i < items.length; i++) {
    if (items[i].type.indexOf('image') !== -1) {
      const file = items[i].getAsFile()
      if (file) handleFiles([file])
    }
  }
}

onMounted(() => {
  window.addEventListener('paste', onPaste)
})

onUnmounted(() => {
  window.removeEventListener('paste', onPaste)
})
</script>

<template>
  <div class="ref-section">
    <div class="ref-section__header">
      <div class="ref-section__title-group">
        <span class="ref-section__title">{{ title ?? 'Reference Images' }}</span>
        <span class="ref-section__count">{{ images.length }}/{{ max }}</span>
        <span class="ref-section__subtitle">{{ subtitle ?? 'Order matters in prompt (e.g. "person in image 1")' }}</span>
      </div>

      <button
        v-if="images.length > 0"
        type="button"
        class="ref-section__clear-btn"
        @click="emit('clear')"
      >
        <Trash2 :size="13" />
        <span>Clear all</span>
      </button>
    </div>

    <!-- Image Grid & Dropzone -->
    <div class="ref-section__grid">
      <!-- Existing Images -->
      <div
        v-for="(img, idx) in images"
        :key="idx"
        class="ref-card"
      >
        <div class="ref-card__preview">
          <img :src="img" :alt="`Reference ${idx + 1}`" />
          <span class="ref-card__badge">{{ badge ?? `Image ${idx + 1}` }}</span>
        </div>

        <div class="ref-card__toolbar">
          <div class="ref-card__reorder">
            <button
              type="button"
              class="ref-card__tool-btn"
              :disabled="idx === 0"
              title="Move earlier"
              @click="emit('move', idx, idx - 1)"
            >
              <ChevronLeft :size="14" />
            </button>
            <button
              type="button"
              class="ref-card__tool-btn"
              :disabled="idx === images.length - 1"
              title="Move later"
              @click="emit('move', idx, idx + 1)"
            >
              <ChevronRight :size="14" />
            </button>
          </div>

          <div class="ref-card__actions">
            <button
              v-if="allowMarkup"
              type="button"
              class="ref-card__tool-btn ref-card__tool-btn--accent"
              title="Draw / Markup image (model edits annotated areas)"
              @click="emit('annotate', idx)"
            >
              <Pencil :size="13" />
              <span>Markup</span>
            </button>

            <button
              type="button"
              class="ref-card__tool-btn ref-card__tool-btn--danger"
              title="Remove image"
              @click="emit('remove', idx)"
            >
              <X :size="14" />
            </button>
          </div>
        </div>
      </div>

      <!-- Add / Dropzone Card -->
      <div
        v-if="images.length < max"
        class="ref-dropzone"
        :class="{ 'ref-dropzone--active': isDragging }"
        @dragover.prevent="isDragging = true"
        @dragleave.prevent="isDragging = false"
        @drop.prevent="onDrop"
        @click="fileInputRef?.click()"
      >
        <input
          ref="fileInputRef"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          multiple
          hidden
          @change="onFileInputChange"
        />
        <div class="ref-dropzone__icon">
          <Upload :size="18" />
        </div>
        <div class="ref-dropzone__text">
          <span>Drop image or click</span>
          <span class="ref-dropzone__hint">Supports paste (⌘V)</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.ref-section {
  display: flex;
  flex-direction: column;
  gap: 10px;

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  &__title-group {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  &__title {
    font-size: $font-size-sm;
    font-weight: $font-weight-medium;
    color: $color-text-primary;
  }

  &__count {
    font-size: $font-size-xs;
    font-weight: $font-weight-semibold;
    padding: 1px 6px;
    border-radius: $radius-full;
    background-color: $color-bg-subtle;
    border: 1px solid $color-border-subtle;
    color: $color-text-secondary;
    font-family: var(--font-mono);
  }

  &__subtitle {
    font-size: $font-size-xs;
    color: $color-text-muted;
  }

  &__clear-btn {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 3px 8px;
    border-radius: $radius-sm;
    color: $color-text-muted;
    font-size: $font-size-xs;

    &:hover {
      background-color: $color-bg-subtle;
      color: $color-danger;
    }
  }

  &__grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(136px, 1fr));
    gap: 12px;
  }
}

.ref-card {
  background-color: $color-bg-surface;
  border: 1px solid $color-border-default;
  border-radius: $radius-md;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  transition: border-color $duration-fast ease;

  &:hover {
    border-color: rgba(255, 255, 255, 0.2);
  }

  &__preview {
    position: relative;
    width: 100%;
    aspect-ratio: 1;
    background-color: $color-bg-input;
    overflow: hidden;

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
  }

  &__badge {
    position: absolute;
    top: 6px;
    left: 6px;
    background-color: rgba(0, 0, 0, 0.75);
    backdrop-filter: blur(4px);
    color: #ffffff;
    font-size: 11px;
    font-weight: $font-weight-medium;
    padding: 2px 6px;
    border-radius: $radius-sm;
    font-family: var(--font-mono);
  }

  &__toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 8px;
    background-color: $color-bg-subtle;
    border-top: 1px solid $color-border-subtle;
  }

  &__reorder, &__actions {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  &__tool-btn {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    padding: 3px 5px;
    border-radius: 4px;
    color: $color-text-secondary;
    font-size: 11px;

    &:hover:not(:disabled) {
      background-color: $color-bg-card-hover;
      color: $color-text-primary;
    }

    &--accent {
      color: $color-accent;
      background-color: $color-accent-soft;

      &:hover {
        background-color: rgba(56, 189, 248, 0.2);
        color: #ffffff;
      }
    }

    &--danger {
      &:hover {
        background-color: $color-danger-soft;
        color: $color-danger;
      }
    }
  }
}

.ref-dropzone {
  min-height: 136px;
  border: 1px dashed $color-border-default;
  border-radius: $radius-md;
  background-color: rgba($color-bg-surface, 0.5);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 12px;
  text-align: center;
  cursor: pointer;
  transition: all $duration-fast ease;

  &:hover, &--active {
    border-color: $color-accent;
    background-color: rgba(56, 189, 248, 0.05);

    .ref-dropzone__icon {
      color: $color-accent;
      transform: translateY(-2px);
    }
  }

  &__icon {
    color: $color-text-muted;
    transition: transform $duration-fast ease, color $duration-fast ease;
  }

  &__text {
    display: flex;
    flex-direction: column;
    font-size: $font-size-xs;
    font-weight: $font-weight-medium;
    color: $color-text-secondary;
  }

  &__hint {
    font-size: 11px;
    color: $color-text-dim;
  }
}
</style>
