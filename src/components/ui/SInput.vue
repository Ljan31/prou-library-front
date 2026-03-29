<script setup lang="ts">
import { ref, computed } from 'vue'

const props = withDefaults(defineProps<{
  modelValue?:    string | number
  label?:         string
  placeholder?:   string
  type?:          string
  errorMessage?:  string
  helpText?:      string
  disabled?:      boolean
  required?:      boolean
  id?:            string
  autocomplete?:  string
}>(), {
  type: 'text'
})

const emit = defineEmits<{
  'update:modelValue': [val: string]
  'focus':             [e: FocusEvent]
  'blur':              [e: FocusEvent]
}>()

const showPassword = ref(false)
const inputId      = computed(() => props.id ?? `input_${Math.random().toString(36).slice(2)}`)
const inputType    = computed(() => {
  if (props.type === 'password') return showPassword.value ? 'text' : 'password'
  return props.type
})
</script>

<template>
  <div class="flex flex-col gap-1">
    <label
      v-if="label"
      :for="inputId"
      class="text-sm font-medium text-slate-700"
    >
      {{ label }}
      <span v-if="required" class="text-red-500 ml-0.5">*</span>
    </label>

    <div class="relative">
      <input
        :id="inputId"
        class="w-full h-9 px-3 text-sm bg-white border rounded-lg outline-none transition-all duration-150
               text-slate-900 placeholder:text-slate-400
               focus:ring-2 focus:ring-primary-500 focus:border-primary-500
               disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-50"
        :class="[
          errorMessage ? 'border-red-400 focus:ring-red-400 focus:border-red-400' : 'border-slate-300',
          type === 'password' ? 'pr-10' : ''
        ]"
        :type="inputType"
        :value="modelValue"
        :placeholder="placeholder"
        :disabled="disabled"
        :required="required"
        :autocomplete="autocomplete"
        @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
        @focus="emit('focus', $event)"
        @blur="emit('blur',  $event)"
      />

      <!-- Password toggle -->
      <button
        v-if="type === 'password'"
        type="button"
        tabindex="-1"
        class="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
        @click="showPassword = !showPassword"
      >
        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <template v-if="showPassword">
            <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/>
            <line x1="1" y1="1" x2="23" y2="23"/>
          </template>
          <template v-else>
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
            <circle cx="12" cy="12" r="3"/>
          </template>
        </svg>
      </button>
    </div>

    <p v-if="errorMessage" class="text-xs text-red-500 flex items-center gap-1">
      <svg class="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
      {{ errorMessage }}
    </p>
    <p v-else-if="helpText" class="text-xs text-slate-400">{{ helpText }}</p>
  </div>
</template>
