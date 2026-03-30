<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import SModal from '@/components/ui/SModal.vue'
import SButton from '@/components/ui/SButton.vue'
import SSelect from '@/components/ui/SSelect.vue'
import SInput from '@/components/ui/SInput.vue'
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

// Estados disponibles según estado actual
const opcionesEstado = computed(() => {
  const actual = props.ejemplar.estadoEjemplar
  const todos = [
    { value: 'DISPONIBLE', label: '🟢 Disponible' },
    { value: 'EN_REPARACION', label: '🟡 En reparación' },
    { value: 'DAÑADO', label: '🟡 Dañado' },
  ]
  return todos.filter(o => o.value !== actual)
})

const accionLabel = computed(() => {
  if (form.esAccionEspecial === 'perdido') return 'Marcar como perdido'
  if (form.esAccionEspecial === 'baja') return 'Dar de baja'
  return 'Cambiar estado'
})

async function guardar() {
  if (!form.motivo.trim()) {
    error.value = 'El motivo es requerido'
    return
  }
  if (!form.esAccionEspecial && !form.nuevoEstado) {
    error.value = 'Selecciona un nuevo estado'
    return
  }

  guardando.value = true
  error.value = ''

  try {
    const id = props.ejemplar.id_ejemplar
    if (form.esAccionEspecial === 'perdido') {
      await api.put(`/ejemplares/${id}/perdido?motivo=${encodeURIComponent(form.motivo)}`)
    } else if (form.esAccionEspecial === 'baja') {
      await api.put(`/ejemplares/${id}/baja?motivo=${encodeURIComponent(form.motivo)}`)
    } else {
      await api.put(`/ejemplares/${id}/estado`, {
        nuevoEstado: form.nuevoEstado,
        motivo: form.motivo,
      })
    }
    emit('saved')
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'Error al cambiar estado'
  } finally {
    guardando.value = false
  }
}
</script>

<template>
  <SModal :model-value="true" title="Cambiar estado del ejemplar" size="sm" @update:model-value="emit('close')">
    <div class="space-y-4">
      <!-- Estado actual -->
      <div class="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
        <span :class="[
          'w-2.5 h-2.5 rounded-full flex-shrink-0',
          estadoEjemplarConfig[ejemplar.estadoEjemplar]?.dot ?? 'bg-slate-300'
        ]"></span>
        <div>
          <p class="text-xs text-slate-500">Estado actual</p>
          <p class="text-sm font-medium text-slate-900">
            {{ estadoEjemplarConfig[ejemplar.estadoEjemplar]?.label ?? ejemplar.estadoEjemplar }}
          </p>
        </div>
        <div class="ml-auto">
          <p class="text-xs text-slate-500">Código</p>
          <p class="text-sm font-mono font-medium text-slate-900">{{ ejemplar.codigo_ejemplar }}</p>
        </div>
      </div>

      <!-- Tipo de acción -->
      <div>
        <label class="block text-xs font-medium text-slate-600 mb-2">Tipo de cambio</label>
        <div class="grid grid-cols-1 gap-2">
          <!-- Cambio normal -->
          <label class="flex items-center gap-2.5 p-3 rounded-lg border cursor-pointer transition-colors"
            :class="form.esAccionEspecial === '' ? 'border-indigo-300 bg-indigo-50' : 'border-slate-200 hover:bg-slate-50'">
            <input type="radio" v-model="form.esAccionEspecial" value="" class="text-indigo-600" />
            <span class="text-sm text-slate-700">Cambio de estado normal</span>
          </label>

          <!-- Perdido -->
          <label class="flex items-center gap-2.5 p-3 rounded-lg border cursor-pointer transition-colors"
            :class="form.esAccionEspecial === 'perdido' ? 'border-amber-300 bg-amber-50' : 'border-slate-200 hover:bg-slate-50'">
            <input type="radio" v-model="form.esAccionEspecial" value="perdido" class="text-amber-600" />
            <span class="text-sm text-slate-700">Marcar como <strong>perdido</strong></span>
          </label>

          <!-- Baja -->
          <label class="flex items-center gap-2.5 p-3 rounded-lg border cursor-pointer transition-colors"
            :class="form.esAccionEspecial === 'baja' ? 'border-red-300 bg-red-50' : 'border-slate-200 hover:bg-slate-50'">
            <input type="radio" v-model="form.esAccionEspecial" value="baja" class="text-red-600" />
            <span class="text-sm text-slate-700">Dar de <strong>baja</strong> (irreversible)</span>
          </label>
        </div>
      </div>

      <!-- Nuevo estado (solo si cambio normal) -->
      <SSelect v-if="form.esAccionEspecial === ''" v-model="form.nuevoEstado" label="Nuevo estado *"
        :options="opcionesEstado" />

      <!-- Advertencia acciones terminales -->
      <div v-if="form.esAccionEspecial"
        class="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl">
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
        <label class="block text-xs font-medium text-slate-600 mb-1.5">Motivo *</label>
        <textarea v-model="form.motivo" rows="3" placeholder="Describe el motivo del cambio de estado..."
          class="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none" />
      </div>

      <p v-if="error" class="text-sm text-red-500">{{ error }}</p>
    </div>

    <template #footer>
      <SButton variant="ghost" @click="emit('close')">Cancelar</SButton>
      <SButton :variant="form.esAccionEspecial ? 'danger' : 'primary'" :loading="guardando" @click="guardar">
        {{ accionLabel }}
      </SButton>
    </template>
  </SModal>
</template>