<script setup lang="ts">
import { computed } from 'vue'
import { RouterView } from 'vue-router'
import AppSidebar from '@/components/layout/AppSidebar.vue'
import AppHeader from '@/components/layout/AppHeader.vue'
import { useUiStore } from '@/stores/ui.store'

const ui = useUiStore()

const mainClass = computed(() => [
  'flex-1 flex flex-col min-h-screen transition-all duration-300 ease-in-out',
  ui.sidebarCollapsed ? 'lg:ml-[68px]' : 'lg:ml-[260px]'
])
</script>

<template>
  <div class="flex h-screen bg-slate-50 overflow-hidden">
    <!-- Sidebar -->
    <AppSidebar />

    <!-- Mobile overlay -->
    <Transition name="fade">
      <div v-if="ui.sidebarMobileOpen" class="fixed inset-0 bg-black/40 z-30 lg:hidden backdrop-blur-sm"
        @click="ui.closeMobileSidebar()" />
    </Transition>

    <!-- Main content area -->
    <div :class="mainClass">
      <!-- Header -->
      <AppHeader />

      <!-- Page content -->
      <main class="flex-1 overflow-y-auto">
        <RouterView v-slot="{ Component, route }">
          <Transition name="fade" mode="out-in">
            <component :is="Component" :key="route.path" />
          </Transition>
        </RouterView>
      </main>
    </div>
  </div>
</template>
