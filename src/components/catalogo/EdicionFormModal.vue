<script setup lang="ts">
import { ref, reactive, watch, computed } from 'vue'
import BaseModal from './BaseModal.vue'
import { crearEdicion, actualizarEdicion } from '@/services/ediciones.service'
import type { Edicion } from '@/types/catalogo'

const props = defineProps<{
  edicion: Edicion | null
  libroId: number
}>()

const emit = defineEmits<{ close: []; saved: [] }>()

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
const portadaActual = computed(() => props.edicion?.imagenPortada ?? '')

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
    console.log("archivo", archivo)
    if (props.edicion) {
      await actualizarEdicion(props.edicion.idEdicion, payload, archivo)
    } else {
      await crearEdicion(payload, archivo)
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
  <BaseModal :title="edicion ? 'Editar edición' : 'Nueva edición'" size="md" @close="emit('close')">
    <div class="space-y-4">

      <!-- ── Portada ───────────────────────────────────────────────────── -->
      <div>
        <label class="block text-xs font-medium text-slate-600 mb-2">Portada</label>

        <!-- Tabs archivo / URL -->
        <div class="flex rounded-lg border border-slate-200 overflow-hidden text-xs w-fit mb-3">
          <button @click="modoPortada = 'archivo'; limpiarPortada()" :class="['px-3 py-1.5 font-medium transition-colors',
            modoPortada === 'archivo' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-50']">
            Subir archivo
          </button>
          <button @click="modoPortada = 'url'; limpiarPortada()" :class="['px-3 py-1.5 font-medium transition-colors',
            modoPortada === 'url' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-50']">
            URL externa
          </button>
        </div>

        <div class="flex items-start gap-4">
          <!-- Preview -->
          <div
            class="flex-shrink-0 w-24 h-32 rounded-xl overflow-hidden bg-gradient-to-br from-indigo-50 to-slate-100 border border-slate-200 relative group">
            <img v-if="previewVisible" :src="previewVisible" alt="Portada" class="w-full h-full object-cover"
              @error="portadaPreview = ''" />
            <div v-else class="w-full h-full flex flex-col items-center justify-center gap-2 p-2">
              <svg class="w-7 h-7 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span class="text-xs text-slate-400 text-center leading-tight">Sin portada</span>
            </div>

            <!-- Botón limpiar si hay imagen -->
            <button v-if="previewVisible" @click="limpiarPortada"
              class="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              title="Quitar portada">
              <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- Control según modo -->
          <div class="flex-1">
            <!-- Modo archivo -->
            <div v-if="modoPortada === 'archivo'">
              <label
                class="flex flex-col items-center justify-center gap-2 px-4 py-6 border-2 border-dashed rounded-xl cursor-pointer transition-colors"
                :class="portadaFile ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 hover:border-indigo-300 hover:bg-indigo-50'">
                <svg class="w-6 h-6" :class="portadaFile ? 'text-emerald-500' : 'text-slate-400'" fill="none"
                  viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                    d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                </svg>
                <span class="text-xs text-center"
                  :class="portadaFile ? 'text-emerald-700 font-medium' : 'text-slate-500'">
                  {{ portadaFile ? portadaFile.name : 'Haz clic o arrastra una imagen' }}
                </span>
                <span class="text-xs text-slate-400">JPG, PNG, WEBP</span>
                <input type="file" accept="image/*" class="sr-only" @change="onArchivoChange" />
              </label>
              <p v-if="portadaActual && !portadaFile" class="text-xs text-slate-400 mt-1.5 text-center">
                Portada actual guardada · elige un archivo para reemplazarla
              </p>
            </div>

            <!-- Modo URL -->
            <div v-else class="space-y-2">
              <input v-model="portadaUrlInput" type="url" placeholder="https://cdn.example.com/portada.jpg"
                class="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              <p class="text-xs text-slate-400">
                La URL debe ser pública y accesible (JPG, PNG, WEBP).
              </p>
              <p v-if="portadaActual && !portadaUrlInput" class="text-xs text-slate-400">
                Portada actual: <a :href="portadaActual" target="_blank"
                  class="text-indigo-500 hover:underline truncate inline-block max-w-[200px] align-bottom">
                  {{ portadaActual }}
                </a>
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- ── Datos de la edición ────────────────────────────────────────── -->
      <div class="grid grid-cols-2 gap-3">
        <div class="col-span-2">
          <label class="block text-xs font-medium text-slate-600 mb-1">ISBN *</label>
          <input v-model="form.isbn" type="text" placeholder="978-0-262-03384-8"
            class="w-full text-sm rounded-lg border px-3 py-2 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
            :class="errores.isbn ? 'border-red-400' : 'border-slate-200'" />
          <p v-if="errores.isbn" class="text-xs text-red-500 mt-1">{{ errores.isbn }}</p>
        </div>

        <div class="col-span-2">
          <label class="block text-xs font-medium text-slate-600 mb-1">Editorial *</label>
          <input v-model="form.editorial" type="text" placeholder="MIT Press"
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

        <div class="col-span-2">
          <label class="block text-xs font-medium text-slate-600 mb-1">Páginas</label>
          <input v-model.number="form.numeroPaginas" type="number" placeholder="450"
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