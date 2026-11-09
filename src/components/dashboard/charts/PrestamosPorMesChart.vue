<script setup lang="ts">
import { computed } from 'vue'
import { Line } from 'vue-chartjs'
import ChartCard from './ChartCard.vue'
import { COLORS, tooltipLabel, baseScaleY } from './chartSetup'
import type { PeriodoPrestamosDTO } from '@/types/dashboard.interface';
import { monthLabel } from '@/utils/format';

const props = defineProps<{ items: PeriodoPrestamosDTO[]; loading?: boolean }>()

const empty = computed(() => !props.items.some(i => i.cantidad > 0))

const chartData = computed(() => ({
  labels: props.items.map(i => monthLabel(i.anio, i.mes)),
  datasets: [{
    label: 'Préstamos',
    data: props.items.map(i => i.cantidad),
    borderColor: COLORS.indigo,
    backgroundColor: 'rgba(79,70,229,.10)',
    fill: true,
    tension: 0.35,
    pointRadius: 4
  }]
}))

const options = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false }, tooltip: { callbacks: { label: tooltipLabel } } },
  scales: { y: baseScaleY, x: { grid: { display: false } } }
}
</script>

<template>
  <ChartCard title="Evolución mensual de préstamos" description="Últimos 6 meses" :loading="loading" :empty="empty">
    <Line :data="chartData" :options="options" role="img" aria-label="Préstamos por mes, últimos seis meses" />
  </ChartCard>
</template>