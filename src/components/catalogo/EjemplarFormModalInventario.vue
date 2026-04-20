<script setup lang="ts">
/**
 * EjemplarFormModal
 * Flujo de 3 pasos cuando se crea desde el inventario (sin contexto previo):
 *   Paso 1 — Libro   : buscar existente ó crear nuevo (con categoría)
 *   Paso 2 — Edición : elegir una edición del libro ó crear nueva
 *   Paso 3 — Ejemplar: datos físicos + biblioteca
 *
 * Cuando viene con edicionIdInicial (desde LibroDetalleModal) salta al paso 3.
 * Cuando viene con ejemplar (edición) salta directo al paso 3.
 */
import { ref, reactive, computed, watch, onMounted } from 'vue'
import BaseModal from './BaseModal.vue'
import api from '@/services/axios'
import { crearEjemplar, actualizarEjemplar } from '@/services/ejemplares.service'
import { obtenerCategorias, crearCategoria } from '@/services/categorias.service'
import { bibliotecasService } from '@/services/bibliotecas.service'
import { useAuthStore } from '@/stores/auth.store'
import { usePermissions } from '@/composables/usePermissions'
import type { Ejemplar, Edicion, Categoria, Libro } from '@/types/catalogo'

// ── Props / emits ─────────────────────────────────────────────────────────
const props = defineProps<{
  ejemplar?: Ejemplar | null        // modo edición
  edicionIdInicial?: number         // salta al paso 3 directamente
  ediciones?: Edicion[]             // ediciones pre-cargadas del libro padre
}>()

const emit = defineEmits<{ close: []; saved: [] }>()

const auth = useAuthStore()
const { isAdmin, isBibliotecario } = usePermissions()

// ── Paso activo ───────────────────────────────────────────────────────────
// Si edita ó viene con edicionIdInicial → paso 3
const pasoInicial = props.ejemplar || props.edicionIdInicial ? 3 : 1
const paso = ref<1 | 2 | 3>(pasoInicial as 1 | 2 | 3)

const tituloPaso = computed(() => {
  if (props.ejemplar) return 'Editar ejemplar'
  return ['', 'Paso 1 — Libro', 'Paso 2 — Edición', 'Paso 3 — Datos del ejemplar'][paso.value]
})

// ══════════════════════════════════════════════════════════════════
// PASO 1 — LIBRO
// ══════════════════════════════════════════════════════════════════
type ModoLibro = 'buscar' | 'crear'
const modoLibro = ref<ModoLibro>('buscar')
const libroSeleccionado = ref<Libro | null>(null)
const busquedaLibro = ref('')
const buscandoLibros = ref(false)
const resultadosLibros = ref<Libro[]>([])
let timerBusqueda: ReturnType<typeof setTimeout>

// Búsqueda con debounce
watch(busquedaLibro, (q) => {
  clearTimeout(timerBusqueda)
  if (!q.trim()) { resultadosLibros.value = []; return }
  timerBusqueda = setTimeout(() => buscarLibros(q), 350)
})

async function buscarLibros(q: string) {
  buscandoLibros.value = true
  try {
    const res = await api.get('/libros/search', { params: { q } })
    const data = res.data.data
    resultadosLibros.value = Array.isArray(data) ? data : (data?.content ?? [])
  } catch {
    resultadosLibros.value = []
  } finally {
    buscandoLibros.value = false
  }
}

function elegirLibro(libro: Libro) {
  libroSeleccionado.value = libro
  nuevoLibro.titulo = libro.titulo
  paso.value = 2
  cargarEdicionesLibro(libro.idLibro)
}

// ── Crear libro nuevo ─────────────────────────────────────────────
const categorias = ref<Categoria[]>([])
const cargandoCategorias = ref(false)
const modoCategoria = ref<'elegir' | 'nueva'>('elegir')

const nuevoLibro = reactive({
  titulo: '',
  idioma: 'es',
  categoriaId: null as number | null,
  descripcion: '',
})
const nuevaCategoria = reactive({
  nombreCategoria: '',
  descripcion: '',
  codigoDewey: '',
})
const erroresLibro = reactive<Record<string, string>>({})
const creandoLibro = ref(false)

onMounted(async () => {
  if (paso.value === 1) {
    cargandoCategorias.value = true
    try { categorias.value = await obtenerCategorias() }
    finally { cargandoCategorias.value = false }
  }
  await cargarBibliotecas()
  // Si viene con edicionIdInicial, pre-cargar edicionId
  if (props.edicionIdInicial) {
    formEjemplar.edicionId = props.edicionIdInicial
  }
})

async function crearNuevaCategoria() {
  if (!nuevaCategoria.nombreCategoria.trim()) return
  try {
    const cat = await crearCategoria({
      nombre_categoria: nuevaCategoria.nombreCategoria,
      descripcion: nuevaCategoria.descripcion || undefined,
      codigo_dewey: nuevaCategoria.codigoDewey || undefined,
    } as any)
    categorias.value.push(cat)
    nuevoLibro.categoriaId = cat.idCategoria
    modoCategoria.value = 'elegir'
    nuevaCategoria.nombreCategoria = ''
    nuevaCategoria.descripcion = ''
    nuevaCategoria.codigoDewey = ''
  } catch (e: unknown) {
    // alert(e instanceof Error ? e.message : 'Error al crear categoría')
    let msg = 'No se pudo completar el registro'

    if (typeof e === 'object' && e !== null && 'response' in e) {
      const err = e as any
      msg = err.response?.data?.message || msg
      // console.log("BACKEND 👉", err.response?.data)
    } else if (e instanceof Error) {
      msg = e.message
    }
  }
}

async function guardarNuevoLibro() {
  Object.keys(erroresLibro).forEach(k => delete erroresLibro[k])
  console.log('nuevolibro', nuevoLibro)
  if (!nuevoLibro.titulo.trim()) erroresLibro.titulo = 'El título es requerido'
  if (!nuevoLibro.categoriaId) erroresLibro.categoriaId = 'La categoría es requerida'
  if (Object.keys(erroresLibro).length) return
  creandoLibro.value = true
  try {
    const res = await api.post('/libros', {
      titulo: nuevoLibro.titulo.trim(),
      idioma: nuevoLibro.idioma,
      categoriaId: nuevoLibro.categoriaId,
      descripcion: nuevoLibro.descripcion.trim() || undefined,
    })
    const libro: Libro = res.data?.data ?? res.data
    libroSeleccionado.value = libro
    paso.value = 2
    edicionesLibro.value = []  // libro nuevo, sin ediciones aún
  } catch (e: unknown) {
    erroresLibro.general = e instanceof Error ? e.message : 'Error al crear libro'
  } finally {
    creandoLibro.value = false
  }
}

// ══════════════════════════════════════════════════════════════════
// PASO 2 — EDICIÓN
// ══════════════════════════════════════════════════════════════════
type ModoEdicion = 'elegir' | 'nueva'
const modoEdicion = ref<ModoEdicion>('elegir')
const edicionElegida = ref<Edicion | null>(null)
const edicionesLibro = ref<Edicion[]>([])
const cargandoEdiciones = ref(false)

async function cargarEdicionesLibro(libroId: number) {
  // Si vienen pre-cargadas del padre, usarlas directamente
  if (props.ediciones && props.ediciones.length) {
    edicionesLibro.value = props.ediciones
    return
  }
  cargandoEdiciones.value = true
  try {
    const res = await api.get(`/ediciones/libro/${libroId}`)
    edicionesLibro.value = Array.isArray(res.data) ? res.data : (res.data?.data ?? [])
  } catch {
    edicionesLibro.value = []
  } finally {
    cargandoEdiciones.value = false
  }
}

function elegirEdicion(ed: Edicion) {
  edicionElegida.value = ed
  formEjemplar.edicionId = ed.idEdicion
  paso.value = 3
}

// ── Crear edición nueva ────────────────────────────────────────────
const nuevaEdicion = reactive({
  isbn: '',
  editorial: '',
  anoPublicacion: new Date().getFullYear(),
  edicion: '1ra',
  numeroPaginas: null as number | null,
  imagenPortada: '',
})
const erroresEdicion = reactive<Record<string, string>>({})
const creandoEdicion = ref(false)

// Preview portada
function onPortadaChange(ev: Event) {
  const file = (ev.target as HTMLInputElement).files?.[0]
  if (!file) return
  const r = new FileReader()
  r.onload = (e) => { nuevaEdicion.imagenPortada = e.target?.result as string }
  r.readAsDataURL(file)
}

async function guardarNuevaEdicion() {
  Object.keys(erroresEdicion).forEach(k => delete erroresEdicion[k])
  if (!nuevaEdicion.isbn.trim()) erroresEdicion.isbn = 'El ISBN es requerido'
  if (!nuevaEdicion.editorial.trim()) erroresEdicion.editorial = 'La editorial es requerida'
  if (!libroSeleccionado.value) erroresEdicion.general = 'No hay libro seleccionado'
  if (Object.keys(erroresEdicion).length) return

  creandoEdicion.value = true
  try {
    console.log('crear edicion')
    console.log(nuevaEdicion)
    const res = await api.post('/ediciones', {
      isbn: nuevaEdicion.isbn.trim(),
      editorial: nuevaEdicion.editorial.trim(),
      anoPublicacion: nuevaEdicion.anoPublicacion,
      edicion: nuevaEdicion.edicion.trim() || undefined,
      numeroPaginas: nuevaEdicion.numeroPaginas || undefined,
      imagenPortada: nuevaEdicion.imagenPortada || undefined,
      libroId: libroSeleccionado.value!.idLibro,
    })
    const ed: Edicion = res.data?.data ?? res.data
    edicionElegida.value = ed
    formEjemplar.edicionId = ed.idEdicion
    paso.value = 3
  } catch (e: unknown) {
    let msg = 'Error al crear edicion'

    if (typeof e === 'object' && e !== null && 'response' in e) {
      const err = e as any
      msg = err.response?.data?.message || msg
      // console.log("BACKEND 👉", err.response?.data)
    } else if (e instanceof Error) {
      msg = e.message
    }
    erroresEdicion.general = e instanceof Error ? msg : 'Error al crear edición'
  } finally {
    creandoEdicion.value = false
  }
}

// ══════════════════════════════════════════════════════════════════
// PASO 3 — EJEMPLAR
// ══════════════════════════════════════════════════════════════════
interface BibliotecaOpcion { id: number; nombre: string }
const bibliotecas = ref<BibliotecaOpcion[]>([])
const cargandoBibs = ref(false)

const bibliotecaPropia = computed<BibliotecaOpcion | null>(() => {
  // const bib = auth.user?.biblioteca as Record<string, unknown> | null | undefined
  // if (!bib) return null
  // const id = (bib.id_biblioteca ?? bib.idBiblioteca ?? bib.id) as number | undefined
  // const nombre = (bib.nombre ?? bib.name) as string | undefined
  // return id && nombre ? { id, nombre } : null
  if (!auth.user?.biblioteca || auth.user.biblioteca.length === 0) return []

  return auth.user.biblioteca.map((bib: any) => ({
    id: (bib.id_biblioteca ?? bib.idBiblioteca ?? bib.id) as number,
    nombre: (bib.nombre ?? bib.name) as string,
  })).filter(b => b.id && b.nombre)
})

async function cargarBibliotecas() {
  if (!isAdmin.value) {
    console.log(bibliotecaPropia.value)
    if (bibliotecaPropia.value) {
      bibliotecas.value = [bibliotecaPropia.value]
      console.log('bibliotecario')
      console.log(bibliotecaPropia.value)
      console.log(bibliotecas)
    }

    return
  }
  cargandoBibs.value = true
  try {
    const res = await bibliotecasService.getAll()
    const raw = res.data as unknown
    console.log('bib')
    console.log(res)
    console.log(raw)
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

const opcionesEstado = [
  { value: 'DISPONIBLE', label: '🟢 Disponible' },
  { value: 'EN_REPARACION', label: '🟡 En reparación' },
  { value: 'DAÑADO', label: '🟡 Dañado' },
]

const formEjemplar = reactive({
  edicionId: props.edicionIdInicial ?? null as number | null,
  bibliotecaId: bibliotecaPropia.value?.id ?? null as number | null,
  codigoEjemplar: '',
  codigoTopografico: '',
  ubicacionFisica: '',
  estadoEjemplar: 'DISPONIBLE',
  fechaAdquisicion: new Date().toISOString().split('T')[0],
  precioCompra: null as number | null,
  observaciones: '',
})

// Pre-rellenar al editar
watch(() => props.ejemplar, (e) => {
  if (!e) return

  console.log('123123')
  formEjemplar.edicionId = e.edicion?.idEdicion ?? null
  formEjemplar.bibliotecaId = e.biblioteca?.idBiblioteca ?? bibliotecaPropia.value?.id ?? null
  // if (bibliotecaPropia.value?.length > 0) {
  //   formEjemplar.bibliotecaId = bibliotecaPropia.value[0].id
  // } else {
  //   formEjemplar.bibliotecaId = null
  // }
  formEjemplar.codigoEjemplar = e.codigoEjemplar ?? ''
  formEjemplar.codigoTopografico = e.codigoTopografico ?? ''
  formEjemplar.ubicacionFisica = e.ubicacionFisica ?? ''
  formEjemplar.estadoEjemplar = e.estadoEjemplar ?? 'DISPONIBLE'
  formEjemplar.fechaAdquisicion = e.fechaAdquisicion ?? new Date().toISOString().split('T')[0]
  formEjemplar.precioCompra = e.precioCompra ?? null
  formEjemplar.observaciones = e.observaciones ?? ''
}, { immediate: true })

// Pre-seleccionar biblioteca del bibliotecario
watch(bibliotecaPropia, (bib) => {
  if (bib.length && !formEjemplar.bibliotecaId) formEjemplar.bibliotecaId = bib[0].id
}, { immediate: true })

const erroresEjemplar = reactive<Record<string, string>>({})
const guardando = ref(false)
const errorGeneral = ref('')

function validarEjemplar(): boolean {
  Object.keys(erroresEjemplar).forEach(k => delete erroresEjemplar[k])
  if (!formEjemplar.codigoEjemplar.trim()) erroresEjemplar.codigoEjemplar = 'El código es requerido'
  if (!formEjemplar.ubicacionFisica.trim()) erroresEjemplar.ubicacionFisica = 'La ubicación es requerida'
  if (!formEjemplar.edicionId) erroresEjemplar.edicionId = 'Falta la edición asociada'
  if (!formEjemplar.bibliotecaId) erroresEjemplar.bibliotecaId = 'Debe seleccionar una biblioteca'
  return Object.keys(erroresEjemplar).length === 0
}

async function guardarEjemplar() {
  console.log('guardar ejemplar')
  console.log(formEjemplar)
  if (!validarEjemplar()) return
  guardando.value = true; errorGeneral.value = ''
  try {
    if (props.ejemplar) {
      console.log(props.ejemplar)
      await actualizarEjemplar(props.ejemplar.id_ejemplar, {
        codigoEjemplar: formEjemplar.codigoEjemplar,
        codigoTopografico: formEjemplar.codigoTopografico || undefined,
        ubicacionFisica: formEjemplar.ubicacionFisica || undefined,
        edicionId: formEjemplar.edicionId!,
        bibliotecaId: formEjemplar.bibliotecaId!,
        precioCompra: formEjemplar.precioCompra,
        observaciones: formEjemplar.observaciones || undefined,
      })
    } else {
      await crearEjemplar({
        codigoEjemplar: formEjemplar.codigoEjemplar,
        codigoTopografico: formEjemplar.codigoTopografico || undefined,
        ubicacionFisica: formEjemplar.ubicacionFisica || undefined,
        edicionId: formEjemplar.edicionId!,
        bibliotecaId: formEjemplar.bibliotecaId!,
        estadoEjemplar: formEjemplar.estadoEjemplar as any,
        fechaAdquisicion: formEjemplar.fechaAdquisicion || undefined,
        precioCompra: formEjemplar.precioCompra,
        observaciones: formEjemplar.observaciones || undefined,
      })
    }
    emit('saved')
  } catch (e: unknown) {
    errorGeneral.value = e instanceof Error ? e.message : 'Error al guardar'
  } finally {
    guardando.value = false
  }
}

// ── Resumen del contexto seleccionado ─────────────────────────────
const resumenContexto = computed(() => {
  const partes: string[] = []
  if (libroSeleccionado.value) partes.push(libroSeleccionado.value.titulo)
  if (edicionElegida.value) partes.push(`ISBN ${edicionElegida.value.isbn}`)
  return partes.join(' → ')
})
</script>

<template>
  <BaseModal :title="tituloPaso" size="lg" @close="emit('close')">
    <!-- ── Indicador de pasos (solo al crear) ───────────────────────── -->
    <div v-if="!props.ejemplar" class="flex items-center gap-2 mb-6">
      <template v-for="n in [1, 2, 3]" :key="n">
        <div class="flex items-center gap-2">
          <div :class="['w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-colors',
            paso === n ? 'bg-indigo-600 text-white' :
              paso > n ? 'bg-emerald-500 text-white' :
                'bg-slate-100 text-slate-400']">
            <svg v-if="paso > n" class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
            </svg>
            <span v-else>{{ n }}</span>
          </div>
          <span class="text-xs hidden sm:inline"
            :class="paso === n ? 'text-indigo-600 font-medium' : paso > n ? 'text-emerald-600' : 'text-slate-400'">
            {{ ['Libro', 'Edición', 'Ejemplar'][n - 1] }}
          </span>
        </div>
        <div v-if="n < 3" class="flex-1 h-px" :class="paso > n ? 'bg-emerald-300' : 'bg-slate-200'" />
      </template>
    </div>

    <!-- Resumen contexto (pasos 2 y 3) -->
    <div v-if="resumenContexto && paso > 1 && !props.ejemplar"
      class="flex items-center gap-2 px-3 py-2 mb-4 bg-indigo-50 border border-indigo-100 rounded-xl">
      <svg class="w-4 h-4 text-indigo-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
          d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
      <span class="text-xs text-indigo-700 font-medium truncate">{{ resumenContexto }}</span>
    </div>

    <!-- ════════════════════════════════════════════════════════════
         PASO 1 — LIBRO
    ════════════════════════════════════════════════════════════ -->
    <div v-if="paso === 1" class="space-y-4">

      <!-- Tabs buscar / crear -->
      <div class="flex rounded-lg border border-slate-200 overflow-hidden text-sm w-fit">
        <button @click="modoLibro = 'buscar'" :class="['px-4 py-2 transition-colors font-medium',
          modoLibro === 'buscar' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-50']">
          Buscar libro
        </button>
        <button @click="modoLibro = 'crear'" :class="['px-4 py-2 transition-colors font-medium',
          modoLibro === 'crear' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-50']">
          Crear nuevo
        </button>
      </div>

      <!-- ── Buscar libro existente ── -->
      <div v-if="modoLibro === 'buscar'" class="space-y-3">
        <div class="relative">
          <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24"
            stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input v-model="busquedaLibro" type="text" placeholder="Buscar por título, ISBN o editorial..."
            class="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>

        <!-- Cargando -->
        <div v-if="buscandoLibros" class="flex items-center gap-2 text-xs text-slate-400 py-2">
          <svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Buscando...
        </div>

        <!-- Resultados -->
        <div v-else-if="resultadosLibros.length" class="space-y-1.5 max-h-56 overflow-y-auto">
          <button v-for="libro in resultadosLibros" :key="libro.idLibro" @click="elegirLibro(libro)"
            class="w-full flex items-start gap-3 px-3 py-2.5 rounded-xl border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 text-left transition-colors">
            <!-- Portada mini -->
            <div class="w-8 h-11 flex-shrink-0 rounded overflow-hidden bg-slate-100">
              <img v-if="libro.ediciones?.[0]?.imagenPortada" :src="libro.ediciones[0].imagenPortada" alt=""
                class="w-full h-full object-cover" />
              <div v-else class="w-full h-full flex items-center justify-center">
                <svg class="w-4 h-4 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                    d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13" />
                </svg>
              </div>
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium text-slate-900 truncate">{{ libro.titulo }}</p>
              <p class="text-xs text-slate-500 truncate">
                {{ libro.categoria?.nombreCategoria }}
                <template v-if="libro.ediciones?.length">
                  · {{ libro.ediciones.length }} edición{{ libro.ediciones.length !== 1 ? 'es' : '' }}
                </template>
              </p>
            </div>
            <svg class="w-4 h-4 text-indigo-400 flex-shrink-0 mt-1" fill="none" viewBox="0 0 24 24"
              stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        <!-- Sin resultados -->
        <div v-else-if="busquedaLibro.trim() && !buscandoLibros"
          class="text-center py-6 border border-dashed border-slate-200 rounded-xl">
          <p class="text-sm text-slate-500 mb-2">No se encontraron libros</p>
          <button @click="modoLibro = 'crear'; nuevoLibro.titulo = busquedaLibro"
            class="text-xs text-indigo-600 font-medium hover:underline">
            Crear "{{ busquedaLibro }}" como nuevo libro →
          </button>
        </div>

        <!-- Estado inicial vacío -->
        <div v-else-if="!busquedaLibro.trim()"
          class="text-center py-6 border border-dashed border-slate-200 rounded-xl">
          <svg class="w-8 h-8 text-slate-200 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <p class="text-xs text-slate-400">Escribe para buscar un libro existente</p>
        </div>
      </div>

      <!-- ── Crear libro nuevo ── -->
      <div v-else class="space-y-3">
        <div>
          <label class="block text-xs font-medium text-slate-600 mb-1">Título *</label>
          <input v-model="nuevoLibro.titulo" type="text" placeholder="Título del libro"
            class="w-full text-sm rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            :class="erroresLibro.titulo ? 'border-red-400' : 'border-slate-200'" />
          <p v-if="erroresLibro.titulo" class="text-xs text-red-500 mt-1">{{ erroresLibro.titulo }}</p>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <!-- Categoría -->
          <div>
            <label class="block text-xs font-medium text-slate-600 mb-1">Categoría *</label>
            <div v-if="modoCategoria === 'elegir'" class="flex gap-1.5">
              <select v-model="nuevoLibro.categoriaId"
                class="flex-1 text-sm rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                :class="erroresLibro.categoriaId ? 'border-red-400' : 'border-slate-200'">
                <option :value="null" disabled>Seleccionar</option>
                <option v-for="cat in categorias" :key="cat.id_categoria" :value="cat.id_categoria">
                  {{ cat.nombre_categoria }}
                </option>
              </select>
              <button @click="modoCategoria = 'nueva'"
                class="flex-shrink-0 px-2 py-2 border border-slate-200 rounded-lg text-slate-500 hover:text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50 transition-colors"
                title="Nueva categoría">
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                </svg>
              </button>
            </div>

            <!-- Formulario nueva categoría -->
            <div v-else class="space-y-2 p-3 border border-indigo-200 bg-indigo-50 rounded-xl">
              <div class="flex items-center justify-between mb-1">
                <p class="text-xs font-medium text-indigo-700">Nueva categoría</p>
                <button @click="modoCategoria = 'elegir'"
                  class="text-xs text-slate-400 hover:text-slate-600">Cancelar</button>
              </div>
              <input v-model="nuevaCategoria.nombreCategoria" type="text" placeholder="Nombre *"
                class="w-full text-sm rounded-lg border border-indigo-200 bg-white px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              <div class="grid grid-cols-2 gap-2">
                <input v-model="nuevaCategoria.codigoDewey" type="text" placeholder="Cód. Dewey"
                  class="w-full text-sm rounded-lg border border-indigo-200 bg-white px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                <button @click="crearNuevaCategoria" :disabled="!nuevaCategoria.nombreCategoria.trim()"
                  class="text-xs font-medium bg-indigo-600 text-white rounded-lg px-3 py-1.5 hover:bg-indigo-700 transition-colors disabled:opacity-50">
                  Crear
                </button>
              </div>
            </div>
            <p v-if="erroresLibro.categoriaId" class="text-xs text-red-500 mt-1">{{ erroresLibro.categoriaId }}</p>
          </div>

          <!-- Idioma -->
          <div>
            <label class="block text-xs font-medium text-slate-600 mb-1">Idioma</label>
            <select v-model="nuevoLibro.idioma"
              class="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white">
              <option value="es">Español</option>
              <option value="en">Inglés</option>
              <option value="pt">Portugués</option>
              <option value="fr">Francés</option>
              <option value="de">Alemán</option>
            </select>
          </div>
        </div>

        <div>
          <label class="block text-xs font-medium text-slate-600 mb-1">Descripción</label>
          <textarea v-model="nuevoLibro.descripcion" rows="2" placeholder="Descripción breve..."
            class="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
        </div>

        <p v-if="erroresLibro.general" class="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">
          {{ erroresLibro.general }}
        </p>
      </div>
    </div>

    <!-- ════════════════════════════════════════════════════════════
         PASO 2 — EDICIÓN
    ════════════════════════════════════════════════════════════ -->
    <div v-if="paso === 2" class="space-y-4">

      <!-- Tabs elegir / nueva -->
      <div class="flex rounded-lg border border-slate-200 overflow-hidden text-sm w-fit">
        <button @click="modoEdicion = 'elegir'" :class="['px-4 py-2 transition-colors font-medium',
          modoEdicion === 'elegir' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-50']">
          Elegir edición
        </button>
        <button @click="modoEdicion = 'nueva'" :class="['px-4 py-2 transition-colors font-medium',
          modoEdicion === 'nueva' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-50']">
          Nueva edición
        </button>
      </div>

      <!-- ── Elegir edición existente ── -->
      <div v-if="modoEdicion === 'elegir'">
        <div v-if="cargandoEdiciones" class="flex items-center gap-2 py-4 text-xs text-slate-400">
          <svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Cargando ediciones...
        </div>

        <div v-else-if="edicionesLibro.length" class="space-y-2">
          <button v-for="ed in edicionesLibro" :key="ed.idEdicion" @click="elegirEdicion(ed)"
            class="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 text-left transition-colors">
            <!-- Portada -->
            <div class="w-10 h-13 flex-shrink-0 rounded-lg overflow-hidden bg-slate-100">
              <img v-if="ed.imagenPortada" :src="ed.imagenPortada" alt="" class="w-full h-full object-cover" />
              <div v-else class="w-full h-full flex items-center justify-center">
                <svg class="w-4 h-4 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16" />
                </svg>
              </div>
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-sm font-mono font-semibold text-slate-900">{{ ed.isbn }}</p>
              <p class="text-xs text-slate-600 truncate">
                {{ ed.editorial }} · {{ ed.anoPublicacion }}
                <template v-if="ed.edicion"> · {{ ed.edicion }}</template>
              </p>
              <p class="text-xs text-slate-400">
                {{ ed.ejemplaresDisponibles ?? 0 }} / {{ ed.ejemplaresTotal ?? 0 }} disp.
              </p>
            </div>
            <svg class="w-4 h-4 text-indigo-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        <!-- Sin ediciones -->
        <div v-else class="text-center py-8 border border-dashed border-slate-200 rounded-xl">
          <p class="text-sm text-slate-500 mb-2">Este libro no tiene ediciones</p>
          <button @click="modoEdicion = 'nueva'" class="text-xs text-indigo-600 font-medium hover:underline">
            Crear la primera edición →
          </button>
        </div>
      </div>

      <!-- ── Crear nueva edición ── -->
      <div v-else class="space-y-3">
        <!-- Preview portada + ISBN/editorial -->
        <div class="flex gap-4">
          <label
            class="relative flex-shrink-0 w-20 h-28 rounded-xl overflow-hidden bg-gradient-to-br from-indigo-50 to-slate-100 border border-slate-200 group cursor-pointer">
            <img v-if="nuevaEdicion.imagenPortada" :src="nuevaEdicion.imagenPortada" alt=""
              class="w-full h-full object-cover" />
            <div v-else class="w-full h-full flex flex-col items-center justify-center gap-1.5">
              <svg class="w-6 h-6 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span class="text-xs text-slate-400 text-center leading-tight">Portada</span>
            </div>
            <div class="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition-colors" />
            <input type="file" accept="image/*" class="sr-only" @change="onPortadaChange" />
          </label>

          <div class="flex-1 space-y-2.5">
            <div>
              <label class="block text-xs font-medium text-slate-600 mb-1">ISBN *</label>
              <input v-model="nuevaEdicion.isbn" type="text" placeholder="978-0-262-03384-8"
                class="w-full text-sm rounded-lg border px-3 py-2 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                :class="erroresEdicion.isbn ? 'border-red-400' : 'border-slate-200'" />
              <p v-if="erroresEdicion.isbn" class="text-xs text-red-500 mt-1">{{ erroresEdicion.isbn }}</p>
            </div>
            <div>
              <label class="block text-xs font-medium text-slate-600 mb-1">Editorial *</label>
              <input v-model="nuevaEdicion.editorial" type="text" placeholder="MIT Press"
                class="w-full text-sm rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                :class="erroresEdicion.editorial ? 'border-red-400' : 'border-slate-200'" />
              <p v-if="erroresEdicion.editorial" class="text-xs text-red-500 mt-1">{{ erroresEdicion.editorial }}</p>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-3 gap-3">
          <div>
            <label class="block text-xs font-medium text-slate-600 mb-1">Año *</label>
            <input v-model.number="nuevaEdicion.anoPublicacion" type="number"
              class="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div>
            <label class="block text-xs font-medium text-slate-600 mb-1">Edición</label>
            <input v-model="nuevaEdicion.edicion" type="text" placeholder="4ta"
              class="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div>
            <label class="block text-xs font-medium text-slate-600 mb-1">Páginas</label>
            <input v-model.number="nuevaEdicion.numeroPaginas" type="number" placeholder="450"
              class="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
        </div>

        <p v-if="erroresEdicion.general" class="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">
          {{ erroresEdicion.general }}
        </p>
      </div>
    </div>

    <!-- ════════════════════════════════════════════════════════════
         PASO 3 — DATOS DEL EJEMPLAR
    ════════════════════════════════════════════════════════════ -->
    <div v-if="paso === 3" class="space-y-4">

      <!-- Biblioteca -->
      <div>
        <label class="block text-xs font-medium text-slate-600 mb-1">
          Biblioteca *
          <span v-if="isBibliotecario && !isAdmin" class="text-slate-400 font-normal">(tu biblioteca)</span>
        </label>
        <div v-if="isAdmin">
          <div v-if="cargandoBibs" class="flex items-center gap-2 h-9 text-xs text-slate-400">
            <svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Cargando...
          </div>
          <select v-else v-model="formEjemplar.bibliotecaId"
            class="w-full text-sm rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
            :class="erroresEjemplar.bibliotecaId ? 'border-red-400' : 'border-slate-200'">
            <option :value="null" disabled>Seleccionar biblioteca</option>
            <option v-for="bib in bibliotecas" :key="bib.id" :value="bib.id">{{ bib.nombre }}</option>
          </select>
        </div>
        <div v-else class="flex items-center gap-2 px-3 py-2 bg-indigo-50 border border-indigo-200 rounded-lg">
          <svg class="w-4 h-4 text-indigo-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" />
          </svg>
          <span class="text-sm font-medium text-indigo-700">
            {{ bibliotecaPropia[0]?.nombre ?? 'Sin biblioteca asignada' }}
          </span>
        </div>
        <p v-if="erroresEjemplar.bibliotecaId" class="text-xs text-red-500 mt-1">{{ erroresEjemplar.bibliotecaId }}</p>
      </div>

      <!-- Código + topográfico -->
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="block text-xs font-medium text-slate-600 mb-1">Código ejemplar *</label>
          <input v-model="formEjemplar.codigoEjemplar" type="text" placeholder="EJ-2024-010"
            class="w-full text-sm rounded-lg border px-3 py-2 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
            :class="erroresEjemplar.codigoEjemplar ? 'border-red-400' : 'border-slate-200'" />
          <p v-if="erroresEjemplar.codigoEjemplar" class="text-xs text-red-500 mt-1">{{ erroresEjemplar.codigoEjemplar
          }}
          </p>
          <p class="text-xs text-slate-400 mt-0.5">Debe ser único</p>
        </div>
        <div>
          <label class="block text-xs font-medium text-slate-600 mb-1">Código topográfico</label>
          <input v-model="formEjemplar.codigoTopografico" type="text" placeholder="004.1 C676"
            class="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
      </div>

      <!-- Ubicación -->
      <div>
        <label class="block text-xs font-medium text-slate-600 mb-1">Ubicación física *</label>
        <input v-model="formEjemplar.ubicacionFisica" type="text" placeholder="Estante B-2, Fila 1"
          class="w-full text-sm rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          :class="erroresEjemplar.ubicacionFisica ? 'border-red-400' : 'border-slate-200'" />
        <p v-if="erroresEjemplar.ubicacionFisica" class="text-xs text-red-500 mt-1">{{ erroresEjemplar.ubicacionFisica
        }}
        </p>
      </div>

      <!-- Estado (solo al crear) -->
      <div v-if="!props.ejemplar">
        <label class="block text-xs font-medium text-slate-600 mb-1">Estado inicial</label>
        <select v-model="formEjemplar.estadoEjemplar"
          class="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white">
          <option v-for="op in opcionesEstado" :key="op.value" :value="op.value">{{ op.label }}</option>
        </select>
      </div>

      <!-- Fecha + Precio -->
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="block text-xs font-medium text-slate-600 mb-1">Fecha adquisición</label>
          <input v-model="formEjemplar.fechaAdquisicion" type="date"
            class="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
        <div>
          <label class="block text-xs font-medium text-slate-600 mb-1">Precio compra (Bs.)</label>
          <input v-model.number="formEjemplar.precioCompra" type="number" step="0.01" placeholder="85.00"
            class="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
      </div>

      <!-- Observaciones -->
      <div>
        <label class="block text-xs font-medium text-slate-600 mb-1">Observaciones</label>
        <textarea v-model="formEjemplar.observaciones" rows="2" placeholder="Donación FHCE 2024..."
          class="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
      </div>

      <p v-if="erroresEjemplar.edicionId" class="text-xs text-red-500">{{ erroresEjemplar.edicionId }}</p>
      <p v-if="errorGeneral" class="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{{ errorGeneral }}</p>
    </div>

    <!-- ── Footer ─────────────────────────────────────────────────────── -->
    <template #footer>
      <!-- Volver (pasos 2 y 3, solo al crear) -->
      <button v-if="!props.ejemplar && paso > 1" @click="paso > 2 ? (paso = 2) : (paso = 1)"
        class="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors mr-auto">
        ← Volver
      </button>

      <!-- Cancelar -->
      <button @click="emit('close')"
        class="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
        Cancelar
      </button>

      <!-- Acción principal según paso -->
      <!-- Paso 1: Crear libro -->
      <button v-if="paso === 1 && modoLibro === 'crear'" @click="guardarNuevoLibro" :disabled="creandoLibro"
        class="px-5 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors disabled:opacity-60 flex items-center gap-2">
        <svg v-if="creandoLibro" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        Crear libro y continuar →
      </button>

      <!-- Paso 2: Crear edición -->
      <button v-if="paso === 2 && modoEdicion === 'nueva'" @click="guardarNuevaEdicion" :disabled="creandoEdicion"
        class="px-5 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors disabled:opacity-60 flex items-center gap-2">
        <svg v-if="creandoEdicion" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        Crear edición y continuar →
      </button>

      <!-- Paso 3: Guardar ejemplar -->
      <button v-if="paso === 3" @click="guardarEjemplar"
        :disabled="guardando || (isBibliotecario && !isAdmin && !bibliotecaPropia)"
        class="px-5 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2">
        <svg v-if="guardando" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        {{ props.ejemplar ? 'Guardar cambios' : 'Crear ejemplar' }}
      </button>
    </template>
  </BaseModal>
</template>