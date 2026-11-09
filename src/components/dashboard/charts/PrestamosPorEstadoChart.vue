<script setup lang="ts">
import { computed } from 'vue'
import ChartCard from './ChartCard.vue'
import DoughnutChart from './DoughnutChart.vue'
import { COLORS } from './chartSetup'
import type { PrestamoEstadoDTO } from '@/types/dashboard.interface';
import { titleCase } from '@/utils/format';

const props = defineProps<{ items: PrestamoEstadoDTO[]; loading?: boolean }>()

const COLOR_MAP: Record<string, string> = { ACTIVO: COLORS.indigo, RENOVADO: COLORS.sky, DEVUELTO: COLORS.emerald, VENCIDO: COLORS.red }
const empty = computed(() => !props.items.some(i => i.cantidad > 0))
</script>

<template>
  <ChartCard title="Préstamos por estado" description="Histórico" :loading="loading" :empty="empty">
    <DoughnutChart
      :labels="items.map(i => titleCase(i.estado))"
      :values="items.map(i => i.cantidad)"
      :colors="items.map(i => COLOR_MAP[i.estado] ?? COLORS.slate)"
      aria-label="Distribución de préstamos por estado"
    />
  </ChartCard>
</template>