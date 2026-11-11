<script setup lang="ts">
import { computed, onMounted } from 'vue'
import SCard from '@/components/ui/SCard.vue'
import SBadge from '@/components/ui/SBadge.vue'
import SButton from '@/components/ui/SButton.vue'
import SSkeleton from '@/components/feedback/SSkeleton.vue'
import SEmptyState from '@/components/feedback/SEmptyState.vue'
import { BookIcon, ClockIcon, BookmarkIcon, ShieldIcon, DocumentCheckIcon, CalendarIcon, AlertTriangleIcon, LibraryIcon } from '@/views/dashboard/icons'
import { useDashboardEstudiante } from '../../composables/useDashboardEstudiante'
import { titleCase } from '../../utils/format'
import type { PrestamoActivoDTO } from '@/types/dashboard-estudiante.interface'
import IndicatorCard from './IndicatorCard.vue'
import PrestamosPorMesChart from './charts/PrestamosPorMesChart.vue'
import type { PeriodoPrestamosDTO } from '@/types/dashboard.interface'

const { data, loading, error, load } = useDashboardEstudiante()
onMounted(load)

const fecha = (iso: string) =>
  new Date(iso + 'T00:00:00').toLocaleDateString('es-BO', { day: '2-digit', month: 'short', year: 'numeric' })

// Solo presentación: el backend entrega diasRestantes ya calculado.
function plazo(p: PrestamoActivoDTO): { text: string; variant: 'danger' | 'warning' | 'success' } {
  if (p.diasRestantes < 0) {
    const d = Math.abs(p.diasRestantes)
    return { text: `${d} ${d === 1 ? 'día' : 'días'} de retraso`, variant: 'danger' }
  }
  if (p.diasRestantes === 0) return { text: 'Vence hoy', variant: 'warning' }
  return {
    text: `${p.diasRestantes} ${p.diasRestantes === 1 ? 'día' : 'días'}`,
    variant: p.diasRestantes <= 3 ? 'warning' : 'success'
  }
}

const cards = computed(() => {
  const d = data.value
  return [
    { label: 'Préstamos activos', value: d?.totalPrestamosActivos ?? null, sub: `${d?.totalPrestamosVencidos ?? '—'} vencidos`,
      icon: ClockIcon, color: 'bg-amber-50 text-amber-600', ring: 'ring-amber-100', alert: (d?.totalPrestamosVencidos ?? 0) > 0 },
    { label: 'Reservas activas', value: d?.totalReservasActivas ?? null, sub: 'Esperando tu retiro',
      icon: BookmarkIcon, color: 'bg-sky-50 text-sky-600', ring: 'ring-sky-100' },
    { label: 'Sanciones activas', value: d?.totalSancionesActivas ?? null, sub: 'Restricciones vigentes',
      icon: ShieldIcon, color: 'bg-red-50 text-red-600', ring: 'ring-red-100', alert: (d?.totalSancionesActivas ?? 0) > 0 },
    { label: 'Libros leídos', value: d?.totalPrestamosHistoricos ?? null, sub: 'Préstamos en total',
      icon: BookIcon, color: 'bg-indigo-50 text-indigo-600', ring: 'ring-indigo-100' }
  ]
})
const prestamosPorMesAdaptados = computed<PeriodoPrestamosDTO[]>(() => {
  const grafico = data.value?.prestamosPorMes

  if (!grafico) return []

  return grafico.etiquetas?.map((etiqueta, index) => {
    const [anio, mes] = etiqueta.split('-').map(Number)

    return {
      anio,
      mes,
      cantidad: grafico.series[0]?.valores[index] ?? 0
    }
  })
})
const sancionesAgrupadas = computed(() => {
  const sanciones = data.value?.sancionesActivas ?? []
  const grupos = new Map()

  sanciones.forEach(s => {
    const key = s.idPrestamo
      ? `prestamo-${s.idPrestamo}`
      : `individual-${s.idSancion}`

    if (!grupos.has(key)) {
      grupos.set(key, {
        id: key,
        titulo: s.tituloLibro,
        biblioteca: s.nombreBiblioteca,
        sanciones: []
      })
    }

    grupos.get(key).sanciones.push(s)
  })

  return Array.from(grupos.values())
})
</script>

<template>
  <div class="space-y-7">
    <SCard v-if="error" variant="bordered" padding="md" role="alert">
      <div class="flex items-center justify-between gap-3 flex-wrap">
        <p class="text-sm text-red-600">No se pudo cargar tu resumen. {{ error }}</p>
        <SButton size="sm" variant="secondary" @click="load">Reintentar</SButton>
      </div>
    </SCard>

    <template v-else>
      <!-- Sanción vigente -->
      <section
        v-if="sancionesAgrupadas.length"
        class="space-y-3"
      >
        <div class="flex items-center justify-between">
          <div>
            <h3 class="text-sm font-semibold text-slate-900">
              Sanciones activas
            </h3>
            <p class="text-xs text-slate-500 mt-0.5">
              Sanciones asociadas a tus préstamos
            </p>
          </div>

          <SBadge variant="danger" dot>
            {{ data.sancionesActivas.length }}
          </SBadge>
        </div>

        <!-- Una tarjeta por libro -->
        <div
          v-for="grupo in sancionesAgrupadas"
          :key="grupo.id"
          class="rounded-xl border border-red-200
                bg-red-50/80 overflow-hidden"
        >
          <div class="p-4 space-y-3">

            <!-- Libro y biblioteca -->
            <div class="flex items-start gap-2.5">
              <div
                class="w-9 h-9 rounded-lg bg-red-100
                      text-red-600 flex items-center
                      justify-center shrink-0"
              >
                <AlertTriangleIcon class="w-5 h-5" />
              </div>

              <div class="min-w-0 flex-1">
                <h4 class="text-sm font-semibold text-red-950">
                  {{ grupo.titulo || 'Sanción sin libro asociado' }}
                </h4>

                <p class="text-xs text-red-700 mt-1">
                  {{ grupo.biblioteca }}
                </p>
              </div>
              <SBadge variant="danger" dot>
                  Activa
                </SBadge>
            </div>
            <div
              v-if="grupo.sanciones.some(s => s.motivo)"
              class="flex items-center gap-2 pt-1"
            >
              -

              <div class="text-xs text-red-800">
                <template
                  v-for="(s, index) in grupo.sanciones.filter(s => s.motivo)"
                  :key="s.idSancion"
                >
                  <span v-if="index > 0"> · </span>
                  <span>
                    {{ titleCase(s.motivo.replaceAll('_', ' ')) }}
                  </span>
                </template>
              </div>
            </div>
            <!-- Fecha de vigencia -->
            <div
              v-if="grupo.sanciones.some(s => s.fechaInicio)"
              class="flex items-center gap-2 pt-1"
            >
              <CalendarIcon class="w-4 h-4 text-red-600 shrink-0" />

              <div class="text-xs text-red-800">
                <template
                  v-for="(s, index) in grupo.sanciones.filter(s => s.fechaInicio)"
                  :key="s.idSancion"
                >
                  <span v-if="index > 0"> · </span>
                  <span>
                    {{ fecha(s.fechaInicio) }}
                  </span>
                </template>
              </div>
            </div>

          </div>
        </div>
      </section>

      <!-- Indicadores -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <template v-if="loading">
          <SCard v-for="i in 4" :key="i" padding="lg">
            <SSkeleton width="60%" height="0.75rem" class="mb-3" />
            <SSkeleton width="40%" height="1.75rem" class="mb-2" />
            <SSkeleton width="80%" height="0.65rem" />
          </SCard>
        </template>
        <IndicatorCard v-else v-for="c in cards" :key="c.label" v-bind="c" />
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <!-- Préstamos activos -->
        <SCard variant="bordered" padding="lg" class="lg:col-span-2">
          <h3 class="text-sm font-semibold text-slate-900 mb-4">Mis préstamos activos</h3>
          <SSkeleton v-if="loading" width="100%" height="8rem" />
          <SEmptyState v-else-if="!data?.prestamosActivos?.length" icon="book" title="Sin préstamos activos"
            description="Cuando pidas un libro, aparecerá aquí con su fecha de devolución." />
          <ul v-else class="divide-y divide-slate-100">
            <li
              v-for="p in data.prestamosActivos"
              :key="p.idPrestamo"
              class="py-3 flex items-start justify-between gap-3"
            >
              <div class="min-w-0 flex-1 space-y-1.5">

                <div class="flex items-center gap-2 flex-wrap">
                  <p
                    class="text-sm font-semibold text-slate-800 truncate"
                    :title="p.titulo"
                  >
                    {{ p.titulo }}
                  </p>
                  <span class="text-[10px] text-slate-400">
                    #{{ p.idPrestamo }}
                  </span>
                </div>

                <div class="flex items-center gap-1.5 text-xs text-slate-500">
                  <LibraryIcon class="w-3.5 h-3.5 shrink-0" />
                  <span>{{ p.nombreBiblioteca }}</span>
                </div>

                <p class="text-xs text-slate-400">
                  {{ titleCase(p.tipo) }} · Devolver antes del
                  {{ fecha(p.fechaEstimadaDevolucion) }}
                </p>

              </div>

              <SBadge :variant="plazo(p).variant" :dot="true">
                {{ plazo(p).text }}
              </SBadge>
            </li>
          </ul>
        </SCard>

        <!-- Certificado de no deuda -->
        <SCard variant="bordered" padding="lg">
          <div class="flex items-center gap-2 mb-3 text-slate-900">
            <DocumentCheckIcon />
            <h3 class="text-sm font-semibold">Certificado de no deuda</h3>
          </div>
          <SSkeleton v-if="loading" width="100%" height="4rem" />
          <template v-else-if="data">
            <SBadge :variant="data.certificadoNoDeuda.habilitado ? 'success' : 'warning'" :dot="true">
              {{ data.certificadoNoDeuda.habilitado ? 'Habilitado' : 'No habilitado' }}
            </SBadge>
            <p v-if="data.certificadoNoDeuda.motivo" class="text-xs text-slate-500 mt-3">{{ data.certificadoNoDeuda.motivo }}</p>
            <RouterLink v-if="data.certificadoNoDeuda.habilitado" to="/certificados"
              class="inline-block mt-3 text-sm font-medium text-indigo-600 underline">Solicitar certificado</RouterLink>
          </template>
        </SCard>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div class="lg:col-span-2">
          <PrestamosPorMesChart :items="prestamosPorMesAdaptados ?? []" :loading="loading" />
        </div>

        <!-- Reservas -->
        <SCard variant="bordered" padding="lg">
          <h3 class="text-sm font-semibold text-slate-900 mb-4">Mis reservas</h3>
          <SSkeleton v-if="loading" width="100%" height="8rem" />
          <SEmptyState v-else-if="!data?.reservasActivas?.length" icon="inbox" title="Sin reservas" />
          <ul v-else class="divide-y divide-slate-100">
            <li
              v-for="r in data.reservasActivas"
              :key="r.idReserva"
              class="py-3 space-y-1.5"
            >
              <div class="flex items-center justify-between gap-2">
                <p
                  class="text-sm font-medium text-slate-800 truncate"
                  :title="r.titulo"
                >
                  {{ r.titulo }}
                </p>

                <span class="text-[10px] text-slate-400 shrink-0">
                  #{{ r.idReserva }}
                </span>
              </div>

              <div class="flex items-center gap-1.5 text-xs text-slate-500">
                <LibraryIcon class="w-3.5 h-3.5 shrink-0" />
                <span>{{ r.nombreBiblioteca }}</span>
              </div>

              <div class="flex items-center gap-2">
                <SBadge :variant="r.estado === 'NOTIFICADA' ? 'success' : 'info'">
                  {{ titleCase(r.estado) }}
                </SBadge>

                <span class="text-xs text-slate-400">
                  {{ fecha(r.fechaReserva) }}
                </span>
              </div>
            </li>
          </ul>
        </SCard>
      </div>
    </template>
  </div>
</template>