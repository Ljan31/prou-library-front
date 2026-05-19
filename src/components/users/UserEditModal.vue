<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue'
import { useUiStore } from '@/stores/ui.store'
import { usePermissions } from '@/composables/usePermissions'
import { useUsers } from '@/composables/useUsers'
import { useAuxAssign } from '@/composables/useAuxAssign'
import { userService } from '@/services/user.service'
import { carreraService } from '@/services/estudiante.service'
import { bibliotecasService } from '@/services/bibliotecas.service'
import type { UserResponse, UpdateUserPayload } from '@/services/user.service'
import type { CarreraBasic } from '@/services/estudiante.service'
import type { BibliotecaResponse } from '@/services/bibliotecas.service'

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
const aux = useAuxAssign()
aux.watchCarrera()

const loading = ref(false)
const form = reactive({ 
  nombre: '', apellido_pat: '', apellido_mat: '', 
  celular: '', enabled: true, ci: '',
  email: '',
})
const errors = reactive<Record<string, string>>({})

// ── Target user role checks ────────────────────────────────────────────────
const isTargetEstudiante = computed(() => props.user?.roles?.some(r => r.name === 'ROLE_ESTUDIANTE') ?? false)
const isTargetBibliotecario = computed(() => props.user?.roles?.some(r => r.name === 'ROLE_BIBLIOTECARIO') ?? false)

// Admin: can reset anyone | Bibliotecario: only students
const canResetPassword = computed(() => {
  if (isAdmin.value) return true
  if (isStaff.value && isTargetEstudiante.value) return true
  return false
})

// Aux section visible for students (staff) or bibliotecarios (admin only)
const showAuxSection = computed(() => {
  if (isTargetEstudiante.value && isStaff.value) return true
  if (isTargetBibliotecario.value && isAdmin.value) return true
  return false
})

// Carreras del estudiante (para filtrar bibliotecas en sección auxiliar)
const userCarreras = ref<CarreraBasic[]>([])
const carrerasLoading = ref(false)

// Bibliotecas donde ya es encargado (para mostrar en perfil)
const encargadoBibliotecas = ref<BibliotecaResponse[]>([])
const encargadoLoading = ref(false)

watch(() => props.user, async (u) => {
  if (!u) return
  Object.assign(form, {
    nombre: u.persona?.nombre ?? '',
    apellido_pat: u.persona?.apellido_pat ?? '',
    apellido_mat: u.persona?.apellido_mat ?? '',
    celular: u.persona?.celular ?? '',
    enabled: u.enabled,
    ci: u.persona?.ci?.toString() ?? '',
    email: u.persona?.email ?? '',
  })
  Object.keys(errors).forEach(k => delete errors[k])
  aux.resetAux()

  // Load carreras (for students)
  if (isTargetEstudiante.value) {
    carrerasLoading.value = true
    try {
      const res = await carreraService.getByUsuario(u.id_usuario)
      const raw = res.data as any
      userCarreras.value = Array.isArray(raw) ? raw : (raw?.data ?? [])
    } catch { /* silent */ } finally { carrerasLoading.value = false }
  } else { userCarreras.value = [] }

  // Load bibliotecas where user is encargado (for both students and bibliotecarios)
  await loadEncargadoBibliotecas(u.id_usuario)

}, { immediate: true })

async function loadEncargadoBibliotecas(usuarioId: number) {
  encargadoLoading.value = true
  try {
    // Filter global list by checking encargados
    const fromCache = allBibliotecas.value.filter(
      b => b.encargados?.some(e => e.id_usuario === usuarioId)
    )
    if (fromCache.length) {
      encargadoBibliotecas.value = fromCache
    } else {
      // Fallback: reload all and filter
      const res = await bibliotecasService.getAll()
      const raw = res.data as any
      const all: BibliotecaResponse[] = Array.isArray(raw) ? raw : (raw?.data ?? [])
      encargadoBibliotecas.value = all.filter(b => b.encargados?.some(e => e.idUsuario === usuarioId))
    }
  } catch { /* silent */ } finally { encargadoLoading.value = false }
}

watch(() => props.modelValue, (v) => { if (!v) aux.resetAux() })

function close() { emit('update:modelValue', false) }

function validate(): boolean {
  Object.keys(errors).forEach(k => delete errors[k])
  if (!form.nombre.trim()) errors.nombre = 'Requerido'
  if (!form.apellido_pat.trim()) errors.apellido_pat = 'Requerido'
  if (isAdmin.value) {
    if (!form.email.trim()) errors.email = 'Requerido'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errors.email = 'Email inválido'
    if (!form.ci.trim() || isNaN(Number(form.ci))) errors.ci = 'CI numérico requerido'
  }
  return Object.keys(errors).length === 0
}

async function handleEdit() {
  if (!props.user || !validate()) return
  loading.value = true
  try {
    const payload: UpdateUserPayload = {
      nombre: form.nombre, apellido_pat: form.apellido_pat,
      apellido_mat: form.apellido_mat, celular: form.celular, enabled: form.enabled,
      ...(isAdmin.value ? { ci: Number(form.ci), email: form.email } : {}),
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

async function handleAssignAux() {
  if (!props.user) return
  const ok = await aux.assignAux(props.user, userCarreras.value)
  if (ok) await loadEncargadoBibliotecas(props.user.id_usuario)
}

// Carrera options: students use their own carreras; bibliotecarios use all
const auxCarreraOptions = computed(() =>
  isTargetEstudiante.value ? userCarreras.value : []
)
// For bibliotecarios, carrera filter not needed — show all bibliotecas directly
const showCarreraFilter = computed(() => isTargetEstudiante.value)

// Bibliotecas for bibliotecarios (all, no carrera filter needed)
const directBibliotecas = computed(() =>
  isTargetBibliotecario.value ? allBibliotecas.value : []
)
// ══════════════════════════════════════════════════════════════════════════
// RESET PASSWORD SECTION
// ══════════════════════════════════════════════════════════════════════════
const resetLoading = ref(false)
const tempPassword = ref<string | null>(null)
const showResetConfirm = ref(false)
const tempPasswordCopied = ref(false)
 
function openResetConfirm() {
  showResetConfirm.value = true
  tempPassword.value = null
  tempPasswordCopied.value = false
}
 
async function handleResetPassword() {
  if (!props.user) return
  resetLoading.value = true
  try {
    const res = await userService.adminResetPassword(props.user.id_usuario)
    const raw = res.data as any
    const data = raw?.data ?? raw
    tempPassword.value = data?.temporaryPassword ?? null
    showResetConfirm.value = false
    ui.toast.success('Contraseña restablecida', 'Se generó una contraseña temporal')
  } catch (e: unknown) {
    ui.toast.error('Error', e instanceof Error ? e.message : 'No se pudo restablecer')
  } finally { resetLoading.value = false }
}
 
async function copyTempPassword() {
  if (!tempPassword.value) return
  try {
    await navigator.clipboard.writeText(tempPassword.value)
    tempPasswordCopied.value = true
    setTimeout(() => { tempPasswordCopied.value = false }, 5000)
  } catch { /* silent */ }
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

        <!-- Body -->
        <div class="overflow-y-auto flex-1 p-6 space-y-5">

          <!-- Datos personales -->
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
                <!-- CI — editable solo por admin, read-only para otros -->
              <div>
                <label class="block text-xs font-medium text-slate-600 mb-1">
                  CI
                  <span v-if="isAdmin" class="text-red-500">*</span>
                  <span v-else class="text-slate-400 font-normal ml-1">(solo admin)</span>
                </label>
                <input
                  v-model="form.ci"
                  type="text"
                  :readonly="!isAdmin"
                  class="w-full h-9 px-3 text-sm rounded-lg border outline-none transition-all"
                  :class="[
                    !isAdmin ? 'bg-slate-100 text-slate-500 cursor-not-allowed border-slate-200' : 'bg-slate-50 border-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400',
                    errors.ci ? 'border-red-300 bg-red-50' : ''
                  ]"
                  @input="delete errors.ci"
                />
                <p v-if="errors.ci" class="text-xs text-red-500 mt-0.5">{{ errors.ci }}</p>
              </div>
               <!-- Email — editable solo por admin -->
              <div>
                <label class="block text-xs font-medium text-slate-600 mb-1">
                  Email
                  <span v-if="isAdmin" class="text-red-500">*</span>
                  <span v-else class="text-slate-400 font-normal ml-1">(solo admin)</span>
                </label>
                <input
                  v-model="form.email"
                  type="email"
                  :readonly="!isAdmin"
                  class="w-full h-9 px-3 text-sm rounded-lg border outline-none transition-all"
                  :class="[
                    !isAdmin ? 'bg-slate-100 text-slate-500 cursor-not-allowed border-slate-200' : 'bg-slate-50 border-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400',
                    errors.email ? 'border-red-300 bg-red-50' : ''
                  ]"
                  @input="delete errors.email"
                />
                <p v-if="errors.email" class="text-xs text-red-500 mt-0.5">{{ errors.email }}</p>
              </div>

            </div>
            <div class="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-200">
              <div>
                <p class="text-sm font-medium text-slate-700">Estado de cuenta</p>
                <p class="text-xs text-slate-400">{{ form.enabled ? 'Puede iniciar sesión' : 'Sin acceso al sistema' }}
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

          <!-- Bibliotecas donde es encargado -->
          <div v-if="encargadoBibliotecas.length || encargadoLoading">
            <p class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Encargado en</p>
            <div v-if="encargadoLoading" class="flex items-center gap-1.5 text-xs text-slate-400">
              <svg class="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Cargando…
            </div>
            <div v-else class="space-y-1.5">
              <div v-for="bib in encargadoBibliotecas" :key="bib.id_biblioteca"
                class="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-100">
                <svg class="w-3.5 h-3.5 text-emerald-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  stroke-width="2">
                  <path
                    d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18"
                    stroke-linecap="round" stroke-linejoin="round" />
                </svg>
                <span class="flex-1 text-xs font-medium text-emerald-800 truncate">{{ bib.nombre }}</span>
                <span class="text-xs px-1.5 py-0.5 rounded font-medium" :class="bib.encargados?.find(e => e.idUsuario === user?.id_usuario)?.rol === 'PRINCIPAL'
                  ? 'bg-emerald-200 text-emerald-800'
                  : 'bg-slate-100 text-slate-600'">
                  {{bib.encargados?.find(e => e.idUsuario === user?.id_usuario)?.rol ?? 'AUXILIAR'}}
                </span>
                <!-- Imagen de resolución si existe -->
                <!-- <a v-if="bib.encargados?.find(e => e.idUsuario === user?.id_usuario)?.respaldoUrl"
                  :href="bib.encargados?.find(e => e.idUsuario === user?.id_usuario)?.respaldoUrl!" target="_blank"
                  class="text-xs text-indigo-500 hover:text-indigo-700 underline shrink-0">Resolución</a> -->
              </div>
            </div>
          </div>


           <!-- SECCIÓN: Restablecer contraseña -->
          <div v-if="canResetPassword" class="rounded-xl border border-slate-200 p-4 space-y-3">
            <div class="flex items-center gap-2">
              <div class="w-6 h-6 rounded-md bg-slate-100 flex items-center justify-center shrink-0">
                <svg class="w-3.5 h-3.5 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </div>
              <p class="text-xs font-semibold text-slate-600 uppercase tracking-wider">Contraseña</p>
            </div>

            <!-- Contraseña temporal generada -->
            <Transition name="slide-up">
              <div v-if="tempPassword" class="space-y-2">
                <p class="text-xs text-slate-500">Contraseña temporal generada. Compártela con el usuario.</p>
                <div class="flex items-center gap-2 p-3 rounded-lg bg-indigo-50 border border-indigo-200">
                  <code class="flex-1 text-sm font-mono font-semibold text-indigo-700 tracking-wider">{{ tempPassword }}</code>
                  <button
                    class="flex items-center gap-1 text-xs font-medium transition-colors px-2 py-1 rounded"
                    :class="tempPasswordCopied ? 'text-emerald-600 bg-emerald-50' : 'text-indigo-500 hover:text-indigo-700 hover:bg-indigo-100'"
                    @click="copyTempPassword"
                  >
                    <svg v-if="tempPasswordCopied" class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                      <path d="M5 13l4 4L19 7" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    <svg v-else class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    {{ tempPasswordCopied ? 'Copiado' : 'Copiar' }}
                  </button>
                </div>
                <p class="text-xs text-amber-600 flex items-center gap-1.5">
                  <svg class="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                  El usuario deberá cambiar esta contraseña al ingresar.
                </p>
              </div>
            </Transition>

            <!-- Botón de reset + confirmación inline -->
            <template v-if="!showResetConfirm && !tempPassword">
              <p class="text-xs text-slate-400">
                Genera una contraseña temporal para
                <span class="font-medium text-slate-600">{{ user?.persona?.nombreCompleto ?? user?.username }}</span>.
              </p>
              <button
                class="w-full h-9 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-colors font-medium"
                @click="openResetConfirm"
              >
                Restablecer contraseña
              </button>
            </template>

            <!-- Confirmación inline -->
            <template v-if="showResetConfirm && !tempPassword">
              <div class="flex items-start gap-2.5 p-3 rounded-lg bg-amber-50 border border-amber-100 text-xs text-amber-700">
                <svg class="w-4 h-4 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                <span>¿Confirmas el restablecimiento de contraseña de <strong>{{ user?.persona?.nombreCompleto }}</strong>? Se generará una contraseña temporal.</span>
              </div>
              <div class="flex gap-2">
                <button
                  class="flex-1 h-9 rounded-lg border border-slate-200 text-sm text-slate-500 hover:bg-slate-50 transition-colors"
                  @click="showResetConfirm = false"
                >Cancelar</button>
                <button
                  class="flex-1 h-9 rounded-lg bg-amber-500 text-white text-sm font-medium hover:bg-amber-400 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  :disabled="resetLoading"
                  @click="handleResetPassword"
                >
                  <svg v-if="resetLoading" class="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  {{ resetLoading ? 'Generando…' : 'Sí, restablecer' }}
                </button>
              </div>
            </template>
          </div>

          <!-- Sección auxiliar: Asignar encargado (staff para estudiantes, admin para bibliotecarios) -->
          <!-- <Transition name="slide-up">
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
                <p class="text-xs font-semibold text-amber-700 uppercase tracking-wider">
                  {{ isTargetBibliotecario ? 'Asignar como encargado' : 'Auxiliar de biblioteca' }}
                </p>
              </div>

              <p class="text-xs text-amber-600">
                <template v-if="isTargetBibliotecario">
                  Asigna a este bibliotecario como encargado principal o auxiliar de una biblioteca.
                </template>
                <template v-else>
                  Asigna a este estudiante como encargado auxiliar en una biblioteca de su carrera.
                </template>
              </p>

              <div v-if="showCarreraFilter">
                <label class="block text-xs font-medium text-slate-600 mb-1">Carrera del estudiante</label>
                <div v-if="carrerasLoading" class="flex items-center gap-1.5 text-xs text-slate-400 h-9">
                  <svg class="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Cargando carreras…
                </div>
                <select v-else v-model="aux.auxCarreraId.value"
                  class="w-full h-9 px-3 text-sm rounded-lg border border-amber-200 bg-white text-slate-700 outline-none transition-all focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400">
                  <option value="">{{ userCarreras.length ? 'Seleccionar carrera…' : 'Sin carreras inscritas' }}
                  </option>
                  <option v-for="c in userCarreras" :key="c.id_carrera" :value="c.id_carrera">{{ c.nombre_carrera }}
                  </option>
                </select>
              </div>

              <div>
                <label class="block text-xs font-medium text-slate-600 mb-1">Biblioteca</label>
                <div v-if="aux.auxBibliotecasLoading.value"
                  class="flex items-center gap-1.5 text-xs text-slate-400 h-9">
                  <svg class="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Buscando…
                </div>
                <select v-else v-model="aux.auxBibliotecaId.value"
                  :disabled="showCarreraFilter && !aux.auxCarreraId.value"
                  class="w-full h-9 px-3 text-sm rounded-lg border border-amber-200 bg-white text-slate-700 outline-none transition-all focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400 disabled:opacity-50 disabled:cursor-not-allowed">
                  <option value="">
                    {{ showCarreraFilter && !aux.auxCarreraId.value
                      ? 'Selecciona una carrera primero'
                      : (isTargetBibliotecario ? allBibliotecas : aux.auxBibliotecas.value).length
                        ? 'Seleccionar biblioteca…'
                        : 'Sin bibliotecas disponibles' }}
                  </option>
                  <option v-for="b in isTargetBibliotecario ? allBibliotecas : aux.auxBibliotecas.value"
                    :key="b.id_biblioteca" :value="b.id_biblioteca">
                    {{ b.nombre }}
                  </option>
                </select>

                <template v-if="aux.auxBibliotecaId.value">
                  <div v-if="aux.selectedBib()?.encargados?.length"
                    class="mt-2 p-2.5 rounded-lg bg-white/70 border border-amber-100">
                    <p class="text-xs text-slate-400 mb-1.5 font-medium">Encargados actuales</p>
                    <div class="flex flex-wrap gap-1.5">
                      <span v-for="enc in aux.selectedBib()!.encargados" :key="enc.id_usuario"
                        class="text-xs px-2 py-0.5 rounded-full font-medium"
                        :class="enc.rol === 'PRINCIPAL' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'">
                        {{ enc.nombreCompleto }} · {{ enc.rol }}
                      </span>
                    </div>
                  </div>
                </template>
              </div>

              <div>
                <label class="block text-xs font-medium text-slate-600 mb-1">Imagen de resolución</label>
                <div class="flex items-center gap-3">
                  <label
                    class="flex items-center gap-2 cursor-pointer px-3 py-2 rounded-lg border border-amber-200 bg-white hover:bg-amber-50 transition-colors text-xs text-slate-600 font-medium">
                    <svg class="w-4 h-4 text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                      stroke-width="2">
                      <path
                        d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
                        stroke-linecap="round" stroke-linejoin="round" />
                    </svg>
                    {{ aux.auxResolucionFile.value ? aux.auxResolucionFile.value.name : 'Subir imagen' }}
                    <input type="file" accept="image/*,.pdf" class="hidden" @change="aux.onFileSelected" />
                  </label>
                  <img v-if="aux.auxResolucionPreview.value" :src="aux.auxResolucionPreview.value"
                    class="w-10 h-10 rounded-lg object-cover border border-amber-200" alt="Preview" />
                </div>
                <p class="text-xs text-slate-400 mt-1">Imagen o PDF de la resolución de designación (opcional)</p>
              </div>

              <p v-if="aux.auxError.value" class="text-xs text-red-500 flex items-center gap-1.5">
                <svg class="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  stroke-width="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                {{ aux.auxError.value }}
              </p>
              <div v-if="aux.auxSuccess.value" class="flex items-center gap-1.5 text-xs text-emerald-600">
                <svg class="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  stroke-width="2">
                  <path d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" stroke-linecap="round"
                    stroke-linejoin="round" />
                </svg>
                Asignación registrada correctamente
              </div>

              <button
                class="w-full h-9 rounded-lg bg-amber-500 text-white text-sm font-medium hover:bg-amber-400 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                :disabled="aux.auxLoading.value || !aux.auxBibliotecaId.value" @click="handleAssignAux">
                <svg v-if="aux.auxLoading.value" class="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                {{ aux.auxLoading.value ? 'Asignando…' : 'Asignar encargado' }}
              </button>
            </div>
          </Transition> -->

        </div>

        <!-- Footer -->
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