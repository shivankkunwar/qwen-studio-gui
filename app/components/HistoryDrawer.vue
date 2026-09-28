<script setup lang="ts">
import { X, Clock, Trash2, ArrowRight, RefreshCw, Hash, Download } from '@lucide/vue'
import type { GenerationHistoryItem, VideoHistoryItem } from '~/types/api'

type Item = GenerationHistoryItem | VideoHistoryItem

const props = defineProps<{
  show: boolean
  history: Item[]
  kind?: 'image' | 'video'
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'select', item: any): void
  (e: 'clear'): void
}>()

const isVideo = computed(() => props.kind === 'video')
const videoOf = (item: Item) => (item as VideoHistoryItem).response.videos?.[0]
const MODEL_NAMES: Record<string, string> = { ltx: 'LTX-2.5', fastwan: 'FastWan' }

const formatDate = (timestamp: number) => {
  const d = new Date(timestamp)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

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
  <div v-if="show" class="drawer-overlay" @click.self="emit('close')">
    <div class="drawer-panel">
      <div class="drawer-panel__header">
        <div class="drawer-panel__title-group">
          <Clock :size="16" class="text-accent" />
          <h3 class="drawer-panel__title">Session History</h3>
          <span class="drawer-panel__count">{{ history.length }}</span>
        </div>

        <div class="drawer-panel__header-actions">
          <button
            v-if="history.length > 0"
            type="button"
            class="header-text-btn text-danger"
            @click="emit('clear')"
          >
            Clear all
          </button>
          <button type="button" class="drawer-panel__close" @click="emit('close')">
            <X :size="18" />
          </button>
        </div>
      </div>

      <div class="drawer-panel__content">
        <div v-if="history.length === 0" class="drawer-empty">
          <Clock :size="32" class="drawer-empty__icon" />
          <span class="drawer-empty__title">No generations yet</span>
          <span class="drawer-empty__desc">{{ isVideo ? 'Videos' : 'Images' }} you generate will appear here.</span>
        </div>

        <div v-else class="history-list">
          <div
            v-for="item in history"
            :key="item.id"
            class="history-card"
            @click="emit('select', item)"
          >
            <div class="history-card__thumb">
              <video
                v-if="isVideo && videoOf(item)?.url"
                :src="`${videoOf(item)!.url}#t=0.1`"
                muted
                playsinline
                preload="metadata"
              />
              <img
                v-else-if="!isVideo && (item as GenerationHistoryItem).response.images?.[0]?.url"
                :src="(item as GenerationHistoryItem).response.images![0].url"
                alt="thumbnail"
              />
            </div>

            <div class="history-card__info">
              <span class="history-card__prompt">{{ item.request.prompt }}</span>
              <div class="history-card__meta">
                <span class="meta-tag">{{ formatDate(item.timestamp) }}</span>
                <template v-if="isVideo">
                  <span class="meta-tag">{{ MODEL_NAMES[(item as VideoHistoryItem).model] }}</span>
                  <span v-if="videoOf(item)" class="meta-tag">{{ videoOf(item)!.duration }}s clip</span>
                  <span v-if="(item as VideoHistoryItem).request.quality === 'hd'" class="meta-tag">HD</span>
                  <span v-if="(item as VideoHistoryItem).request.image" class="meta-tag">i2v</span>
                </template>
                <span v-else class="meta-tag">{{ (item as GenerationHistoryItem).request.size }}</span>
                <span class="meta-tag">{{ item.durationSeconds }}s</span>
                <span v-if="item.request.seed" class="meta-tag">#{{ item.request.seed }}</span>
              </div>
            </div>

            <div class="history-card__arrow">
              <ArrowRight :size="15" />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.drawer-overlay {
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  z-index: 100;
  display: flex;
  justify-content: flex-end;
}

.drawer-panel {
  width: 100%;
  max-width: 440px;
  height: 100%;
  background-color: $color-bg-surface;
  border-left: 1px solid $color-border-default;
  display: flex;
  flex-direction: column;
  box-shadow: -10px 0 30px rgba(0, 0, 0, 0.5);
  animation: slide-drawer 240ms $ease-out forwards;

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 18px 20px;
    border-bottom: 1px solid $color-border-subtle;
  }

  &__title-group {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  &__title {
    font-size: $font-size-md;
    font-weight: $font-weight-semibold;
    color: $color-text-primary;
  }

  &__count {
    font-size: $font-size-xs;
    font-weight: $font-weight-semibold;
    background-color: $color-bg-subtle;
    border: 1px solid $color-border-subtle;
    color: $color-text-secondary;
    padding: 1px 7px;
    border-radius: $radius-full;
  }

  &__header-actions {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  &__close {
    color: $color-text-muted;
    padding: 4px;
    border-radius: $radius-sm;

    &:hover {
      color: $color-text-primary;
      background-color: $color-bg-subtle;
    }
  }

  &__content {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
  }
}

.text-accent {
  color: $color-accent;
}

.text-danger {
  color: $color-danger;
}

.header-text-btn {
  font-size: $font-size-xs;
  padding: 4px 8px;
  border-radius: $radius-sm;

  &:hover {
    background-color: $color-danger-soft;
  }
}

.drawer-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  height: 60%;
  gap: 8px;
  color: $color-text-muted;

  &__icon {
    margin-bottom: 8px;
    opacity: 0.4;
  }

  &__title {
    font-size: $font-size-md;
    font-weight: $font-weight-medium;
    color: $color-text-secondary;
  }

  &__desc {
    font-size: $font-size-xs;
    max-width: 260px;
  }
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.history-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px;
  border-radius: $radius-md;
  background-color: $color-bg-subtle;
  border: 1px solid $color-border-subtle;
  cursor: pointer;
  transition: all $duration-fast ease;

  &:hover {
    background-color: $color-bg-card-hover;
    border-color: $color-border-default;

    .history-card__arrow {
      color: $color-accent;
      transform: translateX(2px);
    }
  }

  &__thumb {
    width: 54px;
    height: 54px;
    border-radius: $radius-sm;
    background-color: #0b0f14;
    overflow: hidden;
    flex-shrink: 0;

    img,
    video {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
  }

  &__info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  &__prompt {
    font-size: $font-size-xs;
    font-weight: $font-weight-medium;
    color: $color-text-primary;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  &__meta {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
  }

  &__arrow {
    color: $color-text-dim;
    transition: transform $duration-fast ease, color $duration-fast ease;
  }
}

.meta-tag {
  font-size: 10px;
  font-family: var(--font-mono);
  color: $color-text-muted;
  background-color: $color-bg-surface;
  padding: 1px 5px;
  border-radius: 3px;
}

@keyframes slide-drawer {
  from {
    transform: translateX(100%);
  }
  to {
    transform: translateX(0);
  }
}
</style>
