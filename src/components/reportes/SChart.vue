<script setup lang="ts">
/**
 * Componente ÚNICO de gráfico: dibuja cualquier GraficoDTO según `tipoSugerido`.
 * - sinDatos → estado vacío (no dibuja)
 * - colores por nombre, valores siempre visibles, tooltip con título completo
 * La configuración vive en chartConfig.ts (compartida con el PDF).
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Chart } from 'chart.js'
import SEmptyState from '@/components/feedback/SEmptyState.vue'
import type { GraficoDTO } from '@/services/reporte.service'
import { buildChartConfig, resumenAccesible } from './chartConfig'

const props = defineProps<{
  grafico: GraficoDTO
  /** Alto en px. Por defecto se calcula según el tipo. */
  height?: number
}>()

const canvasEl = ref<HTMLCanvasElement | null>(null)
let chart: Chart | null = null

const alto = computed(() => {
  if (props.height) return props.height
  const g = props.grafico
  if (g.tipoSugerido === 'DONA') return 320
  if (g.tipoSugerido === 'BARRAS_HORIZONTALES') return Math.max(260, g.etiquetas.length * 30 + 70)
  return 280
})

function dibujar() {
  chart?.destroy()
  chart = null
  if (props.grafico.sinDatos || !canvasEl.value) return
  chart = new Chart(canvasEl.value, buildChartConfig(props.grafico))
}

onMounted(dibujar)
watch(() => props.grafico, async () => { await nextTick(); dibujar() }, { deep: true })
onBeforeUnmount(() => chart?.destroy())
</script>

<template>
  <figure class="w-full m-0">
    <figcaption class="text-sm font-semibold text-slate-800 mb-3">{{ grafico.titulo }}</figcaption>

    <SEmptyState
      v-if="grafico.sinDatos"
      title="Sin datos para los filtros elegidos"
      icon="chart"
      size="sm"
    />

    <div v-else class="relative w-full" :style="{ height: alto + 'px' }">
      <canvas ref="canvasEl" role="img" :aria-label="resumenAccesible(grafico)" />
    </div>
  </figure>
</template>