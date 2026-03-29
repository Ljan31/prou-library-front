<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import type { CarreraDetail, CreateCarreraPayload } from '@/services/bibliotecas.service'
import { useBibliotecasStore } from '@/stores/bibliotecas.store'

const props = defineProps<{
  modelValue: boolean
  editing: CarreraDetail | null
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void
  (e: 'saved'): void
}>()

const store = useBibliotecasStore()
const isEdit = computed(() => !!props.editing)
const title = computed(() => isEdit.value ? 'Editar Carrera' : 'Nueva Carrera')

const form = ref<CreateCarreraPayload>({ nombre_carrera: '', codigo_carrera: '' })
const errors = ref<Record<string, string>>({})
const submitting = ref(false)

watch(() => props.modelValue, open => {
  if (open) {
    errors.value = {}
    form.value = props.editing
      ? { nombre_carrera: props.editing.nombre_carrera, codigo_carrera: props.editing.codigo_carrera }
      : { nombre_carrera: '', codigo_carrera: '' }
  }
})

function validate() {
  errors.value = {}
  if (!form.value.nombre_carrera.trim()) errors.value.nombre = 'El nombre es requerido'
  if (!form.value.codigo_carrera.trim()) errors.value.codigo = 'El código es requerido'
  return Object.keys(errors.value).length === 0
}

async function submit() {
  if (!validate()) return
  submitting.value = true
  let ok = false
  if (isEdit.value && props.editing) {
    ok = await store.updateCarrera(props.editing.id_carrera, form.value)
  } else {
    ok = await store.createCarrera(form.value)
  }
  submitting.value = false
  if (ok) {
    emit('saved')
    emit('update:modelValue', false)
  }
}

function close() { emit('update:modelValue', false) }
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="modelValue" class="fixed inset-0 z-50 flex items-center justify-center p-4" @click.self="close">
        <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" @click="close" />

        <div class="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">
          <!-- Header -->
          <div class="flex items-center justify-between px-6 py-5 border-b border-gray-100">
            <div class="flex items-center gap-3">
              <span class="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </span>
              <h2 class="text-lg font-semibold text-gray-800">{{ title }}</h2>
            </div>
            <button @click="close"
              class="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
              <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- Body -->
          <div class="px-6 py-5 space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">
                Nombre de la Carrera <span class="text-red-500">*</span>
              </label>
              <input v-model="form.nombre_carrera" type="text" placeholder="Ej: Filosofía"
                class="w-full px-3 py-2 rounded-lg border text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
                :class="errors.nombre ? 'border-red-400 bg-red-50' : 'border-gray-300 focus:border-indigo-400'" />
              <p v-if="errors.nombre" class="mt-1 text-xs text-red-500">{{ errors.nombre }}</p>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">
                Código <span class="text-red-500">*</span>
              </label>
              <input v-model="form.codigo_carrera" type="text" placeholder="Ej: cf123-2026"
                class="w-full px-3 py-2 rounded-lg border text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
                :class="errors.codigo ? 'border-red-400 bg-red-50' : 'border-gray-300 focus:border-indigo-400'" />
              <p v-if="errors.codigo" class="mt-1 text-xs text-red-500">{{ errors.codigo }}</p>
            </div>
          </div>

          <!-- Footer -->
          <div class="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50/60">
            <button @click="close"
              class="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
              Cancelar
            </button>
            <button @click="submit" :disabled="submitting"
              class="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-60 transition-colors">
              <svg v-if="submitting" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              {{ submitting ? 'Guardando…' : (isEdit ? 'Guardar cambios' : 'Crear carrera') }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
</style>