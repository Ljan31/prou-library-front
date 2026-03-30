<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import BaseModal from './BaseModal.vue'
import api from '@/services/axios'
import { estadoEjemplarConfig } from '@/utils/catalogo'
import type { Ejemplar } from '@/types/catalogo'

const props = defineProps<{ ejemplar: Ejemplar }>()
const emit = defineEmits<{ close: []; saved: [] }>()

const guardando = ref(false)
const error = ref('')

const form = reactive({
  nuevoEstado: '',
  motivo: '',
  esAccionEspecial: '' as '' | 'perdido' | 'baja',
})

// Estados destino disponibles (excluye el actual)
const opcionesEstado = computed(() => {
  const actual = props.ejemplar.estadoEjemplar
  return [
    { value: 'DISPONIBLE', label: '🟢 Disponible' },
    { value: 'EN_REPARACION', label: '🟡 En reparación' },
    { value: 'DAÑADO', label: '🟡 Dañado' },
  ].filter(o => o.value !== actual)
})

const accionLabel = computed(() => {
  if (form.esAccionEspecial === 'perdido') return 'Marcar como perdido'
  if (form.esAccionEspecial === 'baja') return 'Dar de baja'
  return 'Cambiar estado'
})

const esPeligroso = computed(() => form.esAccionEspecial !== '')

async function guardar() {
  error.value = ''

  if (!form.motivo.trim()) {
    error.value = 'El motivo es requerido'
    return
  }
  if (form.esAccionEspecial === '' && !form.nuevoEstado) {
    error.value = 'Selecciona un nuevo estado'
    return
  }

  guardando.value = true
  try {
    const id = props.ejemplar.id_ejemplar
    if (form.esAccionEspecial === 'perdido') {
      await api.put(`/ejemplares/${id}/perdido`, null, {
        params: { motivo: form.motivo }
      })
    } else if (form.esAccionEspecial === 'baja') {
      await api.put(`/ejemplares/${id}/baja`, null, {
        params: { motivo: form.motivo }
      })
    } else {
      await api.put(`/ejemplares/${id}/estado`, {
        nuevoEstado: form.nuevoEstado,
        motivo: form.motivo,
      })
    }
    emit('saved')
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'Error al cambiar el estado'
  } finally {
    guardando.value = false
  }
}
</script>

<template>
  <BaseModal title="Cambiar estado del ejemplar" size="sm" @close="emit('close')">
    <div class="space-y-4">
      <!-- Estado actual -->
      <div class="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
        <span :class="['w-2.5 h-2.5 rounded-full flex-shrink-0',
          estadoEjemplarConfig[ejemplar.estadoEjemplar]?.dot ?? 'bg-slate-300']" />
        <div class="flex-1">
          <p class="text-xs text-slate-500">Estado actual</p>
          <p class="text-sm font-medium text-slate-900">
            {{ estadoEjemplarConfig[ejemplar.estadoEjemplar]?.label ?? ejemplar.estadoEjemplar }}
          </p>
        </div>
        <div class="text-right">
          <p class="text-xs text-slate-500">Código</p>
          <p class="text-sm font-mono font-medium text-slate-900">{{ ejemplar.codigo_ejemplar }}</p>
        </div>
      </div>

      <!-- Tipo de acción -->
      <div class="space-y-2">
        <p class="text-xs font-medium text-slate-600">Tipo de cambio</p>

        <label class="flex items-center gap-2.5 p-3 rounded-lg border cursor-pointer transition-colors"
          :class="form.esAccionEspecial === '' ? 'border-indigo-300 bg-indigo-50' : 'border-slate-200 hover:bg-slate-50'">
          <input type="radio" v-model="form.esAccionEspecial" value="" class="text-indigo-600 accent-indigo-600" />
          <span class="text-sm text-slate-700">Cambio de estado normal</span>
        </label>

        <label class="flex items-center gap-2.5 p-3 rounded-lg border cursor-pointer transition-colors"
          :class="form.esAccionEspecial === 'perdido' ? 'border-amber-300 bg-amber-50' : 'border-slate-200 hover:bg-slate-50'">
          <input type="radio" v-model="form.esAccionEspecial" value="perdido" class="accent-amber-500" />
          <span class="text-sm text-slate-700">Marcar como <strong>perdido</strong></span>
        </label>

        <label class="flex items-center gap-2.5 p-3 rounded-lg border cursor-pointer transition-colors"
          :class="form.esAccionEspecial === 'baja' ? 'border-red-300 bg-red-50' : 'border-slate-200 hover:bg-slate-50'">
          <input type="radio" v-model="form.esAccionEspecial" value="baja" class="accent-red-500" />
          <span class="text-sm text-slate-700">Dar de <strong>baja</strong> <span
              class="text-slate-400">(irreversible)</span></span>
        </label>
      </div>

      <!-- Selector de nuevo estado (solo cambio normal) -->
      <div v-if="form.esAccionEspecial === ''">
        <label class="block text-xs font-medium text-slate-600 mb-1">Nuevo estado *</label>
        <select v-model="form.nuevoEstado"
          class="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white">
          <option value="" disabled>Seleccionar estado</option>
          <option v-for="op in opcionesEstado" :key="op.value" :value="op.value">{{ op.label }}</option>
        </select>
      </div>

      <!-- Advertencia acción terminal -->
      <div v-if="esPeligroso" class="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl">
        <svg class="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.962-.833-2.732 0L3.07 16.5c-.77.833.193 2.5 1.732 2.5z" />
        </svg>
        <p class="text-xs text-amber-700">
          Esta acción <strong>no se puede revertir</strong>. El ejemplar quedará marcado permanentemente.
        </p>
      </div>

      <!-- Motivo -->
      <div>
        <label class="block text-xs font-medium text-slate-600 mb-1">Motivo *</label>
        <textarea v-model="form.motivo" rows="3" placeholder="Describe el motivo del cambio de estado..."
          class="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
      </div>

      <p v-if="error" class="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{{ error }}</p>
    </div>

    <template #footer>
      <button @click="emit('close')"
        class="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors">
        Cancelar
      </button>
      <button @click="guardar" :disabled="guardando" :class="[
        'px-5 py-2 text-sm font-medium text-white rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2',
        esPeligroso ? 'bg-red-600 hover:bg-red-700' : 'bg-indigo-600 hover:bg-indigo-700'
      ]">
        <svg v-if="guardando" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        {{ accionLabel }}
      </button>
    </template>
  </BaseModal>
</template>