<script setup lang="ts">
import { reactive } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store'
import { useUiStore } from '@/stores/ui.store'
import logoFHCE from '@/assets/logoumsa.png'

const auth   = useAuthStore()
const ui     = useUiStore()
const router = useRouter()
const route  = useRoute()

const form   = reactive({ username: '', password: '' })
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
  <div class="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-950 flex">

    <!-- ── Panel izquierdo: branding ──────────────────────────────────── -->
    <div class="hidden lg:flex lg:w-[52%] flex-col justify-between p-14 relative overflow-hidden">

      <!-- Blobs decorativos -->
      <div class="absolute top-0 left-0 w-[500px] h-[500px] bg-indigo-600/10 rounded-full -translate-x-1/2 -translate-y-1/2 blur-3xl pointer-events-none" />
      <div class="absolute bottom-0 right-0 w-96 h-96 bg-violet-600/8 rounded-full translate-x-1/3 translate-y-1/3 blur-3xl pointer-events-none" />
      <!-- Grid sutil -->
      <div class="absolute inset-0 bg-[linear-gradient(rgba(99,102,241,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(99,102,241,0.03)_1px,transparent_1px)] bg-[size:48px_48px] pointer-events-none" />

      <!-- Logo UMSA -->
      <div class="relative z-10 flex flex-col gap-5">
        <img :src="logoFHCE" alt="FHCE UMSA" class="h-20 w-auto opacity-75 self-start" />
        <!-- Chip SIGEB -->
        <div class="flex items-center gap-3 w-fit">
          <div class="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-900/50">
            <svg class="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M4 19.5A2.5 2.5 0 016.5 17H20" />
              <path stroke-linecap="round" stroke-linejoin="round" d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
            </svg>
          </div>
          <div>
            <p class="text-white font-bold text-xl leading-tight tracking-tight">SIGEB</p>
            <p class="text-indigo-300 text-xs">Sistema de Gestión Bibliográfica</p>
          </div>
        </div>
      </div>

      <!-- Hero text -->
      <div class="relative z-10 space-y-6">
        <div class="space-y-3">
          <div class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20">
            <span class="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
            <span class="text-xs text-indigo-300 font-medium">Facultad de Humanidades · UMSA</span>
          </div>
          <h1 class="text-5xl text-white font-bold leading-[1.15] tracking-tight">
            Gestiona tu<br />
            <span class="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-violet-400">biblioteca</span><br />
            con precisión
          </h1>
          <p class="text-slate-400 text-base leading-relaxed max-w-sm">
            Plataforma centralizada para la administración de catálogos, préstamos y certificaciones bibliográficas.
          </p>
        </div>

        <!-- Feature chips -->
        <div class="flex flex-wrap gap-2">
          <span v-for="f in ['Catálogo', 'Préstamos', 'Devoluciones', 'Certificados', 'Reportes']" :key="f"
            class="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-slate-300">
            <span class="w-1 h-1 rounded-full bg-indigo-400" />
            {{ f }}
          </span>
        </div>

        <!-- Stats pill -->
        <!-- <div class="flex items-center gap-6 p-4 rounded-2xl bg-white/4 border border-white/8 w-fit">
          <div class="text-center">
            <p class="text-2xl font-bold text-white">8</p>
            <p class="text-xs text-slate-400 mt-0.5">Bibliotecas</p>
          </div>
          <div class="w-px h-8 bg-white/10" />
          <div class="text-center">
            <p class="text-2xl font-bold text-white">+</p>
            <p class="text-xs text-slate-400 mt-0.5">Carreras</p>
          </div>
          <div class="w-px h-8 bg-white/10" />
          <div class="text-center">
            <p class="text-2xl font-bold text-white">3</p>
            <p class="text-xs text-slate-400 mt-0.5">Roles</p>
          </div>
        </div> -->
      </div>

      <!-- Footer -->
      <p class="text-slate-600 text-xs relative z-10">
        Facultad de Humanidades y Ciencias de la Educación · UMSA · v1.0
      </p>
    </div>

    <!-- ── Panel derecho: formulario ──────────────────────────────────── -->
    <div class="flex-1 flex items-center justify-center p-6 lg:p-12 relative">

      <!-- Blob derecho -->
      <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-600/5 rounded-full blur-3xl pointer-events-none" />

      <div class="relative w-full max-w-sm space-y-5">

        <!-- Logo móvil -->
        <div class="flex items-center gap-2.5 lg:hidden">
          <div class="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
            <svg class="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M4 19.5A2.5 2.5 0 016.5 17H20" />
              <path stroke-linecap="round" stroke-linejoin="round" d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
            </svg>
          </div>
          <span class="text-white font-bold text-lg tracking-tight">SIGEB</span>
        </div>

        <!-- Card formulario -->
        <div class="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-8 backdrop-blur-xl shadow-2xl shadow-black/20">

          <!-- Header -->
          <div class="mb-7">
            <h2 class="text-2xl font-semibold text-white tracking-tight">Iniciar sesión</h2>
            <p class="text-slate-400 text-sm mt-1">Ingresa tus credenciales institucionales</p>
          </div>

          <form class="space-y-4" @submit.prevent="handleLogin">

            <!-- Usuario -->
            <div class="space-y-1.5">
              <label class="block text-xs font-semibold text-slate-300 uppercase tracking-wide">
                Usuario <span class="text-indigo-400">*</span>
              </label>
              <div class="relative">
                <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none"
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <input v-model="form.username" type="text" placeholder="nombre.apellido"
                  autocomplete="username"
                  class="w-full h-11 pl-10 pr-4 text-sm rounded-xl border text-white placeholder:text-slate-600 bg-white/5 outline-none transition-all duration-150 focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500/50"
                  :class="errors.username ? 'border-red-500/60 bg-red-500/5' : 'border-white/10'"
                  @input="errors.username = ''" />
              </div>
              <p v-if="errors.username" class="text-xs text-red-400 flex items-center gap-1">
                <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v4m0 4h.01" />
                  <path stroke-linecap="round" stroke-linejoin="round" d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
                {{ errors.username }}
              </p>
            </div>

            <!-- Contraseña -->
            <div class="space-y-1.5">
              <label class="block text-xs font-semibold text-slate-300 uppercase tracking-wide">
                Contraseña <span class="text-indigo-400">*</span>
              </label>
              <div class="relative">
                <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none"
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <input v-model="form.password" type="password" placeholder="••••••••"
                  autocomplete="current-password"
                  class="w-full h-11 pl-10 pr-4 text-sm rounded-xl border text-white placeholder:text-slate-600 bg-white/5 outline-none transition-all duration-150 focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500/50"
                  :class="errors.password ? 'border-red-500/60 bg-red-500/5' : 'border-white/10'"
                  @input="errors.password = ''" />
              </div>
              <p v-if="errors.password" class="text-xs text-red-400 flex items-center gap-1">
                <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v4m0 4h.01" />
                  <path stroke-linecap="round" stroke-linejoin="round" d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
                {{ errors.password }}
              </p>
            </div>

            <!-- Botón submit -->
            <button type="submit" :disabled="auth.loading"
              class="mt-2 w-full h-11 flex items-center justify-center gap-2 text-sm font-semibold rounded-xl bg-indigo-600 text-white hover:bg-indigo-500 active:bg-indigo-700 transition-all duration-150 shadow-lg shadow-indigo-900/40 disabled:opacity-60 disabled:cursor-not-allowed">
              <svg v-if="auth.loading" class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <svg v-else class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
              </svg>
              {{ auth.loading ? 'Verificando...' : 'Ingresar al sistema' }}
            </button>
          </form>
        </div>

        <!-- Acciones secundarias -->
        <div class="space-y-2">
          <button
            class="w-full h-10 rounded-xl border border-white/10 text-slate-300 text-sm font-medium hover:bg-white/5 hover:border-white/20 transition-all flex items-center justify-center gap-2"
            @click="router.push('/catalogo-reservas')">
            <svg class="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            Ver catálogo público
          </button>
          <button
            class="w-full h-10 rounded-xl border border-indigo-500/25 text-indigo-300 text-sm font-medium hover:bg-indigo-500/10 hover:border-indigo-500/40 transition-all flex items-center justify-center gap-2"
            @click="router.push('/solicitar-certificado')">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
            </svg>
            Solicitar certificado de no deuda
          </button>
        </div>

        <!-- Registro -->
        <p class="text-center text-sm text-slate-500">
          ¿Eres estudiante y no tienes cuenta?
          <button class="text-indigo-400 hover:text-indigo-300 font-medium transition-colors ml-1"
            @click="router.push('/register')">
            Regístrate aquí
          </button>
        </p>

        <p class="text-center text-xs text-slate-700">SIGEB v1.0 · UMSA Facultad de Humanidades</p>
      </div>
    </div>

  </div>
</template>