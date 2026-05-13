<script setup lang="ts">
/**
 * LibroLoteFormModal
 * ─────────────────────────────────────────────────────────────────────────────
 * Flujo unificado Libro + Edición + Ejemplares usando POST /api/catalogo/lote
 *
 * Pasos:
 *   1 — Libro   : título, autores (búsqueda/crear), categoría, descripción
 *   2 — Edición : ISBN, editorial, año, portada, PDF
 *   3 — Ejemplares: tabla dinámica con N ejemplares, códigos autogenerados
 *
 * El botón "Guardar todo" envía un único multipart/form-data al backend.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { ref, reactive, computed, watch, onMounted, nextTick } from 'vue'
import BaseModal from './BaseModal.vue'
import api from '@/services/axios'
import { bibliotecasService } from '@/services/bibliotecas.service'
import { obtenerCategorias } from '@/services/categorias.service'
import { useAuthStore } from '@/stores/auth.store'
import { usePermissions } from '@/composables/usePermissions'
import type { Categoria } from '@/types/catalogo'

// ── Props / emits ─────────────────────────────────────────────────────────
const emit = defineEmits<{ close: []; saved: [] }>()

const auth = useAuthStore()
const { isAdmin, isBibliotecario } = usePermissions()

// ══════════════════════════════════════════════════════════════════════════
// PASO ACTIVO
// ══════════════════════════════════════════════════════════════════════════
const paso = ref<1 | 2 | 3>(1)

// ══════════════════════════════════════════════════════════════════════════
// PASO 1 — LIBRO
// ══════════════════════════════════════════════════════════════════════════

// ── Categorías ────────────────────────────────────────────────────────────
const categorias = ref<Categoria[]>([])
const cargandoCategorias = ref(false)

onMounted(async () => {
  cargandoCategorias.value = true
  try {
    categorias.value = await obtenerCategorias()
  } finally {
    cargandoCategorias.value = false
  }
  await cargarBibliotecas()
})

// ── Libro ─────────────────────────────────────────────────────────────────
const libro = reactive({
  titulo: '',
  idioma: 'es',
  categoriaId: null as number | null,
  descripcion: '',
})
const erroresLibro = reactive<Record<string, string>>({})

// ── Autores ───────────────────────────────────────────────────────────────
interface AutorOpcion { idAutor?: number; nombre: string; nuevo?: boolean }
const autoresSeleccionados = ref<AutorOpcion[]>([])
const busquedaAutor = ref('')
const resultadosAutores = ref<AutorOpcion[]>([])
const buscandoAutores = ref(false)
const mostrarDropdownAutor = ref(false)
let timerAutor: ReturnType<typeof setTimeout>

watch(busquedaAutor, (q) => {
  clearTimeout(timerAutor)
  if (!q.trim()) { resultadosAutores.value = []; mostrarDropdownAutor.value = false; return }
  timerAutor = setTimeout(() => buscarAutores(q), 320)
})

async function buscarAutores(q: string) {
  buscandoAutores.value = true
  mostrarDropdownAutor.value = true
  try {
    const res = await api.get('/autores/search', { params: { q } })
    const data = res.data?.data ?? res.data
    resultadosAutores.value = Array.isArray(data) ? data : []
  } catch {
    resultadosAutores.value = []
  } finally {
    buscandoAutores.value = false
  }
}

function agregarAutorExistente(autor: AutorOpcion) {
  if (!autoresSeleccionados.value.find(a => a.idAutor === autor.idAutor)) {
    autoresSeleccionados.value.push(autor)
  }
  busquedaAutor.value = ''
  mostrarDropdownAutor.value = false
}

function crearNuevoAutor() {
  const nombre = busquedaAutor.value.trim()
  if (!nombre) return
  if (!autoresSeleccionados.value.find(a => a.nombre.toLowerCase() === nombre.toLowerCase())) {
    autoresSeleccionados.value.push({ nombre, nuevo: true })
  }
  busquedaAutor.value = ''
  mostrarDropdownAutor.value = false
}

function quitarAutor(idx: number) {
  autoresSeleccionados.value.splice(idx, 1)
}

// ── Categoría inline (crear nueva) ────────────────────────────────────────
const modoNuevaCategoria = ref(false)
const nuevaCategoriaNombre = ref('')
const nuevaCategoriaDescripcion = ref('')
const nuevaCategoriaDewey = ref('')

async function guardarNuevaCategoria() {
  if (!nuevaCategoriaNombre.value.trim()) return
  try {
    const res = await api.post('/categorias', {
      nombre_categoria: nuevaCategoriaNombre.value.trim(),
      descripcion: nuevaCategoriaDescripcion.value.trim() || undefined,
      codigo_dewey: nuevaCategoriaDewey.value.trim() || undefined,
    })
    const cat: Categoria = res.data?.data ?? res.data
    categorias.value.push(cat)
    libro.categoriaId = cat.id_categoria ?? cat.idCategoria ?? null
    modoNuevaCategoria.value = false
    nuevaCategoriaNombre.value = ''
    nuevaCategoriaDescripcion.value = ''
    nuevaCategoriaDewey.value = ''
  } catch (e: unknown) {
    // silencioso — mostrar en campo si se quiere extender
  }
}

// ══════════════════════════════════════════════════════════════════════════
// PASO 2 — EDICIÓN
// ══════════════════════════════════════════════════════════════════════════
const edicion = reactive({
  isbn: '',
  editorial: '',
  anoPublicacion: new Date().getFullYear(),
  edicion: '',
  numeroPaginas: null as number | null,
})
const erroresEdicion = reactive<Record<string, string>>({})
const portadaFile = ref<File | null>(null)
const portadaPreview = ref('')
const pdfFile = ref<File | null>(null)
const pdfNombre = ref('')

function onPortadaChange(ev: Event) {
  const file = (ev.target as HTMLInputElement).files?.[0]
  if (!file) return
  portadaFile.value = file
  const r = new FileReader()
  r.onload = (e) => { portadaPreview.value = e.target?.result as string }
  r.readAsDataURL(file)
}

function onPdfChange(ev: Event) {
  const file = (ev.target as HTMLInputElement).files?.[0]
  if (!file) return
  pdfFile.value = file
  pdfNombre.value = file.name
}

function limpiarPortada() { portadaFile.value = null; portadaPreview.value = '' }
function limpiarPdf() { pdfFile.value = null; pdfNombre.value = '' }

// ══════════════════════════════════════════════════════════════════════════
// PASO 3 — EJEMPLARES
// ══════════════════════════════════════════════════════════════════════════
interface BibliotecaOpcion { id: number; nombre: string }
const bibliotecas = ref<BibliotecaOpcion[]>([])
const cargandoBibs = ref(false)

const bibliotecaPropia = computed<BibliotecaOpcion | null>(() => {
  const lista = auth.user?.biblioteca
  if (!lista || lista.length === 0) return null
  const bib = lista[0]
  const id = (bib.id_biblioteca ?? bib.idBiblioteca ?? bib.id) as number | undefined
  const nombre = (bib.nombre ?? bib.name) as string | undefined
  return id && nombre ? { id, nombre } : null
})

async function cargarBibliotecas() {
  if (!isAdmin.value) {
    if (bibliotecaPropia.value) bibliotecas.value = [bibliotecaPropia.value]
    return
  }
  cargandoBibs.value = true
  try {
    const res = await bibliotecasService.getAll()
    const raw = res.data as unknown
    const lista = (Array.isArray(raw) ? raw : ((raw as any)?.data ?? [])) as any[]
    bibliotecas.value = lista
      .filter((b: any) => b.estado === 'ACTIVA' || !b.estado)
      .map((b: any) => ({
        id: b.id_biblioteca ?? b.idBiblioteca ?? b.id,
        nombre: b.nombre ?? b.name,
      }))
  } catch {
    bibliotecas.value = []
  } finally {
    cargandoBibs.value = false
  }
}

// ── Lógica de generación automática de códigos ───────────────────────────

function generarCodigoTopografico(idx: number): string {
  const primerAutor = autoresSeleccionados.value[0]
  const apellido = primerAutor
    ? primerAutor.nombre.trim().split(' ')[0].toUpperCase().slice(0, 3)
    : 'S_A'
  const tituloChunk = libro.titulo.trim().replace(/\s+/g, '').toUpperCase().slice(0, 3) || 'LIB'
  const base = `${apellido}-${tituloChunk}`
  return ejemplares.value.length > 1 ? `${base}-${idx + 1}` : base
}

function generarCodigoEjemplar(idx: number, subIdx: number = 1): string {
  const cat = categorias.value.find(c => (c.id_categoria ?? c.idCategoria) === libro.categoriaId)
  if (cat) {
    const prefix = (cat.nombre_categoria ?? cat.nombreCategoria ?? 'GEN').slice(0, 3).toUpperCase()
    const dewey = (cat.codigo_dewey ?? cat.codigoDewey ?? '000').slice(0, 3)
    return `${prefix}-${dewey}-Ej${idx + 1}-${subIdx}`
  }
  return `EJ-${idx + 1}-${subIdx}`
}

// ── Ejemplares ────────────────────────────────────────────────────────────
interface EjemplarRow {
  id: string
  bibliotecaId: number | null
  ubicacionFisica: string
  observaciones: string
  _codigoTopografico: string
  _codigoEjemplar: string
}

const ejemplares = ref<EjemplarRow[]>([])

function crearEjemplarVacio(idx: number): EjemplarRow {
  return {
    id: crypto.randomUUID(),
    bibliotecaId: bibliotecaPropia.value?.id ?? (bibliotecas.value[0]?.id ?? null),
    ubicacionFisica: '',
    observaciones: '',
    _codigoTopografico: generarCodigoTopografico(idx),
    _codigoEjemplar: generarCodigoEjemplar(idx),
  }
}

function agregarEjemplar() {
  ejemplares.value.push(crearEjemplarVacio(ejemplares.value.length))
}

function quitarEjemplar(idx: number) {
  if (ejemplares.value.length <= 1) return
  ejemplares.value.splice(idx, 1)
  recalcularCodigos()
}

function recalcularCodigos() {
  ejemplares.value.forEach((ej, i) => {
    ej._codigoTopografico = generarCodigoTopografico(i)
    ej._codigoEjemplar = generarCodigoEjemplar(i)
  })
}

// Inicializar con 1 ejemplar al montar paso 3
watch(paso, (p) => {
  if (p === 3 && ejemplares.value.length === 0) {
    agregarEjemplar()
  }
})

// Recalcular códigos cuando cambie título, autores o categoría
watch([() => libro.titulo, () => libro.categoriaId, autoresSeleccionados], recalcularCodigos, { deep: true })

// ══════════════════════════════════════════════════════════════════════════
// VALIDACIÓN POR PASO
// ══════════════════════════════════════════════════════════════════════════
function validarPaso1(): boolean {
  Object.keys(erroresLibro).forEach(k => delete erroresLibro[k])
  if (!libro.titulo.trim()) erroresLibro.titulo = 'El título es requerido'
  return Object.keys(erroresLibro).length === 0
}

function validarPaso2(): boolean {
  Object.keys(erroresEdicion).forEach(k => delete erroresEdicion[k])
  if (!edicion.isbn.trim()) erroresEdicion.isbn = 'El ISBN es requerido'
  if (!edicion.editorial.trim()) erroresEdicion.editorial = 'La editorial es requerida'
  return Object.keys(erroresEdicion).length === 0
}

function siguientePaso() {
  if (paso.value === 1 && !validarPaso1()) return
  if (paso.value === 2 && !validarPaso2()) return
  paso.value = (paso.value + 1) as 1 | 2 | 3
}

function anteriorPaso() {
  paso.value = (paso.value - 1) as 1 | 2 | 3
}

// ══════════════════════════════════════════════════════════════════════════
// GUARDAR — multipart/form-data → POST /api/catalogo/lote
// ══════════════════════════════════════════════════════════════════════════
const guardando = ref(false)
const errorGuardar = ref('')

async function guardarTodo() {
  errorGuardar.value = ''

  // Validar ejemplares mínimo
  const sinBiblioteca = ejemplares.value.some(e => !e.bibliotecaId)
  if (sinBiblioteca) { errorGuardar.value = 'Todos los ejemplares deben tener una biblioteca'; return }

  guardando.value = true
  try {
    // ── Construir JSON del lote ──────────────────────────────────────────
    const datos = {
      titulo: libro.titulo.trim(),
      idioma: libro.idioma,
      categoriaId: libro.categoriaId || undefined,
      descripcion: libro.descripcion.trim() || undefined,

      // Autores: los existentes van como autorIds, los nuevos como autores[]
      autorIds: autoresSeleccionados.value
        .filter(a => !a.nuevo && a.idAutor)
        .map(a => a.idAutor),
      autores: autoresSeleccionados.value
        .filter(a => a.nuevo)
        .map(a => ({ nombre: a.nombre })),

      ediciones: [
        {
          isbn: edicion.isbn.trim(),
          editorial: edicion.editorial.trim(),
          anoPublicacion: edicion.anoPublicacion,
          edicion: edicion.edicion.trim() || undefined,
          numeroPaginas: edicion.numeroPaginas || undefined,
          ejemplares: ejemplares.value.map(ej => ({
            bibliotecaId: ej.bibliotecaId,
            codigoEjemplar: ej._codigoEjemplar,
            codigoTopografico: ej._codigoTopografico,
            ubicacionFisica: ej.ubicacionFisica.trim() || undefined,
            observaciones: ej.observaciones.trim() || undefined,
          })),
        }
      ],
    }

    // ── Construir FormData ───────────────────────────────────────────────
    const fd = new FormData()
    fd.append('datos', new Blob([JSON.stringify(datos)], { type: 'application/json' }))

    if (portadaFile.value) fd.append('portada_0', portadaFile.value)
    if (pdfFile.value) fd.append('pdf_0', pdfFile.value)

    await api.post('/catalogo/lote', fd)
    emit('saved')
  } catch (e: unknown) {
    console.log('error', e.response)
    const err = e as any
    errorGuardar.value = err?.response?.data?.message
      ?? (e instanceof Error ? e.message : 'Error al guardar')
  } finally {
    guardando.value = false
  }
}

// ── Resumen para el paso 3 ────────────────────────────────────────────────
const resumenLibro = computed(() => {
  const partes: string[] = [libro.titulo || '—']
  if (edicion.isbn) partes.push(`ISBN ${edicion.isbn}`)
  return partes.join(' · ')
})

const categoriaActual = computed(() =>
  categorias.value.find(c => (c.id_categoria ?? c.idCategoria) === libro.categoriaId)
)
</script>

<template>
  <BaseModal title="Nuevo libro" size="xl" @close="emit('close')">

    <!-- ── Indicador de pasos ──────────────────────────────────────────── -->
    <div class="flex items-center gap-2 mb-7">
      <template v-for="n in [1, 2, 3]" :key="n">
        <div class="flex items-center gap-2 flex-shrink-0">
          <div :class="[
            'w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-all duration-200',
            paso === n ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-200 scale-110' :
              paso > n ? 'bg-emerald-500 text-white' :
                'bg-slate-100 text-slate-400'
          ]">
            <svg v-if="paso > n" class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
            </svg>
            <span v-else>{{ n }}</span>
          </div>
          <span class="text-xs hidden sm:inline font-medium"
            :class="paso === n ? 'text-indigo-600' : paso > n ? 'text-emerald-600' : 'text-slate-400'">
            {{ ['Libro', 'Edición', 'Ejemplares'][n - 1] }}
          </span>
        </div>
        <div v-if="n < 3" class="flex-1 h-px rounded transition-colors duration-300"
          :class="paso > n ? 'bg-emerald-300' : 'bg-slate-200'" />
      </template>
    </div>

    <!-- ════════════════════════════════════════════════════════════════════
         PASO 1 — LIBRO
    ════════════════════════════════════════════════════════════════════ -->
    <div v-if="paso === 1" class="space-y-5">

      <!-- Título -->
      <div>
        <label class="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">
          Título <span class="text-red-400">*</span>
        </label>
        <input v-model="libro.titulo" type="text" placeholder="Ej. Introducción a la Filosofía"
          class="w-full text-sm rounded-xl border px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow"
          :class="erroresLibro.titulo ? 'border-red-400 bg-red-50' : 'border-slate-200 bg-white'" />
        <p v-if="erroresLibro.titulo" class="text-xs text-red-500 mt-1">{{ erroresLibro.titulo }}</p>
      </div>

      <!-- Autores -->
      <div>
        <label class="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">Autores</label>

        <!-- Tags autores seleccionados -->
        <div v-if="autoresSeleccionados.length" class="flex flex-wrap gap-1.5 mb-2">
          <span v-for="(autor, i) in autoresSeleccionados" :key="i"
            class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
            :class="autor.nuevo ? 'bg-amber-100 text-amber-800 border border-amber-200' : 'bg-indigo-100 text-indigo-800 border border-indigo-200'">
            <span v-if="autor.nuevo" class="text-amber-600 font-bold">+</span>
            {{ autor.nombre }}
            <button @click="quitarAutor(i)" class="ml-0.5 text-slate-400 hover:text-red-500 transition-colors">
              <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </span>
        </div>

        <!-- Input búsqueda -->
        <div class="relative">
          <div class="relative">
            <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" fill="none"
              viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <input v-model="busquedaAutor" type="text" placeholder="Buscar autor o escribir nombre nuevo..."
              @focus="mostrarDropdownAutor = busquedaAutor.length > 0"
              @blur="setTimeout(() => { mostrarDropdownAutor = false }, 200)"
              class="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white" />
          </div>

          <!-- Dropdown resultados -->
          <div v-if="mostrarDropdownAutor"
            class="absolute z-20 top-full mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">

            <!-- Cargando -->
            <div v-if="buscandoAutores" class="flex items-center gap-2 px-4 py-3 text-xs text-slate-400">
              <svg class="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Buscando...
            </div>

            <template v-else>
              <!-- Resultados existentes -->
              <button v-for="autor in resultadosAutores" :key="autor.idAutor"
                @mousedown.prevent="agregarAutorExistente(autor)"
                class="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-left hover:bg-indigo-50 transition-colors">
                <div class="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                  <span class="text-xs font-semibold text-indigo-600">
                    {{ autor.nombre.charAt(0).toUpperCase() }}
                  </span>
                </div>
                <span class="text-slate-800 truncate">{{ autor.nombre }}</span>
              </button>

              <!-- Crear nuevo -->
              <button v-if="busquedaAutor.trim()" @mousedown.prevent="crearNuevoAutor"
                class="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-left hover:bg-amber-50 text-amber-700 border-t border-slate-100 transition-colors">
                <svg class="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                </svg>
                Crear "<strong>{{ busquedaAutor }}</strong>" como nuevo autor
              </button>

              <div v-if="!resultadosAutores.length && !busquedaAutor.trim()"
                class="px-4 py-3 text-xs text-slate-400 text-center">
                Escribe para buscar autores
              </div>
            </template>
          </div>
        </div>
        <p class="text-xs text-slate-400 mt-1.5">
          Los autores marcados con <span class="text-amber-600 font-semibold">+</span> se crearán al guardar
        </p>
      </div>

      <!-- Categoría + Idioma -->
      <div class="grid grid-cols-2 gap-4">
        <!-- Categoría -->
        <div>
          <label class="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">Categoría</label>
          <div v-if="!modoNuevaCategoria" class="flex gap-2">
            <select v-model="libro.categoriaId"
              class="flex-1 text-sm rounded-xl border border-slate-200 px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <option :value="null">Sin categoría</option>
              <option v-for="cat in categorias" :key="cat.id_categoria ?? cat.idCategoria"
                :value="cat.id_categoria ?? cat.idCategoria">
                {{ cat.nombre_categoria ?? cat.nombreCategoria }}
                <template v-if="cat.codigo_dewey ?? cat.codigoDewey">
                  ({{ cat.codigo_dewey ?? cat.codigoDewey }})
                </template>
              </option>
            </select>
            <button @click="modoNuevaCategoria = true"
              class="flex-shrink-0 w-10 h-10 flex items-center justify-center border border-slate-200 rounded-xl text-slate-500 hover:text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50 transition-colors"
              title="Nueva categoría">
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>

          <!-- Inline nueva categoría -->
          <div v-else class="p-3 border border-indigo-200 bg-indigo-50 rounded-xl space-y-2">
            <div class="flex items-center justify-between">
              <p class="text-xs font-semibold text-indigo-700">Nueva categoría</p>
              <button @click="modoNuevaCategoria = false" class="text-xs text-slate-400 hover:text-slate-600">
                Cancelar
              </button>
            </div>
            <input v-model="nuevaCategoriaNombre" type="text" placeholder="Nombre *"
              class="w-full text-sm rounded-lg border border-indigo-200 bg-white px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            <div class="grid grid-cols-2 gap-2">
              <input v-model="nuevaCategoriaDewey" type="text" placeholder="Código Dewey"
                class="w-full text-sm rounded-lg border border-indigo-200 bg-white px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              <button @click="guardarNuevaCategoria" :disabled="!nuevaCategoriaNombre.trim()"
                class="text-xs font-semibold bg-indigo-600 text-white rounded-lg px-3 py-1.5 hover:bg-indigo-700 transition-colors disabled:opacity-50">
                Crear
              </button>
            </div>
          </div>

          <!-- Badge categoría seleccionada -->
          <div v-if="categoriaActual && !modoNuevaCategoria" class="mt-1.5 flex items-center gap-1.5">
            <span
              class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-100 text-xs text-indigo-700 font-medium">
              <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
              {{ categoriaActual.nombre_categoria ?? categoriaActual.nombreCategoria }}
            </span>
          </div>
        </div>

        <!-- Idioma -->
        <div>
          <label class="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">Idioma</label>
          <select v-model="libro.idioma"
            class="w-full text-sm rounded-xl border border-slate-200 px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
            <option value="es">🇧🇴 Español</option>
            <option value="en">🇺🇸 Inglés</option>
            <option value="pt">🇧🇷 Portugués</option>
            <option value="fr">🇫🇷 Francés</option>
            <option value="de">🇩🇪 Alemán</option>
          </select>
        </div>
      </div>

      <!-- Descripción -->
      <div>
        <label class="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">Descripción</label>
        <textarea v-model="libro.descripcion" rows="2" placeholder="Descripción breve del libro (opcional)..."
          class="w-full text-sm rounded-xl border border-slate-200 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
      </div>
    </div>

    <!-- ════════════════════════════════════════════════════════════════════
         PASO 2 — EDICIÓN
    ════════════════════════════════════════════════════════════════════ -->
    <div v-if="paso === 2" class="space-y-5">

      <!-- Portada + ISBN/Editorial lado a lado -->
      <div class="flex gap-5">

        <!-- Portada -->
        <div class="flex-shrink-0">
          <label class="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">Portada</label>
          <label
            class="relative block w-24 h-32 rounded-xl overflow-hidden bg-gradient-to-br from-slate-100 to-slate-50 border-2 border-dashed border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 transition-colors cursor-pointer group">
            <img v-if="portadaPreview" :src="portadaPreview" alt="Portada"
              class="absolute inset-0 w-full h-full object-cover" />
            <div v-else class="absolute inset-0 flex flex-col items-center justify-center gap-1.5">
              <svg class="w-7 h-7 text-slate-300 group-hover:text-indigo-400 transition-colors" fill="none"
                viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span class="text-xs text-slate-400 text-center leading-tight px-1">Clic para subir</span>
            </div>
            <div v-if="portadaPreview"
              class="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
              <svg class="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-md"
                fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16" />
              </svg>
            </div>
            <input type="file" accept="image/*" class="sr-only" @change="onPortadaChange" />
          </label>
          <button v-if="portadaPreview" @click="limpiarPortada"
            class="mt-1 text-xs text-red-400 hover:text-red-600 transition-colors w-full text-center">
            Quitar
          </button>
        </div>

        <!-- Campos edición -->
        <div class="flex-1 space-y-3">
          <div>
            <label class="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">
              ISBN <span class="text-red-400">*</span>
            </label>
            <input v-model="edicion.isbn" type="text" placeholder="978-0-000-00000-0"
              class="w-full text-sm rounded-xl border px-4 py-2.5 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
              :class="erroresEdicion.isbn ? 'border-red-400 bg-red-50' : 'border-slate-200'" />
            <p v-if="erroresEdicion.isbn" class="text-xs text-red-500 mt-1">{{ erroresEdicion.isbn }}</p>
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">
              Editorial <span class="text-red-400">*</span>
            </label>
            <input v-model="edicion.editorial" type="text" placeholder="Ej. Siglo XXI"
              class="w-full text-sm rounded-xl border px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              :class="erroresEdicion.editorial ? 'border-red-400 bg-red-50' : 'border-slate-200'" />
            <p v-if="erroresEdicion.editorial" class="text-xs text-red-500 mt-1">{{ erroresEdicion.editorial }}</p>
          </div>
        </div>
      </div>

      <!-- Año, edición, páginas -->
      <div class="grid grid-cols-3 gap-4">
        <div>
          <label class="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">Año</label>
          <input v-model.number="edicion.anoPublicacion" type="number" :min="1800" :max="new Date().getFullYear() + 1"
            class="w-full text-sm rounded-xl border border-slate-200 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
        <div>
          <label class="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">Edición</label>
          <input v-model="edicion.edicion" type="text" placeholder="1ra, 2da..."
            class="w-full text-sm rounded-xl border border-slate-200 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
        <div>
          <label class="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">Páginas</label>
          <input v-model.number="edicion.numeroPaginas" type="number" placeholder="350"
            class="w-full text-sm rounded-xl border border-slate-200 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
      </div>

      <!-- PDF -->
      <div>
        <label class="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">
          PDF Digital <span class="text-slate-400 font-normal normal-case">(opcional)</span>
        </label>
        <div v-if="!pdfNombre"
          class="relative border-2 border-dashed border-slate-200 rounded-xl p-4 flex items-center gap-3 hover:border-indigo-300 hover:bg-indigo-50 transition-colors cursor-pointer"
          @click="($refs.pdfInput as HTMLInputElement)?.click()">
          <svg class="w-8 h-8 text-slate-300 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
              d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
          <div>
            <p class="text-sm font-medium text-slate-600">Arrastra un PDF o haz clic para seleccionar</p>
            <p class="text-xs text-slate-400">Solo archivos .pdf</p>
          </div>
          <input ref="pdfInput" type="file" accept=".pdf" class="sr-only" @change="onPdfChange" />
        </div>
        <div v-else class="flex items-center gap-3 p-3 border border-emerald-200 bg-emerald-50 rounded-xl">
          <svg class="w-8 h-8 text-emerald-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-medium text-emerald-800 truncate">{{ pdfNombre }}</p>
            <p class="text-xs text-emerald-600">PDF cargado correctamente</p>
          </div>
          <button @click="limpiarPdf" class="text-emerald-400 hover:text-red-500 transition-colors p-1">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>

    <!-- ════════════════════════════════════════════════════════════════════
         PASO 3 — EJEMPLARES
    ════════════════════════════════════════════════════════════════════ -->
    <div v-if="paso === 3" class="space-y-4">

      <!-- Resumen libro + edición -->
      <div class="flex items-start gap-3 p-3.5 bg-indigo-50 border border-indigo-100 rounded-xl">
        <div v-if="portadaPreview" class="flex-shrink-0">
          <img :src="portadaPreview" alt="Portada" class="w-10 h-13 object-cover rounded-lg border border-indigo-200" />
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-semibold text-indigo-900 truncate">{{ libro.titulo || '—' }}</p>
          <p class="text-xs text-indigo-600">{{ edicion.isbn ? `ISBN ${edicion.isbn}` : '' }}
            <template v-if="edicion.editorial"> · {{ edicion.editorial }}</template>
            <template v-if="edicion.anoPublicacion"> · {{ edicion.anoPublicacion }}</template>
          </p>
          <p v-if="categoriaActual" class="text-xs text-indigo-500 mt-0.5">
            📂 {{ categoriaActual.nombre_categoria ?? categoriaActual.nombreCategoria }}
          </p>
        </div>
      </div>

      <!-- Tabla ejemplares -->
      <div>
        <div class="flex items-center justify-between mb-3">
          <div>
            <h3 class="text-sm font-semibold text-slate-800">Ejemplares físicos</h3>
            <p class="text-xs text-slate-500">{{ ejemplares.length }} ejemplar{{ ejemplares.length !== 1 ? 'es' : '' }}
              ·
              Los códigos se generan automáticamente</p>
          </div>
          <button @click="agregarEjemplar"
            class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors">
            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4" />
            </svg>
            Agregar ejemplar
          </button>
        </div>

        <!-- Filas de ejemplares -->
        <div class="space-y-3 max-h-80 overflow-y-auto pr-1">
          <div v-for="(ej, idx) in ejemplares" :key="ej.id"
            class="rounded-xl border border-slate-200 bg-white overflow-hidden hover:border-indigo-200 transition-colors">

            <!-- Header del ejemplar -->
            <div class="flex items-center justify-between px-4 py-2.5 bg-slate-50 border-b border-slate-100">
              <div class="flex items-center gap-3">
                <span
                  class="w-5 h-5 flex-shrink-0 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center">
                  {{ idx + 1 }}
                </span>
                <div class="flex items-center gap-2">
                  <span class="text-xs font-mono font-semibold text-slate-600">{{ ej._codigoEjemplar }}</span>
                  <span class="text-slate-300 text-xs">·</span>
                  <span class="text-xs font-mono text-slate-500">{{ ej._codigoTopografico }}</span>
                </div>
              </div>
              <button v-if="ejemplares.length > 1" @click="quitarEjemplar(idx)"
                class="p-1 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <!-- Cuerpo del ejemplar -->
            <div class="px-4 py-3 grid grid-cols-2 gap-3">
              <!-- Biblioteca -->
              <div>
                <label class="block text-xs text-slate-500 mb-1">Biblioteca *</label>
                <div v-if="!isAdmin && bibliotecaPropia" class="text-xs font-medium text-slate-700 py-1.5">
                  {{ bibliotecaPropia.nombre }}
                </div>
                <select v-else v-model="ej.bibliotecaId"
                  class="w-full text-xs rounded-lg border border-slate-200 px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option :value="null" disabled>Seleccionar</option>
                  <option v-for="bib in bibliotecas" :key="bib.id" :value="bib.id">{{ bib.nombre }}</option>
                </select>
              </div>

              <!-- Ubicación -->
              <div>
                <label class="block text-xs text-slate-500 mb-1">Ubicación física</label>
                <input v-model="ej.ubicacionFisica" type="text" placeholder="Estante A-1, Fila 2"
                  class="w-full text-xs rounded-lg border border-slate-200 px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>

              <!-- Observaciones (span 2 cols) -->
              <div class="col-span-2">
                <label class="block text-xs text-slate-500 mb-1">Observaciones</label>
                <input v-model="ej.observaciones" type="text" placeholder="Donación FHCE 2024, estado: nuevo..."
                  class="w-full text-xs rounded-lg border border-slate-200 px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Nota códigos -->
      <div class="flex items-start gap-2.5 p-3 bg-amber-50 border border-amber-100 rounded-xl">
        <svg class="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div class="text-xs text-amber-700 space-y-0.5">
          <p>
            <strong>Código topográfico:</strong>
            3 letras del apellido + 3 letras del título
            <template v-if="ejemplares.length > 1">, con sufijo numérico incremental</template>.
          </p>
          <p>
            <strong>Código de ejemplar:</strong>
            {{ categoriaActual
              ? `${(categoriaActual.nombre_categoria ?? categoriaActual.nombreCategoria ?? '').slice(0,
                3).toUpperCase()}-${categoriaActual.codigo_dewey ?? categoriaActual.codigoDewey}-Ej[n]-[m]`
              : 'EJ-[n]-[m] (sin categoría)'
            }}
          </p>
        </div>
      </div>

      <!-- Error global -->
      <p v-if="errorGuardar" class="text-sm text-red-600 bg-red-50 border border-red-200 px-4 py-2.5 rounded-xl">
        {{ errorGuardar }}
      </p>
    </div>

    <!-- ── Footer ─────────────────────────────────────────────────────────── -->
    <template #footer>
      <!-- Volver -->
      <button v-if="paso > 1" @click="anteriorPaso"
        class="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors mr-auto flex items-center gap-1.5">
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
        </svg>
        Volver
      </button>

      <!-- Cancelar -->
      <button @click="emit('close')"
        class="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
        Cancelar
      </button>

      <!-- Siguiente / Guardar todo -->
      <button v-if="paso < 3" @click="siguientePaso"
        class="px-5 py-2 text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors flex items-center gap-2">
        Siguiente
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
        </svg>
      </button>

      <button v-else @click="guardarTodo" :disabled="guardando"
        class="px-5 py-2 text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2">
        <svg v-if="guardando" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <svg v-else class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
        </svg>
        {{ guardando ? 'Guardando...' : 'Guardar todo' }}
      </button>
    </template>
  </BaseModal>
</template>