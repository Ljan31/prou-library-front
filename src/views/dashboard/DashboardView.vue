<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useAuthStore } from '@/store/auth.store'
import { useUiStore } from '@/store/ui.store'
import SCard from '@/components/ui/SCard.vue'
import SBadge from '@/components/ui/SBadge.vue'
import SSkeleton from '@/components/feedback/SSkeleton.vue'

const auth = useAuthStore()
const ui = useUiStore()

onMounted(() => ui.setBreadcrumbs([{ label: 'Dashboard' }]))

// Role-specific greeting
const greeting = computed(() => {
  const hour = new Date().getHours()
  if (hour < 12) return 'Buenos días'
  if (hour < 19) return 'Buenas tardes'
  return 'Buenas noches'
})

// Stat cards vary by role
const statCards = computed(() => {
  const base = [
    { label: 'Libros en catálogo', value: '—', icon: 'book', color: 'bg-primary-50 text-primary-600' },
    { label: 'Préstamos activos', value: '—', icon: 'clock', color: 'bg-amber-50 text-amber-600' },
    { label: 'Devoluciones hoy', value: '—', icon: 'check', color: 'bg-emerald-50 text-emerald-600' }
  ]
  if (auth.isAdmin || auth.isBibliotecario) {
    base.push({ label: 'Usuarios registrados', value: '—', icon: 'users', color: 'bg-blue-50 text-blue-600' })
  }
  return base
})

const quickLinks = computed(() => {
  if (auth.isAdmin) return [
    { label: 'Gestionar usuarios', to: '/usuarios', icon: 'users' },
    { label: 'Ver bibliotecas', to: '/bibliotecas', icon: 'lib' },
    { label: 'Ver reportes', to: '/reportes', icon: 'chart' },
    { label: 'Catálogo', to: '/catalogo', icon: 'book' }
  ]
  if (auth.isBibliotecario) return [
    { label: 'Nuevo préstamo', to: '/prestamos', icon: 'plus' },
    { label: 'Devoluciones', to: '/devoluciones', icon: 'return' },
    { label: 'Inventario', to: '/inventario', icon: 'box' },
    { label: 'Catálogo', to: '/catalogo', icon: 'book' }
  ]
  return [
    { label: 'Explorar catálogo', to: '/catalogo', icon: 'book' },
    { label: 'Mis préstamos', to: '/mis-prestamos', icon: 'bookmark' },
    { label: 'Certificado', to: '/certificados', icon: 'doc' }
  ]
})
</script>

<template>
  <div class="page-container">

    <!-- Welcome header -->
    <div class="mb-7">
      <div class="flex items-start justify-between gap-4">
        <div>
          <h1 class="text-2xl font-semibold text-slate-900">
            {{ greeting }}, <span class="text-primary-600">{{ auth.user?.persona.nombre }}</span> 👋
          </h1>
          <p class="text-slate-500 text-sm mt-1">
            <template v-if="auth.isAdmin">Panel de administración · Acceso completo al sistema</template>
            <template v-else-if="auth.isBibliotecario">
              Biblioteca: <strong class="text-slate-700">{{ auth.bibliotecaNombre ?? '–' }}</strong>
            </template>
            <template v-else>Panel de estudiante · Consultas y préstamos personales</template>
          </p>
        </div>
        <SBadge :variant="auth.isAdmin ? 'primary' : auth.isBibliotecario ? 'info' : 'success'" :dot="true">
          {{ auth.isAdmin ? 'Administrador' : auth.isBibliotecario ? 'Bibliotecario' : 'Estudiante' }}
        </SBadge>
      </div>
    </div>

    <!-- Stats -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-7">
      <SCard v-for="(stat, i) in statCards" :key="i" padding="md">
        <div class="flex items-start justify-between">
          <div>
            <p class="text-xs text-slate-500 font-medium">{{ stat.label }}</p>
            <p class="text-2xl font-bold text-slate-900 mt-1">{{ stat.value }}</p>
          </div>
          <div class="w-9 h-9 rounded-lg flex items-center justify-center" :class="stat.color">
            <!-- icon placeholder -->
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="5" />
            </svg>
          </div>
        </div>
        <p class="text-xs text-slate-400 mt-2">Datos en tiempo real del backend</p>
      </SCard>
    </div>

    <!-- Quick access -->
    <div class="mb-7">
      <h2 class="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Acceso rápido</h2>
      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        <RouterLink v-for="link in quickLinks" :key="link.to" :to="link.to"
          class="flex items-center gap-3 px-4 py-3.5 rounded-xl bg-white border border-slate-100 hover:border-primary-200 hover:shadow-sm transition-all duration-150 group">
          <div
            class="w-8 h-8 rounded-lg bg-primary-50 flex items-center justify-center text-primary-600 group-hover:bg-primary-100 transition-colors">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </div>
          <span class="text-sm font-medium text-slate-700 group-hover:text-primary-700 transition-colors">
            {{ link.label }}
          </span>
        </RouterLink>
      </div>
    </div>

    <!-- Info notice for teams 2 & 3 -->
    <SCard padding="md" variant="bordered">
      <div class="flex items-start gap-3">
        <div class="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <div>
          <p class="text-sm font-semibold text-slate-800">Base de arquitectura lista ✅</p>
          <p class="text-xs text-slate-500 mt-0.5 leading-relaxed">
            Auth real con JWT, Pinia stores, router guards por rol, layout dinámico y design tokens configurados.
            Los Equipos 2 y 3 pueden construir sus módulos sobre esta base.
          </p>
        </div>
      </div>
    </SCard>

  </div>
</template>
