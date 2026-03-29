<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store'
const router = useRouter()
const auth = useAuthStore()
</script>

<template>
  <div class="min-h-screen bg-slate-50 flex items-center justify-center p-6">
    <div class="text-center max-w-sm">
      <div class="w-20 h-20 rounded-3xl bg-red-100 flex items-center justify-center mx-auto mb-6">
        <svg class="w-10 h-10 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="12" cy="12" r="10" />
          <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
        </svg>
      </div>
      <h1 class="text-4xl font-bold text-slate-900 mb-2">403</h1>
      <p class="text-lg font-medium text-slate-700 mb-1">Acceso denegado</p>
      <p class="text-sm text-slate-500 mb-8">
        No tienes permisos para ver esta página. Tu rol actual no tiene acceso a este módulo.
      </p>
      <div class="flex items-center justify-center gap-3">
        <button
          class="px-4 py-2 text-sm font-medium bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          @click="router.push('/dashboard')">
          Ir al Dashboard
        </button>
        <button
          class="px-4 py-2 text-sm font-medium border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
          @click="router.back()">
          Volver
        </button>
      </div>
      <p class="text-xs text-slate-400 mt-6">Rol actual: {{ auth.primaryRole ?? 'sin rol' }}</p>
    </div>
  </div>
</template>
