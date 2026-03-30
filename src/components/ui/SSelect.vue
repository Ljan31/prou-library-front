<template>
  <div :class="['s-field', disabled && 's-field--disabled']">
    <label v-if="label" :for="selectId" class="s-field__label">
      {{ label }}
      <span v-if="required" class="s-field__required" aria-hidden="true">*</span>
    </label>

    <div :class="[
      's-input-wrap',
      errorMessage && 's-input-wrap--error',
      successMessage && 's-input-wrap--success'
    ]">
      <!-- Ícono izquierdo -->
      <span v-if="$slots['icon-left']" class="s-input__icon s-input__icon--left" aria-hidden="true">
        <slot name="icon-left" />
      </span>

      <select :id="selectId" :value="modelValue" :disabled="disabled" :required="required"
        :aria-describedby="helpText || errorMessage ? descId : undefined" :aria-invalid="!!errorMessage" :class="[
          's-select',
          $slots['icon-left'] && 's-select--pad-left',
          !modelValue && 's-select--placeholder'
        ]" v-bind="$attrs" @change="e => $emit('update:modelValue', (e.target as HTMLSelectElement).value)">
        <option v-if="placeholder" value="" disabled :selected="!modelValue">
          {{ placeholder }}
        </option>
        <option v-for="opt in options" :key="opt.value" :value="opt.value" :disabled="opt.disabled">
          {{ opt.label }}
        </option>
      </select>

      <!-- Chevron -->
      <span class="s-select__chevron" aria-hidden="true">
        <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
          <path fill-rule="evenodd"
            d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
            clip-rule="evenodd" />
        </svg>
      </span>
    </div>

    <div v-if="errorMessage || helpText" :id="descId" class="s-field__hint">
      <span v-if="errorMessage" class="s-field__hint--error">{{ errorMessage }}</span>
      <span v-else class="s-field__hint--help">{{ helpText }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Option {
  value: string | number
  label: string
  disabled?: boolean
}

interface Props {
  modelValue?: string | number
  label?: string
  placeholder?: string
  options: Option[]
  disabled?: boolean
  required?: boolean
  errorMessage?: string
  successMessage?: string
  helpText?: string
  id?: string
}

const props = defineProps<Props>()

defineEmits<{ 'update:modelValue': [v: string | number] }>()

const selectId = computed(() => props.id || `s-select-${Math.random().toString(36).slice(2, 8)}`)
const descId = computed(() => `${selectId.value}-desc`)
</script>

<style scoped>
/* ── Field wrapper ──────────────────────────────────────────────────────── */
.s-field {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.s-field--disabled {
  opacity: 0.5;
  pointer-events: none;
}

/* ── Label ──────────────────────────────────────────────────────────────── */
.s-field__label {
  font-size: 0.875rem;
  /* text-sm */
  font-weight: 500;
  color: #334155;
  /* slate-700 */
  line-height: 1;
}

.s-field__required {
  color: #ef4444;
  /* red-500 */
  margin-left: 2px;
}

/* ── Input wrap ─────────────────────────────────────────────────────────── */
.s-input-wrap {
  position: relative;
  display: flex;
  align-items: center;
  border: 1.5px solid #cbd5e1;
  /* slate-300 */
  border-radius: 0.5rem;
  /* rounded-lg */
  background: #ffffff;
  transition: border-color 150ms ease, box-shadow 150ms ease;
}

.s-input-wrap:focus-within {
  border-color: #6366f1;
  /* indigo-500 */
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.12);
}

/* Error state */
.s-input-wrap--error {
  border-color: #ef4444 !important;
  /* red-500 */
}

.s-input-wrap--error:focus-within {
  box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.12) !important;
}

/* Success state */
.s-input-wrap--success {
  border-color: #10b981 !important;
  /* emerald-500 */
}

.s-input-wrap--success:focus-within {
  box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.12) !important;
}

/* ── Select element ─────────────────────────────────────────────────────── */
.s-select {
  flex: 1;
  min-width: 0;
  padding: 0.5625rem 2.5rem 0.5625rem 0.875rem;
  /* right space for chevron */
  font-family: "DM Sans", system-ui, sans-serif;
  font-size: 0.875rem;
  /* text-sm */
  color: #0f172a;
  /* slate-900 */
  background: transparent;
  border: none;
  outline: none;
  line-height: 1.5;
  appearance: none;
  -webkit-appearance: none;
  cursor: pointer;
}

.s-select--pad-left {
  padding-left: 2.5rem;
}

.s-select--placeholder {
  color: #94a3b8;
  /* slate-400 */
}

/* ── Chevron icon ───────────────────────────────────────────────────────── */
.s-select__chevron {
  position: absolute;
  right: 0.75rem;
  color: #94a3b8;
  /* slate-400 */
  pointer-events: none;
  display: flex;
  align-items: center;
  transition: transform 150ms ease;
}

.s-input-wrap:focus-within .s-select__chevron {
  transform: rotate(180deg);
  color: #6366f1;
  /* indigo-500 */
}

/* ── Left icon slot ─────────────────────────────────────────────────────── */
.s-input__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  position: absolute;
  color: #94a3b8;
  /* slate-400 */
  pointer-events: none;
}

.s-input__icon--left {
  left: 0.75rem;
}

/* ── Hint / error text ──────────────────────────────────────────────────── */
.s-field__hint {
  font-size: 0.75rem;
  /* text-xs */
  line-height: 1.4;
}

.s-field__hint--help {
  color: #64748b;
}

/* slate-500 */
.s-field__hint--error {
  color: #dc2626;
}

/* red-600 */
</style>
