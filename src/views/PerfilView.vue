<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth.store'
import { useUiStore } from '@/stores/ui.store'
import { userService } from '@/services/user.service'
import { carreraService } from '@/services/estudiante.service'
import type { CarreraBasic } from '@/services/estudiante.service'
import SCard from '@/components/ui/SCard.vue'
import SBadge from '@/components/ui/SBadge.vue'

const auth = useAuthStore()
const ui = useUiStore()
onMounted(() => {
  ui.setBreadcrumbs([{ label: 'Perfil' }])
  if (auth.isEstudiante && auth.user?.id) {
    fetchCarreras()
  }
})

// ─── Role maps ────────────────────────────────────────────────────────────
const roleLabel: Record<string, string> = {
  ROLE_ADMIN: 'Administrador',
  ROLE_BIBLIOTECARIO: 'Bibliotecario',
  ROLE_ESTUDIANTE: 'Estudiante',
}
const roleVariant: Record<string, 'primary' | 'info' | 'success'> = {
  ROLE_ADMIN: 'primary',
  ROLE_BIBLIOTECARIO: 'info',
  ROLE_ESTUDIANTE: 'success',
}

// ─── Avatar initials ──────────────────────────────────────────────────────
const avatarInitials = computed(() => {
  const name = auth.user?.persona.nombre ?? ''
  const ap = auth.user?.persona.apellido_pat ?? ''
  return ((name[0] ?? '') + (ap[0] ?? '')).toUpperCase() || auth.displayName.charAt(0).toUpperCase()
})

// ─── Edit profile ─────────────────────────────────────────────────────────
const editMode = ref(false)
const editLoading = ref(false)

const editForm = reactive({
  nombre: '',
  apellido_pat: '',
  apellido_mat: '',
  celular: '',
})

const editErrors = reactive<Record<string, string>>({})

function openEdit() {
  Object.assign(editForm, {
    nombre: auth.user?.persona.nombre ?? '',
    apellido_pat: auth.user?.persona.apellido_pat ?? '',
    apellido_mat: auth.user?.persona.apellido_mat ?? '',
    celular: auth.user?.persona.celular ?? '',
  })
  Object.keys(editErrors).forEach(k => delete editErrors[k])
  editMode.value = true
}

function cancelEdit() {
  editMode.value = false
}

function validateEdit(): boolean {
  Object.keys(editErrors).forEach(k => delete editErrors[k])
  if (!editForm.nombre.trim()) editErrors.nombre = 'Requerido'
  if (!editForm.apellido_pat.trim()) editErrors.apellido_pat = 'Requerido'
  return Object.keys(editErrors).length === 0
}

async function saveEdit() {
  if (!validateEdit() || !auth.user?.id) return
  editLoading.value = true
  try {
    await userService.update(auth.user.id, {
      nombre: editForm.nombre,
      apellido_pat: editForm.apellido_pat,
      apellido_mat: editForm.apellido_mat,
      celular: editForm.celular,
    })
    // Refresh session to reflect updated persona
    await auth.initSession()
    editMode.value = false
    ui.toast.success('Perfil actualizado', 'Tus datos han sido guardados')
  } catch (e: unknown) {
    ui.toast.error('Error', e instanceof Error ? e.message : 'No se pudo actualizar')
  } finally {
    editLoading.value = false
  }
}

// ─── Carreras (students only) ─────────────────────────────────────────────
const carreras = ref<CarreraBasic[]>([])
const carrerasLoading = ref(false)
const allCarreras = ref<{ id_carrera: number; nombre_carrera: string; codigo_carrera: string | null }[]>([])

async function fetchCarreras() {
  if (!auth.user?.id) return
  carrerasLoading.value = true
  try {
    const [userCarrerasRes, allCarrerasRes] = await Promise.all([
      carreraService.getByUsuario(auth.user.id),
      carreraService.getAll(),
    ])
    carreras.value = userCarrerasRes.data.data ?? []
    allCarreras.value = allCarrerasRes.data.data
  } catch {
    // silent fail
  } finally {
    carrerasLoading.value = false
  }
}

// Add career
const showAddCarrera = ref(false)
const newCarreraId = ref<number | ''>('')
const newMatricula = ref('')
const addCarreraLoading = ref(false)
const addCarreraError = ref('')

const availableCarreras = computed(() =>
  allCarreras.value.filter(c => !carreras.value.some(uc => uc.id_carrera === c.id_carrera))
)

async function addCarrera() {
  addCarreraError.value = ''
  if (!newCarreraId.value) {
    addCarreraError.value = 'Selecciona una carrera'
    return
  }
  if (!auth.user?.id) return
  addCarreraLoading.value = true
  try {
    await carreraService.assign({
      usuarioId: auth.user.id,
      carreraId: Number(newCarreraId.value),
      matricula: newMatricula.value.trim() || undefined,
    })
    await fetchCarreras()
    newCarreraId.value = ''
    newMatricula.value = ''
    showAddCarrera.value = false
    ui.toast.success('Carrera agregada', 'La carrera fue asignada a tu perfil')
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'No se pudo asignar la carrera'
    addCarreraError.value = msg
  } finally {
    addCarreraLoading.value = false
  }
}

async function removeCarrera(carreraId: number) {
  if (!auth.user?.id) return
  try {
    await carreraService.remove(auth.user.id, carreraId)
    carreras.value = carreras.value.filter(c => c.id_carrera !== carreraId)
    ui.toast.success('Carrera removida', '')
  } catch (e: unknown) {
    ui.toast.error('Error', e instanceof Error ? e.message : 'No se pudo remover')
  }
}
</script>

<template>
  <div class="page-container max-w-2xl space-y-6">

    <!-- ── Header ── -->
    <div class="flex items-start justify-between gap-4">
      <div>
        <h1 class="text-xl font-semibold text-slate-900">Mi Perfil</h1>
        <p class="text-sm text-slate-500 mt-0.5">Información personal y datos de cuenta</p>
      </div>
      <button v-if="!editMode"
        class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-sm text-slate-600 hover:border-slate-300 hover:text-slate-800 hover:bg-slate-50 transition-all"
        @click="openEdit">
        <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path
            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
            stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        Editar perfil
      </button>
    </div>

    <!-- ── Main card ── -->
    <SCard padding="lg">

      <!-- Avatar + name row -->
      <div class="flex items-center gap-4 pb-6 border-b border-slate-100 mb-6">
        <div
          class="w-16 h-16 rounded-2xl bg-linear-to-br from-indigo-100 to-indigo-200 flex items-center justify-center text-indigo-700 text-2xl font-bold shadow-inner shrink-0">
          {{ avatarInitials }}
        </div>
        <div class="flex-1 min-w-0">
          <h2 class="text-lg font-semibold text-slate-900 truncate">{{ auth.displayName }}</h2>
          <p class="text-sm text-slate-500 font-mono">@{{ auth.user?.username }}</p>
          <div class="flex items-center gap-1.5 mt-2 flex-wrap">
            <SBadge v-for="role in auth.roles" :key="role" :variant="roleVariant[role] ?? 'default'" :dot="true">
              {{ roleLabel[role] ?? role }}
            </SBadge>
            <span v-if="auth.bibliotecaNombre"
              class="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">
              <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path
                  d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75z"
                  stroke-linecap="round" stroke-linejoin="round" />
              </svg>
              {{ auth.bibliotecaNombre }}
            </span>
          </div>
        </div>
      </div>

      <!-- ── VIEW MODE ── -->
      <template v-if="!editMode">
        <dl class="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <dt class="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">Nombre completo</dt>
            <dd class="text-sm font-medium text-slate-800">{{ auth.user?.persona.nombreCompleto ?? '–' }}</dd>
          </div>
          <div>
            <dt class="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">Correo electrónico</dt>
            <dd class="text-sm font-medium text-slate-800">{{ auth.user?.persona.email ?? '–' }}</dd>
          </div>
          <div>
            <dt class="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">Cédula de Identidad</dt>
            <dd class="text-sm font-medium text-slate-800">{{ auth.user?.persona.ci ?? '–' }}</dd>
          </div>
          <div>
            <dt class="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">Celular</dt>
            <dd class="text-sm font-medium text-slate-800">{{ auth.user?.persona.celular ?? '–' }}</dd>
          </div>
          <div v-if="auth.bibliotecaNombre" class="sm:col-span-2">
            <dt class="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">Biblioteca asignada</dt>
            <dd class="text-sm font-medium text-slate-800">{{ auth.bibliotecaNombre }}</dd>
          </div>
        </dl>
      </template>

      <!-- ── EDIT MODE ── -->
      <template v-else>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <!-- Nombre -->
          <div>
            <label class="block text-xs font-medium text-slate-500 mb-1">Nombre <span
                class="text-red-500">*</span></label>
            <input v-model="editForm.nombre" type="text"
              class="w-full h-9 px-3 text-sm rounded-lg border outline-none transition-all focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
              :class="editErrors.nombre ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-slate-50'" />
            <p v-if="editErrors.nombre" class="text-xs text-red-500 mt-0.5">{{ editErrors.nombre }}</p>
          </div>

          <!-- Celular -->
          <div>
            <label class="block text-xs font-medium text-slate-500 mb-1">Celular</label>
            <input v-model="editForm.celular" type="text" placeholder="7XXXXXXX"
              class="w-full h-9 px-3 text-sm rounded-lg border border-slate-200 bg-slate-50 outline-none transition-all focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400" />
          </div>

          <!-- Apellido paterno -->
          <div>
            <label class="block text-xs font-medium text-slate-500 mb-1">Ap. Paterno <span
                class="text-red-500">*</span></label>
            <input v-model="editForm.apellido_pat" type="text"
              class="w-full h-9 px-3 text-sm rounded-lg border outline-none transition-all focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
              :class="editErrors.apellido_pat ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-slate-50'" />
            <p v-if="editErrors.apellido_pat" class="text-xs text-red-500 mt-0.5">{{ editErrors.apellido_pat }}</p>
          </div>

          <!-- Apellido materno -->
          <div>
            <label class="block text-xs font-medium text-slate-500 mb-1">Ap. Materno</label>
            <input v-model="editForm.apellido_mat" type="text"
              class="w-full h-9 px-3 text-sm rounded-lg border border-slate-200 bg-slate-50 outline-none transition-all focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400" />
          </div>
        </div>

        <!-- Note: email and CI are not editable -->
        <p class="text-xs text-slate-400 mt-3 flex items-center gap-1.5">
          <svg class="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
          El correo y CI no son editables desde este panel.
        </p>

        <!-- Action buttons -->
        <div class="flex gap-3 justify-end mt-5 pt-5 border-t border-slate-100">
          <button
            class="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
            @click="cancelEdit">Cancelar</button>
          <button
            class="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 transition-colors disabled:opacity-50 flex items-center gap-2"
            :disabled="editLoading" @click="saveEdit">
            <svg v-if="editLoading" class="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            {{ editLoading ? 'Guardando...' : 'Guardar cambios' }}
          </button>
        </div>
      </template>
    </SCard>

    <!-- ── Carreras section (students only) ── -->
    <SCard v-if="auth.isEstudiante" padding="lg">
      <div class="flex items-center justify-between mb-5">
        <div>
          <h3 class="text-base font-semibold text-slate-900">Mis carreras</h3>
          <p class="text-xs text-slate-500 mt-0.5">Carreras en las que estás inscrito</p>
        </div>
        <button v-if="availableCarreras.length > 0"
          class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-indigo-600 hover:bg-indigo-50 border border-indigo-200 transition-all"
          @click="showAddCarrera = !showAddCarrera">
          <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 5v14M5 12h14" stroke-linecap="round" />
          </svg>
          Agregar carrera
        </button>
      </div>

      <!-- Add career form -->
      <Transition name="slide-up">
        <div v-if="showAddCarrera" class="mb-4 p-4 rounded-xl bg-indigo-50 border border-indigo-100 space-y-3">
          <p class="text-xs font-medium text-indigo-700">Nueva asignación</p>
          <div class="flex gap-2">
            <select v-model="newCarreraId"
              class="flex-1 h-9 px-3 text-sm rounded-lg border border-indigo-200 bg-white text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all">
              <option value="">Seleccionar carrera…</option>
              <option v-for="c in availableCarreras" :key="c.id_carrera" :value="c.id_carrera">
                {{ c.nombre_carrera }}
                <template v-if="c.codigo_carrera"> ({{ c.codigo_carrera }})</template>
              </option>
            </select>
          </div>
          <div class="flex gap-2">
            <input v-model="newMatricula" type="text" placeholder="Matrícula (opcional)"
              class="flex-1 h-9 px-3 text-sm rounded-lg border border-indigo-200 bg-white text-slate-700 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all" />
            <button
              class="h-9 px-4 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-500 transition-colors disabled:opacity-50 flex items-center gap-1.5"
              :disabled="addCarreraLoading || !newCarreraId" @click="addCarrera">
              <svg v-if="addCarreraLoading" class="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              {{ addCarreraLoading ? 'Asignando…' : 'Asignar' }}
            </button>
            <button
              class="h-9 px-3 rounded-lg border border-slate-200 text-slate-500 hover:text-slate-700 text-sm transition-colors"
              @click="showAddCarrera = false; addCarreraError = ''">Cancelar</button>
          </div>
          <p v-if="addCarreraError" class="text-xs text-red-500">{{ addCarreraError }}</p>
        </div>
      </Transition>

      <!-- Loading -->
      <div v-if="carrerasLoading" class="space-y-2">
        <div v-for="i in 2" :key="i" class="h-14 rounded-xl bg-slate-100 animate-pulse" />
      </div>

      <!-- List -->
      <div v-else-if="carreras.length" class="space-y-2">
        <TransitionGroup name="list" tag="div" class="space-y-2">
          <div v-for="carrera in carreras" :key="carrera.id_carrera"
            class="flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-50 border border-slate-100 hover:border-slate-200 transition-colors group">
            <div class="w-9 h-9 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0">
              <svg class="w-4.5 h-4.5 text-indigo-600" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                stroke-width="1.5">
                <path
                  d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5"
                  stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium text-slate-900 truncate">{{ carrera.nombre_carrera }}</p>
              <div class="flex items-center gap-3 mt-0.5">
                <span v-if="carrera.codigo_carrera" class="text-xs text-slate-400 font-mono">{{ carrera.codigo_carrera
                  }}</span>
                <span v-if="carrera.matricula" class="text-xs text-slate-500">Mat. {{ carrera.matricula }}</span>
              </div>
            </div>
            <button
              class="w-7 h-7 rounded-lg flex items-center justify-center text-slate-300 hover:text-red-400 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100"
              title="Remover carrera" @click="removeCarrera(carrera.id_carrera)">
              <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M6 18L18 6M6 6l12 12" stroke-linecap="round" />
              </svg>
            </button>
          </div>
        </TransitionGroup>
      </div>

      <!-- Empty -->
      <div v-else class="flex flex-col items-center gap-2 py-8 text-center">
        <svg class="w-10 h-10 text-slate-200" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path
            d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5"
            stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        <p class="text-sm text-slate-400 font-medium">Sin carreras asignadas</p>
        <p class="text-xs text-slate-300">Usa el botón "Agregar carrera" para inscribirte</p>
      </div>
    </SCard>

    <!-- ── Account info card ── -->
    <SCard padding="lg">
      <h3 class="text-base font-semibold text-slate-900 mb-4">Información de cuenta</h3>
      <dl class="space-y-3">
        <div class="flex items-center justify-between py-2 border-b border-slate-50">
          <dt class="text-xs font-medium text-slate-400 uppercase tracking-wider">Estado de cuenta</dt>
          <dd>
            <span class="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600">
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Activa
            </span>
          </dd>
        </div>
        <div class="flex items-center justify-between py-2 border-b border-slate-50">
          <dt class="text-xs font-medium text-slate-400 uppercase tracking-wider">Rol principal</dt>
          <dd>
            <SBadge :variant="roleVariant[auth.primaryRole ?? ''] ?? 'default'" size="sm">
              {{ roleLabel[auth.primaryRole ?? ''] ?? auth.primaryRole }}
            </SBadge>
          </dd>
        </div>
        <div v-if="auth.isEstudiante && carreras.length" class="flex items-center justify-between py-2">
          <dt class="text-xs font-medium text-slate-400 uppercase tracking-wider">Carreras inscritas</dt>
          <dd class="text-sm font-semibold text-slate-800">{{ carreras.length }}</dd>
        </div>
      </dl>
    </SCard>

  </div>
</template>

<style scoped>
.list-enter-active,
.list-leave-active {
  transition: all 0.25s ease;
}

.list-enter-from {
  opacity: 0;
  transform: translateY(-4px);
}

.list-leave-to {
  opacity: 0;
  transform: translateX(8px);
}
</style>