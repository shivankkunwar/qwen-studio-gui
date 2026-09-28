<script setup lang="ts">
import { Play, Square, X, Loader2, CornerDownLeft } from '@lucide/vue'

const props = defineProps<{
  modelValue: string
  isGenerating: boolean
  elapsedSeconds: number
  hasImages: boolean
  placeholder?: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'generate'): void
  (e: 'cancel'): void
}>()

const textareaRef = ref<HTMLTextAreaElement | null>(null)

const adjustHeight = () => {
  const el = textareaRef.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${Math.min(Math.max(el.scrollHeight, 72), 220)}px`
}

watch(
  () => props.modelValue,
  () => {
    nextTick(adjustHeight)
  }
)

const handleKeyDown = (e: KeyboardEvent) => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
    e.preventDefault()
    if (!props.isGenerating && props.modelValue.trim()) {
      emit('generate')
    }
  }
}

const clearPrompt = () => {
  emit('update:modelValue', '')
  nextTick(() => {
    textareaRef.value?.focus()
    adjustHeight()
  })
}

onMounted(() => {
  adjustHeight()
})
</script>

<template>
  <div class="prompt-box" :class="{ 'prompt-box--focused': false, 'prompt-box--active': isGenerating }">
    <div class="prompt-box__inner">
      <textarea
        ref="textareaRef"
        :value="modelValue"
        class="prompt-box__textarea"
        :placeholder="placeholder ? placeholder : hasImages ? 'Describe the changes to the reference images (e.g., \'make it a rainy night, keep everything else the same\')...' : 'Describe what you want to create (e.g., \'a red kite over a misty lake at sunrise, cinematic lighting\')...'"
        rows="2"
        maxlength="4000"
        :disabled="isGenerating"
        @input="emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
        @keydown="handleKeyDown"
      />

      <button
        v-if="modelValue && !isGenerating"
        type="button"
        class="prompt-box__clear"
        title="Clear prompt"
        @click="clearPrompt"
      >
        <X :size="15" />
      </button>
    </div>

    <div class="prompt-box__footer">
      <div class="prompt-box__meta">
        <span class="prompt-box__char-count">{{ modelValue.length }}/4000</span>
        <span class="prompt-box__kbd">
          <kbd>⌘</kbd> + <kbd>Enter</kbd> to run
        </span>
      </div>

      <div class="prompt-box__actions">
        <button
          v-if="isGenerating"
          type="button"
          class="prompt-box__cancel-btn"
          @click="emit('cancel')"
        >
          <Square :size="13" class="prompt-box__cancel-icon" />
          <span>Cancel ({{ elapsedSeconds }}s)</span>
        </button>

        <button
          v-else
          type="button"
          class="prompt-box__submit-btn"
          :disabled="!modelValue.trim()"
          @click="emit('generate')"
        >
          <Play :size="14" class="prompt-box__submit-icon" />
          <span>Generate</span>
        </button>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.prompt-box {
  background-color: $color-bg-surface;
  border: 1px solid $color-border-default;
  border-radius: $radius-lg;
  padding: 14px 16px 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  transition: border-color $duration-fast ease, box-shadow $duration-fast ease;

  &:focus-within {
    border-color: $color-border-focus;
    box-shadow: 0 0 0 1px rgba(59, 130, 246, 0.2);
  }

  &--active {
    border-color: rgba(56, 189, 248, 0.4);
  }

  &__inner {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    position: relative;
  }

  &__textarea {
    width: 100%;
    min-height: 52px;
    max-height: 220px;
    background: transparent;
    border: none;
    resize: none;
    font-size: $font-size-md;
    font-weight: $font-weight-regular;
    line-height: 1.5;
    color: $color-text-primary;
    overflow-y: auto;

    &::placeholder {
      color: $color-text-muted;
    }
  }

  &__clear {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border-radius: $radius-sm;
    color: $color-text-muted;
    flex-shrink: 0;

    &:hover {
      background-color: $color-bg-subtle;
      color: $color-text-primary;
    }
  }

  &__footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-top: 6px;
    border-top: 1px solid $color-border-subtle;
  }

  &__meta {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  &__char-count {
    font-size: $font-size-xs;
    color: $color-text-muted;
    font-family: var(--font-mono);
  }

  &__kbd {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    font-size: $font-size-xs;
    color: $color-text-dim;

    kbd {
      font-family: var(--font-mono);
      background-color: $color-bg-subtle;
      border: 1px solid $color-border-subtle;
      border-radius: 4px;
      padding: 1px 5px;
      font-size: 11px;
      color: $color-text-muted;
    }
  }

  &__actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  &__submit-btn {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 8px 16px;
    border-radius: $radius-sm;
    background: linear-gradient(135deg, #2563eb, #1d4ed8);
    color: #ffffff;
    font-size: $font-size-sm;
    font-weight: $font-weight-medium;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);

    &:hover:not(:disabled) {
      background: linear-gradient(135deg, #3b82f6, #2563eb);
    }

    &:active:not(:disabled) {
      transform: scale(0.97);
    }

    &-icon {
      fill: currentColor;
    }
  }

  &__cancel-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 14px;
    border-radius: $radius-sm;
    background-color: rgba(248, 113, 113, 0.15);
    border: 1px solid rgba(248, 113, 113, 0.3);
    color: $color-danger;
    font-size: $font-size-sm;
    font-weight: $font-weight-medium;

    &:hover {
      background-color: rgba(248, 113, 113, 0.25);
    }

    &:active {
      transform: scale(0.97);
    }

    &-icon {
      fill: currentColor;
    }
  }
}
</style>
