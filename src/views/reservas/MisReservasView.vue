<script setup lang="ts">
/**
 * MisReservasView — Vista PROTEGIDA (requiere autenticación)
 * Rol: ESTUDIANTE, DOCENTE, ADMIN, BIBLIOTECARIO
 *
 * Muestra las reservas del usuario autenticado con acciones por estado.
 */
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useUiStore } from '@/stores/ui.store'
import { useReservasStore } from '@/stores/reservas.store'
import SButton from '@/components/ui/SButton.vue'
import SCard from '@/components/ui/SCard.vue'
import SSkeleton from '@/components/feedback/SSkeleton.vue'
import SEmptyState from '@/components/feedback/SEmptyState.vue'
import SBadge from '@/components/ui/SBadge.vue'
import ConfirmModal from '@/components/ui/ConfirmModal.vue'
import type { ReservaResponse } from '@/types/reservas'

const router = useRouter()
const ui = useUiStore()
const reservasStore = useReservasStore()

const mostrarConfirmCancelar = ref(false)
const reservaACancelar = ref<ReservaResponse | null>(null)
const cancelando = ref(false)

onMounted(async () => {
  ui.setBreadcrumbs([{ label: 'Mis Reservas' }])
  await reservasStore.cargarMisReservas()
})

// ─── Badge color por estado ───────────────────────────────────────────────
function variantBadge(estado: string) {
  const map: Record<string, string> = {
    ACTIVA: 'primary',
    NOTIFICADA: 'success',
    ATENDIDA: 'default',
    CANCELADA: 'danger',
    VENCIDA: 'warning',
  }
  return map[estado] ?? 'default'
}

function labelEstado(estado: string) {
  const map: Record<string, string> = {
    ACTIVA: 'En cola',
    NOTIFICADA: 'Listo para retiro',
    ATENDIDA: 'Retirado',
    CANCELADA: 'Cancelada',
    VENCIDA: 'Vencida',
  }
  return map[estado] ?? estado
}

// ─── Acciones ─────────────────────────────────────────────────────────────
function solicitarCancelacion(reserva: ReservaResponse) {
  reservaACancelar.value = reserva
  mostrarConfirmCancelar.value = true
}

async function confirmarCancelacion() {
  if (!reservaACancelar.value) return
  cancelando.value = true
  const ok = await reservasStore.cancelarReserva(reservaACancelar.value.idReserva)
  cancelando.value = false
  mostrarConfirmCancelar.value = false
  reservaACancelar.value = null
  if (ok) await reservasStore.cargarMisReservas()
}

function formatFecha(fecha: string | null) {
  if (!fecha) return '—'

  const [y, m, d] = fecha.split('T')[0].split('-').map(Number)
  const date = new Date(y, m - 1, d)

  return date.toLocaleDateString('es-BO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

</script>

<template>
  <div class="page-container">
    <!-- Header -->
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-2xl font-semibold text-slate-900">Mis Reservas</h1>
        <p class="text-sm text-slate-500 mt-0.5">
          Seguimiento de tus solicitudes de libros
        </p>
      </div>
      <SButton variant="primary" size="sm" @click="router.push('/catalogo')">
        + Nueva reserva
      </SButton>
    </div>

    <!-- Loading -->
    <div v-if="reservasStore.cargando" class="flex flex-col gap-3">
      <SSkeleton v-for="i in 4" :key="i" width="100%" height="88px" />
    </div>

    <!-- Error -->
    <div v-else-if="reservasStore.error" class="text-center py-12">
      <p class="text-red-500 text-sm">{{ reservasStore.error }}</p>
      <SButton variant="ghost" size="sm" class="mt-3" @click="reservasStore.cargarMisReservas()">
        Reintentar
      </SButton>
    </div>

    <!-- Sin reservas -->
    <SEmptyState v-else-if="!reservasStore.misReservas.length" title="Sin reservas"
      description="Aún no has reservado ningún libro. Explora el catálogo." icon="book">
      <template #action>
        <SButton variant="primary" size="sm" @click="router.push('/catalogo')">
          Ir al catálogo
        </SButton>
      </template>
    </SEmptyState>

    <!-- Reservas activas / notificadas -->
    <template v-else>
      <template v-if="reservasStore.reservasActivas.length">
        <h2 class="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
          Pendientes ({{ reservasStore.reservasActivas.length }})
        </h2>
        <div class="flex flex-col gap-3 mb-8">
          <SCard v-for="r in reservasStore.reservasActivas" :key="r.idReserva" variant="bordered" padding="md">
            <div class="flex items-start gap-4">
              <!-- Portada placeholder -->
              <div class="w-12 h-16 bg-indigo-50 rounded flex items-center justify-center shrink-0">
                <svg class="w-6 h-6 text-indigo-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                    d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>

              <div class="flex-1 min-w-0">
                <div class="flex items-start justify-between gap-2">
                  <p class="font-medium text-slate-900 text-sm leading-tight">{{ r.libroTitulo }}</p>
                  <SBadge :variant="variantBadge(r.estadoReserva)" size="sm">
                    {{ labelEstado(r.estadoReserva) }}
                  </SBadge>
                </div>
                <p class="text-xs text-slate-500 mt-1">{{ r.bibliotecaNombre }}</p>

                <!-- ACTIVA: posición en cola -->
                <div v-if="r.estadoReserva === 'ACTIVA'" class="mt-2 flex items-center gap-1.5">
                  <span class="text-xs text-slate-400">Posición en cola:</span>
                  <span class="text-xs font-semibold text-indigo-600">{{ r.prioridad }}</span>
                </div>

                <!-- NOTIFICADA: fecha límite -->
                <div v-if="r.estadoReserva === 'NOTIFICADA'" class="mt-2">
                  <div
                    class="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 text-xs px-2.5 py-1 rounded-full">
                    <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Retira antes del {{ formatFecha(r.fechaVencimientoReserva) }}
                  </div>
                  <p v-if="r.ejemplarCodigo" class="text-xs text-slate-500 mt-1">
                    Ejemplar: <span class="font-mono font-medium">{{ r.ejemplarCodigo }}</span>
                  </p>
                </div>
              </div>

              <!-- Acciones -->
              <div class="shrink-0">
                <SButton v-if="r.estadoReserva === 'ACTIVA' || r.estadoReserva === 'NOTIFICADA'" variant="ghost"
                  size="xs" @click="solicitarCancelacion(r)">
                  Cancelar
                </SButton>
              </div>
            </div>
          </SCard>
        </div>
      </template>

      <!-- Historial -->
      <template v-if="reservasStore.reservasHistorial.length">
        <h2 class="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
          Historial
        </h2>
        <div class="flex flex-col gap-2">
          <SCard v-for="r in reservasStore.reservasHistorial" :key="r.idReserva" padding="md" class="opacity-75">
            <div class="flex items-center gap-3">
              <div class="flex-1 min-w-0">
                <p class="font-medium text-slate-700 text-sm truncate">{{ r.libroTitulo }}</p>
                <p class="text-xs text-slate-400">{{ r.bibliotecaNombre }} · {{ formatFecha(r.fechaReserva) }}</p>
              </div>
              <SBadge :variant="variantBadge(r.estadoReserva)" size="sm">
                {{ labelEstado(r.estadoReserva) }}
              </SBadge>
              <!-- Enlace al préstamo si fue atendida -->
              <SButton v-if="r.estadoReserva === 'ATENDIDA' && r.prestamoId" variant="ghost" size="xs"
                @click="router.push(`/mis-prestamos`)">
                Ver préstamo
              </SButton>
            </div>
          </SCard>
        </div>
      </template>
    </template>

    <!-- Modal cancelar -->
    <ConfirmModal v-model="mostrarConfirmCancelar" title="¿Cancelar reserva?" variant="danger"
      confirm-label="Sí, cancelar" :loading="cancelando" @confirm="confirmarCancelacion">
      Se cancelará tu reserva de
      <span class="font-semibold text-slate-800">
        "{{ reservaACancelar?.libroTitulo }}"
      </span>
      en {{ reservaACancelar?.bibliotecaNombre }}.
    </ConfirmModal>
  </div>
</template>