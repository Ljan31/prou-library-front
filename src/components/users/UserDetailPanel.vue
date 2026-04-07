<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useUiStore } from '@/stores/ui.store'
import { usePermissions } from '@/composables/usePermissions'
import { useUsers, roleLabel, roleBadgeClass } from '@/composables/useUsers'
import { useAuxAssign } from '@/composables/useAuxAssign'
import { carreraService } from '@/services/estudiante.service'
import { bibliotecasService } from '@/services/bibliotecas.service'
import type { UserResponse } from '@/services/user.service'
import type { CarreraBasic } from '@/services/estudiante.service'
import type { BibliotecaResponse } from '@/services/biblioteca.service'

const props = defineProps<{ user: UserResponse | null }>()
const emit = defineEmits<{ close: [] }>()

const ui = useUiStore()
const { isAdmin, isStaff } = usePermissions()
const { allCarreras, allBibliotecas } = useUsers()
const aux = useAuxAssign()
aux.watchCarrera()

// ── Safe helpers (prevents crash when persona is undefined) ────────────────
const safeNombreCompleto = computed(() =>
  props.user?.persona?.nombreCompleto ?? props.user?.username ?? ''
)
const safeInitials = computed(() => {
  const n = props.user?.persona?.nombre?.[0] ?? '?'
  const a = props.user?.persona?.apellido_pat?.[0] ?? ''
  return (n + a).toUpperCase()
})

// ── Role checks ────────────────────────────────────────────────────────────
const isEstudiante = computed(() =>
  props.user?.roles?.some(r => r.name === 'ROLE_ESTUDIANTE') ?? false
)
const isBibliotecario = computed(() =>
  props.user?.roles?.some(r => r.name === 'ROLE_BIBLIOTECARIO') ?? false
)
// Button visible: staff can manage students; admin can manage bibliotecarios
const canManageAux = computed(() => {
  if (isEstudiante.value && isStaff.value) return true
  if (isBibliotecario.value && isAdmin.value) return true
  return false
})

// ── Carreras del usuario (students only) ──────────────────────────────────
const detailCarreras = ref<CarreraBasic[]>([])
const detailCarrerasLoading = ref(false)

// ── Bibliotecas donde el usuario es encargado ─────────────────────────────
// Shown for ALL roles (admin, bibliotecario, estudiante)
const encargadoBibliotecas = ref<BibliotecaResponse[]>([])
const encargadoLoading = ref(false)

watch(() => props.user, async (u) => {
  detailCarreras.value = []
  encargadoBibliotecas.value = []
  aux.resetAux()
  if (!u) return

  // Always load libraries where the user is an encargado
  loadEncargadoBibliotecas(u.id_usuario)

  // Load carreras only for students
  if (isEstudiante.value) {
    fetchDetailCarreras(u.id_usuario)
  }
}, { immediate: true })

async function fetchDetailCarreras(usuarioId: number) {
  detailCarrerasLoading.value = true
  try {
    const res = await carreraService.getByUsuario(usuarioId)
    const raw = res.data as any
    detailCarreras.value = Array.isArray(raw) ? raw : (raw?.data ?? [])
  } catch { /* silent */ } finally { detailCarrerasLoading.value = false }
}

async function loadEncargadoBibliotecas(usuarioId: number) {
  encargadoLoading.value = true
  try {
    // Try global cache first
    const fromCache = allBibliotecas.value.filter(
      b => b.encargados?.some(e => e.id_usuario === usuarioId)
    )
    if (fromCache.length) {
      encargadoBibliotecas.value = fromCache
    } else {
      // Fallback: fetch all and filter
      const res = await bibliotecasService.getAll()
      const raw = res.data as any
      const all: BibliotecaResponse[] = Array.isArray(raw) ? raw : (raw?.data ?? [])
      encargadoBibliotecas.value = all.filter(b => b.encargados?.some(e => e.id_usuario === usuarioId))
    }
  } catch { /* silent */ } finally { encargadoLoading.value = false }
}

const detailAvailableCarreras = computed(() =>
  allCarreras.value.filter(c => !detailCarreras.value.some(uc => uc.id_carrera === c.id_carrera))
)

// ══════════════════════════════════════════════════════════════════════════
// MODAL: Asignar carrera
// ══════════════════════════════════════════════════════════════════════════
const showAssignModal = ref(false)
const assignCarreraId = ref<number | ''>('')
const assignMatricula = ref('')
const assignLoading = ref(false)
const assignError = ref('')

function openAssignModal() {
  assignCarreraId.value = ''
  assignMatricula.value = ''
  assignError.value = ''
  showAssignModal.value = true
}

async function handleAssignCarrera() {
  assignError.value = ''
  if (!assignCarreraId.value) { assignError.value = 'Selecciona una carrera'; return }
  if (!props.user) return
  assignLoading.value = true
  try {
    await carreraService.assign({
      usuarioId: props.user.id_usuario,
      carreraId: Number(assignCarreraId.value),
      matricula: assignMatricula.value.trim() || undefined,
    })
    await fetchDetailCarreras(props.user.id_usuario)
    showAssignModal.value = false
    ui.toast.success('Carrera asignada', '')
  } catch (e: unknown) {
    assignError.value = e instanceof Error ? e.message : 'No se pudo asignar'
  } finally { assignLoading.value = false }
}

// ══════════════════════════════════════════════════════════════════════════
// MODAL: Confirmar remover carrera
// ══════════════════════════════════════════════════════════════════════════
const showConfirmRemove = ref(false)
const carreraToRemove = ref<CarreraBasic | null>(null)
const removeLoading = ref(false)

function openConfirmRemove(carrera: CarreraBasic) {
  carreraToRemove.value = carrera
  showConfirmRemove.value = true
}

async function handleRemoveCarrera() {
  if (!props.user || !carreraToRemove.value) return
  removeLoading.value = true
  try {
    await carreraService.remove(props.user.id_usuario, carreraToRemove.value.id_carrera)
    detailCarreras.value = detailCarreras.value.filter(c => c.id_carrera !== carreraToRemove.value!.id_carrera)
    ui.toast.success('Carrera removida', carreraToRemove.value.nombre_carrera)
    showConfirmRemove.value = false
    carreraToRemove.value = null
  } catch (e: unknown) {
    ui.toast.error('Error', e instanceof Error ? e.message : 'No se pudo remover')
  } finally { removeLoading.value = false }
}

// ══════════════════════════════════════════════════════════════════════════
// MODAL: Asignar encargado/auxiliar de biblioteca
// ══════════════════════════════════════════════════════════════════════════
const showAuxModal = ref(false)

function openAuxModal() {
  aux.resetAux()
  // For bibliotecarios: load all libraries (no carrera filter needed)
  if (isBibliotecario.value) {
    aux.loadAllBibliotecasForPicker()
  }
  showAuxModal.value = true
}

async function handleAssignAux() {
  if (!props.user) return
  // Estudiantes need carrera filter; bibliotecarios don't
  const needsCarrera = isEstudiante.value
  const ok = await aux.assignAux(props.user, needsCarrera)
  if (ok) {
    // Reload this user's encargado libraries to reflect the change in the panel
    await loadEncargadoBibliotecas(props.user.id_usuario)
  }
}

// Library options for the aux modal
const auxBibliotecaOptions = computed(() => {
  if (isBibliotecario.value) {
    // Show all libraries (loaded into aux.auxBibliotecas via loadAllBibliotecasForPicker)
    return aux.auxBibliotecas.value.length ? aux.auxBibliotecas.value : allBibliotecas.value
  }
  // Estudiante: filtered by carrera via auxBibliotecas
  return aux.auxBibliotecas.value
})
</script>

<template>
  <template v-if="user">
    <!-- ── Panel principal ── -->
    <div class="bg-white rounded-xl border border-slate-200 overflow-hidden">

      <!-- Header -->
      <div class="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50/60">
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold shrink-0"
            :class="user.enabled ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500'">{{ safeInitials }}
          </div>
          <div>
            <p class="text-sm font-semibold text-slate-900">{{ safeNombreCompleto }}</p>
            <p class="text-xs text-slate-500 font-mono">@{{ user.username }}</p>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <button v-if="canManageAux"
            class="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-amber-50 text-amber-600 hover:bg-amber-100 border border-amber-200 font-medium transition-all"
            @click="openAuxModal">
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path
                d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75z"
                stroke-linecap="round" stroke-linejoin="round" />
            </svg>
            {{ isBibliotecario ? 'Asignar encargado' : 'Auxiliar de biblioteca' }}
          </button>
          <button
            class="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all"
            @click="emit('close')">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M6 18L18 6M6 6l12 12" stroke-linecap="round" />
            </svg>
          </button>
        </div>
      </div>

      <div class="p-5 space-y-5">

        <!-- Info grid -->
        <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 text-sm">
          <div>
            <p class="text-xs text-slate-400 mb-0.5">Email</p>
            <p class="text-slate-700 truncate">{{ user.persona?.email || '—' }}</p>
          </div>
          <div>
            <p class="text-xs text-slate-400 mb-0.5">CI</p>
            <p class="text-slate-700">{{ user.persona?.ci ?? '—' }}</p>
          </div>
          <div>
            <p class="text-xs text-slate-400 mb-0.5">Celular</p>
            <p class="text-slate-700">{{ user.persona?.celular || '—' }}</p>
          </div>
          <div>
            <p class="text-xs text-slate-400 mb-0.5">Biblioteca asignada</p>
            <p class="text-slate-700">{{ user.biblioteca?.nombre ?? '—' }}</p>
          </div>
          <div>
            <p class="text-xs text-slate-400 mb-0.5">Rol(es)</p>
            <div class="flex flex-wrap gap-1">
              <span v-for="r in (user.roles ?? [])" :key="r.id_role"
                class="text-xs px-2 py-0.5 rounded-full ring-1 font-medium" :class="roleBadgeClass(r.name)">{{
                  roleLabel(r.name) }}</span>
            </div>
          </div>
          <div>
            <p class="text-xs text-slate-400 mb-0.5">Estado</p>
            <span class="inline-flex items-center gap-1.5 text-xs font-medium"
              :class="user.enabled ? 'text-emerald-600' : 'text-red-500'">
              <span class="w-1.5 h-1.5 rounded-full" :class="user.enabled ? 'bg-emerald-500' : 'bg-red-500'" />
              {{ user.enabled ? 'Activo' : 'Inactivo' }}
            </span>
          </div>
        </div>

        <!-- ── Bibliotecas donde es encargado (ALL roles) ── -->
        <div v-if="encargadoLoading || encargadoBibliotecas.length" class="pt-4 border-t border-slate-100">
          <p class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Encargado en</p>
          <div v-if="encargadoLoading" class="flex items-center gap-1.5 text-xs text-slate-400">
            <svg class="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Cargando…
          </div>
          <div v-else class="flex flex-wrap gap-2">
            <div v-for="bib in encargadoBibliotecas" :key="bib.id_biblioteca"
              class="flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium" :class="bib.encargados?.find(e => e.id_usuario === user.id_usuario)?.rol === 'PRINCIPAL'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                : 'bg-slate-50 border-slate-200 text-slate-600'">
              <svg class="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path
                  d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18"
                  stroke-linecap="round" stroke-linejoin="round" />
              </svg>
              {{ bib.nombre }}
              <span class="opacity-50">·</span>
              {{bib.encargados?.find(e => e.id_usuario === user.id_usuario)?.rol ?? '—'}}
              <a v-if="bib.encargados?.find(e => e.id_usuario === user.id_usuario)?.imagenUrl"
                :href="bib.encargados?.find(e => e.id_usuario === user.id_usuario)?.imagenUrl!" target="_blank"
                class="underline text-indigo-500 hover:text-indigo-700 shrink-0">Resolución</a>
            </div>
          </div>
        </div>

        <!-- ── Carreras (solo estudiantes) ── -->
        <div v-if="isEstudiante" class="pt-4 border-t border-slate-100">
          <div class="flex items-center justify-between mb-3">
            <p class="text-xs font-semibold text-slate-500 uppercase tracking-wider">Carreras asignadas</p>
            <button v-if="isAdmin && detailAvailableCarreras.length"
              class="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-sky-50 text-sky-600 hover:bg-sky-100 border border-sky-200 font-medium transition-all"
              @click="openAssignModal">
              <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 5v14M5 12h14" stroke-linecap="round" />
              </svg>
              Asignar carrera
            </button>
          </div>

          <div v-if="detailCarrerasLoading" class="flex items-center gap-2 text-xs text-slate-400">
            <svg class="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Cargando carreras…
          </div>
          <div v-else-if="detailCarreras.length" class="flex flex-wrap gap-2">
            <div v-for="c in detailCarreras" :key="c.id_carrera"
              class="flex items-center gap-2 px-3 py-1.5 rounded-full bg-sky-50 border border-sky-100 text-sky-700 text-xs font-medium group">
              <svg class="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path
                  d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342"
                  stroke-linecap="round" stroke-linejoin="round" />
              </svg>
              {{ c.nombre_carrera }}
              <span v-if="c.matricula" class="text-sky-400 font-mono">· {{ c.matricula }}</span>
              <button v-if="isAdmin"
                class="ml-0.5 w-4 h-4 flex items-center justify-center rounded-full text-sky-300 hover:text-red-500 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100"
                @click="openConfirmRemove(c)">
                <svg class="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <path d="M6 18L18 6M6 6l12 12" stroke-linecap="round" />
                </svg>
              </button>
            </div>
          </div>
          <p v-else class="text-xs text-slate-400 italic">Sin carreras asignadas</p>
        </div>

      </div>
    </div>

    <!-- ══ MODAL: Asignar carrera ══ -->
    <Transition name="fade">
      <div v-if="showAssignModal"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
        @click.self="showAssignModal = false">
        <div class="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden">
          <div class="px-6 pt-6 pb-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 class="text-base font-semibold text-slate-900">Asignar carrera</h3>
              <p class="text-xs text-slate-500 mt-0.5">{{ safeNombreCompleto }}</p>
            </div>
            <button
              class="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all"
              @click="showAssignModal = false">
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M6 18L18 6M6 6l12 12" stroke-linecap="round" />
              </svg>
            </button>
          </div>
          <div class="p-6 space-y-4">
            <div>
              <label class="block text-xs font-medium text-slate-600 mb-1.5">Carrera <span
                  class="text-red-500">*</span></label>
              <select v-model="assignCarreraId"
                class="w-full h-10 px-3 text-sm rounded-lg border outline-none transition-all focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                :class="assignError ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-slate-50'">
                <option value="">Seleccionar carrera…</option>
                <option v-for="c in detailAvailableCarreras" :key="c.id_carrera" :value="c.id_carrera">
                  {{ c.nombre_carrera }}<template v-if="c.codigo_carrera"> ({{ c.codigo_carrera }})</template>
                </option>
              </select>
              <p v-if="assignError" class="text-xs text-red-500 mt-1">{{ assignError }}</p>
            </div>
            <div>
              <label class="block text-xs font-medium text-slate-600 mb-1.5">Matrícula</label>
              <input v-model="assignMatricula" type="text" placeholder="Ej. 2024-001234 (opcional)"
                class="w-full h-10 px-3 text-sm rounded-lg border border-slate-200 bg-slate-50 outline-none transition-all focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400" />
            </div>
          </div>
          <div class="px-6 pb-6 flex gap-3 justify-end">
            <button class="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              @click="showAssignModal = false">Cancelar</button>
            <button
              class="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 transition-colors disabled:opacity-50 flex items-center gap-2"
              :disabled="assignLoading" @click="handleAssignCarrera">
              <svg v-if="assignLoading" class="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              {{ assignLoading ? 'Asignando…' : 'Asignar carrera' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- ══ MODAL: Confirmar remover carrera ══ -->
    <Transition name="fade">
      <div v-if="showConfirmRemove"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
        @click.self="showConfirmRemove = false">
        <div class="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden">
          <div class="p-6 text-center">
            <div class="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <svg class="w-6 h-6 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path
                  d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
                  stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </div>
            <h3 class="text-base font-semibold text-slate-900 mb-2">¿Remover carrera?</h3>
            <p class="text-sm text-slate-500 leading-relaxed">
              Se quitará <span class="font-semibold text-slate-800">{{ carreraToRemove?.nombre_carrera }}</span>
              de <span class="font-semibold text-slate-800">{{ safeNombreCompleto }}</span>.
              <span class="text-xs text-slate-400 mt-1 block">La carrera seguirá existiendo en el sistema.</span>
            </p>
          </div>
          <div class="px-6 pb-6 flex gap-3">
            <button
              class="flex-1 px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors font-medium"
              @click="showConfirmRemove = false">Cancelar</button>
            <button
              class="flex-1 px-4 py-2.5 text-sm font-medium bg-red-500 text-white rounded-xl hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              :disabled="removeLoading" @click="handleRemoveCarrera">
              <svg v-if="removeLoading" class="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              {{ removeLoading ? 'Removiendo…' : 'Sí, remover' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- ══ MODAL: Asignar encargado / auxiliar ══ -->
    <Transition name="fade">
      <div v-if="showAuxModal"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
        @click.self="showAuxModal = false">
        <div class="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden">
          <div class="px-6 pt-6 pb-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 class="text-base font-semibold text-slate-900">
                {{ isBibliotecario ? 'Asignar encargado' : 'Auxiliar de biblioteca' }}
              </h3>
              <p class="text-xs text-slate-500 mt-0.5">{{ safeNombreCompleto }}</p>
            </div>
            <button
              class="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all"
              @click="showAuxModal = false">
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M6 18L18 6M6 6l12 12" stroke-linecap="round" />
              </svg>
            </button>
          </div>

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

            <!-- Carrera (ONLY for students) -->
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
                    : auxBibliotecaOptions.length
                      ? 'Seleccionar biblioteca…'
                      : 'Sin bibliotecas disponibles' }}
                </option>
                <option v-for="b in auxBibliotecaOptions" :key="b.id_biblioteca" :value="b.id_biblioteca">
                  {{ b.nombre }}
                </option>
              </select>

              <!-- Encargados actuales -->
              <template v-if="aux.auxBibliotecaId.value && aux.selectedBib()">
                <div v-if="aux.selectedBib()!.encargados?.length"
                  class="mt-2 p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                  <p class="text-xs text-slate-400 mb-1.5 font-medium">Encargados actuales</p>
                  <div class="flex flex-wrap gap-1.5">
                    <span v-for="enc in aux.selectedBib()!.encargados" :key="enc.id_usuario"
                      class="text-xs px-2 py-0.5 rounded-full font-medium"
                      :class="enc.rol === 'PRINCIPAL' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'">{{
                        enc.nombreCompleto }} · {{ enc.rol }}</span>
                  </div>
                </div>
              </template>
            </div>

            <!-- Imagen de resolución -->
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
            <div v-if="aux.auxSuccess.value" class="flex items-center gap-1.5 text-xs text-emerald-600">
              <svg class="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" stroke-linecap="round"
                  stroke-linejoin="round" />
              </svg>
              Asignación registrada correctamente
            </div>
          </div>

          <div class="px-6 pb-6 flex gap-3 justify-end">
            <button class="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              @click="showAuxModal = false">Cancelar</button>
            <button
              class="px-4 py-2 text-sm font-medium bg-amber-500 text-white rounded-lg hover:bg-amber-400 transition-colors disabled:opacity-50 flex items-center gap-2"
              :disabled="aux.auxLoading.value || !aux.auxBibliotecaId.value" @click="handleAssignAux">
              <svg v-if="aux.auxLoading.value" class="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              {{ aux.auxLoading.value ? 'Asignando…' : 'Confirmar asignación' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </template>
</template>