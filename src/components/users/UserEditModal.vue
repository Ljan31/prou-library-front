<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue'
import { useUiStore } from '@/stores/ui.store'
import { usePermissions } from '@/composables/usePermissions'
import { useUsers } from '@/composables/useUsers'
import { userService } from '@/services/user.service'
import { bibliotecasService } from '@/services/bibliotecas.service'
import { carreraService } from '@/services/estudiante.service'
import type { UserResponse, UpdateUserPayload } from '@/services/user.service'
import type { BibliotecaResponse } from '@/services/biblioteca.service'
import type { CarreraBasic } from '@/services/estudiante.service'

const props = defineProps<{
  modelValue: boolean
  user: UserResponse | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  updated: [user: UserResponse]
}>()

const ui = useUiStore()
const { isAdmin, isStaff } = usePermissions()
const { patchUser, allBibliotecas } = useUsers()

const loading = ref(false)
const form = reactive({
  nombre: '', apellido_pat: '', apellido_mat: '', celular: '', enabled: true,
})
const errors = reactive<Record<string, string>>({})

// ── Datos personales del usuario ───────────────────────────────────────────
watch(() => props.user, (u) => {
  if (!u) return
  Object.assign(form, {
    nombre: u.persona?.nombre ?? '',
    apellido_pat: u.persona?.apellido_pat ?? '',
    apellido_mat: u.persona?.apellido_mat ?? '',
    celular: u.persona?.celular ?? '',
    enabled: u.enabled,
  })
  Object.keys(errors).forEach(k => delete errors[k])
  // Load carreras if student
  if (u.roles?.some(r => r.name === 'ROLE_ESTUDIANTE')) loadUserCarreras(u.id_usuario)
  else userCarreras.value = []
}, { immediate: true })

function close() { emit('update:modelValue', false) }

function validate(): boolean {
  Object.keys(errors).forEach(k => delete errors[k])
  if (!form.nombre.trim()) errors.nombre = 'Requerido'
  if (!form.apellido_pat.trim()) errors.apellido_pat = 'Requerido'
  return Object.keys(errors).length === 0
}

async function handleEdit() {
  if (!props.user || !validate()) return
  loading.value = true
  try {
    const payload: UpdateUserPayload = {
      nombre: form.nombre,
      apellido_pat: form.apellido_pat,
      apellido_mat: form.apellido_mat,
      celular: form.celular,
      enabled: form.enabled,
    }
    const res = await userService.update(props.user.id_usuario, payload)
    const raw = res.data as any
    const updated: UserResponse = raw?.data ?? raw
    if (!updated?.id_usuario) throw new Error('Respuesta inesperada del servidor')
    patchUser(updated)
    close()
    emit('updated', updated)
    ui.toast.success('Usuario actualizado', updated.persona?.nombreCompleto ?? updated.username)
  } catch (e: unknown) {
    ui.toast.error('Error', e instanceof Error ? e.message : 'No se pudo actualizar')
  } finally { loading.value = false }
}

// ══════════════════════════════════════════════════════════════════════════
// SECCIÓN: Asignar auxiliar de biblioteca (solo visible si es estudiante
// y el usuario logueado es admin o bibliotecario)
// ══════════════════════════════════════════════════════════════════════════
const isTargetEstudiante = computed(() =>
  props.user?.roles?.some(r => r.name === 'ROLE_ESTUDIANTE') ?? false
)
const showAuxSection = computed(() => isStaff.value && isTargetEstudiante.value)

// Carreras del estudiante (para filtrar bibliotecas)
const userCarreras = ref<CarreraBasic[]>([])
const carrerasLoading = ref(false)

async function loadUserCarreras(usuarioId: number) {
  carrerasLoading.value = true
  try {
    const res = await carreraService.getByUsuario(usuarioId)
    const raw = res.data as any
    userCarreras.value = Array.isArray(raw) ? raw : (raw?.data ?? [])
  } catch { /* silent */ } finally { carrerasLoading.value = false }
}

// Aux assignment form
const auxCarreraId = ref<number | ''>('')
const auxBibliotecaId = ref<number | ''>('')
const auxBibliotecas = ref<BibliotecaResponse[]>([])
const auxBibliotecasLoading = ref(false)
const auxLoading = ref(false)
const auxError = ref('')
const auxSuccess = ref(false)

watch(auxCarreraId, async (carreraId) => {
  auxBibliotecaId.value = ''
  auxBibliotecas.value = []
  auxError.value = ''
  auxSuccess.value = false
  if (!carreraId) return
  auxBibliotecasLoading.value = true
  try {
    // Use cached global list first
    const local = allBibliotecas.value.filter(b => b.carrera?.id_carrera === Number(carreraId))
    if (local.length) {
      auxBibliotecas.value = local
    } else {
      const res = await bibliotecasService.getByCarrera(Number(carreraId))
      const raw = res.data as any
      auxBibliotecas.value = Array.isArray(raw) ? raw : (raw?.data ?? [])
    }
  } catch { /* silent */ } finally { auxBibliotecasLoading.value = false }
})

// Reset aux form when modal opens/closes
watch(() => props.modelValue, (v) => {
  if (!v) {
    auxCarreraId.value = ''
    auxBibliotecaId.value = ''
    auxBibliotecas.value = []
    auxError.value = ''
    auxSuccess.value = false
  }
})

async function handleAssignAux() {
  auxError.value = ''
  auxSuccess.value = false
  if (!auxCarreraId.value) { auxError.value = 'Selecciona una carrera'; return }
  if (!auxBibliotecaId.value) { auxError.value = 'Selecciona una biblioteca'; return }
  if (!props.user) return
  auxLoading.value = true
  try {
    await bibliotecasService.assignEncargados(Number(auxBibliotecaId.value), [props.user.id_usuario])
    const bibNombre = auxBibliotecas.value.find(b => b.id_biblioteca === Number(auxBibliotecaId.value))?.nombre ?? ''
    auxSuccess.value = true
    auxError.value = ''
    ui.toast.success(
      'Auxiliar asignado',
      `${props.user.persona?.nombreCompleto ?? props.user.username} es auxiliar en ${bibNombre}`
    )
    // Reset picker after success
    auxCarreraId.value = ''
    auxBibliotecaId.value = ''
    auxBibliotecas.value = []
  } catch (e: unknown) {
    auxError.value = e instanceof Error ? e.message : 'No se pudo asignar como auxiliar'
  } finally { auxLoading.value = false }
}
</script>

<template>
  <Transition name="fade">
    <div v-if="modelValue" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      @click.self="close">
      <div class="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] flex flex-col">

        <!-- Header -->
        <div class="px-6 pt-6 pb-4 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div>
            <h3 class="text-lg font-semibold text-slate-900">Editar usuario</h3>
            <p class="text-xs text-slate-500 mt-0.5 font-mono">@{{ user?.username }}</p>
          </div>
          <button
            class="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all"
            @click="close">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M6 18L18 6M6 6l12 12" stroke-linecap="round" />
            </svg>
          </button>
        </div>

        <!-- Body (scrollable) -->
        <div class="overflow-y-auto flex-1 p-6 space-y-5">

          <!-- ── Datos personales ── -->
          <div class="space-y-3">
            <p class="text-xs font-semibold text-slate-400 uppercase tracking-wider">Datos personales</p>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-xs font-medium text-slate-600 mb-1">Nombre <span
                    class="text-red-500">*</span></label>
                <input v-model="form.nombre" type="text"
                  class="w-full h-9 px-3 text-sm rounded-lg border outline-none transition-all focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                  :class="errors.nombre ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-slate-50'"
                  @input="delete errors.nombre" />
                <p v-if="errors.nombre" class="text-xs text-red-500 mt-0.5">{{ errors.nombre }}</p>
              </div>
              <div>
                <label class="block text-xs font-medium text-slate-600 mb-1">Ap. Paterno <span
                    class="text-red-500">*</span></label>
                <input v-model="form.apellido_pat" type="text"
                  class="w-full h-9 px-3 text-sm rounded-lg border outline-none transition-all focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                  :class="errors.apellido_pat ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-slate-50'"
                  @input="delete errors.apellido_pat" />
                <p v-if="errors.apellido_pat" class="text-xs text-red-500 mt-0.5">{{ errors.apellido_pat }}</p>
              </div>
              <div>
                <label class="block text-xs font-medium text-slate-600 mb-1">Ap. Materno</label>
                <input v-model="form.apellido_mat" type="text"
                  class="w-full h-9 px-3 text-sm rounded-lg border border-slate-200 bg-slate-50 outline-none transition-all focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400" />
              </div>
              <div>
                <label class="block text-xs font-medium text-slate-600 mb-1">Celular</label>
                <input v-model="form.celular" type="text"
                  class="w-full h-9 px-3 text-sm rounded-lg border border-slate-200 bg-slate-50 outline-none transition-all focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400" />
              </div>
            </div>

            <!-- Toggle estado -->
            <div class="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-200">
              <div>
                <p class="text-sm font-medium text-slate-700">Estado de cuenta</p>
                <p class="text-xs text-slate-400">
                  {{ form.enabled ? 'El usuario puede iniciar sesión' : 'Sin acceso al sistema' }}
                </p>
              </div>
              <button type="button" class="relative w-11 h-6 rounded-full transition-colors duration-200"
                :class="form.enabled ? 'bg-indigo-600' : 'bg-slate-200'" @click="form.enabled = !form.enabled">
                <span
                  class="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200"
                  :class="form.enabled ? 'translate-x-5' : 'translate-x-0'" />
              </button>
            </div>
          </div>

          <!-- ── Sección: Auxiliar de biblioteca (solo estudiantes, solo staff) ── -->
          <Transition name="slide-up">
            <div v-if="showAuxSection" class="rounded-xl border border-amber-200 bg-amber-50/60 p-4 space-y-3">
              <div class="flex items-center gap-2">
                <div class="w-6 h-6 rounded-md bg-amber-100 flex items-center justify-center shrink-0">
                  <svg class="w-3.5 h-3.5 text-amber-600" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                    stroke-width="2">
                    <path
                      d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75z"
                      stroke-linecap="round" stroke-linejoin="round" />
                  </svg>
                </div>
                <p class="text-xs font-semibold text-amber-700 uppercase tracking-wider">Auxiliar de biblioteca</p>
              </div>

              <!-- Info banner -->
              <p class="text-xs text-amber-600 leading-relaxed">
                Asigna a este estudiante como encargado auxiliar en una biblioteca de su carrera.
              </p>

              <!-- Carreras del estudiante -->
              <div>
                <label class="block text-xs font-medium text-slate-600 mb-1">Carrera del estudiante</label>
                <div v-if="carrerasLoading" class="flex items-center gap-1.5 text-xs text-slate-400 h-9">
                  <svg class="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Cargando carreras…
                </div>
                <select v-else v-model="auxCarreraId"
                  class="w-full h-9 px-3 text-sm rounded-lg border border-amber-200 bg-white text-slate-700 outline-none transition-all focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400">
                  <option value="">{{ userCarreras.length ? 'Seleccionar carrera…' : 'Sin carreras inscritas' }}
                  </option>
                  <option v-for="c in userCarreras" :key="c.id_carrera" :value="c.id_carrera">
                    {{ c.nombre_carrera }}
                  </option>
                </select>
              </div>

              <!-- Bibliotecas de esa carrera -->
              <div>
                <label class="block text-xs font-medium text-slate-600 mb-1">Biblioteca</label>
                <div v-if="auxBibliotecasLoading" class="flex items-center gap-1.5 text-xs text-slate-400 h-9">
                  <svg class="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Buscando bibliotecas…
                </div>
                <select v-else v-model="auxBibliotecaId" :disabled="!auxCarreraId"
                  class="w-full h-9 px-3 text-sm rounded-lg border border-amber-200 bg-white text-slate-700 outline-none transition-all focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400 disabled:opacity-50 disabled:cursor-not-allowed">
                  <option value="">
                    {{ !auxCarreraId
                      ? 'Selecciona una carrera primero'
                      : auxBibliotecas.length
                        ? 'Seleccionar biblioteca…'
                        : 'Sin bibliotecas para esta carrera' }}
                  </option>
                  <option v-for="b in auxBibliotecas" :key="b.id_biblioteca" :value="b.id_biblioteca">
                    {{ b.nombre }}
                  </option>
                </select>
              </div>

              <!-- Encargados actuales -->
              <template v-if="auxBibliotecaId">
                <div v-if="auxBibliotecas.find(b => b.id_biblioteca === Number(auxBibliotecaId))?.encargados?.length"
                  class="p-2.5 rounded-lg bg-white/70 border border-amber-100">
                  <p class="text-xs text-slate-400 mb-1.5 font-medium">Encargados actuales</p>
                  <div class="flex flex-wrap gap-1.5">
                    <span
                      v-for="enc in auxBibliotecas.find(b => b.id_biblioteca === Number(auxBibliotecaId))?.encargados"
                      :key="enc.id_usuario" class="text-xs px-2 py-0.5 rounded-full font-medium"
                      :class="enc.rol === 'PRINCIPAL' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'">
                      {{ enc.nombreCompleto }} · {{ enc.rol }}
                    </span>
                  </div>
                </div>
              </template>

              <!-- Error / success -->
              <p v-if="auxError" class="text-xs text-red-500">{{ auxError }}</p>
              <div v-if="auxSuccess" class="flex items-center gap-1.5 text-xs text-emerald-600">
                <svg class="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  stroke-width="2">
                  <path d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" stroke-linecap="round"
                    stroke-linejoin="round" />
                </svg>
                Auxiliar asignado correctamente
              </div>

              <!-- Assign button -->
              <button
                class="w-full h-9 rounded-lg bg-amber-500 text-white text-sm font-medium hover:bg-amber-400 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                :disabled="auxLoading || !auxBibliotecaId || !auxCarreraId" @click="handleAssignAux">
                <svg v-if="auxLoading" class="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <svg v-else class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path
                    d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18"
                    stroke-linecap="round" stroke-linejoin="round" />
                </svg>
                {{ auxLoading ? 'Asignando…' : 'Asignar como auxiliar' }}
              </button>
            </div>
          </Transition>

        </div>

        <!-- Footer: guardar datos personales -->
        <div class="px-6 py-4 border-t border-slate-100 flex gap-3 justify-end shrink-0">
          <button class="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            @click="close">Cancelar</button>
          <button
            class="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 transition-colors disabled:opacity-50 flex items-center gap-2"
            :disabled="loading" @click="handleEdit">
            <svg v-if="loading" class="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            {{ loading ? 'Guardando…' : 'Guardar cambios' }}
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>