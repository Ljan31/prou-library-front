<script setup lang="ts">
/**
 * LibroRapidoModal
 * ─────────────────────────────────────────────────────────────────────────────
 * Creación / edición rápida de un libro con su edición y N ejemplares.
 * Inspirado en el catálogo real de las bibliotecas UMSA:
 *
 *   COLECCIÓN | CÓDIGO PARA SOLICITAR          | AUTOR(ES)  | TÍTULO
 *             | [decimal] [cutter] [tit] [Ej.N]|            |
 *
 * El backend acepta en el ejemplar:
 *   clasificacionDecimal, cutterAutor, cutterTitulo
 * Genera automáticamente el sufijo "Ej.N" por cada ejemplar.
 *
 * Flujo:
 *   1. Datos del libro  (título, autores, categoría, idioma, descripción)
 *   2. Datos de edición (editorial, año, ISBN opcionales; portada/PDF opcionales)
 *   3. Datos de ejemplares (biblioteca, ubicación, nº de ejemplares, clasificación)
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { ref, reactive, computed, watch, onMounted } from 'vue'
import BaseModal from '../catalogo/BaseModal.vue'
import api from '@/services/axios'
import { obtenerCategorias } from '@/services/categorias.service'
import { bibliotecasService } from '@/services/bibliotecas.service'
import { useAuthStore } from '@/stores/auth.store'
import { usePermissions } from '@/composables/usePermissions'
import type { Categoria } from '@/types/catalogo'

// ── Props / emits ─────────────────────────────────────────────────────────
/**
 * libroId → modo edición (se pre-rellena todo)
 * sin libroId → modo creación
 */
const props = defineProps<{ libroId?: number | null }>()
const emit = defineEmits<{ close: []; saved: [] }>()

const auth = useAuthStore()
const { isAdmin } = usePermissions()

// ══════════════════════════════════════════════════════════════════════════
// PASO ACTIVO  1 · 2 · 3
// ══════════════════════════════════════════════════════════════════════════
const paso = ref<1 | 2 | 3>(1)
const modoEdicion = computed(() => !!props.libroId)

// ══════════════════════════════════════════════════════════════════════════
// DATOS AUXILIARES
// ══════════════════════════════════════════════════════════════════════════
const categorias = ref<Categoria[]>([])
const bibliotecas = ref<{ id: number; nombre: string }[]>([])
const cargandoInicial = ref(false)

const bibliotecaPropia = computed(() => {
  const lista = auth.user?.biblioteca
  if (!lista?.length) return null
  const b = lista[0]
  const id = b.id_biblioteca ?? b.idBiblioteca ?? b.id
  const nombre = b.nombre ?? b.name
  return id && nombre ? { id, nombre } : null
})

onMounted(async () => {
  cargandoInicial.value = true
  try {
    const [cats] = await Promise.all([
      obtenerCategorias(),
      cargarBibliotecas(),
    ])
    categorias.value = cats
    if (props.libroId) await precargarLibro(props.libroId)
  } finally {
    cargandoInicial.value = false
  }
})

async function cargarBibliotecas() {
  if (!isAdmin.value) {
    if (bibliotecaPropia.value) bibliotecas.value = [bibliotecaPropia.value]
    return
  }
  try {
    const res = await bibliotecasService.getAll()
    const raw = (res.data as any)?.data ?? res.data
    const lista = Array.isArray(raw) ? raw : []
    bibliotecas.value = lista
      .filter((b: any) => b.estado === 'ACTIVA' || !b.estado)
      .map((b: any) => ({
        id: b.id_biblioteca ?? b.idBiblioteca ?? b.id,
        nombre: b.nombre ?? b.name,
      }))
  } catch { }
}

// ══════════════════════════════════════════════════════════════════════════
// PASO 1 — LIBRO
// ══════════════════════════════════════════════════════════════════════════
const libro = reactive({
  titulo: '',
  autores: '',       // separado por comas
  categoriaId: null as number | null,
  idioma: 'es',
  descripcion: '',
})
const erroresLibro = reactive<Record<string, string>>({})

// Búsqueda de autor con autocompletado simple
interface AutorOpcion { idAutor?: number; nombre: string; nuevo?: boolean }
const autoresSeleccionados = ref<AutorOpcion[]>([])
const busquedaAutor = ref('')
const resultadosAutor = ref<AutorOpcion[]>([])
const buscandoAutor = ref(false)
const showDropAutor = ref(false)
let timerAutor: ReturnType<typeof setTimeout>

watch(busquedaAutor, (q) => {
  clearTimeout(timerAutor)
  if (!q.trim()) { resultadosAutor.value = []; showDropAutor.value = false; return }
  timerAutor = setTimeout(() => buscarAutores(q), 300)
})

async function buscarAutores(q: string) {
  buscandoAutor.value = true; showDropAutor.value = true
  try {
    const res = await api.get('/autores/search', { params: { q } })
    resultadosAutor.value = Array.isArray(res.data?.data) ? res.data.data : []
  } catch { resultadosAutor.value = [] }
  finally { buscandoAutor.value = false }
}

function elegirAutor(nombre: string) {
  const actual = libro.autores.trim()
  libro.autores = actual ? `${actual}; ${nombre}` : nombre
  busquedaAutor.value = ''; showDropAutor.value = false
}

function agregarAutorExistente(autor: AutorOpcion) {
  if (!autoresSeleccionados.value.find(a => a.idAutor === autor.idAutor)) {
    autoresSeleccionados.value.push(autor)
  }
  busquedaAutor.value = ''
  showDropAutor.value = false
}

function crearNuevoAutor() {
  const nombre = busquedaAutor.value.trim()
  if (!nombre) return
  if (!autoresSeleccionados.value.find(a => a.nombre.toLowerCase() === nombre.toLowerCase())) {
    autoresSeleccionados.value.push({ nombre, nuevo: true })
  }
  busquedaAutor.value = ''
  showDropAutor.value = false
}

function quitarAutor(idx: number) {
  autoresSeleccionados.value.splice(idx, 1)
}

const busquedaCategoria = ref('')
const mostrarCategorias = ref(false)

const categoriasFiltradas = computed(() => {
  const q = busquedaCategoria.value.toLowerCase().trim()

  if (!q) return categorias.value

  return categorias.value.filter(cat => {
    const nombre = (
      cat.nombre_categoria ??
      cat.nombreCategoria ??
      ''
    ).toLowerCase()

    const dewey = (
      cat.codigo_dewey ??
      cat.codigoDewey ??
      ''
    ).toLowerCase()

    return nombre.includes(q) || dewey.includes(q)
  })
})
const seleccionarCategoria = (cat: any) => {
  libro.categoriaId = cat.id_categoria ?? cat.idCategoria

  busquedaCategoria.value =
    cat.nombre_categoria ?? cat.nombreCategoria

  mostrarCategorias.value = false
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
  edicionTexto: '1ra',       // "1ra", "2da"…
  numeroPaginas: null as number | null,
})

// Archivos opcionales
const portadaFile = ref<File | null>(null)
const portadaPreview = ref('')
const pdfFile = ref<File | null>(null)
const pdfNombre = ref('')

function onPortada(ev: Event) {
  const f = (ev.target as HTMLInputElement).files?.[0]; if (!f) return
  portadaFile.value = f
  const r = new FileReader(); r.onload = e => { portadaPreview.value = e.target?.result as string }; r.readAsDataURL(f)
}
function onPdf(ev: Event) {
  const f = (ev.target as HTMLInputElement).files?.[0]; if (!f) return
  pdfFile.value = f; pdfNombre.value = f.name
}
function quitarPortada() { portadaFile.value = null; portadaPreview.value = '' }
function quitarPdf() { pdfFile.value = null; pdfNombre.value = '' }

// ══════════════════════════════════════════════════════════════════════════
// PASO 3 — EJEMPLARES
// ══════════════════════════════════════════════════════════════════════════
const ej = reactive({
  bibliotecaId: null as number | null,
  ubicacionFisica: '',
  clasificacionDecimal: '',
  cutterAutor: '',
  cutterTitulo: '',
  cantidadEjemplares: 1,
  estadoEjemplar: 'DISPONIBLE',
  fechaAdquisicion: new Date().toISOString().split('T')[0],
  precioCompra: null as number | null,
  observaciones: '',
})
const erroresEj = reactive<Record<string, string>>({})

// Inicializar biblioteca del bibliotecario
watch(bibliotecas, (lista) => {
  if (!ej.bibliotecaId && lista.length) ej.bibliotecaId = lista[0].id
}, { immediate: true })

// Código para solicitar — preview en tiempo real
const codigoPreview = computed(() => {
  const dec = ej.clasificacionDecimal.trim() || '___'
  const aut = ej.cutterAutor.trim() || '___'
  const tit = ej.cutterTitulo.trim() || '___'
  const cant = ej.cantidadEjemplares
  if (cant <= 1) return `${dec}  ${aut}  ${tit}`
  return Array.from({ length: Math.min(cant, 5) }, (_, i) =>
    `${dec}  ${aut}  ${tit}  Ej.${i + 1}`
  ).join('\n')
})

watch(() => libro.categoriaId, (idCategoria) => {

  const categoria = categorias.value.find(
    c => (c.id_categoria ?? c.idCategoria) === idCategoria
  )

  if (!categoria) {
    ej.clasificacionDecimal = ''
    return
  }

  ej.clasificacionDecimal =
    categoria.codigo_dewey ??
    categoria.codigoDewey ??
    ''

})

// Auto-rellenar cutter autor a partir del campo autores del libro
watch(autoresSeleccionados, (autores) => {
  libro.autores = autores
    .map(a => a.nombre)
    .join('; ')

  if (!autores.length) {
    ej.cutterAutor = ''
    return
  }

  const primerAutor = autores[0].nombre.trim()

  ej.cutterAutor = primerAutor
    .split(' ')[0]
    .slice(0, 3)
    .toUpperCase()

}, { deep: true })
// Auto-rellenar cutter título
watch(() => libro.titulo, (v) => {
  // if (ej.cutterTitulo) return
  ej.cutterTitulo = v.replace(/^(el|la|los|las|un|una|the|a)\s+/i, '')
    .replace(/\s+/g, '').slice(0, 3).toLowerCase()
})

// ══════════════════════════════════════════════════════════════════════════
// PRE-CARGA (modo edición)
// ══════════════════════════════════════════════════════════════════════════
async function precargarLibro(id: number) {
  try {
    const res = await api.get(`/libros/${id}`)
    const data = res.data?.data ?? res.data
    libro.titulo = data.titulo ?? ''
    libro.autores = (data.autores ?? []).map((a: any) => a.nombre).join('; ')
    libro.categoriaId = data.categoria?.id_categoria ?? data.categoria?.idCategoria ?? null
    libro.idioma = data.idioma ?? 'es'
    libro.descripcion = data.descripcion ?? ''

    const primeraEd = data.ediciones?.[0]
    if (primeraEd) {
      edicion.isbn = primeraEd.isbn ?? ''
      edicion.editorial = primeraEd.editorial ?? ''
      edicion.anoPublicacion = primeraEd.anoPublicacion ?? new Date().getFullYear()
      edicion.edicionTexto = primeraEd.edicion ?? ''
      edicion.numeroPaginas = primeraEd.numeroPaginas ?? null
      if (primeraEd.imagenPortada) portadaPreview.value = primeraEd.imagenPortada
    }
    const primerEj = data.ediciones?.[0]?.ejemplares?.[0]
    if (primerEj) {
      ej.clasificacionDecimal = primerEj.clasificacionDecimal ?? ''
      ej.cutterAutor = primerEj.cutterAutor ?? ''
      ej.cutterTitulo = primerEj.cutterTitulo ?? ''
      ej.ubicacionFisica = primerEj.ubicacionFisica ?? ''
      ej.bibliotecaId = primerEj.biblioteca?.idBiblioteca ?? null
    }
  } catch { }
}

// ══════════════════════════════════════════════════════════════════════════
// VALIDACIÓN POR PASO
// ══════════════════════════════════════════════════════════════════════════
function validarPaso1(): boolean {
  Object.keys(erroresLibro).forEach(k => delete erroresLibro[k])
  if (!libro.titulo.trim()) erroresLibro.titulo = 'El título es obligatorio'
  if (!edicion.isbn.trim()) erroresLibro.isbn = 'El ISBN es obligatorio'
  // if (!libro.autores.trim()) erroresLibro.autores = 'Al menos un autor es obligatorio'
  return !Object.keys(erroresLibro).length
}

function validarPaso3(): boolean {
  console.log('validar3')
  Object.keys(erroresEj).forEach(k => delete erroresEj[k])
  if (!ej.bibliotecaId) erroresEj.biblioteca = 'Selecciona una biblioteca'
  if (ej.cantidadEjemplares < 1) erroresEj.cantidad = 'Mínimo 1 ejemplar'
  if (ej.cantidadEjemplares > 50) erroresEj.cantidad = 'Máximo 50 ejemplares por vez'
  return !Object.keys(erroresEj).length
}

function siguiente() {
  if (paso.value === 1 && !validarPaso1()) return
  paso.value = (paso.value + 1) as 1 | 2 | 3
}
function anterior() { paso.value = (paso.value - 1) as 1 | 2 | 3 }

// ══════════════════════════════════════════════════════════════════════════
// GUARDAR — POST /api/catalogo/lote
// ══════════════════════════════════════════════════════════════════════════
const guardando = ref(false)
const errorGuardar = ref('')

async function guardar() {
  if (!validarPaso1()) return
  if (!validarPaso3()) return
  console.log('paso validar3')
  guardando.value = true; errorGuardar.value = ''
  try {
    // Construir N ejemplares con sufijo Ej.N
    const ejemplaresPayload = Array.from(
      { length: ej.cantidadEjemplares },
      (_, i) => ({
        bibliotecaId: ej.bibliotecaId,
        ubicacionFisica: ej.ubicacionFisica.trim() || undefined,
        clasificacionDecimal: ej.clasificacionDecimal.trim() || undefined,
        cutterAutor: ej.cutterAutor.trim() || undefined,
        codigoEjemplar: ej.cantidadEjemplares >= 1
          ? `${ej.cutterTitulo.trim()} Ej.${i + 1}`
          : ej.cutterTitulo.trim() || undefined,
        cutterTitulo: ej.cantidadEjemplares > 1
          ? `${ej.cutterTitulo.trim()} Ej.${i + 1}`
          : ej.cutterTitulo.trim() || undefined,

        estadoEjemplar: ej.estadoEjemplar,
        fechaAdquisicion: ej.fechaAdquisicion || new Date().toISOString().split('T')[0],
        precioCompra: ej.precioCompra,
        observaciones: ej.observaciones.trim() || undefined,
      })
    )

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
      ediciones: [{
        isbn: edicion.isbn.trim() || undefined,
        editorial: edicion.editorial.trim() || undefined,
        anoPublicacion: edicion.anoPublicacion,
        edicion: edicion.edicionTexto.trim() || undefined,
        numeroPaginas: edicion.numeroPaginas || undefined,
        ejemplares: ejemplaresPayload,
      }],
    }

    const fd = new FormData()
    fd.append('datos', new Blob([JSON.stringify(datos)], { type: 'application/json' }))
    if (portadaFile.value) fd.append('portada_0', portadaFile.value)
    if (pdfFile.value) fd.append('pdf_0', pdfFile.value)

    if (modoEdicion.value) {
      // Edición: PUT libro + PUT edición
      await api.put(`/libros/${props.libroId}`, {
        titulo: datos.titulo,
        idioma: datos.idioma,
        categoriaId: datos.categoriaId,
        descripcion: datos.descripcion,
        autores: datos.autores,
      })
    } else {
      console.log('====================')
      console.log('📦 PAYLOAD JSON')
      console.log(JSON.stringify(datos, null, 2))
      console.log('====================')
      for (const pair of fd.entries()) {
        console.log(pair[0], pair[1])
      }
      await api.post('/catalogo/lote', fd)
    }

    emit('saved')
  } catch (e: unknown) {
    console.log('error', e)
    console.log(e.response)
    const err = e as any
    if (err?.response?.data?.message?.includes('ISBN')) {
      erroresLibro.isbn = err?.response?.data?.message
    }
    errorGuardar.value = err?.response?.data?.message
      ?? (e instanceof Error ? e.message : 'Error al guardar')
  } finally {
    guardando.value = false
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────
const categoriaActual = computed(() =>
  categorias.value.find(c => (c.id_categoria ?? c.idCategoria) === libro.categoriaId)
)
const pasoLabels = ['Libro', 'Edición', 'Ejemplares']
const cerrarDropdownAutor = () => {
  setTimeout(() => {
    showDropAutor.value = false
  }, 180)
}
const ocultarCategorias = () => {
  window.setTimeout(() => {
    mostrarCategorias.value = false
  }, 150)
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
              d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.523 5.754 19 7.5 19s3.332-.477 4.5-1.253" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M12 6.253C13.168 5.477 14.754 5 16.5 5s3.332.477 4.5 1.253v13C19.832 18.523 18.246 19 16.5 19s-3.332-.477-4.5-1.253" />
          </svg>
        </div>
        <div>
          <h2 class="text-base font-semibold text-slate-900">
            {{ modoEdicion ? 'Editar libro' : 'Registro rápido de libro' }}
          </h2>
          <p class="text-xs text-slate-500">
            {{
              modoEdicion
                ? 'Modifica los datos del libro y sus ejemplares.'
                : 'Registra un libro con su código de solicitar y ejemplares.'
            }}
          </p>
        </div>
        <div>
          <!-- <label class="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
            Biblioteca <span class="text-red-400">*</span>
          </label> -->
          <div v-if="!isAdmin && bibliotecaPropia"
            class="flex items-center gap-2.5 px-3 py-2.5 bg-indigo-50 border border-indigo-200 rounded-xl">
            <svg class="w-4 h-4 text-indigo-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4" />
            </svg>
            <span class="text-sm font-medium text-indigo-700">{{ bibliotecaPropia.nombre }}</span>
          </div>
          <select v-else v-model="ej.bibliotecaId"
            class="w-full text-sm rounded-xl border px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none"
            :class="erroresEj.biblioteca ? 'border-red-400' : 'border-slate-200'">
            <option :value="null" disabled>Seleccionar biblioteca</option>
            <option v-for="bib in bibliotecas" :key="bib.id" :value="bib.id">{{ bib.nombre }}</option>
          </select>
          <p v-if="erroresEj.biblioteca" class="text-xs text-red-500 mt-1">{{ erroresEj.biblioteca }}</p>
        </div>
      </div>
    </template>

    <!-- ── Indicador de pasos ──────────────────────────────────────── -->


    <!-- Cargando inicial -->
    <div v-if="cargandoInicial" class="flex items-center justify-center py-12 gap-3">
      <svg class="w-6 h-6 animate-spin text-indigo-400" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
      <span class="text-sm text-slate-400">Cargando...</span>
    </div>

    <template v-else>

      <!-- ════════════════════════════════════════════════════════════
           PASO 1 — LIBRO
      ════════════════════════════════════════════════════════════════ -->
      <div v-if="paso === 1" class="space-y-4">
        <div class="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
          <!-- Título -->
          <div class="md:col-span-6">
            <label class="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
              Título <span class="text-red-400">*</span>
            </label>
            <input v-model="libro.titulo" rows="3" placeholder="Ej. BIO-BIBLIOGRAFÍA BOLIVIANA 2000" class="w-full text-sm rounded-xl border px-4 py-2.5
         focus:outline-none focus:ring-2 focus:ring-indigo-500
         transition-shadow resize-none" :class="erroresLibro.titulo
          ? 'border-red-400 bg-red-50'
          : 'border-slate-200'"></input>
            <p v-if="erroresLibro.titulo" class="text-xs text-red-500 mt-1">{{ erroresLibro.titulo }}</p>
          </div>

          <!-- PORTADA -->
          <div class="md:col-span-2 md:row-span-2">
            <label class="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
              Portada <span class="text-slate-400 font-normal normal-case">(opcional)</span>
            </label>
            <label
              class="relative block w-28 aspect-[3/4] rounded-xl overflow-hidden border-2 border-dashed border-slate-200 hover:border-indigo-300 bg-slate-50 cursor-pointer group transition-colors">
              <img v-if="portadaPreview" :src="portadaPreview" alt="Portada"
                class="absolute inset-0 w-full h-full object-cover" />
              <div v-else class="absolute inset-0 flex flex-col items-center justify-center gap-1.5">
                <svg class="w-7 h-7 text-slate-300 group-hover:text-indigo-400 transition-colors" fill="none"
                  viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14" />
                </svg>
                <span class="text-xs text-slate-400 text-center px-2 leading-tight">
                  Subir portada
                </span>
              </div>
              <div v-if="portadaPreview"
                class="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition-colors" />
              <input type="file" accept="image/*" class="sr-only" @change="onPortada" />
            </label>
            <button v-if="portadaPreview" @click="quitarPortada"
              class="mt-1 text-xs text-red-400 hover:text-red-600 transition-colors">
              Quitar
            </button>

          </div>

          <!-- PDF -->
          <div class="md:col-span-4 md:row-span-2">
            <label class="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
              PDF Digital <span class="text-slate-400 font-normal normal-case">(opcional)</span>
            </label>
            <div v-if="!pdfNombre"
              class="flex items-center gap-3 p-3 border-2 border-dashed border-slate-200 rounded-xl hover:border-indigo-300 hover:bg-indigo-50 transition-colors cursor-pointer"
              @click="($refs.pdfRef as HTMLInputElement)?.click()">
              <svg class="w-6 h-6 text-slate-300 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                  d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              <div>
                <p class="text-sm text-slate-500 font-medium">Haz clic para subir un PDF</p>
                <p class="text-xs text-slate-400">PDF máx. 50MB</p>
              </div>
              <input ref="pdfRef" type="file" accept=".pdf" class="sr-only" @change="onPdf" />
            </div>
            <div v-else class="flex items-center gap-3 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl">
              <svg class="w-5 h-5 text-emerald-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
              </svg>
              <span class="text-sm text-emerald-700 truncate flex-1">{{ pdfNombre }}</span>
              <button @click="quitarPdf" class="text-emerald-400 hover:text-red-500 transition-colors">
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          <!-- Autores -->
          <div class="md:col-span-6">
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
                <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none"
                  fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <input v-model="busquedaAutor" type="text" placeholder="Buscar autor o escribir nombre nuevo..."
                  @focus="showDropAutor = busquedaAutor.length > 0" @blur="cerrarDropdownAutor"
                  class="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white" />
              </div>

              <!-- Dropdown resultados -->
              <div v-if="showDropAutor"
                class="absolute z-20 top-full mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">

                <!-- Cargando -->
                <div v-if="buscandoAutor" class="flex items-center gap-2 px-4 py-3 text-xs text-slate-400">
                  <svg class="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Buscando...
                </div>

                <template v-else>
                  <!-- Resultados existentes -->
                  <button v-for="autor in resultadosAutor" :key="autor.idAutor"
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

                  <div v-if="!resultadosAutor.length && !busquedaAutor.trim()"
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
        </div>


        <!-- Categoría + Idioma -->
        <!-- <div class="grid grid-cols-1 md:grid-cols-4 gap-4"> -->
        <div class="grid grid-cols-1 md:grid-cols-[2.5fr_1.2fr_0.8fr_1fr] gap-4">
          <div>
            <label class="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
              Categoría / Colección
            </label>
            <div v-if="!modoNuevaCategoria" class="flex gap-2">
              <div class="relative w-full">

                <input v-model="busquedaCategoria" type="text" placeholder="Buscar categoría..."
                  @focus="mostrarCategorias = true" @blur="ocultarCategorias"
                  class="w-full text-sm rounded-xl border border-slate-200 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500" />

                <div v-if="mostrarCategorias"
                  class="absolute z-20 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                  <button v-for="cat in categoriasFiltradas" :key="cat.id_categoria ?? cat.idCategoria" type="button"
                    @click="seleccionarCategoria(cat)"
                    class="w-full text-left px-3 py-2 hover:bg-indigo-50 transition-colors">
                    <div class="text-sm text-slate-800">
                      {{ cat.nombre_categoria ?? cat.nombreCategoria }}
                    </div>

                    <div v-if="cat.codigo_dewey ?? cat.codigoDewey" class="text-xs text-slate-400">
                      Dewey:
                      {{ cat.codigo_dewey ?? cat.codigoDewey }}
                    </div>
                  </button>

                  <div v-if="!categoriasFiltradas.length" class="px-3 py-2 text-sm text-slate-400">
                    Sin resultados
                  </div>
                </div>
              </div>
              <!-- <select v-model="libro.categoriaId"
                class="w-full text-sm rounded-xl border border-slate-200 px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none">
                <option :value="null">Sin categoría</option>
                <option v-for="cat in categorias" :key="cat.id_categoria ?? cat.idCategoria"
                  :value="cat.id_categoria ?? cat.idCategoria">
                  {{ cat.nombre_categoria ?? cat.nombreCategoria }}
                  <template v-if="cat.codigo_dewey ?? cat.codigoDewey">
                    ({{ cat.codigo_dewey ?? cat.codigoDewey }})
                  </template>
                </option>
              </select> -->
              <!-- <p v-if="categoriaActual" class="text-xs text-slate-400 mt-1">
                Dewey: {{ categoriaActual.codigo_dewey ?? categoriaActual.codigoDewey ?? '—' }}
              </p> -->
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
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Idioma</label>
            <select v-model="libro.idioma"
              class="w-full text-sm rounded-xl border border-slate-200 px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none">
              <option value="es">Español</option>
              <option value="en">Inglés</option>
              <option value="pt">Portugués</option>
              <option value="fr">Francés</option>
              <option value="de">Alemán</option>
              <option value="it">Italiano</option>
            </select>
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
              Año
            </label>

            <input v-model.number="edicion.anoPublicacion" type="number" :min="1800" :max="new Date().getFullYear() + 1"
              placeholder="2024"
              class="w-full text-sm rounded-xl border border-slate-200 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>

          <!-- Número de ejemplares -->
          <div>
            <label class="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
              Número de ejemplares
            </label>
            <div class="flex items-center gap-3">
              <div class="flex items-center rounded-xl border border-slate-200 overflow-hidden">
                <button @click="ej.cantidadEjemplares = Math.max(1, ej.cantidadEjemplares - 1)"
                  class="px-3 py-2.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors font-semibold text-lg leading-none">
                  −
                </button>
                <input v-model.number="ej.cantidadEjemplares" type="text" min="1" max="50"
                  class="w-16 text-center text-sm font-semibold text-slate-900 py-2.5 border-x border-slate-200 focus:outline-none focus:bg-indigo-50" />
                <button @click="ej.cantidadEjemplares = Math.min(50, ej.cantidadEjemplares + 1)"
                  class="px-3 py-2.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors font-semibold text-lg leading-none">
                  +
                </button>
              </div>
              <!-- <div>
                <p class="text-sm text-slate-700 font-medium">
                  {{ ej.cantidadEjemplares }} ejemplar{{ ej.cantidadEjemplares !== 1 ? 'es' : '' }}
                </p>
                <p v-if="ej.cantidadEjemplares > 1" class="text-xs text-slate-400">
                  Se crearán con sufijo Ej.1, Ej.2… Ej.{{ ej.cantidadEjemplares }}
                </p>
              </div> -->
            </div>
            <p v-if="erroresEj.cantidad" class="text-xs text-red-500 mt-1">{{ erroresEj.cantidad }}</p>
          </div>
        </div>

        <!-- Clasificación decimal + Cutter -->
        <div>
          <label class="block text-xs font-semibold text-slate-600 mb-3 uppercase tracking-wide">
            Código para solicitar
          </label>
          <div class="grid grid-cols-1 md:grid-cols-[1.2fr_0.8fr_0.8fr_1.2fr] gap-3">
            <div>
              <label class="block text-xs text-slate-500 mb-1">
                Clasificación decimal
                <span class="text-slate-400">(Dewey)</span>
              </label>
              <input v-model="ej.clasificacionDecimal" type="text" placeholder="Ej. 989.506"
                class="w-full text-sm font-mono rounded-xl border border-slate-200 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label class="block text-xs text-slate-500 mb-1">Cutter autor</label>
              <input v-model="ej.cutterAutor" type="text" placeholder="Ej. REY"
                class="w-full text-sm font-mono rounded-xl border border-slate-200 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              <p class="text-xs text-slate-400 mt-1">Auto: 3 letras del apellido</p>
            </div>
            <div>
              <label class="block text-xs text-slate-500 mb-1">Cutter título</label>
              <input v-model="ej.cutterTitulo" type="text" placeholder="Ej. izq"
                class="w-full text-sm font-mono rounded-xl border border-slate-200 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              <p class="text-xs text-slate-400 mt-1">Auto: 3 letras del título</p>
            </div>
            <div>
              <label class="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">ISBN</label>
              <input v-model="edicion.isbn" type="text" placeholder="978-…" class="w-full text-sm font-mono rounded-xl border px-3 py-2.5
           focus:outline-none focus:ring-2 transition-shadow" :class="erroresLibro.isbn
            ? 'border-red-400 bg-red-50 focus:ring-red-500'
            : 'border-slate-200 focus:ring-indigo-500'" />
              <p v-if="erroresLibro.isbn" class="text-xs text-red-500 mt-1">
                {{ erroresLibro.isbn }}
              </p>
            </div>
          </div>
        </div>

        <!-- Preview del código — estilo catálogo real -->
        <div class="rounded-xl border border-amber-200 bg-amber-50 overflow-hidden">
          <div class="flex items-center gap-2 px-4 py-2 border-b border-amber-200 bg-amber-100/60">
            <svg class="w-3.5 h-3.5 text-amber-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
            </svg>
            <p class="text-xs font-semibold text-amber-700 uppercase tracking-wide">
              Código para solicitar — preview
            </p>
          </div>
          <div class="px-4 py-3">
            <!-- Tabla estilo catálogo -->
            <div class="overflow-x-auto">
              <table class="w-full text-xs">
                <thead>
                  <tr class="text-amber-700 font-medium">
                    <th class="text-left pb-1.5 pr-6">Colección</th>
                    <th class="text-left pb-1.5 pr-4">Decimal</th>
                    <th class="text-left pb-1.5 pr-4">Cutter autor</th>
                    <th class="text-left pb-1.5 pr-4">Cutter título</th>
                    <th class="text-left pb-1.5">Ejemplar</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="n in Math.min(ej.cantidadEjemplares, 5)" :key="n" class="font-mono text-slate-700">
                    <td class="pr-6 py-0.5 text-slate-500">
                      {{ categoriaActual?.nombre_categoria ?? categoriaActual?.nombreCategoria ?? '—' }}
                    </td>
                    <td class="pr-4 py-0.5">{{ ej.clasificacionDecimal || '___' }}</td>
                    <td class="pr-4 py-0.5">{{ ej.cutterAutor || '___' }}</td>
                    <td class="pr-4 py-0.5">{{ ej.cutterTitulo || '___' }}</td>
                    <td class="py-0.5">
                      <span v-if="ej.cantidadEjemplares >= 1" class="text-indigo-600 font-semibold">Ej.{{ n }}</span>
                      <span v-else class="text-slate-400">—</span>
                    </td>
                  </tr>
                  <tr v-if="ej.cantidadEjemplares > 5">
                    <td colspan="5" class="text-slate-400 italic pt-1">
                      ... y {{ ej.cantidadEjemplares - 5 }} ejemplar(es) más
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
        <p v-if="errorGuardar" class="text-sm text-red-600 bg-red-50 border border-red-200 px-4 py-3 rounded-xl">
          {{ errorGuardar }}
        </p>
      </div>

      <!-- ════════════════════════════════════════════════════════════
           PASO 2 — EDICIÓN  (todo opcional)
      ════════════════════════════════════════════════════════════════ -->
      <div v-else-if="paso === 2" class="space-y-5">

        <!-- Info: campos opcionales -->
        <div class="flex items-start gap-2.5 px-3.5 py-3 bg-blue-50 border border-blue-100 rounded-xl">
          <svg class="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p class="text-xs text-blue-700">
            Todos los campos de esta sección son <strong>opcionales</strong>.
            Puedes completarlos ahora o editarlos más adelante.
          </p>
        </div>

        <div class="grid grid-cols-2 gap-5">


          <!-- Campos edición -->
          <div class="space-y-3 flex-1">
            <div>
              <label class="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">ISBN</label>
              <input v-model="edicion.isbn" type="text" placeholder="978-…"
                class="w-full text-sm font-mono rounded-xl border border-slate-200 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label class="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Editorial</label>
              <input v-model="edicion.editorial" type="text" placeholder="Ej. Editorial Sudamericana"
                class="w-full text-sm rounded-xl border border-slate-200 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Año</label>
                <input v-model.number="edicion.anoPublicacion" type="number" :min="1800"
                  :max="new Date().getFullYear() + 1"
                  class="w-full text-sm rounded-xl border border-slate-200 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label class="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Edición</label>
                <input v-model="edicion.edicionTexto" type="text" placeholder="1ra, 2da…"
                  class="w-full text-sm rounded-xl border border-slate-200 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
            </div>
            <div>
              <label class="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Páginas</label>
              <input v-model.number="edicion.numeroPaginas" type="number" placeholder="350"
                class="w-full text-sm rounded-xl border border-slate-200 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          </div>
        </div>

      </div>

    </template>

    <!-- ── Footer ─────────────────────────────────────────────────── -->
    <template #footer>
      <!-- Volver -->
      <button v-if="paso > 1 && !cargandoInicial" @click="anterior"
        class="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors mr-auto flex items-center gap-1.5">
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
        </svg>
        Volver
      </button>

      <button @click="emit('close')"
        class="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">
        Cancelar
      </button>

      <!-- Siguiente -->
      <button v-if="paso > 4 && !cargandoInicial" @click="siguiente"
        class="px-5 py-2 text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-colors flex items-center gap-2">
        Siguiente
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
        </svg>
      </button>

      <!-- Guardar -->
      <button v-else-if="paso === 1" @click="guardar" :disabled="guardando"
        class="px-5 py-2 text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2">
        <svg v-if="guardando" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <svg v-else class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
        </svg>
        {{ guardando ? 'Guardando...' : (modoEdicion ? 'Guardar cambios' : 'Registrar libro') }}
      </button>
    </template>

  </BaseModal>
</template>