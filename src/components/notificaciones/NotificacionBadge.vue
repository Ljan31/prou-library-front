<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { useNotificacionStore } from '@/stores/notificacion.store'

const store = useNotificacionStore()
let intervalo: ReturnType<typeof setInterval>

onMounted(() => {
  store.actualizarContador()
  intervalo = setInterval(store.actualizarContador, 60_000)
})

onUnmounted(() => clearInterval(intervalo))
</script>

<template>
  <button
    class="relative w-9 h-9 flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
    :aria-label="`Notificaciones${store.tienePendientes ? ` (${store.badgeLabel} sin leer)` : ''}`"
    @click.stop="store.toggleDropdown()">
    <!-- Campana -->
    <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 01-3.46 0" />
    </svg>

    <!-- Badge contador -->
    <Transition name="badge-pop">
      <span v-if="store.tienePendientes"
        class="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
        {{ store.badgeLabel }}
      </span>
    </Transition>
  </button>
</template>

<style scoped>
.badge-pop-enter-active {
  animation: badge-pop 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.badge-pop-leave-active {
  animation: badge-pop 0.15s ease-in reverse;
}

@keyframes badge-pop {
  from {
    transform: scale(0);
    opacity: 0;
  }

  to {
    transform: scale(1);
    opacity: 1;
  }
}
</style>