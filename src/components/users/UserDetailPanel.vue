<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useUiStore } from '@/stores/ui.store'
import { usePermissions } from '@/composables/usePermissions'
import { useUsers, roleLabel, roleBadgeClass } from '@/composables/useUsers'
import { useAuxAssign } from '@/composables/useAuxAssign'
import { carreraService } from '@/services/estudiante.service'
import { bibliotecasService } from '@/services/bibliotecas.service'
import type { EncargadoResponse, BibliotecaResponse } from '@/services/bibliotecas.service'
import type { UserResponse } from '@/services/user.service'
import type { CarreraBasic } from '@/services/estudiante.service'
import ConfirmModal from '@/components/ui/ConfirmModal.vue'
import RespaldoViewerModal from '@/components/bibliotecas/RespaldoViewerModal.vue'
import EncargadoFormModal from '@/components/bibliotecas/EncargadoFormModal.vue'
const props = defineProps<{ user: UserResponse | null }>()
const emit = defineEmits<{ close: [] }>()

const ui = useUiStore()
const { isAdmin, isStaff } = usePermissions()
const { allCarreras, allBibliotecas } = useUsers()
const aux = useAuxAssign()
aux.watchCarrera()

// ── Safe helpers ──────────────────────────────────────────────────────────
const safeNombreCompleto = computed(() =>
  props.user?.persona?.nombreCompleto ?? props.user?.username ?? ''
)
const safeInitials = computed(() => {
  const n = props.user?.persona?.nombre?.[0] ?? '?'
  const a = props.user?.persona?.apellido_pat?.[0] ?? ''
  return (n + a).toUpperCase()
})

// ── Role checks ───────────────────────────────────────────────────────────
const isEstudiante = computed(() =>
  props.user?.roles?.some(r => r.name === 'ROLE_ESTUDIANTE') ?? false
)
const isBibliotecario = computed(() =>
  props.user?.roles?.some(r => r.name === 'ROLE_BIBLIOTECARIO') ?? false
)
const canManageAux = computed(() => {
  // if (isEstudiante.value && isStaff.value) return true
  if (isBibliotecario.value && isAdmin.value) return true
  return false
})

// ── Carreras del usuario (students only) ──────────────────────────────────
const detailCarreras = ref<CarreraBasic[]>([])
const detailCarrerasLoading = ref(false)

// ── Bibliotecas donde el usuario es encargado ─────────────────────────────
// Tuple: { bib, encargado } — encargado is the specific record for this user
interface EncargadoEntry {
  bib: BibliotecaResponse
  encargado: EncargadoResponse
}
const encargadoEntries = ref<EncargadoEntry[]>([])
const encargadoLoading = ref(false)

watch(() => props.user, async (u) => {
  detailCarreras.value = []
  encargadoEntries.value = []
  aux.resetAux()
  if (!u) return
  loadEncargadoBibliotecas(u.id_usuario)
  if (isEstudiante.value) fetchDetailCarreras(u.id_usuario)
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
    const fromCache = allBibliotecas.value.filter(
      b => b.encargados?.some(e => e.id_usuario === usuarioId)
    )
    const source: BibliotecaResponse[] = fromCache.length ? fromCache : await fetchAllBibliotecas()
    encargadoEntries.value = source
      .flatMap(bib => {
        const enc = bib.encargados?.find(e => e.idUsuario === usuarioId)
        return enc ? [{ bib, encargado: enc }] : []
      })
  } catch { /* silent */ } finally { encargadoLoading.value = false }
}

async function fetchAllBibliotecas(): Promise<BibliotecaResponse[]> {
  const res = await bibliotecasService.getAll()
  const raw = res.data as any
  return Array.isArray(raw) ? raw : (raw?.data ?? [])
}

const detailAvailableCarreras = computed(() =>
  allCarreras.value.filter(c => !detailCarreras.value.some(uc => uc.id_carrera === c.id_carrera))
)

// ══════════════════════════════════════════════════════════════════════════
// REMOVER ENCARGADO DE BIBLIOTECA
// Permisos:
//   - Admin puede remover cualquier encargado (PRINCIPAL o AUXILIAR)
//   - Bibliotecario puede remover solo auxiliares que sean estudiantes
// ══════════════════════════════════════════════════════════════════════════
const showRemoveEncargado = ref(false)
const removeEncargadoEntry = ref<EncargadoEntry | null>(null)
const removeEncargadoLoading = ref(false)

function canRemoveEncargado(entry: EncargadoEntry): boolean {
  if (isAdmin.value) return true
  // Bibliotecario can only remove AUXILIAR students
  if (isStaff.value && entry.encargado.rol === 'AUXILIAR' && isEstudiante.value) return true
  return false
}

function openRemoveEncargado(entry: EncargadoEntry) {
  removeEncargadoEntry.value = entry
  showRemoveEncargado.value = true
}

async function handleRemoveEncargado() {
  if (!props.user || !removeEncargadoEntry.value) return
  removeEncargadoLoading.value = true
  try {
    await bibliotecasService.removeEncargado(
      removeEncargadoEntry.value.bib.id_biblioteca,
      props.user.id_usuario
    )
    // Remove from local list immediately
    encargadoEntries.value = encargadoEntries.value.filter(
      e => e.bib.id_biblioteca !== removeEncargadoEntry.value!.bib.id_biblioteca
    )
    showRemoveEncargado.value = false
    ui.toast.success('Encargado removido', `${safeNombreCompleto.value} fue removido de ${removeEncargadoEntry.value.bib.nombre}`)
    removeEncargadoEntry.value = null
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'No se pudo remover el encargado'
    ui.toast.error('Error', msg)
  } finally { removeEncargadoLoading.value = false }
}

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
  if (isBibliotecario.value) aux.loadAllBibliotecasForPicker()
  showAuxModal.value = true
}

async function handleAssignAux() {
  if (!props.user) return
  const needsCarrera = isEstudiante.value
  const ok = await aux.assignAux(props.user, needsCarrera)
  if (ok) await loadEncargadoBibliotecas(props.user.id_usuario)
}

const auxBibliotecaOptions = computed(() => {
  if (isBibliotecario.value) {
    return aux.auxBibliotecas.value.length ? aux.auxBibliotecas.value : allBibliotecas.value
  }
  return aux.auxBibliotecas.value
})

// ── Validación de duplicado de asignación ─────────────────────────────────
const yaEstaAsignadoEnEstaBiblioteca = computed(() => {
  if (!props.user || !aux.auxBibliotecaId.value) return false

  const bibId = Number(aux.auxBibliotecaId.value)
  return encargadoEntries.value.some(entry =>
    entry.bib.id_biblioteca === bibId
  )
})

// Mensaje para mostrar al usuario
const mensajeDuplicado = computed(() => {
  if (!yaEstaAsignadoEnEstaBiblioteca.value) return ''

  const entry = encargadoEntries.value.find(e =>
    e.bib.id_biblioteca === Number(aux.auxBibliotecaId.value)
  )
  const rol = entry?.encargado.rol || 'ENCARGADO'

  return `Este usuario ya está asignado como ${rol} en esta biblioteca.`
})

async function onEncargadoAssigned() {
  if (props.user) await loadEncargadoBibliotecas(props.user.id_usuario)
}

async function onEncargadoUpdated() {
  if (props.user) await loadEncargadoBibliotecas(props.user.id_usuario)
}

// ── Rol color helpers ──────────────────────────────────────────────────────
const rolEncargadoStyle: Record<string, string> = {
  PRINCIPAL: 'bg-emerald-100 text-emerald-700 ring-emerald-200',
  AUXILIAR: 'bg-slate-100 text-slate-600 ring-slate-200',
}

const showRespaldoModal = ref(false)
const respaldoActual = ref<string | null>(null)

function openRespaldo(url: string) {
  respaldoActual.value = url
  showRespaldoModal.value = true
}
// ══════════════════════════════════════════════════════════════════════════
// EncargadoFormModal — create & edit modes
// ══════════════════════════════════════════════════════════════════════════
const showEncargadoModal = ref(false)
const encargadoModalMode = ref<'create' | 'edit'>('create')
const encargadoEditEntry = ref<EncargadoEntry | null>(null)

function openEncargadoCreate() {
  encargadoModalMode.value = 'create'
  encargadoEditEntry.value = null
  showEncargadoModal.value = true
}

function openEncargadoEdit(entry: EncargadoEntry) {
  encargadoModalMode.value = 'edit'
  encargadoEditEntry.value = entry
  showEncargadoModal.value = true
}
</script>

<template>
  <div v-if="user">

    <!-- ══════════════════════════════════════════════════════════════════
         PANEL PRINCIPAL
    ══════════════════════════════════════════════════════════════════ -->
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
            @click="openEncargadoCreate">
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

        <!-- ══ Bibliotecas donde es encargado ══ -->
        <div v-if="encargadoLoading || encargadoEntries.length" class="pt-4 border-t border-slate-100">
          <p class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Encargado en</p>

          <div v-if="encargadoLoading" class="flex items-center gap-1.5 text-xs text-slate-400">
            <svg class="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Cargando…
          </div>

          <div v-else class="space-y-2">
            <div v-for="entry in encargadoEntries" :key="entry.bib.id_biblioteca"
              class="flex items-center gap-3 px-4 py-3 rounded-xl border bg-white group transition-colors" :class="entry.encargado.rol === 'PRINCIPAL'
                ? 'border-emerald-200 bg-emerald-50/40'
                : 'border-slate-200 hover:border-slate-300'">
              <!-- Library icon -->
              <div class="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                :class="entry.encargado.rol === 'PRINCIPAL' ? 'bg-emerald-100' : 'bg-slate-100'">
                <svg class="w-4.5 h-4.5"
                  :class="entry.encargado.rol === 'PRINCIPAL' ? 'text-emerald-600' : 'text-slate-500'"
                  viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                  <path
                    d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75z"
                    stroke-linecap="round" stroke-linejoin="round" />
                </svg>
              </div>

              <!-- Info -->
              <div class="flex-1 min-w-0">
                <p class="text-sm font-semibold text-slate-900 truncate">{{ entry.bib.nombre }}</p>
                <div class="flex items-center gap-2 mt-0.5">
                  <!-- Rol badge -->
                  <span class="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full ring-1"
                    :class="rolEncargadoStyle[entry.encargado.rol] ?? rolEncargadoStyle.AUXILIAR">{{ entry.encargado.rol
                    }}</span>

                  <!-- Carrera de la biblioteca -->
                  <span v-if="entry.bib.carrera" class="text-xs text-slate-400 truncate">
                    {{ entry.bib.carrera.nombre_carrera }}
                  </span>
                </div>
              </div>

              <!-- Resolución link + remove button -->
              <div class="flex items-center gap-1.5 shrink-0">
                <button v-if="entry.encargado.respaldoUrl" type="button"
                  class="flex items-center gap-1 text-xs text-indigo-500 hover:text-indigo-700 transition-colors font-medium"
                  title="Ver resolución" @click.stop="openRespaldo(entry.encargado.respaldoUrl)">
                  <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path
                      d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"
                      stroke-linecap="round" stroke-linejoin="round" />
                  </svg>
                  Resolución
                </button>
                <!-- Editar -->
                <button class="w-9 h-9 flex items-center justify-center rounded-lg
           bg-amber-50 text-amber-600 border border-amber-100
           hover:bg-amber-100 transition-all" title="Editar encargado" @click="openEncargadoEdit(entry)">
                  <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path
                      d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897L16.862 4.487z"
                      stroke-linecap="round" stroke-linejoin="round" />
                  </svg>
                </button>
                <!-- Remove button — permission-gated -->
                <button v-if="canRemoveEncargado(entry)" class="w-9 h-9 flex items-center justify-center rounded-lg
           bg-red-50 text-red-500 border border-red-100
           hover:bg-red-100 transition-all" title="Remover encargado" @click="openRemoveEncargado(entry)">
                  <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path
                      d="M6 7h12M9 7V5.75A1.75 1.75 0 0110.75 4h2.5A1.75 1.75 0 0115 5.75V7m-7 0v11.25A1.75 1.75 0 009.75 20h4.5A1.75 1.75 0 0016 18.25V7"
                      stroke-linecap="round" stroke-linejoin="round" />
                  </svg>
                </button>
              </div>
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


    <!-- ══════════════════════════════════════════════════════════════════
         MODAL: Asignar carrera
    ══════════════════════════════════════════════════════════════════ -->
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

    <!-- ══════════════════════════════════════════════════════════════════
         MODAL: Confirmar remover CARRERA (reutiliza ConfirmModal)
    ══════════════════════════════════════════════════════════════════ -->
    <ConfirmModal v-model="showConfirmRemove" title="¿Remover carrera?" variant="danger" confirm-label="Sí, remover"
      :loading="removeLoading" @confirm="handleRemoveCarrera">
      Se quitará
      <span class="font-semibold text-slate-800">{{ carreraToRemove?.nombre_carrera }}</span>
      de
      <span class="font-semibold text-slate-800">{{ safeNombreCompleto }}</span>.
      <span class="text-xs text-slate-400 mt-1 block">La carrera seguirá existiendo en el sistema.</span>
    </ConfirmModal>

    <!-- ══════════════════════════════════════════════════════════════════
         MODAL: Confirmar remover ENCARGADO (reutiliza ConfirmModal)
    ══════════════════════════════════════════════════════════════════ -->
    <ConfirmModal v-model="showRemoveEncargado" title="¿Remover encargado?" variant="danger" confirm-label="Sí, remover"
      :loading="removeEncargadoLoading" @confirm="handleRemoveEncargado">
      Se removerá a
      <span class="font-semibold text-slate-800">{{ safeNombreCompleto }}</span>
      como encargado de
      <span class="font-semibold text-slate-800">{{ removeEncargadoEntry?.bib.nombre }}</span>.
      <span class="text-xs text-slate-400 mt-1 block">El usuario seguirá activo en el sistema.</span>
    </ConfirmModal>

    <!-- ══════════════════════════════════════════════════════════════════
         MODAL: Asignar encargado / auxiliar
    ══════════════════════════════════════════════════════════════════ -->


    <EncargadoFormModal v-model="showEncargadoModal" :mode="encargadoModalMode" :user="user"
      :is-estudiante="isEstudiante" :is-bibliotecario="isBibliotecario" :detail-carreras="detailCarreras"
      :edit-entry="encargadoEditEntry" :encargado-entries="encargadoEntries" @assigned="onEncargadoAssigned"
      @updated="onEncargadoUpdated" />

    <RespaldoViewerModal v-model="showRespaldoModal" :url="respaldoActual" />
  </div>
</template>