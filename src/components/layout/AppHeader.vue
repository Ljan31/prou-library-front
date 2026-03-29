<script setup lang="ts">
import { ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { useAuthStore } from '@/store/auth.store'
import { useUiStore } from '@/store/ui.store'
import AppBreadcrumbs from '@/components/layout/AppBreadcrumbs.vue'

const auth = useAuthStore()
const ui = useUiStore()
const router = useRouter()

const userMenuOpen = ref(false)

async function handleLogout() {
  userMenuOpen.value = false
  await auth.logout()
  router.push('/login')
}

function closeUserMenu() {
  userMenuOpen.value = false
}
</script>

<template>
  <header
    class="h-16 bg-white border-b border-slate-100 flex items-center px-4 sm:px-6 gap-3 shrink-0 z-20 sticky top-0">

    <!-- Mobile menu button -->
    <button
      class="lg:hidden w-9 h-9 flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
      @click="ui.toggleMobileSidebar()">
      <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="3" y1="6" x2="21" y2="6" />
        <line x1="3" y1="12" x2="21" y2="12" />
        <line x1="3" y1="18" x2="21" y2="18" />
      </svg>
    </button>

    <!-- Breadcrumbs -->
    <AppBreadcrumbs class="flex-1 min-w-0" />

    <!-- Right side actions -->
    <div class="flex items-center gap-2">

      <!-- Notification bell -->
      <RouterLink to="/notificaciones"
        class="relative w-9 h-9 flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 transition-colors">
        <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" />
        </svg>
        <!-- Unread badge (placeholder – Equipo 3 conectará al backend) -->
        <span class="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full animate-pulse-dot" />
      </RouterLink>

      <!-- User menu trigger -->
      <div class="relative">
        <button class="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          @click="userMenuOpen = !userMenuOpen">
          <div
            class="w-7 h-7 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-semibold text-xs shrink-0">
            {{ auth.displayName.charAt(0).toUpperCase() }}
          </div>
          <span class="hidden sm:block text-sm font-medium text-slate-700 max-w-[120px] truncate">
            {{ auth.displayName }}
          </span>
          <svg class="w-4 h-4 text-slate-400 transition-transform" :class="userMenuOpen ? 'rotate-180' : ''"
            viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>

        <!-- Dropdown -->
        <Transition name="slide-up">
          <div v-if="userMenuOpen" v-click-outside="closeUserMenu"
            class="absolute right-0 top-full mt-1.5 w-56 bg-white rounded-xl border border-slate-100 shadow-lg py-1.5 z-50">
            <!-- User info -->
            <div class="px-3 py-2 border-b border-slate-100 mb-1">
              <p class="text-sm font-semibold text-slate-800 truncate">{{ auth.displayName }}</p>
              <p class="text-xs text-slate-400 truncate">{{ auth.user?.persona.email }}</p>
            </div>
            <RouterLink to="/perfil"
              class="flex items-center gap-2.5 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
              @click="closeUserMenu">
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              Mi Perfil
            </RouterLink>
            <button
              class="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
              @click="handleLogout">
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
              </svg>
              Cerrar Sesión
            </button>
          </div>
        </Transition>
      </div>
    </div>
  </header>
</template>
