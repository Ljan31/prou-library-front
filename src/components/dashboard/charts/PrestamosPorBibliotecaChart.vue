<script setup lang="ts">
import { computed } from 'vue'
import { Bar } from 'vue-chartjs'
import ChartCard from './ChartCard.vue'
import { COLORS, tooltipLabel, baseScaleY } from './chartSetup'
import type { PrestamoPorBibliotecaDTO } from '@/types/dashboard.interface';

const props = defineProps<{ items: PrestamoPorBibliotecaDTO[]; loading?: boolean }>()

const empty = computed(() => !props.items.some(i => i.cantidad > 0))

const chartData = computed(() => ({
  labels: props.items.map(i => i.biblioteca),
  datasets: [{
    label: 'Préstamos',
    data: props.items.map(i => i.cantidad),
    backgroundColor: COLORS.violet,
    borderRadius: 6
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
  <ChartCard title="Actividad por biblioteca" description="Préstamos por sede · histórico" :loading="loading" :empty="empty">
    <Bar :data="chartData" :options="options" role="img" aria-label="Préstamos por biblioteca" />
  </ChartCard>
</template>