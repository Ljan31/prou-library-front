<script setup lang="ts">
import { ref, onMounted } from 'vue'
import BaseModal from './BaseModal.vue'
import api from '@/services/axios'
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

const cargando = ref(false)
const historial = ref<HistorialItem[]>([])
const error = ref('')

onMounted(async () => {
  cargando.value = true
  try {
    const res = await api.get(`/ejemplares/${props.ejemplar.id_ejemplar}/historial`)
    // historial.value = Array.isArray(res.data.data)
    //   ? res.data.data
    //   : (res.data?.data?.content ?? [])
    historial.value = (res.data?.data ?? []).map((item: any) => ({
      id: item.id_historial,
      estadoAnterior: item.estadoAnterior,
      estadoNuevo: item.estadoNuevo,
      motivo: item.motivo,
      fecha: item.fechaCambio,
      usuario: item.usuarioCambio
    }))
  } catch {
    error.value = 'No se pudo cargar el historial'
  } finally {
    cargando.value = false
  }
})

function formatFecha(fecha: string): string {
  try {
    return new Date(fecha).toLocaleString('es-BO', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    })
  } catch {
    return fecha
  }
}
</script>

<template>
  <BaseModal :title="`Historial — ${ejemplar.codigo_ejemplar}`" size="md" @close="emit('close')">
    <!-- Cargando -->
    <div v-if="cargando" class="flex justify-center py-8">
      <svg class="w-6 h-6 animate-spin text-indigo-500" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
    </div>

    <!-- Error -->
    <p v-else-if="error" class="text-sm text-red-500 text-center py-6">{{ error }}</p>

    <!-- Vacío -->
    <div v-else-if="!historial.length" class="text-center py-8">
      <svg class="w-10 h-10 text-slate-200 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <p class="text-sm text-slate-500">Sin registros de cambios de estado</p>
    </div>

    <!-- Timeline -->
    <div v-else class="space-y-0">
      <div v-for="(item, idx) in historial" :key="item.id" class="relative flex gap-3">
        <!-- Línea y dot -->
        <div class="flex flex-col items-center">
          <span :class="['w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1.5 z-10',
            estadoEjemplarConfig[item.estadoNuevo as keyof typeof estadoEjemplarConfig]?.dot ?? 'bg-slate-300']" />
          <div v-if="idx < historial.length - 1" class="w-px flex-1 bg-slate-200 my-1" />
        </div>

        <!-- Contenido -->
        <div class="flex-1 pb-5">
          <div class="flex items-start justify-between gap-2">
            <div class="flex-1">
              <!-- Transición de estado -->
              <div class="flex items-center gap-1.5 flex-wrap">
                <span class="text-xs text-slate-400">
                  {{ estadoEjemplarConfig[item.estadoAnterior as keyof typeof estadoEjemplarConfig]?.label ??
                    item.estadoAnterior }}
                </span>
                <svg class="w-3 h-3 text-slate-300 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                </svg>
                <span :class="['text-xs font-semibold',
                  item.estadoNuevo === 'DISPONIBLE' ? 'text-emerald-600' :
                    item.estadoNuevo === 'PRESTADO' ? 'text-red-600' :
                      ['BAJA', 'PERDIDO'].includes(item.estadoNuevo) ? 'text-slate-700' :
                        'text-amber-600']">
                  {{ estadoEjemplarConfig[item.estadoNuevo as keyof typeof estadoEjemplarConfig]?.label ??
                    item.estadoNuevo }}
                </span>
              </div>

              <!-- Motivo -->
              <p class="text-xs text-slate-600 mt-0.5 leading-relaxed">{{ item.motivo }}</p>

              <!-- Usuario -->
              <p v-if="item.usuario" class="text-xs text-slate-400 mt-0.5">por {{ item.usuario }}</p>
            </div>

            <!-- Fecha -->
            <time class="text-xs text-slate-400 flex-shrink-0 text-right whitespace-nowrap">
              {{ formatFecha(item.fecha) }}
            </time>
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <button @click="emit('close')"
        class="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors">
        Cerrar
      </button>
    </template>
  </BaseModal>
</template>