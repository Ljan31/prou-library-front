<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import type { Biblioteca, CreateBibliotecaPayload } from '@/services/bibliotecas.service'
import { useBibliotecasStore } from '@/stores/bibliotecas.store'
// ─── Props / Emits ────────────────────────────────────────────────────────
const props = defineProps<{
  modelValue: boolean
  editing: Biblioteca | null
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void
  (e: 'saved'): void
}>()

const store = useBibliotecasStore()
// ─── Form state ───────────────────────────────────────────────────────────
const form = ref<CreateBibliotecaPayload>({
  nombre: '',
  tipoBiblioteca: 'CARRERA',
  carreraId: null,
  direccion: '',
  telefono: '',
  email: '',
  horario_atencion: '',
  encargadoId: null,
  estado: 'ACTIVA'
})
const errors = ref<Record<string, string>>({})

const isEdit = computed(() => !!props.editing)
const title = computed(() => isEdit.value ? 'Editar Biblioteca' : 'Nueva Biblioteca')
const logoFile = ref<File | null>(null)
const logoPreview = ref<string | null>(null)
// ─── Watchers ─────────────────────────────────────────────────────────────
watch(() => props.modelValue, open => {
  if (open) {
    errors.value = {}
    logoFile.value = null
    logoPreview.value = null
    if (props.editing) {
      form.value = {
        nombre: props.editing.nombre,
        tipoBiblioteca: props.editing.tipoBiblioteca,
        carreraId: props.editing.carrera?.id_carrera ?? null,
        direccion: props.editing.direccion ?? '',
        telefono: props.editing.telefono ?? '',
        email: props.editing.email ?? '',
        horario_atencion: props.editing.horario_atencion ?? '',
        encargadoId: null,
        estado: props.editing.estado
      }
      if (props.editing?.logoUrl) {
        logoPreview.value = props.editing.logoUrl
      }
    } else {
      form.value = {
        nombre: '', tipoBiblioteca: 'CARRERA', carreraId: null,
        direccion: '', telefono: '', email: '',
        horario_atencion: '', encargadoId: null, estado: 'ACTIVA'
      }
    }
  }
})

// ─── Validation ───────────────────────────────────────────────────────────
function validate(): boolean {
  errors.value = {}
  if (!form.value.nombre.trim())
    errors.value.nombre = 'El nombre es requerido'
  if (form.value.tipoBiblioteca === 'CARRERA' && !form.value.carreraId)
    errors.value.carreraId = 'Debe seleccionar una carrera para este tipo'
  if (form.value.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.value.email))
    errors.value.email = 'Email inválido'
  return Object.keys(errors.value).length === 0
}

function onLogoChange(e: Event) {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]

  if (!file) return

  logoFile.value = file
  logoPreview.value = URL.createObjectURL(file)
}
// ─── Submit ───────────────────────────────────────────────────────────────
const submitting = ref(false)

async function submit() {
  if (!validate()) return
  submitting.value = true
  let ok = false
  if (isEdit.value && props.editing) {
    ok = await store.updateBiblioteca(props.editing.id_biblioteca, form.value, logoFile.value)
  } else {
    ok = await store.createBiblioteca(form.value, logoFile.value)
  }
  submitting.value = false
  if (ok) {
    emit('saved')
    emit('update:modelValue', false)
  }
}

function close() {
  emit('update:modelValue', false)
}
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="modelValue" class="fixed inset-0 z-50 flex items-center justify-center p-4" @click.self="close">
        <!-- Backdrop -->
        <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" @click="close" />

        <!-- Panel -->
        <div
          class="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
          <!-- Header -->
          <div class="flex items-center justify-between px-6 py-5 border-b border-gray-100">
            <div class="flex items-center gap-3">
              <span class="w-8 h-8 rounded-lg bg-primary-50 flex items-center justify-center text-primary-600">
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path v-if="isEdit" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  <path v-else stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
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
          <div class="flex-1 overflow-y-auto px-6 py-5 space-y-4">
            <!-- Nombre -->
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">

              <!-- Nombre -->
              <div class="md:col-span-2">
                <label class="block text-sm font-medium text-gray-700 mb-1">
                  Nombre <span class="text-red-500">*</span>
                </label>
                <input v-model="form.nombre" type="text" placeholder="Ej: Biblioteca Central FHCE"
                  class="w-full px-3 py-2 rounded-lg border text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500"
                  :class="errors.nombre ? 'border-red-400 bg-red-50' : 'border-gray-300 focus:border-primary-400'" />
                <p v-if="errors.nombre" class="mt-1 text-xs text-red-500">
                  {{ errors.nombre }}
                </p>
              </div>

              <!-- LOGO -->
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">
                  Logo
                </label>

                <label
                  class="flex flex-col items-center justify-center gap-2 px-3 py-4 border-2 border-dashed rounded-xl cursor-pointer transition-colors h-full"
                  :class="logoFile
                    ? 'border-emerald-300 bg-emerald-50'
                    : 'border-gray-200 hover:border-primary-300 hover:bg-primary-50'">

                  <!-- Preview -->
                  <div v-if="logoPreview" class="w-14 h-14 rounded-lg overflow-hidden">
                    <img :src="logoPreview" class="w-full h-full object-cover" />
                  </div>

                  <!-- Icon -->
                  <svg v-else class="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                      d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                  </svg>

                  <!-- Text -->
                  <span class="text-[11px] text-center"
                    :class="logoFile ? 'text-emerald-700 font-medium' : 'text-gray-500'">
                    {{ logoFile ? logoFile.name : 'Subir logo' }}
                  </span>

                  <input type="file" accept="image/*" class="sr-only" @change="onLogoChange" />
                  <button v-if="logoPreview" @click="logoFile = null; logoPreview = null"
                    class="text-xs text-red-500 mt-1">
                    Quitar logo
                  </button>
                </label>

                <p v-if="props.editing?.logoUrl && !logoFile" class="text-[11px] text-gray-400 mt-1 text-center">
                  Logo actual guardado
                </p>
              </div>

            </div>

            <!-- Tipo + Estado en row -->
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                <select v-model="form.tipoBiblioteca"
                  class="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-400">
                  <option value="CENTRAL">Central</option>
                  <option value="CARRERA">Carrera</option>
                  <option value="ESPECIALIZADA">Especializada</option>
                </select>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Estado</label>
                <select v-model="form.estado"
                  class="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-400">
                  <option value="ACTIVA">Activa</option>
                  <option value="INACTIVA">Inactiva</option>
                </select>
              </div>
            </div>

            <!-- Carrera (solo si tipo=CARRERA) -->
            <Transition name="fade">
              <div v-if="form.tipoBiblioteca === 'CARRERA'">
                <label class="block text-sm font-medium text-gray-700 mb-1">
                  Carrera <span class="text-red-500">*</span>
                </label>
                <select v-model="form.carreraId"
                  class="w-full px-3 py-2 rounded-lg border text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500"
                  :class="errors.carreraId ? 'border-red-400 bg-red-50' : 'border-gray-300 focus:border-primary-400'">
                  <option :value="null" disabled>Seleccionar carrera…</option>
                  <option v-for="c in store.carreras" :key="c.id_carrera" :value="c.id_carrera">
                    {{ c.nombre_carrera }} ({{ c.codigo_carrera }})
                  </option>
                </select>
                <p v-if="errors.carreraId" class="mt-1 text-xs text-red-500">{{ errors.carreraId }}</p>
              </div>
            </Transition>

            <!-- Dirección -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Dirección</label>
              <input v-model="form.direccion" type="text" placeholder="Av. ..."
                class="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-400" />
            </div>

            <!-- Teléfono + Email -->
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
                <input v-model="form.telefono" type="text" placeholder="591..."
                  class="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-400" />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input v-model="form.email" type="email" placeholder="bib@fhce.edu"
                  class="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  :class="errors.email ? 'border-red-400 bg-red-50' : 'border-gray-300 focus:border-primary-400'" />
                <p v-if="errors.email" class="mt-1 text-xs text-red-500">{{ errors.email }}</p>
              </div>
            </div>

            <!-- Horario -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Horario de Atención</label>
              <input v-model="form.horario_atencion" type="text" placeholder="Lunes a Viernes 8:00 - 18:00"
                class="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-400" />
            </div>
          </div>

          <!-- Footer -->
          <div class="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50/60">
            <button @click="close"
              class="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
              Cancelar
            </button>
            <button @click="submit" :disabled="submitting"
              class="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors">
              <svg v-if="submitting" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              {{ submitting ? 'Guardando…' : (isEdit ? 'Guardar cambios' : 'Crear biblioteca') }}
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

.modal-enter-active .relative,
.modal-leave-active .relative {
  transition: transform 0.2s ease;
}

.modal-enter-from .relative {
  transform: scale(0.96) translateY(8px);
}

.modal-leave-to .relative {
  transform: scale(0.96) translateY(8px);
}

.fade-enter-active,
.fade-leave-active {
  transition: all 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>