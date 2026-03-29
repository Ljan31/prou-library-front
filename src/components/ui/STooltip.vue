<template>
  <span class="s-tooltip-wrapper" @mouseenter="show = true" @mouseleave="show = false" @focusin="show = true"
    @focusout="show = false">
    <slot />
    <Transition name="v-fade">
      <span v-if="show && content" :class="['s-tooltip', `s-tooltip--${placement}`]" role="tooltip" :id="tooltipId">
        {{ content }}
        <span class="s-tooltip__arrow" aria-hidden="true" />
      </span>
    </Transition>
  </span>
</template>

<script setup lang="ts">
import { ref } from 'vue'

type Placement = 'top' | 'bottom' | 'left' | 'right'

withDefaults(defineProps<{ content?: string; placement?: Placement }>(), {
  placement: 'top',
})

const show = ref(false)
const tooltipId = `s-tooltip-${Math.random().toString(36).slice(2, 8)}`
</script>

<style scoped>
.s-tooltip-wrapper {
  position: relative;
  display: inline-flex;
  align-items: center;
}

.s-tooltip {
  position: absolute;
  z-index: var(--z-tooltip);
  background: var(--color-neutral-900);
  color: var(--color-neutral-0);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  padding: 0.375rem 0.625rem;
  border-radius: var(--radius-md);
  white-space: nowrap;
  pointer-events: none;
  box-shadow: var(--shadow-lg);
  max-width: 200px;
  text-align: center;
}

/* Placements */
.s-tooltip--top {
  bottom: calc(100% + 8px);
  left: 50%;
  transform: translateX(-50%);
}

.s-tooltip--bottom {
  top: calc(100% + 8px);
  left: 50%;
  transform: translateX(-50%);
}

.s-tooltip--left {
  right: calc(100% + 8px);
  top: 50%;
  transform: translateY(-50%);
}

.s-tooltip--right {
  left: calc(100% + 8px);
  top: 50%;
  transform: translateY(-50%);
}

/* Arrows */
.s-tooltip__arrow {
  position: absolute;
  width: 0;
  height: 0;
  border: 5px solid transparent;
}

.s-tooltip--top .s-tooltip__arrow {
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  border-top-color: var(--color-neutral-900);
  border-bottom: none;
}

.s-tooltip--bottom .s-tooltip__arrow {
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  border-bottom-color: var(--color-neutral-900);
  border-top: none;
}

.s-tooltip--left .s-tooltip__arrow {
  left: 100%;
  top: 50%;
  transform: translateY(-50%);
  border-left-color: var(--color-neutral-900);
  border-right: none;
}

.s-tooltip--right .s-tooltip__arrow {
  right: 100%;
  top: 50%;
  transform: translateY(-50%);
  border-right-color: var(--color-neutral-900);
  border-left: none;
}
</style>