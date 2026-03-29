<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store'
import { useUiStore } from '@/stores/ui.store'
import SButton from '@/components/ui/SButton.vue'
import SInput from '@/components/ui/SInput.vue'

const auth = useAuthStore()
const ui = useUiStore()
const router = useRouter()
const route = useRoute()

const form = reactive({ username: '', password: '' })
const errors = reactive({ username: '', password: '' })

function validate(): boolean {
  errors.username = form.username.trim() ? '' : 'El usuario es requerido'
  errors.password = form.password.trim() ? '' : 'La contraseña es requerida'
  return !errors.username && !errors.password
}

async function handleLogin() {
  if (!validate()) return

  const ok = await auth.login({ username: form.username, password: form.password })

  if (ok) {
    ui.toast.success('Bienvenido', `Hola, ${auth.displayName}`)
    const redirect = route.query.redirect as string | undefined
    router.push(redirect ?? '/dashboard')
  } else {
    ui.toast.error('Error de acceso', auth.error ?? 'Credenciales incorrectas')
  }
}
</script>

<template>
  <div class="min-h-screen bg-linear-to-br from-slate-900 via-primary-950 to-slate-900 flex">

    <!-- Left panel: branding -->
    <div class="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 relative overflow-hidden">
      <!-- Decorative circles -->
      <div
        class="absolute top-0 left-0 w-96 h-96 bg-primary-500/10 rounded-full -translate-x-1/2 -translate-y-1/2 blur-3xl pointer-events-none" />
      <div
        class="absolute bottom-0 right-0 w-80 h-80 bg-indigo-500/10 rounded-full translate-x-1/3 translate-y-1/3 blur-3xl pointer-events-none" />

      <!-- Logo -->
      <div class="flex items-center gap-3 relative z-10">
        <div class="w-10 h-10 rounded-xl bg-primary-500 flex items-center justify-center shadow-lg">
          <svg class="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
          </svg>
        </div>
        <div>
          <p class="font-display text-white font-bold text-xl leading-tight">SIGEB</p>
          <p class="text-primary-300 text-xs leading-tight">Sistema de Gestión Bibliográfica</p>
        </div>
      </div>

      <!-- Center text -->
      <div class="relative z-10">
        <h1 class="font-display text-5xl text-white font-bold leading-tight mb-4">
          Gestiona tu<br />
          <span class="text-primary-400">biblioteca</span><br />
          con precisión
        </h1>
        <p class="text-slate-400 text-base leading-relaxed max-w-sm">
          Plataforma centralizada para la administración de catálogos, préstamos y certificaciones bibliográficas de la
          Facultad.
        </p>

        <!-- Feature chips -->
        <div class="flex flex-wrap gap-2 mt-8">
          <span v-for="f in ['Préstamos', 'Catálogo', 'Certificados', 'Reportes']" :key="f"
            class="text-xs px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-slate-300">
            {{ f }}
          </span>
        </div>
      </div>

      <!-- Footer -->
      <p class="text-slate-600 text-xs relative z-10">
        Facultad de Humanidades y Ciencias de la Educación · UMSA
      </p>
    </div>

    <!-- Right panel: form -->
    <div class="flex-1 flex items-center justify-center p-6 lg:p-12">
      <div class="w-full max-w-md">

        <!-- Mobile logo -->
        <div class="flex items-center gap-2.5 mb-8 lg:hidden">
          <div class="w-8 h-8 rounded-lg bg-primary-500 flex items-center justify-center">
            <svg class="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
            </svg>
          </div>
          <span class="font-display text-white font-bold text-lg">SIGEB</span>
        </div>

        <!-- Card -->
        <div class="bg-white/4 border border-white/10 rounded-2xl p-8 backdrop-blur-sm">
          <div class="mb-7">
            <h2 class="text-2xl font-semibold text-white mb-1.5">Iniciar sesión</h2>
            <p class="text-slate-400 text-sm">Ingresa tus credenciales institucionales</p>
          </div>

          <form class="space-y-4" @submit.prevent="handleLogin">
            <!-- Username -->
            <div class="flex flex-col gap-1">
              <label class="text-sm font-medium text-slate-300">
                Usuario <span class="text-red-400">*</span>
              </label>
              <input v-model="form.username" type="text" placeholder="nombre.apellido" autocomplete="username" class="h-10 px-3 text-sm rounded-lg bg-white/6 border text-white placeholder:text-slate-500
                       outline-none transition-all duration-150
                       focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50"
                :class="errors.username ? 'border-red-500/60' : 'border-white/10'" @input="errors.username = ''" />
              <p v-if="errors.username" class="text-xs text-red-400">{{ errors.username }}</p>
            </div>

            <!-- Password -->
            <div class="flex flex-col gap-1">
              <label class="text-sm font-medium text-slate-300">
                Contraseña <span class="text-red-400">*</span>
              </label>
              <input v-model="form.password" type="password" placeholder="••••••••" autocomplete="current-password"
                class="h-10 px-3 text-sm rounded-lg bg-white/6 border text-white placeholder:text-slate-500
                       outline-none transition-all duration-150
                       focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50"
                :class="errors.password ? 'border-red-500/60' : 'border-white/10'" @input="errors.password = ''" />
              <p v-if="errors.password" class="text-xs text-red-400">{{ errors.password }}</p>
            </div>

            <!-- Error alert -->
            <Transition name="slide-up">
              <div v-if="auth.error"
                class="flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                <svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                {{ auth.error }}
              </div>
            </Transition>

            <!-- Submit -->
            <button type="submit" :disabled="auth.loading" class="w-full h-10 flex items-center justify-center gap-2 text-sm font-semibold
                     rounded-lg bg-primary-600 text-white hover:bg-primary-500 active:bg-primary-700
                     transition-all duration-150 shadow-lg shadow-primary-900/30
                     disabled:opacity-60 disabled:cursor-not-allowed mt-2">
              <svg v-if="auth.loading" class="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none"
                viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              {{ auth.loading ? 'Verificando...' : 'Ingresar' }}
            </button>
          </form>
        </div>

        <p class="text-center text-xs text-slate-600 mt-5">
          SIGEB v1.0 · UMSA Facultad de Humanidades
        </p>
      </div>
    </div>

  </div>
</template>
