<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { useUiStore } from '@/stores/ui.store'
import { useAuthStore } from '@/stores/auth.store'
import { useSancionStore } from '@/stores/sancion.store'
import { usePermissions } from '@/composables/usePermissions'
import SCard from '@/components/ui/SCard.vue'
import SButton from '@/components/ui/SButton.vue'
import SSpinner from '@/components/feedback/SSpinner.vue'
import SEmptyState from '@/components/feedback/SEmptyState.vue'
import SSkeleton from '@/components/feedback/SSkeleton.vue'
import SBadge from '@/components/ui/SBadge.vue'
import SancionBadge from '@/components/sanciones/SancionBadge.vue'
import ModalPago from '@/components/sanciones/ModalPago.vue'
import ModalCondonar from '@/components/sanciones/ModalCondonar.vue'
import ModalSancionManual from '@/components/sanciones/ModalSancionManual.vue'
import type { SancionResponse, EstadoSancion } from '@/types/notificacion.types'

const ui = useUiStore()
const auth = useAuthStore()
const store = useSancionStore()
const { isAdmin } = usePermissions()

const sancionSeleccionada = ref<SancionResponse | null>(null)
const modalPagoAbierto = ref(false)
const modalCondonarAbierto = ref(false)
const modalManualAbierto = ref(false)

const ESTADOS: { value: EstadoSancion; label: string }[] = [
  { value: 'ACTIVA', label: 'Activas' },
  { value: 'PAGADA', label: 'Pagadas' },
  { value: 'CONDONADA', label: 'Condonadas' },
]

onMounted(() => {
  ui.setBreadcrumbs([{ label: 'Sanciones' }])
  cargar()
})

function cargar() {
  const bibId = auth.user?.biblioteca?.[0]?.id_biblioteca
  if (bibId) store.cargarPorBiblioteca(bibId, store.filtroEstado)
}

function cambiarEstado(estado: EstadoSancion) {
  const bibId = auth.user?.biblioteca?.[0]?.id_biblioteca
  if (bibId) store.cargarPorBiblioteca(bibId, estado)
}

function abrirPago(s: SancionResponse) {
  sancionSeleccionada.value = s
  modalPagoAbierto.value = true
}

function abrirCondonar(s: SancionResponse) {
  sancionSeleccionada.value = s
  modalCondonarAbierto.value = true
}

function formatFecha(f: string | null) {
  if (!f) return '—'
  const [y, m, d] = f.split('T')[0].split('-')
  return `${d}/${m}/${y}`
}

// Métricas resumen
const totalActivas = computed(() => store.sanciones.filter((s) => s.estado === 'ACTIVA').length)
const totalMonto = computed(() =>
  store.sanciones
    .filter((s) => s.estado === 'ACTIVA')
    .reduce((acc, s) => acc + (s.montoMulta ?? 0), 0)
)
const totalSuspensiones = computed(() =>
  store.sanciones.filter((s) => s.suspensionVigente).length
)
</script>

<template>
  <div>
    <div class="page-container space-y-6">

      <!-- Header -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 class="text-xl font-semibold text-slate-900">Sanciones</h1>
          <p class="text-sm text-slate-500 mt-0.5">Gestión de multas y suspensiones de la biblioteca</p>
        </div>
        <SButton variant="danger" icon-left="plus" @click="modalManualAbierto = true">
          Nueva sanción
        </SButton>
      </div>

      <!-- Métricas -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SCard padding="md">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
              <svg class="w-5 h-5 text-red-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>
            <div>
              <p class="text-xs text-slate-500 font-medium">Sanciones activas</p>
              <SSkeleton v-if="store.cargando" width="3rem" height="1.5rem" class="mt-0.5" />
              <p v-else class="text-2xl font-bold text-red-600">{{ totalActivas }}</p>
            </div>
          </div>
        </SCard>

        <SCard padding="md">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
              <svg class="w-5 h-5 text-amber-600" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                stroke-width="2">
                <line x1="12" y1="1" x2="12" y2="23" />
                <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
              </svg>
            </div>
            <div>
              <p class="text-xs text-slate-500 font-medium">Total en multas (Bs)</p>
              <SSkeleton v-if="store.cargando" width="4rem" height="1.5rem" class="mt-0.5" />
              <p v-else class="text-2xl font-bold text-amber-600">{{ totalMonto.toFixed(2) }}</p>
            </div>
          </div>
        </SCard>

        <SCard padding="md">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
              <svg class="w-5 h-5 text-red-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0110 0v4" />
              </svg>
            </div>
            <div>
              <p class="text-xs text-slate-500 font-medium">Suspensiones vigentes</p>
              <SSkeleton v-if="store.cargando" width="2rem" height="1.5rem" class="mt-0.5" />
              <p v-else class="text-2xl font-bold text-red-700">{{ totalSuspensiones }}</p>
            </div>
          </div>
        </SCard>
      </div>

      <!-- Tabla -->
      <SCard padding="none">
        <!-- Filtros -->
        <div class="flex items-center gap-2 px-4 py-3 border-b border-slate-100">
          <div class="flex bg-slate-100 rounded-lg p-1 gap-1">
            <button v-for="e in ESTADOS" :key="e.value"
              class="px-3 py-1.5 text-sm font-medium rounded-md transition-all" :class="store.filtroEstado === e.value
                ? 'bg-white text-slate-800 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'" @click="cambiarEstado(e.value)">
              {{ e.label }}
            </button>
          </div>
          <div class="ml-auto">
            <SButton variant="ghost" size="sm" @click="cargar">
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="23 4 23 10 17 10" />
                <polyline points="1 20 1 14 7 14" />
                <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
              </svg>
            </SButton>
          </div>
        </div>

        <!-- Loading -->
        <div v-if="store.cargando" class="p-6 space-y-3">
          <SSkeleton v-for="i in 5" :key="i" width="100%" height="2.75rem" />
        </div>

        <!-- Vacío -->
        <div v-else-if="store.sanciones.length === 0" class="py-10">
          <SEmptyState title="Sin sanciones"
            :description="`No hay sanciones ${store.filtroEstado.toLowerCase()}s en esta biblioteca.`" icon="inbox" />
        </div>

        <!-- Tabla desktop -->
        <div v-else class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-slate-100 bg-slate-50/60">
                <th class="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Usuario
                </th>
                <th class="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Tipo</th>
                <th class="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Motivo
                </th>
                <th class="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Monto
                </th>
                <th class="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Suspensión
                  hasta</th>
                <th class="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Estado
                </th>
                <th class="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Acciones
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-50">
              <tr v-for="s in store.sanciones" :key="s.idSancion" class="hover:bg-slate-50/70 transition-colors">
                <td class="px-4 py-3">
                  <p class="font-medium text-slate-800">{{ s.nombreUsuario }}</p>
                  <p class="text-xs text-slate-400">CI: {{ s.ciUsuario }}</p>
                </td>
                <td class="px-4 py-3">
                  <SancionBadge tipo="tipoSancion" :valor="s.tipoSancion" />
                </td>
                <td class="px-4 py-3">
                  <SancionBadge tipo="motivo" :valor="s.motivo" />
                </td>
                <td class="px-4 py-3 text-right">
                  <span class="font-semibold text-slate-800">
                    Bs {{ s.montoMulta?.toFixed(2) ?? '0.00' }}
                  </span>
                </td>
                <td class="px-4 py-3">
                  <span v-if="s.fechaFinSuspension" class="text-sm"
                    :class="s.suspensionVigente ? 'text-red-600 font-medium' : 'text-slate-500'">
                    {{ formatFecha(s.fechaFinSuspension) }}
                    <SBadge v-if="s.suspensionVigente" variant="danger" size="sm" :dot="true" class="ml-1">Vigente
                    </SBadge>
                  </span>
                  <span v-else class="text-slate-400 text-xs">—</span>
                </td>
                <td class="px-4 py-3">
                  <SancionBadge tipo="estado" :valor="s.estado" />
                </td>
                <td class="px-4 py-3">
                  <div class="flex items-center justify-end gap-1.5">
                    <!-- Pago -->
                    <SButton v-if="s.estado === 'ACTIVA' && s.montoMulta" variant="success" size="xs"
                      @click="abrirPago(s)">
                      Pago
                    </SButton>
                    <!-- Condonar (solo admin) -->
                    <SButton v-if="s.estado === 'ACTIVA' && isAdmin" variant="danger" size="xs"
                      @click="abrirCondonar(s)">
                      Condonar
                    </SButton>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </SCard>
    </div>

    <!-- Modales -->
    <ModalPago v-model="modalPagoAbierto" :sancion="sancionSeleccionada" @pagado="cargar" />
    <ModalCondonar v-model="modalCondonarAbierto" :sancion="sancionSeleccionada" @condonado="cargar" />
    <ModalSancionManual v-model="modalManualAbierto" @registrado="cargar" />
  </div>
</template>