<template>
  <div :class="['s-field', disabled && 's-field--disabled']">
    <label v-if="label" :for="selectId" class="s-field__label">
      {{ label }}
      <span v-if="required" class="s-field__required" aria-hidden="true">*</span>
    </label>

    <div
      :class="['s-input-wrap', 's-select-wrap', errorMessage && 's-input-wrap--error', successMessage && 's-input-wrap--success']">
      <!-- Ícono izquierdo -->
      <span v-if="$slots['icon-left']" class="s-input__icon s-input__icon--left" aria-hidden="true">
        <slot name="icon-left" />
      </span>

      <select :id="selectId" :value="modelValue" :disabled="disabled" :required="required"
        :aria-describedby="helpText || errorMessage ? descId : undefined" :aria-invalid="!!errorMessage"
        :class="['s-input', 's-select', $slots['icon-left'] && 's-input--pad-left', !modelValue && 's-select--placeholder']"
        v-bind="$attrs" @change="e => $emit('update:modelValue', (e.target as HTMLSelectElement).value)">
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

interface Option { value: string | number; label: string; disabled?: boolean }

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
.s-field {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.s-field--disabled {
  opacity: 0.5;
  pointer-events: none;
}

.s-field__label {
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  color: var(--color-neutral-700);
  line-height: 1;
}

.s-field__required {
  color: var(--color-error-500);
  margin-left: 2px;
}

.s-input-wrap {
  position: relative;
  display: flex;
  align-items: center;
  border: 1.5px solid var(--color-neutral-300);
  border-radius: var(--radius-lg);
  background: var(--color-neutral-0);
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
}

.s-input-wrap:focus-within {
  border-color: var(--color-primary-500);
  box-shadow: 0 0 0 3px rgba(26, 86, 255, .12);
}

.s-input-wrap--error {
  border-color: var(--color-error-500) !important;
}

.s-input-wrap--error:focus-within {
  box-shadow: 0 0 0 3px rgba(239, 68, 68, .12) !important;
}

.s-input {
  flex: 1;
  min-width: 0;
  padding: 0.5625rem 0.875rem;
  font-family: var(--font-body);
  font-size: var(--text-sm);
  color: var(--color-neutral-900);
  background: transparent;
  border: none;
  outline: none;
  line-height: var(--leading-normal);
}

.s-input--pad-left {
  padding-left: 2.5rem;
}

.s-select {
  appearance: none;
  -webkit-appearance: none;
  cursor: pointer;
  padding-right: 2.5rem;
}

.s-select--placeholder {
  color: var(--color-neutral-400);
}

.s-select__chevron {
  position: absolute;
  right: 0.75rem;
  color: var(--color-neutral-400);
  pointer-events: none;
  display: flex;
  align-items: center;
  transition: transform var(--transition-fast);
}

.s-input-wrap:focus-within .s-select__chevron {
  transform: rotate(180deg);
}

.s-input__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  position: absolute;
  color: var(--color-neutral-400);
  pointer-events: none;
}

.s-input__icon--left {
  left: 0.75rem;
}

.s-field__hint {
  font-size: var(--text-xs);
  line-height: 1.4;
}

.s-field__hint--help {
  color: var(--color-neutral-500);
}

.s-field__hint--error {
  color: var(--color-error-600);
}
</style>