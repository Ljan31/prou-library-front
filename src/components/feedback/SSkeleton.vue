<!-- SSkeleton.vue -->
<template>
  <div :class="['s-skeleton', `s-skeleton--${variant}`]" :style="styles" aria-hidden="true" />
</template>

<script setup lang="ts">
import { computed } from 'vue'
type Variant = 'text' | 'heading' | 'rect' | 'circle' | 'avatar'

const props = withDefaults(defineProps<{
  variant?: Variant
  width?: string
  height?: string
  rounded?: boolean
}>(), { variant: 'text' })

const styles = computed(() => ({
  ...(props.width ? { width: props.width } : {}),
  ...(props.height ? { height: props.height } : {}),
}))
</script>

<style scoped>
.s-skeleton {
  background: linear-gradient(90deg,
      var(--color-neutral-100) 25%,
      var(--color-neutral-200) 50%,
      var(--color-neutral-100) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  display: block;
}

.s-skeleton--text {
  height: 1em;
  width: 100%;
  border-radius: var(--radius-sm);
}

.s-skeleton--heading {
  height: 1.5em;
  width: 60%;
  border-radius: var(--radius-sm);
}

.s-skeleton--rect {
  height: 6rem;
  width: 100%;
  border-radius: var(--radius-lg);
}

.s-skeleton--circle {
  width: 3rem;
  height: 3rem;
  border-radius: 50%;
}

.s-skeleton--avatar {
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 50%;
}

@keyframes shimmer {
  0% {
    background-position: -200% 0;
  }

  100% {
    background-position: 200% 0;
  }
}
</style>