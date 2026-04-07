<script setup lang="ts">
/**
 * UsersView — Vista principal del módulo de usuarios.
 *
 * Esta vista es intencionalmente delgada: sólo orquesta estado global
 * (búsqueda, filtros, paginación, modales) y delega la lógica compleja
 * a sub-componentes y al composable useUsers.
 *
 * Estructura de archivos del módulo:
 *   views/admin/UsersView.vue             ← este archivo (orquestador)
 *   components/users/UserDetailPanel.vue  ← panel detalle + modales de carrera + auxiliar
 *   components/users/UserEditModal.vue    ← modal edición de datos personales
 *   components/users/UserCreateModal.vue  ← modal creación (inteligente por rol)
 *   composables/useUsers.ts               ← estado singleton + lógica compartida
 *   services/user.service.ts              ← llamadas REST usuarios
 *   services/estudiante.service.ts        ← llamadas REST carreras
 *   services/biblioteca.service.ts        ← llamadas REST bibliotecas
 */
import { ref, computed, onMounted, watch } from 'vue'
import { useUiStore } from '@/stores/ui.store'
import { usePermissions } from '@/composables/usePermissions'
import { useUsers, roleLabel, roleBadgeClass } from '@/composables/useUsers'
import type { UserResponse } from '@/services/user.service'

import UserDetailPanel from '@/components/users/UserDetailPanel.vue'
import UserEditModal from '@/components/users/UserEditModal.vue'
import UserCreateModal from '@/components/users/UserCreateModal.vue'

const ui = useUiStore()
const { isAdmin } = usePermissions()

const {
  users, roles, allCarreras, allBibliotecas,
  loading, error, togglingId, stats,
  fetchUsers, fetchRoles, loadAllCarreras, loadBibliotecas,
  toggleEnabled, patchUser, roleNameForId,
} = useUsers()

onMounted(() => {
  ui.setBreadcrumbs([{ label: 'Usuarios' }])
  fetchUsers()
  fetchRoles()
  loadAllCarreras()
  loadBibliotecas()
})

// ─── Filters ──────────────────────────────────────────────────────────────
const searchQuery = ref('')
const filterRole = ref('')
let debounceTimer: ReturnType<typeof setTimeout>

function onSearchInput() {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => fetchUsers(searchQuery.value, filterRole.value), 400)
}
watch(filterRole, () => fetchUsers(searchQuery.value, filterRole.value))

const filterRoleOptions = [
  { value: '', label: 'Todos los roles' },
  { value: 'ADMIN', label: 'Administrador' },
  { value: 'BIBLIOTECARIO', label: 'Bibliotecario' },
  { value: 'ESTUDIANTE', label: 'Estudiante' },
]

// ─── Pagination ───────────────────────────────────────────────────────────
const PAGE_SIZE = 10
const currentPage = ref(1)
const totalPages = computed(() => Math.max(1, Math.ceil(users.value.length / PAGE_SIZE)))
const paginatedUsers = computed(() =>
  users.value
    .filter((u): u is UserResponse => !!u && typeof u.id_usuario === 'number')
    .slice((currentPage.value - 1) * PAGE_SIZE, currentPage.value * PAGE_SIZE)
)
watch(users, () => { currentPage.value = 1 })

// ─── Detail panel ──────────────────────────────────────────────────────────
const selectedUser = ref<UserResponse | null>(null)

function viewDetail(user: UserResponse) {
  selectedUser.value = selectedUser.value?.id_usuario === user.id_usuario ? null : user
}

function closeDetail() {
  selectedUser.value = null
}

// ─── Edit modal ────────────────────────────────────────────────────────────
const showEditModal = ref(false)
const editingUser = ref<UserResponse | null>(null)

function openEditModal(user: UserResponse) {
  editingUser.value = user
  showEditModal.value = true
}

function onUserUpdated(updated: UserResponse) {
  patchUser(updated)
  // If the updated user is the one in the detail panel, refresh it
  if (selectedUser.value?.id_usuario === updated.id_usuario) {
    selectedUser.value = updated
  }
}

// ─── Create modal ──────────────────────────────────────────────────────────
const showCreateModal = ref(false)

function onUserCreated(newUser: UserResponse) {
  users.value.unshift(newUser)
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
        @click="showCreateModal = true">
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
        title="Actualizar" @click="fetchUsers(searchQuery, filterRole)">
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
          </div>
        </div>
      </template>

      <!-- Error state -->
      <div v-else-if="error" class="flex flex-col items-center justify-center py-16 gap-3">
        <svg class="w-10 h-10 text-red-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <p class="text-sm text-slate-500">{{ error }}</p>
        <button class="text-sm text-indigo-600 hover:underline"
          @click="fetchUsers(searchQuery, filterRole)">Reintentar</button>
      </div>

      <!-- Empty state -->
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
                <th v-if="isAdmin" class="text-right text-xs font-medium text-slate-500 px-4 py-3">Acciones</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-50">
              <tr v-for="user in paginatedUsers" :key="user.id_usuario"
                class="hover:bg-slate-50/60 transition-colors cursor-pointer"
                :class="{ 'bg-indigo-50/40': selectedUser?.id_usuario === user.id_usuario }" @click="viewDetail(user)">
                <!-- Avatar + nombre -->
                <td class="px-4 py-3">
                  <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0"
                      :class="user.enabled ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500'">
                      {{ (user.persona?.nombre?.[0] ?? '?').toUpperCase() }}{{ (user.persona?.apellido_pat?.[0] ??
                        '').toUpperCase() }}
                    </div>
                    <div class="min-w-0">
                      <p class="font-medium text-slate-900 truncate">{{ user.persona?.nombreCompleto ?? user.username }}
                      </p>
                      <p class="text-xs text-slate-400 truncate md:hidden">{{ user.persona?.ci }}</p>
                    </div>
                  </div>
                </td>

                <td class="px-4 py-3 text-slate-600 hidden md:table-cell">{{ user.persona?.ci }}</td>

                <td class="px-4 py-3 hidden lg:table-cell">
                  <span class="font-mono text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">{{ user.username
                  }}</span>
                </td>

                <td class="px-4 py-3">
                  <div class="flex flex-wrap gap-1">
                    <span v-for="role in (user.roles ?? [])" :key="role.id_role"
                      class="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full ring-1"
                      :class="roleBadgeClass(role.name)">{{ roleLabel(role.name) }}</span>
                  </div>
                </td>

                <td class="px-4 py-3 text-slate-500 text-xs hidden xl:table-cell">
                  {{ user.biblioteca?.nombre ?? '—' }}
                </td>

                <!-- Toggle estado -->
                <td class="px-4 py-3">
                  <button v-if="isAdmin"
                    class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all ring-1 cursor-pointer"
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

                <!-- Acciones -->
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

    <!-- ── Panel de detalle ── -->
    <Transition name="slide-up">
      <UserDetailPanel v-if="selectedUser" :user="selectedUser" @close="closeDetail" />
    </Transition>

    <!-- ── Modales ── -->
    <UserEditModal v-model="showEditModal" :user="editingUser" @updated="onUserUpdated" />

    <UserCreateModal v-model="showCreateModal" @created="onUserCreated" />

  </div>
</template>