<script setup lang="ts">
import { ref, onMounted } from 'vue'
import BaseModal from './BaseModal.vue'
import EdicionFormModal from './EdicionFormModal.vue'
import EjemplarFormModal from './EjemplarFormModal.vue'
import EjemplarEstadoModal from './EjemplarEstadoModal.vue'
import EjemplarHistorialModal from './EjemplarHistorialModal.vue'
import { obtenerEjemplaresPorLibro } from '@/services/ejemplares.service'
import { eliminarEdicion } from '@/services/ediciones.service'
import { usePermissions } from '@/composables/usePermissions'
import { useUiStore } from '@/stores/ui.store'
import { estadoEjemplarConfig, primeraPortada } from '@/utils/catalogo'
import type { Libro, Edicion, Ejemplar } from '@/types/catalogo'

const props = defineProps<{ libro: Libro }>()
const emit = defineEmits<{ close: []; editar: [libro: Libro] }>()

const { isAdmin, isBibliotecario, isEstudiante } = usePermissions()
const ui = useUiStore()

// ─── Tabs ─────────────────────────────────────────────────────────────────
const tabActiva = ref<'info' | 'ediciones' | 'ejemplares'>('info')

// ─── Ejemplares (de todas las ediciones del libro) ────────────────────────
const cargandoEjemplares = ref(false)
const ejemplares = ref<Ejemplar[]>([])

onMounted(() => cargarEjemplares())

async function cargarEjemplares() {
  cargandoEjemplares.value = true
  try {
    // Endpoint correcto: /api/ejemplares/libro/{libroId}
    ejemplares.value = await obtenerEjemplaresPorLibro(props.libro.idLibro)
  } catch {
    ejemplares.value = []
  } finally {
    cargandoEjemplares.value = false
  }
}

// ─── Sub-modales con un único ref de control ──────────────────────────────
type SubModal = 'edicion-form' | 'ejemplar-form' | 'estado' | 'historial' | null

const subModal = ref<SubModal>(null)
const edicionEditando = ref<Edicion | null>(null)
const edicionIdParaEjemplar = ref<number | null>(null)
const ejemplarSeleccionado = ref<Ejemplar | null>(null)
const ejemplarEditando = ref<Ejemplar | null>(null)

function cerrar() {
  subModal.value = null
  edicionEditando.value = null
  edicionIdParaEjemplar.value = null
  ejemplarSeleccionado.value = null
  ejemplarEditando.value = null
}

// Ediciones
function abrirNuevaEdicion() { edicionEditando.value = null; subModal.value = 'edicion-form' }
function abrirEditarEdicion(ed: Edicion) { edicionEditando.value = ed; subModal.value = 'edicion-form' }

async function confirmarEliminarEdicion(ed: Edicion) {
  if (!confirm(`¿Eliminar la edición ISBN ${ed.isbn}? Solo es posible si no tiene ejemplares.`)) return
  try {
    await eliminarEdicion(ed.idEdicion)
    ui.toast.success('Eliminada', 'Edición eliminada correctamente')
    emit('editar', props.libro) // refresca el libro padre
  } catch (e: unknown) {
    ui.toast.error('Error', e instanceof Error ? e.message : 'No se pudo eliminar')
  }
}

// Ejemplares
function abrirNuevoEjemplar(edicionId?: number) {
  ejemplarEditando.value = null
  edicionIdParaEjemplar.value = edicionId ?? props.libro.ediciones?.[0]?.idEdicion ?? null
  subModal.value = 'ejemplar-form'
}

function abrirEditarEjemplar(e: Ejemplar) {
  ejemplarEditando.value = e
  subModal.value = 'ejemplar-form'
}

function abrirCambioEstado(e: Ejemplar) { ejemplarSeleccionado.value = e; subModal.value = 'estado' }
function abrirHistorial(e: Ejemplar) { ejemplarSeleccionado.value = e; subModal.value = 'historial' }

function onEdicionGuardada() {
  cerrar()
  ui.toast.success('Guardado', 'Edición guardada correctamente')
  emit('editar', props.libro) // refresca desde arriba
}

function onEjemplarGuardado() {
  cerrar()
  cargarEjemplares()
  ui.toast.success('Guardado', 'Ejemplar guardado correctamente')
}
</script>

<template>
  <BaseModal :title="libro.titulo" size="xl" @close="emit('close')">

    <!-- ── Tabs ── -->
    <div class="flex border-b border-slate-200 mb-5 -mt-1 gap-1">
      <button v-for="tab in [
        { key: 'info', label: 'Información' },
        { key: 'ediciones', label: `Ediciones (${libro.ediciones?.length ?? 0})` },
        { key: 'ejemplares', label: `Ejemplares (${libro.ejemplaresTotal})` },
      ]" :key="tab.key" @click="tabActiva = tab.key as any" :class="['px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px',
        tabActiva === tab.key
          ? 'border-indigo-600 text-indigo-600'
          : 'border-transparent text-slate-500 hover:text-slate-700']">{{ tab.label }}</button>
    </div>

    <!-- ── TAB: Info ── -->
    <div v-show="tabActiva === 'info'" class="space-y-5">
      <div class="flex gap-5">
        <!-- Portada de la primera edición que tenga -->
        <div class="flex-shrink-0 w-28">
          <div
            class="aspect-[2/3] rounded-xl overflow-hidden bg-gradient-to-br from-indigo-50 to-slate-100 border border-slate-200">
            <img v-if="primeraPortada(libro.ediciones)" :src="primeraPortada(libro.ediciones)" :alt="libro.titulo"
              class="w-full h-full object-cover" />
            <div v-else class="w-full h-full flex items-center justify-center">
              <svg class="w-8 h-8 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                  d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
          </div>
          <div class="mt-2 text-center">
            <span :class="['text-sm font-semibold',
              libro.ejemplaresDisponibles === 0 ? 'text-red-600' :
                libro.ejemplaresDisponibles <= 1 ? 'text-amber-600' : 'text-emerald-600']">
              {{ libro.ejemplaresDisponibles }}
            </span>
            <span class="text-xs text-slate-500"> / {{ libro.ejemplaresTotal }} disp.</span>
          </div>
        </div>

        <!-- Metadatos -->
        <div class="flex-1 space-y-3">
          <span
            class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700">
            {{ libro.categoria?.nombreCategoria }}
          </span>
          <dl class="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <div>
              <dt class="text-xs text-slate-500">Idioma</dt>
              <dd class="text-slate-800 mt-0.5 uppercase">{{ libro.idioma }}</dd>
            </div>
            <div>
              <dt class="text-xs text-slate-500">Ediciones</dt>
              <dd class="text-slate-800 mt-0.5">{{ libro.ediciones?.length ?? 0 }}</dd>
            </div>
            <div>
              <dt class="text-xs text-slate-500">Ejemplares totales</dt>
              <dd class="text-slate-800 mt-0.5">{{ libro.ejemplaresTotal }}</dd>
            </div>
            <div>
              <dt class="text-xs text-slate-500">Disponibles</dt>
              <dd class="text-slate-800 mt-0.5">{{ libro.ejemplaresDisponibles }}</dd>
            </div>
          </dl>
        </div>
      </div>
      <div v-if="libro.descripcion" class="bg-slate-50 rounded-xl p-4">
        <p class="text-xs font-medium text-slate-500 mb-1.5">Descripción</p>
        <p class="text-sm text-slate-700 leading-relaxed">{{ libro.descripcion }}</p>
      </div>
    </div>

    <!-- ── TAB: Ediciones ── -->
    <div v-show="tabActiva === 'ediciones'">
      <div v-if="isAdmin || isBibliotecario" class="flex justify-end mb-3">
        <button @click="abrirNuevaEdicion"
          class="inline-flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-800 font-medium px-3 py-1.5 rounded-lg hover:bg-indigo-50 transition-colors">
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          Nueva edición
        </button>
      </div>

      <div v-if="!libro.ediciones?.length" class="text-center py-8">
        <p class="text-sm text-slate-500">Este libro no tiene ediciones registradas.</p>
      </div>

      <div v-else class="space-y-3">
        <div v-for="ed in libro.ediciones" :key="ed.idEdicion"
          class="border border-slate-200 rounded-xl overflow-hidden">
          <div class="flex items-center gap-4 px-4 py-3 bg-slate-50">
            <!-- Portada mini -->
            <div class="w-10 h-14 flex-shrink-0 rounded-lg overflow-hidden bg-slate-200">
              <img v-if="ed.imagenPortada" :src="ed.imagenPortada" :alt="ed.isbn" class="w-full h-full object-cover" />
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-xs font-mono font-semibold text-slate-900">{{ ed.isbn }}</p>
              <p class="text-xs text-slate-600">{{ ed.editorial }} · {{ ed.anoPublicacion }}
                <template v-if="ed.edicion"> · {{ ed.edicion }}</template>
                <template v-if="ed.numeroPaginas"> · {{ ed.numeroPaginas }} págs.</template>
              </p>
              <p class="text-xs text-slate-400 mt-0.5">
                {{ ed.ejemplaresDisponibles ?? '?' }} / {{ ed.ejemplaresTotal ?? '?' }} disponibles
              </p>
            </div>
            <div v-if="isAdmin || isBibliotecario" class="flex items-center gap-1 flex-shrink-0">
              <button @click="abrirNuevoEjemplar(ed.idEdicion)"
                class="p-1 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-colors"
                title="Agregar ejemplar">
                <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                </svg>
              </button>
              <button @click="abrirEditarEdicion(ed)"
                class="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                title="Editar">
                <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
              <button v-if="isAdmin" @click="confirmarEliminarEdicion(ed)"
                class="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
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
    </div>

    <!-- ── TAB: Ejemplares ── -->
    <div v-show="tabActiva === 'ejemplares'">
      <div v-if="isAdmin || isBibliotecario" class="flex justify-end mb-3">
        <button @click="abrirNuevoEjemplar()"
          class="inline-flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-800 font-medium px-3 py-1.5 rounded-lg hover:bg-indigo-50 transition-colors">
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          Agregar ejemplar
        </button>
      </div>

      <div v-if="cargandoEjemplares" class="flex justify-center py-8">
        <svg class="w-6 h-6 animate-spin text-indigo-400" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>

      <div v-else-if="!ejemplares.length" class="text-center py-8">
        <p class="text-sm text-slate-500">No hay ejemplares registrados para este libro.</p>
      </div>

      <div v-else class="space-y-2">
        <div v-for="ej in ejemplares" :key="ej.idEjemplar"
          class="flex items-center gap-3 px-4 py-3 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors">
          <span :class="['w-2 h-2 rounded-full flex-shrink-0',
            estadoEjemplarConfig[ej.estadoEjemplar]?.dot ?? 'bg-slate-300']" />
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="font-mono text-sm font-medium text-slate-900">{{ ej.codigoEjemplar }}</span>
              <span :class="['text-xs px-1.5 py-0.5 rounded font-medium',
                estadoEjemplarConfig[ej.estadoEjemplar]?.clases ?? 'bg-slate-100 text-slate-600']">
                {{ estadoEjemplarConfig[ej.estadoEjemplar]?.label ?? ej.estadoEjemplar }}
              </span>
              <!-- Edición a la que pertenece -->
              <span class="text-xs text-slate-400 font-mono" v-if="ej.edicion?.isbn">
                {{ ej.edicion.isbn }}
              </span>
            </div>
            <p class="text-xs text-slate-500 mt-0.5 truncate">
              {{ ej.ubicacionFisica }}
              <template v-if="ej.codigoTopografico"> · {{ ej.codigoTopografico }}</template>
              <template v-if="ej.biblioteca?.nombre"> · {{ ej.biblioteca.nombre }}</template>
            </p>
          </div>

          <div v-if="isAdmin || isBibliotecario" class="flex items-center gap-1 flex-shrink-0">
            <button @click="abrirHistorial(ej)"
              class="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors"
              title="Historial">
              <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
            <button @click="abrirCambioEstado(ej)" :disabled="['BAJA', 'PERDIDO'].includes(ej.estadoEjemplar)"
              class="p-1 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              title="Cambiar estado">
              <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
              </svg>
            </button>
            <button @click="abrirEditarEjemplar(ej)"
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
      <button v-if="isAdmin || isBibliotecario" @click="emit('editar', libro)"
        class="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
        Editar libro
      </button>
      <button @click="emit('close')"
        class="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
        Cerrar
      </button>
    </template>
  </BaseModal>

  <!-- Sub-modales fuera del BaseModal principal -->
  <EdicionFormModal v-if="subModal === 'edicion-form'" :edicion="edicionEditando" :libro-id="libro.idLibro"
    @close="cerrar" @saved="onEdicionGuardada" />

  <EjemplarFormModal v-if="subModal === 'ejemplar-form'" :ejemplar="ejemplarEditando" :ediciones="libro.ediciones"
    :edicion-id-inicial="edicionIdParaEjemplar ?? undefined" @close="cerrar" @saved="onEjemplarGuardado" />

  <EjemplarEstadoModal v-if="subModal === 'estado' && ejemplarSeleccionado" :ejemplar="ejemplarSeleccionado"
    @close="cerrar" @saved="onEjemplarGuardado" />

  <EjemplarHistorialModal v-if="subModal === 'historial' && ejemplarSeleccionado" :ejemplar="ejemplarSeleccionado"
    @close="cerrar" />
</template>