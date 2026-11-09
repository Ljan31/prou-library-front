<script setup lang="ts">
import { computed } from 'vue'
import { Bar } from 'vue-chartjs'
import ChartCard from './ChartCard.vue'
import { COLORS, tooltipLabel } from './chartSetup'
import type { LibroMasPrestadoDTO } from '@/types/dashboard.interface';

const props = defineProps<{ items: LibroMasPrestadoDTO[]; loading?: boolean }>()

const empty = computed(() => !props.items.some(i => i.cantidad > 0))

const chartData = computed(() => ({
  labels: props.items.map(i => i.titulo),
  datasets: [{
    label: 'Préstamos',
    data: props.items.map(i => i.cantidad),
    backgroundColor: COLORS.indigo,
    borderRadius: 6,
    barThickness: 18
  }]
}))

const options = {
  indexAxis: 'y' as const,
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      callbacks: {
        title: (items: any[]) => items[0]?.label, // título completo en el tooltip
        label: tooltipLabel
      }
    }
  },
  scales: {
    x: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: '#f1f5f9' } },
    y: {
      grid: { display: false },
      ticks: {
        // Truncado solo visual; no altera los datos
        callback(this: any, value: any) {
          const l: string = this.getLabelForValue(value)
          return l.length > 26 ? l.slice(0, 25) + '…' : l
        }
      }
    }
  }
}
</script>

<template>
  <ChartCard title="Libros más prestados" description="Top 5 · histórico" :loading="loading" :empty="empty">
    <Bar :data="chartData" :options="options" role="img" aria-label="Los cinco libros más prestados" />
  </ChartCard>
</template>