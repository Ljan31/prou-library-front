<script setup lang="ts">
import { ref, onMounted } from 'vue'
import BaseModal from './BaseModal.vue'
import EjemplarFormModal from './EjemplarFormModal.vue'
import EjemplarEstadoModal from './EjemplarEstadoModal.vue'
import EjemplarHistorialModal from './EjemplarHistorialModal.vue'
import api from '@/services/axios'
import { usePermissions } from '@/composables/usePermissions'
import { useUiStore } from '@/stores/ui.store'
import { estadoEjemplarConfig } from '@/utils/catalogo'
import type { Libro, Ejemplar } from '@/types/catalogo'

const props = defineProps<{ libro: Libro }>()
const emit = defineEmits<{ close: []; editar: [libro: Libro] }>()

const { isAdmin, isBibliotecario, isEstudiante } = usePermissions()
const ui = useUiStore()

// ─── Tabs ─────────────────────────────────────────────────────────────────
const tabActiva = ref<'info' | 'ejemplares'>('info')

// ─── Ejemplares ───────────────────────────────────────────────────────────
const cargandoEjemplares = ref(false)
const ejemplares = ref<Ejemplar[]>([])

onMounted(() => cargarEjemplares())

async function cargarEjemplares() {
  cargandoEjemplares.value = true
  try {
    // Intenta con filtro de libroId, si falla trae todos
    const res = await api.get(`/ejemplares/libro/${props.libro.id_libro}`)
    // const res = await api.get('/ejemplares/libro/', {
    //   params: { libro: props.libro.id_libro }
    // })
    const data = Array.isArray(res.data.data) ? res.data.data : (res.data?.content ?? [])
    // Filtrar por libroId en cliente por si el backend ignora el param
    ejemplares.value = data.filter((e: Ejemplar) =>
      !e.libroId || e.libroId === props.libro.id_libro
    )
  } catch {
    ejemplares.value = []
  } finally {
    cargandoEjemplares.value = false
  }
}

// ─── Sub-modales ──────────────────────────────────────────────────────────
const subModal = ref<'form' | 'estado' | 'historial' | null>(null)
const ejemplarSeleccionado = ref<Ejemplar | null>(null)
const ejemplarEditando = ref<Ejemplar | null>(null)

function cerrarSubModal() {
  subModal.value = null
  ejemplarSeleccionado.value = null
  ejemplarEditando.value = null
}

function abrirCrearEjemplar() {
  ejemplarEditando.value = null
  subModal.value = 'form'
}

function abrirEditarEjemplar(e: Ejemplar) {
  ejemplarEditando.value = e
  subModal.value = 'form'
}

function abrirCambioEstado(e: Ejemplar) {
  ejemplarSeleccionado.value = e
  subModal.value = 'estado'
}

function abrirHistorial(e: Ejemplar) {
  ejemplarSeleccionado.value = e
  subModal.value = 'historial'
}

function onEjemplarGuardado() {
  cerrarSubModal()
  cargarEjemplares()
  ui.toast.success('Guardado', 'Ejemplar actualizado correctamente')
}

// ─── Eliminar ejemplar ────────────────────────────────────────────────────
async function eliminarEjemplar(e: Ejemplar) {
  if (!confirm(`¿Eliminar el ejemplar "${e.codigo_ejemplar}"?`)) return
  try {
    await api.delete(`/ejemplares/${e.id_ejemplar}`)
    ui.toast.success('Eliminado', `Ejemplar ${e.codigo_ejemplar} eliminado`)
    cargarEjemplares()
  } catch {
    ui.toast.error('Error', 'No se pudo eliminar el ejemplar')
  }
}
</script>

<template>
  <!-- Modal principal del libro -->
  <BaseModal :title="libro.titulo" size="xl" @close="emit('close')">

    <!-- Tabs -->
    <div class="flex border-b border-slate-200 mb-5 -mt-1">
      <button @click="tabActiva = 'info'" :class="['px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px',
        tabActiva === 'info'
          ? 'border-indigo-600 text-indigo-600'
          : 'border-transparent text-slate-500 hover:text-slate-700']">
        Información
      </button>
      <button @click="tabActiva = 'ejemplares'" :class="['px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px flex items-center gap-1.5',
        tabActiva === 'ejemplares'
          ? 'border-indigo-600 text-indigo-600'
          : 'border-transparent text-slate-500 hover:text-slate-700']">
        Ejemplares
        <span class="inline-flex items-center justify-center w-5 h-5 text-xs bg-slate-100 text-slate-600 rounded-full">
          {{ libro.ejemplaresTotal }}
        </span>
      </button>
    </div>

    <!-- ── TAB: Info ── -->
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
            <span :class="['text-sm font-semibold',
              libro.ejemplaresDisponibles === 0 ? 'text-red-600' :
                libro.ejemplaresDisponibles <= 1 ? 'text-amber-600' : 'text-emerald-600']">{{
                  libro.ejemplaresDisponibles }}</span>
            <span class="text-xs text-slate-500"> / {{ libro.ejemplaresTotal }} disponibles</span>
          </div>
        </div>

        <!-- Metadatos -->
        <div class="flex-1 space-y-3">
          <span
            class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700">
            {{ libro.categoria?.nombre_categoria }}
          </span>

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
              <dt class="text-xs text-slate-500">Año</dt>
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

      <div v-if="libro.descripcion" class="bg-slate-50 rounded-xl p-4">
        <p class="text-xs font-medium text-slate-500 mb-1.5">Descripción</p>
        <p class="text-sm text-slate-700 leading-relaxed">{{ libro.descripcion }}</p>
      </div>
    </div>

    <!-- ── TAB: Ejemplares ── -->
    <div v-show="tabActiva === 'ejemplares'">
      <!-- Botón agregar (staff) -->
      <div v-if="isAdmin || isBibliotecario" class="flex justify-end mb-4">
        <button @click="abrirCrearEjemplar"
          class="inline-flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-800 font-medium px-3 py-1.5 rounded-lg hover:bg-indigo-50 transition-colors">
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          Agregar ejemplar
        </button>
      </div>

      <!-- Cargando -->
      <div v-if="cargandoEjemplares" class="flex justify-center py-8">
        <svg class="w-6 h-6 animate-spin text-indigo-400" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>

      <!-- Vacío -->
      <div v-else-if="!ejemplares.length" class="text-center py-8">
        <svg class="w-10 h-10 text-slate-200 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
            d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
        <p class="text-sm text-slate-500">No hay ejemplares para este libro.</p>
      </div>

      <!-- Lista ejemplares -->
      <div v-else class="space-y-2">
        <div v-for="ej in ejemplares" :key="ej.id_ejemplar"
          class="flex items-center gap-3 px-4 py-3 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors">
          <!-- Dot estado -->
          <span :class="['w-2 h-2 rounded-full flex-shrink-0',
            estadoEjemplarConfig[ej.estadoEjemplar]?.dot ?? 'bg-slate-300']" />

          <!-- Info -->
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="font-mono text-sm font-medium text-slate-900">{{ ej.codigo_ejemplar }}</span>
              <span :class="['text-xs px-1.5 py-0.5 rounded font-medium',
                estadoEjemplarConfig[ej.estadoEjemplar]?.clases ?? 'bg-slate-100 text-slate-600']">
                {{ estadoEjemplarConfig[ej.estadoEjemplar]?.label ?? ej.estadoEjemplar }}
              </span>
            </div>
            <p class="text-xs text-slate-500 mt-0.5 truncate">
              {{ ej.ubicacion_fisica }}<template v-if="ej.codigo_topografico"> · {{ ej.codigo_topografico }}</template>
            </p>
          </div>

          <!-- Preview PDF (estudiante) -->
          <a v-if="isEstudiante && ej.pdfPreview" :href="ej.pdfPreview" target="_blank"
            class="text-xs text-indigo-600 hover:underline flex-shrink-0">
            Vista previa
          </a>

          <!-- Acciones staff -->
          <div v-if="isAdmin || isBibliotecario" class="flex items-center gap-1 flex-shrink-0">
            <!-- Historial -->
            <button @click="abrirHistorial(ej)"
              class="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors"
              title="Ver historial">
              <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
            <!-- Cambiar estado -->
            <button @click="abrirCambioEstado(ej)" :disabled="['BAJA', 'PERDIDO'].includes(ej.estadoEjemplar)"
              class="p-1 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              title="Cambiar estado">
              <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
              </svg>
            </button>
            <!-- Editar -->
            <button @click="abrirEditarEjemplar(ej)"
              class="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
              title="Editar">
              <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
            <!-- Eliminar -->
            <button @click="eliminarEjemplar(ej)"
              :disabled="ej.prestamoActivo !== null && ej.prestamoActivo !== undefined"
              class="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              title="Eliminar">
              <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <template #footer>
      <button v-if="isAdmin || isBibliotecario" @click="emit('editar', libro)"
        class="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors">
        Editar libro
      </button>
      <button @click="emit('close')"
        class="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors">
        Cerrar
      </button>
    </template>
  </BaseModal>

  <!-- ── Sub-modales (fuera del BaseModal para evitar portales anidados) ── -->
  <EjemplarFormModal v-if="subModal === 'form'" :ejemplar="ejemplarEditando" :libro-id="libro.id_libro"
    @close="cerrarSubModal" @saved="onEjemplarGuardado" />

  <EjemplarEstadoModal v-if="subModal === 'estado' && ejemplarSeleccionado" :ejemplar="ejemplarSeleccionado"
    @close="cerrarSubModal" @saved="onEjemplarGuardado" />

  <EjemplarHistorialModal v-if="subModal === 'historial' && ejemplarSeleccionado" :ejemplar="ejemplarSeleccionado"
    @close="cerrarSubModal" />
</template>