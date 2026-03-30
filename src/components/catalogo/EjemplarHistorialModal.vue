<script setup lang="ts">
import { ref, onMounted } from 'vue'
import api from '@/services/axios'
import SModal from '@/components/ui/SModal.vue'
import SButton from '@/components/ui/SButton.vue'
import SSpinner from '@/components/feedback/SSpinner.vue'
import SEmptyState from '@/components/feedback/SEmptyState.vue'
import { estadoEjemplarConfig } from '@/utils/catalogo'
import type { Ejemplar } from '@/types/catalogo'

interface HistorialItem {
  id: number
  estadoAnterior: string
  estadoNuevo: string
  motivo: string
  fecha: string
  usuario?: string
}

const props = defineProps<{ ejemplar: Ejemplar }>()
const emit = defineEmits<{ close: [] }>()

// ─── Estado ─────────────────────────────────────────
const historial = ref<HistorialItem[]>([])
const loading = ref(false)
const error = ref<string | null>(null)

// ─── API ────────────────────────────────────────────
async function cargarHistorial() {
  loading.value = true
  error.value = null

  try {
    const res = await api.get(`/ejemplares/${props.ejemplar.id_ejemplar}/historial`)

    // 🔥 importante: tu backend usa wrapper { success, data }
    // historial.value = res.data?.data ?? res.data ?? []
    historial.value = (res.data?.data ?? []).map((item: any) => ({
      id: item.id_historial,
      estadoAnterior: item.estadoAnterior,
      estadoNuevo: item.estadoNuevo,
      motivo: item.motivo,
      fecha: item.fechaCambio,
      usuario: item.usuarioCambio
    }))
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'Error al cargar historial'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  cargarHistorial()
})

// ─── Utils ──────────────────────────────────────────
function formatFecha(fecha: string): string {
  return new Date(fecha).toLocaleString('es-BO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}
</script>

<template>
  <SModal :model-value="true" :title="`Historial — ${ejemplar.codigo_ejemplar}`" size="md"
    @update:model-value="emit('close')">

    <!-- Loading -->
    <div v-if="loading" class="flex justify-center py-8">
      <SSpinner />
    </div>

    <!-- Error -->
    <p v-else-if="error" class="text-red-500 text-sm text-center py-6">
      {{ error }}
    </p>

    <!-- Empty -->
    <SEmptyState v-else-if="!historial.length" title="Sin historial"
      description="No hay registros de cambios de estado para este ejemplar." icon="book" />

    <!-- Data -->
    <div v-else class="space-y-1">
      <div v-for="(item, idx) in historial" :key="item.id" class="relative flex gap-3">

        <!-- Timeline -->
        <div class="flex flex-col items-center">
          <span :class="[
            'w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1',
            estadoEjemplarConfig[item.estadoNuevo]?.dot ?? 'bg-slate-300'
          ]"></span>
          <div v-if="idx < historial.length - 1" class="w-px flex-1 bg-slate-200 my-1"></div>
        </div>

        <!-- Contenido -->
        <div class="flex-1 pb-4">
          <div class="flex items-start justify-between">
            <div>
              <div class="flex items-center gap-1.5">
                <span class="text-xs text-slate-400">
                  {{ estadoEjemplarConfig[item.estadoAnterior]?.label ?? item.estadoAnterior }}
                </span>

                <svg class="w-3 h-3 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                </svg>

                <span :class="[
                  'text-xs font-medium',
                  item.estadoNuevo === 'DISPONIBLE' ? 'text-emerald-600' :
                    item.estadoNuevo === 'PRESTADO' ? 'text-red-600' :
                      ['BAJA', 'PERDIDO'].includes(item.estadoNuevo) ? 'text-slate-900' :
                        'text-amber-600'
                ]">
                  {{ estadoEjemplarConfig[item.estadoNuevo]?.label ?? item.estadoNuevo }}
                </span>
              </div>

              <p class="text-xs text-slate-600 mt-0.5">{{ item.motivo }}</p>
              <p v-if="item.usuario" class="text-xs text-slate-400 mt-0.5">
                por {{ item.usuario }}
              </p>
            </div>

            <time class="text-xs text-slate-400 flex-shrink-0 ml-2">
              {{ formatFecha(item.fecha) }}
            </time>
          </div>
        </div>

      </div>
    </div>

    <template #footer>
      <SButton variant="ghost" @click="emit('close')">Cerrar</SButton>
    </template>
  </SModal>
</template>