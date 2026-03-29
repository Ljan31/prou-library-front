<script setup lang="ts">
import { useRouter } from 'vue-router'
const router = useRouter()
</script>

<template>
  <div class="min-h-screen bg-slate-50 flex items-center justify-center p-6">
    <div class="text-center max-w-sm">
      <div class="w-20 h-20 rounded-3xl bg-slate-100 flex items-center justify-center mx-auto mb-6">
        <svg class="w-10 h-10 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
      </div>
      <h1 class="text-4xl font-bold text-slate-900 mb-2">404</h1>
      <p class="text-lg font-medium text-slate-700 mb-1">Página no encontrada</p>
      <p class="text-sm text-slate-500 mb-8">La ruta que intentas acceder no existe en el sistema.</p>
      <button
        class="px-4 py-2 text-sm font-medium bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        @click="router.push('/dashboard')"
      >
        Ir al Dashboard
      </button>
    </div>
  </div>
</template>
