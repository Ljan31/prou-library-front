<script setup lang="ts">
import { ref, reactive, watch } from 'vue'
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

const form = reactive({
  isbn: '',
  editorial: '',
  anoPublicacion: new Date().getFullYear(),
  edicion: '1ra',
  numeroPaginas: null as number | null,
  imagenPortada: '',
})

watch(() => props.edicion, (e) => {
  limpiarErrores(); errorGeneral.value = ''
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
    const payload = {
      isbn: form.isbn.trim(),
      editorial: form.editorial.trim(),
      anoPublicacion: form.anoPublicacion,
      edicion: form.edicion.trim() || undefined,
      numeroPaginas: form.numeroPaginas || undefined,
      imagenPortada: form.imagenPortada || undefined,
      libroId: props.libroId,
    }
    if (props.edicion) {
      await actualizarEdicion(props.edicion.idEdicion, payload)
    } else {
      await crearEdicion(payload)
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
      <!-- Portada preview -->
      <div class="flex gap-4">
        <label
          class="relative flex-shrink-0 w-24 h-32 rounded-xl overflow-hidden bg-gradient-to-br from-indigo-50 to-slate-100 border border-slate-200 group cursor-pointer">
          <img v-if="form.imagenPortada" :src="form.imagenPortada" alt="Portada" class="w-full h-full object-cover" />
          <div v-else class="w-full h-full flex flex-col items-center justify-center gap-1">
            <svg class="w-7 h-7 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span class="text-xs text-slate-400 text-center leading-tight">Subir portada</span>
          </div>
          <div
            class="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
            <svg class="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" fill="none"
              viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
            </svg>
          </div>
          <input type="file" accept="image/*" class="sr-only" @change="onPortadaChange" />
        </label>

        <div class="flex-1 space-y-3">
          <div>
            <label class="block text-xs font-medium text-slate-600 mb-1">ISBN *</label>
            <input v-model="form.isbn" type="text" placeholder="978-0-262-03384-8"
              class="w-full text-sm rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
              :class="errores.isbn ? 'border-red-400' : 'border-slate-200'" />
            <p v-if="errores.isbn" class="text-xs text-red-500 mt-1">{{ errores.isbn }}</p>
          </div>
          <div>
            <label class="block text-xs font-medium text-slate-600 mb-1">Editorial *</label>
            <input v-model="form.editorial" type="text" placeholder="MIT Press"
              class="w-full text-sm rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              :class="errores.editorial ? 'border-red-400' : 'border-slate-200'" />
            <p v-if="errores.editorial" class="text-xs text-red-500 mt-1">{{ errores.editorial }}</p>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-3 gap-3">
        <div>
          <label class="block text-xs font-medium text-slate-600 mb-1">Año *</label>
          <input v-model.number="form.anoPublicacion" type="number"
            class="w-full text-sm rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            :class="errores.anoPublicacion ? 'border-red-400' : 'border-slate-200'" />
          <p v-if="errores.anoPublicacion" class="text-xs text-red-500 mt-1">{{ errores.anoPublicacion }}</p>
        </div>
        <div>
          <label class="block text-xs font-medium text-slate-600 mb-1">Edición</label>
          <input v-model="form.edicion" type="text" placeholder="4ta"
            class="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
        <div>
          <label class="block text-xs font-medium text-slate-600 mb-1">Páginas</label>
          <input v-model.number="form.numeroPaginas" type="number" placeholder="450"
            class="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
      </div>

      <div>
        <label class="block text-xs font-medium text-slate-600 mb-1">URL portada (o subir arriba)</label>
        <input v-model="form.imagenPortada" type="text" placeholder="https://cdn.example.com/portada.jpg"
          class="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
      </div>

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
        {{ edicion ? 'Guardar cambios' : 'Crear edición' }}
      </button>
    </template>
  </BaseModal>
</template>