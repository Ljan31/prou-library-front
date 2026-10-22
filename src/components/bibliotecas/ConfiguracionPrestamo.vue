<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import {
  configuracionPrestamoService,
  type ConfiguracionPrestamo,
  type ConfiguracionPrestamoPayload
} from '@/services/configuracion-prestamo.service'
import { useUiStore } from '@/stores/ui.store'
import { useAuthStore } from '@/stores/auth.store'

const props = defineProps<{
  bibliotecaId: number
  nombreBib: string
}>()

const uiStore = useUiStore()
const auth = useAuthStore()

// ─── State ────────────────────────────────────────────────────────────────
const config = ref<ConfiguracionPrestamo | null>(null)
const loading = ref(false)
const saving = ref(false)
const isEditing = ref(false)
const fetchError = ref<string | null>(null)

// ─── Form ─────────────────────────────────────────────────────────────────
const form = ref<ConfiguracionPrestamoPayload>({
  bibliotecaId: 0,
  diasPrestamoMax: 0,
  renovacionesMax: 0,
  ejemplaresMaxDomicilio: 0,
  multaPorDia: 0,
  multaMaxDias: 0,
  diasSuspension: 0,
  diasReserva: 0,
  ejemplaresMaxSala: 0
})
const errors = ref<Record<string, string>>({})

const hasConfig = computed(() => !!config.value)
const canEdit = computed(() => auth.isAdmin || auth.isBibliotecario)
// const canEdit = computed(() => auth.isBibliotecario && !auth.isAdmin)

// ─── Load on open ────────────────────────────────────────────────────────
watch(
  () => props.bibliotecaId,
  async (bibliotecaId) => {
    if (bibliotecaId == null || bibliotecaId <= 0) return
    isEditing.value = false
    fetchError.value = null
    errors.value = {}
    config.value = null
    resetForm()
    await fetchConfig()
  },
  { immediate: true }
)

async function fetchConfig() {
  loading.value = true
  try {
    const data = await configuracionPrestamoService.getByBiblioteca(props.bibliotecaId)
    config.value = data
    populateForm(data)
  } catch (e: unknown) {
    const status = (e as any)?.response?.status
    if (status === 404) {
      config.value = null
      resetForm()
    } else {
      fetchError.value = e instanceof Error ? e.message : 'Error al cargar configuración'
    }
  } finally {
    loading.value = false
  }
}

function populateForm(data: ConfiguracionPrestamo) {
  form.value = {
    bibliotecaId: props.bibliotecaId,
    diasPrestamoMax: data.diasPrestamoMax,
    renovacionesMax: data.renovacionesMax,
    ejemplaresMaxDomicilio: data.ejemplaresMaxDomicilio,
    multaPorDia: data.multaPorDia,
    multaMaxDias: data.multaMaxDias,
    diasSuspension: data.diasSuspension,
    diasReserva: data.diasReserva,
    ejemplaresMaxSala: data.ejemplaresMaxSala
  }
}

function resetForm() {
  form.value = {
    bibliotecaId: props.bibliotecaId,
    diasPrestamoMax: 0,
    renovacionesMax: 0,
    ejemplaresMaxDomicilio: 0,
    multaPorDia: 0,
    multaMaxDias: 0,
    diasSuspension: 0,
    diasReserva: 0,
    ejemplaresMaxSala: 0
  }
}

// ─── Validation ───────────────────────────────────────────────────────────
function validate(): boolean {
  errors.value = {}
  if (!form.value.diasPrestamoMax || form.value.diasPrestamoMax < 1)
    errors.value.diasPrestamoMax = 'Mínimo 1 día'
  if (form.value.renovacionesMax === null || form.value.renovacionesMax < 0)
    errors.value.renovacionesMax = 'Mínimo 0'
  return Object.keys(errors.value).length === 0
}

// ─── Actions ─────────────────────────────────────────────────────────────
function startEdit() {
  if (config.value) populateForm(config.value)
  else resetForm()
  errors.value = {}
  isEditing.value = true
}

function cancelEdit() {
  isEditing.value = false
  errors.value = {}
}

async function save() {
  if (!validate()) return
  saving.value = true
  try {
    const payload: ConfiguracionPrestamoPayload = {
      ...form.value,
      bibliotecaId: props.bibliotecaId
    }
    let saved: ConfiguracionPrestamo
    if (hasConfig.value && config.value) {
      saved = await configuracionPrestamoService.update(config.value.idConfig, payload)
      uiStore.toast.success('Configuración actualizada', `${props.nombreBib}`)
    } else {
      saved = await configuracionPrestamoService.create(payload)
      uiStore.toast.success('Configuración creada', `${props.nombreBib}`)
    }
    config.value = saved
    isEditing.value = false
  } catch (e: unknown) {
    const data = (e as any)?.response?.data
    if (data?.errors) {
      errors.value = data.errors
    } else if (data?.message) {
      uiStore.toast.error('Error', data.message)
    } else {
      uiStore.toast.error('Error', e instanceof Error ? e.message : 'Error al guardar')
    }
  } finally {
    saving.value = false
  }
}

function fmt(val: number | null | undefined, suffix = ''): string {
  if (val === null || val === undefined) return '—'
  return `${val}${suffix}`
}
</script>

<template>
  <div class="mx-auto max-w-6xl overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
    <!-- Header -->
    <div class="flex items-center justify-between px-6 py-5 border-b border-gray-100 bg-gradient-to-r from-slate-50 to-white">
      <div class="flex items-center gap-3">
        <div class="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600 flex-shrink-0">
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>
        <div>
          <h2 class="text-base font-semibold text-gray-800 leading-tight">Configuración de Préstamos</h2>
          <p class="text-xs text-gray-500 mt-0.5 truncate max-w-xs">{{ nombreBib }}</p>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <span v-if="!loading && !fetchError" :class="['text-xs font-medium px-2.5 py-1 rounded-full', hasConfig ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700']">
          {{ hasConfig ? 'Configurada' : 'Sin configurar' }}
        </span>
      </div>
    </div>

    <!-- Body Content -->
    <div class="flex-1 overflow-y-auto">
      <!-- Loading State -->
      <div v-if="loading" class="p-8 flex flex-col items-center gap-3 text-gray-400">
        <svg class="w-8 h-8 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <span class="text-sm">Cargando configuración…</span>
      </div>

      <!-- Error State -->
      <div v-else-if="fetchError" class="p-8 text-center">
        <svg class="w-10 h-10 text-red-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p class="text-sm text-red-600 font-medium">{{ fetchError }}</p>
        <button @click="fetchConfig" class="mt-3 text-xs text-red-500 underline">Reintentar</button>
      </div>

      <!-- ── MODO VISTA (View Mode) ── -->
      <div v-else-if="!isEditing" class="px-6 py-5 space-y-5">
        <div v-if="!hasConfig" class="bg-amber-50 border border-amber-200 rounded-xl p-5 flex items-start gap-3">
          <svg class="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p class="text-sm font-medium text-amber-800">Sin configuración</p>
            <p class="text-xs text-amber-600 mt-0.5">
              Esta biblioteca aún no tiene reglas de préstamo definidas.
              {{ canEdit ? 'Crea una configuración para habilitarla.' : '' }}
            </p>
          </div>
        </div>

        <!-- Domicilio Info -->
        <section>
          <div class="flex items-center gap-2 mb-3">
            <div class="w-6 h-6 rounded-lg bg-blue-100 flex items-center justify-center">
              <svg class="w-3.5 h-3.5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
            </div>
            <h3 class="text-sm font-semibold text-gray-700">Préstamo a domicilio</h3>
          </div>
          <div class="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div v-for="stat in [
              { label: 'Días máximos', value: fmt(config?.diasPrestamoMax, ' días') },
              { label: 'Renovaciones máx.', value: fmt(config?.renovacionesMax) },
              { label: 'Ejemplares máx.', value: fmt(config?.ejemplaresMaxDomicilio) },
              { label: 'Días suspensión', value: fmt(config?.diasSuspension, ' días') },
              // { label: 'Días máx. multa', value: fmt(config?.multaMaxDias, ' días') },
                { label: 'Días suspensión', value: fmt(config?.diasSuspension, ' días') },
                { label: 'Días de reserva', value: fmt(config?.diasReserva, ' días') },
              ]" :key="stat.label" class="bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
                <p class="text-xs text-gray-400 mb-1">{{ stat.label }}</p>
                <p class="text-sm font-bold text-gray-800">{{ stat.value }}</p>
              </div>
          </div>
        </section>
           <!-- SALA section -->
        <section>
          <div class="flex items-center gap-2 mb-3">
            <div class="w-6 h-6 rounded-lg bg-violet-100 flex items-center justify-center">
              <svg class="w-3.5 h-3.5 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <h3 class="text-sm font-semibold text-gray-700">Préstamo en sala</h3>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div class="bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
              <p class="text-xs text-gray-400 mb-1">Ejemplares máx. sala</p>
              <p class="text-sm font-bold text-gray-800">{{ fmt(config?.ejemplaresMaxSala) }}</p>
            </div>
            <div class="bg-violet-50 rounded-xl px-4 py-3 border border-violet-100 flex items-center gap-2">
              <svg class="w-4 h-4 text-violet-400 flex-shrink-0" fill="none" viewBox="0 0 24 24"
                stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p class="text-xs text-violet-600">Sin límite de tiempo · Sin multa · Sin renovaciones</p>
            </div>
          </div>
        </section>
      </div>

      <!-- ── EDIT MODE ─────────────────────────────────────────── -->
      <div v-else class="px-6 py-5 space-y-5">

        <!-- DOMICILIO fields -->
        <section>
          <div class="flex items-center gap-2 mb-4">
            <div class="w-6 h-6 rounded-lg bg-blue-100 flex items-center justify-center">
              <svg class="w-3.5 h-3.5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
            </div>
            <h3 class="text-sm font-semibold text-gray-700">Préstamo a domicilio</h3>
          </div>

          <div class="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <!-- diasPrestamoMax -->
            <div>
              <label class="block text-xs font-medium text-gray-600 mb-1">
                Días máximos <span class="text-red-500">*</span>
              </label>
              <div class="relative">
                <input v-model.number="form.diasPrestamoMax" type="number" min="1"
                  class="w-full px-3 py-2 pr-10 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  :class="errors.diasPrestamoMax ? 'border-red-400 bg-red-50' : 'border-gray-300'" />
                <span class="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">días</span>
              </div>
              <p v-if="errors.diasPrestamoMax" class="mt-1 text-xs text-red-500">{{ errors.diasPrestamoMax }}</p>
            </div>

            <!-- renovacionesMax -->
            <div>
              <label class="block text-xs font-medium text-gray-600 mb-1">
                Renovaciones máx. <span class="text-red-500">*</span>
              </label>
              <input v-model.number="form.renovacionesMax" type="number" min="0"
                class="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                :class="errors.renovacionesMax ? 'border-red-400 bg-red-50' : 'border-gray-300'" />
              <p v-if="errors.renovacionesMax" class="mt-1 text-xs text-red-500">{{ errors.renovacionesMax }}</p>
            </div>

            <!-- ejemplaresMaxDomicilio -->
            <div>
              <label class="block text-xs font-medium text-gray-600 mb-1">Ejemplares máx.</label>
              <input v-model.number="form.ejemplaresMaxDomicilio" type="number" min="1"
                class="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
            </div>

            <!-- multaPorDia -->
            <!-- <div>
              <label class="block text-xs font-medium text-gray-600 mb-1">Multa por día (Bs)</label>
              <input v-model.number="form.multaPorDia" type="number" min="0" step="0.50"
                class="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                :class="errors.multaPorDia ? 'border-red-400 bg-red-50' : 'border-gray-300'" />
              <p v-if="errors.multaPorDia" class="mt-1 text-xs text-red-500">{{ errors.multaPorDia }}</p>
            </div> -->

            <!-- multaMaxDias -->
            <!-- <div>
              <label class="block text-xs font-medium text-gray-600 mb-1">Días máx. multa</label>
              <div class="relative">
                <input v-model.number="form.multaMaxDias" type="number" min="1"
                  class="w-full px-3 py-2 pr-10 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                <span class="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">días</span>
              </div>
            </div> -->

            <!-- diasSuspension -->
            <div>
              <label class="block text-xs font-medium text-gray-600 mb-1">Días de suspensión</label>
              <div class="relative">
                <input v-model.number="form.diasSuspension" type="number" min="1"
                  class="w-full px-3 py-2 pr-10 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                <span class="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">días</span>
              </div>
            </div>

            <!-- diasReserva -->
            <div>
              <label class="block text-xs font-medium text-gray-600 mb-1">Días de reserva</label>
              <div class="relative">
                <input v-model.number="form.diasReserva" type="number" min="1"
                  class="w-full px-3 py-2 pr-10 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                <span class="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">días</span>
              </div>
            </div>
          </div>
        </section>

        <!-- Divider -->
        <div class="border-t border-gray-100" />

        <!-- SALA fields -->
        <section>
          <div class="flex items-center gap-2 mb-4">
            <div class="w-6 h-6 rounded-lg bg-violet-100 flex items-center justify-center">
              <svg class="w-3.5 h-3.5 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <h3 class="text-sm font-semibold text-gray-700">Préstamo en sala</h3>
            <span class="text-xs text-gray-400">· sin límite de tiempo ni multas</span>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-medium text-gray-600 mb-1">Ejemplares máx. en sala</label>
              <input v-model.number="form.ejemplaresMaxSala" type="number" min="1"
                class="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400" />
            </div>
          </div>
        </section>
      </div>
    </div>


   <!-- ── Footer ────────────────────────────────────────────────── -->
    <div class="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50/60">

      <!-- Left: mode indicator -->
      <div class="text-xs text-gray-400">
        <span v-if="isEditing" class="flex items-center gap-1 text-amber-600">
          <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
          Modo edición
        </span>
        <span v-else-if="hasConfig">ID config: {{ config?.idConfig }}</span>
      </div>

        <!-- Right: actions -->
      <div class="flex items-center gap-3">
          <template v-if="!isEditing">
            <button v-if="canEdit" @click="startEdit"
              class="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-amber-500 rounded-lg hover:bg-amber-600 transition-colors">
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              {{ hasConfig ? 'Editar' : 'Configurar' }}
            </button>
          </template>

          <template v-else>
            <button @click="cancelEdit"
              class="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
              Cancelar
            </button>
            <button @click="save" :disabled="saving"
              class="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-amber-500 rounded-lg hover:bg-amber-600 disabled:opacity-60 transition-colors">
              <svg v-if="saving" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              {{ saving ? 'Guardando…' : (hasConfig ? 'Guardar cambios' : 'Crear configuración') }}
            </button>
          </template>
      </div>
    </div>

  </div>
</template>

<style scoped>
.slide-form-enter-active,
.slide-form-leave-active {
  transition: all 0.2s ease;
}
.slide-form-enter-from,
.slide-form-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}
</style>