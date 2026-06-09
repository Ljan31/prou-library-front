<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue'
import { useUiStore } from '@/stores/ui.store'
import { useUsers, roleLabel } from '@/composables/useUsers'
import { useAuxAssign } from '@/composables/useAuxAssign'
import { userService } from '@/services/user.service'
import type { CreateUserPayload } from '@/services/user.service'

const props = defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  created: []
}>()

const ui = useUiStore()
const aux = useAuxAssign()
const { roles, allCarreras, allBibliotecas, addUser, roleNameForId } = useUsers()

const loading = ref(false)

// ─── Form ─────────────────────────────────────────────────────────────────
const form = reactive({
  username: '',
  password: '',
  nombre: '',
  apellido_pat: '',
  apellido_mat: '',
  ci: '',
  celular: '',
  email: '',
  roleId: '' as string | number,
  // bibliotecaId is optional for all roles — only shown for BIBLIOTECARIO as convenience
  bibliotecaId: '' as string | number,
  carreras: [] as { carreraId: number; nombre: string; matricula: string }[],
  _pickerCarreraId: '' as number | '',
  _pickerMatricula: '',
})
const errors = reactive<Record<string, string>>({})

// ─── Role-derived ─────────────────────────────────────────────────────────
const selectedRoleName = computed(() => roleNameForId(form.roleId))
const isEstudiante = computed(() => selectedRoleName.value === 'ROLE_ESTUDIANTE')
const isBibliotecario = computed(() => selectedRoleName.value === 'ROLE_BIBLIOTECARIO')
const availableCarreras = computed(() =>
  allCarreras.value.filter(c => !form.carreras.some(s => s.carreraId === c.id_carrera))
)

watch(() => form.roleId, () => {
  form.bibliotecaId = ''
  form.carreras = []
  form._pickerCarreraId = ''
  form._pickerMatricula = ''
  delete errors.bibliotecaId
  delete errors._pickerCarreraId
})

// ─── Helpers ──────────────────────────────────────────────────────────────
function reset() {
  Object.assign(form, {
    username: '', password: '', nombre: '', apellido_pat: '',
    apellido_mat: '', ci: '', celular: '', email: '',
    roleId: '', bibliotecaId: '', carreras: [],
    _pickerCarreraId: '', _pickerMatricula: '',
  })
  Object.keys(errors).forEach(k => delete errors[k])
}

function close() { emit('update:modelValue', false); reset() }
watch(() => props.modelValue, (v) => { if (v) reset() })

function addCarrera() {
  delete errors._pickerCarreraId
  if (!form._pickerCarreraId) { errors._pickerCarreraId = 'Selecciona una carrera'; return }
  const found = allCarreras.value.find(c => c.id_carrera === Number(form._pickerCarreraId))
  if (!found) return
  form.carreras.push({
    carreraId: found.id_carrera,
    nombre: found.nombre_carrera,
    matricula: form._pickerMatricula.trim(),
  })
  form._pickerCarreraId = ''
  form._pickerMatricula = ''
}
function removeCarrera(id: number) { form.carreras = form.carreras.filter(c => c.carreraId !== id) }

// ─── Validate ─────────────────────────────────────────────────────────────
// NOTE: biblioteca is intentionally NOT required — the backend assigns it
// separately via /bibliotecas/{id}/encargados. Here it's only a convenience field.
function validate(): boolean {
  Object.keys(errors).forEach(k => delete errors[k])
   // Username
  if (!form.username.trim()) {
    errors.username = 'Requerido'
  } else if (form.username.length < 4) {
    errors.username = 'Mínimo 4 caracteres'
  } else if (form.username.length > 30) {
    errors.username = 'Máximo 30 caracteres'
  }

  // Password
  if (!form.password) {
    errors.password = 'Requerido'
  } else if (form.password.length < 8) {
    errors.password = 'Mínimo 8 caracteres'
  } else if (form.password.length > 64) {
    errors.password = 'Máximo 64 caracteres'
  }

  // Nombre
  if (!form.nombre.trim()) {
    errors.nombre = 'Requerido'
  } else if (form.nombre.length < 2) {
    errors.nombre = 'Mínimo 2 caracteres'
  } else if (form.nombre.length > 50) {
    errors.nombre = 'Máximo 50 caracteres'
  }

  // Apellido paterno
  if (!form.apellido_pat.trim()) {
    errors.apellido_pat = 'Requerido'
  } else if (form.apellido_pat.length < 2) {
    errors.apellido_pat = 'Mínimo 2 caracteres'
  } else if (form.apellido_pat.length > 50) {
    errors.apellido_pat = 'Máximo 50 caracteres'
  }

  // Apellido materno
  if (form.apellido_mat && form.apellido_mat.length > 50) {
    errors.apellido_mat = 'Máximo 50 caracteres'
  }

  // CI
  if (!form.ci.trim()) {
    errors.ci = 'Requerido'
  } else if (!/^\d{5,20}$/.test(form.ci)) {
    errors.ci = 'Debe contener entre 5 y 20 dígitos'
  }

  // Email
  if (!form.email.trim()) {
    errors.email = 'Requerido'
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
    errors.email = 'Correo inválido'
  } else if (form.email.length > 100) {
    errors.email = 'Máximo 100 caracteres'
  }

  // Celular
  if (form.celular && !/^[0-9]{7,15}$/.test(form.celular)) {
    errors.celular = 'Debe contener entre 7 y 15 dígitos'
  }

  // Rol
  if (!form.roleId) {
    errors.roleId = 'Selecciona un rol'
  }

  return Object.keys(errors).length === 0
}

// ─── Submit ────────────────────────────────────────────────────────────────
async function handleCreate() {
  if (!validate()) return
  loading.value = true
  try {
    // All responses go through addUser which handles any wrapping level
    if (isEstudiante.value) {
      const { estudianteService } = await import('@/services/estudiante.service')
      const res = await estudianteService.register({
        username: String(form.username),
        password: form.password,
        persona: {
          nombre: form.nombre,
          apellido_pat: form.apellido_pat,
          apellido_mat: form.apellido_mat || undefined,
          ci: Number(form.ci),
          celular: form.celular || undefined,
          email: form.email,
        },
        userCarreras: form.carreras.length
          ? form.carreras.map(c => ({ carreraId: c.carreraId, matricula: c.matricula || undefined }))
          : undefined,
      })
      // estudianteService wraps in ApiResponse<UserResponse>
      addUser(res.data.data)
    } else {
      const payload: CreateUserPayload & { bibliotecaId?: number } = {
        username: String(form.username),
        password: form.password,
        persona: {
          nombre: form.nombre,
          apellido_pat: form.apellido_pat,
          apellido_mat: form.apellido_mat,
          ci: Number(form.ci),
          celular: form.celular,
          email: form.email,
        },
        roleIds: [Number(form.roleId)],
        // Include bibliotecaId only if selected (optional)
        ...(form.bibliotecaId ? { bibliotecaId: Number(form.bibliotecaId) } : {}),
      }
      const res = await userService.create(payload)
      addUser(res.data)

      // === ASIGNACIÓN DE BIBLIOTECA SI ES BIBLIOTECARIO Y SE SELECCIONÓ ===
      if (isBibliotecario.value && form.bibliotecaId) {
        const bibId = Number(form.bibliotecaId)

        // Resetear aux y configurar
        aux.resetAux()
        aux.auxBibliotecaId.value = bibId

        // Asignar como PRINCIPAL (normal para bibliotecario nuevo)
        const asignado = await aux.assignAux(res.data.data, false) // false = no necesita carrera

        if (!asignado) {
          // mensajeErrorAsignacion.value = aux.auxError.value || 'No se pudo asignar la biblioteca'
          ui.toast.warning('Usuario creado', 'Pero no se pudo asignar la biblioteca')
        }
      }
    }

    close()
    emit('created')
    ui.toast.success('Usuario creado', `${form.nombre} ${form.apellido_pat}`)
  } catch (e: unknown) {
    let msg = 'Error al crear usuario'

    if (typeof e === 'object' && e !== null && 'response' in e) {
      const err = e as any
      msg = err.response?.data?.message || msg
      // console.log("BACKEND 👉", err.response?.data)
    } else if (e instanceof Error) {
      msg = e.message
    }

    const lower = msg.toLowerCase()

    if (lower.includes('username') || lower.includes('usuario')) {
      errors.username = msg
    } else if (lower.includes('ci')) {
      errors.ci = msg
    } else if (lower.includes('email') || lower.includes('correo')) {
      errors.email = msg
    } else {
      ui.toast.error('Error', msg)
    }

  } finally {
    loading.value = false
  }
}
</script>

<template>
  <Transition name="fade">
    <div v-if="modelValue" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      @click.self="close">
      <div class="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[92vh] flex flex-col">

        <!-- Header -->
        <div class="px-6 pt-6 pb-4 border-b border-slate-100 flex items-center justify-between shrink-0">
          <h3 class="text-lg font-semibold text-slate-900">Nuevo usuario</h3>
          <button
            class="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all"
            @click="close">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M6 18L18 6M6 6l12 12" stroke-linecap="round" />
            </svg>
          </button>
        </div>

        <!-- Scrollable body -->
        <div class="overflow-y-auto flex-1 p-6 space-y-5">

          <!-- SECCIÓN: Cuenta + Rol -->
          <div>
            <p class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Cuenta</p>
            <div class="space-y-3">
              <div>
                <label class="block text-xs font-medium text-slate-600 mb-1">
                  Rol <span class="text-red-500">*</span>
                </label>
                <select v-model="form.roleId"
                  class="w-full h-9 px-3 text-sm rounded-lg border outline-none transition-all focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                  :class="errors.roleId ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-slate-50'">
                  <option value="">Seleccionar rol…</option>
                  <option v-for="role in roles" :key="role.id_role" :value="role.id_role">
                    {{ roleLabel(role.name) }}
                  </option>
                </select>
                <p v-if="errors.roleId" class="text-xs text-red-500 mt-0.5">{{ errors.roleId }}</p>
              </div>

              <div class="grid grid-cols-2 gap-3">
                <div class="col-span-2">
                  <label class="block text-xs font-medium text-slate-600 mb-1">
                    Username <span class="text-red-500">*</span>
                  </label>
                  <input v-model="form.username" type="text" placeholder="nombre.apellido" minlength="4" maxlength="15"
                    class="w-full h-9 px-3 text-sm rounded-lg border outline-none transition-all focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                    :class="errors.username ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-slate-50'"
                    @input="delete errors.username" />
                  <p v-if="errors.username" class="text-xs text-red-500 mt-0.5">{{ errors.username }}</p>
                </div>
                <div class="col-span-2">
                  <label class="block text-xs font-medium text-slate-600 mb-1">
                    Contraseña <span class="text-red-500">*</span>
                  </label>
                  <input v-model="form.password" type="password" placeholder="Mínimo 8 caracteres"   minlength="8" maxlength="20"
                    class="w-full h-9 px-3 text-sm rounded-lg border outline-none transition-all focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                    :class="errors.password ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-slate-50'"
                    @input="delete errors.password" />
                  <p v-if="errors.password" class="text-xs text-red-500 mt-0.5">{{ errors.password }}</p>
                </div>
              </div>
            </div>
          </div>

          <!-- SECCIÓN: Datos personales -->
          <div>
            <p class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Datos personales</p>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-xs font-medium text-slate-600 mb-1">Nombre <span
                    class="text-red-500">*</span></label>
                <input v-model="form.nombre" type="text" placeholder="Nombre"  maxlength="25"
                  class="w-full h-9 px-3 text-sm rounded-lg border outline-none transition-all focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                  :class="errors.nombre ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-slate-50'"
                  @input="delete errors.nombre" />
                <p v-if="errors.nombre" class="text-xs text-red-500 mt-0.5">{{ errors.nombre }}</p>
              </div>
              <div>
                <label class="block text-xs font-medium text-slate-600 mb-1">Ap. Paterno <span
                    class="text-red-500">*</span></label>
                <input v-model="form.apellido_pat" type="text" placeholder="Ap. Paterno" maxlength="25"
                  class="w-full h-9 px-3 text-sm rounded-lg border outline-none transition-all focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                  :class="errors.apellido_pat ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-slate-50'"
                  @input="delete errors.apellido_pat" />
                <p v-if="errors.apellido_pat" class="text-xs text-red-500 mt-0.5">{{ errors.apellido_pat }}</p>
              </div>
              <div>
                <label class="block text-xs font-medium text-slate-600 mb-1">Ap. Materno</label>
                <input v-model="form.apellido_mat" type="text" placeholder="Ap. Materno" maxlength="25"
                  class="w-full h-9 px-3 text-sm rounded-lg border border-slate-200 bg-slate-50 outline-none transition-all focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400" />
              </div>
              <div>
                <label class="block text-xs font-medium text-slate-600 mb-1">CI <span
                    class="text-red-500">*</span></label>
                <input v-model="form.ci" type="text" placeholder="Número de CI" inputmode="numeric" maxlength="10"
                  class="w-full h-9 px-3 text-sm rounded-lg border outline-none transition-all focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                  :class="errors.ci ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-slate-50'"
                    @input="
                      form.ci = form.ci.replace(/\D/g, '').slice(0, 10);
                      delete errors.ci;
                    " />
                <p v-if="errors.ci" class="text-xs text-red-500 mt-0.5">{{ errors.ci }}</p>
              </div>
              <div class="col-span-2">
                <label class="block text-xs font-medium text-slate-600 mb-1">Email <span
                    class="text-red-500">*</span></label>
                <input v-model="form.email" type="email" placeholder="email@dominio.com" maxlength="20"
                  class="w-full h-9 px-3 text-sm rounded-lg border outline-none transition-all focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                  :class="errors.email ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-slate-50'"
                  @input="delete errors.email" />
                <p v-if="errors.email" class="text-xs text-red-500 mt-0.5">{{ errors.email }}</p>
              </div>
              <div class="col-span-2">
                <label class="block text-xs font-medium text-slate-600 mb-1">Celular</label>
                <input v-model="form.celular" type="text" placeholder="7XXXXXXX" maxlength="15" inputmode="numeric" @input="form.celular = form.celular.replace(/\D/g, '').slice(0, 15)"
                  class="w-full h-9 px-3 text-sm rounded-lg border border-slate-200 bg-slate-50 outline-none transition-all focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400" />
              </div>
            </div>
          </div>

          <!-- SECCIÓN DINÁMICA: Biblioteca (solo BIBLIOTECARIO) — OPCIONAL -->
          <Transition name="slide-up">
            <div v-if="isBibliotecario" class="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
              <div class="flex items-center gap-2 mb-3">
                <div class="w-6 h-6 rounded-md bg-emerald-100 flex items-center justify-center shrink-0">
                  <svg class="w-3.5 h-3.5 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                    stroke-width="2">
                    <path
                      d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75z"
                      stroke-linecap="round" stroke-linejoin="round" />
                  </svg>
                </div>
                <p class="text-xs font-semibold text-emerald-700 uppercase tracking-wider">
                  Biblioteca
                  <span class="normal-case font-normal text-emerald-500 ml-1">(opcional)</span>
                </p>
              </div>
              <select v-model="form.bibliotecaId"
                class="w-full h-9 px-3 text-sm rounded-lg border border-emerald-200 bg-white text-slate-700 outline-none transition-all focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400">
                <option value="">Sin biblioteca por ahora</option>
                <option v-for="bib in allBibliotecas" :key="bib.id_biblioteca" :value="bib.id_biblioteca">
                  {{ bib.nombre }}
                </option>
              </select>
              <p class="text-xs text-emerald-600 mt-1.5">
                Puedes asignar la biblioteca más tarde desde el panel de edición.
              </p>
            </div>
          </Transition>

          <!-- SECCIÓN DINÁMICA: Carreras (solo ESTUDIANTE) -->
          <Transition name="slide-up">
            <div v-if="isEstudiante" class="rounded-xl border border-sky-200 bg-sky-50/60 p-4">
              <div class="flex items-center gap-2 mb-3">
                <div class="w-6 h-6 rounded-md bg-sky-100 flex items-center justify-center shrink-0">
                  <svg class="w-3.5 h-3.5 text-sky-600" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                    stroke-width="2">
                    <path
                      d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342"
                      stroke-linecap="round" stroke-linejoin="round" />
                  </svg>
                </div>
                <p class="text-xs font-semibold text-sky-700 uppercase tracking-wider">
                  Carreras <span class="normal-case font-normal text-sky-400">(opcional)</span>
                </p>
              </div>

              <div class="flex gap-2 mb-1.5 flex-wrap">
                <select v-model="form._pickerCarreraId"
                  class="flex-1 h-9 px-2 text-sm rounded-lg border outline-none transition-all focus:ring-2 focus:ring-sky-500/20 focus:border-sky-400 text-slate-700"
                  :class="errors._pickerCarreraId ? 'border-red-300 bg-red-50' : 'border-sky-200 bg-white'">
                  <option value="">Seleccionar carrera…</option>
                  <option v-for="c in availableCarreras" :key="c.id_carrera" :value="c.id_carrera">
                    {{ c.nombre_carrera }}
                  </option>
                </select>
                <input v-model="form._pickerMatricula" type="text" placeholder="Matrícula"  maxlength="10"
                  class="w-28 h-9 px-2 text-sm rounded-lg border border-sky-200 bg-white text-slate-700 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-400" />
                <button
                  class="h-9 px-3 rounded-lg bg-sky-600 text-white text-xs font-semibold hover:bg-sky-500 transition-colors disabled:opacity-40 shrink-0"
                  :disabled="!form._pickerCarreraId" @click="addCarrera">Agregar</button>
              </div>
              <p v-if="errors._pickerCarreraId" class="text-xs text-red-500 mb-2">{{ errors._pickerCarreraId }}</p>

              <TransitionGroup v-if="form.carreras.length" name="list" tag="div" class="space-y-1.5 mt-2">
                <div v-for="c in form.carreras" :key="c.carreraId"
                  class="flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-sky-100">
                  <svg class="w-3.5 h-3.5 text-sky-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                    stroke-width="2">
                    <path d="M9 12.75L11.25 15 15 9.75" stroke-linecap="round" stroke-linejoin="round" />
                  </svg>
                  <span class="flex-1 text-sm text-slate-700 font-medium truncate">{{ c.nombre }}</span>
                  <span v-if="c.matricula" class="text-xs text-slate-400 font-mono shrink-0">{{ c.matricula }}</span>
                  <button
                    class="w-5 h-5 flex items-center justify-center rounded text-slate-300 hover:text-red-500 transition-colors"
                    @click="removeCarrera(c.carreraId)">
                    <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                      <path d="M6 18L18 6M6 6l12 12" stroke-linecap="round" />
                    </svg>
                  </button>
                </div>
              </TransitionGroup>
              <p v-else class="text-xs text-sky-500 italic mt-1">Sin carreras — se pueden agregar después desde el
                detalle.</p>
            </div>
          </Transition>

        </div>

        <!-- Footer -->
        <div class="px-6 py-4 border-t border-slate-100 flex gap-3 justify-end shrink-0">
          <button class="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            @click="close">Cancelar</button>
          <button
            class="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 transition-colors disabled:opacity-50 flex items-center gap-2"
            :disabled="loading" @click="handleCreate">
            <svg v-if="loading" class="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            {{ loading ? 'Guardando…' : 'Crear usuario' }}
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.list-enter-active,
.list-leave-active {
  transition: all 0.2s ease;
}

.list-enter-from {
  opacity: 0;
  transform: translateY(-4px);
}

.list-leave-to {
  opacity: 0;
  transform: translateX(6px);
}
</style>