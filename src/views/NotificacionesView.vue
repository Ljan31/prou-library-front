<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useUiStore } from '@/stores/ui.store'
import { useNotificacionStore } from '@/stores/notificacion.store'
import NotificacionItem from '@/components/notificaciones/NotificacionItem.vue'
import SCard from '@/components/ui/SCard.vue'
import SSpinner from '@/components/feedback/SSpinner.vue'
import SEmptyState from '@/components/feedback/SEmptyState.vue'
import SButton from '@/components/ui/SButton.vue'
import type { Notificacion } from '@/types/notificacion.types'

const ui = useUiStore()
const store = useNotificacionStore()
const router = useRouter()
const filtro = ref<'todas' | 'no-leidas'>('todas')

onMounted(() => {
  ui.setBreadcrumbs([{ label: 'Notificaciones' }])
  store.cargarBandeja(0)
})

function cambiarPagina(page: number) {
  store.cargarBandeja(page)
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function alHacerClic(notif: Notificacion) {
  if (!notif.leida) store.marcarLeida(notif.idNotificacion)
  if (notif.idReferencia) {
    const ruta = notif.tipoNotificacion === 'SANCION' ? '/sanciones' : `/prestamos/${notif.idReferencia}`
    router.push(ruta)
  }
}

const notificacionesFiltradas = computed(() => {
  if (filtro.value === 'no-leidas') return store.notificaciones.filter((n) => !n.leida)
  return store.notificaciones
})

const labelTipo: Record<string, string> = {
  RECORDATORIO_DEVOLUCION: 'Recordatorio',
  VENCIMIENTO: 'Vencimiento',
  RESERVA_DISPONIBLE: 'Reserva',
  SANCION: 'Sanción',
}

import { computed } from 'vue'
</script>

<template>
  <div class="page-container">
    <!-- Encabezado -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
      <div>
        <h1 class="text-xl font-semibold text-slate-900">Notificaciones</h1>
        <p class="text-sm text-slate-500 mt-0.5">Alertas, avisos y recordatorios del sistema</p>
      </div>

      <div class="flex items-center gap-2">
        <!-- Filtro tabs -->
        <div class="flex bg-slate-100 rounded-lg p-1 gap-1">
          <button class="px-3 py-1.5 text-sm font-medium rounded-md transition-all"
            :class="filtro === 'todas' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'"
            @click="filtro = 'todas'">
            Todas
          </button>
          <button class="px-3 py-1.5 text-sm font-medium rounded-md transition-all flex items-center gap-1.5"
            :class="filtro === 'no-leidas' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'"
            @click="filtro = 'no-leidas'">
            Sin leer
            <span v-if="store.tienePendientes"
              class="text-[10px] bg-red-500 text-white rounded-full px-1.5 py-0.5 font-bold">
              {{ store.badgeLabel }}
            </span>
          </button>
        </div>

        <SButton v-if="store.tienePendientes" variant="secondary" size="sm" @click="store.marcarTodasLeidas()">
          Marcar todo como leído
        </SButton>
      </div>
    </div>

    <!-- Contenido -->
    <SCard padding="none">
      <!-- Loading -->
      <div v-if="store.cargando" class="flex justify-center py-16">
        <SSpinner />
      </div>

      <!-- Vacío -->
      <div v-else-if="notificacionesFiltradas.length === 0" class="py-10">
        <SEmptyState title="Sin notificaciones"
          :description="filtro === 'no-leidas' ? 'No tienes notificaciones sin leer.' : 'No tienes notificaciones pendientes.'"
          icon="bell" />
      </div>

      <!-- Lista -->
      <div v-else>
        <TransitionGroup name="notif-list" tag="div" class="divide-y divide-slate-50">
          <div v-for="notif in notificacionesFiltradas" :key="notif.idNotificacion" class="px-2 py-1">
            <NotificacionItem :notificacion="notif" @click="alHacerClic" />
          </div>
        </TransitionGroup>

        <!-- Paginación -->
        <div v-if="store.paginacion.totalPages > 1"
          class="flex items-center justify-between px-4 py-3 border-t border-slate-100">
          <p class="text-xs text-slate-400">
            Página {{ store.paginacion.page + 1 }} de {{ store.paginacion.totalPages }}
            · {{ store.paginacion.totalElements }} notificaciones
          </p>
          <div class="flex gap-2">
            <SButton variant="secondary" size="sm" :disabled="store.paginacion.page === 0"
              @click="cambiarPagina(store.paginacion.page - 1)">
              Anterior
            </SButton>
            <SButton variant="secondary" size="sm" :disabled="store.paginacion.page + 1 >= store.paginacion.totalPages"
              @click="cambiarPagina(store.paginacion.page + 1)">
              Siguiente
            </SButton>
          </div>
        </div>
      </div>
    </SCard>
  </div>
</template>

<style scoped>
.notif-list-enter-active,
.notif-list-leave-active {
  transition: all 0.2s ease;
}

.notif-list-enter-from,
.notif-list-leave-to {
  opacity: 0;
  transform: translateX(-8px);
}
</style>