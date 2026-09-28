<script setup lang="ts">
import { appColor, appName, money } from '~/composables/useUsage'

export interface StackedBar {
  key: string
  label: string // x-axis tick (may be '')
  title: string // tooltip heading
  segments: { app: string; value: number }[]
}

const props = defineProps<{
  bars: StackedBar[]
  height?: number
  emptyText?: string
}>()

const h = computed(() => props.height ?? 160)
const totals = computed(() => props.bars.map((b) => b.segments.reduce((s, x) => s + x.value, 0)))
const max = computed(() => {
  const m = Math.max(...totals.value, 0)
  if (m <= 0) return 0.01
  // Round the axis top up to a readable step.
  const steps = [0.01, 0.02, 0.05, 0.1, 0.2, 0.25, 0.5, 1, 2, 5, 10, 20, 50]
  return steps.find((s) => s >= m) ?? m
})
const hover = ref<number | null>(null)
const hasData = computed(() => totals.value.some((t) => t > 0))
</script>

<template>
  <div class="chart">
    <div v-if="!hasData" class="chart__empty">{{ emptyText ?? 'No cost in this range' }}</div>
    <template v-else>
      <div class="chart__plot" :style="{ height: `${h}px` }">
        <!-- Recessive grid: top, middle, baseline -->
        <div class="chart__grid" style="top: 0"><span>{{ money(max) }}</span></div>
        <div class="chart__grid" style="top: 50%"><span>{{ money(max / 2) }}</span></div>
        <div class="chart__grid chart__grid--base" style="top: 100%" />

        <div class="chart__bars">
          <div
            v-for="(b, i) in bars"
            :key="b.key"
            class="chart__col"
            @mouseenter="hover = i"
            @mouseleave="hover = null"
          >
            <div class="chart__stack" :style="{ height: `${(totals[i] / max) * 100}%` }">
              <div
                v-for="s in b.segments.filter((x) => x.value > 0)"
                :key="s.app"
                class="chart__seg"
                :style="{ flexGrow: s.value, backgroundColor: appColor(s.app) }"
              />
            </div>
            <div v-if="hover === i" class="chart__tip" :class="{ 'chart__tip--left': i > bars.length * 0.6 }">
              <span class="chart__tip-title">{{ b.title }}</span>
              <span v-for="s in b.segments.filter((x) => x.value > 0)" :key="s.app" class="chart__tip-row">
                <span class="chart__swatch" :style="{ backgroundColor: appColor(s.app) }" />
                <span>{{ appName(s.app) }}</span>
                <span class="chart__tip-val">{{ money(s.value, 3) }}</span>
              </span>
              <span class="chart__tip-row chart__tip-row--total">
                <span>Total</span>
                <span class="chart__tip-val">{{ money(totals[i], 3) }}</span>
              </span>
            </div>
          </div>
        </div>
      </div>
      <div class="chart__ticks">
        <span v-for="b in bars" :key="b.key" class="chart__tick">{{ b.label }}</span>
      </div>
    </template>
  </div>
</template>

<style lang="scss" scoped>
.chart {
  width: 100%;

  &__empty {
    padding: 40px 0;
    text-align: center;
    font-size: $font-size-xs;
    color: $color-text-muted;
  }

  &__plot {
    position: relative;
    margin-left: 44px;
  }

  &__grid {
    position: absolute;
    left: 0;
    right: 0;
    border-top: 1px dashed rgba(255, 255, 255, 0.06);

    span {
      position: absolute;
      right: calc(100% + 8px);
      top: -7px;
      font-size: 10px;
      font-family: var(--font-mono);
      color: $color-text-dim;
      white-space: nowrap;
    }

    &--base {
      border-top: 1px solid $color-border-default;
    }
  }

  &__bars {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: flex-end;
    gap: 2px;
  }

  &__col {
    position: relative;
    flex: 1;
    height: 100%;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    cursor: default;

    &:hover {
      background-color: rgba(255, 255, 255, 0.03);
    }
  }

  &__stack {
    width: min(70%, 22px);
    min-height: 0;
    display: flex;
    flex-direction: column-reverse; // first segment sits on the baseline
    gap: 2px; // surface gap between stacked fills
    border-radius: 4px 4px 0 0;
    overflow: hidden;
  }

  &__seg {
    flex-basis: 0;
    min-height: 2px;
  }

  &__tip {
    position: absolute;
    bottom: calc(100% + 6px);
    left: 50%;
    z-index: 5;
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 170px;
    padding: 8px 10px;
    border-radius: $radius-sm;
    background-color: $color-bg-subtle;
    border: 1px solid $color-border-default;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
    pointer-events: none;
    font-size: 11px;
    color: $color-text-secondary;

    &--left {
      left: auto;
      right: 50%;
    }
  }

  &__tip-title {
    font-weight: $font-weight-semibold;
    color: $color-text-primary;
  }

  &__tip-row {
    display: flex;
    align-items: center;
    gap: 6px;

    &--total {
      padding-top: 4px;
      border-top: 1px solid $color-border-subtle;
      color: $color-text-primary;
    }
  }

  &__tip-val {
    margin-left: auto;
    font-family: var(--font-mono);
    color: $color-text-primary;
  }

  &__swatch {
    width: 8px;
    height: 8px;
    border-radius: 2px;
    flex-shrink: 0;
  }

  &__ticks {
    display: flex;
    gap: 2px;
    margin: 6px 0 0 44px;
  }

  &__tick {
    flex: 1;
    min-width: 0;
    text-align: center;
    font-size: 10px;
    font-family: var(--font-mono);
    color: $color-text-dim;
    white-space: nowrap;
    overflow: visible;
  }
}
</style>
