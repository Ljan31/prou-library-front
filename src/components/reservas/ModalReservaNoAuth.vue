<script setup lang="ts">
import SButton from '@/components/ui/SButton.vue'

defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'login'): void
  (e: 'register'): void
}>()
</script>

<template>
  <div v-if="visible" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
    <div class="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">

      <div class="flex items-start gap-3">
        <div class="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center">
          <svg class="w-6 h-6 text-primary-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M5.121 17.804A9 9 0 1118.364 4.56" />
          </svg>
        </div>

        <div class="flex-1">
          <h3 class="text-lg font-semibold text-slate-900">
            Inicia sesión para reservar
          </h3>

          <p class="text-sm text-slate-600 mt-2">
            Para reservar el libro debes registrarte o iniciar sesión.
          </p>
        </div>
      </div>

      <div class="mt-6 flex justify-end gap-3">
        <SButton variant="ghost" @click="emit('close')">
          Cancelar
        </SButton>

        <SButton variant="secondary" @click="emit('register')">
          Registrarse
        </SButton>

        <SButton variant="primary" @click="emit('login')">
          Iniciar sesión
        </SButton>
      </div>

    </div>
  </div>
</template>