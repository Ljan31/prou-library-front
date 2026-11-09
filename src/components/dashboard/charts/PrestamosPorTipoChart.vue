<script setup lang="ts">
import { computed } from 'vue'
import ChartCard from './ChartCard.vue'
import DoughnutChart from './DoughnutChart.vue'
import { COLORS } from './chartSetup'
import type { PrestamoPorTipoDTO } from '@/types/dashboard.interface';
import { titleCase } from '@/utils/format';

const props = defineProps<{ items: PrestamoPorTipoDTO[]; loading?: boolean }>()

const COLOR_MAP: Record<string, string> = { SALA: COLORS.amber, DOMICILIO: COLORS.indigo }
const empty = computed(() => !props.items.some(i => i.cantidad > 0))
</script>

<template>
  <ChartCard title="Préstamos por modalidad" description="Sala vs. domicilio · histórico" :loading="loading" :empty="empty">
    <DoughnutChart
      :labels="items.map(i => titleCase(i.tipo))"
      :values="items.map(i => i.cantidad)"
      :colors="items.map(i => COLOR_MAP[i.tipo] ?? COLORS.slate)"
      aria-label="Distribución de préstamos por modalidad"
    />
  </ChartCard>
</template>