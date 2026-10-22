<script setup lang="ts">
import { ref, watch, computed } from 'vue'
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

const props = defineProps<{
  bibliotecaId: number
}>()


const uiStore = useUiStore()
const auth = useAuthStore()

// ─── State ────────────────────────────────────────────────────────────────
const razones = ref<RazonCertificado[]>([])
const razonesLoading = ref(false)
const razonesError = ref<string | null>(null)

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
const nuevoRequisito = ref('')

const isEditingRazon = computed(() => !!editingRazon.value)
const canEdit = computed(() => auth.isAdmin || auth.isBibliotecario)

// ─── Watch Context ────────────────────────────────────────────────────────
watch(
  () => props.bibliotecaId,
  async (bibliotecaId) => {
    if (bibliotecaId == null || bibliotecaId <= 0) return
    cancelRazonForm()
    await fetchRazones()
  },
  { immediate: true }
)

async function fetchRazones() {
  razonesLoading.value = true
  razonesError.value = null
  try {
    const [byBib, all] = await Promise.all([
      razonCertificadoService.getByBiblioteca(props.bibliotecaId).catch(() => []),
      razonCertificadoService.getAll().catch(() => [])
    ])
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

function toggleRequisito(req: string) {
  const current = razonForm.value.requisitos
  if (current.includes(req)) {
    razonForm.value.requisitos = current.filter(r => r !== req)
  } else {
    razonForm.value.requisitos.push(req)
  }
}

function agregarRequisitoPersonalizado() {
  const valor = nuevoRequisito.value.trim()
  if (!valor) return
  if (!razonForm.value.requisitos.includes(valor)) {
    razonForm.value.requisitos.push(valor)
  }
  nuevoRequisito.value = ''
}

function eliminarRequisito(index: number) {
  razonForm.value.requisitos.splice(index, 1)
}

function requisitoLabel(key: string): string {
  return REQUISITO_LABELS[key] ?? key
}
</script>

<template>
  <div class="mx-auto max-w-6xl overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm p-6 space-y-4">
    <!-- Estado de carga -->
    <div v-if="razonesLoading" class="py-8 flex flex-col items-center gap-3 text-gray-400">
      <svg class="w-7 h-7 animate-spin" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
      <span class="text-sm">Cargando razones…</span>
    </div>

    <template v-else>
      <!-- Formulario Inline con Transición Deslizable -->
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
            <div class="col-span-2">
              <label class="block text-xs font-medium text-gray-600 mb-1">Nombre <span class="text-red-500">*</span></label>
              <input v-model="razonForm.nombre" type="text" maxlength="25" placeholder="Ej: Egreso, Postgrado, Trámite..." class="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" :class="razonErrors.nombre ? 'border-red-400 bg-red-50' : 'border-gray-300'" />
              <p v-if="razonErrors.nombre" class="mt-1 text-xs text-red-500">{{ razonErrors.nombre }}</p>
            </div>

            <div class="col-span-2">
              <label class="block text-xs font-medium text-gray-600 mb-1">Descripción</label>
              <input v-model="razonForm.descripcion" type="text" maxlength="100" placeholder="Descripción breve del motivo del certificado..." class="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
            </div>

            <div class="col-span-2">
              <label class="block text-xs font-medium text-gray-600 mb-1.5">Requisitos del Alumno</label>
              
              <!-- Selector de Requisitos Predefinidos -->
              <div v-if="REQUISITOS_DISPONIBLES.length" class="mb-4">
                <p class="text-xs text-gray-500 mb-2">Seleccionar predefinidos:</p>
                <div class="flex flex-wrap gap-2">
                  <button type="button" v-for="req in REQUISITOS_DISPONIBLES" :key="req" @click="toggleRequisito(req)" :class="['flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border-2 transition-all', razonForm.requisitos.includes(req) ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-gray-200 text-gray-500 hover:border-gray-300']">
                    <svg v-if="razonForm.requisitos.includes(req)" class="w-3 h-3 text-emerald-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    {{ requisitoLabel(req) }}
                  </button>
                </div>
              </div>

              <!-- Inserción de Requisito Personalizado -->
              <div class="mt-4">
                <p class="text-xs text-gray-500 mb-2">Agregar requisito personalizado:</p>
                <div class="flex gap-2">
                  <input v-model="nuevoRequisito" type="text" placeholder="Ej: CD Proyecto, Carta institucional..." class="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400" @keyup.enter="agregarRequisitoPersonalizado" />
                  <button type="button" @click="agregarRequisitoPersonalizado" class="px-4 py-2 bg-gray-700 hover:bg-gray-800 text-white text-sm font-medium rounded-lg transition-colors">Agregar</button>
                </div>
              </div>

              <!-- Listado de Requisitos Seleccionados -->
              <div v-if="razonForm.requisitos.length" class="mt-5">
                <p class="text-xs text-gray-500 mb-2">Requisitos seleccionados actuales:</p>
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