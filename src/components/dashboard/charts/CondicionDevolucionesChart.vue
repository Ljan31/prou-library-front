<script setup lang="ts">
import { computed } from 'vue'
import ChartCard from './ChartCard.vue'
import DoughnutChart from './DoughnutChart.vue'
import { COLORS } from './chartSetup'
import type { CondicionDevolucionDTO } from '@/types/dashboard.interface';
import { titleCase } from '@/utils/format';

const props = defineProps<{ items: CondicionDevolucionDTO[]; loading?: boolean }>()

const COLOR_MAP: Record<string, string> = { EXCELENTE: COLORS.emerald, BUENO: COLORS.sky, REGULAR: COLORS.amber, DETERIORADO: COLORS.orange, 'DAÑADO': COLORS.red }
const empty = computed(() => !props.items.some(i => i.cantidad > 0))
</script>

<template>
  <ChartCard title="Condición de ejemplares devueltos" description="Histórico" :loading="loading" :empty="empty">
    <DoughnutChart
      :labels="items.map(i => titleCase(i.condicion))"
      :values="items.map(i => i.cantidad)"
      :colors="items.map(i => COLOR_MAP[i.condicion] ?? COLORS.slate)"
      aria-label="Condición física de los ejemplares devueltos"
    />
  </ChartCard>
</template>