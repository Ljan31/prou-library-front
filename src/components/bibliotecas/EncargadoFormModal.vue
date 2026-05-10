<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useUiStore } from '@/stores/ui.store'
import { useUsers } from '@/composables/useUsers'
import { useAuxAssign } from '@/composables/useAuxAssign'
import { bibliotecasService } from '@/services/bibliotecas.service'
import type { BibliotecaResponse, EncargadoResponse } from '@/services/bibliotecas.service'
import type { UserResponse } from '@/services/user.service'
import type { CarreraBasic } from '@/services/estudiante.service'

interface EncargadoEntry {
  bib: BibliotecaResponse
  encargado: EncargadoResponse
}

const props = defineProps<{
  modelValue: boolean
  mode: 'create' | 'edit'
  user: UserResponse | null
  isEstudiante: boolean
  isBibliotecario: boolean
  detailCarreras: CarreraBasic[]
  editEntry?: EncargadoEntry | null
  encargadoEntries?: EncargadoEntry[]
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  assigned: []
  updated: []
}>()

const ui = useUiStore()
const { allBibliotecas, refreshBibliotecas } = useUsers()
const aux = useAuxAssign()
aux.watchCarrera()

// ─── Reset state when modal opens ────────────────────────────────────────
watch(() => props.modelValue, (open) => {
  if (!open) return
  aux.resetAux()
  editRespaldoFile.value = null
  editRespaldoPreview.value = ''
  editLoading.value = false
  editError.value = ''

  // Pre-load bibliotecas for bibliotecarios in create mode
  if (props.mode === 'create' && props.isBibliotecario) {
    aux.loadAllBibliotecasForPicker()
  }
})

function close() { emit('update:modelValue', false) }

// ─── Library options for the selector ────────────────────────────────────
const auxBibliotecaOptions = computed(() => {
  if (props.isBibliotecario) {
    return aux.auxBibliotecas.value.length ? aux.auxBibliotecas.value : allBibliotecas.value
  }
  return aux.auxBibliotecas.value // filtered by carrera
})

// ─── Duplicate check (create mode) ───────────────────────────────────────
const yaEstaAsignado = computed(() => {
  if (props.mode !== 'create' || !props.user || !aux.auxBibliotecaId.value) return false
  const bibId = Number(aux.auxBibliotecaId.value)
  return (props.encargadoEntries ?? []).some(e => e.bib.id_biblioteca === bibId)
})

const mensajeDuplicado = computed(() => {
  if (!yaEstaAsignado.value) return ''
  const entry = (props.encargadoEntries ?? []).find(
    e => e.bib.id_biblioteca === Number(aux.auxBibliotecaId.value)
  )
  return `Este usuario ya es ${entry?.encargado.rol ?? 'encargado'} en esta biblioteca`
})

// ─── CREATE: assign encargado ─────────────────────────────────────────────
async function handleAssign() {
  if (!props.user) return
  const needsCarrera = props.isEstudiante
  const ok = await aux.assignAux(props.user, needsCarrera)
  if (ok) {
    emit('assigned')
    close()
  }
}

// ─── EDIT: update resolución file ────────────────────────────────────────
const editRespaldoFile = ref<File | null>(null)
const editRespaldoPreview = ref<string>('')
const editLoading = ref(false)
const editError = ref('')

function onEditFileSelected(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  editRespaldoFile.value = file
  editRespaldoPreview.value = URL.createObjectURL(file)
}

async function handleUpdate() {
  if (!props.user || !props.editEntry) return
  if (!editRespaldoFile.value) {
    editError.value = 'Selecciona una imagen o PDF de respaldo'
    return
  }
  editLoading.value = true
  editError.value = ''
  try {
    await bibliotecasService.uploadEncargadoImagen(
      props.editEntry.bib.id_biblioteca,
      props.user.id_usuario,
      editRespaldoFile.value
    )
    await refreshBibliotecas()
    ui.toast.success('Respaldo actualizado', `${props.editEntry.bib.nombre}`)
    emit('updated')
    close()
  } catch (e: unknown) {
    editError.value = e instanceof Error ? e.message : 'No se pudo actualizar el respaldo'
  } finally {
    editLoading.value = false
  }
}

// ─── Computed title ───────────────────────────────────────────────────────
const modalTitle = computed(() => {
  if (props.mode === 'edit') return 'Actualizar respaldo'
  return props.isBibliotecario ? 'Asignar encargado' : 'Auxiliar de biblioteca'
})

const safeNombre = computed(() =>
  props.user?.persona?.nombreCompleto ?? props.user?.username ?? ''
)
</script>

<template>
  <Transition name="fade">
    <div v-if="modelValue" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      @click.self="close">
      <div class="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden">

        <!-- Header -->
        <div class="px-6 pt-6 pb-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 class="text-base font-semibold text-slate-900">{{ modalTitle }}</h3>
            <p class="text-xs text-slate-500 mt-0.5">{{ safeNombre }}</p>
          </div>
          <button
            class="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all"
            @click="close">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M6 18L18 6M6 6l12 12" stroke-linecap="round" />
            </svg>
          </button>
        </div>

        <!-- ══ MODO CREATE ══ -->
        <template v-if="mode === 'create'">
          <div class="p-6 space-y-4">

            <!-- Banner -->
            <div
              class="flex items-start gap-2.5 p-3 rounded-lg bg-amber-50 border border-amber-100 text-xs text-amber-700">
              <svg class="w-4 h-4 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                stroke-width="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span v-if="isEstudiante">
                El estudiante será asignado como <strong>encargado auxiliar</strong> en una biblioteca de su carrera.
              </span>
              <span v-else>
                El bibliotecario será asignado como <strong>encargado</strong> de la biblioteca seleccionada.
              </span>
            </div>

            <!-- Carrera (solo estudiantes) -->
            <div v-if="isEstudiante">
              <label class="block text-xs font-medium text-slate-600 mb-1.5">
                Carrera del estudiante <span class="text-red-500">*</span>
              </label>
              <select v-model="aux.auxCarreraId.value"
                class="w-full h-10 px-3 text-sm rounded-lg border border-slate-200 bg-slate-50 outline-none transition-all focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400">
                <option value="">{{ detailCarreras.length ? 'Seleccionar carrera…' : 'Sin carreras inscritas' }}
                </option>
                <option v-for="c in detailCarreras" :key="c.id_carrera" :value="c.id_carrera">
                  {{ c.nombre_carrera }}
                </option>
              </select>
            </div>

            <!-- Biblioteca -->
            <div>
              <label class="block text-xs font-medium text-slate-600 mb-1.5">
                Biblioteca <span class="text-red-500">*</span>
              </label>
              <div v-if="aux.auxBibliotecasLoading.value" class="flex items-center gap-2 text-xs text-slate-400 h-10">
                <svg class="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Cargando bibliotecas…
              </div>
              <select v-else v-model="aux.auxBibliotecaId.value" :disabled="isEstudiante && !aux.auxCarreraId.value"
                class="w-full h-10 px-3 text-sm rounded-lg border border-slate-200 bg-slate-50 outline-none transition-all focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400 disabled:opacity-50 disabled:cursor-not-allowed">
                <option value="">
                  {{ isEstudiante && !aux.auxCarreraId.value
                    ? 'Selecciona una carrera primero'
                    : auxBibliotecaOptions.length ? 'Seleccionar biblioteca…' : 'Sin bibliotecas disponibles' }}
                </option>
                <option v-for="b in auxBibliotecaOptions" :key="b.id_biblioteca" :value="b.id_biblioteca">
                  {{ b.nombre }}
                </option>
              </select>

              <!-- Mensaje de duplicado -->
              <p v-if="yaEstaAsignado" class="mt-1.5 text-xs text-amber-600 flex items-center gap-1.5">
                <svg class="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  stroke-width="2">
                  <path
                    d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
                    stroke-linecap="round" stroke-linejoin="round" />
                </svg>
                {{ mensajeDuplicado }}
              </p>

              <!-- Encargados actuales de la biblioteca seleccionada -->
              <template v-if="aux.auxBibliotecaId.value && aux.selectedBib()">
                <div v-if="aux.selectedBib()!.encargados?.length"
                  class="mt-2 p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                  <p class="text-xs text-slate-400 mb-1.5 font-medium">Encargados actuales</p>
                  <div class="flex flex-wrap gap-1.5">
                    <span v-for="enc in aux.selectedBib()!.encargados" :key="enc.id_usuario"
                      class="text-xs px-2 py-0.5 rounded-full font-medium ring-1"
                      :class="enc.rol === 'PRINCIPAL' ? 'bg-emerald-100 text-emerald-700 ring-emerald-200' : 'bg-slate-100 text-slate-600 ring-slate-200'">{{
                        enc.nombreCompleto }} · {{ enc.rol }}</span>
                  </div>
                </div>
              </template>
            </div>

            <!-- Resolución -->
            <div>
              <label class="block text-xs font-medium text-slate-600 mb-1.5">Imagen de resolución</label>
              <div class="flex items-center gap-3">
                <label
                  class="flex items-center gap-2 cursor-pointer px-3 py-2 rounded-lg border border-amber-200 bg-white hover:bg-amber-50 transition-colors text-xs text-slate-600 font-medium">
                  <svg class="w-4 h-4 text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                    stroke-width="2">
                    <path
                      d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
                      stroke-linecap="round" stroke-linejoin="round" />
                  </svg>
                  {{ aux.auxResolucionFile.value ? aux.auxResolucionFile.value.name : 'Subir imagen / PDF' }}
                  <input type="file" accept="image/*,.pdf" class="hidden" @change="aux.onFileSelected" />
                </label>
                <img v-if="aux.auxResolucionPreview.value" :src="aux.auxResolucionPreview.value"
                  class="w-10 h-10 rounded-lg object-cover border border-amber-200" alt="Preview" />
              </div>
              <p class="text-xs text-slate-400 mt-1">Resolución de designación (opcional)</p>
            </div>

            <!-- Feedback -->
            <p v-if="aux.auxError.value" class="text-xs text-red-500 flex items-center gap-1.5">
              <svg class="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              {{ aux.auxError.value }}
            </p>
          </div>

          <div class="px-6 pb-6 flex gap-3 justify-end">
            <button class="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              @click="close">Cancelar</button>
            <button
              class="px-4 py-2 text-sm font-medium bg-amber-500 text-white rounded-lg hover:bg-amber-400 transition-colors disabled:opacity-50 flex items-center gap-2"
              :disabled="aux.auxLoading.value || !aux.auxBibliotecaId.value || yaEstaAsignado" @click="handleAssign">
              <svg v-if="aux.auxLoading.value" class="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              {{ aux.auxLoading.value ? 'Asignando…' : 'Confirmar asignación' }}
            </button>
          </div>
        </template>

        <!-- ══ MODO EDIT ══ -->
        <template v-else-if="mode === 'edit' && editEntry">
          <div class="p-6 space-y-4">

            <!-- Biblioteca info (read-only) -->
            <div class="flex items-center gap-3 p-3 rounded-xl border border-slate-200 bg-slate-50">
              <div class="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                :class="editEntry.encargado.rol === 'PRINCIPAL' ? 'bg-emerald-100' : 'bg-slate-100'">
                <svg class="w-4 h-4"
                  :class="editEntry.encargado.rol === 'PRINCIPAL' ? 'text-emerald-600' : 'text-slate-500'"
                  viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                  <path
                    d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75z"
                    stroke-linecap="round" stroke-linejoin="round" />
                </svg>
              </div>
              <div class="min-w-0">
                <p class="text-sm font-semibold text-slate-900 truncate">{{ editEntry.bib.nombre }}</p>
                <div class="flex items-center gap-2 mt-0.5">
                  <span class="text-xs px-2 py-0.5 rounded-full font-medium ring-1" :class="editEntry.encargado.rol === 'PRINCIPAL'
                    ? 'bg-emerald-100 text-emerald-700 ring-emerald-200'
                    : 'bg-slate-100 text-slate-600 ring-slate-200'">{{ editEntry.encargado.rol }}</span>
                  <span v-if="editEntry.bib.carrera" class="text-xs text-slate-400 truncate">
                    {{ editEntry.bib.carrera.nombre_carrera }}
                  </span>
                </div>
              </div>
            </div>

            <!-- Respaldo actual -->
            <div v-if="editEntry.encargado.respaldoUrl"
              class="flex items-center gap-3 p-3 rounded-lg border border-indigo-100 bg-indigo-50">
              <svg class="w-4 h-4 text-indigo-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                stroke-width="2">
                <path
                  d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
                  stroke-linecap="round" stroke-linejoin="round" />
              </svg>
              <div class="flex-1 min-w-0">
                <p class="text-xs font-medium text-indigo-700">Resolución actual</p>
                <a :href="editEntry.encargado.respaldoUrl" target="_blank"
                  class="text-xs text-indigo-500 hover:text-indigo-700 underline truncate block">Ver documento</a>
              </div>
            </div>
            <div v-else class="text-xs text-slate-400 italic p-3 rounded-lg border border-dashed border-slate-200">
              Sin resolución registrada
            </div>

            <!-- Nuevo respaldo -->
            <div>
              <label class="block text-xs font-medium text-slate-600 mb-1.5">
                {{ editEntry.encargado.respaldoUrl ? 'Reemplazar resolución' : 'Subir resolución' }}
                <span class="text-red-500">*</span>
              </label>
              <div class="flex items-center gap-3">
                <label
                  class="flex items-center gap-2 cursor-pointer px-3 py-2 rounded-lg border border-amber-200 bg-white hover:bg-amber-50 transition-colors text-xs text-slate-600 font-medium flex-1"
                  :class="editError && !editRespaldoFile ? 'border-red-300 bg-red-50' : 'border-amber-200'">
                  <svg class="w-4 h-4 text-amber-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                    stroke-width="2">
                    <path
                      d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
                      stroke-linecap="round" stroke-linejoin="round" />
                  </svg>
                  <span class="truncate">{{ editRespaldoFile ? editRespaldoFile.name : 'Seleccionar imagen o PDF'
                  }}</span>
                  <input type="file" accept="image/*,.pdf" class="hidden" @change="onEditFileSelected" />
                </label>
                <img v-if="editRespaldoPreview" :src="editRespaldoPreview"
                  class="w-10 h-10 rounded-lg object-cover border border-amber-200 shrink-0" alt="Preview" />
              </div>
            </div>

            <!-- Error -->
            <p v-if="editError" class="text-xs text-red-500 flex items-center gap-1.5">
              <svg class="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              {{ editError }}
            </p>
          </div>

          <div class="px-6 pb-6 flex gap-3 justify-end">
            <button class="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              @click="close">Cancelar</button>
            <button
              class="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 transition-colors disabled:opacity-50 flex items-center gap-2"
              :disabled="editLoading || !editRespaldoFile" @click="handleUpdate">
              <svg v-if="editLoading" class="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              {{ editLoading ? 'Guardando…' : 'Guardar resolución' }}
            </button>
          </div>
        </template>

      </div>
    </div>
  </Transition>
</template>