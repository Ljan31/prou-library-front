<script setup lang="ts">
import { ref, reactive, watch, computed, onMounted } from 'vue'
import BaseModal from './BaseModal.vue'
import { crearEjemplar, actualizarEjemplar } from '@/services/ejemplares.service'
import { bibliotecasService } from '@/services/bibliotecas.service'
import { useAuthStore } from '@/stores/auth.store'
import { usePermissions } from '@/composables/usePermissions'
import type { Ejemplar, Edicion, Libro } from '@/types/catalogo'

const props = defineProps<{
  ejemplar: Ejemplar | null
  // Ediciones disponibles del libro para elegir a cuál asociar
  ediciones?: Edicion[]
  // Si se pasa una edicion pre-seleccionada (desde el detalle de una edición)
  edicionIdInicial?: number
  libro?: Libro
}>()

const emit = defineEmits<{ close: []; saved: [] }>()

const auth = useAuthStore()
const { isAdmin, isBibliotecario } = usePermissions()
// ─── Bibliotecas disponibles ──────────────────────────────────────────────
interface BibliotecaOpcion {
  id: number
  nombre: string
}

const bibliotecas = ref<BibliotecaOpcion[]>([])
const cargandoBibs = ref(false)

// La biblioteca del bibliotecario logueado (viene del auth store)
// El campo en auth.user.biblioteca depende de cómo lo devuelve el backend.
// Soportamos tanto { id_biblioteca, nombre } como { idBiblioteca, nombre }
const bibliotecaPropia = computed<BibliotecaOpcion | null>(() => {

  // const bib = auth.user?.biblioteca as Record<string, unknown> | null | undefined
  // console.log(auth.user)
  // console.log({ bib })
  // if (!bib) return null
  // const id = (bib.id_biblioteca ?? bib.idBiblioteca ?? bib.id) as number | undefined
  // const nombre = (bib.nombre ?? bib.name) as string | undefined
  // if (!id || !nombre) return null
  // return { id, nombre }

  if (!auth.user?.biblioteca || auth.user.biblioteca.length === 0) return []

  return auth.user.biblioteca.map((bib: any) => ({
    id: (bib.id_biblioteca ?? bib.idBiblioteca ?? bib.id) as number,
    nombre: (bib.nombre ?? bib.name) as string,
  })).filter(b => b.id && b.nombre)

})

onMounted(async () => {
  // Admin: cargar todas las bibliotecas para poder elegir
  if (isAdmin.value) {
    cargandoBibs.value = true
    try {
      const res = await bibliotecasService.getAll()
      const raw = res.data as unknown
      const lista = Array.isArray(raw) ? raw : ((raw as Record<string, unknown>)?.data ?? []) as unknown[]
      bibliotecas.value = (lista as Record<string, unknown>[])
        .filter(b => b.estado === 'ACTIVA' || !b.estado)
        .map(b => ({
          id: (b.id_biblioteca ?? b.idBiblioteca ?? b.id) as number,
          nombre: (b.nombre ?? b.name) as string,
        }))
    } catch {
      bibliotecas.value = []
    } finally {
      cargandoBibs.value = false
    }
  } else if (bibliotecaPropia.value) {
    // Bibliotecario: solo ve su propia biblioteca
    bibliotecas.value = bibliotecaPropia.value
  }
})

// ══════════════════════════════════════════════════════════════════════════
// AUTO-SUGERENCIA DE CUTTERS (solo al crear)
// ══════════════════════════════════════════════════════════════════════════
 
/** Extrae las N primeras letras del apellido (primera palabra) del primer autor */
function sugerirCutterAutor(autores: { nombre: string }[]): string {
  if (!autores?.length) return ''
  const primerAutor = autores[0].nombre.trim()
  // Formato "APELLIDO NOMBRE" o "Apellido, Nombre"
  const apellido = primerAutor.replace(',', ' ').trim().split(/\s+/)[0]
  return apellido.slice(0, 3).toUpperCase()
}
 
/** Extrae las 3 primeras letras del título (sin artículo inicial) */
function sugerirCutterTitulo(titulo: string): string {
  if (!titulo) return ''
  const sinArticulo = titulo
    .trim()
    .replace(/^(el|la|los|las|un|una|unos|unas|the|a|an)\s+/i, '')
    .replace(/\s+/g, '')
  return sinArticulo.slice(0, 3).toLowerCase()
}
 
/** Extrae la clasificación decimal de la categoría */
function sugerirClasificacion(categoria: string): string {
  if (!categoria) return ''
  return (categoria.codigoDewey ?? categoria.codigo_dewey ?? '').toString()
}

// ─── Formulario 
const guardando = ref(false)
const errorGeneral = ref('')
const errores = reactive<Record<string, string>>({})
const cantidadEjemplares = ref(1)

const opcionesEstado = [
  { value: 'DISPONIBLE', label: '🟢 Disponible' },
  { value: 'EN_REPARACION', label: '🟡 En reparación' },
  { value: 'DAÑADO', label: '🟡 Dañado' },
]

const form = reactive({
  edicionId: props.edicionIdInicial ?? null as number | null,
  bibliotecaId: null as number | null,
  codigoEjemplar: '',
  codigoTopografico: '',
  clasificacionDecimal: '',
  cutterAutor:          '',
  cutterTitulo:         '',
  ubicacionFisica: '',
  estadoEjemplar: 'DISPONIBLE',
  fechaAdquisicion: new Date().toISOString().split('T')[0],
  precioCompra: null as number | null,
  observaciones: '',
})
// Pre-seleccionar biblioteca al montar / cambiar
watch(bibliotecaPropia, (bib) => {
  // if (bib && !form.bibliotecaId) {
  //   form.bibliotecaId = bib.id
  // }
  if (bib.length > 0 && !form.bibliotecaId) {
    form.bibliotecaId = bib[0].id   // selecciona la primera por defecto
  }
}, { immediate: true })

watch(() => props.ejemplar, (e) => {
  limpiarErrores(); errorGeneral.value = ''
  if (e) {
    form.edicionId = e.edicion?.idEdicion ?? props.edicionIdInicial ?? null
    form.bibliotecaId = e.biblioteca?.id_biblioteca ?? null
    form.codigoEjemplar = e.codigoEjemplar ?? ''
    form.codigoTopografico = e.codigoTopografico ?? e.codigoTopograficoConcat ?? ''
    form.clasificacionDecimal = (e as any).clasificacionDecimal ?? ''
    form.cutterAutor          = (e as any).cutterAutor          ?? ''
    form.cutterTitulo         = (e as any).cutterTitulo         ?? ''
    form.ubicacionFisica = e.ubicacionFisica ?? ''
    form.estadoEjemplar = e.estadoEjemplar ?? 'DISPONIBLE'
    form.fechaAdquisicion = e.fechaAdquisicion ?? new Date().toISOString().split('T')[0]
    form.precioCompra = e.precioCompra ?? null
    form.observaciones = e.observaciones ?? ''
  } else {
    form.edicionId = props.edicionIdInicial ?? null
    // form.bibliotecaId = null
    if (bibliotecaPropia.value?.length > 0) {
      form.bibliotecaId = bibliotecaPropia.value[0].id
    } else {
      form.bibliotecaId = null
    }

    form.codigoEjemplar = ''
    form.codigoTopografico = ''
    form.ubicacionFisica = ''
    form.estadoEjemplar = 'DISPONIBLE'
    form.fechaAdquisicion = new Date().toISOString().split('T')[0]
    form.precioCompra = null
    form.observaciones = ''
     // Auto-sugerir desde libroContexto si está disponible
    if (props.libro) {
      form.clasificacionDecimal = sugerirClasificacion(props.libro.categoria)
      form.cutterAutor          = sugerirCutterAutor(props.libro.autores ?? [])
      form.cutterTitulo         = sugerirCutterTitulo(props.libro.titulo ?? '')
    } else {
      form.clasificacionDecimal = ''
      form.cutterAutor          = ''
      form.cutterTitulo         = ''
    }
  }
}, { immediate: true })

// ── Preview del código para solicitar ────────────────────────────────────
const codigoPreview = computed(() => {
  const dec = form.clasificacionDecimal.trim() || '___'
  const aut = form.cutterAutor.trim()           || '___'
  const tit = form.cutterTitulo.trim()          || '___'
 
  if (!props.ejemplar && cantidadEjemplares.value > 1) {
    const filas = Array.from({ length: Math.min(cantidadEjemplares.value, 4) }, (_, i) =>
      `${dec}  ${aut}  ${tit} Ej.${i + 1}`
    )
    if (cantidadEjemplares.value > 4) filas.push(`  …y ${cantidadEjemplares.value - 4} más`)
    return filas.join('\n')
  }
  return `${dec}  ${aut}  ${tit}`
})
 
const mostrarPreview = computed(() =>
  !!(form.clasificacionDecimal || form.cutterAutor || form.cutterTitulo)
)


function limpiarErrores() { Object.keys(errores).forEach(k => delete errores[k]) }

function validar(): boolean {
  limpiarErrores()
  // if (!form.codigoEjemplar.trim()) errores.codigoEjemplar = 'El código es requerido'
  if (!form.ubicacionFisica.trim()) errores.ubicacionFisica = 'La ubicación es requerida'
  if (!form.edicionId) errores.edicionId = 'Debe seleccionar una edición'
  if (!form.bibliotecaId) errores.bibliotecaId = 'Debe seleccionar una biblioteca'
  return Object.keys(errores).length === 0
}

async function guardar() {
  if (!validar()) return
  guardando.value = true; errorGeneral.value = ''
  try {
    if (props.ejemplar) {
      
      await actualizarEjemplar(props.ejemplar.id_ejemplar, {
        codigoEjemplar: form.codigoEjemplar,
        codigoTopografico: form.codigoTopografico || undefined,
        clasificacionDecimal: form.clasificacionDecimal.trim() || undefined,
        cutterAutor:          form.cutterAutor.trim()          || undefined,
        cutterTitulo:         form.cutterTitulo.trim()         || undefined,
        ubicacionFisica: form.ubicacionFisica || undefined,
        edicionId: form.edicionId!,
        bibliotecaId: form.bibliotecaId!,
        precioCompra: form.precioCompra,
        observaciones: form.observaciones || undefined,
      })
    } else {
      await crearEjemplar({
        codigoEjemplar: form.codigoEjemplar,
        codigoTopografico: form.codigoTopografico || undefined,
        clasificacionDecimal: form.clasificacionDecimal.trim() || undefined,
        cutterAutor:          form.cutterAutor.trim()          || undefined,
        cutterTitulo:         form.cutterTitulo.trim()
          ? `${form.cutterTitulo.trim()}`
          : undefined,
        ubicacionFisica: form.ubicacionFisica || undefined,
        edicionId: form.edicionId!,
        bibliotecaId: form.bibliotecaId!,
        estadoEjemplar: form.estadoEjemplar as any,
        fechaAdquisicion: form.fechaAdquisicion || undefined,
        precioCompra: form.precioCompra,
        observaciones: form.observaciones || undefined,
      })
    }
    emit('saved')
  } catch (e: unknown) {
    let msg = 'No se pudo completar el registro'
    if (typeof e === 'object' && e !== null && 'response' in e) {
      const err = e as any
      msg = err.response?.data?.message || msg
      // console.log("BACKEND 👉", err.response?.data)
    } else if (e instanceof Error) {
      msg = e.message
    }
    errorGeneral.value = e instanceof Error ? msg : 'Error al guardar'
  } finally {
    guardando.value = false
  }
}
</script>

<template>
  <BaseModal :title="ejemplar ? 'Editar ejemplar' : 'Nuevo ejemplar'" size="md" @close="emit('close')">
    <div class="space-y-4">

      <!-- Selección de edición (si se pasan varias) -->
      <div v-if="ediciones && ediciones.length > 1">
        <label class="block text-xs font-medium text-slate-600 mb-1">Edición *</label>
        <select v-model="form.edicionId"
          class="w-full text-sm rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
          :class="errores.edicionId ? 'border-red-400' : 'border-slate-200'">
          <option :value="null" disabled>Seleccionar edición</option>
          <option v-for="ed in ediciones" :key="ed.idEdicion" :value="ed.idEdicion">
            {{ ed.isbn }} — {{ ed.editorial }} ({{ ed.anoPublicacion }})
          </option>
        </select>
        <p v-if="errores.edicionId" class="text-xs text-red-500 mt-1">{{ errores.edicionId }}</p>
      </div>

      <!-- ─── Biblioteca ─────────────────────────────────────────────── -->
      <div>
        <label class="block text-xs font-medium text-slate-600 mb-1">
          Biblioteca *
          <span v-if="isBibliotecario && !isAdmin" class="text-slate-400 font-normal">(tu biblioteca)</span>
          <!-- <span v-if="isBibliotecario && !isAdmin" class="text-slate-400 font-normal">
            (puedes elegir entre las que tienes asignadas)
          </span> -->
        </label>

        <!-- Admin: selector completo -->
        <div v-if="isAdmin">
          <div v-if="cargandoBibs" class="flex items-center gap-2 h-9 text-xs text-slate-400">
            <svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Cargando bibliotecas…
          </div>
          <select v-else v-model="form.bibliotecaId"
            class="w-full text-sm rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
            :class="errores.bibliotecaId ? 'border-red-400' : 'border-slate-200'">
            <option :value="null" disabled>Seleccionar biblioteca</option>
            <option v-for="bib in bibliotecas" :key="bib.id" :value="bib.id">
              {{ bib.nombre }}
            </option>
          </select>
        </div>

        <!-- Bibliotecario: fijo, solo lectura -->
        <div v-else class="flex items-center gap-2 px-3 py-2 bg-indigo-50 border border-indigo-200 rounded-lg">
          <svg class="w-4 h-4 text-indigo-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" />
          </svg>
          <span class="text-sm font-medium text-indigo-700">
            {{ bibliotecaPropia[0]?.nombre ?? 'Sin biblioteca asignada' }}
          </span>
          <!-- opcion si se le asigna mas de una biblioteca -->
          <!-- <select v-model="form.bibliotecaId"
            class="w-full text-sm rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
            :class="errores.bibliotecaId ? 'border-red-400' : 'border-slate-200'">
            <option :value="null" disabled>Seleccionar biblioteca</option>
            <option v-for="bib in bibliotecaPropia" :key="bib.id" :value="bib.id">
              {{ bib.nombre }}
            </option>
          </select> -->
        </div>

        <p v-if="errores.bibliotecaId" class="text-xs text-red-500 mt-1">{{ errores.bibliotecaId }}</p>

        <!-- Aviso si el bibliotecario no tiene biblioteca asignada -->
        <div v-if="isBibliotecario && !isAdmin && !bibliotecaPropia"
          class="flex items-start gap-2 mt-2 p-2.5 bg-amber-50 border border-amber-200 rounded-lg">
          <svg class="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24"
            stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.962-.833-2.732 0L3.07 16.5c-.77.833.193 2.5 1.732 2.5z" />
          </svg>
          <p class="text-xs text-amber-700">
            Tu cuenta no tiene una biblioteca asignada. Contacta al administrador.
          </p>
        </div>
      </div>

      
      <!-- ── Código para solicitar ──────────────────────────────────── -->
      <div class="space-y-2.5">
        <div class="flex items-center justify-between">
          <label class="block text-xs font-semibold text-slate-600 uppercase tracking-wide">
            Código para solicitar
          </label>
          <!-- Indicador de sugerencia automática (solo al crear con contexto) -->
          <span v-if="!ejemplar && props.libro"
            class="text-xs text-indigo-500 font-medium flex items-center gap-1">
            <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Sugerido automáticamente
          </span>
          <!-- Indicador modo edición -->
          <span v-else-if="ejemplar"
            class="text-xs text-slate-400 flex items-center gap-1">
            <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Datos originales del ejemplar
          </span>
        </div>

        <div class="grid grid-cols-3 gap-2.5">
          <div>
            <label class="block text-xs text-slate-500 mb-1">Clasificación decimal</label>
            <input v-model="form.clasificacionDecimal" type="text"
              placeholder="Ej. 989.506"
              class="w-full text-sm font-mono rounded-xl border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow" />
          </div>
          <div>
            <label class="block text-xs text-slate-500 mb-1">Cutter autor</label>
            <input v-model="form.cutterAutor" type="text"
              placeholder="Ej. REY"
              class="w-full text-sm font-mono rounded-xl border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow" />
          </div>
          <div>
            <label class="block text-xs text-slate-500 mb-1">Cutter título</label>
            <input v-model="form.cutterTitulo" type="text"
              placeholder="Ej. izq"
              class="w-full text-sm font-mono rounded-xl border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow" />
          </div>
        </div>

        <!-- Preview código — aparece cuando hay algo escrito -->
        <!-- <Transition name="slide-fade">
          <div v-if="mostrarPreview"
            class="rounded-xl border border-amber-200 bg-amber-50 overflow-hidden">
            <div class="flex items-center gap-2 px-3 py-1.5 border-b border-amber-200 bg-amber-100/60">
              <svg class="w-3.5 h-3.5 text-amber-600 flex-shrink-0" fill="none" viewBox="0 0 24 24"
                stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
              <span class="text-xs font-semibold text-amber-700 uppercase tracking-wide">
                Código para solicitar — preview
              </span>
            </div>
            <pre class="px-4 py-2.5 text-xs font-mono text-amber-800 leading-relaxed whitespace-pre-wrap">{{ codigoPreview }}</pre>
          </div>
        </Transition> -->
      </div>



      <!-- Código + Topográfico -->
      <div class="grid grid-cols-2 gap-3">
        <!-- <div>
          <label class="block text-xs font-medium text-slate-600 mb-1">Código ejemplar *</label>
          <input v-model="form.codigoEjemplar" type="text" placeholder="EJ-2024-010"
            class="w-full text-sm rounded-lg border px-3 py-2 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
            :class="errores.codigoEjemplar ? 'border-red-400' : 'border-slate-200'" />
          <p v-if="errores.codigoEjemplar" class="text-xs text-red-500 mt-1">{{ errores.codigoEjemplar }}</p>
          <p class="text-xs text-slate-400 mt-0.5">Debe ser único</p>
        </div> -->
        <div>
          <label class="block text-xs font-medium text-slate-600 mb-1">Código topográfico</label>
          <input v-model="form.codigoTopografico" type="text" placeholder="004.1 C676"
            class="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>

           <!-- Ubicación física -->
        <div>
          <label class="block text-xs font-medium text-slate-600 mb-1">
            Ubicación física *
          </label>

          <input
            v-model="form.ubicacionFisica"
            type="text"
            placeholder="Estante B-2, Fila 1"
            class="w-full text-sm rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            :class="errores.ubicacionFisica ? 'border-red-400' : 'border-slate-200'"
          />

          <p v-if="errores.ubicacionFisica" class="text-xs text-red-500 mt-1">
            {{ errores.ubicacionFisica }}
          </p>
        </div>
      </div>

      
      <!-- Fecha + Precio -->
      <div class="grid grid-cols-2 gap-3">
        <!-- Estado (solo al crear) -->
        <div v-if="!ejemplar">
          <label class="block text-xs font-medium text-slate-600 mb-1">Estado inicial</label>
          <select v-model="form.estadoEjemplar"
            class="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white">
            <option v-for="op in opcionesEstado" :key="op.value" :value="op.value">{{ op.label }}</option>
          </select>
        </div>

        <div>
          <label class="block text-xs font-medium text-slate-600 mb-1">Fecha adquisición</label>
          <input v-model="form.fechaAdquisicion" type="date"
            class="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
       
      </div>

      <!-- Observaciones -->
      <div>
        <label class="block text-xs font-medium text-slate-600 mb-1">Observaciones</label>
        <textarea v-model="form.observaciones" rows="2" placeholder="Donación FHCE 2024..."
          class="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
      </div>

      <p v-if="errores.edicionId && !(ediciones && ediciones.length > 1)" class="text-sm text-red-500">{{
        errores.edicionId }}</p>
      <p v-if="errorGeneral" class="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{{ errorGeneral }}</p>
    </div>

    <template #footer>
      <button @click="emit('close')"
        class="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
        Cancelar
      </button>
      <button @click="guardar" :disabled="guardando"
        class="px-5 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors disabled:opacity-60 flex items-center gap-2">
        <svg v-if="guardando" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        {{ ejemplar ? 'Guardar cambios' : 'Crear ejemplar' }}
      </button>
    </template>
  </BaseModal>
</template>