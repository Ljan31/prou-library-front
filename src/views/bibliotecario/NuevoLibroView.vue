<script setup lang="ts">
/**
 * NuevoLibroView — Registro rápido de libro
 * ─────────────────────────────────────────────────────────────────────────────
 * Ruta sugerida : /catalogo/nuevo-libro
 * meta          : { roles: ['ROLE_ADMIN', 'ROLE_BIBLIOTECARIO'] }
 *
 * Convierte LibroRapidoModal en una página completa con el mismo flujo de 3 pasos:
 *   Paso 1 — Libro     : título, autores, categoría, portada, PDF, código solicitar
 *   Paso 2 — Edición   : ISBN, editorial, año, páginas (todos opcionales)
 *   Paso 3 — Ejemplares: se registran N copias físicas con el endpoint /catalogo/lote
 *
 * Diferencias respecto al modal:
 *   · Sin BaseModal → layout propio con page-container + sticky footer
 *   · Sin props libroId / emit close|saved → usa useRouter para navegar
 *   · Modo edición se activa con query param ?libroId=123
 *   · Breadcrumbs se registran en onMounted via useUiStore
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { ref, reactive, computed, watch, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useUiStore } from '@/stores/ui.store'
import { useAuthStore } from '@/stores/auth.store'
import { usePermissions } from '@/composables/usePermissions'
import SButton from '@/components/ui/SButton.vue'
import api from '@/services/axios'
import { obtenerCategorias } from '@/services/categorias.service'
import { bibliotecasService } from '@/services/bibliotecas.service'
import type { Categoria } from '@/types/catalogo'

// ─── Router / stores ──────────────────────────────────────────────────────
const router = useRouter()
const route = useRoute()
const ui = useUiStore()
const auth = useAuthStore()
const { isAdmin } = usePermissions()

// Modo edición cuando viene ?libroId=123 en la query
const libroId = computed(() => {
  const v = route.query.libroId
  return v ? Number(v) : null
})
const modoEdicion = computed(() => !!libroId.value)

onMounted(async () => {
  ui.setBreadcrumbs([
    { label: 'Dashboard', to: '/dashboard' },
    { label: 'Catálogo', to: '/catalogo' },
    { label: modoEdicion.value ? 'Editar libro' : 'Nuevo libro' },
  ])
  cargandoInicial.value = true
  try {
    const [cats] = await Promise.all([
      obtenerCategorias(),
      cargarBibliotecas(),
    ])
    categorias.value = cats
    if (libroId.value) await precargarLibro(libroId.value)
  } finally {
    cargandoInicial.value = false
  }
})

// ══════════════════════════════════════════════════════════════════════════
// PASO ACTIVO  1 · 2 · 3
// ══════════════════════════════════════════════════════════════════════════
const paso = ref<1 | 2 | 3>(1)
const pasoLabels = ['Libro', 'Edición', 'Ejemplares']

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
  autores: '',
  categoriaId: null as number | null,
  idioma: 'es',
  descripcion: '',
})
const erroresLibro = reactive<Record<string, string>>({})

// ── Autores con autocompletado ────────────────────────────────────────────
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

function agregarAutorExistente(autor: AutorOpcion) {
  if (!autoresSeleccionados.value.find(a => a.idAutor === autor.idAutor)) {
    autoresSeleccionados.value.push(autor)
  }
  busquedaAutor.value = ''; showDropAutor.value = false
}

function crearNuevoAutor() {
  const nombre = busquedaAutor.value.trim()
  if (!nombre) return
  if (!autoresSeleccionados.value.find(a => a.nombre.toLowerCase() === nombre.toLowerCase())) {
    autoresSeleccionados.value.push({ nombre, nuevo: true })
  }
  busquedaAutor.value = ''; showDropAutor.value = false
}

function quitarAutor(idx: number) { autoresSeleccionados.value.splice(idx, 1) }
const cerrarDropdownAutor = () => setTimeout(() => { showDropAutor.value = false }, 180)

// ── Categoría con búsqueda inline ────────────────────────────────────────
const busquedaCategoria = ref('')
const mostrarCategorias = ref(false)
const modoNuevaCategoria = ref(false)
const nuevaCategoriaNombre = ref('')
const nuevaCategoriaDescripcion = ref('')
const nuevaCategoriaDewey = ref('')

const categoriasFiltradas = computed(() => {
  const q = busquedaCategoria.value.toLowerCase().trim()
  if (!q) return categorias.value
  return categorias.value.filter(cat => {
    const nombre = (cat.nombre_categoria ?? cat.nombreCategoria ?? '').toLowerCase()
    const dewey = (cat.codigo_dewey ?? cat.codigoDewey ?? '').toLowerCase()
    return nombre.includes(q) || dewey.includes(q)
  })
})

const categoriaActual = computed(() =>
  categorias.value.find(c => (c.id_categoria ?? c.idCategoria) === libro.categoriaId)
)

function seleccionarCategoria(cat: any) {
  libro.categoriaId = cat.id_categoria ?? cat.idCategoria
  busquedaCategoria.value = cat.nombre_categoria ?? cat.nombreCategoria
  mostrarCategorias.value = false
}

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
    busquedaCategoria.value = cat.nombre_categoria ?? cat.nombreCategoria ?? ''
    modoNuevaCategoria.value = false
    nuevaCategoriaNombre.value = ''; nuevaCategoriaDescripcion.value = ''; nuevaCategoriaDewey.value = ''
  } catch { }
}

const ocultarCategorias = () => setTimeout(() => { mostrarCategorias.value = false }, 150)

// ── Portada + PDF ─────────────────────────────────────────────────────────
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
// PASO 2 — EDICIÓN  (todos los campos opcionales)
// ══════════════════════════════════════════════════════════════════════════
const edicion = reactive({
  isbn: '',
  editorial: '',
  anoPublicacion: new Date().getFullYear(),
  edicionTexto: '1ra',
  numeroPaginas: null as number | null,
})

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

// Pre-seleccionar biblioteca
watch(bibliotecas, (lista) => {
  if (!ej.bibliotecaId && lista.length) ej.bibliotecaId = lista[0].id
}, { immediate: true })

// Código Dewey auto desde categoría
watch(() => libro.categoriaId, (idCategoria) => {
  const cat = categorias.value.find(c => (c.id_categoria ?? c.idCategoria) === idCategoria)
  ej.clasificacionDecimal = cat ? (cat.codigo_dewey ?? cat.codigoDewey ?? '') : ''
})

// Cutter autor auto
watch(autoresSeleccionados, (autores) => {
  libro.autores = autores.map(a => a.nombre).join('; ')
  if (!autores.length) { ej.cutterAutor = ''; return }
  ej.cutterAutor = autores[0].nombre.trim().split(' ')[0].slice(0, 3).toUpperCase()
}, { deep: true })

// Cutter título auto
watch(() => libro.titulo, (v) => {
  ej.cutterTitulo = v.replace(/^(el|la|los|las|un|una|the|a)\s+/i, '')
    .replace(/\s+/g, '').slice(0, 3).toLowerCase()
})

// Preview código para solicitar
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

// ══════════════════════════════════════════════════════════════════════════
// PRE-CARGA (modo edición vía ?libroId)
// ══════════════════════════════════════════════════════════════════════════
async function precargarLibro(id: number) {
  try {
    const res = await api.get(`/libros/${id}`)
    const data = res.data?.data ?? res.data
    libro.titulo = data.titulo ?? ''
    libro.autores = (data.autores ?? []).map((a: any) => a.nombre).join('; ')
    autoresSeleccionados.value = (data.autores ?? []).map((a: any) => ({
      idAutor: a.idAutor ?? a.id_autor,
      nombre: a.nombre,
    }))
    libro.categoriaId = data.categoria?.id_categoria ?? data.categoria?.idCategoria ?? null
    if (libro.categoriaId) {
      const cat = categorias.value.find(c => (c.id_categoria ?? c.idCategoria) === libro.categoriaId)
      if (cat) busquedaCategoria.value = cat.nombre_categoria ?? cat.nombreCategoria ?? ''
    }
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
  return !Object.keys(erroresLibro).length
}

function validarPaso3(): boolean {
  Object.keys(erroresEj).forEach(k => delete erroresEj[k])
  if (!ej.bibliotecaId) erroresEj.biblioteca = 'Selecciona una biblioteca'
  if (ej.cantidadEjemplares < 1) erroresEj.cantidad = 'Mínimo 1 ejemplar'
  if (ej.cantidadEjemplares > 50) erroresEj.cantidad = 'Máximo 50 ejemplares por vez'
  return !Object.keys(erroresEj).length
}

function siguiente() {
  if (paso.value === 1 && !validarPaso1()) return
  paso.value = (paso.value + 1) as 1 | 2 | 3
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function anterior() {
  paso.value = (paso.value - 1) as 1 | 2 | 3
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

// ══════════════════════════════════════════════════════════════════════════
// GUARDAR — POST /catalogo/lote  ó  PUT /libros/:id
// ══════════════════════════════════════════════════════════════════════════
const guardando = ref(false)
const errorGuardar = ref('')

async function guardar() {
  if (!validarPaso1()) { paso.value = 1; return }
  if (!validarPaso3()) return
  guardando.value = true; errorGuardar.value = ''
  try {
    const ejemplaresPayload = Array.from(
      { length: ej.cantidadEjemplares },
      (_, i) => ({
        bibliotecaId: ej.bibliotecaId,
        ubicacionFisica: ej.ubicacionFisica.trim() || undefined,
        clasificacionDecimal: ej.clasificacionDecimal.trim() || undefined,
        cutterAutor: ej.cutterAutor.trim() || undefined,
        codigoEjemplar: `${ej.cutterTitulo.trim() || 'EJ'} Ej.${i + 1}`,
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

    if (modoEdicion.value) {
      await api.put(`/libros/${libroId.value}`, {
        titulo: datos.titulo,
        idioma: datos.idioma,
        categoriaId: datos.categoriaId,
        descripcion: datos.descripcion,
        autores: datos.autores,
      })
      ui.toast.success('Guardado', 'Libro actualizado correctamente')
    } else {
      const fd = new FormData()
      fd.append('datos', new Blob([JSON.stringify(datos)], { type: 'application/json' }))
      if (portadaFile.value) fd.append('portada_0', portadaFile.value)
      if (pdfFile.value) fd.append('pdf_0', pdfFile.value)
      await api.post('/catalogo/lote', fd)
      ui.toast.success('Registrado', `"${libro.titulo}" y ${ej.cantidadEjemplares} ejemplar(es) creados`)
    }

    router.push('/catalogo')
  } catch (e: unknown) {
    const err = e as any
    const msg = err?.response?.data?.message ?? (e instanceof Error ? e.message : 'Error al guardar')
    errorGuardar.value = msg
    if (msg?.includes('ISBN')) {
      erroresLibro.isbn = msg
      paso.value = 2
    }
  } finally {
    guardando.value = false
  }
}

function cancelar() {
  router.push(modoEdicion.value ? `/inventario` : '/inventario')
}
</script>

<template>
  <div class="page-container max-w-4xl">

    <!-- ── Page header ──────────────────────────────────────────────────── -->
    <div class="flex items-start justify-between mb-8">
      <div class="flex items-center gap-4">
        <div class="w-11 h-11 rounded-2xl bg-indigo-100 flex items-center justify-center flex-shrink-0">
          <svg class="w-6 h-6 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.523 5.754 19 7.5 19s3.332-.477 4.5-1.253M12 6.253C13.168 5.477 14.754 5 16.5 5s3.332.477 4.5 1.253v13C19.832 18.523 18.246 19 16.5 19s-3.332-.477-4.5-1.253" />
          </svg>
        </div>
        <div>
          <h1 class="text-2xl font-semibold text-slate-900">
            {{ modoEdicion ? 'Editar libro' : 'Nuevo libro' }}
          </h1>
          <p class="text-sm text-slate-500 mt-0.5">
            {{ modoEdicion
              ? 'Modifica los datos del libro y sus ejemplares.'
              : 'Registra un libro con su código de solicitar y ejemplares en un solo paso.' }}
          </p>
        </div>
      </div>

      <!-- Biblioteca activa (visible en todos los pasos) -->
      <div class="flex-shrink-0">
        <div v-if="!isAdmin && bibliotecaPropia"
          class="flex items-center gap-2 px-3 py-2 bg-indigo-50 border border-indigo-200 rounded-xl">
          <svg class="w-4 h-4 text-indigo-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4" />
          </svg>
          <span class="text-sm font-medium text-indigo-700">{{ bibliotecaPropia.nombre }}</span>
        </div>
        <div v-else-if="isAdmin" class="flex flex-col gap-1">
          <label class="text-xs text-slate-500">Biblioteca destino</label>
          <select v-model="ej.bibliotecaId"
            class="text-sm rounded-xl border px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            :class="erroresEj.biblioteca ? 'border-red-400' : 'border-slate-200'">
            <option :value="null" disabled>Seleccionar…</option>
            <option v-for="bib in bibliotecas" :key="bib.id" :value="bib.id">{{ bib.nombre }}</option>
          </select>
          <p v-if="erroresEj.biblioteca" class="text-xs text-red-500">{{ erroresEj.biblioteca }}</p>
        </div>
      </div>
    </div>
    <!-- ── Cargando inicial ────────────────────────────────────────────── -->
    <div v-if="cargandoInicial" class="flex items-center justify-center py-24 gap-3">
      <svg class="w-6 h-6 animate-spin text-indigo-400" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
      <span class="text-sm text-slate-400">Cargando...</span>
    </div>

    <template v-else>

      <!-- ══════════════════════════════════════════════════════════════════
           PASO 1 — LIBRO
      ═══════════════════════════════════════════════════════════════════ -->
      <div v-if="paso === 1" class="space-y-4">

        <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">

          <div class="grid grid-cols-1 md:grid-cols-12 gap-5 items-start">

            <!-- Título -->
            <div class="md:col-span-7">
              <label class="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
                Título <span class="text-red-400">*</span>
              </label>
              <input v-model="libro.titulo" maxlength="100" minlength="3"
                placeholder="Ej. BIO-BIBLIOGRAFÍA BOLIVIANA 2000"
                class="w-full text-sm rounded-xl border px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow"
                :class="erroresLibro.titulo ? 'border-red-400 bg-red-50' : 'border-slate-200'" />
              <p v-if="erroresLibro.titulo" class="text-xs text-red-500 mt-1">{{ erroresLibro.titulo }}</p>
            </div>

            <!-- Portada -->
            <div class="md:col-span-2 flex flex-col items-start">
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
                  <span class="text-xs text-slate-400 text-center px-2 leading-tight">Subir portada</span>
                </div>
                <div v-if="portadaPreview" class="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition-colors" />
                <input type="file" accept="image/*" class="sr-only" @change="onPortada" />
              </label>
              <button v-if="portadaPreview" @click="quitarPortada"
                class="mt-1 text-xs text-red-400 hover:text-red-600 transition-colors">Quitar</button>
            </div>

            <!-- PDF -->
            <div class="md:col-span-3">
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
                  <p class="text-sm text-slate-500 font-medium">Haz clic para subir</p>
                  <p class="text-xs text-slate-400">PDF máx. 50MB</p>
                </div>
                <input ref="pdfRef" type="file" accept=".pdf" class="sr-only" @change="onPdf" />
              </div>
              <div v-else
                class="flex items-center gap-3 px-3 py-2.5 bg-emerald-50 border border-emerald-200 rounded-xl">
                <svg class="w-4 h-4 text-emerald-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                </svg>
                <span class="text-xs text-emerald-700 truncate flex-1">{{ pdfNombre }}</span>
                <button @click="quitarPdf" class="text-emerald-400 hover:text-red-500 transition-colors flex-shrink-0">
                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <!-- Autores -->
            <div class="md:col-span-7">
              <label class="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">Autores</label>
              <div v-if="autoresSeleccionados.length" class="flex flex-wrap gap-1.5 mb-2">
                <span v-for="(autor, i) in autoresSeleccionados" :key="i"
                  :class="['inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium',
                    autor.nuevo
                      ? 'bg-amber-100 text-amber-800 border border-amber-200'
                      : 'bg-indigo-100 text-indigo-800 border border-indigo-200']">
                  <span v-if="autor.nuevo" class="text-amber-600 font-bold">+</span>
                  {{ autor.nombre }}
                  <button @click="quitarAutor(i)" class="ml-0.5 text-slate-400 hover:text-red-500 transition-colors">
                    <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </span>
              </div>
              <div class="relative">
                <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none"
                  fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <input v-model="busquedaAutor" type="text" maxlength="50"
                  placeholder="Buscar autor o escribir nombre nuevo..."
                  @focus="showDropAutor = busquedaAutor.length > 0" @blur="cerrarDropdownAutor"
                  class="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white" />
                <div v-if="showDropAutor"
                  class="absolute z-20 top-full mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
                  <div v-if="buscandoAutor" class="flex items-center gap-2 px-4 py-3 text-xs text-slate-400">
                    <svg class="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Buscando...
                  </div>
                  <template v-else>
                    <button v-for="autor in resultadosAutor" :key="autor.idAutor"
                      @mousedown.prevent="agregarAutorExistente(autor)"
                      class="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-left hover:bg-indigo-50 transition-colors">
                      <div class="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                        <span class="text-xs font-semibold text-indigo-600">{{ autor.nombre.charAt(0).toUpperCase() }}</span>
                      </div>
                      <span class="text-slate-800 truncate">{{ autor.nombre }}</span>
                    </button>
                    <button v-if="busquedaAutor.trim()" @mousedown.prevent="crearNuevoAutor"
                      class="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-left hover:bg-amber-50 text-amber-700 border-t border-slate-100 transition-colors">
                      <svg class="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                      </svg>
                      Crear "<strong>{{ busquedaAutor }}</strong>" como nuevo autor
                    </button>
                    <div v-if="!resultadosAutor.length && !busquedaAutor.trim()"
                      class="px-4 py-3 text-xs text-slate-400 text-center">Escribe para buscar autores</div>
                  </template>
                </div>
              </div>
              <p class="text-xs text-slate-400 mt-1.5">
                Los autores con <span class="text-amber-600 font-semibold">+</span> se crearán al guardar
              </p>
            </div>
          </div>

          <!-- Categoría + Idioma + Año + Cantidad -->
          <div class="grid grid-cols-1 md:grid-cols-[2.5fr_1.2fr_0.8fr_1fr] gap-4">

            <!-- Categoría -->
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
                      <div class="text-sm text-slate-800">{{ cat.nombre_categoria ?? cat.nombreCategoria }}</div>
                      <div v-if="cat.codigo_dewey ?? cat.codigoDewey" class="text-xs text-slate-400">
                        Dewey: {{ cat.codigo_dewey ?? cat.codigoDewey }}
                      </div>
                    </button>
                    <div v-if="!categoriasFiltradas.length" class="px-3 py-2 text-sm text-slate-400">Sin resultados</div>
                  </div>
                </div>
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
                  <button @click="modoNuevaCategoria = false" class="text-xs text-slate-400 hover:text-slate-600">Cancelar</button>
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

            <!-- Idioma -->
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

            <!-- Año -->
            <div>
              <label class="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Año</label>
              <input v-model.number="edicion.anoPublicacion" type="number" :min="1800"
                :max="new Date().getFullYear() + 1" placeholder="2024"
                class="w-full text-sm rounded-xl border border-slate-200 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>

            <!-- Número de ejemplares -->
            <div>
              <label class="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
                Nº Ejemplares
              </label>
              <div class="flex items-center rounded-xl border border-slate-200 overflow-hidden w-fit">
                <button @click="ej.cantidadEjemplares = Math.max(1, ej.cantidadEjemplares - 1)"
                  class="px-3 py-2.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors font-semibold text-lg leading-none">−</button>
                <input v-model.number="ej.cantidadEjemplares" type="text" min="1" max="50"
                  class="w-14 text-center text-sm font-semibold text-slate-900 py-2.5 border-x border-slate-200 focus:outline-none focus:bg-indigo-50" />
                <button @click="ej.cantidadEjemplares = Math.min(50, ej.cantidadEjemplares + 1)"
                  class="px-3 py-2.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors font-semibold text-lg leading-none">+</button>
              </div>
              <p v-if="erroresEj.cantidad" class="text-xs text-red-500 mt-1">{{ erroresEj.cantidad }}</p>
            </div>
          </div>

          <!-- Clasificación decimal + Cutter -->
          <div>
            <label class="block text-xs font-semibold text-slate-600 mb-2 uppercase tracking-wide">
              Código para solicitar
            </label>
            <div class="grid grid-cols-1 md:grid-cols-[1.2fr_0.8fr_0.8fr_1.2fr] gap-3">
              <div>
                <label class="block text-xs text-slate-500 mb-1">Clasificación decimal (Dewey)</label>
                <input v-model="ej.clasificacionDecimal" type="text" placeholder="Ej. 989.506" maxlength="10"
                  class="w-full text-sm font-mono rounded-xl border border-slate-200 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label class="block text-xs text-slate-500 mb-1">Cutter autor</label>
                <input v-model="ej.cutterAutor" type="text" placeholder="Ej. REY" maxlength="10"
                  class="w-full text-sm font-mono rounded-xl border border-slate-200 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                <p class="text-xs text-slate-400 mt-1">Auto: 3 letras del apellido</p>
              </div>
              <div>
                <label class="block text-xs text-slate-500 mb-1">Cutter título</label>
                <input v-model="ej.cutterTitulo" type="text" placeholder="Ej. izq" maxlength="10"
                  class="w-full text-sm font-mono rounded-xl border border-slate-200 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                <p class="text-xs text-slate-400 mt-1">Auto: 3 letras del título</p>
              </div>
              <div>
                <label class="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">ISBN</label>
                <input v-model="edicion.isbn" maxlength="17" minlength="10" type="text" placeholder="978-…"
                  class="w-full text-sm font-mono rounded-xl border px-3 py-2.5 focus:outline-none focus:ring-2 transition-shadow"
                  :class="erroresLibro.isbn ? 'border-red-400 bg-red-50 focus:ring-red-500' : 'border-slate-200 focus:ring-indigo-500'" />
                <p v-if="erroresLibro.isbn" class="text-xs text-red-500 mt-1">{{ erroresLibro.isbn }}</p>
              </div>
            </div>
          </div>

          <!-- Preview código solicitar — estilo catálogo UMSA -->
          <div class="rounded-xl border border-amber-200 bg-amber-50 overflow-hidden">
            <div class="flex items-center gap-2 px-4 py-2 border-b border-amber-200 bg-amber-100/60">
              <svg class="w-3.5 h-3.5 text-amber-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
              <p class="text-xs font-semibold text-amber-700 uppercase tracking-wide">Código para solicitar — preview</p>
            </div>
            <div class="px-4 py-3 overflow-x-auto">
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

          <p v-if="errorGuardar" class="text-sm text-red-600 bg-red-50 border border-red-200 px-4 py-3 rounded-xl">
            {{ errorGuardar }}
          </p>
        </div>
      </div>

      <!-- ══════════════════════════════════════════════════════════════════
           PASO 2 — EDICIÓN  (todo opcional)
      ═══════════════════════════════════════════════════════════════════ -->
      <div v-else-if="paso === 2" class="space-y-5">

        <div class="flex items-start gap-2.5 px-4 py-3 bg-sky-50 border border-sky-200 rounded-xl">
          <svg class="w-4 h-4 text-sky-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p class="text-xs text-sky-700">
            Todos los campos de esta sección son <strong>opcionales</strong>.
            Puedes completarlos ahora o editarlos más adelante desde el catálogo.
          </p>
        </div>

        <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
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
            <div>
              <label class="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Año de publicación</label>
              <input v-model.number="edicion.anoPublicacion" type="number" :min="1800"
                :max="new Date().getFullYear() + 1"
                class="w-full text-sm rounded-xl border border-slate-200 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label class="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Nº de edición</label>
              <input v-model="edicion.edicionTexto" type="text" placeholder="1ra, 2da…"
                class="w-full text-sm rounded-xl border border-slate-200 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div class="sm:col-span-2">
              <label class="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Páginas</label>
              <input v-model.number="edicion.numeroPaginas" type="number" placeholder="350"
                class="w-full sm:w-40 text-sm rounded-xl border border-slate-200 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          </div>
        </div>
      </div>

      <!-- ══════════════════════════════════════════════════════════════════
           PASO 3 — EJEMPLARES
      ═══════════════════════════════════════════════════════════════════ -->
      <div v-else-if="paso === 3" class="space-y-5">

        <!-- Resumen del libro -->
        <div class="flex items-center gap-4 px-4 py-3 bg-white rounded-2xl border border-slate-200 shadow-sm">
          <div class="w-10 h-14 rounded-lg overflow-hidden bg-slate-100 flex-shrink-0">
            <img v-if="portadaPreview" :src="portadaPreview" alt="Portada" class="w-full h-full object-cover" />
            <div v-else class="w-full h-full flex items-center justify-center">
              <svg class="w-5 h-5 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                  d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13" />
              </svg>
            </div>
          </div>
          <div class="flex-1 min-w-0">
            <p class="font-semibold text-slate-900 truncate">{{ libro.titulo || '—' }}</p>
            <p class="text-xs text-slate-500">
              {{ autoresSeleccionados.map(a => a.nombre).join(', ') || 'Sin autores' }}
              <template v-if="edicion.isbn"> · ISBN {{ edicion.isbn }}</template>
            </p>
          </div>
          <div class="text-right flex-shrink-0">
            <p class="text-sm font-semibold text-indigo-700">{{ ej.cantidadEjemplares }}</p>
            <p class="text-xs text-slate-400">ejemplar(es)</p>
          </div>
        </div>

        <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">

          <!-- Ubicación -->
          <div>
            <label class="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
              Ubicación física
            </label>
            <input v-model="ej.ubicacionFisica" type="text" placeholder="Estante B-2, Fila 1"
              class="w-full text-sm rounded-xl border border-slate-200 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>

          <!-- Estado + Fecha + Precio -->
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label class="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Estado inicial</label>
              <select v-model="ej.estadoEjemplar"
                class="w-full text-sm rounded-xl border border-slate-200 px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <option value="DISPONIBLE">🟢 Disponible</option>
                <option value="EN_REPARACION">🟣 En reparación</option>
                <option value="DAÑADO">🟡 Dañado</option>
              </select>
            </div>
            <div>
              <label class="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Fecha adquisición</label>
              <input v-model="ej.fechaAdquisicion" type="date"
                class="w-full text-sm rounded-xl border border-slate-200 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label class="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Precio (Bs.)</label>
              <input v-model.number="ej.precioCompra" type="number" step="0.01" placeholder="85.00"
                class="w-full text-sm rounded-xl border border-slate-200 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          </div>

          <!-- Observaciones -->
          <div>
            <label class="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Observaciones</label>
            <textarea v-model="ej.observaciones" rows="2" placeholder="Donación FHCE 2024…"
              class="w-full text-sm rounded-xl border border-slate-200 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
          </div>

          <p v-if="erroresEj.biblioteca" class="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">
            {{ erroresEj.biblioteca }}
          </p>
          <p v-if="errorGuardar" class="text-sm text-red-600 bg-red-50 border border-red-200 px-4 py-3 rounded-xl">
            {{ errorGuardar }}
          </p>
        </div>
      </div>

    </template><!-- /v-else (no cargandoInicial) -->

    <!-- ── Barra de acciones sticky ────────────────────────────────────── -->
    <div class="sticky bottom-4 mt-6 flex items-center justify-between gap-3 bg-white border border-slate-200 rounded-2xl shadow-lg px-5 py-3">

      <!-- Volver -->
      <SButton v-if="paso > 1" variant="ghost" @click="anterior" class="mr-auto">
        <svg class="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
        </svg>
        Volver
      </SButton>

      <div class="flex items-center gap-2 ml-auto">
        <SButton variant="secondary" @click="cancelar">Cancelar</SButton>

        <!-- Siguiente (pasos 1 y 2) -->
        <SButton v-if="paso > 4 " @click="siguiente">
          Siguiente
          <svg class="w-4 h-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
          </svg>
        </SButton>

        <!-- Guardar (paso 3) -->
        <SButton v-else-if="paso === 1" variant="success" :loading="guardando" @click="guardar">
          <template v-if="!guardando">
            <svg class="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
          </template>
          {{ modoEdicion ? 'Guardar cambios' : 'Registrar libro' }}
        </SButton>
      </div>
    </div>

  </div>
</template>