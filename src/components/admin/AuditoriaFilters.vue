<script setup lang="ts">
import { SButton } from '@/components'
import type { AuditoriaFilters, AuditoriaUsuario, FilterErrors } from '@/types/auditoria'

defineProps<{
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
</script>

<template>
  <form class="rounded-xl border border-slate-200 bg-white p-4" aria-label="Filtros de auditoría" novalidate @submit.prevent="$emit('apply')">
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      <div>
        <label for="f-usuario" class="text-sm font-medium text-slate-700">Usuario</label>
        <select id="f-usuario" v-model="filters.usuarioId" :class="[field, ok]">
          <option :value="null">Todos</option>
          <option v-for="u in users" :key="u.id_usuario" :value="u.id_usuario">
            {{ u.nombreCompleto || u.username || `Usuario #${u.id_usuario}` }}
          </option>
        </select>
      </div>

      <div>
        <label for="f-accion" class="text-sm font-medium text-slate-700">Acción</label>
        <select id="f-accion" v-model="filters.accion" :class="[field, ok]">
          <option value="">Todas</option>
          <option value="CREAR">Crear</option>
          <option value="ACTUALIZAR">Actualizar</option>
          <option value="ELIMINAR">Eliminar</option>
        </select>
      </div>

      <div>
        <label for="f-tabla" class="text-sm font-medium text-slate-700">Tabla afectada</label>
        <input id="f-tabla" v-model="filters.tabla" list="audit-tables" type="text" autocomplete="off" placeholder="Ej. libros"
          :class="[field, errors.tabla ? bad : ok]" :aria-invalid="!!errors.tabla" :aria-describedby="errors.tabla ? 'e-tabla' : undefined" />
        <datalist id="audit-tables"><option v-for="t in tables" :key="t" :value="t" /></datalist>
        <p v-if="errors.tabla" id="e-tabla" class="mt-1 text-xs text-red-600">{{ errors.tabla }}</p>
      </div>

      <div>
        <label for="f-registro" class="text-sm font-medium text-slate-700">ID del registro</label>
        <input id="f-registro" v-model="filters.idRegistro" type="text" inputmode="numeric" autocomplete="off" placeholder="Requiere tabla"
          :class="[field, errors.idRegistro ? bad : ok]" :aria-invalid="!!errors.idRegistro" :aria-describedby="errors.idRegistro ? 'e-reg' : undefined" />
        <p v-if="errors.idRegistro" id="e-reg" class="mt-1 text-xs text-red-600">{{ errors.idRegistro }}</p>
      </div>

      <div>
        <label for="f-desde" class="text-sm font-medium text-slate-700">Desde</label>
        <input id="f-desde" v-model="filters.fechaInicio" type="date" :class="[field, errors.fechaInicio ? bad : ok]"
          :aria-invalid="!!errors.fechaInicio" :aria-describedby="errors.fechaInicio ? 'e-desde' : undefined" />
        <p v-if="errors.fechaInicio" id="e-desde" class="mt-1 text-xs text-red-600">{{ errors.fechaInicio }}</p>
      </div>

      <div>
        <label for="f-hasta" class="text-sm font-medium text-slate-700">Hasta</label>
        <input id="f-hasta" v-model="filters.fechaFin" type="date" :class="[field, errors.fechaFin ? bad : ok]"
          :aria-invalid="!!errors.fechaFin" :aria-describedby="errors.fechaFin ? 'e-hasta' : undefined" />
        <p v-if="errors.fechaFin" id="e-hasta" class="mt-1 text-xs text-red-600">{{ errors.fechaFin }}</p>
      </div>
    </div>

    <div class="mt-4 flex flex-wrap items-center gap-3">
      <SButton type="submit" :loading="loading">Aplicar filtros</SButton>
      <SButton type="button" variant="outline" :disabled="loading" @click="$emit('clear')">Limpiar filtros</SButton>
      <p v-if="note" class="text-xs text-slate-500" role="note">{{ note }}</p>
    </div>
  </form>
</template>
