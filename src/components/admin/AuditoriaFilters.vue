<script setup lang="ts">
import { SButton } from '@/components'
import { ACCIONES_AUDITORIA, type AuditoriaFilters, type AuditoriaUsuario, type FilterErrors } from '@/types/auditoria'
import { computed, ref, watch } from 'vue';

const props = defineProps<{
  filters: AuditoriaFilters
  errors: FilterErrors
  users: AuditoriaUsuario[]
  tables: string[]
  loading: boolean
  note: string
}>()
defineEmits<{ apply: []; clear: [] }>()

const field = 'mt-1 block w-full rounded-lg border bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus-visible:outline-2 focus-visible:outline-indigo-600'
const ok = 'border-slate-300'
const bad = 'border-red-500'
// Búsqueda local de usuarios conocidos.
const usernameQuery = ref('')
const suggestionsOpen = ref(false)

const selectedUser = computed(() =>
  props.users.find(u => u.id_usuario === props.filters.usuarioId) ?? null,
)

const filteredUsers = computed(() => {
  const query = usernameQuery.value.trim().toLocaleLowerCase()

  if (!query) return []

  return props.users
    .filter(user => {
      const username = user.username?.toLocaleLowerCase() ?? ''
      const name = user.nombreCompleto?.toLocaleLowerCase() ?? ''
      const id = String(user.id_usuario)

      return username.includes(query) || name.includes(query) || id.includes(query)
    })
    .slice(0, 8)
})

// Sincroniza el texto cuando se selecciona un usuario o se limpian los filtros.
watch(
  selectedUser,
  user => {
    if (user) {
      usernameQuery.value = user.username || user.nombreCompleto || ''
    } else if (props.filters.usuarioId == null) {
      usernameQuery.value = ''
    }
  },
  { immediate: true },
)

function onUsernameInput() {
  // Una búsqueda nueva invalida la selección anterior.
  props.filters.usuarioId = null
  suggestionsOpen.value = true
}

function selectUser(user: AuditoriaUsuario) {
  props.filters.usuarioId = user.id_usuario
  usernameQuery.value = user.username || user.nombreCompleto || ''
  suggestionsOpen.value = false
}

function clearUser() {
  props.filters.usuarioId = null
  usernameQuery.value = ''
  suggestionsOpen.value = false
}

function onClear() {
  clearUser()
}
function closeSuggestions() {
  setTimeout(() => {
    suggestionsOpen.value = false
  }, 150)
}
</script>

<template>
  <form
    class="rounded-xl border border-slate-200 bg-white p-4"
    aria-label="Filtros de auditoría"
    novalidate
    @submit.prevent="$emit('apply')"
  >
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      <!-- Usuario: búsqueda local por username -->
      <div class="relative">
        <label
          for="f-usuario"
          class="text-sm font-medium text-slate-700"
        >
          Usuario / username
        </label>

        <div class="relative">
          <input
            id="f-usuario"
            v-model="usernameQuery"
            type="text"
            autocomplete="off"
            placeholder="Buscar username..."
            :class="[field, ok, 'pr-9']"
            role="combobox"
            :aria-expanded="suggestionsOpen && !!usernameQuery.trim()"
            aria-autocomplete="list"
            aria-controls="f-usuario-suggestions"
            @input="onUsernameInput"
            @focus="suggestionsOpen = true"
            @keydown.esc="suggestionsOpen = false"
            @keydown.down="suggestionsOpen = true"
            @blur="closeSuggestions"
          />

          <button
            v-if="usernameQuery"
            type="button"
            class="absolute inset-y-0 right-0 px-3 text-slate-400 hover:text-slate-700"
            aria-label="Limpiar usuario"
            @click="clearUser"
          >
            ×
          </button>
        </div>

        <div
          v-if="suggestionsOpen && usernameQuery.trim()"
          id="f-usuario-suggestions"
          class="absolute z-30 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white p-1 shadow-lg"
          role="listbox"
        >
          <button
            v-for="user in filteredUsers"
            :key="user.id_usuario"
            type="button"
            role="option"
            :aria-selected="props.filters.usuarioId === user.id_usuario"
            class="flex w-full flex-col rounded-md px-3 py-2 text-left hover:bg-indigo-50 focus:bg-indigo-50 focus:outline-none"
            @mousedown.prevent="selectUser(user)"
          >
            <span class="text-sm font-medium text-slate-800">
              {{ user.username || `Usuario #${user.id_usuario}` }}
            </span>
            <span class="text-xs text-slate-500">
              {{ user.nombreCompleto || 'Nombre no disponible' }}
            </span>
          </button>

          <p
            v-if="!filteredUsers.length"
            class="px-3 py-3 text-xs leading-5 text-slate-500"
          >
            No se encontraron coincidencias entre los usuarios de los registros cargados.
          </p>
        </div>

        <p
          v-if="usernameQuery && !props.filters.usuarioId && !suggestionsOpen"
          class="mt-1 text-xs text-amber-700"
        >
          Selecciona un usuario de la lista.
        </p>
      </div>

      <!-- Acción -->
      <div>
        <label
          for="f-accion"
          class="text-sm font-medium text-slate-700"
        >
          Tipo de operación
        </label>

        <select
          id="f-accion"
          v-model="filters.accion"
          :class="[field, ok]"
        >
          <option value="">Todas las operaciones</option>

          <optgroup
            v-for="group in [...new Set(ACCIONES_AUDITORIA.map(a => a.group))]"
            :key="group"
            :label="group"
          >
            <option
              v-for="action in ACCIONES_AUDITORIA.filter(a => a.group === group)"
              :key="action.value"
              :value="action.value"
            >
              {{ action.label }}
            </option>
          </optgroup>
        </select>

      </div>

      <!-- Tabla afectada -->
      <div>
        <label for="f-tabla" class="text-sm font-medium text-slate-700">
          Tabla afectada
        </label>
        <input
          id="f-tabla"
          v-model="props.filters.tabla"
          list="audit-tables"
          type="text"
          autocomplete="off"
          placeholder="Ej. libros"
          :class="[field, props.errors.tabla ? bad : ok]"
          :aria-invalid="!!props.errors.tabla"
          :aria-describedby="props.errors.tabla ? 'e-tabla' : undefined"
        />
        <datalist id="audit-tables">
          <option v-for="t in tables" :key="t" :value="t" />
        </datalist>
        <p v-if="props.errors.tabla" id="e-tabla" class="mt-1 text-xs text-red-600">
          {{ props.errors.tabla }}
        </p>
      </div>

      <!-- ID de registro -->
      <div>
        <label for="f-registro" class="text-sm font-medium text-slate-700">
          ID del registro
        </label>
        <input
          id="f-registro"
          v-model="props.filters.idRegistro"
          type="text"
          inputmode="numeric"
          autocomplete="off"
          placeholder="Requiere tabla"
          :class="[field, props.errors.idRegistro ? bad : ok]"
          :aria-invalid="!!props.errors.idRegistro"
          :aria-describedby="props.errors.idRegistro ? 'e-reg' : undefined"
        />
        <p v-if="props.errors.idRegistro" id="e-reg" class="mt-1 text-xs text-red-600">
          {{ props.errors.idRegistro }}
        </p>
      </div>

      <!-- Fecha inicial -->
      <div>
        <label for="f-desde" class="text-sm font-medium text-slate-700">
          Desde
        </label>
        <input
          id="f-desde"
          v-model="props.filters.fechaInicio"
          type="date"
          :class="[field, props.errors.fechaInicio ? bad : ok]"
          :aria-invalid="!!props.errors.fechaInicio"
          :aria-describedby="props.errors.fechaInicio ? 'e-desde' : undefined"
        />
        <p v-if="props.errors.fechaInicio" id="e-desde" class="mt-1 text-xs text-red-600">
          {{ props.errors.fechaInicio }}
        </p>
      </div>

      <!-- Fecha final -->
      <div>
        <label for="f-hasta" class="text-sm font-medium text-slate-700">
          Hasta
        </label>
        <input
          id="f-hasta"
          v-model="props.filters.fechaFin"
          type="date"
          :class="[field, props.errors.fechaFin ? bad : ok]"
          :aria-invalid="!!props.errors.fechaFin"
          :aria-describedby="props.errors.fechaFin ? 'e-hasta' : undefined"
        />
        <p v-if="props.errors.fechaFin" id="e-hasta" class="mt-1 text-xs text-red-600">
          {{ props.errors.fechaFin }}
        </p>
      </div>
    </div>

    <div class="mt-4 flex flex-wrap items-center gap-3">
      <SButton type="submit" :loading="loading">
        Aplicar filtros
      </SButton>

      <SButton
        type="button"
        variant="outline"
        :disabled="loading"
        @click="onClear(); $emit('clear')"
      >
        Limpiar filtros
      </SButton>

      <p v-if="note" class="text-xs text-slate-500" role="note">
        {{ note }}
      </p>
    </div>
  </form>
</template>