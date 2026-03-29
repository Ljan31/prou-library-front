<template>
  <div :class="['s-field', disabled && 's-field--disabled']">
    <!-- Label -->
    <label v-if="label" :for="inputId" class="s-field__label">
      {{ label }}
      <span v-if="required" class="s-field__required" aria-hidden="true">*</span>
    </label>

    <!-- Wrapper del input -->
    <div :class="['s-input-wrap', stateClass, focused && 's-input-wrap--focused']">
      <!-- Ícono izquierdo -->
      <span v-if="$slots['icon-left'] || iconLeft" class="s-input__icon s-input__icon--left" aria-hidden="true">
        <slot name="icon-left">
          <component :is="iconLeft" class="s-input__icon-svg" />
        </slot>
      </span>

      <!-- Input real -->
      <input v-if="type !== 'textarea'" :id="inputId" :type="inputType" :value="modelValue" :placeholder="placeholder"
        :disabled="disabled" :readonly="readonly" :required="required" :autocomplete="autocomplete"
        :aria-describedby="helpText || errorMessage ? descId : undefined" :aria-invalid="!!errorMessage" class="s-input"
        :class="[
          ($slots['icon-left'] || iconLeft) && 's-input--pad-left',
          ($slots['icon-right'] || iconRight || clearable || type === 'password') && 's-input--pad-right',
        ]" v-bind="$attrs" @input="onInput" @blur="onBlur" @focus="onFocus" />

      <!-- Textarea -->
      <textarea v-else :id="inputId" :value="modelValue" :placeholder="placeholder" :disabled="disabled"
        :readonly="readonly" :required="required" :rows="rows"
        :aria-describedby="helpText || errorMessage ? descId : undefined" :aria-invalid="!!errorMessage"
        class="s-input s-input--textarea" v-bind="$attrs" @input="onInput" @blur="onBlur" @focus="onFocus" />

      <!-- Ícono derecho / toggle password / clear -->
      <span class="s-input__actions">
        <!-- Limpiar valor -->
        <button v-if="clearable && modelValue && !disabled" type="button" class="s-input__action-btn"
          aria-label="Limpiar campo" @click="$emit('update:modelValue', '')">
          <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
            <path fill-rule="evenodd"
              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
              clip-rule="evenodd" />
          </svg>
        </button>
        <!-- Toggle contraseña -->
        <button v-if="type === 'password'" type="button" class="s-input__action-btn"
          :aria-label="showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'"
          @click="showPassword = !showPassword">
          <svg v-if="!showPassword" viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
            <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
            <path fill-rule="evenodd"
              d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z"
              clip-rule="evenodd" />
          </svg>
          <svg v-else viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
            <path fill-rule="evenodd"
              d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z"
              clip-rule="evenodd" />
            <path
              d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.064 7 9.542 7 .847 0 1.669-.105 2.454-.303z" />
          </svg>
        </button>
        <!-- Ícono custom derecho -->
        <span v-if="$slots['icon-right'] || iconRight" class="s-input__icon s-input__icon--right">
          <slot name="icon-right">
            <component :is="iconRight" class="s-input__icon-svg" />
          </slot>
        </span>
      </span>

      <!-- Indicador de estado -->
      <span v-if="errorMessage" class="s-input__state-icon s-input__state-icon--error" aria-hidden="true">
        <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
          <path fill-rule="evenodd"
            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
            clip-rule="evenodd" />
        </svg>
      </span>
      <span v-else-if="successMessage" class="s-input__state-icon s-input__state-icon--success" aria-hidden="true">
        <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
          <path fill-rule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
            clip-rule="evenodd" />
        </svg>
      </span>
    </div>

    <!-- Texto de ayuda / error / éxito -->
    <div v-if="errorMessage || successMessage || helpText" :id="descId" class="s-field__hint">
      <span v-if="errorMessage" class="s-field__hint--error">{{ errorMessage }}</span>
      <span v-else-if="successMessage" class="s-field__hint--success">{{ successMessage }}</span>
      <span v-else class="s-field__hint--help">{{ helpText }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

interface Props {
  modelValue?: string | number
  label?: string
  placeholder?: string
  type?: 'text' | 'email' | 'password' | 'number' | 'search' | 'tel' | 'url' | 'textarea'
  disabled?: boolean
  readonly?: boolean
  required?: boolean
  clearable?: boolean
  errorMessage?: string
  successMessage?: string
  helpText?: string
  autocomplete?: string
  rows?: number
  iconLeft?: object
  iconRight?: object
  id?: string
}

const props = withDefaults(defineProps<Props>(), {
  type: 'text',
  rows: 4,
})

const emit = defineEmits<{
  'update:modelValue': [value: string | number]
  blur: [e: FocusEvent]
  focus: [e: FocusEvent]
}>()

const focused = ref(false)
const showPassword = ref(false)

const inputId = computed(() => props.id || `s-input-${Math.random().toString(36).slice(2, 8)}`)
const descId = computed(() => `${inputId.value}-desc`)

const inputType = computed(() => {
  if (props.type === 'password') return showPassword.value ? 'text' : 'password'
  return props.type === 'textarea' ? 'text' : props.type
})

const stateClass = computed(() => {
  if (props.errorMessage) return 's-input-wrap--error'
  if (props.successMessage) return 's-input-wrap--success'
  return ''
})

function onInput(e: Event) {
  emit('update:modelValue', (e.target as HTMLInputElement | HTMLTextAreaElement).value)
}
function onBlur(e: FocusEvent) { focused.value = false; emit('blur', e) }
function onFocus(e: FocusEvent) { focused.value = true; emit('focus', e) }
</script>

<style scoped>
/* ── Field wrapper ── */
.s-field {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.s-field--disabled {
  opacity: 0.5;
  pointer-events: none;
}

/* ── Label ── */
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

/* ── Input wrap ── */
.s-input-wrap {
  position: relative;
  display: flex;
  align-items: center;
  border: 1.5px solid var(--color-neutral-300);
  border-radius: var(--radius-lg);
  background: var(--color-neutral-0);
  transition:
    border-color var(--transition-fast),
    box-shadow var(--transition-fast);
}

.s-input-wrap--focused,
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

.s-input-wrap--success {
  border-color: var(--color-success-500) !important;
}

.s-input-wrap--success:focus-within {
  box-shadow: 0 0 0 3px rgba(34, 197, 94, .12) !important;
}

/* ── Input element ── */
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
  border-radius: inherit;
}

.s-input::placeholder {
  color: var(--color-neutral-400);
}

.s-input--pad-left {
  padding-left: 2.5rem;
}

.s-input--pad-right {
  padding-right: 2.5rem;
}

.s-input--textarea {
  resize: vertical;
  padding: 0.75rem 0.875rem;
  align-self: stretch;
}

/* ── Icons ── */
.s-input__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  position: absolute;
  color: var(--color-neutral-400);
  pointer-events: none;
  flex-shrink: 0;
}

.s-input__icon--left {
  left: 0.75rem;
}

.s-input__icon--right {
  right: 0.75rem;
}

.s-input__icon-svg {
  width: 1rem;
  height: 1rem;
}

/* ── Action buttons (clear, toggle) ── */
.s-input__actions {
  display: flex;
  align-items: center;
  gap: 0.125rem;
  padding-right: 0.5rem;
  flex-shrink: 0;
}

.s-input__action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.75rem;
  height: 1.75rem;
  border: none;
  background: none;
  color: var(--color-neutral-400);
  cursor: pointer;
  border-radius: var(--radius-md);
  transition: color var(--transition-fast), background var(--transition-fast);
}

.s-input__action-btn:hover {
  color: var(--color-neutral-700);
  background: var(--color-neutral-100);
}

/* ── State icons ── */
.s-input__state-icon {
  display: flex;
  align-items: center;
  position: absolute;
  right: 0.75rem;
  pointer-events: none;
}

.s-input__state-icon--error {
  color: var(--color-error-500);
}

.s-input__state-icon--success {
  color: var(--color-success-500);
}

/* ── Hints ── */
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

.s-field__hint--success {
  color: var(--color-success-600);
}
</style>