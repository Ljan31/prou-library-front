<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useUiStore } from '@/stores/ui.store'
import { usePermissions } from '@/composables/usePermissions'

import SButton from '@/components/ui/SButton.vue'
import SCard from '@/components/ui/SCard.vue'
import SInput from '@/components/ui/SInput.vue'
import SSelect from '@/components/ui/SSelect.vue'
import SSkeleton from '@/components/feedback/SSkeleton.vue'
import SEmptyState from '@/components/feedback/SEmptyState.vue'
import EjemplarFormModal from '@/components/catalogo/EjemplarFormModal.vue'
import EjemplarEstadoModal from '@/components/catalogo/EjemplarEstadoModal.vue'
import EjemplarHistorialModal from '@/components/catalogo/EjemplarHistorialModal.vue'

import type { Ejemplar } from '@/types/catalogo'
import { estadoEjemplarConfig } from '@/utils/catalogo'
import { obtenerEjemplares, eliminarEjemplar as eliminarEjemplarService } from '@/services/ejemplares.service'

const ui = useUiStore()
const { isAdmin, isBibliotecario } = usePermissions()

// ─── Estado ──────────────────────────────────────────────────────────────
const mostrarFormModal = ref(false)
const mostrarEstadoModal = ref(false)
const mostrarHistorial = ref(false)
const ejemplarSeleccionado = ref<Ejemplar | null>(null)
const ejemplarParaEditar = ref<Ejemplar | null>(null)
const busqueda = ref('')
const estadoFiltro = ref('')

const ejemplares = ref<Ejemplar[]>([])
const cargandoEjemplares = ref(false)
const errorEjemplares = ref<string | null>(null)

const opcionesEstado = [
  { value: '', label: 'Todos los estados' },
  { value: 'DISPONIBLE', label: '🟢 Disponible' },
  { value: 'PRESTADO', label: '🔴 Prestado' },
  { value: 'EN_REPARACION', label: '🟡 En reparación' },
  { value: 'DAÑADO', label: '🟡 Dañado' },
  { value: 'BAJA', label: '❌ Baja' },
  { value: 'PERDIDO', label: '❌ Perdido' },
]

// ─── Funciones ───────────────────────────────────────────────────────────
async function cargarEjemplares() {
  cargandoEjemplares.value = true
  errorEjemplares.value = null
  try {
    ejemplares.value = await obtenerEjemplares()
  } catch (e: unknown) {
    errorEjemplares.value = e instanceof Error ? e.message : 'Error cargando ejemplares'
    ejemplares.value = []
  } finally {
    cargandoEjemplares.value = false
  }
}

async function eliminarEjemplar(ejemplar: Ejemplar) {
  if (!confirm(`¿Eliminar ejemplar "${ejemplar.codigo_ejemplar}"?`)) return
  try {
    await eliminarEjemplarService(ejemplar.id_ejemplar)
    ui.toast.success('Eliminado', `Ejemplar ${ejemplar.codigo_ejemplar} eliminado`)
    cargarEjemplares()
  } catch {
    ui.toast.error('Error', 'No se pudo eliminar el ejemplar')
  }
}

// ─── Acciones modales ─────────────────────────────────────────────────────
function abrirCrear() { ejemplarParaEditar.value = null; mostrarFormModal.value = true }
function abrirEditar(ejemplar: Ejemplar) { ejemplarParaEditar.value = ejemplar; mostrarFormModal.value = true }
function abrirCambioEstado(ejemplar: Ejemplar) { ejemplarSeleccionado.value = ejemplar; mostrarEstadoModal.value = true }
function abrirHistorial(ejemplar: Ejemplar) { ejemplarSeleccionado.value = ejemplar; mostrarHistorial.value = true }
function onGuardado() { mostrarFormModal.value = false; mostrarEstadoModal.value = false; cargarEjemplares() }

// ─── Computed ────────────────────────────────────────────────────────────
const ejemplaresFiltrados = computed(() => {
  return ejemplares.value.filter(e => {
    const matchBusqueda = !busqueda.value ||
      e.codigo_ejemplar.toLowerCase().includes(busqueda.value.toLowerCase()) ||
      e.codigo_topografico?.toLowerCase().includes(busqueda.value.toLowerCase()) ||
      e.ubicacion_fisica?.toLowerCase().includes(busqueda.value.toLowerCase())
    const matchEstado = !estadoFiltro.value || e.estadoEjemplar === estadoFiltro.value
    return matchBusqueda && matchEstado
  })
})

const stats = computed(() => {
  const list = ejemplares.value
  return {
    total: list.length,
    disponibles: list.filter(e => e.estadoEjemplar === 'DISPONIBLE').length,
    prestados: list.filter(e => e.estadoEjemplar === 'PRESTADO').length,
    enReparacion: list.filter(e => ['EN_REPARACION', 'DAÑADO'].includes(e.estadoEjemplar)).length,
    bajaOPerdido: list.filter(e => ['BAJA', 'PERDIDO'].includes(e.estadoEjemplar)).length,
  }
})

onMounted(() => {
  ui.setBreadcrumbs([{ label: 'Inventario', to: '/inventario' }])
  cargarEjemplares()
})
</script>

<template>
  <div class="page-container">
    <!-- Header -->
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-2xl font-semibold text-slate-900">Inventario de Ejemplares</h1>
        <p class="text-sm text-slate-500 mt-0.5">Control y seguimiento de todos los ejemplares físicos</p>
      </div>
      <SButton v-if="isAdmin || isBibliotecario" @click="abrirCrear" variant="primary">
        <svg class="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
        </svg>
        Nuevo ejemplar
      </SButton>
    </div>

    <!-- Stats cards -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
      <SCard padding="md">
        <p class="text-xs text-slate-500 mb-1">Total</p>
        <p class="text-2xl font-semibold text-slate-900">{{ stats.total }}</p>
      </SCard>
      <SCard padding="md">
        <p class="text-xs text-slate-500 mb-1">Disponibles</p>
        <p class="text-2xl font-semibold text-emerald-600">{{ stats.disponibles }}</p>
      </SCard>
      <SCard padding="md">
        <p class="text-xs text-slate-500 mb-1">Prestados</p>
        <p class="text-2xl font-semibold text-red-600">{{ stats.prestados }}</p>
      </SCard>
      <SCard padding="md">
        <p class="text-xs text-slate-500 mb-1">En reparación</p>
        <p class="text-2xl font-semibold text-amber-600">{{ stats.enReparacion }}</p>
      </SCard>
    </div>

    <!-- Filtros -->
    <SCard class="mb-6" padding="md">
      <div class="flex flex-col sm:flex-row gap-3">
        <SInput v-model="busqueda" placeholder="Buscar por código, ubicación..." clearable class="flex-1" />
        <SSelect v-model="estadoFiltro" :options="opcionesEstado" class="sm:w-52" />
      </div>
    </SCard>

    <!-- Loading -->
    <div v-if="cargandoEjemplares" class="space-y-3">
      <SSkeleton v-for="i in 6" :key="i" width="100%" height="72px" />
    </div>

    <!-- Error -->
    <p v-else-if="errorEjemplares" class="text-red-500 text-sm text-center py-8">
      {{ errorEjemplares }}
    </p>

    <!-- Empty -->
    <SEmptyState v-else-if="!ejemplaresFiltrados.length" title="Sin ejemplares"
      description="No se encontraron ejemplares con los filtros aplicados." icon="archive-box" />

    <!-- Tabla de ejemplares -->
    <div v-else class="space-y-2">
      <SCard v-for="ejemplar in ejemplaresFiltrados" :key="ejemplar.id_ejemplar" padding="md" :hoverable="true">
        <div class="flex items-center gap-4">
          <!-- Estado visual -->
          <div class="flex-shrink-0">
            <span :class="[
              'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium',
              estadoEjemplarConfig[ejemplar.estadoEjemplar]?.clases ?? 'bg-slate-100 text-slate-700'
            ]">
              <span :class="[
                'w-1.5 h-1.5 rounded-full',
                estadoEjemplarConfig[ejemplar.estadoEjemplar]?.dot ?? 'bg-slate-400'
              ]"></span>
              {{ estadoEjemplarConfig[ejemplar.estadoEjemplar]?.label ?? ejemplar.estadoEjemplar }}
            </span>
          </div>

          <!-- Info principal -->
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2">
              <span class="font-mono text-sm font-medium text-slate-900">{{ ejemplar.codigo_ejemplar }}</span>
              <span class="text-slate-300">·</span>
              <span class="text-xs text-slate-500">{{ ejemplar.codigo_topografico }}</span>
            </div>
            <p class="text-xs text-slate-500 mt-0.5 truncate">
              {{ ejemplar.ubicacion_fisica }}
              <template v-if="ejemplar.observaciones"> · {{ ejemplar.observaciones }}</template>
            </p>
          </div>

          <!-- Precio y fecha -->
          <div class="hidden sm:block text-right">
            <p class="text-sm text-slate-700">Bs. {{ ejemplar.precio_compra?.toFixed(2) ?? '—' }}</p>
            <p class="text-xs text-slate-500">{{ ejemplar.fechaAdquisicion ?? '—' }}</p>
          </div>

          <!-- Acciones -->
          <div class="flex items-center gap-1 flex-shrink-0">
            <!-- PDF badge si tiene -->
            <a v-if="ejemplar.pdf" :href="ejemplar.pdf" target="_blank"
              class="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 px-2 py-1 rounded hover:bg-indigo-50 transition-colors">
              <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h4a2 2 0 012 2v2M3 17a2 2 0 002 2h14a2 2 0 002-2" />
              </svg>
              PDF
            </a>

            <button @click="abrirHistorial(ejemplar)"
              class="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors"
              title="Ver historial">
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>

            <template v-if="isAdmin || isBibliotecario">
              <button @click="abrirCambioEstado(ejemplar)"
                :disabled="['BAJA', 'PERDIDO'].includes(ejemplar.estadoEjemplar)"
                class="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                title="Cambiar estado">
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                </svg>
              </button>

              <button @click="abrirEditar(ejemplar)"
                class="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                title="Editar">
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>

              <button @click="eliminarEjemplar(ejemplar)" :disabled="ejemplar.prestamoActivo !== null"
                class="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                title="Eliminar">
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </template>
          </div>
        </div>
      </SCard>
    </div>

    <!-- Modales -->
    <EjemplarFormModal v-if="mostrarFormModal" :ejemplar="ejemplarParaEditar" @close="mostrarFormModal = false"
      @saved="onGuardado" />

    <EjemplarEstadoModal v-if="mostrarEstadoModal && ejemplarSeleccionado" :ejemplar="ejemplarSeleccionado"
      @close="mostrarEstadoModal = false" @saved="onGuardado" />

    <EjemplarHistorialModal v-if="mostrarHistorial && ejemplarSeleccionado" :ejemplar="ejemplarSeleccionado"
      @close="mostrarHistorial = false" />
  </div>
</template>