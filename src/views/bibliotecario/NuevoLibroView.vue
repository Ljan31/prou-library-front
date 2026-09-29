<script setup lang="ts">

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

const router = useRouter()
const route  = useRoute()
const ui     = useUiStore()
const auth   = useAuthStore()
const { isAdmin } = usePermissions()

const libroId     = computed(() => { const v = route.query.libroId; return v ? Number(v) : null })
const modoEdicion = computed(() => !!libroId.value)

onMounted(async () => {
  ui.setBreadcrumbs([
    { label: 'Dashboard', to: '/dashboard' },
    { label: 'Catálogo', to: '/catalogo' },
    { label: modoEdicion.value ? 'Editar libro' : 'Nuevo libro' },
  ])
  cargandoInicial.value = true
  try {
    const [cats] = await Promise.all([obtenerCategorias(), cargarBibliotecas()])
    categorias.value = cats
    if (libroId.value) await precargarLibro(libroId.value)
  } finally {
    cargandoInicial.value = false
  }
})

// ══════════════════════════════════════════════════════════════════════════
// DATOS AUXILIARES
// ══════════════════════════════════════════════════════════════════════════
const categorias  = ref<Categoria[]>([])
const bibliotecas = ref<{ id: number; nombre: string }[]>([])
const cargandoInicial = ref(false)

const bibliotecaPropia = computed(() => {
  const lista = auth.user?.biblioteca
  if (!lista?.length) return null
  const b = lista[0]
  const id     = b.id_biblioteca ?? b.idBiblioteca ?? b.id
  const nombre = b.nombre ?? b.name
  return id && nombre ? { id, nombre } : null
})

async function cargarBibliotecas() {
  if (!isAdmin.value) {
    if (bibliotecaPropia.value) bibliotecas.value = [bibliotecaPropia.value]
    return
  }
  try {
    const res  = await bibliotecasService.getAll()
    const raw  = (res.data as any)?.data ?? res.data
    const lista = Array.isArray(raw) ? raw : []
    bibliotecas.value = lista
      .filter((b: any) => b.estado === 'ACTIVA' || !b.estado)
      .map((b: any) => ({ id: b.id_biblioteca ?? b.idBiblioteca ?? b.id, nombre: b.nombre ?? b.name }))
  } catch { }
}

// ══════════════════════════════════════════════════════════════════════════
// LIBRO
// ══════════════════════════════════════════════════════════════════════════
const libro = reactive({
  titulo: '', autores: '', categoriaId: null as number | null, idioma: 'es', descripcion: '',
})
const erroresLibro = reactive<Record<string, string>>({})

// ── Autores ───────────────────────────────────────────────────────────────
interface AutorOpcion { idAutor?: number; nombre: string; nuevo?: boolean }
const autoresSeleccionados = ref<AutorOpcion[]>([])
const busquedaAutor        = ref('')
const resultadosAutor      = ref<AutorOpcion[]>([])
const buscandoAutor        = ref(false)
const showDropAutor        = ref(false)
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
  if (!autoresSeleccionados.value.find(a => a.idAutor === autor.idAutor))
    autoresSeleccionados.value.push(autor)
  busquedaAutor.value = ''; showDropAutor.value = false
}
function crearNuevoAutor() {
  const nombre = busquedaAutor.value.trim(); if (!nombre) return
  if (!autoresSeleccionados.value.find(a => a.nombre.toLowerCase() === nombre.toLowerCase()))
    autoresSeleccionados.value.push({ nombre, nuevo: true })
  busquedaAutor.value = ''; showDropAutor.value = false
}
function quitarAutor(idx: number) { autoresSeleccionados.value.splice(idx, 1) }
const cerrarDropdownAutor = () => setTimeout(() => { showDropAutor.value = false }, 180)

// ── Categoría ─────────────────────────────────────────────────────────────
const busquedaCategoria  = ref('')
const mostrarCategorias  = ref(false)
const modoNuevaCategoria = ref(false)
const nuevaCategoriaNombre      = ref('')
const nuevaCategoriaDescripcion = ref('')
const nuevaCategoriaDewey       = ref('')

const categoriasFiltradas = computed(() => {
  const q = busquedaCategoria.value.toLowerCase().trim()
  if (!q) return categorias.value
  return categorias.value.filter(c => {
    const nombre = (c.nombre_categoria ?? c.nombreCategoria ?? '').toLowerCase()
    const dewey  = (c.codigo_dewey ?? c.codigoDewey ?? '').toLowerCase()
    return nombre.includes(q) || dewey.includes(q)
  })
})
const categoriaActual = computed(() =>
  categorias.value.find(c => (c.id_categoria ?? c.idCategoria) === libro.categoriaId)
)
function seleccionarCategoria(cat: any) {
  libro.categoriaId       = cat.id_categoria ?? cat.idCategoria
  busquedaCategoria.value = cat.nombre_categoria ?? cat.nombreCategoria
  mostrarCategorias.value = false
}
async function guardarNuevaCategoria() {
  if (!nuevaCategoriaNombre.value.trim()) return
  try {
    const res = await api.post('/categorias', {
      nombre_categoria: nuevaCategoriaNombre.value.trim(),
      descripcion:      nuevaCategoriaDescripcion.value.trim() || undefined,
      codigo_dewey:     nuevaCategoriaDewey.value.trim() || undefined,
    })
    const cat: Categoria = res.data?.data ?? res.data
    categorias.value.push(cat)
    libro.categoriaId       = cat.id_categoria ?? cat.idCategoria ?? null
    busquedaCategoria.value = cat.nombre_categoria ?? cat.nombreCategoria ?? ''
    modoNuevaCategoria.value = false
    nuevaCategoriaNombre.value = ''; nuevaCategoriaDescripcion.value = ''; nuevaCategoriaDewey.value = ''
  } catch { }
}
const ocultarCategorias = () => setTimeout(() => { mostrarCategorias.value = false }, 150)

// ══════════════════════════════════════════════════════════════════════════
// EDICIONES  — portada y PDF ahora pertenecen a cada edición
// ══════════════════════════════════════════════════════════════════════════

// Refs para los inputs de PDF dentro del v-for
// Vue 3 no admite $refs con template strings en v-for; usamos un array.
const pdfInputRefs = ref<HTMLInputElement[]>([])
function setPdfRef(el: unknown, idx: number) {
  if (el instanceof HTMLInputElement) pdfInputRefs.value[idx] = el
}
function abrirSelectorPdf(idx: number) {
  pdfInputRefs.value[idx]?.click()
}

interface EdicionItem {
  editorial:          string
  edicionTexto:       string
  anoPublicacion:     number
  cantidadEjemplares: number
  // archivos propios de esta edición
  portadaFile:        File | null
  portadaPreview:     string          // data-url o URL remota pre-cargada
  pdfFile:            File | null
  pdfNombre:          string
}
function ordinalEdicion(numero: number): string {
  const sufijos: Record<number, string> = {
    1: 'ra',
    2: 'da',
    3: 'ra',
    4: 'ta',
    5: 'ta',
    6: 'ta',
    7: 'ma',
    8: 'va',
    9: 'na',
  }

  const sufijo = sufijos[numero] ?? 'ma'

  return `${numero}${sufijo}`
}
function crearEdicionVacia(numero = 1): EdicionItem {
  return {
    editorial:          '',
    edicionTexto:      ordinalEdicion(numero),
    anoPublicacion:     new Date().getFullYear(),
    cantidadEjemplares: 1,
    portadaFile:        null,
    portadaPreview:     '',
    pdfFile:            null,
    pdfNombre:          '',
  }
}

const ediciones = ref<EdicionItem[]>([crearEdicionVacia(1)])

function agregarEdicion() {
  if (ediciones.value.length >= 10) return
  ediciones.value.push(crearEdicionVacia(ediciones.value.length + 1))
}
function eliminarEdicion(idx: number) {
  if (idx === 0) return
  ediciones.value.splice(idx, 1)
}
function decrementarEjemplares(idx: number) {
  ediciones.value[idx].cantidadEjemplares = Math.max(1, ediciones.value[idx].cantidadEjemplares - 1)
}
function incrementarEjemplares(idx: number) {
  ediciones.value[idx].cantidadEjemplares = Math.min(10, ediciones.value[idx].cantidadEjemplares + 1)
}

// ── Portada / PDF por edición ─────────────────────────────────────────────
function onPortada(ev: Event, idx: number) {
  const f = (ev.target as HTMLInputElement).files?.[0]; if (!f) return
  ediciones.value[idx].portadaFile = f
  const r = new FileReader()
  r.onload = e => { ediciones.value[idx].portadaPreview = e.target?.result as string }
  r.readAsDataURL(f)
}
function quitarPortada(idx: number) {
  ediciones.value[idx].portadaFile    = null
  ediciones.value[idx].portadaPreview = ''
}
function onPdf(ev: Event, idx: number) {
  const f = (ev.target as HTMLInputElement).files?.[0]; if (!f) return
  ediciones.value[idx].pdfFile   = f
  ediciones.value[idx].pdfNombre = f.name
}
function quitarPdf(idx: number) {
  ediciones.value[idx].pdfFile   = null
  ediciones.value[idx].pdfNombre = ''
}

const totalEjemplares = computed(() =>
  ediciones.value.reduce((s, e) => s + e.cantidadEjemplares, 0)
)

// ══════════════════════════════════════════════════════════════════════════
// EJEMPLARES  — datos físicos comunes
// ══════════════════════════════════════════════════════════════════════════
const ej = reactive({
  bibliotecaId:         null as number | null,
  ubicacionFisica:      '',
  clasificacionDecimal: '',
  cutterAutor:          '',
  cutterTitulo:         '',
  estadoEjemplar:       'DISPONIBLE',
  fechaAdquisicion:     new Date().toISOString().split('T')[0],
  observaciones:        '',
})
const erroresEj = reactive<Record<string, string>>({})

watch(bibliotecas, (lista) => {
  if (!ej.bibliotecaId && lista.length) ej.bibliotecaId = lista[0].id
}, { immediate: true })

watch(() => libro.categoriaId, (id) => {
  const cat = categorias.value.find(c => (c.id_categoria ?? c.idCategoria) === id)
  ej.clasificacionDecimal = cat ? (cat.codigo_dewey ?? cat.codigoDewey ?? '') : ''
})
watch(autoresSeleccionados, (autores) => {
  libro.autores  = autores.map(a => a.nombre).join('; ')
  ej.cutterAutor = autores.length
    ? autores[0].nombre.trim().split(' ')[0].slice(0, 3).toUpperCase()
    : ''
}, { deep: true })
watch(() => libro.titulo, (v) => {
  ej.cutterTitulo = v
    .replace(/^(el|la|los|las|un|una|the|a)\s+/i, '')
    .replace(/\s+/g, '').slice(0, 3).toLowerCase()
})

// ══════════════════════════════════════════════════════════════════════════
// PRE-CARGA
// ══════════════════════════════════════════════════════════════════════════
async function precargarLibro(id: number) {
  try {
    const res  = await api.get(`/libros/${id}`)
    const data = res.data?.data ?? res.data
    libro.titulo      = data.titulo ?? ''
    libro.idioma      = data.idioma ?? 'es'
    libro.descripcion = data.descripcion ?? ''
    libro.categoriaId = data.categoria?.id_categoria ?? data.categoria?.idCategoria ?? null
    if (libro.categoriaId) {
      const cat = categorias.value.find(c => (c.id_categoria ?? c.idCategoria) === libro.categoriaId)
      if (cat) busquedaCategoria.value = cat.nombre_categoria ?? cat.nombreCategoria ?? ''
    }
    autoresSeleccionados.value = (data.autores ?? []).map((a: any) => ({
      idAutor: a.idAutor ?? a.id_autor, nombre: a.nombre,
    }))
    if (data.ediciones?.length) {
      ediciones.value = data.ediciones.map((ed: any) => ({
        editorial:          ed.editorial ?? '',
        edicionTexto:       ed.edicion ?? '',
        anoPublicacion:     ed.anoPublicacion ?? new Date().getFullYear(),
        cantidadEjemplares: ed.ejemplares?.length ?? 1,
        portadaFile:        null,
        portadaPreview:     ed.imagenPortada ?? '',   // URL remota
        pdfFile:            null,
        pdfNombre:          ed.urlPdf ? 'PDF cargado' : '',
      }))
    }
    const primerEj = data.ediciones?.[0]?.ejemplares?.[0]
    if (primerEj) {
      ej.clasificacionDecimal = primerEj.clasificacionDecimal ?? ''
      ej.cutterAutor          = primerEj.cutterAutor ?? ''
      ej.cutterTitulo         = primerEj.cutterTitulo ?? ''
      ej.ubicacionFisica      = primerEj.ubicacionFisica ?? ''
      ej.bibliotecaId         = primerEj.biblioteca?.idBiblioteca ?? null
    }
  } catch { }
}

// ══════════════════════════════════════════════════════════════════════════
// VALIDACIÓN
// ══════════════════════════════════════════════════════════════════════════
function validar(): boolean {
  Object.keys(erroresLibro).forEach(k => delete erroresLibro[k])
  Object.keys(erroresEj).forEach(k => delete erroresEj[k])
  if (!libro.titulo.trim()) erroresLibro.titulo = 'El título es obligatorio'
  if (!ej.bibliotecaId) erroresEj.biblioteca = 'Selecciona una biblioteca'
  if (totalEjemplares.value > 20) erroresEj.cantidad = 'El total de ejemplares no puede superar 50'
  return !Object.keys(erroresLibro).length && !Object.keys(erroresEj).length
}

// ══════════════════════════════════════════════════════════════════════════
// GUARDAR
// ══════════════════════════════════════════════════════════════════════════
const guardando    = ref(false)
const errorGuardar = ref('')

async function guardar() {
  if (!validar()) return
  guardando.value = true; errorGuardar.value = ''
  try {
    const edicionesPayload = ediciones.value.map((ed) => ({
      editorial:      ed.editorial.trim() || undefined,
      edicion:        ed.edicionTexto.trim() || undefined,
      anoPublicacion: ed.anoPublicacion,
      ejemplares: Array.from({ length: ed.cantidadEjemplares }, (_, i) => ({
        bibliotecaId:         ej.bibliotecaId,
        ubicacionFisica:      ej.ubicacionFisica.trim() || undefined,
        clasificacionDecimal: ej.clasificacionDecimal.trim() || undefined,
        cutterAutor:          ej.cutterAutor.trim() || undefined,
        codigoEjemplar:       `${ej.cutterTitulo.trim() || 'EJ'} Ej.${i + 1}`,
        cutterTitulo: ed.cantidadEjemplares > 1
          ? `${ej.cutterTitulo.trim()} Ej.${i + 1}`
          : ej.cutterTitulo.trim() || undefined,
        estadoEjemplar:   ej.estadoEjemplar,
        fechaAdquisicion: ej.fechaAdquisicion || new Date().toISOString().split('T')[0],
        observaciones:    ej.observaciones.trim() || undefined,
      })),
    }))

    const datos = {
      titulo:      libro.titulo.trim(),
      idioma:      libro.idioma,
      categoriaId: libro.categoriaId || undefined,
      descripcion: libro.descripcion.trim() || undefined,
      autorIds: autoresSeleccionados.value.filter(a => !a.nuevo && a.idAutor).map(a => a.idAutor),
      autores:  autoresSeleccionados.value.filter(a => a.nuevo).map(a => ({ nombre: a.nombre })),
      ediciones: edicionesPayload,
    }

    if (modoEdicion.value) {
      await api.put(`/libros/${libroId.value}`, {
        titulo: datos.titulo, idioma: datos.idioma,
        categoriaId: datos.categoriaId, descripcion: datos.descripcion,
        autores: datos.autores,
      })
      ui.toast.success('Guardado', 'Libro actualizado correctamente')
    } else {
      const fd = new FormData()
      fd.append('datos', new Blob([JSON.stringify(datos)], { type: 'application/json' }))
      // portada y PDF por edición → portada_0, portada_1 / pdf_0, pdf_1
      ediciones.value.forEach((ed, i) => {
        if (ed.portadaFile) fd.append(`portada_${i}`, ed.portadaFile)
        if (ed.pdfFile)     fd.append(`pdf_${i}`,     ed.pdfFile)
      })
      await api.post('/catalogo/lote', fd)
      ui.toast.success(
        'Registrado',
        `"${libro.titulo}" con ${ediciones.value.length} edición(es) y ${totalEjemplares.value} ejemplar(es) creados`,
      )
    }
    router.push('/inventario')
  } catch (e: unknown) {
    const err = e as any
    errorGuardar.value = err?.response?.data?.message ?? (e instanceof Error ? e.message : 'Error al guardar')
  } finally {
    guardando.value = false
  }
}

function cancelar() { router.push('/inventario') }
</script>

<template>
  <div class="page-container max-w-4xl">

    <!-- ── Page header ──────────────────────────────────────────────────── -->
    <div class="flex items-start justify-between mb-4">
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
              ? 'Modifica los datos del libro y sus ediciones.'
              : 'Registra un libro con sus ediciones y ejemplares en un solo paso.' }}
          </p>
        </div>
      </div>

      <!-- Biblioteca -->
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

    <!-- Cargando -->
    <div v-if="cargandoInicial" class="flex items-center justify-center py-24 gap-3">
      <svg class="w-6 h-6 animate-spin text-indigo-400" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
      <span class="text-sm text-slate-400">Cargando...</span>
    </div>

    <template v-else>
      <div class="space-y-4">

        <!-- ════════════════════════════════════════════════════════════
             DATOS DEL LIBRO
        ═════════════════════════════════════════════════════════════ -->
        <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">

          <!-- Título + Autores -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div class="space-y-4">
              <!-- Título -->
              <div>
                <label class="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
                  Título <span class="text-red-400">*</span>
                </label>
                <input v-model="libro.titulo" maxlength="100"
                  placeholder="Ej. BIO-BIBLIOGRAFÍA BOLIVIANA 2000"
                  class="w-full text-sm rounded-xl border px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow"
                  :class="erroresLibro.titulo ? 'border-red-400 bg-red-50' : 'border-slate-200'" />
                <p v-if="erroresLibro.titulo" class="text-xs text-red-500 mt-1">{{ erroresLibro.titulo }}</p>
              </div>

              <!-- Autores -->
              <div>
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

            <!-- Categoría + Idioma -->
            <div class="space-y-4">
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
                      <button v-for="cat in categoriasFiltradas" :key="cat.id_categoria ?? cat.idCategoria"
                        type="button" @click="seleccionarCategoria(cat)"
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
                    class="flex-shrink-0 w-10 h-10 flex items-center justify-center border border-slate-200 rounded-xl text-slate-500 hover:text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50 transition-colors">
                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                    </svg>
                  </button>
                </div>
                <div v-else class="p-3 border border-indigo-200 bg-indigo-50 rounded-xl space-y-2">
                  <div class="flex items-center justify-between">
                    <p class="text-xs font-semibold text-indigo-700">Nueva categoría</p>
                    <button @click="modoNuevaCategoria = false" class="text-xs text-slate-400 hover:text-slate-600">Cancelar</button>
                  </div>
                  <input v-model="nuevaCategoriaNombre" type="text" placeholder="Nombre *"
                    class="w-full text-sm rounded-lg border border-indigo-200 bg-white px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  <div class="grid grid-cols-2 gap-2">
                    <input v-model="nuevaCategoriaDewey" type="text" placeholder="Código Dewey"
                      class="text-sm rounded-lg border border-indigo-200 bg-white px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
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
            </div>
          </div>

        </div><!-- /card libro -->

        <!-- ════════════════════════════════════════════════════════════
             EDICIONES  (portada + PDF dentro de cada tarjeta)
        ═════════════════════════════════════════════════════════════ -->
        <div class="space-y-3">

          <!-- Cabecera sección -->
          <div class="flex items-center justify-between px-1">
            <div class="flex items-center gap-2">
              <h2 class="text-sm font-semibold text-slate-700 uppercase tracking-wide">Ediciones</h2>
              <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700">
                {{ ediciones.length }}
              </span>
            </div>
            <button v-if="ediciones.length < 10" @click="agregarEdicion"
              class="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-200 hover:border-indigo-300 transition-colors">
              <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4" />
              </svg>
              Agregar otra edición
            </button>
          </div>

          <!-- Tarjeta por edición -->
          <div v-for="(ed, idx) in ediciones" :key="idx"
            class="bg-white rounded-2xl border shadow-sm overflow-hidden transition-all"
            :class="idx === 0 ? 'border-slate-200' : 'border-indigo-100'">

            <!-- Header tarjeta -->
            <div class="flex items-center justify-between px-5 py-3 border-b"
              :class="idx === 0 ? 'bg-slate-50/60 border-slate-100' : 'bg-indigo-50/60 border-indigo-100'">
              <div class="flex items-center gap-2.5">
                <div :class="['w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0',
                  idx === 0 ? 'bg-slate-200 text-slate-600' : 'bg-indigo-200 text-indigo-700']">
                  {{ idx + 1 }}
                </div>
                <span class="text-sm font-semibold" :class="idx === 0 ? 'text-slate-700' : 'text-indigo-700'">
                  Edición {{ idx + 1 }}
                </span>
                <span v-if="ed.edicionTexto" class="text-xs text-slate-400">— {{ ed.edicionTexto }}</span>
              </div>
              <button v-if="idx > 0" @click="eliminarEdicion(idx)"
                class="flex items-center gap-1 text-xs text-slate-400 hover:text-red-500 hover:bg-red-50 px-2 py-1 rounded-lg transition-colors">
                <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Eliminar
              </button>
            </div>

            <!-- Cuerpo tarjeta -->
            <div class="p-5 space-y-5">

              <!-- Fila superior: portada · campos textuales · pdf -->
              <div class="flex gap-5 items-start">

                <!-- Portada -->
                <div class="flex-shrink-0 flex flex-col items-center gap-1.5">
                  <label class="text-xs font-semibold text-slate-600 uppercase tracking-wide self-start">Portada</label>
                  <label class="relative block w-20 aspect-[3/4] rounded-xl overflow-hidden border-2 border-dashed border-slate-200 hover:border-indigo-300 bg-slate-50 cursor-pointer group transition-colors">
                    <img v-if="ed.portadaPreview" :src="ed.portadaPreview" alt="Portada"
                      class="absolute inset-0 w-full h-full object-cover" />
                    <div v-else class="absolute inset-0 flex flex-col items-center justify-center gap-1">
                      <svg class="w-5 h-5 text-slate-300 group-hover:text-indigo-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                          d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14" />
                      </svg>
                      <span class="text-xs text-slate-400 text-center px-1 leading-tight">Subir</span>
                    </div>
                    <div v-if="ed.portadaPreview" class="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition-colors" />
                    <input type="file" accept="image/*" class="sr-only" @change="onPortada($event, idx)" />
                  </label>
                  <button v-if="ed.portadaPreview" @click="quitarPortada(idx)"
                    class="text-xs text-red-400 hover:text-red-600 transition-colors">Quitar</button>
                  <span v-else class="text-xs text-slate-400">(opcional)</span>
                </div>

                <!-- Campos textuales -->
                <div class="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div class="sm:col-span-3">
                    <label class="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Editorial</label>
                    <input v-model="ed.editorial" type="text" placeholder="Ej. Siglo XXI Editores"
                      class="w-full text-sm rounded-xl border border-slate-200 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow" />
                  </div>
                  <div>
                    <label class="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Nº edición</label>
                    <input v-model="ed.edicionTexto" type="text" placeholder="1ra, 2da…"
                      class="w-full text-sm rounded-xl border border-slate-200 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow" />
                  </div>
                  <div>
                    <label class="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Año</label>
                    <input v-model.number="ed.anoPublicacion" type="number" :min="1800" :max="new Date().getFullYear() + 1"
                      class="w-full text-sm rounded-xl border border-slate-200 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow" />
                  </div>
                </div>

                <!-- PDF -->
                <div class="flex-shrink-0 w-44">
                  <label class="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">PDF Digital</label>
                  <div v-if="!ed.pdfNombre"
                    class="flex flex-col items-center justify-center gap-1.5 p-3 h-[72px] border-2 border-dashed border-slate-200 rounded-xl hover:border-indigo-300 hover:bg-indigo-50 transition-colors cursor-pointer text-center"
                    @click="abrirSelectorPdf(idx)">
                    <svg class="w-5 h-5 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                        d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                    <span class="text-xs text-slate-400 leading-tight">Subir PDF<br><span class="text-slate-300">máx. 50 MB</span></span>
                    <input :ref="(el) => setPdfRef(el, idx)" type="file" accept=".pdf" class="sr-only" @change="onPdf($event, idx)" />
                  </div>
                  <div v-else
                    class="flex items-center gap-2 px-2.5 py-2 h-[72px] bg-emerald-50 border border-emerald-200 rounded-xl">
                    <svg class="w-4 h-4 text-emerald-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                    </svg>
                    <span class="text-xs text-emerald-700 truncate flex-1 leading-tight">{{ ed.pdfNombre }}</span>
                    <button @click="quitarPdf(idx)" class="text-emerald-400 hover:text-red-500 transition-colors flex-shrink-0">
                      <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <p class="text-xs text-slate-400 mt-1 text-center">(opcional)</p>
                </div>

              </div><!-- /fila superior -->

              <!-- Nº Ejemplares -->
              <div class="flex items-center gap-4 pt-4 border-t border-slate-100">
                <label class="text-xs font-semibold text-slate-600 uppercase tracking-wide whitespace-nowrap">
                  Nº Ejemplares
                </label>
                <div class="flex items-center rounded-xl border border-slate-200 overflow-hidden">
                  <button @click="decrementarEjemplares(idx)"
                    class="px-3 py-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors font-semibold text-lg leading-none select-none">−</button>
                  <input v-model.number="ed.cantidadEjemplares" type="text" min="1" max="10"
                    class="w-12 text-center text-sm font-semibold text-slate-900 py-2 border-x border-slate-200 focus:outline-none focus:bg-indigo-50" />
                  <button @click="incrementarEjemplares(idx)"
                    class="px-3 py-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors font-semibold text-lg leading-none select-none">+</button>
                </div>
                <span class="text-xs text-slate-400">
                  {{ ed.cantidadEjemplares }} ejemplar{{ ed.cantidadEjemplares !== 1 ? 'es' : '' }} para esta edición
                </span>
              </div>

            </div><!-- /cuerpo tarjeta -->
          </div><!-- /v-for ediciones -->

          <!-- Resumen total -->
          <div v-if="ediciones.length > 1"
            class="flex items-center justify-end gap-2 px-3 py-2 bg-slate-50 rounded-xl border border-slate-200">
            <svg class="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <span class="text-xs text-slate-500">Total:</span>
            <span class="text-sm font-semibold text-slate-800">{{ totalEjemplares }} ejemplar{{ totalEjemplares !== 1 ? 'es' : '' }}</span>
            <span class="text-xs text-slate-400">en {{ ediciones.length }} ediciones</span>
          </div>

        </div><!-- /ediciones -->

        <!-- ════════════════════════════════════════════════════════════
             CÓDIGO PARA SOLICITAR + DATOS FÍSICOS
        ═════════════════════════════════════════════════════════════ -->
        <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
          <h2 class="text-sm font-semibold text-slate-700 uppercase tracking-wide">Código para solicitar</h2>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label class="block text-xs text-slate-500 mb-1">Clasificación decimal (Dewey)</label>
              <input v-model="ej.clasificacionDecimal" type="text" placeholder="989.506" maxlength="10"
                class="w-full text-sm font-mono rounded-xl border border-slate-200 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label class="block text-xs text-slate-500 mb-1">Cutter autor</label>
              <input v-model="ej.cutterAutor" type="text" placeholder="REY" maxlength="10"
                class="w-full text-sm font-mono rounded-xl border border-slate-200 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              <p class="text-xs text-slate-400 mt-1">Auto: 3 letras del apellido</p>
            </div>
            <div>
              <label class="block text-xs text-slate-500 mb-1">Cutter título</label>
              <input v-model="ej.cutterTitulo" type="text" placeholder="izq" maxlength="10"
                class="w-full text-sm font-mono rounded-xl border border-slate-200 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              <p class="text-xs text-slate-400 mt-1">Auto: 3 letras del título</p>
            </div>
          </div>

          <!-- Preview -->
          <div class="rounded-xl border border-amber-200 bg-amber-50 overflow-hidden">
            <div class="flex items-center gap-2 px-4 py-2 border-b border-amber-200 bg-amber-100/60">
              <svg class="w-3.5 h-3.5 text-amber-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
              <p class="text-xs font-semibold text-amber-700 uppercase tracking-wide">Preview — código para solicitar</p>
            </div>
            <div class="px-4 py-3 overflow-x-auto">
              <table class="w-full text-xs">
                <thead>
                  <tr class="text-amber-700 font-medium">
                    <th class="text-left pb-1.5 pr-4">Edición</th>
                    <th class="text-left pb-1.5 pr-6">Colección</th>
                    <th class="text-left pb-1.5 pr-4">Decimal</th>
                    <th class="text-left pb-1.5 pr-4">Cutter autor</th>
                    <th class="text-left pb-1.5 pr-4">Cutter título</th>
                    <th class="text-left pb-1.5">Ejemplar</th>
                  </tr>
                </thead>
                <tbody>
                  <template v-for="(ed, ei) in ediciones" :key="ei">
                    <tr v-for="n in Math.min(ed.cantidadEjemplares, 3)" :key="`${ei}-${n}`"
                      class="font-mono text-slate-700"
                      :class="ei > 0 && n === 1 ? 'border-t border-amber-200/60' : ''">
                      <td class="pr-4 py-0.5 text-slate-500 font-sans font-medium whitespace-nowrap">
                        {{ n === 1 ? `Ed. ${ei + 1}` : '' }}
                      </td>
                      <td class="pr-6 py-0.5 text-slate-500">
                        {{ categoriaActual?.nombre_categoria ?? categoriaActual?.nombreCategoria ?? '—' }}
                      </td>
                      <td class="pr-4 py-0.5">{{ ej.clasificacionDecimal || '___' }}</td>
                      <td class="pr-4 py-0.5">{{ ej.cutterAutor || '___' }}</td>
                      <td class="pr-4 py-0.5">{{ ej.cutterTitulo || '___' }}</td>
                      <td class="py-0.5 text-indigo-600 font-semibold">Ej.{{ n }}</td>
                    </tr>
                    <tr v-if="ed.cantidadEjemplares > 3" :key="`${ei}-more`">
                      <td colspan="6" class="text-slate-400 italic py-0.5 pl-16">
                        ... y {{ ed.cantidadEjemplares - 3 }} más en Ed. {{ ei + 1 }}
                      </td>
                    </tr>
                  </template>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Datos físicos -->
          <!-- <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div class="sm:col-span-2">
              <label class="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Ubicación física</label>
              <input v-model="ej.ubicacionFisica" type="text" placeholder="Estante B-2, Fila 1"
                class="w-full text-sm rounded-xl border border-slate-200 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label class="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Estado inicial</label>
              <select v-model="ej.estadoEjemplar"
                class="w-full text-sm rounded-xl border border-slate-200 px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <option value="DISPONIBLE">🟢 Disponible</option>
                <option value="EN_REPARACION">🟣 En reparación</option>
                <option value="DAÑADO">🟡 Dañado</option>
              </select>
            </div>

            <div class="sm:col-span-2">
              <label class="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Fecha adquisición</label>
              <input v-model="ej.fechaAdquisicion" type="date"
                class="w-full text-sm rounded-xl border border-slate-200 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div class="sm:col-span-2">
              <label class="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Observaciones</label>
              <textarea v-model="ej.observaciones" rows="2" placeholder="Donación FHCE 2024…"
                class="w-full text-sm rounded-xl border border-slate-200 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
            </div>
          </div> -->

          <p v-if="erroresEj.biblioteca" class="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{{ erroresEj.biblioteca }}</p>
          <p v-if="erroresEj.cantidad"   class="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{{ erroresEj.cantidad }}</p>
        </div>

        <p v-if="errorGuardar" class="text-sm text-red-600 bg-red-50 border border-red-200 px-4 py-3 rounded-xl">
          {{ errorGuardar }}
        </p>

      </div><!-- /space-y-4 -->
    </template>

    <!-- Barra sticky -->
    <div class="sticky bottom-4 mt-6 flex items-center justify-between gap-3 bg-white border border-slate-200 rounded-2xl shadow-lg px-5 py-3">
      <p class="text-sm text-slate-400 hidden sm:block">
        <span class="font-medium text-slate-700">{{ ediciones.length }}</span> edición{{ ediciones.length !== 1 ? 'es' : '' }}
        · <span class="font-medium text-slate-700">{{ totalEjemplares }}</span> ejemplar{{ totalEjemplares !== 1 ? 'es' : '' }} en total
      </p>
      <div class="flex items-center gap-2 ml-auto">
        <SButton variant="secondary" @click="cancelar">Cancelar</SButton>
        <SButton variant="success" :loading="guardando" @click="guardar">
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