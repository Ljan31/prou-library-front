<script setup lang="ts">
import { ref, reactive, watch, computed } from 'vue'
import BaseModal from './BaseModal.vue'
import { crearEdicion, actualizarEdicion } from '@/services/ediciones.service'
import { useMedia } from '@/composables/useMedia'
import type { Edicion } from '@/types/catalogo'

const props = defineProps<{
  edicion: Edicion | null
  libroId: number
}>()

const emit = defineEmits<{ close: []; saved: [] }>()
const { getUrl } = useMedia()
const guardando = ref(false)
const errorGeneral = ref('')
const errores = reactive<Record<string, string>>({})

// ─── Modo portada: 'archivo' | 'url' ─────────────────────────────────────
type ModoPortada = 'archivo' | 'url'
const modoPortada = ref<ModoPortada>('archivo')
const portadaFile = ref<File | null>(null)
const portadaPreview = ref('')   // preview local del archivo elegido
const portadaUrlInput = ref('')   // URL externa escrita por el usuario

// Preview actual (del ejemplar ya guardado)
// const portadaActual = computed(() => props.edicion?.imagenPortada ?? '')
const portadaActual = computed(() =>
  getUrl(props.edicion?.imagenPortada)
)
const pdfActual = computed(() =>
  getUrl(props.edicion?.pdfUrl)
)

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

// Imagen a mostrar en el preview (prioridad: archivo > url escrita > portada guardada)
const previewVisible = computed(() =>
  portadaPreview.value || portadaUrlInput.value || portadaActual.value
)

// PDF
const pdfFile = ref<File | null>(null)
const pdfNombre = ref('')

// Cuando selecciona un archivo PDF
function onPdfChange(ev: Event) {
  const file = (ev.target as HTMLInputElement).files?.[0]
  if (!file) return
  pdfFile.value = file
  pdfNombre.value = file.name
}

// Limpiar PDF seleccionado
function quitarPdf() {
  pdfFile.value = null
  pdfNombre.value = ''
}

const form = reactive({
  isbn: '',
  editorial: '',
  anoPublicacion: new Date().getFullYear(),
  edicion: '1ra',
  numeroPaginas: null as number | null,
})

watch(() => props.edicion, (e) => {
  limpiarErrores(); errorGeneral.value = ''; limpiarPortada()
  form.isbn = e?.isbn ?? ''
  form.editorial = e?.editorial ?? ''
  form.anoPublicacion = e?.anoPublicacion ?? new Date().getFullYear()
  form.edicion = e?.edicion ?? '1ra'
  form.numeroPaginas = e?.numeroPaginas ?? null
  form.imagenPortada = e?.imagenPortada ?? ''
}, { immediate: true })

function limpiarErrores() {
  Object.keys(errores).forEach(k => delete errores[k])
}

// Subida simulada de portada
function onPortadaChange(ev: Event) {
  const file = (ev.target as HTMLInputElement).files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = (e) => { form.imagenPortada = e.target?.result as string }
  reader.readAsDataURL(file)
}

function validar(): boolean {
  limpiarErrores()
  if (!form.isbn.trim()) errores.isbn = 'El ISBN es requerido'
  if (!form.editorial.trim()) errores.editorial = 'La editorial es requerida'
  const anio = new Date().getFullYear()
  if (!form.anoPublicacion || form.anoPublicacion < 1000 || form.anoPublicacion > anio + 1)
    errores.anoPublicacion = 'Año inválido'
  return Object.keys(errores).length === 0
}

async function guardar() {
  if (!validar()) return
  guardando.value = true; errorGeneral.value = ''
  try {
    console.log("guardar")
    console.log(form)
    const payload = {
      isbn: form.isbn.trim(),
      editorial: form.editorial.trim(),
      anoPublicacion: form.anoPublicacion,
      edicion: form.edicion.trim() || undefined,
      numeroPaginas: form.numeroPaginas || undefined,
      libroId: props.libroId,
      // URL externa solo si el modo es url y hay algo escrito (Caso B)
      imagenPortada: modoPortada.value === 'url' && portadaUrlInput.value.trim()
        ? portadaUrlInput.value.trim()
        : undefined,
    }
    // Archivo (Caso A) — null significa "sin cambio" para el backend (Caso C)
    const archivo = modoPortada.value === 'archivo' ? portadaFile.value : null
    const archivoPdf = pdfFile.value  // si es null, no se envía

    console.log("archivo", archivo)
    if (props.edicion) {
      await actualizarEdicion(props.edicion.idEdicion, payload, archivo, archivoPdf)
    } else {
      await crearEdicion(payload, archivo, archivoPdf)
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
    errorGeneral.value = e instanceof Error ? msg : 'Error al guardar la edición'

  } finally {
    guardando.value = false
  }
}
</script>

<template>
  <BaseModal :title="edicion ? 'Editar ediciónss' : 'Nueva edición'" size="md" @close="emit('close')">
    <div class="space-y-4">

     <!-- ── Portada + PDF lado a lado ───────────────────────────── -->
      <div class="flex flex-col md:flex-row gap-6">
        
        <!-- ── Portada ── -->
        <div class="flex-1 flex flex-col justify-start">
            <label class="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
              Portada <span class="text-slate-400 font-normal normal-case">(opcional)</span>
            </label>

          <div class="relative block w-28 aspect-[3/4] rounded-xl overflow-hidden border-2 border-dashed border-slate-200 hover:border-indigo-300 bg-slate-50 cursor-pointer group transition-colors">
            <!-- Imagen -->
            <img v-if="previewVisible" :src="previewVisible" alt="Portada"
                class="absolute inset-0 w-full h-full object-cover"
                @click="($refs.portadaInput as HTMLInputElement)?.click()"
                @error="portadaPreview = ''" />
            <div v-else class="absolute inset-0 flex flex-col items-center justify-center gap-1.5"
                @click="($refs.portadaInput as HTMLInputElement)?.click()">
              <svg class="w-7 h-7 text-slate-300 group-hover:text-indigo-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                      d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
              <span class="text-xs text-slate-400 text-center px-2 leading-tight">Haz clic para subir una imagen</span>
            </div>

            <!-- Botón limpiar -->
            <button v-if="previewVisible" @click.stop="limpiarPortada"
                    class="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors">
              <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <!-- Input de archivo oculto -->
            <input ref="portadaInput" type="file" accept="image/*" class="sr-only" @change="onArchivoChange" />
          </div>

          
        </div>

        <!-- ── PDF ── -->
        <div class="flex-1">
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
            <input ref="pdfRef" type="file" accept=".pdf" class="sr-only" @change="onPdfChange" />
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
      </div>
      <!-- ── Datos de la edición ────────────────────────────────────────── -->
      <div class="grid grid-cols-2 gap-3">
        <div class="col-span-2">
          <label class="block text-xs font-medium text-slate-600 mb-1">ISBN *</label>
          <input v-model="form.isbn" type="text" placeholder="978-0-262-03384-8" maxlength="17" minlength="10"
            class="w-full text-sm rounded-lg border px-3 py-2 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
            :class="errores.isbn ? 'border-red-400' : 'border-slate-200'" />
          <p v-if="errores.isbn" class="text-xs text-red-500 mt-1">{{ errores.isbn }}</p>
        </div>

        <div class="col-span-2">
          <label class="block text-xs font-medium text-slate-600 mb-1">Editorial *</label>
          <input v-model="form.editorial" type="text" placeholder="MIT Press" maxlength="50"
            class="w-full text-sm rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            :class="errores.editorial ? 'border-red-400' : 'border-slate-200'" />
          <p v-if="errores.editorial" class="text-xs text-red-500 mt-1">{{ errores.editorial }}</p>
        </div>

        <div>
          <label class="block text-xs font-medium text-slate-600 mb-1">Año *</label>
          <input v-model.number="form.anoPublicacion" type="number"
            class="w-full text-sm rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            :class="errores.anoPublicacion ? 'border-red-400' : 'border-slate-200'" />
          <p v-if="errores.anoPublicacion" class="text-xs text-red-500 mt-1">{{ errores.anoPublicacion }}</p>
        </div>

        <div>
          <label class="block text-xs font-medium text-slate-600 mb-1">Número de edición</label>
          <input v-model="form.edicion" type="text" placeholder="4ta"
            class="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
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
        {{ edicion ? 'Guardar cambios' : 'Crear edición' }}
      </button>
    </template>
  </BaseModal>
</template>