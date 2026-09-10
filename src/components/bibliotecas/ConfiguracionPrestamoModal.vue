<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import {
  configuracionPrestamoService,
  type ConfiguracionPrestamo,
  type ConfiguracionPrestamoPayload
} from '@/services/configuracion-prestamo.service'
import {
  razonCertificadoService,
  type RazonCertificado,
  type RazonCertificadoPayload,
  REQUISITO_LABELS,
  REQUISITOS_DISPONIBLES,
  mapRazon
} from '@/services/razon-certificado.service'
import { useUiStore } from '@/stores/ui.store'
import { useAuthStore } from '@/stores/auth.store'

// ─── Props / Emits ────────────────────────────────────────────────────────
const props = defineProps<{
  modelValue: boolean
  bibliotecaId: number
  nombreBib: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void
}>()

const uiStore = useUiStore()
const auth = useAuthStore()
// ─── Tabs ─────────────────────────────────────────────────────────────────
type Tab = 'configuracion' | 'razones'
const activeTab = ref<Tab>('configuracion')
 
// ═══════════════════════════════════════════════════════════════════
//  TAB 1 — CONFIGURACIÓN DE PRÉSTAMOS  (código original sin cambios)
// ═══════════════════════════════════════════════════════════════════
 

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

const isReadOnly = computed(() => !auth.isAdmin && auth.isBibliotecario && !isEditing.value)
const hasConfig = computed(() => !!config.value)
const canEdit = computed(() => auth.isAdmin || auth.isBibliotecario)

// ─── Load on open ────────────────────────────────────────────────────────
watch(
  () => [props.modelValue, props.bibliotecaId],
  async ([open, bibliotecaId]) => {
    if (!open || bibliotecaId == null) return
    // RESET COMPLETO
    activeTab.value = 'configuracion'
    isEditing.value = false
    fetchError.value = null
    errors.value = {}
    config.value = null
    resetForm()
    await fetchConfig()
    await fetchRazones()
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
    // 404 = no config yet, that's OK
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
  if (form.value.multaPorDia !== null && form.value.multaPorDia! < 0)
    errors.value.multaPorDia = 'No puede ser negativo'
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
    // Handle field-level validation errors from backend (400)
    const data = (e as any)?.response?.data
    if (data?.errors) {
      errors.value = data.errors
    } else if (data?.message) {
      uiStore.toast.error('Error', data.message)
    } else {
      uiStore.toast.error(
        'Error',
        e instanceof Error ? e.message : 'Error al guardar'
      )
    }
  } finally {
    saving.value = false
  }
}

function close() {
  emit('update:modelValue', false)
}

// ─── Display helpers ──────────────────────────────────────────────────────
function fmt(val: number | null | undefined, suffix = ''): string {
  if (val === null || val === undefined) return '—'
  return `${val}${suffix}`
}

function fmtCurrency(val: number | null | undefined): string {
  if (val === null || val === undefined) return '—'
  return `Bs ${Number(val).toFixed(2)}`
}

// ═══════════════════════════════════════════════════════════════════
//  TAB 2 — RAZONES DE CERTIFICADO
// ═══════════════════════════════════════════════════════════════════
 
const razones = ref<RazonCertificado[]>([])
const razonesLoading = ref(false)
const razonesError = ref<string | null>(null)
 
// Form state
const showRazonForm = ref(false)
const editingRazon = ref<RazonCertificado | null>(null)
const savingRazon = ref(false)
const deletingId = ref<number | null>(null)
const confirmDeleteId = ref<number | null>(null)
 
const razonForm = ref<RazonCertificadoPayload>({
  bibliotecaId: null,
  nombre: '',
  descripcion: '',
  requisitos: [],
  activo: true
})
const razonErrors = ref<Record<string, string>>({})
 
const isEditingRazon = computed(() => !!editingRazon.value)
const isGlobal = computed(() => razonForm.value.bibliotecaId === null)
 
async function fetchRazones() {
  razonesLoading.value = true
  razonesError.value = null
  try {
    const [byBib, all] = await Promise.all([
      razonCertificadoService.getByBiblioteca(props.bibliotecaId).catch(() => []),
      razonCertificadoService.getAll().catch(() => [])
    ])
    // Merge: specific first, then globals (bibliotecaId === null) not already in list
    const ids = new Set(byBib.map(r => r.idRazon))
    const globals = (all as RazonCertificado[]).filter(r => r.bibliotecaId === null && !ids.has(r.idRazon))
    razones.value = [ 
      ...byBib.map(mapRazon),
      ...globals.map(mapRazon)
    ]
  } catch (e: unknown) {
    razonesError.value = e instanceof Error ? e.message : 'Error al cargar razones'
  } finally {
    razonesLoading.value = false
  }
}

function openCreateRazon() {
  editingRazon.value = null
  razonForm.value = {
    bibliotecaId: props.bibliotecaId,
    nombre: '',
    descripcion: '',
    requisitos: [],
    activo: true
  }
  razonErrors.value = {}
  showRazonForm.value = true
}
 
function openEditRazon(razon: RazonCertificado) {
  editingRazon.value = razon
  // razonForm.value = {
  //   bibliotecaId: razon.bibliotecaId,
  //   nombre: razon.nombre,
  //   descripcion: razon.descripcion,
  //   requisitos: [...razon.requisitos],
  //   activo: razon.activo
  // }
  razonForm.value = mapRazon(razon)
  razonErrors.value = {}
  showRazonForm.value = true
}

function cancelRazonForm() {
  showRazonForm.value = false
  editingRazon.value = null
  razonErrors.value = {}
}
 
function validateRazon(): boolean {
  razonErrors.value = {}
  if (!razonForm.value.nombre.trim()) razonErrors.value.nombre = 'El nombre es requerido'
  return Object.keys(razonErrors.value).length === 0
}
 
// function toggleRequisito(req: string) {
//   const idx = razonForm.value.requisitos.indexOf(req)
//   if (idx >= 0) razonForm.value.requisitos.splice(idx, 1)
//   else razonForm.value.requisitos.push(req)
// }

async function saveRazon() {
  if (!validateRazon()) return
  savingRazon.value = true
  try {
    if (isEditingRazon.value && editingRazon.value) {
      const updated = mapRazon(await razonCertificadoService.update(editingRazon.value.idRazon, razonForm.value))
      const idx = razones.value.findIndex(r => r.idRazon === editingRazon.value!.idRazon)
      if (idx !== -1) razones.value[idx] = updated
      uiStore.toast.success('Razón actualizada', updated.nombre)
    } else {
      const created = mapRazon(await razonCertificadoService.create(razonForm.value))
      razones.value.unshift(created)
      uiStore.toast.success('Razón creada', created.nombre)
    }
    cancelRazonForm()
  } catch (e: unknown) {
    const data = (e as any)?.response?.data
    if (data?.message) uiStore.toast.error('Error', data.message)
    else uiStore.toast.error('Error', e instanceof Error ? e.message : 'Error al guardar')
  } finally {
    savingRazon.value = false
  }
}
 
async function deleteRazon(id: number) {
  deletingId.value = id
  try {
    await razonCertificadoService.delete(id)
    razones.value = razones.value.filter(r => r.idRazon !== id)
    confirmDeleteId.value = null
    uiStore.toast.success('Razón eliminada', '')
  } catch (e: unknown) {
    uiStore.toast.error('Error', e instanceof Error ? e.message : 'No se pudo eliminar')
  } finally {
    deletingId.value = null
  }
}
 
function requisitoLabel(key: string): string {
  return REQUISITO_LABELS[key] ?? key
}

// Nueva variable
const nuevoRequisito = ref('')

// Métodos
function agregarRequisitoPersonalizado() {
  const valor = nuevoRequisito.value.trim()
  if (!valor) return

  // Evitar duplicados
  if (!razonForm.value.requisitos.includes(valor)) {
    razonForm.value.requisitos.push(valor)
  }

  nuevoRequisito.value = '' // Limpiar input
}

function eliminarRequisito(index: number) {
  razonForm.value.requisitos.splice(index, 1)
}

// (Opcional) Mejorar toggleRequisito para que también elimine si ya existe
function toggleRequisito(req: string) {
  const current = razonForm.value.requisitos
  if (current.includes(req)) {
    razonForm.value.requisitos = current.filter(r => r !== req)
  } else {
    razonForm.value.requisitos.push(req)
  }
}
// function toggleRequisito(req: string) {
//   const current = razonForm.value.requisitos
//   razonForm.value.requisitos = current.includes(req)
//     ? current.filter(r => r !== req)
//     : [...current, req]
// }
</script>

<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div v-if="modelValue" class="fixed inset-0 z-50 flex items-center justify-center p-4" @click.self="close">
        <!-- Backdrop -->
        <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" @click="close" />

        <!-- Panel -->
        <div
          class="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">

          <!-- ── Header ────────────────────────────────────────────────── -->
          <div
            class="flex items-center justify-between px-6 py-5 border-b border-gray-100 bg-gradient-to-r from-slate-50 to-white">
            <div class="flex items-center gap-3">
              <div
                class="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600 flex-shrink-0">
                <!-- gear icon -->
                <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div>
                <h2 class="text-base font-semibold text-gray-800 leading-tight">Configuración de Préstamos</h2>
                <p class="text-xs text-gray-500 mt-0.5 truncate max-w-xs">{{ nombreBib }}</p>
              </div>
            </div>

            <div class="flex items-center gap-2">
              <!-- Status badge -->
              <span v-if="!loading && !fetchError" :class="['text-xs font-medium px-2.5 py-1 rounded-full', hasConfig
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-amber-100 text-amber-700']">
                {{ hasConfig ? 'Configurada' : 'Sin configurar' }}
              </span>
              <button @click="close"
                class="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
                <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
          <!-- ── Tabs ───────────────────────────────────────────────── -->
          <div class="flex border-b border-gray-100 px-6 bg-white">
            <button
              v-for="tab in [
                { key: 'configuracion', label: 'Préstamos', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z' },
                { key: 'razones', label: 'Razones de Certificado', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' }
              ]"
              :key="tab.key"
              @click="activeTab = tab.key as Tab"
              :class="[
                'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors -mb-px',
                activeTab === tab.key
                  ? 'border-amber-500 text-amber-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-200'
              ]"
            >
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" :d="tab.icon" />
              </svg>
              {{ tab.label }}
              <!-- Badge for razones count -->
              <span
                v-if="tab.key === 'razones' && razones.length"
                class="text-xs bg-amber-100 text-amber-700 font-semibold px-1.5 py-0.5 rounded-full"
              >
                {{ razones.length }}
              </span>
            </button>
          </div>
          <!-- ── Body ──────────────────────────────────────────────────── -->
          <div class="flex-1 overflow-y-auto">

            <!-- ════════ TAB: CONFIGURACIÓN ════════ -->
            <div v-show="activeTab === 'configuracion'">
                <!-- Loading -->
                <div v-if="loading" class="p-8 flex flex-col items-center gap-3 text-gray-400">
                  <svg class="w-8 h-8 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <span class="text-sm">Cargando configuración…</span>
                </div>
    
                <!-- Fetch error -->
                <div v-else-if="fetchError" class="p-8 text-center">
                  <svg class="w-10 h-10 text-red-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p class="text-sm text-red-600 font-medium">{{ fetchError }}</p>
                  <button @click="fetchConfig" class="mt-3 text-xs text-red-500 underline">Reintentar</button>
                </div>
    
                <!-- ── VIEW MODE ─────────────────────────────────────────── -->
                <div v-else-if="!isEditing" class="px-6 py-5 space-y-5">
    
                  <!-- No config yet -->
                  <div v-if="!hasConfig" class="bg-amber-50 border border-amber-200 rounded-xl p-5 flex items-start gap-3">
                    <svg class="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24"
                      stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div>
                      <p class="text-sm font-medium text-amber-800">Sin configuración</p>
                      <p class="text-xs text-amber-600 mt-0.5">
                        Esta biblioteca aún no tiene reglas de préstamo definidas.
                        {{ canEdit ? 'Crea una configuración para habilitarla.' : '' }}
                      </p>
                    </div>
                  </div>
    
                  <!-- DOMICILIO section -->
                  <section>
                    <div class="flex items-center gap-2 mb-3">
                      <div class="w-6 h-6 rounded-lg bg-blue-100 flex items-center justify-center">
                        <svg class="w-3.5 h-3.5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                            d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                        </svg>
                      </div>
                      <h3 class="text-sm font-semibold text-gray-700">Préstamo a domicilio</h3>
                    </div>
    
                    <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div v-for="stat in [
                        { label: 'Días máximos', value: fmt(config?.diasPrestamoMax, ' días') },
                        { label: 'Renovaciones', value: fmt(config?.renovacionesMax) },
                        { label: 'Ejemplares máx.', value: fmt(config?.ejemplaresMaxDomicilio) },
                        // { label: 'Multa/día', value: fmtCurrency(config?.multaPorDia) },
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
             <!-- ════════ TAB: RAZONES DE CERTIFICADO ════════ -->
            <div v-show="activeTab === 'razones'" class="px-6 py-5 space-y-4">

              <!-- Loading razones -->
              <div v-if="razonesLoading" class="py-8 flex flex-col items-center gap-3 text-gray-400">
                <svg class="w-7 h-7 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span class="text-sm">Cargando razones…</span>
              </div>

              <template v-else>

                <!-- Formulario inline de creación/edición -->
                <Transition name="slide-form">
                  <div v-if="showRazonForm" class="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
                    <div class="flex items-center justify-between mb-1">
                      <h4 class="text-sm font-semibold text-amber-800">
                        {{ isEditingRazon ? 'Editar razón' : 'Nueva razón de certificado' }}
                      </h4>
                      <button @click="cancelRazonForm" class="text-amber-500 hover:text-amber-700 transition-colors">
                        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>

                    <div class="grid grid-cols-2 gap-3">
                      <!-- Nombre -->
                      <div class="col-span-2">
                        <label class="block text-xs font-medium text-gray-600 mb-1">Nombre <span class="text-red-500">*</span></label>
                        <input
                          v-model="razonForm.nombre"
                          type="text" maxlength="25"
                          placeholder="Ej: Egreso, Postgrado, Trámite..."
                          class="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                          :class="razonErrors.nombre ? 'border-red-400 bg-red-50' : 'border-gray-300'"
                        />
                        <p v-if="razonErrors.nombre" class="mt-1 text-xs text-red-500">{{ razonErrors.nombre }}</p>
                      </div>

                      <!-- Descripción -->
                      <div class="col-span-2">
                        <label class="block text-xs font-medium text-gray-600 mb-1">Descripción</label>
                        <input
                          v-model="razonForm.descripcion"
                          type="text" maxlength="100"
                          placeholder="Descripción breve..."
                          class="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                        />
                      </div>

                      <!-- Alcance -->
                      <!-- <div class="col-span-2">
                        <label class="block text-xs font-medium text-gray-600 mb-1.5">Alcance</label>
                        <div class="flex gap-2">
                          <button
                            @click="razonForm.bibliotecaId = props.bibliotecaId"
                            :class="[
                              'flex-1 py-2 px-3 text-xs font-medium rounded-lg border-2 transition-all',
                              !isGlobal
                                ? 'border-amber-500 bg-amber-50 text-amber-700'
                                : 'border-gray-200 text-gray-500 hover:border-gray-300'
                            ]"
                          >
                            <span class="flex items-center justify-center gap-1.5">
                              <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                              </svg>
                              Solo esta biblioteca
                            </span>
                          </button>
                          <button
                            @click="razonForm.bibliotecaId = null"
                            :class="[
                              'flex-1 py-2 px-3 text-xs font-medium rounded-lg border-2 transition-all',
                              isGlobal
                                ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                                : 'border-gray-200 text-gray-500 hover:border-gray-300'
                            ]"
                          >
                            <span class="flex items-center justify-center gap-1.5">
                              <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              Global (todas)
                            </span>
                          </button>
                        </div>
                      </div> -->

                      <!-- Requisitos -->
                      <div class="col-span-2">
                        <label class="block text-xs font-medium text-gray-600 mb-1.5">
                          Requisitos
                        </label>

                        <!-- Requisitos Predefinidos -->
                        <div v-if="REQUISITOS_DISPONIBLES.length" class="mb-4">
                          <p class="text-xs text-gray-500 mb-2">Seleccionar predefinidos:</p>
                          <div class="flex flex-wrap gap-2">
                            <button
                              v-for="req in REQUISITOS_DISPONIBLES"
                              :key="req"
                              @click="toggleRequisito(req)"
                              :class="[
                                'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border-2 transition-all',
                                razonForm.requisitos.includes(req)
                                  ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                                  : 'border-gray-200 text-gray-500 hover:border-gray-300'
                              ]"
                            >
                              <svg v-if="razonForm.requisitos.includes(req)" class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                              {{ requisitoLabel(req) }}
                            </button>
                          </div>
                        </div>

                        <!-- Agregar requisito personalizado -->
                        <div class="mt-4">
                          <p class="text-xs text-gray-500 mb-2">Agregar requisito personalizado:</p>
                          <div class="flex gap-2">
                            <input
                              v-model="nuevoRequisito"
                              type="text"
                              placeholder="Ej: Fotocopia de CI, Certificado de notas, ..."
                              class="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400"
                              @keyup.enter="agregarRequisitoPersonalizado"
                            />
                            <button
                              @click="agregarRequisitoPersonalizado"
                              class="px-4 py-2 bg-gray-700 hover:bg-gray-800 text-white text-sm font-medium rounded-lg transition-colors"
                            >
                              Agregar
                            </button>
                          </div>
                        </div>

                        <!-- Lista de requisitos seleccionados -->
                        <div v-if="razonForm.requisitos.length" class="mt-5">
                          <p class="text-xs text-gray-500 mb-2">Requisitos seleccionados:</p>
                          <div class="flex flex-wrap gap-2">
                            <div
                              v-for="(req, index) in razonForm.requisitos"
                              :key="index"
                              class="flex items-center gap-2 bg-white border border-gray-200 text-sm px-3 py-1.5 rounded-lg group"
                            >
                              <span>{{ req }}</span>
                              <button
                                @click="eliminarRequisito(index)"
                                class="text-gray-400 hover:text-red-500 transition-colors"
                              >
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  class="w-4 h-4"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                >
                                  <path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    stroke-width="2"
                                    d="M6 18L18 6M6 6l12 12"
                                  />
                                </svg>
                              </button>
                            </div>
                          </div>
                        </div>

                      </div>

                      <!-- Activo toggle -->
                      <div class="col-span-2 flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200">
                        <div>
                          <p class="text-sm font-medium text-gray-700">Estado</p>
                          <p class="text-xs text-gray-400">{{ razonForm.activo ? 'Activa y disponible' : 'Inactiva / oculta' }}</p>
                        </div>
                        <button
                          @click="razonForm.activo = !razonForm.activo"
                          :class="['relative w-10 h-5 rounded-full transition-colors duration-200', razonForm.activo ? 'bg-emerald-500' : 'bg-gray-300']"
                        >
                          <span :class="['absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200', razonForm.activo ? 'translate-x-5' : 'translate-x-0']" />
                        </button>
                      </div>
                    </div>

                    <!-- Form actions -->
                    <div class="flex justify-end gap-2 pt-1">
                      <button @click="cancelRazonForm" class="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                        Cancelar
                      </button>
                      <button @click="saveRazon" :disabled="savingRazon"
                        class="flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium text-white bg-amber-500 hover:bg-amber-600 rounded-lg transition-colors disabled:opacity-60">
                        <svg v-if="savingRazon" class="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        {{ savingRazon ? 'Guardando…' : (isEditingRazon ? 'Guardar cambios' : 'Crear razón') }}
                      </button>
                    </div>
                  </div>
                </Transition>

                <!-- Header row -->
                <div class="flex items-center justify-between">
                  <p class="text-xs text-gray-500">
                    {{ razones.length }} razón(es) disponibles
                    <span class="text-gray-400">· específicas + globales</span>
                  </p>
                  <button
                    v-if="canEdit && !showRazonForm"
                    @click="openCreateRazon"
                    class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-amber-500 hover:bg-amber-600 rounded-lg transition-colors"
                  >
                    <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4" />
                    </svg>
                    Nueva razón
                  </button>
                </div>

                <!-- Error -->
                <div v-if="razonesError" class="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600 flex items-center gap-2">
                  <svg class="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {{ razonesError }}
                </div>

                <!-- Empty -->
                <div v-else-if="!razones.length" class="py-10 text-center">
                  <div class="w-12 h-12 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                    <svg class="w-6 h-6 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <p class="text-sm font-medium text-gray-500">Sin razones configuradas</p>
                  <p class="text-xs text-gray-400 mt-1">Crea razones para que los estudiantes puedan solicitar certificados.</p>
                </div>

                <!-- Lista de razones -->
                <div v-else class="space-y-2">
                  <div
                    v-for="razon in razones"
                    :key="razon.idRazon"
                    :class="[
                      'flex items-start gap-3 p-4 rounded-xl border transition-colors',
                      razon.activo ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-200 opacity-60'
                    ]"
                  >
                    <!-- Ícono -->
                    <div :class="[
                      'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5',
                      razon.bibliotecaId === null ? 'bg-indigo-100' : 'bg-amber-100'
                    ]">
                      <svg :class="['w-4 h-4', razon.bibliotecaId === null ? 'text-indigo-600' : 'text-amber-600']"
                        fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                          :d="razon.bibliotecaId === null
                            ? 'M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
                            : 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z'"
                        />
                      </svg>
                    </div>

                    <!-- Info -->
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center gap-2 flex-wrap">
                        <p class="font-semibold text-sm text-gray-800">{{ razon.nombre }}</p>
                        <!-- Global badge -->
                        <span v-if="razon.bibliotecaId === null"
                          class="text-xs bg-indigo-100 text-indigo-600 font-medium px-1.5 py-0.5 rounded-full">
                          Global
                        </span>
                        <!-- Activo badge -->
                        <span :class="[
                          'text-xs font-medium px-1.5 py-0.5 rounded-full',
                          razon.activo ? 'bg-emerald-100 text-emerald-600' : 'bg-gray-100 text-gray-500'
                        ]">
                          {{ razon.activo ? 'Activa' : 'Inactiva' }}
                        </span>
                      </div>
                      <p v-if="razon.descripcion" class="text-xs text-gray-500 mt-0.5">{{ razon.descripcion }}</p>

                      <!-- Requisitos -->
                      <div v-if="razon.requisitos.length" class="flex flex-wrap gap-1.5 mt-2">
                        <span
                          v-for="req in razon.requisitos"
                          :key="req"
                          class="flex items-center gap-1 text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-medium"
                        >
                          <svg class="w-3 h-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4" />
                          </svg>
                          {{ requisitoLabel(req) }}
                        </span>
                      </div>
                      <p v-else class="text-xs text-gray-400 mt-1.5">Sin requisitos adicionales</p>
                    </div>

                    <!-- Actions -->
                    <div v-if="canEdit" class="flex items-center gap-1 flex-shrink-0">
                      <!-- Confirm delete -->
                      <template v-if="confirmDeleteId === razon.idRazon">
                        <span class="text-xs text-red-500 mr-1">¿Eliminar?</span>
                        <button
                          @click="deleteRazon(razon.idRazon)"
                          :disabled="deletingId === razon.idRazon"
                          class="p-1.5 rounded-lg text-white bg-red-500 hover:bg-red-600 transition-colors disabled:opacity-60"
                        >
                          <svg v-if="deletingId === razon.idRazon" class="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                          <svg v-else class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
                          </svg>
                        </button>
                        <button @click="confirmDeleteId = null" class="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors">
                          <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </template>
                      <template v-else>
                        <button
                          @click="openEditRazon(razon)"
                          class="p-1.5 rounded-lg text-gray-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                          title="Editar"
                        >
                          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          @click="confirmDeleteId = razon.idRazon"
                          class="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                          title="Eliminar"
                        >
                          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </template>
                    </div>
                  </div>
                </div>

              </template>
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
              <span v-else-if="activeTab === 'razones'">{{ razones.length }} razón(es) · ID biblioteca: {{ bibliotecaId }}</span>
            </div>

            <!-- Right: actions -->
            <div class="flex items-center gap-3">
               <template v-if="activeTab === 'configuracion'">
                  <template v-if="!isEditing">
                    <button @click="close"
                      class="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                      Cerrar
                    </button>
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
               </template>
                <!-- Footer actions for RAZONES tab -->
              <template v-else>
                <button @click="close"
                  class="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                  Cerrar
                </button>
                <button v-if="canEdit && !showRazonForm" @click="openCreateRazon"
                  class="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-amber-500 rounded-lg hover:bg-amber-600 transition-colors">
                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4" />
                  </svg>
                  Nueva razón
                </button>
              </template>
            </div>
          </div>

        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.2s ease;
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}
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