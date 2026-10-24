<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { SButton, SCard, SEmptyState, SSkeleton } from '@/components'
import { useUiStore } from '@/stores/ui.store'
import { PAGE_SIZE, useAuditoria } from '@/composables/useAuditoria'
import type { AuditoriaResponse } from '@/types/auditoria'
import { formatAuditDate, recordsToCsv, userDisplay } from '@/utils/auditoria'
import AuditActionBadge from '@/components/admin/AuditActionBadge.vue'
import AuditoriaDetailModal from '@/components/admin/AuditoriaDetailModal.vue'
import AuditoriaFilters from '@/components/admin/AuditoriaFilters.vue'

const ui = useUiStore()
const a = useAuditoria()

const detail = ref<AuditoriaResponse | null>(null)
const detailOpen = ref(false)
const openDetail = (r: AuditoriaResponse) => { detail.value = r; detailOpen.value = true }

onMounted(() => {
  ui.setBreadcrumbs([{ label: 'Auditoría' }])
  a.init()
})
onBeforeUnmount(a.abort)

const blocked = computed(() => a.error.value?.kind === 'forbidden' || a.error.value?.kind === 'session')
const initialLoading = computed(() => a.loadMode.value === 'initial' || (a.loading.value && !a.hasLoaded.value))
const showResults = computed(() => !blocked.value && !initialLoading.value && !(a.error.value && !a.records.value.length))

const ENDPOINT_LABEL: Record<string, string> = {
  registro: 'tabla + ID de registro', fechas: 'rango de fechas', usuario: 'usuario', tabla: 'tabla', accion: 'acción',
}
const note = computed(() => {
  const p = a.plan.value
  const f = a.filters
  const active = [f.usuarioId != null, !!f.accion, !!f.tabla.trim(), !!f.idRegistro.trim(), !!(f.fechaInicio && f.fechaFin)].filter(Boolean).length
  return active > 1 && p.endpoint !== 'all'
    ? `Se consulta al servidor por ${ENDPOINT_LABEL[p.endpoint]} y los demás filtros se aplican sobre ese resultado.`
    : ''
})

const totalText = computed(() => {
  const n = a.records.value.length
  return `${n} ${n === 1 ? 'registro' : 'registros'}${a.hasActiveFilters.value ? ' con los filtros aplicados' : ''}`
})
const from = computed(() => (a.page.value - 1) * PAGE_SIZE + 1)
const to = computed(() => Math.min(a.page.value * PAGE_SIZE, a.records.value.length))

function exportCsv() {
  const blob = new Blob([recordsToCsv(a.records.value)], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `auditoria-${new Date().toISOString().slice(0, 10)}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

const cards = computed(() => [
  { label: 'Acciones encontradas', value: a.stats.value.total },
  { label: 'Creaciones', value: a.stats.value.crear },
  { label: 'Actualizaciones', value: a.stats.value.actualizar },
  { label: 'Eliminaciones', value: a.stats.value.eliminar },
])
const th = 'whitespace-nowrap px-4 py-3 text-left text-xs font-semibold text-slate-600'
</script>

<template>
  <div class="min-h-full space-y-5 bg-slate-50/70 p-4 sm:p-6 lg:p-8">
    <!-- Encabezado -->
    <header class="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
      <div class="min-w-0">

        <h1 class="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          Auditoría del sistema
        </h1>

        <p class="max-w-2xl text-sm leading-6 text-slate-500">
          Supervisa las operaciones, identifica a los responsables y consulta
          los cambios registrados en el sistema.
        </p>

        <p
          v-if="a.hasLoaded.value && !blocked"
          class="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600"
          role="status"
        >
          <span class="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          {{ totalText }}
        </p>
      </div>

      <div class="flex shrink-0 flex-wrap items-center gap-2">
        <SButton
          variant="outline"
          :disabled="!a.records.value.length || blocked"
          @click="exportCsv"
        >
          <span class="mr-1.5" aria-hidden="true">↓</span>
          Exportar CSV
        </SButton>

        <SButton
          variant="secondary"
          :loading="a.loadMode.value === 'refresh'"
          :disabled="a.loading.value || blocked"
          @click="a.refresh()"
        >
          <span class="mr-1.5" aria-hidden="true">↻</span>
          Actualizar
        </SButton>
      </div>
    </header>

    <!-- Acceso restringido o sesión expirada -->
    <div
      v-if="blocked"
      role="alert"
      class="rounded-2xl border border-red-200 bg-white p-6 shadow-sm"
    >
      <div class="flex items-start gap-4">
        <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-50 text-xl text-red-600">
          !
        </div>

        <div>
          <h2 class="font-semibold text-slate-900">
            {{ a.error.value?.kind === 'forbidden'
              ? 'Acceso restringido'
              : 'Tu sesión ha expirado' }}
          </h2>
          <p class="mt-1 text-sm leading-6 text-slate-600">
            {{ a.error.value?.message }}
          </p>
        </div>
      </div>
    </div>

    <template v-else>
      <!-- Indicadores -->
      <section aria-label="Resumen de auditoría">
        <div class="mb-1 flex items-center justify-between gap-3">
          <h2 class="text-sm font-semibold text-slate-800">
            Resumen de actividad
          </h2>
          <span class="text-xs text-slate-400">
            Registros cargados
          </span>
        </div>

        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <SCard
            v-for="(c, index) in cards"
            :key="c.label"
            variant="bordered"
            class="min-w-0 transition-shadow duration-200 hover:shadow-md"
          >
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <p class="text-sm font-medium text-slate-500">
                  {{ c.label }}
                </p>

                <SSkeleton
                  v-if="initialLoading"
                  width="4rem"
                  height="2rem"
                  class="mt-3"
                />

                <p
                  v-else
                  class="mt-2 text-3xl font-bold tracking-tight text-slate-900"
                >
                  {{ a.hasLoaded.value
                    ? c.value.toLocaleString('es-BO')
                    : '—' }}
                </p>
              </div>

              <div
                class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-lg font-semibold"
                :class="[
                  'bg-indigo-50 text-indigo-600',
                  index === 1 ? 'bg-emerald-50 text-emerald-600' : '',
                  index === 2 ? 'bg-blue-50 text-blue-600' : '',
                  index === 3 ? 'bg-rose-50 text-rose-600' : '',
                ]"
                aria-hidden="true"
              >
                {{ ['≡', '+', '↻', '−'][index] ?? '•' }}
              </div>
            </div>

            <div class="mt-3 h-1 overflow-hidden rounded-full bg-slate-100">
              <div
                class="h-full w-1/3 rounded-full"
                :class="[
                  'bg-indigo-500',
                  index === 1 ? 'bg-emerald-500' : '',
                  index === 2 ? 'bg-blue-500' : '',
                  index === 3 ? 'bg-rose-500' : '',
                ]"
              />
            </div>
          </SCard>
        </div>
      </section>

      <!-- Filtros -->
      <section class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
          <div>
            <h2 class="font-semibold text-slate-900">
              Filtrar registros
            </h2>
            <p class="mt-1 text-sm text-slate-500">
              Encuentra operaciones por usuario, acción, tabla o fecha.
            </p>
          </div>

          <span class="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
            Búsqueda avanzada
          </span>
        </div>

        <div class="p-2">
          <AuditoriaFilters
            :filters="a.filters"
            :errors="a.filterErrors.value"
            :users="a.userOptions.value"
            :tables="[...a.knownTables.value]"
            :loading="a.loadMode.value === 'filters'"
            :note="note"
            @apply="a.apply()"
            @clear="a.clear()"
          />
        </div>
      </section>

      <!-- Error de consulta -->
      <div
        v-if="a.error.value && !blocked"
        role="alert"
        class="flex flex-col justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 sm:flex-row sm:items-center"
      >
        <div>
          <p class="text-sm font-semibold text-red-800">
            No se pudieron cargar todos los registros
          </p>
          <p class="mt-1 text-sm text-red-700">
            {{ a.error.value.message }}
          </p>
        </div>

        <SButton
          size="sm"
          variant="outline"
          @click="a.refresh()"
        >
          Reintentar
        </SButton>
      </div>

      <!-- Historial -->
      <section
        aria-live="polite"
        :aria-busy="a.loading.value"
        class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
      >
        <div class="flex flex-col justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:px-6">
          <div>
            <h2 class="font-semibold text-slate-900">
              Historial de actividad
            </h2>
            <p class="mt-1 text-sm text-slate-500">
              Detalle cronológico de las operaciones registradas.
            </p>
          </div>

          <span
            v-if="a.hasLoaded.value && a.records.value.length"
            class="self-start rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium tabular-nums text-slate-600 sm:self-auto"
          >
            {{ a.records.value.length.toLocaleString('es-BO') }} registros
          </span>
        </div>

        <!-- Carga inicial -->
        <div
          v-if="initialLoading"
          class="space-y-3 p-5"
          aria-label="Cargando registros"
        >
          <SSkeleton
            v-for="i in 7"
            :key="i"
            width="100%"
            height="3.5rem"
          />
        </div>

        <!-- Sin resultados -->
        <div v-else-if="showResults && !a.records.value.length" class="p-6 sm:p-12">
          <SEmptyState
            icon="search"
            :title="a.hasActiveFilters.value
              ? 'No encontramos coincidencias'
              : 'Todavía no hay actividad registrada'"
            :description="a.hasActiveFilters.value
              ? 'Prueba con otros criterios o limpia los filtros para ampliar la búsqueda.'
              : 'Cuando se registren operaciones en el sistema, aparecerán en este historial.'"
          />
          <div
            v-if="a.hasActiveFilters.value"
            class="mt-4 flex justify-center"
          >
            <SButton variant="outline" @click="a.clear()">
              Limpiar filtros
            </SButton>
          </div>
        </div>

        <!-- Tabla -->
        <div
          v-else-if="showResults"
          :class="{ 'opacity-60 transition-opacity': a.loading.value }"
        >
          <div class="overflow-x-auto">
            <table class="w-full min-w-[1000px] border-collapse text-left text-sm">
              <caption class="sr-only">
                Historial de auditoría, del más reciente al más antiguo.
              </caption>

              <thead>
                <tr class="border-b border-slate-100 bg-slate-50/80">
                  <th scope="col" :class="th">
                    Fecha y hora
                  </th>
                  <th scope="col" :class="th">
                    Usuario responsable
                  </th>
                  <th scope="col" :class="th">
                    Acción
                  </th>
                  <th scope="col" :class="th">
                    Tabla afectada
                  </th>
                  <th scope="col" :class="th">
                    ID registro
                  </th>
                  <th scope="col" :class="th">
                    Dirección IP
                  </th>
                  <th scope="col" class="px-4 py-3 text-right">
                    <span class="sr-only">Acciones</span>
                  </th>
                </tr>
              </thead>

              <tbody class="divide-y divide-slate-100">
                <tr
                  v-for="r in a.pageRows.value"
                  :key="r.id_auditoria"
                  class="group transition-colors hover:bg-indigo-50/30"
                >
                  <!-- Fecha -->
                  <td class="whitespace-nowrap px-4 py-4 text-slate-600">
                    <span class="font-medium text-slate-800">
                      {{ formatAuditDate(r.fechaHora) }}
                    </span>
                  </td>

                  <!-- Usuario -->
                  <td class="px-4 py-4">
                    <div class="flex min-w-0 items-center gap-3">
                      <div
                        class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600"
                        aria-hidden="true"
                      >
                        {{ userDisplay(r.usuario).primary
                          .slice(0, 1).toUpperCase() }}
                      </div>

                      <div class="min-w-0">
                        <p
                          class="max-w-[190px] truncate font-medium"
                          :class="r.usuario ? 'text-slate-800' : 'text-slate-400'"
                        >
                          {{ userDisplay(r.usuario).primary }}
                        </p>
                        <p
                          v-if="userDisplay(r.usuario).secondary"
                          class="mt-0.5 max-w-[190px] truncate text-xs text-slate-500"
                        >
                          @{{ userDisplay(r.usuario).secondary }}
                        </p>
                      </div>
                    </div>
                  </td>

                  <!-- Acción -->
                  <td class="whitespace-nowrap px-4 py-4">
                    <AuditActionBadge :accion="r.accion" />
                  </td>

                  <!-- Tabla afectada -->
                  <td class="px-4 py-4">
                    <span
                      class="inline-block max-w-[180px] truncate rounded-md bg-slate-100 px-2 py-1 font-mono text-xs text-slate-600"
                      :title="r.tablaAfectada ?? ''"
                    >
                      {{ r.tablaAfectada ?? '—' }}
                    </span>
                  </td>

                  <!-- Identificador -->
                  <td class="px-4 py-4">
                    <span class="font-mono text-xs tabular-nums text-slate-600">
                      {{ r.id_registro ?? '—' }}
                    </span>
                  </td>

                  <!-- IP -->
                  <td class="whitespace-nowrap px-4 py-4 font-mono text-xs text-slate-500">
                    {{ r.ipAddress ?? '—' }}
                  </td>

                  <!-- Detalle -->
                  <td class="px-4 py-4 text-right">
                    <SButton
                      size="xs"
                      variant="ghost"
                      :aria-label="`Ver detalle de la auditoría ${r.id_auditoria}`"
                      @click="openDetail(r)"
                    >
                      Ver detalle
                      <span class="ml-1" aria-hidden="true">→</span>
                    </SButton>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Paginación -->
          <nav
            v-if="a.totalPages.value > 1"
            class="flex flex-col gap-4 border-t border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6"
            aria-label="Paginación del historial"
          >
            <p class="text-sm text-slate-500">
              Mostrando
              <span class="font-semibold text-slate-800">{{ from }}–{{ to }}</span>
              de
              <span class="font-semibold text-slate-800">{{ a.records.value.length }}</span>
              registros
            </p>

            <div class="flex flex-wrap items-center gap-2">
              <SButton
                size="sm"
                variant="outline"
                :disabled="a.page.value <= 1"
                @click="a.page.value--"
              >
                ← Anterior
              </SButton>

              <span class="rounded-lg bg-slate-100 px-3 py-2 text-xs font-semibold tabular-nums text-slate-700">
                {{ a.page.value }} / {{ a.totalPages.value }}
              </span>

              <SButton
                size="sm"
                variant="outline"
                :disabled="a.page.value >= a.totalPages.value"
                @click="a.page.value++"
              >
                Siguiente →
              </SButton>
            </div>
          </nav>
        </div>
      </section>

      <!-- Nota de contexto -->
      <p class="text-center text-xs leading-5 text-slate-400">
        El historial permite consultar operaciones registradas.
        Los datos disponibles dependen de los permisos y filtros aplicados.
      </p>
    </template>

    <AuditoriaDetailModal
      v-model="detailOpen"
      :record="detail"
    />
  </div>
</template>
