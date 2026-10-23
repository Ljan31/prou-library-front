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
  <div class="page-container space-y-6">
    <header class="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 class="text-xl font-semibold text-slate-900">Auditoría del sistema</h1>
        <p class="mt-1 max-w-prose text-sm text-slate-600">
          Consulta quién creó, modificó o eliminó información en el sistema, con los valores antes y después de cada cambio.
        </p>
        <p v-if="a.hasLoaded.value && !blocked" class="mt-2 text-sm font-medium text-slate-700" role="status">{{ totalText }}</p>
      </div>
      <div class="flex gap-2">
        <SButton variant="outline" :disabled="!a.records.value.length || blocked" @click="exportCsv">Exportar CSV</SButton>
        <SButton variant="secondary" :loading="a.loadMode.value === 'refresh'" :disabled="a.loading.value" @click="a.refresh()">Actualizar</SButton>
      </div>
    </header>

    <!-- Sesión expirada / sin permisos: no se muestra ningún dato -->
    <div v-if="blocked" role="alert" class="rounded-xl border border-red-200 bg-red-50 p-6">
      <h2 class="font-semibold text-red-800">{{ a.error.value?.kind === 'forbidden' ? 'Acceso restringido' : 'Sesión expirada' }}</h2>
      <p class="mt-1 text-sm text-red-700">{{ a.error.value?.message }}</p>
    </div>

    <template v-else>
      <section aria-label="Resumen" class="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <SCard v-for="c in cards" :key="c.label" variant="bordered">
          <p class="text-sm text-slate-600">{{ c.label }}</p>
          <SSkeleton v-if="initialLoading" width="3rem" height="2rem" class="mt-1" />
          <p v-else class="mt-1 text-2xl font-semibold text-slate-900">{{ a.hasLoaded.value ? c.value : '—' }}</p>
        </SCard>
        <p class="col-span-2 text-xs text-slate-500 lg:col-span-4">
          Los indicadores se calculan sobre los registros cargados con los filtros actuales; el servidor no entrega totales globales.
        </p>
      </section>

      <AuditoriaFilters :filters="a.filters" :errors="a.filterErrors.value" :users="a.userOptions.value"
        :tables="[...a.knownTables.value]" :loading="a.loadMode.value === 'filters'" :note="note"
        @apply="a.apply()" @clear="a.clear()" />

      <div v-if="a.error.value && !blocked" role="alert" class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
        <p class="text-sm text-red-700">{{ a.error.value.message }}</p>
        <SButton size="sm" variant="outline" @click="a.refresh()">Reintentar</SButton>
      </div>

      <section aria-live="polite" :aria-busy="a.loading.value">
        <div v-if="initialLoading" class="space-y-2" aria-label="Cargando registros">
          <SSkeleton v-for="i in 8" :key="i" width="100%" height="2.5rem" />
        </div>

        <SEmptyState v-else-if="showResults && !a.records.value.length" icon="search"
          :title="a.hasActiveFilters.value ? 'Sin resultados para estos filtros' : 'Aún no hay registros de auditoría'"
          :description="a.hasActiveFilters.value ? 'Prueba con otro rango de fechas o limpia los filtros.' : 'Los cambios que se hagan en el sistema aparecerán aquí.'" />

        <div v-else-if="showResults" :class="{ 'opacity-60 transition-opacity': a.loading.value }">
          <div class="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table class="min-w-full divide-y divide-slate-200 text-sm">
              <caption class="sr-only">Historial de auditoría, del más reciente al más antiguo</caption>
              <thead class="bg-slate-50">
                <tr>
                  <th scope="col" :class="th">Fecha y hora</th>
                  <th scope="col" :class="th">Usuario responsable</th>
                  <th scope="col" :class="th">Acción</th>
                  <th scope="col" :class="th">Tabla afectada</th>
                  <th scope="col" :class="th">ID registro</th>
                  <th scope="col" :class="th">Dirección IP</th>
                  <th scope="col" :class="th"><span class="sr-only">Acciones</span></th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                <tr v-for="r in a.pageRows.value" :key="r.id_auditoria" class="hover:bg-slate-50">
                  <td class="whitespace-nowrap px-4 py-3 text-slate-700">{{ formatAuditDate(r.fechaHora) }}</td>
                  <td class="px-4 py-3">
                    <p class="font-medium text-slate-900" :class="{ 'text-slate-500 font-normal': !r.usuario }">{{ userDisplay(r.usuario).primary }}</p>
                    <p v-if="userDisplay(r.usuario).secondary" class="text-xs text-slate-500">@{{ userDisplay(r.usuario).secondary }}</p>
                  </td>
                  <td class="px-4 py-3"><AuditActionBadge :accion="r.accion" /></td>
                  <td class="px-4 py-3 text-slate-700">{{ r.tablaAfectada ?? '—' }}</td>
                  <td class="px-4 py-3 text-slate-700">{{ r.id_registro ?? '—' }}</td>
                  <td class="whitespace-nowrap px-4 py-3 text-slate-700">{{ r.ipAddress ?? '—' }}</td>
                  <td class="px-4 py-3 text-right">
                    <SButton size="xs" variant="ghost" :aria-label="`Ver detalle de la auditoría ${r.id_auditoria}`" @click="openDetail(r)">Ver detalle</SButton>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <nav v-if="a.totalPages.value > 1" class="mt-4 flex flex-wrap items-center justify-between gap-3" aria-label="Paginación">
            <p class="text-sm text-slate-600">Mostrando {{ from }}–{{ to }} de {{ a.records.value.length }}</p>
            <div class="flex items-center gap-2">
              <SButton size="sm" variant="outline" :disabled="a.page.value <= 1" @click="a.page.value--">Anterior</SButton>
              <span class="text-sm text-slate-600">Página {{ a.page.value }} de {{ a.totalPages.value }}</span>
              <SButton size="sm" variant="outline" :disabled="a.page.value >= a.totalPages.value" @click="a.page.value++">Siguiente</SButton>
            </div>
          </nav>
        </div>
      </section>
    </template>

    <AuditoriaDetailModal v-model="detailOpen" :record="detail" />
  </div>
</template>