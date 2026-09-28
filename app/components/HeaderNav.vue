<script setup lang="ts">
import { money } from '~/composables/useUsage'
import {
  Sparkles,
  Film,
  Wallet,
  Image as ImageIcon,
  Settings,
  History,
  Activity,
  CheckCircle2,
  AlertCircle,
  ExternalLink
} from '@lucide/vue'

const props = withDefaults(defineProps<{
  isHealthy: boolean | null
  historyCount: number
  title?: string
  badge?: string
  showHistory?: boolean
  showSettings?: boolean
}>(), { showHistory: true, showSettings: true })

// Credit left, shown in every studio (server caches the billing read for 3 minutes).
const usage = useUsage()
onMounted(() => {
  if (!usage.full.value) usage.refreshFull()
})

const emit = defineEmits<{
  (e: 'open-settings'): void
  (e: 'open-history'): void
  (e: 'refresh-health'): void
}>()
</script>

<template>
  <header class="header">
    <div class="header__left">
      <div class="header__brand">
        <div class="header__logo">
          <Sparkles :size="18" class="header__logo-icon" />
        </div>
        <div class="header__titles">
          <span class="header__title">{{ title ?? 'Qwen Image Studio' }}</span>
          <span class="header__badge">{{ badge ?? '2.1 · L40S' }}</span>
        </div>
      </div>

      <nav class="header__studios" aria-label="Studios">
        <NuxtLink to="/" class="header__studio" exact-active-class="header__studio--active">
          <ImageIcon :size="14" />
          <span>Image</span>
        </NuxtLink>
        <NuxtLink to="/video" class="header__studio" exact-active-class="header__studio--active">
          <Film :size="14" />
          <span>Video</span>
        </NuxtLink>
        <NuxtLink to="/usage" class="header__studio" exact-active-class="header__studio--active">
          <Wallet :size="14" />
          <span>Usage</span>
        </NuxtLink>
      </nav>

      <div
        class="header__status"
        :class="{
          'header__status--healthy': isHealthy === true,
          'header__status--error': isHealthy === false,
          'header__status--unknown': isHealthy === null
        }"
        title="Click to re-check API connection"
        @click="emit('refresh-health')"
      >
        <span class="header__status-dot" />
        <span class="header__status-label">
          {{ isHealthy === true ? 'Modal API Online' : isHealthy === false ? 'API Disconnected' : 'Checking...' }}
        </span>
      </div>
    </div>

    <div class="header__right">
      <NuxtLink
        v-if="usage.full.value"
        to="/usage"
        class="header__credit"
        :class="{ 'header__credit--low': usage.full.value.remaining < 5 }"
        :title="`${money(usage.full.value.metered)} of ${money(usage.full.value.plan_credit)} used · resets in ${usage.full.value.cycle.days_left.toFixed(1)} days`"
      >
        <Wallet :size="13" />
        <span>{{ money(usage.full.value.remaining) }} left</span>
      </NuxtLink>

      <button
        v-if="showHistory"
        class="header__action-btn"
        title="Generation History"
        @click="emit('open-history')"
      >
        <History :size="16" />
        <span>History</span>
        <span v-if="historyCount > 0" class="header__count-pill">{{ historyCount }}</span>
      </button>

      <button
        v-if="showSettings"
        class="header__action-btn"
        title="Settings & Credentials"
        @click="emit('open-settings')"
      >
        <Settings :size="16" />
        <span>Settings</span>
      </button>
    </div>
  </header>
</template>

<style lang="scss" scoped>
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 24px;
  border-bottom: 1px solid $color-border-subtle;
  background-color: rgba($color-bg-canvas, 0.85);
  backdrop-filter: blur(12px);
  position: sticky;
  top: 0;
  z-index: 40;

  &__left {
    display: flex;
    align-items: center;
    gap: 20px;
  }

  &__brand {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  &__logo {
    width: 32px;
    height: 32px;
    border-radius: $radius-sm;
    background: linear-gradient(135deg, rgba(56, 189, 248, 0.2), rgba(52, 211, 153, 0.2));
    border: 1px solid rgba(56, 189, 248, 0.3);
    display: flex;
    align-items: center;
    justify-content: center;

    &-icon {
      color: $color-accent;
    }
  }

  &__titles {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  &__title {
    font-size: $font-size-md;
    font-weight: $font-weight-semibold;
    color: $color-text-primary;
    letter-spacing: -0.01em;
  }

  &__badge {
    font-size: $font-size-xs;
    font-weight: $font-weight-medium;
    padding: 2px 7px;
    border-radius: $radius-full;
    background-color: $color-bg-subtle;
    border: 1px solid $color-border-default;
    color: $color-text-secondary;
    font-family: var(--font-mono);
  }

  &__studios {
    display: flex;
    padding: 3px;
    gap: 2px;
    border-radius: $radius-md;
    background-color: $color-bg-subtle;
    border: 1px solid $color-border-subtle;
  }

  &__studio {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 5px 12px;
    border-radius: $radius-sm;
    color: $color-text-secondary;
    font-size: $font-size-xs;
    font-weight: $font-weight-medium;
    text-decoration: none;
    transition: color $duration-fast ease, background-color $duration-fast ease;

    &:hover {
      color: $color-text-primary;
    }

    &--active {
      background-color: $color-bg-surface;
      color: $color-accent;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
    }
  }

  &__status {
    display: flex;
    align-items: center;
    gap: 7px;
    padding: 4px 10px;
    border-radius: $radius-full;
    background-color: $color-bg-surface;
    border: 1px solid $color-border-subtle;
    font-size: $font-size-xs;
    cursor: pointer;
    transition: border-color $duration-fast ease, background-color $duration-fast ease;

    &:hover {
      border-color: $color-border-default;
    }

    &-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background-color: $color-text-dim;
      transition: background-color $duration-normal ease;
    }

    &-label {
      color: $color-text-secondary;
      font-weight: $font-weight-medium;
    }

    &--healthy {
      .header__status-dot {
        background-color: $color-success;
        box-shadow: 0 0 8px rgba(52, 211, 153, 0.4);
      }
    }

    &--error {
      .header__status-dot {
        background-color: $color-danger;
        box-shadow: 0 0 8px rgba(248, 113, 113, 0.4);
      }
      .header__status-label {
        color: $color-danger;
      }
    }

    &--unknown {
      .header__status-dot {
        background-color: $color-warning;
      }
    }
  }

  &__right {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  &__action-btn {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 7px 12px;
    border-radius: $radius-sm;
    background-color: $color-bg-surface;
    border: 1px solid $color-border-subtle;
    color: $color-text-secondary;
    font-size: $font-size-sm;
    font-weight: $font-weight-medium;

    &:hover {
      background-color: $color-bg-card-hover;
      color: $color-text-primary;
      border-color: $color-border-default;
    }

    &:active {
      transform: scale(0.97);
    }
  }

  &__credit {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 11px;
    border-radius: $radius-full;
    background-color: $color-bg-surface;
    border: 1px solid rgba(52, 211, 153, 0.3);
    color: $color-success;
    font-size: $font-size-xs;
    font-weight: $font-weight-semibold;
    font-family: var(--font-mono);
    text-decoration: none;

    &:hover {
      background-color: $color-bg-card-hover;
    }

    &--low {
      border-color: rgba(251, 191, 36, 0.4);
      color: $color-warning;
    }
  }

  &__count-pill {
    padding: 1px 6px;
    border-radius: $radius-full;
    background-color: $color-accent-soft;
    color: $color-accent;
    font-size: $font-size-xs;
    font-weight: $font-weight-semibold;
  }
}
</style>
