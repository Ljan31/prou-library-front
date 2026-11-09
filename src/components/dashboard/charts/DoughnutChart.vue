<script setup lang="ts">
import { computed } from 'vue'
import { Doughnut } from 'vue-chartjs'
import { tooltipLabel, FALLBACK_COLORS } from './chartSetup'

const props = defineProps<{
  labels: string[]
  values: number[]
  colors?: string[]
  ariaLabel?: string
}>()

const chartData = computed(() => ({
  labels: props.labels,
  datasets: [{
    data: props.values,
    backgroundColor: props.colors ?? FALLBACK_COLORS,
    borderColor: '#fff',
    borderWidth: 2
  }]
}))

const options = {
  responsive: true,
  maintainAspectRatio: false,
  cutout: '62%',
  plugins: {
    legend: { position: 'bottom' as const, labels: { usePointStyle: true, boxWidth: 8 } },
    tooltip: { callbacks: { label: tooltipLabel } }
  }
}
</script>

<template>
  <Doughnut :data="chartData" :options="options" role="img" :aria-label="ariaLabel" />
</template>