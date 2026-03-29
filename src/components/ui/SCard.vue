<template>
  <div :class="[
    's-card',
    `s-card--${variant}`,
    hoverable && 's-card--hoverable',
    clickable && 's-card--clickable',
    noPadding && 's-card--no-padding',
  ]" :role="clickable ? 'button' : undefined" :tabindex="clickable ? 0 : undefined"
    @click="clickable && $emit('click', $event)"
    @keydown.enter="clickable && $emit('click', $event as unknown as MouseEvent)">
    <!-- Header -->
    <div v-if="$slots.header || title || subtitle" class="s-card__header">
      <slot name="header">
        <div class="s-card__titles">
          <h3 v-if="title" class="s-card__title">{{ title }}</h3>
          <p v-if="subtitle" class="s-card__subtitle">{{ subtitle }}</p>
        </div>
        <div v-if="$slots.actions" class="s-card__actions">
          <slot name="actions" />
        </div>
      </slot>
    </div>

    <!-- Divider entre header y body -->
    <div v-if="($slots.header || title) && !noDivider" class="s-card__divider" />

    <!-- Body -->
    <div :class="['s-card__body', bodyClass]">
      <slot />
    </div>

    <!-- Footer -->
    <template v-if="$slots.footer">
      <div class="s-card__divider" />
      <div class="s-card__footer">
        <slot name="footer" />
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
type Variant = 'default' | 'bordered' | 'flat' | 'elevated' | 'primary' | 'success' | 'warning' | 'error'

interface Props {
  title?: string
  subtitle?: string
  variant?: Variant
  hoverable?: boolean
  clickable?: boolean
  noPadding?: boolean
  noDivider?: boolean
  bodyClass?: string
}

withDefaults(defineProps<Props>(), { variant: 'default' })
defineEmits<{ click: [e: MouseEvent] }>()
</script>

<style scoped>
.s-card {
  background: var(--color-neutral-0);
  border-radius: var(--radius-xl);
  overflow: hidden;
  transition:
    box-shadow var(--transition-normal),
    transform var(--transition-normal),
    border-color var(--transition-fast);
  animation: fadeInUp var(--transition-normal) ease both;
}

/* ── Variants ── */
.s-card--default {
  border: 1px solid var(--color-neutral-200);
  box-shadow: var(--shadow-sm);
}

.s-card--bordered {
  border: 2px solid var(--color-neutral-200);
  box-shadow: none;
}

.s-card--flat {
  border: 1px solid var(--color-neutral-100);
  box-shadow: none;
  background: var(--color-neutral-50);
}

.s-card--elevated {
  border: none;
  box-shadow: var(--shadow-lg);
}

.s-card--primary {
  border: 1.5px solid var(--color-primary-200);
  background: var(--color-primary-50);
}

.s-card--success {
  border: 1.5px solid var(--color-success-100);
  background: var(--color-success-50);
}

.s-card--warning {
  border: 1.5px solid var(--color-warning-100);
  background: var(--color-warning-50);
}

.s-card--error {
  border: 1.5px solid var(--color-error-100);
  background: var(--color-error-50);
}

/* ── Interactive ── */
.s-card--hoverable:hover {
  box-shadow: var(--shadow-lg);
  transform: translateY(-2px);
}

.s-card--clickable {
  cursor: pointer;
}

.s-card--clickable:hover {
  box-shadow: var(--shadow-lg);
  transform: translateY(-2px);
}

.s-card--clickable:active {
  transform: translateY(0) scale(0.99);
}

.s-card--clickable:focus-visible {
  outline: 2px solid var(--color-primary-500);
  outline-offset: 2px;
}

/* ── Slots ── */
.s-card__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 1.25rem 1.5rem 1rem;
  gap: 1rem;
}

.s-card__titles {
  flex: 1;
  min-width: 0;
}

.s-card__title {
  font-family: var(--font-display);
  font-size: var(--text-lg);
  color: var(--color-neutral-900);
  line-height: var(--leading-snug);
  margin: 0;
}

.s-card__subtitle {
  font-size: var(--text-sm);
  color: var(--color-neutral-500);
  margin-top: 0.25rem;
  line-height: var(--leading-snug);
}

.s-card__actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-shrink: 0;
}

.s-card__divider {
  height: 1px;
  background: var(--color-neutral-100);
}

.s-card__body {
  padding: 1.25rem 1.5rem;
}

.s-card--no-padding .s-card__body {
  padding: 0;
}

.s-card--no-padding .s-card__header {
  padding-bottom: 1.25rem;
}

.s-card__footer {
  padding: 1rem 1.5rem;
  background: var(--color-neutral-50);
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.75rem;
}
</style>