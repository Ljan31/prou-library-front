<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { useUiStore } from '@/stores/ui.store'
import { usePermissions } from '@/composables/usePermissions'
import { userService } from '@/services/user.service'
import type { UserResponse, RoleData, CreateUserPayload, UpdateUserPayload } from '@/services/user.service'
import { carreraService } from '@/services/estudiante.service'
import type { CarreraBasic } from '@/services/estudiante.service'
import api from '@/services/axios'

const ui = useUiStore()
const { isAdmin } = usePermissions()

onMounted(() => {
  ui.setBreadcrumbs([{ label: 'Usuarios' }])
  fetchUsers()
  fetchRoles()
  loadAllCarreras()
  loadBibliotecas()
})

// ─── Users list ───────────────────────────────────────────────────────────
const users = ref<UserResponse[]>([])
const roles = ref<RoleData[]>([])
const loading = ref(false)
const error = ref<string | null>(null)

const searchQuery = ref('')
const filterRole = ref('')
let debounceTimer: ReturnType<typeof setTimeout>

function onSearchInput() {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => fetchUsers(), 400)
}
watch(filterRole, () => fetchUsers())

async function fetchUsers() {
  loading.value = true
  error.value = null
  try {
    let res
    if (searchQuery.value.trim()) res = await userService.search(searchQuery.value.trim())
    else if (filterRole.value) res = await userService.filterByRole(filterRole.value)
    else res = await userService.getAll()
    users.value = res.data.data
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'Error al cargar usuarios'
  } finally {
    loading.value = false
  }
}

async function fetchRoles() {
  try {
    const res = await userService.getRoles()
    roles.value = res.data.data
  } catch { /* silent */ }
}

// ─── Global catalogs ──────────────────────────────────────────────────────
const allCarreras = ref<{ id_carrera: number; nombre_carrera: string; codigo_carrera: string | null }[]>([])
const allBibliotecas = ref<{ id_biblioteca: number; nombre: string }[]>([])

async function loadAllCarreras() {
  try { allCarreras.value = (await carreraService.getAll()).data.data } catch { /* silent */ }
}
async function loadBibliotecas() {
  try { allBibliotecas.value = (await api.get('/bibliotecas')).data.data } catch { /* silent */ }
}

// ─── Role helpers ─────────────────────────────────────────────────────────
const roleLabelMap: Record<string, string> = {
  ROLE_ADMIN: 'Admin',
  ROLE_BIBLIOTECARIO: 'Bibliotecario',
  ROLE_ESTUDIANTE: 'Estudiante',
}
const roleBadgeMap: Record<string, string> = {
  ROLE_ADMIN: 'bg-indigo-100 text-indigo-700 ring-indigo-200',
  ROLE_BIBLIOTECARIO: 'bg-emerald-100 text-emerald-700 ring-emerald-200',
  ROLE_ESTUDIANTE: 'bg-sky-100 text-sky-700 ring-sky-200',
}
function roleLabel(name: string) { return roleLabelMap[name] ?? name }
function roleBadgeClass(name: string) { return roleBadgeMap[name] ?? 'bg-slate-100 text-slate-600 ring-slate-200' }
function roleNameForId(id: string | number) { return roles.value.find(r => r.id_role === Number(id))?.name ?? '' }

// ─── Toggle enabled ───────────────────────────────────────────────────────
const togglingId = ref<number | null>(null)

async function toggleEnabled(user: UserResponse) {
  togglingId.value = user.id_usuario
  try {
    const res = await userService.toggleEnabled(user.id_usuario)
    const idx = users.value.findIndex(u => u.id_usuario === user.id_usuario)
    if (idx !== -1) users.value[idx] = res.data.data
    ui.toast.success(res.data.enabled ? 'Usuario activado' : 'Usuario desactivado', res.data.persona.nombreCompleto ?? res.data.username)
  } catch (e: unknown) {
    ui.toast.error('Error', e instanceof Error ? e.message : 'No se pudo cambiar el estado')
  } finally { togglingId.value = null }
}

// ─── Stats ────────────────────────────────────────────────────────────────
const stats = computed(() => ({
  total: users.value.length,
  active: users.value.filter(u => u.enabled).length,
  // admins: users.value.filter(u => u.roles.some(r => r.name === 'ROLE_ADMIN')).length,
  admins: users.value.filter(
    u => Array.isArray(u.roles) && u.roles.some(r => r.name === 'ROLE_ADMIN')
  ).length,
  // bibliotecarios: users.value.filter(u => u.roles.some(r => r.name === 'ROLE_BIBLIOTECARIO')).length,
  // estudiantes: users.value.filter(u => u.roles.some(r => r.name === 'ROLE_ESTUDIANTE')).length,
  bibliotecarios: users.value.filter(
    u => Array.isArray(u.roles) && u.roles.some(r => r.name === 'ROLE_BIBLIOTECARIO')
  ).length,

  estudiantes: users.value.filter(
    u => Array.isArray(u.roles) && u.roles.some(r => r.name === 'ROLE_ESTUDIANTE')
  ).length
}))

// ─── Pagination ───────────────────────────────────────────────────────────
const PAGE_SIZE = 10
const currentPage = ref(1)
const totalPages = computed(() => Math.max(1, Math.ceil(users.value.length / PAGE_SIZE)))
const paginatedUsers = computed(() => users.value.slice((currentPage.value - 1) * PAGE_SIZE, currentPage.value * PAGE_SIZE))
watch(users, () => { currentPage.value = 1 })

const filterRoleOptions = [
  { value: '', label: 'Todos los roles' },
  { value: 'ADMIN', label: 'Administrador' },
  { value: 'BIBLIOTECARIO', label: 'Bibliotecario' },
  { value: 'ESTUDIANTE', label: 'Estudiante' },
]

// ══════════════════════════════════════════════════════════════════════════
// MODAL: CREAR USUARIO (inteligente por rol)
// ══════════════════════════════════════════════════════════════════════════
const showCreateModal = ref(false)
const createLoading = ref(false)

const createForm = reactive({
  username: '',
  password: '',
  nombre: '',
  apellido_pat: '',
  apellido_mat: '',
  ci: '',
  celular: '',
  email: '',
  roleId: '' as string | number,
  // Bibliotecario
  bibliotecaId: '' as string | number,
  // Estudiante — carreras pre-asignadas
  carreras: [] as { carreraId: number; nombre: string; matricula: string }[],
  _pickerCarreraId: '' as number | '',
  _pickerMatricula: '',
})
const createErrors = reactive<Record<string, string>>({})

const selectedRoleName = computed(() => roleNameForId(createForm.roleId))
const isCreatingEstudiante = computed(() => selectedRoleName.value === 'ROLE_ESTUDIANTE')
const isCreatingBibliotecario = computed(() => selectedRoleName.value === 'ROLE_BIBLIOTECARIO')
const createAvailableCarreras = computed(() =>
  allCarreras.value.filter(c => !createForm.carreras.some(s => s.carreraId === c.id_carrera))
)

watch(() => createForm.roleId, () => {
  createForm.bibliotecaId = ''
  createForm.carreras = []
  createForm._pickerCarreraId = ''
  createForm._pickerMatricula = ''
  delete createErrors.bibliotecaId
  delete createErrors._pickerCarreraId
})

function openCreateModal() {
  Object.assign(createForm, {
    username: '', password: '', nombre: '', apellido_pat: '',
    apellido_mat: '', ci: '', celular: '', email: '',
    roleId: '', bibliotecaId: '', carreras: [],
    _pickerCarreraId: '', _pickerMatricula: '',
  })
  Object.keys(createErrors).forEach(k => delete createErrors[k])
  showCreateModal.value = true
}

function addCreateCarrera() {
  delete createErrors._pickerCarreraId
  if (!createForm._pickerCarreraId) { createErrors._pickerCarreraId = 'Selecciona una carrera'; return }
  const found = allCarreras.value.find(c => c.id_carrera === Number(createForm._pickerCarreraId))
  if (!found) return
  createForm.carreras.push({ carreraId: found.id_carrera, nombre: found.nombre_carrera, matricula: createForm._pickerMatricula.trim() })
  createForm._pickerCarreraId = ''
  createForm._pickerMatricula = ''
}

function removeCreateCarrera(carreraId: number) {
  createForm.carreras = createForm.carreras.filter(c => c.carreraId !== carreraId)
}

function validateCreate(): boolean {
  Object.keys(createErrors).forEach(k => delete createErrors[k])
  if (!createForm.username.trim()) createErrors.username = 'Requerido'
  if (!createForm.password) createErrors.password = 'Requerido'
  else if (createForm.password.length < 8) createErrors.password = 'Mínimo 8 caracteres'
  if (!createForm.nombre.trim()) createErrors.nombre = 'Requerido'
  if (!createForm.apellido_pat.trim()) createErrors.apellido_pat = 'Requerido'
  if (!createForm.ci.trim() || isNaN(Number(createForm.ci))) createErrors.ci = 'CI numérico requerido'
  if (!createForm.email.trim()) createErrors.email = 'Requerido'
  if (!createForm.roleId) createErrors.roleId = 'Selecciona un rol'
  if (isCreatingBibliotecario.value && !createForm.bibliotecaId) createErrors.bibliotecaId = 'Selecciona una biblioteca'
  return Object.keys(createErrors).length === 0
}

async function handleCreate() {
  if (!validateCreate()) return
  createLoading.value = true
  try {
    if (isCreatingEstudiante.value) {
      const { estudianteService } = await import('@/services/estudiante.service')
      const res = await estudianteService.register({
        username: String(createForm.username),
        password: createForm.password,
        persona: {
          nombre: createForm.nombre,
          apellido_pat: createForm.apellido_pat,
          apellido_mat: createForm.apellido_mat || undefined,
          ci: Number(createForm.ci),
          celular: createForm.celular || undefined,
          email: createForm.email,
        },
        userCarreras: createForm.carreras.length
          ? createForm.carreras.map(c => ({ carreraId: c.carreraId, matricula: c.matricula || undefined }))
          : undefined,
      })
      const newUser = (res.data as any).data
      if (newUser) users.value.unshift(newUser)
    } else {
      const payload: CreateUserPayload & { bibliotecaId?: number } = {
        username: String(createForm.username),
        password: createForm.password,
        persona: {
          nombre: createForm.nombre,
          apellido_pat: createForm.apellido_pat,
          apellido_mat: createForm.apellido_mat,
          ci: Number(createForm.ci),
          celular: createForm.celular,
          email: createForm.email,
        },
        roleIds: [Number(createForm.roleId)],
        ...(isCreatingBibliotecario.value && createForm.bibliotecaId ? { bibliotecaId: Number(createForm.bibliotecaId) } : {}),
      }
      const res = await userService.create(payload)
      users.value.unshift(res.data)
    }
    showCreateModal.value = false
    ui.toast.success('Usuario creado', `${createForm.nombre} ${createForm.apellido_pat}`)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Error al crear usuario'
    if (msg.toLowerCase().includes('username')) createErrors.username = msg
    else if (msg.toLowerCase().includes('ci')) createErrors.ci = msg
    else if (msg.toLowerCase().includes('email')) createErrors.email = msg
    else ui.toast.error('Error', msg)
  } finally { createLoading.value = false }
}

// ══════════════════════════════════════════════════════════════════════════
// MODAL: EDITAR USUARIO
// ══════════════════════════════════════════════════════════════════════════
const showEditModal = ref(false)
const editLoading = ref(false)
const editingUser = ref<UserResponse | null>(null)
const editForm = reactive({ nombre: '', apellido_pat: '', apellido_mat: '', celular: '', enabled: true })
const editErrors = reactive<Record<string, string>>({})

function openEditModal(user: UserResponse) {
  editingUser.value = user
  Object.assign(editForm, {
    nombre: user.persona.nombre,
    apellido_pat: user.persona.apellido_pat,
    apellido_mat: user.persona.apellido_mat ?? '',
    celular: user.persona.celular ?? '',
    enabled: user.enabled,
  })
  Object.keys(editErrors).forEach(k => delete editErrors[k])
  showEditModal.value = true
}

function validateEdit(): boolean {
  Object.keys(editErrors).forEach(k => delete editErrors[k])
  if (!editForm.nombre.trim()) editErrors.nombre = 'Requerido'
  if (!editForm.apellido_pat.trim()) editErrors.apellido_pat = 'Requerido'
  return Object.keys(editErrors).length === 0
}

async function handleEdit() {
  if (!editingUser.value || !validateEdit()) return
  editLoading.value = true
  try {
    const payload: UpdateUserPayload = {
      nombre: editForm.nombre,
      apellido_pat: editForm.apellido_pat,
      apellido_mat: editForm.apellido_mat,
      celular: editForm.celular,
      enabled: editForm.enabled,
    }
    const res = await userService.update(editingUser.value.id_usuario, payload)
    const idx = users.value.findIndex(u => u.id_usuario === editingUser.value!.id_usuario)
    if (idx !== -1) users.value[idx] = res.data
    showEditModal.value = false
    ui.toast.success('Usuario actualizado', res.data.persona.nombreCompleto ?? res.data.username)
  } catch (e: unknown) {
    ui.toast.error('Error', e instanceof Error ? e.message : 'No se pudo actualizar')
  } finally { editLoading.value = false }
}

// ══════════════════════════════════════════════════════════════════════════
// PANEL DE DETALLE
// ══════════════════════════════════════════════════════════════════════════
const selectedUser = ref<UserResponse | null>(null)
const detailCarreras = ref<CarreraBasic[]>([])
const detailCarrerasLoading = ref(false)

function viewDetail(user: UserResponse) {
  if (selectedUser.value?.id_usuario === user.id_usuario) {
    selectedUser.value = null
    detailCarreras.value = []
    return
  }
  selectedUser.value = user
  detailCarreras.value = []
  if (user.roles.some(r => r.name === 'ROLE_ESTUDIANTE')) fetchDetailCarreras(user.id_usuario)
}

async function fetchDetailCarreras(usuarioId: number) {
  detailCarrerasLoading.value = true
  try {
    detailCarreras.value = (await carreraService.getByUsuario(usuarioId)).data.data ?? []
  } catch { /* silent */ } finally { detailCarrerasLoading.value = false }
}

const detailAvailableCarreras = computed(() =>
  allCarreras.value.filter(c => !detailCarreras.value.some(uc => uc.id_carrera === c.id_carrera))
)

// ══════════════════════════════════════════════════════════════════════════
// MODAL: ASIGNAR CARRERA (desde panel de detalle)
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
  if (!selectedUser.value) return
  assignLoading.value = true
  try {
    await carreraService.assign({
      usuarioId: selectedUser.value.id_usuario,
      carreraId: Number(assignCarreraId.value),
      matricula: assignMatricula.value.trim() || undefined,
    })
    await fetchDetailCarreras(selectedUser.value.id_usuario)
    showAssignModal.value = false
    ui.toast.success('Carrera asignada', '')
  } catch (e: unknown) {
    assignError.value = e instanceof Error ? e.message : 'No se pudo asignar'
  } finally { assignLoading.value = false }
}

// ══════════════════════════════════════════════════════════════════════════
// MODAL: CONFIRMAR REMOVER CARRERA
// ══════════════════════════════════════════════════════════════════════════
const showConfirmRemove = ref(false)
const carreraToRemove = ref<CarreraBasic | null>(null)
const removeLoading = ref(false)

function openConfirmRemove(carrera: CarreraBasic) {
  carreraToRemove.value = carrera
  showConfirmRemove.value = true
}

async function handleRemoveCarrera() {
  if (!selectedUser.value || !carreraToRemove.value) return
  removeLoading.value = true
  try {
    await carreraService.remove(selectedUser.value.id_usuario, carreraToRemove.value.id_carrera)
    detailCarreras.value = detailCarreras.value.filter(c => c.id_carrera !== carreraToRemove.value!.id_carrera)
    ui.toast.success('Carrera removida', carreraToRemove.value.nombre_carrera)
    showConfirmRemove.value = false
    carreraToRemove.value = null
  } catch (e: unknown) {
    ui.toast.error('Error', e instanceof Error ? e.message : 'No se pudo remover')
  } finally { removeLoading.value = false }
}
</script>

<template>
  <div class="page-container space-y-6">

    <!-- ── Header ── -->
    <div class="flex items-start justify-between gap-4">
      <div>
        <h1 class="text-xl font-semibold text-slate-900">Gestión de Usuarios</h1>
        <p class="text-sm text-slate-500 mt-0.5">Administra cuentas, roles y accesos del sistema</p>
      </div>
      <button v-if="isAdmin"
        class="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-500 transition-colors shadow-sm shrink-0"
        @click="openCreateModal">
        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 5v14M5 12h14" stroke-linecap="round" />
        </svg>
        Nuevo usuario
      </button>
    </div>

    <!-- ── Stats ── -->
    <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      <div class="bg-white rounded-xl border border-slate-200 p-4">
        <p class="text-xs text-slate-500 mb-1">Total</p>
        <p class="text-2xl font-bold text-slate-900">{{ stats.total }}</p>
      </div>
      <div class="bg-white rounded-xl border border-slate-200 p-4">
        <p class="text-xs text-slate-500 mb-1">Activos</p>
        <p class="text-2xl font-bold text-emerald-600">{{ stats.active }}</p>
      </div>
      <div class="bg-white rounded-xl border border-slate-200 p-4">
        <p class="text-xs text-slate-500 mb-1">Admins</p>
        <p class="text-2xl font-bold text-indigo-600">{{ stats.admins }}</p>
      </div>
      <div class="bg-white rounded-xl border border-slate-200 p-4">
        <p class="text-xs text-slate-500 mb-1">Bibliotecarios</p>
        <p class="text-2xl font-bold text-emerald-700">{{ stats.bibliotecarios }}</p>
      </div>
      <div class="bg-white rounded-xl border border-slate-200 p-4 col-span-2 sm:col-span-1">
        <p class="text-xs text-slate-500 mb-1">Estudiantes</p>
        <p class="text-2xl font-bold text-sky-600">{{ stats.estudiantes }}</p>
      </div>
    </div>

    <!-- ── Filters ── -->
    <div class="bg-white rounded-xl border border-slate-200 p-4 flex flex-col sm:flex-row gap-3">
      <div class="relative flex-1">
        <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none"
          viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8" />
          <path d="M21 21l-4.35-4.35" />
        </svg>
        <input v-model="searchQuery" type="text" placeholder="Buscar por nombre, usuario o CI…"
          class="w-full h-9 pl-9 pr-3 text-sm rounded-lg border border-slate-200 bg-slate-50 text-slate-900 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all"
          @input="onSearchInput" />
      </div>
      <select v-model="filterRole"
        class="h-9 px-3 text-sm rounded-lg border border-slate-200 bg-slate-50 text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all">
        <option v-for="opt in filterRoleOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
      </select>
      <button
        class="h-9 px-3 rounded-lg border border-slate-200 text-slate-500 hover:text-slate-700 hover:border-slate-300 transition-all"
        @click="fetchUsers">
        <svg class="w-4 h-4" :class="{ 'animate-spin': loading }" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          stroke-width="2">
          <path
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </button>
    </div>

    <!-- ── Table ── -->
    <div class="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <template v-if="loading">
        <div class="p-4 space-y-3">
          <div v-for="i in 5" :key="i" class="flex items-center gap-4">
            <div class="w-8 h-8 rounded-full bg-slate-100 animate-pulse shrink-0" />
            <div class="flex-1 space-y-1.5">
              <div class="h-3 bg-slate-100 rounded animate-pulse w-1/3" />
              <div class="h-2.5 bg-slate-100 rounded animate-pulse w-1/4" />
            </div>
            <div class="h-6 w-20 bg-slate-100 rounded-full animate-pulse" />
          </div>
        </div>
      </template>

      <div v-else-if="error" class="flex flex-col items-center justify-center py-16 gap-3">
        <svg class="w-10 h-10 text-red-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <p class="text-sm text-slate-500">{{ error }}</p>
        <button class="text-sm text-indigo-600 hover:underline" @click="fetchUsers">Reintentar</button>
      </div>

      <div v-else-if="!users.length" class="flex flex-col items-center justify-center py-16 gap-3">
        <svg class="w-10 h-10 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path
            d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"
            stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        <p class="text-sm font-medium text-slate-500">No se encontraron usuarios</p>
        <p class="text-xs text-slate-400">Prueba con otros filtros o crea un nuevo usuario</p>
      </div>

      <template v-else>
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-slate-100 bg-slate-50/60">
                <th class="text-left text-xs font-medium text-slate-500 px-4 py-3">Usuario</th>
                <th class="text-left text-xs font-medium text-slate-500 px-4 py-3 hidden md:table-cell">CI</th>
                <th class="text-left text-xs font-medium text-slate-500 px-4 py-3 hidden lg:table-cell">Username</th>
                <th class="text-left text-xs font-medium text-slate-500 px-4 py-3">Rol(es)</th>
                <th class="text-left text-xs font-medium text-slate-500 px-4 py-3 hidden xl:table-cell">Biblioteca</th>
                <th class="text-left text-xs font-medium text-slate-500 px-4 py-3">Estado</th>
                <th v-if="isAdmin" class="text-right text-xs font-medium text-slate-500 px-4 py-3">Acciones</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-50">
              <tr v-for="user in paginatedUsers" :key="user.id_usuario"
                class="hover:bg-slate-50/60 transition-colors cursor-pointer"
                :class="{ 'bg-indigo-50/40': selectedUser?.id_usuario === user.id_usuario }" @click="viewDetail(user)">
                <td class="px-4 py-3">
                  <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0"
                      :class="user.enabled ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500'">
                      {{ (user.persona.nombre?.[0] ?? '?').toUpperCase() }}{{ (user.persona.apellido_pat?.[0] ??
                        '').toUpperCase() }}
                    </div>
                    <div class="min-w-0">
                      <p class="font-medium text-slate-900 truncate">{{ user.persona.nombreCompleto }}</p>
                      <p class="text-xs text-slate-400 truncate md:hidden">{{ user.persona.ci }}</p>
                    </div>
                  </div>
                </td>
                <td class="px-4 py-3 text-slate-600 hidden md:table-cell">{{ user.persona.ci }}</td>
                <td class="px-4 py-3 hidden lg:table-cell">
                  <span class="font-mono text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">{{ user.username
                  }}</span>
                </td>
                <td class="px-4 py-3">
                  <div class="flex flex-wrap gap-1">
                    <span v-for="role in user.roles" :key="role.id_role"
                      class="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full ring-1"
                      :class="roleBadgeClass(role.name)">
                      {{ roleLabel(role.name) }}
                    </span>
                  </div>
                </td>
                <td class="px-4 py-3 text-slate-500 text-xs hidden xl:table-cell">{{ user.biblioteca?.nombre ?? '—' }}
                </td>
                <td class="px-4 py-3">
                  <button v-if="isAdmin"
                    class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all ring-1 cursor-pointer"
                    :class="user.enabled ? 'bg-emerald-50 text-emerald-700 ring-emerald-200 hover:bg-emerald-100' : 'bg-red-50 text-red-600 ring-red-200 hover:bg-red-100'"
                    :disabled="togglingId === user.id_usuario" @click.stop="toggleEnabled(user)">
                    <span class="w-1.5 h-1.5 rounded-full" :class="user.enabled ? 'bg-emerald-500' : 'bg-red-500'" />
                    <svg v-if="togglingId === user.id_usuario" class="w-3 h-3 animate-spin" fill="none"
                      viewBox="0 0 24 24">
                      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    <template v-else>{{ user.enabled ? 'Activo' : 'Inactivo' }}</template>
                  </button>
                  <span v-else
                    class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ring-1"
                    :class="user.enabled ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-red-50 text-red-600 ring-red-200'">
                    <span class="w-1.5 h-1.5 rounded-full" :class="user.enabled ? 'bg-emerald-500' : 'bg-red-500'" />
                    {{ user.enabled ? 'Activo' : 'Inactivo' }}
                  </span>
                </td>
                <td v-if="isAdmin" class="px-4 py-3 text-right" @click.stop>
                  <button
                    class="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                    @click="openEditModal(user)">
                    <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path
                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                        stroke-linecap="round" stroke-linejoin="round" />
                    </svg>
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-if="totalPages > 1" class="flex items-center justify-between px-4 py-3 border-t border-slate-100">
          <p class="text-xs text-slate-500">Mostrando {{ (currentPage - 1) * PAGE_SIZE + 1 }}–{{ Math.min(currentPage *
            PAGE_SIZE, users.length) }} de {{ users.length }}</p>
          <div class="flex gap-1">
            <button v-for="p in totalPages" :key="p" class="w-7 h-7 rounded text-xs font-medium transition-colors"
              :class="p === currentPage ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-100'"
              @click="currentPage = p">{{ p }}</button>
          </div>
        </div>
      </template>
    </div>

    <!-- ── Detail panel ── -->
    <Transition name="slide-up">
      <div v-if="selectedUser" class="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div class="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50/60">
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold shrink-0"
              :class="selectedUser.enabled ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500'">
              {{ (selectedUser.persona.nombre?.[0] ?? '?').toUpperCase() }}{{ (selectedUser.persona.apellido_pat?.[0] ??
                '').toUpperCase() }}
            </div>
            <div>
              <p class="text-sm font-semibold text-slate-900">{{ selectedUser.persona.nombreCompleto }}</p>
              <p class="text-xs text-slate-500 font-mono">@{{ selectedUser.username }}</p>
            </div>
          </div>
          <button
            class="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all"
            @click="selectedUser = null; detailCarreras = []">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M6 18L18 6M6 6l12 12" stroke-linecap="round" />
            </svg>
          </button>
        </div>

        <div class="p-5">
          <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 text-sm">
            <div>
              <p class="text-xs text-slate-400 mb-0.5">Email</p>
              <p class="text-slate-700 truncate">{{ selectedUser.persona.email || '—' }}</p>
            </div>
            <div>
              <p class="text-xs text-slate-400 mb-0.5">CI</p>
              <p class="text-slate-700">{{ selectedUser.persona.ci }}</p>
            </div>
            <div>
              <p class="text-xs text-slate-400 mb-0.5">Celular</p>
              <p class="text-slate-700">{{ selectedUser.persona.celular || '—' }}</p>
            </div>
            <div>
              <p class="text-xs text-slate-400 mb-0.5">Biblioteca</p>
              <p class="text-slate-700">{{ selectedUser.biblioteca?.nombre ?? '—' }}</p>
            </div>
            <div>
              <p class="text-xs text-slate-400 mb-0.5">Rol(es)</p>
              <div class="flex flex-wrap gap-1">
                <span v-for="r in selectedUser.roles" :key="r.id_role"
                  class="text-xs px-2 py-0.5 rounded-full ring-1 font-medium" :class="roleBadgeClass(r.name)">{{
                    roleLabel(r.name) }}</span>
              </div>
            </div>
            <div>
              <p class="text-xs text-slate-400 mb-0.5">Estado</p>
              <span class="inline-flex items-center gap-1.5 text-xs font-medium"
                :class="selectedUser.enabled ? 'text-emerald-600' : 'text-red-500'">
                <span class="w-1.5 h-1.5 rounded-full"
                  :class="selectedUser.enabled ? 'bg-emerald-500' : 'bg-red-500'" />
                {{ selectedUser.enabled ? 'Activo' : 'Inactivo' }}
              </span>
            </div>
          </div>

          <!-- Carreras (estudiantes) -->
          <div v-if="selectedUser.roles.some(r => r.name === 'ROLE_ESTUDIANTE')"
            class="mt-5 pt-5 border-t border-slate-100">
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

            <div v-if="detailCarrerasLoading" class="flex items-center gap-2 text-xs text-slate-400 py-2">
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
    </Transition>


    <!-- ══════════════════════════════════════════════════════
         MODAL: ASIGNAR CARRERA
    ══════════════════════════════════════════════════════ -->
    <Transition name="fade">
      <div v-if="showAssignModal"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
        @click.self="showAssignModal = false">
        <div class="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden">
          <div class="px-6 pt-6 pb-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 class="text-base font-semibold text-slate-900">Asignar carrera</h3>
              <p class="text-xs text-slate-500 mt-0.5">{{ selectedUser?.persona.nombreCompleto }}</p>
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
              <p class="text-xs text-slate-400 mt-1">Puedes dejarlo vacío si no tienes matrícula aún.</p>
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


    <!-- ══════════════════════════════════════════════════════
         MODAL: CONFIRMAR REMOVER CARRERA
    ══════════════════════════════════════════════════════ -->
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
              Se quitará la asignación de
              <span class="font-semibold text-slate-800">{{ carreraToRemove?.nombre_carrera }}</span>
              para
              <span class="font-semibold text-slate-800">{{ selectedUser?.persona.nombreCompleto }}</span>.
              <br /><span class="text-xs text-slate-400 mt-1 block">La carrera seguirá existiendo en el sistema.</span>
            </p>
          </div>
          <div class="px-6 pb-6 flex gap-3">
            <button
              class="flex-1 px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors font-medium"
              @click="showConfirmRemove = false">
              Cancelar
            </button>
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


    <!-- ══════════════════════════════════════════════════════
         MODAL: CREAR USUARIO (inteligente por rol)
    ══════════════════════════════════════════════════════ -->
    <Transition name="fade">
      <div v-if="showCreateModal"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
        @click.self="showCreateModal = false">
        <div class="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[92vh] flex flex-col">

          <!-- Header -->
          <div class="px-6 pt-6 pb-4 border-b border-slate-100 flex items-center justify-between shrink-0">
            <h3 class="text-lg font-semibold text-slate-900">Nuevo usuario</h3>
            <button
              class="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all"
              @click="showCreateModal = false">
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
                  <label class="block text-xs font-medium text-slate-600 mb-1">Rol <span
                      class="text-red-500">*</span></label>
                  <select v-model="createForm.roleId"
                    class="w-full h-9 px-3 text-sm rounded-lg border outline-none transition-all focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                    :class="createErrors.roleId ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-slate-50'">
                    <option value="">Seleccionar rol…</option>
                    <option v-for="role in roles" :key="role.id_role" :value="role.id_role">{{ roleLabel(role.name) }}
                    </option>
                  </select>
                  <p v-if="createErrors.roleId" class="text-xs text-red-500 mt-0.5">{{ createErrors.roleId }}</p>
                </div>
                <div class="grid grid-cols-2 gap-3">
                  <div class="col-span-2">
                    <label class="block text-xs font-medium text-slate-600 mb-1">Username <span
                        class="text-red-500">*</span></label>
                    <input v-model="createForm.username" type="text" placeholder="nombre.apellido"
                      class="w-full h-9 px-3 text-sm rounded-lg border outline-none transition-all focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                      :class="createErrors.username ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-slate-50'"
                      @input="delete createErrors.username" />
                    <p v-if="createErrors.username" class="text-xs text-red-500 mt-0.5">{{ createErrors.username }}</p>
                  </div>
                  <div class="col-span-2">
                    <label class="block text-xs font-medium text-slate-600 mb-1">Contraseña <span
                        class="text-red-500">*</span></label>
                    <input v-model="createForm.password" type="password" placeholder="Mínimo 8 caracteres"
                      class="w-full h-9 px-3 text-sm rounded-lg border outline-none transition-all focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                      :class="createErrors.password ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-slate-50'"
                      @input="delete createErrors.password" />
                    <p v-if="createErrors.password" class="text-xs text-red-500 mt-0.5">{{ createErrors.password }}</p>
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
                  <input v-model="createForm.nombre" type="text" placeholder="Nombre"
                    class="w-full h-9 px-3 text-sm rounded-lg border outline-none transition-all focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                    :class="createErrors.nombre ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-slate-50'"
                    @input="delete createErrors.nombre" />
                  <p v-if="createErrors.nombre" class="text-xs text-red-500 mt-0.5">{{ createErrors.nombre }}</p>
                </div>
                <div>
                  <label class="block text-xs font-medium text-slate-600 mb-1">Ap. Paterno <span
                      class="text-red-500">*</span></label>
                  <input v-model="createForm.apellido_pat" type="text" placeholder="Ap. Paterno"
                    class="w-full h-9 px-3 text-sm rounded-lg border outline-none transition-all focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                    :class="createErrors.apellido_pat ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-slate-50'"
                    @input="delete createErrors.apellido_pat" />
                  <p v-if="createErrors.apellido_pat" class="text-xs text-red-500 mt-0.5">{{ createErrors.apellido_pat
                  }}
                  </p>
                </div>
                <div>
                  <label class="block text-xs font-medium text-slate-600 mb-1">Ap. Materno</label>
                  <input v-model="createForm.apellido_mat" type="text" placeholder="Ap. Materno"
                    class="w-full h-9 px-3 text-sm rounded-lg border border-slate-200 bg-slate-50 outline-none transition-all focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400" />
                </div>
                <div>
                  <label class="block text-xs font-medium text-slate-600 mb-1">CI <span
                      class="text-red-500">*</span></label>
                  <input v-model="createForm.ci" type="text" placeholder="Número de CI"
                    class="w-full h-9 px-3 text-sm rounded-lg border outline-none transition-all focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                    :class="createErrors.ci ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-slate-50'"
                    @input="delete createErrors.ci" />
                  <p v-if="createErrors.ci" class="text-xs text-red-500 mt-0.5">{{ createErrors.ci }}</p>
                </div>
                <div class="col-span-2">
                  <label class="block text-xs font-medium text-slate-600 mb-1">Email <span
                      class="text-red-500">*</span></label>
                  <input v-model="createForm.email" type="email" placeholder="email@dominio.com"
                    class="w-full h-9 px-3 text-sm rounded-lg border outline-none transition-all focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                    :class="createErrors.email ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-slate-50'"
                    @input="delete createErrors.email" />
                  <p v-if="createErrors.email" class="text-xs text-red-500 mt-0.5">{{ createErrors.email }}</p>
                </div>
                <div class="col-span-2">
                  <label class="block text-xs font-medium text-slate-600 mb-1">Celular</label>
                  <input v-model="createForm.celular" type="text" placeholder="7XXXXXXX"
                    class="w-full h-9 px-3 text-sm rounded-lg border border-slate-200 bg-slate-50 outline-none transition-all focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400" />
                </div>
              </div>
            </div>

            <!-- ── SECCIÓN DINÁMICA: Biblioteca (solo BIBLIOTECARIO) ── -->
            <Transition name="slide-up">
              <div v-if="isCreatingBibliotecario" class="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
                <div class="flex items-center gap-2 mb-3">
                  <div class="w-6 h-6 rounded-md bg-emerald-100 flex items-center justify-center shrink-0">
                    <svg class="w-3.5 h-3.5 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                      stroke-width="2">
                      <path
                        d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75z"
                        stroke-linecap="round" stroke-linejoin="round" />
                    </svg>
                  </div>
                  <p class="text-xs font-semibold text-emerald-700 uppercase tracking-wider">Biblioteca asignada <span
                      class="text-red-400 normal-case font-normal">*</span></p>
                </div>
                <select v-model="createForm.bibliotecaId"
                  class="w-full h-9 px-3 text-sm rounded-lg border outline-none transition-all focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
                  :class="createErrors.bibliotecaId ? 'border-red-300 bg-red-50' : 'border-emerald-200 bg-white'">
                  <option value="">Seleccionar biblioteca…</option>
                  <option v-for="bib in allBibliotecas" :key="bib.id_biblioteca" :value="bib.id_biblioteca">{{
                    bib.nombre }}
                  </option>
                </select>
                <p v-if="createErrors.bibliotecaId" class="text-xs text-red-500 mt-1">{{ createErrors.bibliotecaId }}
                </p>
                <p v-else class="text-xs text-emerald-600 mt-1.5">El bibliotecario solo gestionará esta biblioteca.</p>
              </div>
            </Transition>

            <!-- ── SECCIÓN DINÁMICA: Carreras (solo ESTUDIANTE) ── -->
            <Transition name="slide-up">
              <div v-if="isCreatingEstudiante" class="rounded-xl border border-sky-200 bg-sky-50/60 p-4">
                <div class="flex items-center gap-2 mb-3">
                  <div class="w-6 h-6 rounded-md bg-sky-100 flex items-center justify-center shrink-0">
                    <svg class="w-3.5 h-3.5 text-sky-600" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                      stroke-width="2">
                      <path
                        d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342"
                        stroke-linecap="round" stroke-linejoin="round" />
                    </svg>
                  </div>
                  <p class="text-xs font-semibold text-sky-700 uppercase tracking-wider">Carreras <span
                      class="normal-case font-normal text-sky-400">(opcional)</span></p>
                </div>

                <!-- Picker row -->
                <div class="flex gap-2 mb-1.5">
                  <select v-model="createForm._pickerCarreraId"
                    class="flex-1 h-9 px-2 text-sm rounded-lg border outline-none transition-all focus:ring-2 focus:ring-sky-500/20 focus:border-sky-400 text-slate-700"
                    :class="createErrors._pickerCarreraId ? 'border-red-300 bg-red-50' : 'border-sky-200 bg-white'">
                    <option value="">Seleccionar carrera…</option>
                    <option v-for="c in createAvailableCarreras" :key="c.id_carrera" :value="c.id_carrera">{{
                      c.nombre_carrera }}</option>
                  </select>
                  <input v-model="createForm._pickerMatricula" type="text" placeholder="Matrícula"
                    class="w-28 h-9 px-2 text-sm rounded-lg border border-sky-200 bg-white text-slate-700 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-400" />
                  <button
                    class="h-9 px-3 rounded-lg bg-sky-600 text-white text-xs font-semibold hover:bg-sky-500 transition-colors disabled:opacity-40 shrink-0"
                    :disabled="!createForm._pickerCarreraId" @click="addCreateCarrera">
                    Agregar
                  </button>
                </div>
                <p v-if="createErrors._pickerCarreraId" class="text-xs text-red-500 mb-2">{{
                  createErrors._pickerCarreraId
                }}</p>

                <!-- Selected careers -->
                <TransitionGroup v-if="createForm.carreras.length" name="list" tag="div" class="space-y-1.5 mt-2">
                  <div v-for="c in createForm.carreras" :key="c.carreraId"
                    class="flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-sky-100">
                    <svg class="w-3.5 h-3.5 text-sky-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                      stroke-width="2">
                      <path d="M9 12.75L11.25 15 15 9.75" stroke-linecap="round" stroke-linejoin="round" />
                    </svg>
                    <span class="flex-1 text-sm text-slate-700 font-medium truncate">{{ c.nombre }}</span>
                    <span v-if="c.matricula" class="text-xs text-slate-400 font-mono shrink-0">{{ c.matricula }}</span>
                    <button
                      class="w-5 h-5 flex items-center justify-center rounded text-slate-300 hover:text-red-500 transition-colors"
                      @click="removeCreateCarrera(c.carreraId)">
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
              @click="showCreateModal = false">Cancelar</button>
            <button
              class="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 transition-colors disabled:opacity-50 flex items-center gap-2"
              :disabled="createLoading" @click="handleCreate">
              <svg v-if="createLoading" class="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              {{ createLoading ? 'Guardando…' : 'Crear usuario' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>


    <!-- ══════════════════════════════════════════════════════
         MODAL: EDITAR USUARIO
    ══════════════════════════════════════════════════════ -->
    <Transition name="fade">
      <div v-if="showEditModal"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
        @click.self="showEditModal = false">
        <div class="bg-white rounded-2xl shadow-xl w-full max-w-md">
          <div class="px-6 pt-6 pb-4 border-b border-slate-100 flex items-center justify-between">
            <h3 class="text-lg font-semibold text-slate-900">Editar usuario</h3>
            <button
              class="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all"
              @click="showEditModal = false">
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M6 18L18 6M6 6l12 12" stroke-linecap="round" />
              </svg>
            </button>
          </div>
          <div class="p-6 space-y-3">
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-xs font-medium text-slate-600 mb-1">Nombre <span
                    class="text-red-500">*</span></label>
                <input v-model="editForm.nombre" type="text"
                  class="w-full h-9 px-3 text-sm rounded-lg border outline-none transition-all focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                  :class="editErrors.nombre ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-slate-50'" />
                <p v-if="editErrors.nombre" class="text-xs text-red-500 mt-0.5">{{ editErrors.nombre }}</p>
              </div>
              <div>
                <label class="block text-xs font-medium text-slate-600 mb-1">Ap. Paterno <span
                    class="text-red-500">*</span></label>
                <input v-model="editForm.apellido_pat" type="text"
                  class="w-full h-9 px-3 text-sm rounded-lg border outline-none transition-all focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                  :class="editErrors.apellido_pat ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-slate-50'" />
                <p v-if="editErrors.apellido_pat" class="text-xs text-red-500 mt-0.5">{{ editErrors.apellido_pat }}</p>
              </div>
              <div>
                <label class="block text-xs font-medium text-slate-600 mb-1">Ap. Materno</label>
                <input v-model="editForm.apellido_mat" type="text"
                  class="w-full h-9 px-3 text-sm rounded-lg border border-slate-200 bg-slate-50 outline-none transition-all focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400" />
              </div>
              <div>
                <label class="block text-xs font-medium text-slate-600 mb-1">Celular</label>
                <input v-model="editForm.celular" type="text"
                  class="w-full h-9 px-3 text-sm rounded-lg border border-slate-200 bg-slate-50 outline-none transition-all focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400" />
              </div>
            </div>
            <div class="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-200">
              <div>
                <p class="text-sm font-medium text-slate-700">Estado de cuenta</p>
                <p class="text-xs text-slate-400">
                  {{ editForm.enabled ? 'El usuario puede iniciar sesión' : 'Sin acceso al sistema'
                  }}
                </p>
              </div>
              <button class="relative w-11 h-6 rounded-full transition-colors duration-200"
                :class="editForm.enabled ? 'bg-indigo-600' : 'bg-slate-200'"
                @click="editForm.enabled = !editForm.enabled">
                <span
                  class="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200"
                  :class="editForm.enabled ? 'translate-x-5' : 'translate-x-0'" />
              </button>
            </div>
          </div>
          <div class="px-6 pb-6 flex gap-3 justify-end">
            <button class="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              @click="showEditModal = false">Cancelar</button>
            <button
              class="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 transition-colors disabled:opacity-50 flex items-center gap-2"
              :disabled="editLoading" @click="handleEdit">
              <svg v-if="editLoading" class="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              {{ editLoading ? 'Guardando…' : 'Guardar cambios' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>

  </div>
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