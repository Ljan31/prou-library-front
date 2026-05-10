<script setup lang="ts">
import { computed } from 'vue'
import { useMedia } from '@/composables/useMedia'
const props = defineProps<{
  modelValue: boolean
  url: string | null
}>()
const { getUrl } = useMedia()
const emit = defineEmits<{
  'update:modelValue': [boolean]
}>()

const isPdf = computed(() => {
  if (!props.url) return false

  return props.url.toLowerCase().includes('.pdf')
})

function close() {
  emit('update:modelValue', false)
}
</script>

<template>
  <Transition name="fade">
    <div v-if="modelValue"
      class="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      @click.self="close">
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden">

        <!-- Header -->
        <div class="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 class="text-sm font-semibold text-slate-900">
            Resolución / Respaldo
          </h3>

          <button
            class="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all"
            @click="close">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M6 18L18 6M6 6l12 12" stroke-linecap="round" />
            </svg>
          </button>
        </div>

        <!-- Content -->
        <div class="bg-slate-100 flex items-center justify-center p-4">

          <!-- PDF -->
          <iframe v-if="isPdf" :src="getUrl(url!)" class="w-full h-[60vh] rounded-xl bg-white" />

          <!-- Imagen -->
          <img v-else :src="getUrl(url!)" class="max-h-[60vh] max-w-full rounded-xl shadow" alt="Respaldo" />
        </div>

        <!-- Footer -->
        <div class="px-5 py-4 border-t border-slate-100 flex justify-end">
          <a v-if="url" :href="url" target="_blank"
            class="px-4 py-2 text-sm font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 transition-colors">
            Abrir en nueva pestaña
          </a>
        </div>

      </div>
    </div>
  </Transition>
</template>