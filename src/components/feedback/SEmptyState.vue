<template>
  <div :class="['s-empty', `s-empty--${size}`]" role="status">
    <!-- Ícono personalizado o SVG por defecto -->
    <div class="s-empty__illustration" aria-hidden="true">
      <slot name="icon">
        <!-- Empty books illustration -->
        <svg viewBox="0 0 120 100" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="10" y="20" width="36" height="50" rx="4" fill="var(--color-neutral-100)"
            stroke="var(--color-neutral-300)" stroke-width="1.5" />
          <rect x="14" y="28" width="20" height="2" rx="1" fill="var(--color-neutral-300)" />
          <rect x="14" y="34" width="28" height="2" rx="1" fill="var(--color-neutral-300)" />
          <rect x="14" y="40" width="24" height="2" rx="1" fill="var(--color-neutral-300)" />
          <rect x="52" y="10" width="36" height="60" rx="4" fill="var(--color-neutral-100)"
            stroke="var(--color-neutral-300)" stroke-width="1.5" />
          <rect x="56" y="20" width="20" height="2" rx="1" fill="var(--color-neutral-300)" />
          <rect x="56" y="26" width="28" height="2" rx="1" fill="var(--color-neutral-300)" />
          <rect x="56" y="32" width="16" height="2" rx="1" fill="var(--color-neutral-300)" />
          <rect x="94" y="25" width="16" height="45" rx="4" fill="var(--color-neutral-100)"
            stroke="var(--color-neutral-300)" stroke-width="1.5" />
          <circle cx="60" cy="82" r="12" fill="var(--color-primary-50)" stroke="var(--color-primary-200)"
            stroke-width="1.5" />
          <path d="M56 82h8M60 78v8" stroke="var(--color-primary-400)" stroke-width="2" stroke-linecap="round" />
        </svg>
      </slot>
    </div>

    <div class="s-empty__text">
      <h3 class="s-empty__title">{{ title }}</h3>
      <p v-if="description" class="s-empty__description">{{ description }}</p>
    </div>

    <div v-if="$slots.action" class="s-empty__action">
      <slot name="action" />
    </div>
  </div>
</template>

<script setup lang="ts">
type Size = 'sm' | 'md' | 'lg'

withDefaults(defineProps<{
  title?: string
  description?: string
  size?: Size
}>(), {
  title: 'Sin resultados',
  description: 'No hay datos disponibles para mostrar.',
  size: 'md',
})
</script>

<style scoped>
.s-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  gap: 1rem;
  padding: 3rem 2rem;
  animation: fadeInUp var(--transition-normal) ease both;
}

.s-empty--sm {
  padding: 2rem 1.5rem;
  gap: 0.75rem;
}

.s-empty--lg {
  padding: 5rem 3rem;
  gap: 1.25rem;
}

.s-empty__illustration svg {
  width: 120px;
  height: auto;
  opacity: 0.9;
}

.s-empty--sm .s-empty__illustration svg {
  width: 80px;
}

.s-empty--lg .s-empty__illustration svg {
  width: 160px;
}

.s-empty__text {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.s-empty__title {
  font-family: var(--font-display);
  font-size: var(--text-lg);
  color: var(--color-neutral-700);
  margin: 0;
}

.s-empty--sm .s-empty__title {
  font-size: var(--text-base);
}

.s-empty--lg .s-empty__title {
  font-size: var(--text-xl);
}

.s-empty__description {
  font-size: var(--text-sm);
  color: var(--color-neutral-400);
  max-width: 300px;
  line-height: 1.5;
  margin: 0;
}

.s-empty__action {
  display: flex;
  justify-content: center;
  gap: 0.75rem;
}
</style>