<script setup lang="ts">
/**
 * LibroModal — Modal Principal
 * ────────────────────────────────────────────────────────────────────────
 * Flujo inteligente:
 *   · Busca libro existente → si existe, muestra resumen + ediciones
 *   · Si no existe, habilita formulario completo de creación
 *   · Abre EdicionModal para crear/editar una edición (modal secundario)
 * ────────────────────────────────────────────────────────────────────────
 */
import { ref, reactive, computed, watch } from 'vue'
import BaseModal from '../catalogo/BaseModal.vue'
import EdicionModal from './EdicionModal.vue'
import api from '@/services/axios'
import { obtenerCategorias } from '@/services/categorias.service'
import { useUiStore } from '@/stores/ui.store'
import type { Categoria } from '@/types/catalogo'

const emit = defineEmits<{ close: []; saved: [] }>()
const ui = useUiStore()

// ══════════════════════════════════════════════════════════════════
// SECCIÓN 1 — BÚSQUEDA
// ══════════════════════════════════════════════════════════════════
const query = ref('')
const buscando = ref(false)
const libroBuscado = ref<any>(null)     // libro encontrado
const busquedaRealizada = ref(false)
let timerBusqueda: ReturnType<typeof setTimeout>

watch(query, (q) => {
  clearTimeout(timerBusqueda)
  if (!q.trim()) {
    libroBuscado.value = null
    busquedaRealizada.value = false
    libroExistente.value = null
    return
  }
  timerBusqueda = setTimeout(() => buscarLibro(q), 400)
})

async function buscarLibro(q: string) {
  buscando.value = true
  busquedaRealizada.value = false
  try {
    const res = await api.get('/libros/search', { params: { q } })
    const data = res.data?.data ?? res.data
    const lista = Array.isArray(data) ? data : (data?.content ?? [])
    libroBuscado.value = lista.length ? lista[0] : null

    if (libroBuscado.value) {
      // Cargar detalle con ediciones
      await cargarDetalleLibro(libroBuscado.value.idLibro)
    }
  } catch {
    libroBuscado.value = null
  } finally {
    buscando.value = false
    busquedaRealizada.value = true
  }
}

function limpiarBusqueda() {
  query.value = ''
  libroBuscado.value = null
  libroExistente.value = null
  busquedaRealizada.value = false
}

// ── Libro existente (detalle completo) ───────────────────────────
const libroExistente = ref<any>(null)

async function cargarDetalleLibro(id: number) {
  try {
    const res = await api.get(`/libros/${id}`)
    libroExistente.value = res.data?.data ?? res.data
  } catch {
    libroExistente.value = libroBuscado.value
  }
}

const libroYaExiste = computed(() => busquedaRealizada.value && !!libroBuscado.value)
const noEncontrado = computed(() => busquedaRealizada.value && !libroBuscado.value && query.value.trim())

// ══════════════════════════════════════════════════════════════════
// SECCIÓN 2 — FORMULARIO LIBRO NUEVO
// ══════════════════════════════════════════════════════════════════
const categorias = ref<Categoria[]>([])
const cargandoCats = ref(false)

async function cargarCategorias() {
  if (categorias.value.length) return
  cargandoCats.value = true
  try { categorias.value = await obtenerCategorias() }
  finally { cargandoCats.value = false }
}

// Iniciar formulario cuando no hay libro
watch(noEncontrado, (v) => { if (v) cargarCategorias() })

const form = reactive({
  titulo: '',
  autores: '',          // string separado por coma → el backend lo parte
  categoriaId: null as number | null,
  idioma: 'es',
  descripcion: '',
})
const errores = reactive<Record<string, string>>({})
const guardandoLibro = ref(false)
const libroCreado = ref<any>(null)   // libro recién creado (para agregar edición)

async function guardarLibro() {
  Object.keys(errores).forEach(k => delete errores[k])
  if (!form.titulo.trim()) errores.titulo = 'El título es obligatorio'
  if (!form.autores.trim()) errores.autores = 'Al menos un autor es obligatorio'
  if (Object.keys(errores).length) return

  guardandoLibro.value = true
  try {
    const autoresArr = form.autores.split(',').map(a => a.trim()).filter(Boolean)
    const res = await api.post('/libros', {
      titulo: form.titulo.trim(),
      idioma: form.idioma,
      categoriaId: form.categoriaId || undefined,
      descripcion: form.descripcion.trim() || undefined,
      autores: autoresArr.map(nombre => ({ nombre })),
    })
    libroCreado.value = res.data?.data ?? res.data
    // Abrir modal de edición inmediatamente
    abrirNuevaEdicion(libroCreado.value)
    emit('saved')
  } catch (e: unknown) {
    const err = e as any
    errores.general = err?.response?.data?.message ?? 'Error al guardar el libro'
  } finally {
    guardandoLibro.value = false
  }
}

// ══════════════════════════════════════════════════════════════════
// MODAL SECUNDARIO — EDICIÓN
// ══════════════════════════════════════════════════════════════════
const mostrarEdicionModal = ref(false)
const edicionModalProps = ref<{ libroId: number; edicion?: any } | null>(null)

function abrirNuevaEdicion(libro: any) {
  edicionModalProps.value = { libroId: libro.idLibro ?? libro.id }
  mostrarEdicionModal.value = true
}

function abrirEditarEdicion(libro: any, edicion: any) {
  edicionModalProps.value = { libroId: libro.idLibro ?? libro.id, edicion }
  mostrarEdicionModal.value = true
}

function onEdicionGuardada() {
  mostrarEdicionModal.value = false
  // Recargar el libro existente si aplica
  if (libroExistente.value) cargarDetalleLibro(libroExistente.value.idLibro)
  emit('saved')
}

// ── Helpers ──────────────────────────────────────────────────────
function formatAutores(libro: any): string {
  if (libro?.autores?.length) return libro.autores.map((a: any) => a.nombre).join(', ')
  if (libro?.autorTexto) return libro.autorTexto
  return '—'
}

function formatCategoria(libro: any): string {
  return libro?.categoria?.nombreCategoria ?? libro?.categoria?.nombre_categoria ?? ''
}
</script>

<template>
  <BaseModal size="full" @close="emit('close')">

    <!-- ── Slot header personalizado ──────────────────────────────── -->
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
          <h2 class="text-base font-semibold text-slate-900">Nuevo / Editar Libro</h2>
          <p class="text-xs text-slate-500">Busca un libro existente o crea uno nuevo.</p>
        </div>
      </div>
    </template>

    <div class="space-y-6">

      <!-- ══════════════════════════════════════════════════════════
           SECCIÓN 1 — BUSCAR LIBRO EXISTENTE
      ══════════════════════════════════════════════════════════════ -->
      <div>
        <div class="flex items-center gap-2 mb-3">
          <div class="w-6 h-6 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
            <svg class="w-3.5 h-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <div>
            <h3 class="text-sm font-semibold text-slate-800">1. Buscar libro existente</h3>
            <p class="text-xs text-slate-500">Busca por título, ISBN o autor para ver si el libro ya existe en el
              catálogo.
            </p>
          </div>
        </div>

        <!-- Input búsqueda -->
        <div class="flex gap-2">
          <div class="relative flex-1">
            <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" fill="none"
              viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input v-model="query" type="text" placeholder="Buscar por título, ISBN o autor..."
              class="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white transition-shadow" />
            <!-- Spinner -->
            <svg v-if="buscando" class="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-slate-400"
              fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
          <button v-if="query" @click="limpiarBusqueda"
            class="px-4 py-2.5 text-sm font-medium text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors whitespace-nowrap">
            Limpiar búsqueda
          </button>
        </div>

        <!-- ── RESULTADO: Libro encontrado ─────────────────────── -->
        <template v-if="libroYaExiste && libroExistente">
          <div class="mt-3 flex items-center gap-2 text-sm text-emerald-700 font-medium">
            <div class="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
              <svg class="w-3 h-3 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            Libro encontrado — Este libro ya existe en el catálogo.
          </div>

          <!-- Card libro encontrado -->
          <div class="mt-2 flex items-center gap-4 p-4 border border-slate-200 rounded-xl bg-white">
            <!-- Portada -->
            <div class="flex-shrink-0 w-14 h-19 rounded-lg overflow-hidden bg-slate-100 border border-slate-200">
              <img v-if="libroExistente.ediciones?.[0]?.imagenPortada" :src="libroExistente.ediciones[0].imagenPortada"
                alt="Portada" class="w-full h-full object-cover" />
              <div v-else class="w-full h-full flex items-center justify-center">
                <svg class="w-5 h-5 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                    d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5" />
                </svg>
              </div>
            </div>

            <div class="flex-1 min-w-0">
              <p class="text-sm font-semibold text-slate-900 truncate">{{ libroExistente.titulo }}</p>
              <p class="text-xs text-slate-500 mt-0.5">{{ formatAutores(libroExistente) }}</p>
              <div class="flex items-center gap-2 mt-1.5 flex-wrap">
                <span v-if="formatCategoria(libroExistente)"
                  class="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                  {{ formatCategoria(libroExistente) }}
                </span>
                <span v-if="libroExistente.idioma"
                  class="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 capitalize">
                  {{ libroExistente.idioma === 'es' ? 'Español' : libroExistente.idioma }}
                </span>
              </div>
            </div>

            <button @click="abrirNuevaEdicion(libroExistente)"
              class="flex-shrink-0 px-4 py-2 text-sm font-medium text-indigo-600 border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-colors whitespace-nowrap">
              Ver detalle del libro
            </button>
          </div>

          <!-- Info banner -->
          <div class="mt-3 flex items-center gap-2.5 px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl">
            <svg class="w-4 h-4 text-blue-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p class="text-xs text-blue-700">
              Este libro ya existe. Puedes gestionar sus ediciones y ejemplares desde la sección inferior.
            </p>
          </div>
        </template>

        <!-- ── Sin resultados ────────────────────────────────────── -->
        <div v-else-if="noEncontrado" class="mt-3 flex items-center gap-2 text-sm text-amber-700 font-medium">
          <div class="w-5 h-5 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
            <svg class="w-3 h-3 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 9v4m0 4h.01" />
            </svg>
          </div>
          No se encontró el libro. Completa el formulario para crearlo.
        </div>
      </div>

      <!-- Separador "o" -->
      <div v-if="!libroYaExiste" class="flex items-center gap-3">
        <div class="flex-1 h-px bg-slate-200" />
        <span class="text-xs text-slate-400 font-medium">o</span>
        <div class="flex-1 h-px bg-slate-200" />
      </div>

      <!-- ══════════════════════════════════════════════════════════
           SECCIÓN 2 — INFORMACIÓN DEL LIBRO (crear nuevo)
      ══════════════════════════════════════════════════════════════ -->
      <template v-if="!libroYaExiste">
        <div>
          <div class="flex items-center gap-2 mb-4">
            <div class="w-6 h-6 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
              <svg class="w-3.5 h-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5" />
              </svg>
            </div>
            <div>
              <h3 class="text-sm font-semibold text-slate-800">2. Información del libro</h3>
              <p class="text-xs text-slate-500">Completa los datos del libro. Los campos con * son obligatorios.</p>
            </div>
          </div>

          <!-- Grid de campos -->
          <div class="grid grid-cols-4 gap-3">
            <!-- Título -->
            <div class="col-span-4 sm:col-span-1">
              <label class="block text-xs font-medium text-slate-600 mb-1.5">
                Título <span class="text-red-400">*</span>
              </label>
              <input v-model="form.titulo" type="text" placeholder="Ingresa el título del libro"
                class="w-full text-sm rounded-xl border px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow"
                :class="errores.titulo ? 'border-red-400 bg-red-50' : 'border-slate-200'" />
              <p v-if="errores.titulo" class="text-xs text-red-500 mt-1">{{ errores.titulo }}</p>
            </div>

            <!-- Autores -->
            <div class="col-span-4 sm:col-span-1">
              <label class="block text-xs font-medium text-slate-600 mb-1.5">
                Autores <span class="text-red-400">*</span>
              </label>
              <input v-model="form.autores" type="text" placeholder="Ingresa uno o más autores (separados por coma)"
                class="w-full text-sm rounded-xl border px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow"
                :class="errores.autores ? 'border-red-400 bg-red-50' : 'border-slate-200'" />
              <p v-if="errores.autores" class="text-xs text-red-500 mt-1">{{ errores.autores }}</p>
            </div>

            <!-- Categoría -->
            <div class="col-span-4 sm:col-span-1">
              <label class="block text-xs font-medium text-slate-600 mb-1.5">Categoría (opcional)</label>
              <select v-model="form.categoriaId"
                class="w-full text-sm rounded-xl border border-slate-200 px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow appearance-none">
                <option :value="null">Selecciona una categoría</option>
                <option v-for="cat in categorias" :key="cat.id_categoria ?? cat.idCategoria"
                  :value="cat.id_categoria ?? cat.idCategoria">
                  {{ cat.nombre_categoria ?? cat.nombreCategoria }}
                </option>
              </select>
            </div>

            <!-- Idioma -->
            <div class="col-span-4 sm:col-span-1">
              <label class="block text-xs font-medium text-slate-600 mb-1.5">
                Idioma <span class="text-red-400">*</span>
              </label>
              <select v-model="form.idioma"
                class="w-full text-sm rounded-xl border border-slate-200 px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow appearance-none">
                <option value="es">Selecciona el idioma</option>
                <option value="es">Español</option>
                <option value="en">Inglés</option>
                <option value="pt">Portugués</option>
                <option value="fr">Francés</option>
                <option value="de">Alemán</option>
              </select>
            </div>

            <!-- Descripción -->
            <div class="col-span-4">
              <label class="block text-xs font-medium text-slate-600 mb-1.5">Descripción</label>
              <div class="relative">
                <textarea v-model="form.descripcion" rows="3" maxlength="1000"
                  placeholder="Describe el contenido del libro, sinopsis, notas importantes, etc."
                  class="w-full text-sm rounded-xl border border-slate-200 px-3 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow" />
                <span class="absolute bottom-2 right-3 text-xs text-slate-400">
                  {{ form.descripcion.length }}/1000
                </span>
              </div>
            </div>
          </div>

          <p v-if="errores.general"
            class="mt-3 text-sm text-red-600 bg-red-50 border border-red-200 px-4 py-2.5 rounded-xl">
            {{ errores.general }}
          </p>
        </div>
      </template>

      <!-- ══════════════════════════════════════════════════════════
           SECCIÓN 3 — EDICIONES REGISTRADAS (libro existente)
      ══════════════════════════════════════════════════════════════ -->
      <template v-if="libroYaExiste && libroExistente">
        <div>
          <div class="flex items-center justify-between mb-4">
            <div class="flex items-center gap-2">
              <div class="w-6 h-6 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                <svg class="w-3.5 h-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5" />
                </svg>
              </div>
              <div>
                <h3 class="text-sm font-semibold text-slate-800">3. Ediciones registradas</h3>
                <p class="text-xs text-slate-500">Gestiona las ediciones existentes o crea una nueva.</p>
              </div>
            </div>
            <button @click="abrirNuevaEdicion(libroExistente)"
              class="flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-indigo-600 border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-colors">
              <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4" />
              </svg>
              Nueva edición
            </button>
          </div>

          <!-- Tabla ediciones -->
          <div class="border border-slate-200 rounded-xl overflow-hidden">
            <!-- Header tabla -->
            <div class="grid grid-cols-12 gap-3 px-4 py-2.5 bg-slate-50 border-b border-slate-200">
              <span class="col-span-3 text-xs font-medium text-slate-500 uppercase tracking-wide">ISBN</span>
              <span class="col-span-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Editorial</span>
              <span class="col-span-2 text-xs font-medium text-slate-500 uppercase tracking-wide">Año</span>
              <span class="col-span-2 text-xs font-medium text-slate-500 uppercase tracking-wide">Ejemplares</span>
              <span
                class="col-span-2 text-xs font-medium text-slate-500 uppercase tracking-wide text-right">Acciones</span>
            </div>

            <!-- Sin ediciones -->
            <div v-if="!libroExistente.ediciones?.length" class="px-4 py-8 text-center text-sm text-slate-400">
              Sin ediciones registradas para este libro.
            </div>

            <!-- Filas ediciones -->
            <div v-for="(ed, i) in libroExistente.ediciones" :key="ed.idEdicion"
              class="grid grid-cols-12 gap-3 px-4 py-3.5 items-center hover:bg-slate-50 transition-colors"
              :class="i < libroExistente.ediciones.length - 1 ? 'border-b border-slate-100' : ''">

              <span class="col-span-3 text-sm font-mono text-slate-700 truncate">{{ ed.isbn }}</span>
              <span class="col-span-3 text-sm text-slate-600 truncate">{{ ed.editorial }}</span>
              <span class="col-span-2 text-sm text-slate-600">{{ ed.anoPublicacion }}</span>
              <span class="col-span-2 text-sm text-slate-500">
                {{ ed.ejemplaresTotal ?? 0 }} ejemplar{{ (ed.ejemplaresTotal ?? 0) !== 1 ? 'es' : '' }}
              </span>

              <!-- Acciones -->
              <div class="col-span-2 flex items-center justify-end gap-2">
                <button @click="abrirEditarEdicion(libroExistente, ed)"
                  class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-colors">
                  <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  Ver ejemplares
                </button>

                <!-- Menú 3 puntos -->
                <button @click="abrirEditarEdicion(libroExistente, ed)"
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
      </template>

      <!-- ══════════════════════════════════════════════════════════
           ESCENARIOS INFO (solo cuando no se ha buscado nada)
      ══════════════════════════════════════════════════════════════ -->
      <div v-if="!busquedaRealizada && !query" class="grid grid-cols-2 gap-4">
        <div class="p-4 border border-slate-200 rounded-xl bg-slate-50">
          <div class="flex items-center gap-2 mb-2">
            <svg class="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5" />
            </svg>
            <p class="text-xs font-semibold text-slate-700">Escenario A: Libro no existe</p>
          </div>
          <ul class="space-y-1">
            <li v-for="txt in [
              'Se mostrarán todos los campos para crear el libro.',
              'Luego podrás agregar la primera edición y su primer ejemplar.',
              'Todo en el mismo flujo.'
            ]" :key="txt" class="flex items-start gap-1.5 text-xs text-slate-500">
              <svg class="w-3.5 h-3.5 text-emerald-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24"
                stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
              </svg>
              {{ txt }}
            </li>
          </ul>
        </div>
        <div class="p-4 border border-slate-200 rounded-xl bg-slate-50">
          <div class="flex items-center gap-2 mb-2">
            <svg class="w-4 h-4 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5" />
            </svg>
            <p class="text-xs font-semibold text-slate-700">Escenario B: Libro ya existe</p>
          </div>
          <ul class="space-y-1">
            <li v-for="txt in [
              'Se ocultarán los campos del libro para evitar duplicidad.',
              'Puedes gestionar ediciones y ejemplares desde la sección inferior.',
              'Usa los modales secundarios para cada acción.'
            ]" :key="txt" class="flex items-start gap-1.5 text-xs text-slate-500">
              <svg class="w-3.5 h-3.5 text-indigo-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24"
                stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
              </svg>
              {{ txt }}
            </li>
          </ul>
        </div>
      </div>

    </div><!-- /space-y-6 -->

    <!-- ── Footer ─────────────────────────────────────────────────── -->
    <template #footer>
      <!-- Breadcrumb flujo -->
      <div class="flex items-center gap-1.5 text-xs text-slate-400 mr-auto">
        <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5" />
        </svg>
        Libro
        <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
        </svg>
        <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
        </svg>
        Ediciones
        <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
        </svg>
        <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8" />
        </svg>
        Ejemplares
      </div>

      <button @click="emit('close')"
        class="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">
        Cancelar
      </button>

      <!-- Botón principal según escenario -->
      <button v-if="!libroYaExiste" @click="guardarLibro" :disabled="guardandoLibro"
        class="px-5 py-2 text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-colors disabled:opacity-60 flex items-center gap-2">
        <svg v-if="guardandoLibro" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <svg v-else class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        {{ guardandoLibro ? 'Guardando...' : 'Guardar libro' }}
      </button>
    </template>

  </BaseModal>

  <!-- ══════════════════════════════════════════════════════════════
       MODAL SECUNDARIO — EDICIÓN (se abre encima)
  ══════════════════════════════════════════════════════════════════ -->
  <EdicionModal v-if="mostrarEdicionModal && edicionModalProps" :libro-id="edicionModalProps.libroId"
    :edicion="edicionModalProps.edicion" @close="mostrarEdicionModal = false" @saved="onEdicionGuardada" />
</template>