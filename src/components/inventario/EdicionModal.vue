<script setup lang="ts">
/**
 * EdicionModal — Modal Secundario
 * ────────────────────────────────────────────────────────────────────────
 * Gestiona una edición (crear o editar) y muestra la tabla de ejemplares
 * asociados. Abre EjemplarModal para crear/editar un ejemplar específico.
 * ────────────────────────────────────────────────────────────────────────
 */
import { ref, reactive, computed, onMounted, watch } from 'vue'
import BaseModal from '../catalogo/BaseModal.vue'
import EjemplarModal from './EjemplarModal.vue'
import api from '@/services/axios'
import { crearEdicion, actualizarEdicion } from '@/services/ediciones.service'
import { useMedia } from '@/composables/useMedia'
import { estadoEjemplarConfig } from '@/utils/catalogo'
import type { Edicion, Ejemplar } from '@/types/catalogo'

// ── Props / emits ─────────────────────────────────────────────────
const props = defineProps<{
  libroId: number
  edicion?: Edicion | null   // null = crear nueva
}>()
const emit = defineEmits<{ close: []; saved: [] }>()

const { getUrl } = useMedia()
const modoEdicion = computed(() => !!props.edicion)

// ══════════════════════════════════════════════════════════════════
// FORMULARIO EDICIÓN
// ══════════════════════════════════════════════════════════════════
const form = reactive({
  isbn: props.edicion?.isbn ?? '',
  editorial: props.edicion?.editorial ?? '',
  anoPublicacion: props.edicion?.anoPublicacion ?? new Date().getFullYear(),
  edicion: props.edicion?.edicion ?? '',
  numeroPaginas: props.edicion?.numeroPaginas ?? null as number | null,
})
const errores = reactive<Record<string, string>>({})

// Portada
const portadaFile = ref<File | null>(null)
const portadaPreview = ref(
  props.edicion?.imagenPortada ? getUrl(props.edicion.imagenPortada) : ''
)
function onPortadaChange(ev: Event) {
  const file = (ev.target as HTMLInputElement).files?.[0]
  if (!file) return
  portadaFile.value = file
  const r = new FileReader()
  r.onload = (e) => { portadaPreview.value = e.target?.result as string }
  r.readAsDataURL(file)
}
function limpiarPortada() { portadaFile.value = null; portadaPreview.value = '' }

// PDF
const pdfFile = ref<File | null>(null)
const pdfNombre = ref('')
const pdfExiste = computed(() => !!props.edicion?.pdfUrl)

function onPdfChange(ev: Event) {
  const file = (ev.target as HTMLInputElement).files?.[0]
  if (!file) return
  pdfFile.value = file
  pdfNombre.value = file.name
}
function limpiarPdf() { pdfFile.value = null; pdfNombre.value = '' }

// ── Generar ISBN aleatorio (helper UX) ───────────────────────────
function generarIsbn() {
  // Prefijo 978 + 9 dígitos aleatorios (simplificado para demo)
  const digits = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10)).join('')
  form.isbn = `978-${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6, 8)}-${digits[8]}`
}

// Guardar
const guardando = ref(false)
const errorGuardar = ref('')

async function guardar() {
  Object.keys(errores).forEach(k => delete errores[k])
  if (!form.isbn.trim()) errores.isbn = 'El ISBN es obligatorio'
  if (!form.editorial.trim()) errores.editorial = 'La editorial es obligatoria'
  if (Object.keys(errores).length) return

  guardando.value = true
  errorGuardar.value = ''
  try {
    if (modoEdicion.value && props.edicion) {
      await actualizarEdicion(
        props.edicion.idEdicion,
        {
          isbn: form.isbn, editorial: form.editorial, anoPublicacion: form.anoPublicacion,
          edicion: form.edicion || undefined, numeroPaginas: form.numeroPaginas,
          libroId: props.libroId
        },
        portadaFile.value ?? null,
      )
    } else {
      await crearEdicion(
        {
          isbn: form.isbn, editorial: form.editorial, anoPublicacion: form.anoPublicacion,
          edicion: form.edicion || undefined, numeroPaginas: form.numeroPaginas,
          libroId: props.libroId
        },
        portadaFile.value ?? null,
      )
    }
    emit('saved')
  } catch (e: unknown) {
    const err = e as any
    errorGuardar.value = err?.response?.data?.message ?? 'Error al guardar la edición'
  } finally {
    guardando.value = false
  }
}

// ══════════════════════════════════════════════════════════════════
// EJEMPLARES DE ESTA EDICIÓN
// ══════════════════════════════════════════════════════════════════
const ejemplares = ref<Ejemplar[]>([])
const cargandoEjs = ref(false)

onMounted(async () => {
  if (props.edicion?.idEdicion) await cargarEjemplares()
})

async function cargarEjemplares() {
  cargandoEjs.value = true
  try {
    const res = await api.get(`/ejemplares/edicion/${props.edicion!.idEdicion}`)
    const data = res.data?.data ?? res.data
    ejemplares.value = Array.isArray(data) ? data : []
  } catch {
    // Fallback: ejemplares precargados en la edición
    ejemplares.value = (props.edicion as any)?.ejemplares ?? []
  } finally {
    cargandoEjs.value = false
  }
}

// ══════════════════════════════════════════════════════════════════
// MODAL TERCIARIO — EJEMPLAR
// ══════════════════════════════════════════════════════════════════
const mostrarEjemplarModal = ref(false)
const ejemplarModalProps = ref<{ edicionId: number; libroId: number; ejemplar?: Ejemplar } | null>(null)

function abrirNuevoEjemplar() {
  ejemplarModalProps.value = {
    edicionId: props.edicion?.idEdicion ?? 0,
    libroId: props.libroId,
  }
  mostrarEjemplarModal.value = true
}

function abrirEditarEjemplar(ej: Ejemplar) {
  ejemplarModalProps.value = {
    edicionId: props.edicion?.idEdicion ?? 0,
    libroId: props.libroId,
    ejemplar: ej,
  }
  mostrarEjemplarModal.value = true
}

function onEjemplarGuardado() {
  mostrarEjemplarModal.value = false
  if (props.edicion?.idEdicion) cargarEjemplares()
  emit('saved')
}

// ── Helpers estado ────────────────────────────────────────────────
function estadoBadgeClass(estado: string): string {
  const map: Record<string, string> = {
    DISPONIBLE: 'bg-emerald-100 text-emerald-700',
    PRESTADO: 'bg-orange-100 text-orange-700',
    RESERVADO: 'bg-blue-100 text-blue-700',
    DETERIORADO: 'bg-amber-100 text-amber-700',
    EN_REPARACION: 'bg-purple-100 text-purple-700',
    DAÑADO: 'bg-red-100 text-red-700',
    BAJA: 'bg-slate-100 text-slate-500',
    PERDIDO: 'bg-slate-100 text-slate-500',
  }
  return map[estado] ?? 'bg-slate-100 text-slate-500'
}
</script>

<template>
  <BaseModal size="2xl" @close="emit('close')">

    <!-- ── Header ─────────────────────────────────────────────────── -->
    <template #header>
      <div class="flex items-center gap-3">
        <div class="w-9 h-9 rounded-xl bg-indigo-100 flex items-center justify-center flex-shrink-0">
          <svg class="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.586-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.414-8.414z" />
          </svg>
        </div>
        <div>
          <h2 class="text-base font-semibold text-slate-900">
            {{ modoEdicion ? 'Editar edición' : 'Nueva / Editar Edición' }}
          </h2>
          <p class="text-xs text-slate-500">Gestiona la información de la edición seleccionada.</p>
        </div>
      </div>
    </template>

    <div class="space-y-6">

      <!-- ══════════════════════════════════════════════════════════
           FORMULARIO EDICIÓN
      ══════════════════════════════════════════════════════════════ -->
      <div class="grid grid-cols-2 gap-5">

        <!-- Portada (columna izquierda) -->
        <div>
          <label class="block text-xs font-medium text-slate-600 mb-2">Portada</label>
          <label
            class="relative block w-full aspect-[3/4] max-w-[160px] rounded-xl overflow-hidden border-2 border-dashed border-slate-200 hover:border-indigo-300 bg-slate-50 cursor-pointer group transition-colors">
            <img v-if="portadaPreview" :src="portadaPreview" alt="Portada"
              class="absolute inset-0 w-full h-full object-cover" />
            <div v-else class="absolute inset-0 flex flex-col items-center justify-center gap-2">
              <svg class="w-8 h-8 text-slate-300 group-hover:text-indigo-400 transition-colors" fill="none"
                viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <div class="text-center">
                <p class="text-xs font-medium text-slate-400 group-hover:text-indigo-500 transition-colors">
                  Subir portada
                </p>
                <p class="text-xs text-slate-300">JPG, PNG máx. 5MB</p>
              </div>
            </div>
            <!-- Hover overlay cuando hay imagen -->
            <div v-if="portadaPreview"
              class="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
              <p class="text-white text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                Cambiar portada
              </p>
            </div>
            <input type="file" accept="image/*" class="sr-only" @change="onPortadaChange" />
          </label>
          <button v-if="portadaPreview" @click="limpiarPortada"
            class="mt-1.5 text-xs text-red-400 hover:text-red-600 transition-colors">
            Quitar portada
          </button>
        </div>

        <!-- Campos derecha -->
        <div class="space-y-3">
          <!-- ISBN -->
          <div>
            <label class="block text-xs font-medium text-slate-600 mb-1.5">
              ISBN <span class="text-red-400">*</span>
            </label>
            <div class="flex gap-2">
              <input v-model="form.isbn" type="text" placeholder="978-987-738-614-3"
                class="flex-1 text-sm font-mono rounded-xl border px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow"
                :class="errores.isbn ? 'border-red-400 bg-red-50' : 'border-slate-200'" />
              <button @click="generarIsbn"
                class="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-indigo-600 border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-colors whitespace-nowrap">
                <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Generar ISBN +
              </button>
            </div>
            <p v-if="errores.isbn" class="text-xs text-red-500 mt-1">{{ errores.isbn }}</p>
          </div>

          <!-- Editorial -->
          <div>
            <label class="block text-xs font-medium text-slate-600 mb-1.5">
              Editorial <span class="text-red-400">*</span>
            </label>
            <input v-model="form.editorial" type="text" placeholder="Alfaguara"
              class="w-full text-sm rounded-xl border px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow"
              :class="errores.editorial ? 'border-red-400 bg-red-50' : 'border-slate-200'" />
            <p v-if="errores.editorial" class="text-xs text-red-500 mt-1">{{ errores.editorial }}</p>
          </div>

          <!-- Año de publicación -->
          <div>
            <label class="block text-xs font-medium text-slate-600 mb-1.5">
              Año de publicación <span class="text-red-400">*</span>
            </label>
            <div class="relative">
              <input v-model.number="form.anoPublicacion" type="number" :min="1800" :max="new Date().getFullYear() + 1"
                class="w-full text-sm rounded-xl border border-slate-200 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow" />
              <svg class="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none"
                fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          </div>

          <!-- PDF -->
          <div>
            <label class="block text-xs font-medium text-slate-600 mb-1.5">PDF</label>
            <div class="grid grid-cols-2 gap-2">
              <!-- Subir PDF -->
              <div>
                <div v-if="!pdfNombre"
                  class="relative border-2 border-dashed border-slate-200 rounded-xl p-3 flex flex-col items-center gap-1.5 hover:border-indigo-300 hover:bg-indigo-50 transition-colors cursor-pointer"
                  @click="($refs.pdfInput as HTMLInputElement)?.click()">
                  <svg class="w-5 h-5 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  <span class="text-xs font-medium text-slate-500">Subir PDF</span>
                  <span class="text-xs text-slate-400">PDF máx. 50MB</span>
                  <input ref="pdfInput" type="file" accept=".pdf" class="sr-only" @change="onPdfChange" />
                </div>
                <div v-else class="border border-emerald-200 bg-emerald-50 rounded-xl p-3 flex items-center gap-2">
                  <svg class="w-4 h-4 text-emerald-500 flex-shrink-0" fill="none" viewBox="0 0 24 24"
                    stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                  </svg>
                  <span class="text-xs text-emerald-700 truncate flex-1">{{ pdfNombre }}</span>
                  <button @click="limpiarPdf" class="text-emerald-400 hover:text-red-500 flex-shrink-0">
                    <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              <!-- Estado PDF actual -->
              <div class="border border-dashed border-slate-200 rounded-xl p-3 flex flex-col items-center gap-1.5">
                <svg class="w-5 h-5" :class="pdfExiste ? 'text-red-500' : 'text-slate-300'" fill="none"
                  viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                    d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                <span class="text-xs" :class="pdfExiste ? 'text-red-600 font-medium' : 'text-slate-400'">
                  {{ pdfExiste ? 'PDF guardado' : 'Sin archivo' }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ══════════════════════════════════════════════════════════
           EJEMPLARES DE ESTA EDICIÓN
      ══════════════════════════════════════════════════════════════ -->
      <div v-if="modoEdicion">
        <div class="flex items-center justify-between mb-3">
          <div>
            <h3 class="text-sm font-semibold text-slate-800">Ejemplares de esta edición</h3>
            <p class="text-xs text-slate-500">Administra los ejemplares disponibles para esta edición.</p>
          </div>
          <button @click="abrirNuevoEjemplar"
            class="flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-indigo-600 border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-colors">
            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4" />
            </svg>
            Agregar ejemplar
          </button>
        </div>

        <!-- Tabla ejemplares -->
        <div class="border border-slate-200 rounded-xl overflow-hidden">
          <!-- Header -->
          <div class="grid grid-cols-12 gap-3 px-4 py-2.5 bg-slate-50 border-b border-slate-200">
            <span class="col-span-4 text-xs font-medium text-slate-500 uppercase tracking-wide">Código
              topográfico</span>
            <span class="col-span-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Código ejemplar</span>
            <span class="col-span-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Ubicación física</span>
            <span class="col-span-1 text-xs font-medium text-slate-500 uppercase tracking-wide">Estado</span>
            <span
              class="col-span-1 text-xs font-medium text-slate-500 uppercase tracking-wide text-right">Acciones</span>
          </div>

          <!-- Cargando -->
          <div v-if="cargandoEjs" class="px-4 py-6 text-center">
            <svg class="w-5 h-5 animate-spin text-slate-400 mx-auto" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>

          <!-- Sin ejemplares -->
          <div v-else-if="!ejemplares.length" class="px-4 py-6 text-center text-sm text-slate-400">
            No hay ejemplares para esta edición. Agrega el primero.
          </div>

          <!-- Filas -->
          <div v-for="(ej, i) in ejemplares" :key="ej.idEjemplar"
            class="grid grid-cols-12 gap-3 px-4 py-3 items-center hover:bg-slate-50 transition-colors"
            :class="i < ejemplares.length - 1 ? 'border-b border-slate-100' : ''">

            <span class="col-span-4 text-xs font-mono text-slate-700">{{ ej.codigoTopografico ?? '—' }}</span>
            <span class="col-span-3 text-xs font-mono text-slate-700">{{ ej.codigoEjemplar }}</span>
            <span class="col-span-3 text-xs text-slate-500 truncate">{{ ej.ubicacionFisica ?? '—' }}</span>

            <!-- Badge estado -->
            <div class="col-span-1">
              <span
                :class="['inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium', estadoBadgeClass(ej.estadoEjemplar)]">
                <span
                  :class="['w-1.5 h-1.5 rounded-full', estadoEjemplarConfig[ej.estadoEjemplar]?.dot ?? 'bg-slate-400']" />
                {{ estadoEjemplarConfig[ej.estadoEjemplar]?.label ?? ej.estadoEjemplar }}
              </span>
            </div>

            <!-- Acciones -->
            <div class="col-span-1 flex items-center justify-end gap-1">
              <button @click="abrirEditarEjemplar(ej)"
                class="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                title="Editar ejemplar">
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              </button>
              <button @click="abrirEditarEjemplar(ej)"
                class="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M12 5v.01M12 12v.01M12 19v.01" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      <p v-if="errorGuardar" class="text-sm text-red-600 bg-red-50 border border-red-200 px-4 py-2.5 rounded-xl">
        {{ errorGuardar }}
      </p>
    </div>

    <!-- ── Footer ─────────────────────────────────────────────────── -->
    <template #footer>
      <button @click="emit('close')"
        class="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">
        Cancelar
      </button>
      <button @click="guardar" :disabled="guardando"
        class="px-5 py-2 text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-colors disabled:opacity-60 flex items-center gap-2">
        <svg v-if="guardando" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <svg v-else class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        {{ guardando ? 'Guardando...' : 'Guardar edición' }}
      </button>
    </template>

  </BaseModal>

  <!-- ══════════════════════════════════════════════════════════════
       MODAL TERCIARIO — EJEMPLAR
  ══════════════════════════════════════════════════════════════════ -->
  <EjemplarModal v-if="mostrarEjemplarModal && ejemplarModalProps" :edicion-id="ejemplarModalProps.edicionId"
    :libro-id="ejemplarModalProps.libroId" :ejemplar="ejemplarModalProps.ejemplar" @close="mostrarEjemplarModal = false"
    @saved="onEjemplarGuardado" />
</template>