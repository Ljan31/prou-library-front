<script setup lang="ts">
import { computed } from 'vue'
import SCard from '@/components/ui/SCard.vue'
import SSkeleton from '@/components/feedback/SSkeleton.vue'
import IndicatorCard from './IndicatorCard.vue'
import { BookIcon, ClockIcon, BookmarkIcon, ShieldIcon, UsersIcon, DocumentCheckIcon } from '@/views/dashboard/icons'
import type { DashboardDTO } from '@/types/dashboard.interface'
import { formatNumber } from '@/utils/format'

const props = defineProps<{ data: DashboardDTO | null; loading: boolean }>()

const cards = computed(() => {
  const d = props.data
  return [
    { label: 'Libros en catálogo', value: d?.totalLibros ?? null, sub: `${formatNumber(d?.totalEjemplares)} ejemplares`,
      icon: BookIcon, color: 'bg-indigo-50 text-indigo-600', ring: 'ring-indigo-100' },
    { label: 'Préstamos activos', value: d?.totalPrestamosActivos ?? null, sub: `${formatNumber(d?.totalPrestamosVencidos)} vencidos`,
      icon: ClockIcon, color: 'bg-amber-50 text-amber-600', ring: 'ring-amber-100',
      alert: (d?.totalPrestamosVencidos ?? 0) > 0 },
    { label: 'Reservas', value: d?.totalReservas ?? null, sub: 'Activas y notificadas',
      icon: BookmarkIcon, color: 'bg-sky-50 text-sky-600', ring: 'ring-sky-100' },
    { label: 'Sanciones activas', value: d?.totalSancionesActivas ?? null, sub: 'Usuarios sancionados',
      icon: ShieldIcon, color: 'bg-red-50 text-red-600', ring: 'ring-red-100',
      alert: (d?.totalSancionesActivas ?? 0) > 0 },
    { label: 'Usuarios registrados', value: d?.totalUsuarios ?? null, sub: 'Cuentas en el sistema',
      icon: UsersIcon, color: 'bg-emerald-50 text-emerald-600', ring: 'ring-emerald-100' },
    { label: 'Certificados emitidos', value: d?.totalCertificadosEmitidos ?? null, sub: 'Historial total',
      icon: DocumentCheckIcon, color: 'bg-violet-50 text-violet-600', ring: 'ring-violet-100' }
  ]
})
</script>

<template>
  <div class="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
    <template v-if="loading">
      <SCard v-for="i in 6" :key="i" padding="lg">
        <SSkeleton width="60%" height="0.75rem" class="mb-3" />
        <SSkeleton width="40%" height="1.75rem" class="mb-2" />
        <SSkeleton width="80%" height="0.65rem" />
      </SCard>
    </template>
    <template v-else>
      <IndicatorCard v-for="c in cards" :key="c.label" v-bind="c" />
    </template>
  </div>
</template>