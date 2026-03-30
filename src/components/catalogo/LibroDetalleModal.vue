<script setup lang="ts">
import { ref, onMounted } from 'vue'
import SModal from '@/components/ui/SModal.vue'
import SButton from '@/components/ui/SButton.vue'
import SBadge from '@/components/ui/SBadge.vue'
import SSpinner from '@/components/feedback/SSpinner.vue'
import SEmptyState from '@/components/feedback/SEmptyState.vue'
import EjemplarFormModal from './EjemplarFormModal.vue'
import EjemplarEstadoModal from './EjemplarEstadoModal.vue'
import api from '@/services/axios'
import { usePermissions } from '@/composables/usePermissions'
import { useUiStore } from '@/stores/ui.store'
import { estadoEjemplarConfig } from '@/utils/catalogo'
import type { Libro, Ejemplar } from '@/types/catalogo'

const props = defineProps<{
  libro: Libro
}>()

const emit = defineEmits<{
  close: []
  editar: [libro: Libro]
}>()

const { isAdmin, isBibliotecario, isEstudiante } = usePermissions()
const ui = useUiStore()

const cargandoEjemplares = ref(false)
const ejemplares = ref<Ejemplar[]>([])
const tabActiva = ref<'info' | 'ejemplares'>('info')

// Sub-modales
const mostrarFormEjemplar = ref(false)
const mostrarEstadoEjemplar = ref(false)
const ejemplarSeleccionado = ref<Ejemplar | null>(null)
const ejemplarEditando = ref<Ejemplar | null>(null)

onMounted(() => cargarEjemplares())

async function cargarEjemplares() {
  cargandoEjemplares.value = true
  try {
    const res = await api.get(`/ejemplares/libro/${props.libro.id_libro}`)
    console.log({ res })
    ejemplares.value = res.data.data ?? []
  } catch {
    // intentar sin filtro si el backend no soporta query param
    ejemplares.value = []
  } finally {
    cargandoEjemplares.value = false
  }
}

function abrirCrearEjemplar() {
  ejemplarEditando.value = null
  mostrarFormEjemplar.value = true
}

function abrirEditarEjemplar(e: Ejemplar) {
  ejemplarEditando.value = e
  mostrarFormEjemplar.value = true
}

function abrirCambioEstado(e: Ejemplar) {
  ejemplarSeleccionado.value = e
  mostrarEstadoEjemplar.value = true
}

function onEjemplarGuardado() {
  mostrarFormEjemplar.value = false
  mostrarEstadoEjemplar.value = false
  cargarEjemplares()
}
</script>

<template>
  <SModal :model-value="true" :title="libro.titulo" size="xl" @update:model-value="emit('close')">
    <!-- Tabs -->
    <div class="flex border-b border-slate-200 mb-5 -mt-1">
      <button @click="tabActiva = 'info'" :class="[
        'px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px',
        tabActiva === 'info'
          ? 'border-indigo-600 text-indigo-600'
          : 'border-transparent text-slate-500 hover:text-slate-700'
      ]">Información</button>
      <button @click="tabActiva = 'ejemplares'" :class="[
        'px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px flex items-center gap-1.5',
        tabActiva === 'ejemplares'
          ? 'border-indigo-600 text-indigo-600'
          : 'border-transparent text-slate-500 hover:text-slate-700'
      ]">
        Ejemplares
        <span class="inline-flex items-center justify-center w-5 h-5 text-xs bg-slate-100 text-slate-600 rounded-full">
          {{ libro.ejemplaresTotal }}
        </span>
      </button>
    </div>

    <!-- Tab: Información -->
    <div v-show="tabActiva === 'info'" class="space-y-5">
      <div class="flex gap-5">
        <!-- Portada -->
        <div class="flex-shrink-0 w-32">
          <div
            class="aspect-[2/3] rounded-xl overflow-hidden bg-gradient-to-br from-indigo-50 to-slate-100 border border-slate-200">
            <img v-if="libro.imagen_portada" :src="libro.imagen_portada" :alt="libro.titulo"
              class="w-full h-full object-cover" />
            <div v-else class="w-full h-full flex items-center justify-center">
              <svg class="w-8 h-8 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                  d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
          </div>

          <!-- Disponibilidad -->
          <div class="mt-3 text-center">
            <span :class="[
              'text-sm font-semibold',
              libro.ejemplaresDisponibles === 0 ? 'text-red-600' :
                libro.ejemplaresDisponibles <= 1 ? 'text-amber-600' :
                  'text-emerald-600'
            ]">
              {{ libro.ejemplaresDisponibles }}
            </span>
            <span class="text-xs text-slate-500"> / {{ libro.ejemplaresTotal }} disponibles</span>
          </div>
        </div>

        <!-- Metadatos -->
        <div class="flex-1 space-y-3">
          <div>
            <span
              class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700">
              {{ libro.categoria?.nombre_categoria }}
            </span>
          </div>

          <dl class="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <div>
              <dt class="text-xs text-slate-500">ISBN</dt>
              <dd class="font-mono text-slate-800 mt-0.5">{{ libro.isbn }}</dd>
            </div>
            <div>
              <dt class="text-xs text-slate-500">Editorial</dt>
              <dd class="text-slate-800 mt-0.5">{{ libro.editorial }}</dd>
            </div>
            <div>
              <dt class="text-xs text-slate-500">Año de publicación</dt>
              <dd class="text-slate-800 mt-0.5">{{ libro.anoPublicacion }}</dd>
            </div>
            <div>
              <dt class="text-xs text-slate-500">Edición</dt>
              <dd class="text-slate-800 mt-0.5">{{ libro.edicion }}</dd>
            </div>
            <div>
              <dt class="text-xs text-slate-500">Idioma</dt>
              <dd class="text-slate-800 mt-0.5">{{ libro.idioma }}</dd>
            </div>
            <div>
              <dt class="text-xs text-slate-500">Páginas</dt>
              <dd class="text-slate-800 mt-0.5">{{ libro.numero_paginas ?? '—' }}</dd>
            </div>
          </dl>
        </div>
      </div>

      <!-- Descripción -->
      <div v-if="libro.descripcion" class="bg-slate-50 rounded-xl p-4">
        <p class="text-xs font-medium text-slate-500 mb-1.5">Descripción</p>
        <p class="text-sm text-slate-700 leading-relaxed">{{ libro.descripcion }}</p>
      </div>
    </div>

    <!-- Tab: Ejemplares -->
    <div v-show="tabActiva === 'ejemplares'">
      <!-- Acción agregar (staff) -->
      <div v-if="isAdmin || isBibliotecario" class="flex justify-end mb-4">
        <button @click="abrirCrearEjemplar"
          class="inline-flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-800 font-medium px-3 py-1.5 rounded-lg hover:bg-indigo-50 transition-colors">
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          Agregar ejemplar
        </button>
      </div>

      <div v-if="cargandoEjemplares" class="flex justify-center py-8">
        <SSpinner />
      </div>

      <SEmptyState v-else-if="!ejemplares.length" title="Sin ejemplares"
        description="Este libro no tiene ejemplares registrados." icon="book" />

      <div v-else class="space-y-2">
        <div v-for="ejemplar in ejemplares" :key="ejemplar.id_ejemplar"
          class="flex items-center gap-3 px-4 py-3 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors">
          <!-- Estado dot -->
          <span :class="[
            'w-2 h-2 rounded-full flex-shrink-0',
            estadoEjemplarConfig[ejemplar.estadoEjemplar]?.dot ?? 'bg-slate-300'
          ]"></span>

          <!-- Info -->
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2">
              <span class="font-mono text-sm font-medium text-slate-900">{{ ejemplar.codigo_ejemplar }}</span>
              <span :class="[
                'text-xs px-1.5 py-0.5 rounded font-medium',
                estadoEjemplarConfig[ejemplar.estadoEjemplar]?.clases ?? 'bg-slate-100 text-slate-600'
              ]">
                {{ estadoEjemplarConfig[ejemplar.estadoEjemplar]?.label ?? ejemplar.estadoEjemplar }}
              </span>
            </div>
            <p class="text-xs text-slate-500 mt-0.5">{{ ejemplar.ubicacion_fisica }} · {{ ejemplar.codigo_topografico }}
            </p>
          </div>

          <!-- PDF preview (estudiante) -->
          <div v-if="isEstudiante && ejemplar.pdfPreview" class="flex-shrink-0">
            <a :href="ejemplar.pdfPreview" target="_blank" class="text-xs text-indigo-600 hover:underline">
              Vista previa
            </a>
          </div>

          <!-- Acciones staff -->
          <div v-if="isAdmin || isBibliotecario" class="flex items-center gap-1 flex-shrink-0">
            <button @click="abrirCambioEstado(ejemplar)"
              :disabled="['BAJA', 'PERDIDO'].includes(ejemplar.estadoEjemplar)"
              class="p-1 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              title="Cambiar estado">
              <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
              </svg>
            </button>
            <button @click="abrirEditarEjemplar(ejemplar)"
              class="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
              title="Editar">
              <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <SButton v-if="isAdmin || isBibliotecario" variant="secondary" @click="emit('editar', libro)">
        Editar libro
      </SButton>
      <SButton variant="ghost" @click="emit('close')">Cerrar</SButton>
    </template>
  </SModal>

  <!-- Sub-modales -->
  <EjemplarFormModal v-if="mostrarFormEjemplar" :ejemplar="ejemplarEditando" :libro-id="libro.id_libro"
    @close="mostrarFormEjemplar = false" @saved="onEjemplarGuardado" />

  <EjemplarEstadoModal v-if="mostrarEstadoEjemplar && ejemplarSeleccionado" :ejemplar="ejemplarSeleccionado"
    @close="mostrarEstadoEjemplar = false" @saved="onEjemplarGuardado" />
</template>