<script setup lang="ts">
import { computed } from 'vue'
import { Bar } from 'vue-chartjs'
import ChartCard from './ChartCard.vue'
import { COLORS, tooltipLabel, baseScaleY } from './chartSetup'
import type { DevolucionPorMesDTO } from '@/types/dashboard.interface';
import { monthLabel } from '@/utils/format';


const props = defineProps<{ items: DevolucionPorMesDTO[]; loading?: boolean }>()

const empty = computed(() => !props.items.some(i => i.puntuales > 0 || i.tardias > 0))

const chartData = computed(() => ({
  labels: props.items.map(i => monthLabel(i.anio, i.mes)),
  datasets: [
    { label: 'Puntuales', data: props.items.map(i => i.puntuales), backgroundColor: COLORS.emerald, borderRadius: 4 },
    { label: 'Tardías', data: props.items.map(i => i.tardias), backgroundColor: COLORS.red, borderRadius: 4 }
  ]
}))

const options = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { position: 'bottom' as const, labels: { usePointStyle: true, boxWidth: 8 } },
    tooltip: { callbacks: { label: tooltipLabel } }
  },
  scales: { y: baseScaleY, x: { grid: { display: false } } }
}
</script>

<template>
  <ChartCard title="Devoluciones puntuales y tardías" description="Últimos 6 meses" :loading="loading" :empty="empty">
    <Bar :data="chartData" :options="options" role="img" aria-label="Devoluciones puntuales y tardías por mes" />
  </ChartCard>
</template>