<script setup lang="ts">
/**
 * EjemplarModal — Modal Terciario
 * ────────────────────────────────────────────────────────────────────────
 * Formulario pequeño y rápido para crear o editar un ejemplar físico.
 * Genera automáticamente código topográfico y código de ejemplar.
 * ────────────────────────────────────────────────────────────────────────
 */
import { ref, reactive, computed, onMounted } from 'vue'
import BaseModal from '../catalogo/BaseModal.vue'
import api from '@/services/axios'
import { crearEjemplar, actualizarEjemplar } from '@/services/ejemplares.service'
import { bibliotecasService } from '@/services/bibliotecas.service'
import { useAuthStore } from '@/stores/auth.store'
import { usePermissions } from '@/composables/usePermissions'
import type { Ejemplar } from '@/types/catalogo'

// ── Props / emits ─────────────────────────────────────────────────
const props = defineProps<{
  edicionId: number
  libroId: number
  ejemplar?: Ejemplar | null
}>()
const emit = defineEmits<{ close: []; saved: [] }>()

const auth = useAuthStore()
const { isAdmin } = usePermissions()
const modoEdicion = computed(() => !!props.ejemplar)

// ══════════════════════════════════════════════════════════════════
// DATOS DE CONTEXTO (libro/edición para generar códigos)
// ══════════════════════════════════════════════════════════════════
const contexto = ref<{ titulo: string; autor: string; categoriaDewey: string; categoriaPrefix: string } | null>(null)

onMounted(async () => {
  await Promise.all([cargarContexto(), cargarBibliotecas()])
  if (props.ejemplar) prerellenar()
  else generarCodigos()
})

async function cargarContexto() {
  try {
    const res = await api.get(`/libros/${props.libroId}`)
    const libro = res.data?.data ?? res.data
    const autor = libro.autores?.[0]?.nombre ?? libro.autorTexto ?? ''
    const apellido = autor.trim().split(' ')[0]?.toUpperCase() ?? 'S_A'
    const catNombre = libro.categoria?.nombreCategoria ?? libro.categoria?.nombre_categoria ?? ''
    const catDewey = libro.categoria?.codigoDewey ?? libro.categoria?.codigo_dewey ?? '000'
    contexto.value = {
      titulo: libro.titulo ?? '',
      autor: autor,
      categoriaDewey: catDewey,
      categoriaPrefix: catNombre.slice(0, 3).toUpperCase() || 'GEN',
    }
  } catch {
    contexto.value = { titulo: '', autor: '', categoriaDewey: '000', categoriaPrefix: 'GEN' }
  }
}

// ══════════════════════════════════════════════════════════════════
// BIBLIOTECAS
// ══════════════════════════════════════════════════════════════════
const bibliotecas = ref<{ id: number; nombre: string }[]>([])
const cargandoBibs = ref(false)

const bibliotecaPropia = computed(() => {
  const lista = auth.user?.biblioteca
  if (!lista?.length) return null
  const bib = lista[0]
  const id = bib.id_biblioteca ?? bib.idBiblioteca ?? bib.id
  const nombre = bib.nombre ?? bib.name
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
    const raw = (res.data as any)?.data ?? res.data
    const lista = Array.isArray(raw) ? raw : []
    bibliotecas.value = lista
      .filter((b: any) => b.estado === 'ACTIVA' || !b.estado)
      .map((b: any) => ({
        id: b.id_biblioteca ?? b.idBiblioteca ?? b.id,
        nombre: b.nombre ?? b.name,
      }))
  } catch { }
  finally { cargandoBibs.value = false }
}

// ══════════════════════════════════════════════════════════════════
// FORMULARIO
// ══════════════════════════════════════════════════════════════════
const form = reactive({
  codigoTopografico: '',
  codigoEjemplar: '',
  ubicacionFisica: '',
  estadoEjemplar: 'DISPONIBLE',
  bibliotecaId: null as number | null,
  fechaAdquisicion: new Date().toISOString().split('T')[0],
  precioCompra: null as number | null,
  observaciones: '',
})
const errores = reactive<Record<string, string>>({})
const guardando = ref(false)
const errorGuardar = ref('')

function prerellenar() {
  const ej = props.ejemplar!
  form.codigoTopografico = ej.codigoTopografico ?? ''
  form.codigoEjemplar = ej.codigoEjemplar ?? ''
  form.ubicacionFisica = ej.ubicacionFisica ?? ''
  form.estadoEjemplar = ej.estadoEjemplar ?? 'DISPONIBLE'
  form.bibliotecaId = ej.biblioteca?.idBiblioteca ?? null
  form.fechaAdquisicion = ej.fechaAdquisicion ?? new Date().toISOString().split('T')[0]
  form.precioCompra = ej.precioCompra ?? null
  form.observaciones = ej.observaciones ?? ''
}

// ══════════════════════════════════════════════════════════════════
// GENERACIÓN DE CÓDIGOS
// ══════════════════════════════════════════════════════════════════
let _contadorEjemplar = 1

function generarCodigos() {
  if (!contexto.value) return
  const { titulo, autor, categoriaDewey, categoriaPrefix } = contexto.value

  // Código topográfico: AAA-TTT
  const apellido = autor.trim().split(' ')[0]?.toUpperCase().slice(0, 3) || 'S_A'
  const tituloChunk = titulo.replace(/\s+/g, '').toUpperCase().slice(0, 3) || 'LIB'
  form.codigoTopografico = `${apellido}-${tituloChunk}`

  // Código ejemplar: PREF-DEWEY-EjN-M
  form.codigoEjemplar = categoriaDewey !== '000'
    ? `${categoriaPrefix}-${categoriaDewey}-Ej${_contadorEjemplar}-1`
    : `EJ-${_contadorEjemplar}-1`
}

function regenerarCodigos() {
  _contadorEjemplar++
  generarCodigos()
}

// Recalcular si cambia contexto (se cargó async)
function onContextoListo() { if (!modoEdicion.value) generarCodigos() }
// watch con immediate=false porque cargarContexto ya llama generarCodigos al final
import { watch } from 'vue'
watch(contexto, onContextoListo)

// ══════════════════════════════════════════════════════════════════
// GUARDAR
// ══════════════════════════════════════════════════════════════════
async function guardar() {
  Object.keys(errores).forEach(k => delete errores[k])
  if (!form.codigoEjemplar.trim()) errores.codigoEjemplar = 'El código es obligatorio'
  if (!form.ubicacionFisica.trim()) errores.ubicacionFisica = 'La ubicación es obligatoria'
  if (!form.bibliotecaId) errores.bibliotecaId = 'Selecciona una biblioteca'
  if (Object.keys(errores).length) return

  guardando.value = true
  errorGuardar.value = ''
  try {
    if (modoEdicion.value && props.ejemplar) {
      await actualizarEjemplar(props.ejemplar.idEjemplar, {
        codigoEjemplar: form.codigoEjemplar,
        codigoTopografico: form.codigoTopografico || undefined,
        ubicacionFisica: form.ubicacionFisica,
        edicionId: props.edicionId,
        bibliotecaId: form.bibliotecaId!,
        precioCompra: form.precioCompra,
        observaciones: form.observaciones || undefined,
      })
    } else {
      await crearEjemplar({
        codigoEjemplar: form.codigoEjemplar,
        codigoTopografico: form.codigoTopografico || undefined,
        ubicacionFisica: form.ubicacionFisica,
        edicionId: props.edicionId,
        bibliotecaId: form.bibliotecaId!,
        estadoEjemplar: form.estadoEjemplar as any,
        fechaAdquisicion: form.fechaAdquisicion || undefined,
        precioCompra: form.precioCompra,
        observaciones: form.observaciones || undefined,
      })
    }
    emit('saved')
  } catch (e: unknown) {
    const err = e as any
    errorGuardar.value = err?.response?.data?.message ?? 'Error al guardar el ejemplar'
  } finally {
    guardando.value = false
  }
}

const opcionesEstado = [
  { value: 'DISPONIBLE', label: 'Disponible', dot: 'bg-emerald-500' },
  { value: 'EN_REPARACION', label: 'En reparación', dot: 'bg-purple-500' },
  { value: 'DAÑADO', label: 'Dañado', dot: 'bg-amber-500' },
]
</script>

<template>
  <BaseModal size="2xl" @close="emit('close')">

    <!-- ── Header ─────────────────────────────────────────────────── -->
    <template #header>
      <div class="flex items-center gap-3">
        <div class="w-9 h-9 rounded-xl bg-indigo-100 flex items-center justify-center flex-shrink-0">
          <svg class="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
          </svg>
        </div>
        <div>
          <h2 class="text-base font-semibold text-slate-900">
            {{ modoEdicion ? 'Editar Ejemplar' : 'Nuevo / Editar Ejemplar' }}
          </h2>
          <p class="text-xs text-slate-500">Completa la información del ejemplar.</p>
        </div>
      </div>
    </template>

    <div class="space-y-4">

      <!-- Código topográfico + Código ejemplar -->
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="block text-xs font-medium text-slate-600 mb-1.5">
            Código topográfico <span class="text-red-400">*</span>
          </label>
          <div class="flex gap-1.5">
            <input v-model="form.codigoTopografico" type="text" placeholder="LIB-863.4-GAR-CIE-001"
              class="flex-1 text-sm font-mono rounded-xl border border-slate-200 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow" />
            <button @click="regenerarCodigos" title="Regenerar código"
              class="px-2.5 py-2 text-slate-400 hover:text-indigo-600 border border-slate-200 hover:border-indigo-300 rounded-xl transition-colors">
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
        </div>

        <div>
          <label class="block text-xs font-medium text-slate-600 mb-1.5">
            Código ejemplar <span class="text-red-400">*</span>
          </label>
          <div class="flex gap-1.5">
            <input v-model="form.codigoEjemplar" type="text" placeholder="EJ-0003"
              class="flex-1 text-sm font-mono rounded-xl border px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow"
              :class="errores.codigoEjemplar ? 'border-red-400 bg-red-50' : 'border-slate-200'" />
            <button @click="regenerarCodigos" title="Regenerar código"
              class="px-2.5 py-2 text-slate-400 hover:text-indigo-600 border border-slate-200 hover:border-indigo-300 rounded-xl transition-colors">
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
          <p v-if="errores.codigoEjemplar" class="text-xs text-red-500 mt-1">{{ errores.codigoEjemplar }}</p>
        </div>
      </div>

      <!-- Ubicación física + Estado -->
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="block text-xs font-medium text-slate-600 mb-1.5">
            Ubicación física <span class="text-red-400">*</span>
          </label>
          <div class="relative">
            <input v-model="form.ubicacionFisica" type="text" placeholder="Estantería A - Nivel 2"
              class="w-full text-sm rounded-xl border px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow"
              :class="errores.ubicacionFisica ? 'border-red-400 bg-red-50' : 'border-slate-200'" />
          </div>
          <p v-if="errores.ubicacionFisica" class="text-xs text-red-500 mt-1">{{ errores.ubicacionFisica }}</p>
        </div>

        <div>
          <label class="block text-xs font-medium text-slate-600 mb-1.5">
            Estado <span class="text-red-400">*</span>
          </label>
          <!-- Custom select con dot -->
          <div class="relative">
            <select v-model="form.estadoEjemplar"
              class="w-full text-sm rounded-xl border border-slate-200 px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow appearance-none">
              <option v-for="op in opcionesEstado" :key="op.value" :value="op.value">
                {{ op.label }}
              </option>
            </select>
            <!-- Dot estado seleccionado -->
            <div class="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
              <!-- hidden, el estado se ve en el texto -->
            </div>
          </div>
          <!-- Preview del estado -->
          <div class="mt-1.5 flex items-center gap-1.5">
            <span
              :class="['w-2 h-2 rounded-full', opcionesEstado.find(o => o.value === form.estadoEjemplar)?.dot ?? 'bg-slate-400']" />
            <span class="text-xs text-slate-500">
              {{opcionesEstado.find(o => o.value === form.estadoEjemplar)?.label}}
            </span>
          </div>
        </div>
      </div>

      <!-- Biblioteca -->
      <div>
        <label class="block text-xs font-medium text-slate-600 mb-1.5">Biblioteca</label>
        <div v-if="!isAdmin && bibliotecaPropia"
          class="flex items-center gap-2.5 px-3 py-2.5 bg-indigo-50 border border-indigo-200 rounded-xl">
          <svg class="w-4 h-4 text-indigo-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4" />
          </svg>
          <span class="text-sm font-medium text-indigo-700">{{ bibliotecaPropia.nombre }}</span>
        </div>
        <select v-else v-model="form.bibliotecaId"
          class="w-full text-sm rounded-xl border px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow appearance-none"
          :class="errores.bibliotecaId ? 'border-red-400' : 'border-slate-200'">
          <option :value="null" disabled>Selecciona una biblioteca</option>
          <option v-for="bib in bibliotecas" :key="bib.id" :value="bib.id">{{ bib.nombre }}</option>
        </select>
        <p v-if="errores.bibliotecaId" class="text-xs text-red-500 mt-1">{{ errores.bibliotecaId }}</p>
      </div>

      <!-- Fecha + Precio -->
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="block text-xs font-medium text-slate-600 mb-1.5">Fecha adquisición</label>
          <input v-model="form.fechaAdquisicion" type="date"
            class="w-full text-sm rounded-xl border border-slate-200 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow" />
        </div>
        <div>
          <label class="block text-xs font-medium text-slate-600 mb-1.5">Precio (Bs.)</label>
          <input v-model.number="form.precioCompra" type="number" step="0.01" placeholder="85.00"
            class="w-full text-sm rounded-xl border border-slate-200 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow" />
        </div>
      </div>

      <!-- Observaciones -->
      <div>
        <label class="block text-xs font-medium text-slate-600 mb-1.5">Observaciones</label>
        <input v-model="form.observaciones" type="text" placeholder="Donación FHCE 2024, estado nuevo..."
          class="w-full text-sm rounded-xl border border-slate-200 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow" />
      </div>

      <!-- Info generación automática -->
      <div class="flex items-start gap-2.5 px-3.5 py-3 bg-blue-50 border border-blue-200 rounded-xl">
        <svg class="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p class="text-xs text-blue-700">
          Los códigos se generan automáticamente siguiendo el formato configurado por la biblioteca.
          Puedes editarlos manualmente o regenerarlos con el botón <span class="font-semibold">↻ Generar</span>.
        </p>
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
            d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8" />
        </svg>
        {{ guardando ? 'Guardando...' : 'Guardar ejemplar' }}
      </button>
    </template>

  </BaseModal>
</template>