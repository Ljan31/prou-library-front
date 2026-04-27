<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { useNotificacionStore } from '@/stores/notificacion.store'
import NotificacionItem from './NotificacionItem.vue'
import SSpinner from '@/components/feedback/SSpinner.vue'
import type { Notificacion } from '@/types/notificacion.types'

const store = useNotificacionStore()
const router = useRouter()
const dropdownRef = ref<HTMLElement | null>(null)

onMounted(() => store.cargarNoLeidas())

function alHacerClic(notif: Notificacion) {
  if (!notif.leida) store.marcarLeida(notif.idNotificacion)
  store.cerrarDropdown()
  if (notif.idReferencia) {
    const ruta = notif.tipoNotificacion === 'SANCION'
      ? `/sanciones`
      : `/prestamos/${notif.idReferencia}`
    router.push(ruta)
  }
}

function irABandeja() {
  store.cerrarDropdown()
  router.push('/notificaciones')
}

function handleClickOutside(event: MouseEvent) {
  if (!dropdownRef.value) return

  if (!dropdownRef.value.contains(event.target as Node)) {
    store.cerrarDropdown()
  }
}
onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<template>
  <Transition name="dropdown-fade">
    <div v-if="store.dropdownAbierto" ref="dropdownRef"
      class="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl border border-slate-100 shadow-xl overflow-hidden z-50">
      <!-- Header -->
      <div class="flex items-center justify-between px-3 py-2.5 border-b border-slate-100">
        <div class="flex items-center gap-2">
          <span class="text-sm font-semibold text-slate-800">Notificaciones</span>
          <span v-if="store.tienePendientes"
            class="text-[10px] font-bold bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-full">
            {{ store.badgeLabel }} nuevas
          </span>
        </div>
        <button v-if="store.tienePendientes"
          class="text-xs text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
          @click="store.marcarTodasLeidas()">
          Marcar todo
        </button>
      </div>

      <!-- Lista -->
      <div class="max-h-80 overflow-y-auto">
        <div v-if="store.cargando" class="flex justify-center py-6">
          <SSpinner size="sm" />
        </div>

        <div v-else-if="store.noLeidas.length === 0" class="py-8 text-center">
          <div class="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-2">
            <svg class="w-5 h-5 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              stroke-width="1.5">
              <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" stroke-linecap="round" />
            </svg>
          </div>
          <p class="text-sm text-slate-500 font-medium">Sin notificaciones nuevas</p>
          <p class="text-xs text-slate-400 mt-0.5">Estás al día</p>
        </div>

        <div v-else class="py-1">
          <NotificacionItem v-for="notif in store.noLeidas" :key="notif.idNotificacion" :notificacion="notif" compact
            @click="alHacerClic" />
        </div>
      </div>

      <!-- Footer -->
      <div class="border-t border-slate-100">
        <button class="w-full py-2.5 text-sm text-indigo-600 hover:bg-indigo-50 font-medium transition-colors"
          @click="irABandeja">
          Ver todas las notificaciones
        </button>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.dropdown-fade-enter-active {
  animation: dropdown-in 0.18s cubic-bezier(0.16, 1, 0.3, 1);
}

.dropdown-fade-leave-active {
  animation: dropdown-in 0.12s ease-in reverse;
}

@keyframes dropdown-in {
  from {
    opacity: 0;
    transform: translateY(-6px) scale(0.97);
  }

  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}
</style>