<script setup lang="ts">
import { ref, reactive, watch, computed, onMounted } from 'vue'
import BaseModal from './BaseModal.vue'
import { actualizarEdicion } from '@/services/ediciones.service'
import { actualizarEjemplar } from '@/services/ejemplares.service'
import { bibliotecasService } from '@/services/bibliotecas.service'
import { useAuthStore } from '@/stores/auth.store'
import { usePermissions } from '@/composables/usePermissions'
import { useMedia } from '@/composables/useMedia'
import type { Ejemplar, Edicion } from '@/types/catalogo'

// ─────────────────────────────────────────────────────────────────────────
// Este modal reemplaza a EjemplarFormModal SOLO en el flujo de edición
// (tabla de ejemplares → "Editar ejemplar"). Para crear ejemplares o
// ediciones nuevas se siguen usando EjemplarFormModal / EdicionFormModal
// sin cambios.
// ─────────────────────────────────────────────────────────────────────────

const props = defineProps<{
  // El ejemplar a editar. Se asume que trae anidado el objeto Edicion
  // completo (props.ejemplar.edicion), tal como lo consume
  // EjemplarFormModal al leer `e.edicion?.idEdicion`.
  ejemplar: Ejemplar
  // Ediciones disponibles del libro, por si se quiere reasignar el
  // ejemplar a otra edición (mismo comportamiento opcional que ya
  // tenía EjemplarFormModal).
  ediciones?: Edicion[]
}>()

const emit = defineEmits<{ close: []; saved: [] }>()

const { getUrl } = useMedia()
const auth = useAuthStore()
const { isAdmin, isBibliotecario } = usePermissions()

const guardando = ref(false)
const errorGeneral = ref('')
// Errores separados por sección para no mezclar validaciones
const erroresEdicion = reactive<Record<string, string>>({})
const erroresEjemplar = reactive<Record<string, string>>({})

function limpiarErrores() {
  Object.keys(erroresEdicion).forEach(k => delete erroresEdicion[k])
  Object.keys(erroresEjemplar).forEach(k => delete erroresEjemplar[k])
}

// La edición cargada junto con el ejemplar. OJO: `Ejemplar.edicion` en
// catalogo.ts es un objeto PARCIAL (idEdicion, isbn, editorial, anoPublicacion,
// idLibro, titulo, idioma) — no el tipo `Edicion` completo. No declara
// imagenPortada/pdfUrl/numeroPaginas/edicion(número), así que esos campos se
// leen con cast a `any` por si el backend los incluye igual en la respuesta.
// Si tu API NO los devuelve anidados en el ejemplar, hay que cargarlos con
// una llamada aparte (no tengo el servicio de ediciones para confirmarlo).
const edicionOriginal = computed(() => props.ejemplar.edicion ?? null)
const edicionSeleccionadaEsLaOriginal = computed(() =>
  !edicionOriginal.value || formEjemplar.edicionId === edicionOriginal.value.idEdicion
)

// ══════════════════════════════════════════════════════════════════════
// SECCIÓN: Datos de la edición (basado en EdicionFormModal.vue)
// ══════════════════════════════════════════════════════════════════════

type ModoPortada = 'archivo' | 'url'
const modoPortada = ref<ModoPortada>('archivo')
const portadaFile = ref<File | null>(null)
const portadaPreview = ref('')
const portadaUrlInput = ref('')

const portadaActual = computed(() => getUrl((edicionOriginal.value as any)?.imagenPortada))
const pdfActual = computed(() => getUrl((edicionOriginal.value as any)?.pdfUrl))

function onArchivoChange(ev: Event) {
  const file = (ev.target as HTMLInputElement).files?.[0]
  if (!file) return
  portadaFile.value = file
  const reader = new FileReader()
  reader.onload = (e) => { portadaPreview.value = e.target?.result as string }
  reader.readAsDataURL(file)
  portadaUrlInput.value = ''
}

function limpiarPortada() {
  portadaFile.value = null
  portadaPreview.value = ''
  portadaUrlInput.value = ''
}

const previewVisible = computed(() =>
  portadaPreview.value || portadaUrlInput.value || portadaActual.value
)

const pdfFile = ref<File | null>(null)
const pdfNombre = ref('')

function onPdfChange(ev: Event) {
  const file = (ev.target as HTMLInputElement).files?.[0]
  if (!file) return
  pdfFile.value = file
  pdfNombre.value = file.name
}

function quitarPdf() {
  pdfFile.value = null
  pdfNombre.value = ''
}

const formEdicion = reactive({
  isbn: '',
  editorial: '',
  anoPublicacion: new Date().getFullYear(),
  edicion: '1ra',
  numeroPaginas: null as number | null,
})

function cargarFormEdicion(e: typeof edicionOriginal.value) {
  limpiarPortada()
  formEdicion.isbn = e?.isbn ?? ''
  formEdicion.editorial = e?.editorial ?? ''
  formEdicion.anoPublicacion = e?.anoPublicacion ?? new Date().getFullYear()
  // No declarados en el tipo parcial Ejemplar['edicion']; ver nota arriba.
  formEdicion.edicion = (e as any)?.edicion ?? '1ra'
  formEdicion.numeroPaginas = (e as any)?.numeroPaginas ?? null
}

function validarEdicion(): boolean {
  // Si el usuario reasignó el ejemplar a una edición distinta de la
  // cargada, no validamos ni enviamos cambios de edición.
  if (!edicionSeleccionadaEsLaOriginal.value) return true
  // if (!formEdicion.isbn.trim()) erroresEdicion.isbn = 'El ISBN es requerido'
  // if (!formEdicion.editorial.trim()) erroresEdicion.editorial = 'La editorial es requerida'
  const anio = new Date().getFullYear()
  if (!formEdicion.anoPublicacion || formEdicion.anoPublicacion < 1000 || formEdicion.anoPublicacion > anio + 1)
    erroresEdicion.anoPublicacion = 'Año inválido'
  return Object.keys(erroresEdicion).length === 0
}

// ══════════════════════════════════════════════════════════════════════
// SECCIÓN: Datos del ejemplar (basado en EjemplarFormModal.vue)
// ══════════════════════════════════════════════════════════════════════

interface BibliotecaOpcion {
  id: number
  nombre: string
}

const bibliotecas = ref<BibliotecaOpcion[]>([])
const cargandoBibs = ref(false)

const bibliotecaPropia = computed<BibliotecaOpcion[]>(() => {
  if (!auth.user?.biblioteca || auth.user.biblioteca.length === 0) return []
  return auth.user.biblioteca
    .map((bib: any) => ({
      id: (bib.id_biblioteca ?? bib.idBiblioteca ?? bib.id) as number,
      nombre: (bib.nombre ?? bib.name) as string,
    }))
    .filter((b: BibliotecaOpcion) => b.id && b.nombre)
})

onMounted(async () => {
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
  } else if (bibliotecaPropia.value.length > 0) {
    bibliotecas.value = bibliotecaPropia.value
  }
})

const formEjemplar = reactive({
  edicionId: null as number | null,
  bibliotecaId: null as number | null,
  codigoEjemplar: '',
  codigoTopografico: '',
  clasificacionDecimal: '',
  cutterAutor: '',
  cutterTitulo: '',
  ubicacionFisica: '',
  fechaAdquisicion: new Date().toISOString().split('T')[0],
  precioCompra: null as number | null,
  observaciones: '',
})

function cargarFormEjemplar(e: Ejemplar) {
  formEjemplar.edicionId = e.edicion?.idEdicion ?? null
  if (e.biblioteca?.idBiblioteca) {
    formEjemplar.bibliotecaId = e.biblioteca.idBiblioteca
  }
  formEjemplar.codigoEjemplar = e.codigoEjemplar ?? ''
  formEjemplar.codigoTopografico = e.codigoTopografico ?? (e as any).codigoTopograficoConcat ?? ''
  formEjemplar.clasificacionDecimal = (e as any).clasificacionDecimal ?? ''
  formEjemplar.cutterAutor = (e as any).cutterAutor ?? ''
  formEjemplar.cutterTitulo = (e as any).cutterTitulo ?? ''
  formEjemplar.ubicacionFisica = e.ubicacionFisica ?? ''
  formEjemplar.fechaAdquisicion = e.fechaAdquisicion ?? new Date().toISOString().split('T')[0]
  formEjemplar.precioCompra = e.precioCompra ?? null
  formEjemplar.observaciones = e.observaciones ?? ''
}

// Precarga biblioteca propia si el ejemplar no trae una (igual que el original)
watch(bibliotecaPropia, (bib) => {
  if (bib.length > 0 && !formEjemplar.bibliotecaId) {
    formEjemplar.bibliotecaId = bib[0].id
  }
}, { immediate: true })

// Carga inicial y ante cambios del ejemplar recibido
watch(() => props.ejemplar, (e) => {
  limpiarErrores()
  errorGeneral.value = ''
  cargarFormEjemplar(e)
  cargarFormEdicion(e.edicion ?? null)
}, { immediate: true })

function validarEjemplar(): boolean {
  // if (!formEjemplar.ubicacionFisica.trim()) erroresEjemplar.ubicacionFisica = 'La ubicación es requerida'
  if (!formEjemplar.edicionId) erroresEjemplar.edicionId = 'Debe seleccionar una edición'
  if (!formEjemplar.bibliotecaId) erroresEjemplar.bibliotecaId = 'Debe seleccionar una biblioteca'
  return Object.keys(erroresEjemplar).length === 0
}

// ══════════════════════════════════════════════════════════════════════
// Guardado combinado
// ══════════════════════════════════════════════════════════════════════

// Qué operación estaba en curso cuando ocurrió un error, para dar un
// mensaje más útil usando el mismo mecanismo (errorGeneral) que ya
// usa la app.
const pasoConError = ref<'edicion' | 'ejemplar' | null>(null)

async function guardar() {
  limpiarErrores()
  const edicionOk = validarEdicion()
  const ejemplarOk = validarEjemplar()
  if (!edicionOk || !ejemplarOk) return

  guardando.value = true
  errorGeneral.value = ''
  pasoConError.value = null

  try {
    // 1) Edición primero (mismo orden que ya usa la app al crear un ejemplar
    // con edición nueva). Solo se envía si el usuario no reasignó el
    // ejemplar a otra edición distinta de la que se cargó.
    if (edicionSeleccionadaEsLaOriginal.value && edicionOriginal.value) {
      pasoConError.value = 'edicion'
      const payloadEdicion = {
        isbn: formEdicion.isbn.trim(),
        editorial: formEdicion.editorial.trim(),
        anoPublicacion: formEdicion.anoPublicacion,
        edicion: formEdicion.edicion.trim() || undefined,
        numeroPaginas: formEdicion.numeroPaginas || undefined,
        // `Edicion` no declara libroId; el ejemplar sí trae idLibro en su
        // edición anidada (igual que usa `abrirEditar` en useInventario.ts).
        libroId: props.ejemplar.edicion?.idLibro,
        imagenPortada: modoPortada.value === 'url' && portadaUrlInput.value.trim()
          ? portadaUrlInput.value.trim()
          : undefined,
      }
      const archivo = modoPortada.value === 'archivo' ? portadaFile.value : null
      const archivoPdf = pdfFile.value

      await actualizarEdicion(edicionOriginal.value.idEdicion, payloadEdicion, archivo, archivoPdf)
    }

    // 2) Ejemplar
    pasoConError.value = 'ejemplar'
    await actualizarEjemplar(props.ejemplar.idEjemplar ?? props.ejemplar.id_ejemplar, {
      codigoEjemplar: formEjemplar.codigoEjemplar,
      codigoTopografico: formEjemplar.codigoTopografico || undefined,
      clasificacionDecimal: formEjemplar.clasificacionDecimal.trim() || undefined,
      cutterAutor: formEjemplar.cutterAutor.trim() || undefined,
      cutterTitulo: formEjemplar.cutterTitulo.trim() || undefined,
      ubicacionFisica: formEjemplar.ubicacionFisica || undefined,
      edicionId: formEjemplar.edicionId!,
      bibliotecaId: formEjemplar.bibliotecaId!,
      precioCompra: formEjemplar.precioCompra,
      observaciones: formEjemplar.observaciones || undefined,
    })

    emit('saved')
  } catch (e: unknown) {
    let msg = 'No se pudo completar el registro'
    if (typeof e === 'object' && e !== null && 'response' in e) {
      const err = e as any
      msg = err.response?.data?.message || msg
    } else if (e instanceof Error) {
      msg = e.message
    }
    const prefijo = pasoConError.value === 'edicion'
      ? 'Error al actualizar la edición: '
      : pasoConError.value === 'ejemplar'
        ? 'Error al actualizar el ejemplar: '
        : ''
    errorGeneral.value = prefijo + msg
  } finally {
    guardando.value = false
  }
}
</script>

<template>
  <BaseModal size="lg" @close="emit('close')">

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
            Editar ejemplar
          </h2>
          <p class="text-xs text-slate-500">
            Modifica los datos de la Edicion y Ejemplar
            
          </p>
        </div>
        <div>
          <!-- <label class="block text-xs font-medium text-slate-600 mb-1">
            Biblioteca *
            <span v-if="isBibliotecario && !isAdmin" class="text-slate-400 font-normal">(tu biblioteca)</span>
          </label> -->

          <div v-if="isAdmin">
            <div v-if="cargandoBibs" class="flex items-center gap-2 h-9 text-xs text-slate-400">
              <svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Cargando bibliotecas…
            </div>
            <select v-else v-model="formEjemplar.bibliotecaId"
              class="w-full text-sm rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              :class="erroresEjemplar.bibliotecaId ? 'border-red-400' : 'border-slate-200'">
              <option :value="null" disabled>Seleccionar biblioteca</option>
              <option v-for="bib in bibliotecas" :key="bib.id" :value="bib.id">
                {{ bib.nombre }}
              </option>
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

        <div v-if="isBibliotecario && !isAdmin && !bibliotecaPropia.length"
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
      </div>
    </template>

    <div class="space-y-6">

      <!-- Datos de edición -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-5">
        <!-- ─────────────── Información ─────────────── -->
        <div class="md:col-span-2 space-y-3">
          <h3 class="text-xs font-bold text-indigo-600 uppercase tracking-wide border-b border-slate-100 pb-1.5">
            Datos de la edición
          </h3>
          <!-- Editorial -->
          <div>
            <label class="block text-xs font-medium text-slate-600 mb-1">
              Editorial
            </label>

            <input
              v-model="formEdicion.editorial"
              type="text"
              placeholder="MIT Press"
              maxlength="50"
              class="w-full text-sm rounded-lg border px-3 py-2
                    focus:outline-none focus:ring-2 focus:ring-indigo-500"
              :class="erroresEdicion.editorial
                ? 'border-red-400'
                : 'border-slate-200'"
            />

            <p
              v-if="erroresEdicion.editorial"
              class="text-xs text-red-500 mt-1"
            >
              {{ erroresEdicion.editorial }}
            </p>
          </div>


          <!-- Año + Número de edición -->
          <div class="grid grid-cols-2 gap-3">

            <!-- Año -->
            <div>
              <label class="block text-xs font-medium text-slate-600 mb-1">
                Año *
              </label>

              <input
                v-model.number="formEdicion.anoPublicacion"
                type="number"
                class="w-full text-sm rounded-lg border px-3 py-2
                      focus:outline-none focus:ring-2 focus:ring-indigo-500"
                :class="erroresEdicion.anoPublicacion
                  ? 'border-red-400'
                  : 'border-slate-200'"
              />

              <p
                v-if="erroresEdicion.anoPublicacion"
                class="text-xs text-red-500 mt-1"
              >
                {{ erroresEdicion.anoPublicacion }}
              </p>
            </div>


            <!-- Número de edición -->
            <div>
              <label class="block text-xs font-medium text-slate-600 mb-1">
                Número de edición
              </label>

              <input
                v-model="formEdicion.edicion"
                type="text"
                placeholder="4ta"
                class="w-full text-sm rounded-lg border border-slate-200
                      px-3 py-2 focus:outline-none focus:ring-2
                      focus:ring-indigo-500"
              />
            </div>

          </div>
        </div>
        <!-- ─────────────── Portada + PDF ─────────────── -->
        <div class="space-y-3">

          <!-- Portada -->
          <div>
            <label class="block text-xs font-medium text-slate-600 mb-1">
              Portada
              <span class="text-slate-400 font-normal">(opcional)</span>
            </label>

            <div
              class="relative w-24 aspect-[3/4] rounded-lg overflow-hidden
                    border-2 border-dashed border-slate-200
                    hover:border-indigo-300 bg-slate-50
                    cursor-pointer group transition-colors"
            >

              <!-- Preview -->
              <img
                v-if="previewVisible"
                :src="previewVisible"
                alt="Portada"
                class="absolute inset-0 w-full h-full object-cover"
                @click="($refs.portadaInput as HTMLInputElement)?.click()"
                @error="portadaPreview = ''"
              />

              <!-- Sin portada -->
              <div
                v-else
                class="absolute inset-0 flex flex-col items-center
                      justify-center gap-1"
                @click="($refs.portadaInput as HTMLInputElement)?.click()"
              >
                <svg
                  class="w-6 h-6 text-slate-300 group-hover:text-indigo-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="1.5"
                    d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
                  />
                </svg>

                <span class="text-[10px] text-slate-400 text-center px-1">
                  Subir imagen
                </span>
              </div>


              <!-- Eliminar portada -->
              <button
                v-if="previewVisible"
                @click.stop="limpiarPortada"
                class="absolute top-1 right-1 w-5 h-5 rounded-full
                      bg-black/50 text-white flex items-center justify-center
                      hover:bg-black/70"
              >
                <svg
                  class="w-3 h-3"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2.5"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>

              <input
                ref="portadaInput"
                type="file"
                accept="image/*"
                class="sr-only"
                @change="onArchivoChange"
              />
            </div>
          </div>


          <!-- PDF -->
          <div>
            <label class="block text-xs font-medium text-slate-600 mb-1">
              PDF
              <span class="text-slate-400 font-normal">(opcional)</span>
            </label>

            <div
              v-if="!pdfNombre"
              class="flex items-center gap-2 px-3 py-2
                    border border-dashed border-slate-200 rounded-lg
                    hover:border-indigo-300 hover:bg-indigo-50
                    transition-colors cursor-pointer"
              @click="($refs.pdfRef as HTMLInputElement)?.click()"
            >
              <svg
                class="w-5 h-5 text-slate-300 flex-shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="1.5"
                  d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                />
              </svg>

              <div class="min-w-0">
                <p class="text-xs text-slate-500 font-medium truncate">
                  Subir PDF
                </p>
                <p class="text-[10px] text-slate-400">
                  Máx. 50MB
                </p>
              </div>

              <input
                ref="pdfRef"
                type="file"
                accept=".pdf"
                class="sr-only"
                @change="onPdfChange"
              />
            </div>


            <!-- PDF seleccionado -->
            <div
              v-else
              class="flex items-center gap-2 px-3 py-2
                    bg-emerald-50 border border-emerald-200 rounded-lg"
            >
              <svg
                class="w-4 h-4 text-emerald-500 flex-shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M5 13l4 4L19 7"
                />
              </svg>

              <span class="text-xs text-emerald-700 truncate flex-1">
                {{ pdfNombre }}
              </span>

              <button
                @click="quitarPdf"
                class="text-emerald-400 hover:text-red-500"
              >
                <svg
                  class="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          </div>

        </div>
      </div>

      <!-- ═══════════════ Datos del ejemplar ═══════════════ -->
      <div class="space-y-4">
        <h3 class="text-xs font-bold text-indigo-600 uppercase tracking-wide border-b border-slate-100 pb-1.5">
          Datos del ejemplar
        </h3>

        <!-- Selección de edición (si se pasan varias) -->
        <div v-if="ediciones && ediciones.length > 1">
          <label class="block text-xs font-medium text-slate-600 mb-1">Edición *</label>
          <select v-model="formEjemplar.edicionId"
            class="w-full text-sm rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
            :class="erroresEjemplar.edicionId ? 'border-red-400' : 'border-slate-200'">
            <option :value="null" disabled>Seleccionar edición</option>
            <option v-for="ed in ediciones" :key="ed.idEdicion" :value="ed.idEdicion">
              {{ ed.isbn }} — {{ ed.editorial }} ({{ ed.anoPublicacion }})
            </option>
          </select>
          <p v-if="erroresEjemplar.edicionId" class="text-xs text-red-500 mt-1">{{ erroresEjemplar.edicionId }}</p>
        </div>

        <!-- Código para solicitar -->
        <div class="space-y-2.5">
          <div class="flex items-center justify-between">
            <label class="block text-xs font-semibold text-slate-600 uppercase tracking-wide">
              Código para solicitar
            </label>
            <span class="text-xs text-slate-400 flex items-center gap-1">
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
              <input v-model="formEjemplar.clasificacionDecimal" type="text" maxlength="10"
                placeholder="Ej. 989.506"
                class="w-full text-sm font-mono rounded-xl border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow" />
            </div>
            <div>
              <label class="block text-xs text-slate-500 mb-1">Cutter autor</label>
              <input v-model="formEjemplar.cutterAutor" type="text" maxlength="10"
                placeholder="Ej. REY"
                class="w-full text-sm font-mono rounded-xl border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow" />
            </div>
            <div>
              <label class="block text-xs text-slate-500 mb-1">Cutter título</label>
              <input v-model="formEjemplar.cutterTitulo" type="text" maxlength="10"
                placeholder="Ej. izq"
                class="w-full text-sm font-mono rounded-xl border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow" />
            </div>
          </div>
        </div>

        <!-- Ubicación física -->
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-medium text-slate-600 mb-1">
              Ubicación física
            </label>
            <input
              v-model="formEjemplar.ubicacionFisica" maxlength="20"
              type="text"
              placeholder="Estante B-2, Fila 1"
              class="w-full text-sm rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              :class="erroresEjemplar.ubicacionFisica ? 'border-red-400' : 'border-slate-200'"
            />
            <p v-if="erroresEjemplar.ubicacionFisica" class="text-xs text-red-500 mt-1">
              {{ erroresEjemplar.ubicacionFisica }}
            </p>
          </div>

          <div>
            <label class="block text-xs font-medium text-slate-600 mb-1">Fecha adquisición</label>
            <input v-model="formEjemplar.fechaAdquisicion" type="date"
              class="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
        </div>

        <!-- Observaciones -->
        <div>
          <label class="block text-xs font-medium text-slate-600 mb-1">Observaciones</label>
          <textarea v-model="formEjemplar.observaciones" rows="2" placeholder="Donación FHCE 2024..."
            class="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
        </div>
      </div>

      <p v-if="errorGeneral" class="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">
        {{ errorGeneral }}
      </p>
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
        Guardar cambios
      </button>
    </template>
  </BaseModal>
</template>