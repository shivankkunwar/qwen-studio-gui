<script setup lang="ts">
import { X, Check, Key, Globe, Shield, RefreshCw, AlertCircle } from '@lucide/vue'

const props = defineProps<{
  show: boolean
  endpointMode: 'nitro' | 'local' | 'custom'
  customEndpoint: string
  modalKey: string
  modalSecret: string
  healthUrl?: string
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'update:endpointMode', val: 'nitro' | 'local' | 'custom'): void
  (e: 'update:customEndpoint', val: string): void
  (e: 'update:modalKey', val: string): void
  (e: 'update:modalSecret', val: string): void
  (e: 'save'): void
}>()

const testing = ref(false)
const testResult = ref<{ ok: boolean; message: string } | null>(null)

const testConnection = async () => {
  testing.value = true
  testResult.value = null
  const t0 = Date.now()

  try {
    const headers: Record<string, string> = {}
    if (props.endpointMode === 'custom') {
      if (props.customEndpoint) headers['x-custom-endpoint'] = props.customEndpoint
      if (props.modalKey) headers['x-modal-key'] = props.modalKey
      if (props.modalSecret) headers['x-modal-secret'] = props.modalSecret
    } else if (props.endpointMode === 'local') {
      headers['x-custom-endpoint'] = 'http://127.0.0.1:8787'
    }

    const res: any = await $fetch(props.healthUrl ?? '/api/health', {
      headers,
      timeout: 8000
    })

    const latency = Date.now() - t0
    if (res?.ok) {
      testResult.value = {
        ok: true,
        message: `Successfully connected (${latency}ms latency)`
      }
    } else {
      testResult.value = {
        ok: false,
        message: 'Endpoint replied, but health check returned non-ok.'
      }
    }
  } catch (err: any) {
    testResult.value = {
      ok: false,
      message: err.data?.message || err.statusMessage || err.message || 'Connection failed'
    }
  } finally {
    testing.value = false
  }
}

const handleSave = () => {
  emit('save')
  emit('close')
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
  <div v-if="show" class="settings-overlay" @click.self="emit('close')">
    <div class="settings-modal">
      <div class="settings-modal__header">
        <div class="settings-modal__title-group">
          <div class="settings-modal__icon">
            <Key :size="16" />
          </div>
          <div>
            <h3 class="settings-modal__title">API & Credentials Settings</h3>
            <p class="settings-modal__desc">Configure connection to your Modal Qwen Image deployment</p>
          </div>
        </div>

        <button type="button" class="settings-modal__close" @click="emit('close')">
          <X :size="18" />
        </button>
      </div>

      <div class="settings-modal__body">
        <!-- Mode Switcher -->
        <div class="setting-group">
          <label class="setting-label">Connection Mode</label>
          <div class="mode-options">
            <label
              class="mode-card"
              :class="{ 'mode-card--active': endpointMode === 'nitro' }"
            >
              <input
                type="radio"
                name="endpointMode"
                value="nitro"
                :checked="endpointMode === 'nitro'"
                @change="emit('update:endpointMode', 'nitro')"
              />
              <div class="mode-card__info">
                <span class="mode-card__title">Nitro Server Proxy (Recommended)</span>
                <span class="mode-card__desc">
                  Calls Modal directly through Nuxt backend. Reads keys from environment or defaults.
                </span>
              </div>
            </label>

            <label
              class="mode-card"
              :class="{ 'mode-card--active': endpointMode === 'local' }"
            >
              <input
                type="radio"
                name="endpointMode"
                value="local"
                :checked="endpointMode === 'local'"
                @change="emit('update:endpointMode', 'local')"
              />
              <div class="mode-card__info">
                <span class="mode-card__title">Local Node Proxy (server.mjs)</span>
                <span class="mode-card__desc">
                  Forwards to <code>http://127.0.0.1:8787</code> running from <code>qwen-image-modal/api</code>.
                </span>
              </div>
            </label>

            <label
              class="mode-card"
              :class="{ 'mode-card--active': endpointMode === 'custom' }"
            >
              <input
                type="radio"
                name="endpointMode"
                value="custom"
                :checked="endpointMode === 'custom'"
                @change="emit('update:endpointMode', 'custom')"
              />
              <div class="mode-card__info">
                <span class="mode-card__title">Custom Endpoint & Browser Tokens</span>
                <span class="mode-card__desc">
                  Enter your Modal base URL and Proxy Auth Tokens directly. Stored only in your local browser.
                </span>
              </div>
            </label>
          </div>
        </div>

        <!-- Custom Fields (active when endpointMode === 'custom') -->
        <div v-if="endpointMode === 'custom'" class="custom-fields animate-enter">
          <div class="field-item">
            <label class="setting-label">Modal Base URL</label>
            <input
              type="text"
              class="text-input"
              :value="customEndpoint"
              placeholder="https://shivankkunwar100--qwen-image-21-api.modal.run"
              @input="emit('update:customEndpoint', ($event.target as HTMLInputElement).value)"
            />
          </div>

          <div class="field-grid">
            <div class="field-item">
              <label class="setting-label">Modal-Key (wk-...)</label>
              <input
                type="text"
                class="text-input font-mono"
                :value="modalKey"
                placeholder="wk-xxxxxxxxxxxx"
                @input="emit('update:modalKey', ($event.target as HTMLInputElement).value)"
              />
            </div>
            <div class="field-item">
              <label class="setting-label">Modal-Secret (ws-...)</label>
              <input
                type="password"
                class="text-input font-mono"
                :value="modalSecret"
                placeholder="ws-xxxxxxxxxxxx"
                @input="emit('update:modalSecret', ($event.target as HTMLInputElement).value)"
              />
            </div>
          </div>
        </div>

        <!-- Test Connection Card -->
        <div class="test-connection-card">
          <div class="test-connection-card__header">
            <button
              type="button"
              class="test-btn"
              :disabled="testing"
              @click="testConnection"
            >
              <RefreshCw :size="14" :class="{ 'spinner-fast': testing }" />
              <span>{{ testing ? 'Testing Connection...' : 'Test Connection' }}</span>
            </button>

            <span class="test-note">Runs a free CPU health check without waking GPU.</span>
          </div>

          <div
            v-if="testResult"
            class="test-result-banner"
            :class="{ 'test-result-banner--ok': testResult.ok, 'test-result-banner--err': !testResult.ok }"
          >
            <Check v-if="testResult.ok" :size="16" />
            <AlertCircle v-else :size="16" />
            <span>{{ testResult.message }}</span>
          </div>
        </div>
      </div>

      <div class="settings-modal__footer">
        <button type="button" class="btn-secondary" @click="emit('close')">Cancel</button>
        <button type="button" class="btn-primary" @click="handleSave">
          <Check :size="14" />
          <span>Save Settings</span>
        </button>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.settings-overlay {
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

.settings-modal {
  width: 100%;
  max-width: 640px;
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
    padding: 18px 22px;
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

  &__body {
    padding: 20px 22px;
    display: flex;
    flex-direction: column;
    gap: 18px;
    max-height: 70vh;
    overflow-y: auto;
  }

  &__footer {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 10px;
    padding: 14px 22px;
    border-top: 1px solid $color-border-subtle;
  }
}

.setting-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.setting-label {
  font-size: $font-size-xs;
  font-weight: $font-weight-medium;
  color: $color-text-secondary;
}

.mode-options {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.mode-card {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 14px;
  border-radius: $radius-md;
  background-color: $color-bg-subtle;
  border: 1px solid $color-border-subtle;
  cursor: pointer;
  transition: all $duration-fast ease;

  input[type="radio"] {
    margin-top: 3px;
    accent-color: $color-accent;
  }

  &__info {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  &__title {
    font-size: $font-size-sm;
    font-weight: $font-weight-semibold;
    color: $color-text-primary;
  }

  &__desc {
    font-size: $font-size-xs;
    color: $color-text-muted;
    line-height: 1.4;

    code {
      font-family: var(--font-mono);
      background-color: $color-bg-surface;
      padding: 1px 4px;
      border-radius: 3px;
    }
  }

  &:hover {
    background-color: $color-bg-card-hover;
    border-color: $color-border-default;
  }

  &--active {
    background-color: rgba(56, 189, 248, 0.06);
    border-color: rgba(56, 189, 248, 0.4);

    .mode-card__title {
      color: $color-accent;
    }
  }
}

.custom-fields {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 14px;
  background-color: $color-bg-subtle;
  border-radius: $radius-md;
  border: 1px solid $color-border-subtle;
}

.field-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.field-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.text-input {
  width: 100%;
  background-color: $color-bg-canvas;
  border: 1px solid $color-border-default;
  border-radius: $radius-sm;
  padding: 8px 12px;
  font-size: $font-size-sm;
  color: $color-text-primary;

  &:focus {
    border-color: $color-border-focus;
  }
}

.font-mono {
  font-family: var(--font-mono);
}

.test-connection-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px;
  background-color: $color-bg-subtle;
  border-radius: $radius-md;
  border: 1px solid $color-border-subtle;

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 10px;
  }
}

.test-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: $radius-sm;
  background-color: $color-bg-surface;
  border: 1px solid $color-border-default;
  color: $color-text-primary;
  font-size: $font-size-xs;
  font-weight: $font-weight-medium;

  &:hover:not(:disabled) {
    background-color: $color-bg-card-hover;
  }
}

.test-note {
  font-size: 11px;
  color: $color-text-dim;
}

.test-result-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: $radius-sm;
  font-size: $font-size-xs;
  font-weight: $font-weight-medium;

  &--ok {
    background-color: $color-success-soft;
    color: $color-success;
    border: 1px solid rgba(52, 211, 153, 0.3);
  }

  &--err {
    background-color: $color-danger-soft;
    color: $color-danger;
    border: 1px solid rgba(248, 113, 113, 0.3);
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
