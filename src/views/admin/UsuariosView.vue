<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { useUiStore } from '@/stores/ui.store'
import { usePermissions } from '@/composables/usePermissions'
import { userService } from '@/services/user.service'
import type { UserResponse, RoleData, CreateUserPayload, UpdateUserPayload } from '@/services/user.service'

const ui = useUiStore()
const { isAdmin } = usePermissions()

// ─── Breadcrumbs ─────────────────────────────────────────────────────────
onMounted(() => {
  ui.setBreadcrumbs([
    { label: 'Usuarios' }
  ])
  fetchUsers()
  fetchRoles()
})

// ─── State ───────────────────────────────────────────────────────────────
const users = ref<UserResponse[]>([])
const roles = ref<RoleData[]>([])
const loading = ref(false)
const rolesLoading = ref(false)
const error = ref<string | null>(null)

// ─── Filters ─────────────────────────────────────────────────────────────
const searchQuery = ref('')
const filterRole = ref('')
let debounceTimer: ReturnType<typeof setTimeout>

function onSearchInput() {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => fetchUsers(), 400)
}

watch(filterRole, () => fetchUsers())

// ─── Fetch ────────────────────────────────────────────────────────────────
async function fetchUsers() {
  loading.value = true
  error.value = null
  try {
    let res
    if (searchQuery.value.trim()) {
      res = await userService.search(searchQuery.value.trim())
    } else if (filterRole.value) {
      res = await userService.filterByRole(filterRole.value)
    } else {
      res = await userService.getAll()
    }
    users.value = res.data.data //TODO: corregir
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'Error al cargar usuarios'
  } finally {
    loading.value = false
  }
}

async function fetchRoles() {
  rolesLoading.value = true
  try {
    const res = await userService.getRoles()
    roles.value = res.data.data
  } catch {
    // silently fail
  } finally {
    rolesLoading.value = false
  }
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

function roleLabel(name: string) {
  return roleLabelMap[name] ?? name
}

function roleBadgeClass(name: string) {
  return roleBadgeMap[name] ?? 'bg-slate-100 text-slate-600 ring-slate-200'
}

// ─── Toggle enabled ───────────────────────────────────────────────────────
const togglingId = ref<number | null>(null)

async function toggleEnabled(user: UserResponse) {
  togglingId.value = user.id_usuario
  try {
    const res = await userService.toggleEnabled(user.id_usuario)
    const idx = users.value.findIndex(u => u.id_usuario === user.id_usuario)
    if (idx !== -1) users.value[idx] = res.data
    ui.toast.success(
      res.data.enabled ? 'Usuario activado' : 'Usuario desactivado',
      res.data.persona.nombreCompleto ?? res.data.username
    )
  } catch (e: unknown) {
    ui.toast.error('Error', e instanceof Error ? e.message : 'No se pudo cambiar el estado')
  } finally {
    togglingId.value = null
  }
}

// ─── Create modal ──────────────────────────────────────────────────────────
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
  roleId: '',
})

const createErrors = reactive<Record<string, string>>({})

function openCreateModal() {
  Object.assign(createForm, {
    username: '', password: '', nombre: '', apellido_pat: '',
    apellido_mat: '', ci: '', celular: '', email: '', roleId: '',
  })
  Object.keys(createErrors).forEach(k => delete createErrors[k])
  showCreateModal.value = true
}

function validateCreate(): boolean {
  Object.keys(createErrors).forEach(k => delete createErrors[k])
  if (!createForm.username.trim()) createErrors.username = 'Requerido'
  if (!createForm.password.trim()) createErrors.password = 'Requerido'
  if (createForm.password.length < 8) createErrors.password = 'Mínimo 8 caracteres'
  if (!createForm.nombre.trim()) createErrors.nombre = 'Requerido'
  if (!createForm.apellido_pat.trim()) createErrors.apellido_pat = 'Requerido'
  if (!createForm.ci.trim() || isNaN(Number(createForm.ci))) createErrors.ci = 'CI numérico requerido'
  if (!createForm.email.trim()) createErrors.email = 'Requerido'
  if (!createForm.roleId) createErrors.roleId = 'Selecciona un rol'
  return Object.keys(createErrors).length === 0
}

async function handleCreate() {
  if (!validateCreate()) return
  createLoading.value = true
  try {
    const payload: CreateUserPayload = {
      username: createForm.username,
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
    }
    const res = await userService.create(payload)
    users.value.unshift(res.data)
    showCreateModal.value = false
    ui.toast.success('Usuario creado', res.data.persona.nombreCompleto ?? res.data.username)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Error al crear usuario'
    // Try to extract field-level errors
    if (msg.toLowerCase().includes('username')) createErrors.username = msg
    else if (msg.toLowerCase().includes('ci')) createErrors.ci = msg
    else if (msg.toLowerCase().includes('email')) createErrors.email = msg
    else ui.toast.error('Error', msg)
  } finally {
    createLoading.value = false
  }
}

// ─── Edit modal ─────────────────────────────────────────────────────────
const showEditModal = ref(false)
const editLoading = ref(false)
const editingUser = ref<UserResponse | null>(null)

const editForm = reactive({
  nombre: '',
  apellido_pat: '',
  apellido_mat: '',
  celular: '',
  enabled: true,
})

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
    if (idx !== -1) users.value[idx] = res.data.data
    // if (idx !== -1) {
    //   users.value[idx] = {
    //     ...res.data,
    //     persona: res.data.persona ?? {},
    //     roles: res.data.roles ?? []
    //   }
    // }
    showEditModal.value = false
    ui.toast.success('Usuario actualizado', res.data.persona?.nombreCompleto ?? res.data.username)
  } catch (e: unknown) {
    ui.toast.error('Error', e instanceof Error ? e.message : 'No se pudo actualizar')
  } finally {
    editLoading.value = false
  }
}

// ─── Detail panel ────────────────────────────────────────────────────────
const selectedUser = ref<UserResponse | null>(null)

function viewDetail(user: UserResponse) {
  selectedUser.value = selectedUser.value?.id_usuario === user.id_usuario ? null : user
}

// ─── Stats ───────────────────────────────────────────────────────────────
const stats = computed(() => {
  const total = users.value.length
  const active = users.value.filter(u => u.enabled).length
  // const admins = users.value.filter(u => u.roles?.some(r => r.name === 'ROLE_ADMIN')).length
  const admins = users.value.filter(
    u => Array.isArray(u.roles) && u.roles.some(r => r.name === 'ROLE_ADMIN')
  ).length
  // const bibliotecarios = users.value.filter(u => u.roles?.some(r => r.name === 'ROLE_BIBLIOTECARIO')).length
  // const estudiantes = users.value.filter(u => u.roles?.some(r => r.name === 'ROLE_ESTUDIANTE')).length
  const bibliotecarios = users.value.filter(
    u => Array.isArray(u.roles) && u.roles.some(r => r.name === 'ROLE_BIBLIOTECARIO')
  ).length

  const estudiantes = users.value.filter(
    u => Array.isArray(u.roles) && u.roles.some(r => r.name === 'ROLE_ESTUDIANTE')
  ).length
  return { total, active, admins, bibliotecarios, estudiantes }
})

// ─── Pagination ───────────────────────────────────────────────────────────
const PAGE_SIZE = 10
const currentPage = ref(1)

const totalPages = computed(() => Math.max(1, Math.ceil(users.value.length / PAGE_SIZE)))

const paginatedUsers = computed(() => {
  const start = (currentPage.value - 1) * PAGE_SIZE
  return users.value.slice(start, start + PAGE_SIZE)
})

watch(users, () => { currentPage.value = 1 })

// ─── Filter display labels ────────────────────────────────────────────────
const filterRoleOptions = [
  { value: '', label: 'Todos los roles' },
  { value: 'ADMIN', label: 'Administrador' },
  { value: 'BIBLIOTECARIO', label: 'Bibliotecario' },
  { value: 'ESTUDIANTE', label: 'Estudiante' },
]
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
        class="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-500 transition-colors shadow-sm"
        @click="openCreateModal">
        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 5v14M5 12h14" stroke-linecap="round" />
        </svg>
        Nuevo usuario
      </button>
    </div>

    <!-- ── Stats cards ── -->
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
      <!-- Search -->
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

      <!-- Role filter -->
      <select v-model="filterRole"
        class="h-9 px-3 text-sm rounded-lg border border-slate-200 bg-slate-50 text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all">
        <option v-for="opt in filterRoleOptions" :key="opt.value" :value="opt.value">
          {{ opt.label }}
        </option>
      </select>

      <!-- Refresh -->
      <button
        class="h-9 px-3 rounded-lg border border-slate-200 text-slate-500 hover:text-slate-700 hover:border-slate-300 transition-all"
        title="Actualizar" @click="fetchUsers">
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

      <!-- Loading skeletons -->
      <template v-if="loading">
        <div class="p-4 space-y-3">
          <div v-for="i in 5" :key="i" class="flex items-center gap-4">
            <div class="w-8 h-8 rounded-full bg-slate-100 animate-pulse shrink-0" />
            <div class="flex-1 space-y-1.5">
              <div class="h-3 bg-slate-100 rounded animate-pulse w-1/3" />
              <div class="h-2.5 bg-slate-100 rounded animate-pulse w-1/4" />
            </div>
            <div class="h-6 w-20 bg-slate-100 rounded-full animate-pulse" />
            <div class="h-6 w-16 bg-slate-100 rounded animate-pulse" />
          </div>
        </div>
      </template>

      <!-- Error -->
      <div v-else-if="error" class="flex flex-col items-center justify-center py-16 gap-3">
        <svg class="w-10 h-10 text-red-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <p class="text-sm text-slate-500">{{ error }}</p>
        <button class="text-sm text-indigo-600 hover:underline" @click="fetchUsers">Reintentar</button>
      </div>

      <!-- Empty -->
      <div v-else-if="!users.length" class="flex flex-col items-center justify-center py-16 gap-3">
        <svg class="w-10 h-10 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path
            d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"
            stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        <p class="text-sm font-medium text-slate-500">No se encontraron usuarios</p>
        <p class="text-xs text-slate-400">Prueba con otros filtros o crea un nuevo usuario</p>
      </div>

      <!-- Data table -->
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
                <th class="text-right text-xs font-medium text-slate-500 px-4 py-3" v-if="isAdmin">Acciones</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-50">
              <tr v-for="user in paginatedUsers" :key="user.id_usuario"
                class="hover:bg-slate-50/60 transition-colors cursor-pointer"
                :class="{ 'bg-indigo-50/40': selectedUser?.id_usuario === user.id_usuario }" @click="viewDetail(user)">
                <!-- Name + avatar -->
                <td class="px-4 py-3">
                  <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0"
                      :class="user.enabled ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500'">
                      {{ (user.persona?.nombre?.[0] ?? '?').toUpperCase() }}{{ (user.persona?.apellido_pat?.[0] ??
                        '').toUpperCase() }}
                    </div>
                    <div class="min-w-0">
                      <p class="font-medium text-slate-900 truncate">{{ user.persona?.nombreCompleto }}</p>
                      <p class="text-xs text-slate-400 truncate md:hidden">{{ user.persona?.ci }}</p>
                    </div>
                  </div>
                </td>

                <!-- CI -->
                <td class="px-4 py-3 text-slate-600 hidden md:table-cell">{{ user.persona?.ci }}</td>

                <!-- Username -->
                <td class="px-4 py-3 hidden lg:table-cell">
                  <span class="font-mono text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">{{ user.username
                  }}</span>
                </td>

                <!-- Roles -->
                <td class="px-4 py-3">
                  <div class="flex flex-wrap gap-1">
                    <span v-for="role in user.roles" :key="role.id_role"
                      class="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full ring-1"
                      :class="roleBadgeClass(role.name)">
                      {{ roleLabel(role.name) }}
                    </span>
                  </div>
                </td>

                <!-- Biblioteca -->
                <td class="px-4 py-3 text-slate-500 text-xs hidden xl:table-cell">
                  {{ user.biblioteca?.nombre ?? '—' }}
                </td>

                <!-- Estado -->
                <td class="px-4 py-3">
                  <button v-if="isAdmin"
                    class="relative inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all ring-1 cursor-pointer"
                    :class="user.enabled
                      ? 'bg-emerald-50 text-emerald-700 ring-emerald-200 hover:bg-emerald-100'
                      : 'bg-red-50 text-red-600 ring-red-200 hover:bg-red-100'"
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

                <!-- Actions -->
                <td v-if="isAdmin" class="px-4 py-3 text-right" @click.stop>
                  <button
                    class="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                    title="Editar" @click="openEditModal(user)">
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

        <!-- Pagination -->
        <div v-if="totalPages > 1" class="flex items-center justify-between px-4 py-3 border-t border-slate-100">
          <p class="text-xs text-slate-500">
            Mostrando {{ (currentPage - 1) * PAGE_SIZE + 1 }}–{{ Math.min(currentPage * PAGE_SIZE, users.length) }} de
            {{
              users.length }}
          </p>
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
      <div v-if="selectedUser" class="bg-white rounded-xl border border-slate-200 p-5">
        <div class="flex items-start justify-between mb-4">
          <h3 class="text-base font-semibold text-slate-900">Detalle de usuario</h3>
          <button class="text-slate-400 hover:text-slate-600" @click="selectedUser = null">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M6 18L18 6M6 6l12 12" stroke-linecap="round" />
            </svg>
          </button>
        </div>
        <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 text-sm">
          <div>
            <p class="text-xs text-slate-400 mb-0.5">Nombre completo</p>
            <p class="text-slate-900 font-medium">{{ selectedUser.persona.nombreCompleto }}</p>
          </div>
          <div>
            <p class="text-xs text-slate-400 mb-0.5">Username</p>
            <p class="font-mono text-slate-700">{{ selectedUser.username }}</p>
          </div>
          <div>
            <p class="text-xs text-slate-400 mb-0.5">CI</p>
            <p class="text-slate-700">{{ selectedUser.persona.ci }}</p>
          </div>
          <div>
            <p class="text-xs text-slate-400 mb-0.5">Email</p>
            <p class="text-slate-700 truncate">{{ selectedUser.persona.email }}</p>
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
            <div class="flex flex-wrap gap-1 mt-0.5">
              <span v-for="r in selectedUser.roles" :key="r.id_role"
                class="text-xs px-2 py-0.5 rounded-full ring-1 font-medium" :class="roleBadgeClass(r.name)">
                {{ roleLabel(r.name) }}
              </span>
            </div>
          </div>
          <div>
            <p class="text-xs text-slate-400 mb-0.5">Estado</p>
            <span class="inline-flex items-center gap-1.5 text-xs font-medium"
              :class="selectedUser.enabled ? 'text-emerald-600' : 'text-red-500'">
              <span class="w-1.5 h-1.5 rounded-full" :class="selectedUser.enabled ? 'bg-emerald-500' : 'bg-red-500'" />
              {{ selectedUser.enabled ? 'Activo' : 'Inactivo' }}
            </span>
          </div>
        </div>
      </div>
    </Transition>


    <!-- ══ CREATE MODAL ══ -->
    <Transition name="fade">
      <div v-if="showCreateModal"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
        <div class="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" @click.stop>
          <div class="sticky top-0 bg-white px-6 pt-6 pb-4 border-b border-slate-100 flex items-center justify-between">
            <h3 class="text-lg font-semibold text-slate-900">Nuevo usuario</h3>
            <button class="text-slate-400 hover:text-slate-600 transition-colors" @click="showCreateModal = false">
              <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M6 18L18 6M6 6l12 12" stroke-linecap="round" />
              </svg>
            </button>
          </div>

          <div class="p-6 space-y-4">
            <!-- Account section -->
            <div>
              <p class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Cuenta</p>
              <div class="grid grid-cols-2 gap-3">
                <div class="col-span-2">
                  <label class="block text-xs font-medium text-slate-600 mb-1">Username <span
                      class="text-red-500">*</span></label>
                  <input v-model="createForm.username" type="text" placeholder="nombre.apellido"
                    class="w-full h-9 px-3 text-sm rounded-lg border outline-none transition-all focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                    :class="createErrors.username ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-slate-50'" />
                  <p v-if="createErrors.username" class="text-xs text-red-500 mt-0.5">{{ createErrors.username }}</p>
                </div>
                <div class="col-span-2">
                  <label class="block text-xs font-medium text-slate-600 mb-1">Contraseña <span
                      class="text-red-500">*</span></label>
                  <input v-model="createForm.password" type="password" placeholder="Mínimo 8 caracteres"
                    class="w-full h-9 px-3 text-sm rounded-lg border outline-none transition-all focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                    :class="createErrors.password ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-slate-50'" />
                  <p v-if="createErrors.password" class="text-xs text-red-500 mt-0.5">{{ createErrors.password }}</p>
                </div>
                <div>
                  <label class="block text-xs font-medium text-slate-600 mb-1">Rol <span
                      class="text-red-500">*</span></label>
                  <select v-model="createForm.roleId"
                    class="w-full h-9 px-3 text-sm rounded-lg border outline-none transition-all focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                    :class="createErrors.roleId ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-slate-50'">
                    <option value="">Seleccionar rol</option>
                    <option v-for="role in roles" :key="role.id_role" :value="role.id_role">
                      {{ roleLabel(role.name) }}
                    </option>
                  </select>
                  <p v-if="createErrors.roleId" class="text-xs text-red-500 mt-0.5">{{ createErrors.roleId }}</p>
                </div>
              </div>
            </div>

            <!-- Personal data section -->
            <div>
              <p class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Datos personales</p>
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block text-xs font-medium text-slate-600 mb-1">Nombre <span
                      class="text-red-500">*</span></label>
                  <input v-model="createForm.nombre" type="text" placeholder="Nombre"
                    class="w-full h-9 px-3 text-sm rounded-lg border outline-none transition-all focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                    :class="createErrors.nombre ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-slate-50'" />
                  <p v-if="createErrors.nombre" class="text-xs text-red-500 mt-0.5">{{ createErrors.nombre }}</p>
                </div>
                <div>
                  <label class="block text-xs font-medium text-slate-600 mb-1">Ap. Paterno <span
                      class="text-red-500">*</span></label>
                  <input v-model="createForm.apellido_pat" type="text" placeholder="Apellido paterno"
                    class="w-full h-9 px-3 text-sm rounded-lg border outline-none transition-all focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                    :class="createErrors.apellido_pat ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-slate-50'" />
                  <p v-if="createErrors.apellido_pat" class="text-xs text-red-500 mt-0.5">{{ createErrors.apellido_pat
                  }}
                  </p>
                </div>
                <div>
                  <label class="block text-xs font-medium text-slate-600 mb-1">Ap. Materno</label>
                  <input v-model="createForm.apellido_mat" type="text" placeholder="Apellido materno"
                    class="w-full h-9 px-3 text-sm rounded-lg border border-slate-200 bg-slate-50 outline-none transition-all focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400" />
                </div>
                <div>
                  <label class="block text-xs font-medium text-slate-600 mb-1">CI <span
                      class="text-red-500">*</span></label>
                  <input v-model="createForm.ci" type="text" placeholder="Número de CI"
                    class="w-full h-9 px-3 text-sm rounded-lg border outline-none transition-all focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                    :class="createErrors.ci ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-slate-50'" />
                  <p v-if="createErrors.ci" class="text-xs text-red-500 mt-0.5">{{ createErrors.ci }}</p>
                </div>
                <div>
                  <label class="block text-xs font-medium text-slate-600 mb-1">Email <span
                      class="text-red-500">*</span></label>
                  <input v-model="createForm.email" type="email" placeholder="email@dominio.com"
                    class="w-full h-9 px-3 text-sm rounded-lg border outline-none transition-all focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                    :class="createErrors.email ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-slate-50'" />
                  <p v-if="createErrors.email" class="text-xs text-red-500 mt-0.5">{{ createErrors.email }}</p>
                </div>
                <div>
                  <label class="block text-xs font-medium text-slate-600 mb-1">Celular</label>
                  <input v-model="createForm.celular" type="text" placeholder="7XXXXXXX"
                    class="w-full h-9 px-3 text-sm rounded-lg border border-slate-200 bg-slate-50 outline-none transition-all focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400" />
                </div>
              </div>
            </div>
          </div>

          <div class="sticky bottom-0 bg-white px-6 pb-6 pt-3 border-t border-slate-100 flex gap-3 justify-end">
            <button
              class="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
              @click="showCreateModal = false">Cancelar</button>
            <button
              class="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 transition-colors disabled:opacity-50 flex items-center gap-2"
              :disabled="createLoading" @click="handleCreate">
              <svg v-if="createLoading" class="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              {{ createLoading ? 'Guardando...' : 'Crear usuario' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- ══ EDIT MODAL ══ -->
    <Transition name="fade">
      <div v-if="showEditModal"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
        <div class="bg-white rounded-2xl shadow-xl w-full max-w-md" @click.stop>
          <div class="px-6 pt-6 pb-4 border-b border-slate-100 flex items-center justify-between">
            <h3 class="text-lg font-semibold text-slate-900">Editar usuario</h3>
            <button class="text-slate-400 hover:text-slate-600 transition-colors" @click="showEditModal = false">
              <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
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

            <!-- enabled toggle -->
            <div class="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-200">
              <div>
                <p class="text-sm font-medium text-slate-700">Estado de cuenta</p>
                <p class="text-xs text-slate-400">{{ editForm.enabled ? 'El usuario puede iniciar sesión' : "r" }}</p>
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
            <button
              class="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
              @click="showEditModal = false">Cancelar</button>
            <button
              class="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 transition-colors disabled:opacity-50 flex items-center gap-2"
              :disabled="editLoading" @click="handleEdit">
              <svg v-if="editLoading" class="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              {{ editLoading ? 'Guardando...' : 'Guardar cambios' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>

  </div>
</template>