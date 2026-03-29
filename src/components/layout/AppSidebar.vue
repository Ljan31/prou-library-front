<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { useAuthStore } from '@/store/auth.store'
import { useUiStore } from '@/store/ui.store'
import { NAV_ITEMS } from '@/router/nav.config'
import SidebarIcon from '@/components/layout/SidebarIcon.vue'
import type { RoleKey } from '@/types'

const auth = useAuthStore()
const ui = useUiStore()
const route = useRoute()

// Filter nav items the current user can see
const visibleItems = computed(() =>
  NAV_ITEMS.filter(item => auth.hasAnyRole(item.roles as RoleKey[]))
)

const isActive = (to: string) =>
  route.path === to || route.path.startsWith(to + '/')

const roleLabel: Record<RoleKey, string> = {
  ROLE_ADMIN: 'Administrador',
  ROLE_BIBLIOTECARIO: 'Bibliotecario',
  ROLE_ESTUDIANTE: 'Estudiante'
}

const roleColor: Record<RoleKey, string> = {
  ROLE_ADMIN: 'bg-violet-100 text-violet-700',
  ROLE_BIBLIOTECARIO: 'bg-sky-100 text-sky-700',
  ROLE_ESTUDIANTE: 'bg-emerald-100 text-emerald-700'
}

const sidebarClass = computed(() => [
  'fixed left-0 top-0 h-full z-40 flex flex-col',
  'bg-white border-r border-slate-100',
  'transition-all duration-300 ease-in-out',
  // Desktop
  ui.sidebarCollapsed ? 'lg:w-[68px]' : 'lg:w-[260px]',
  // Mobile: slide in/out
  ui.sidebarMobileOpen
    ? 'translate-x-0 w-[260px]'
    : '-translate-x-full lg:translate-x-0'
])
</script>

<template>
  <aside :class="sidebarClass" style="box-shadow: 4px 0 24px rgba(0,0,0,0.06)">

    <!-- Logo -->
    <div class="flex items-center gap-3 px-4 h-16 border-b border-slate-100 shrink-0">
      <div class="w-8 h-8 rounded-lg bg-primary-600 flex items-center justify-center shrink-0">
        <svg class="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
        </svg>
      </div>
      <Transition name="fade">
        <div v-if="!ui.sidebarCollapsed" class="overflow-hidden">
          <p class="font-display text-slate-900 font-semibold text-sm leading-tight">SIGEB</p>
          <p class="text-[10px] text-slate-400 leading-tight">UMSA – Humanidades</p>
        </div>
      </Transition>
      <!-- Collapse toggle (desktop only) -->
      <button
        class="ml-auto hidden lg:flex w-6 h-6 items-center justify-center rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors shrink-0"
        :title="ui.sidebarCollapsed ? 'Expandir' : 'Colapsar'" @click="ui.toggleSidebar()">
        <svg class="w-4 h-4 transition-transform duration-300" :class="ui.sidebarCollapsed ? 'rotate-180' : ''"
          viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </button>
    </div>

    <!-- User info pill -->
    <Transition name="fade">
      <div v-if="!ui.sidebarCollapsed" class="px-4 py-3 border-b border-slate-100 shrink-0">
        <div class="flex items-center gap-2.5">
          <div
            class="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-semibold text-xs shrink-0">
            {{ auth.displayName.charAt(0).toUpperCase() }}
          </div>
          <div class="min-w-0 flex-1">
            <p class="text-sm font-medium text-slate-800 truncate leading-tight">{{ auth.displayName }}</p>
            <span v-if="auth.primaryRole"
              class="inline-block text-[10px] font-medium px-1.5 py-0.5 rounded-full leading-tight mt-0.5"
              :class="roleColor[auth.primaryRole]">
              {{ roleLabel[auth.primaryRole] }}
            </span>
          </div>
        </div>
        <p v-if="auth.bibliotecaNombre" class="mt-2 text-[11px] text-slate-400 flex items-center gap-1">
          <svg class="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
          </svg>
          <span class="truncate">{{ auth.bibliotecaNombre }}</span>
        </p>
      </div>
    </Transition>

    <!-- Navigation -->
    <nav class="flex-1 overflow-y-auto py-3 px-2">
      <ul class="space-y-0.5">
        <li v-for="item in visibleItems" :key="item.to">
          <RouterLink :to="item.to"
            class="flex items-center gap-3 px-2.5 py-2 rounded-lg text-sm font-medium transition-all duration-150 group relative"
            :class="isActive(item.to)
              ? 'bg-primary-50 text-primary-700'
              : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'"
            :title="ui.sidebarCollapsed ? item.label : undefined" @click="ui.closeMobileSidebar()">
            <!-- Active indicator bar -->
            <span v-if="isActive(item.to)"
              class="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-primary-600 rounded-r-full" />
            <SidebarIcon :name="item.icon" class="w-5 h-5 shrink-0" />
            <Transition name="fade">
              <span v-if="!ui.sidebarCollapsed" class="truncate">{{ item.label }}</span>
            </Transition>
          </RouterLink>
        </li>
      </ul>
    </nav>

    <!-- Bottom: Logout -->
    <div class="border-t border-slate-100 p-2 shrink-0">
      <button
        class="w-full flex items-center gap-3 px-2.5 py-2 rounded-lg text-sm font-medium text-slate-500 hover:bg-red-50 hover:text-red-600 transition-colors"
        :title="ui.sidebarCollapsed ? 'Cerrar Sesión' : undefined" @click="auth.logout()">
        <svg class="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
        </svg>
        <Transition name="fade">
          <span v-if="!ui.sidebarCollapsed">Cerrar Sesión</span>
        </Transition>
      </button>
    </div>

  </aside>
</template>
