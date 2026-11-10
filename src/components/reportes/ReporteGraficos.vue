<script setup lang="ts">
/**
 * Sección de gráficos de un reporte: carga progresiva (skeleton → gráfico),
 * un gráfico que falla muestra reintento y NO bloquea la tabla ni el PDF.
 * Las DONA van de a dos por fila; el resto a ancho completo.
 */
import SCard from '@/components/ui/SCard.vue'
import SSkeleton from '@/components/feedback/SSkeleton.vue'
import SChart from './SChart.vue'
import type { GraficoItem } from '@/composables/useReporteGraficos'

defineProps<{
  items: GraficoItem[]
  aviso?: string | null
  /** Filtros aplicados, p. ej. "Biblioteca: Central · Período: 01/01/2026 a 31/12/2026" */
  rotulo?: string
}>()
defineEmits<{ (e: 'reintentar', key: string): void }>()

const anchoCompleto = (it: GraficoItem) =>
  it.grafico ? it.grafico.tipoSugerido !== 'DONA' : !it.esDona
</script>

<template>
  <section v-if="items.length || aviso" class="mb-5" aria-labelledby="graficos-titulo">
    <div class="flex items-baseline justify-between gap-3 flex-wrap mb-3">
      <h2 id="graficos-titulo" class="text-sm font-semibold text-slate-800">Gráficos</h2>
      <p v-if="rotulo" class="text-xs text-slate-400">{{ rotulo }}</p>
    </div>

    <p
      v-if="aviso"
      class="mb-3 flex items-start gap-2 px-3 py-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600"
    >
      <i class="ti ti-info-circle shrink-0 mt-0.5" aria-hidden="true" />
      {{ aviso }}
    </p>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <SCard
        v-for="it in items"
        :key="it.key"
        variant="bordered"
        padding="lg"
        :class="anchoCompleto(it) ? 'md:col-span-2' : ''"
      >
        <template v-if="it.status === 'loading'">
          <SSkeleton width="40%" height="0.9rem" class="mb-3" />
          <SSkeleton width="100%" :height="anchoCompleto(it) ? '14rem' : '16rem'" class="rounded-xl" />
        </template>

        <div v-else-if="it.status === 'error'" class="py-8 text-center">
          <p class="text-sm font-medium text-slate-700 mb-1">{{ it.titulo }}</p>
          <p class="text-xs text-red-600 mb-3">No se pudo cargar este gráfico.</p>
          <button
            class="text-xs font-medium text-indigo-600 underline hover:text-indigo-800"
            @click="$emit('reintentar', it.key)"
          >
            Reintentar
          </button>
        </div>

        <SChart v-else-if="it.grafico" :grafico="it.grafico" />
      </SCard>
    </div>
  </section>
</template>