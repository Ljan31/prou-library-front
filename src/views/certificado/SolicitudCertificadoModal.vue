<script setup lang="ts">
/**
 * SolicitudCertificadoModal.vue
 * Modal de detalle: muestra datos del solicitante, historial, requisitos
 * y permite APROBAR o RECHAZAR la solicitud.
 */
import { ref, computed, watch } from 'vue'
import type { SolicitudCertificado } from '@/services/solicitudes-certificado.service'
import {razonCertificadoService} from '@/services/razon-certificado.service'

// ─── Props & Emits ────────────────────────────────────────────────────────────
const props = defineProps<{
  show: boolean
  solicitud: SolicitudCertificado | null
  procesando?: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'aprobar', observacion: string): void
  (e: 'rechazar', motivo: string): void
}>()

// ─── State ────────────────────────────────────────────────────────────────────
const accion = ref<'aprobar' | 'rechazar' | null>(null)
const observacion = ref('')
const motivoError = ref('')

// Requisitos dinámicos de la razón
const requisitosArray = ref<string[]>([])
const requisitosChecked = ref<Record<string, boolean>>({})

// ─── Labels de requisitos ─────────────────────────────────────────────────────
const REQUISITO_LABELS: Record<string, string> = {
  cd: 'CD / Respaldo digital',
  carta: 'Carta institucional',
  tesis: 'Documento de tesis',
  recibo: 'Recibo de pago',
  carnet: 'Carnet de identidad',
  foto: 'Fotografía reciente',
}

// Parsear requisitos desde el campo "requisitos" (string o JSON array)
watch(
  () => props.solicitud,
  async (sol) => {
    console.log(props.solicitud)
    accion.value = null
    observacion.value = ''
    motivoError.value = ''
    requisitosChecked.value = {}

    if (!sol) return

    // Intentar obtener requisitos dinámicos desde el servicio
    try {
      console.log('modalSolicitud', sol)
      const razones = await razonCertificadoService.getByBiblioteca(sol.bibliotecaId)
      console.log('razones', razones)
      const razon = razones.find(r => r.idRazon === sol.razonId)
      console.log(razon)
      if (razon?.requisitos && Array.isArray(razon.requisitos)) {
        requisitosArray.value = razon.requisitos
      } else {
        requisitosArray.value = []
      }
    } catch {
      requisitosArray.value = []
    }

    // Inicializar checks en false
    const checks: Record<string, boolean> = {}
    requisitosArray.value.forEach(r => { checks[r] = false })
    console.log('requisitosArray', requisitosArray.value)
    requisitosChecked.value = checks
  },
  { immediate: true },
)

const todosRequisitosChecked = computed(() =>
  requisitosArray.value.every(r => requisitosChecked.value[r])
)

// ─── Acciones ─────────────────────────────────────────────────────────────────
function confirmarAprobar() {
  emit('aprobar', observacion.value.trim())
}

function confirmarRechazar() {
  if (!observacion.value.trim()) {
    motivoError.value = 'El motivo de rechazo es obligatorio'
    return
  }
  motivoError.value = ''
  emit('rechazar', observacion.value.trim())
}

function cancelarAccion() {
  accion.value = null
  observacion.value = ''
  motivoError.value = ''
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatDateTime(s?: string | null) {
  if (!s) return '—'
  return new Date(s).toLocaleString('es-BO', {
    day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

const estadoConfig = {
  PENDIENTE: { cls: 'bg-amber-100 text-amber-700 border-amber-200', label: 'Pendiente', dot: 'bg-amber-500' },
  APROBADA:  { cls: 'bg-emerald-100 text-emerald-700 border-emerald-200', label: 'Aprobada', dot: 'bg-emerald-500' },
  RECHAZADA: { cls: 'bg-red-100 text-red-700 border-red-200', label: 'Rechazada', dot: 'bg-red-500' },
} as const

function estadoCfg(e: string) {
  return estadoConfig[e as keyof typeof estadoConfig] ?? { cls: 'bg-slate-100 text-slate-600 border-slate-200', label: e, dot: 'bg-slate-400' }
}
</script>

<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div
        v-if="show && solicitud"
        class="fixed inset-0 z-50 flex items-center justify-center p-4"
      >
        <!-- Backdrop -->
        <div
          class="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
          @click="emit('close')"
        />

        <!-- Panel -->
        <div
          class="relative w-full max-w-2xl max-h-[90vh] flex flex-col bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
        >
          <!-- Header -->
          <div class="flex items-center gap-3 px-6 py-4 border-b border-slate-100 bg-slate-50/60 flex-shrink-0">
            <div class="w-9 h-9 rounded-xl bg-indigo-100 flex items-center justify-center flex-shrink-0">
              <svg class="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div class="flex-1 min-w-0">
              <h2 class="font-semibold text-slate-900 text-sm leading-tight">
                Solicitud #{{ solicitud.id }}
              </h2>
              <p class="text-xs text-slate-500 truncate">{{ solicitud.razonNombre }}</p>
            </div>
            <!-- Estado badge -->
            <span :class="['inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border', estadoCfg(solicitud.estado).cls]">
              <span :class="['w-1.5 h-1.5 rounded-full', estadoCfg(solicitud.estado).dot]" />
              {{ estadoCfg(solicitud.estado).label }}
            </span>
            <button
              @click="emit('close')"
              class="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors flex-shrink-0"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- Contenido scrollable -->
          <div class="flex-1 overflow-y-auto p-6 space-y-5">

            <!-- Datos del solicitante -->
            <section>
              <h3 class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Solicitante</h3>
              <div class="grid grid-cols-2 gap-3">
                <div class="col-span-2 sm:col-span-1 bg-slate-50 rounded-xl px-4 py-3 border border-slate-100">
                  <p class="text-xs text-slate-400 mb-0.5">Nombre completo</p>
                  <p class="text-sm font-semibold text-slate-800 capitalize">
                    {{ solicitud.nombres }} {{ solicitud.apellidos }}
                  </p>
                </div>
                <div class="bg-slate-50 rounded-xl px-4 py-3 border border-slate-100">
                  <p class="text-xs text-slate-400 mb-0.5">CI</p>
                  <p class="text-sm font-semibold text-slate-800">{{ solicitud.ci }}</p>
                </div>
                <div class="bg-slate-50 rounded-xl px-4 py-3 border border-slate-100">
                  <p class="text-xs text-slate-400 mb-0.5">Matrícula</p>
                  <p class="text-sm font-semibold text-slate-800">{{ solicitud.matricula || '—' }}</p>
                </div>
                <div v-if="solicitud.email" class="bg-slate-50 rounded-xl px-4 py-3 border border-slate-100">
                  <p class="text-xs text-slate-400 mb-0.5">Correo</p>
                  <p class="text-sm text-slate-700 truncate">{{ solicitud.email }}</p>
                </div>
                <div v-if="solicitud.telefono" class="bg-slate-50 rounded-xl px-4 py-3 border border-slate-100">
                  <p class="text-xs text-slate-400 mb-0.5">Teléfono</p>
                  <p class="text-sm text-slate-700">{{ solicitud.telefono }}</p>
                </div>
              </div>
            </section>

            <!-- Tipo de certificado -->
            <section>
              <h3 class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Tipo de certificado</h3>
              <div class="bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-3 space-y-1">
                <p class="text-sm font-semibold text-indigo-800">{{ solicitud.razonNombre }}</p>
                <p class="text-xs text-indigo-600">{{ solicitud.bibliotecaNombre }}</p>
              </div>
            </section>

            <!-- Observaciones del solicitante -->
            <section v-if="solicitud.descripcion">
              <h3 class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Descripción / Motivo</h3>
              <div class="bg-slate-50 border border-slate-100 rounded-xl px-4 py-3">
                <p class="text-sm text-slate-700 leading-relaxed">{{ solicitud.descripcion }}</p>
              </div>
            </section>

            <!-- Requisitos dinámicos -->
            <section v-if="requisitosArray.length > 0 && solicitud.estado === 'PENDIENTE'">
              <h3 class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                Requisitos a verificar
              </h3>
              <div class="space-y-2">
                <label
                  v-for="req in requisitosArray"
                  :key="req"
                  class="flex items-center gap-3 p-3 bg-white border rounded-xl cursor-pointer transition-all hover:border-indigo-300"
                  :class="requisitosChecked[req] ? 'border-emerald-300 bg-emerald-50/50' : 'border-slate-200'"
                >
                  <input
                    type="checkbox"
                    v-model="requisitosChecked[req]"
                    class="w-4 h-4 rounded text-emerald-600 border-slate-300 focus:ring-emerald-500 cursor-pointer"
                  />
                  <span class="text-sm text-slate-700 flex-1">
                    {{ REQUISITO_LABELS[req] ?? req }}
                  </span>
                  <svg v-if="requisitosChecked[req]" class="w-4 h-4 text-emerald-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
                  </svg>
                </label>
              </div>
              <p v-if="!todosRequisitosChecked" class="text-xs text-amber-600 mt-2 flex items-center gap-1">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                Verifica que el solicitante haya presentado todos los documentos requeridos
              </p>
            </section>

            <!-- Historial de respuesta (si ya fue procesada) -->
            <section v-if="solicitud.estado !== 'PENDIENTE'">
              <h3 class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Historial de atención</h3>
              <div :class="['rounded-xl border p-4 space-y-2', solicitud.estado === 'APROBADA' ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200']">
                <div class="flex items-center gap-2">
                  <svg v-if="solicitud.estado === 'APROBADA'" class="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
                  </svg>
                  <svg v-else class="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  <p class="text-sm font-semibold" :class="solicitud.estado === 'APROBADA' ? 'text-emerald-800' : 'text-red-700'">
                    {{ solicitud.estado === 'APROBADA' ? 'Aprobada' : 'Rechazada' }}
                  </p>
                </div>
                <div class="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span class="text-slate-500">Atendida por:</span>
                    <span class="ml-1 font-medium text-slate-700">{{ solicitud.atendidoPorNombre ?? '—' }}</span>
                  </div>
                  <div>
                    <span class="text-slate-500">Fecha:</span>
                    <span class="ml-1 font-medium text-slate-700">{{ formatDateTime(solicitud.fechaRespuesta) }}</span>
                  </div>
                </div>
                <div v-if="solicitud.observacionRespuesta" class="pt-1 border-t border-slate-200/80">
                  <p class="text-xs text-slate-500 mb-0.5">Observación:</p>
                  <p class="text-sm text-slate-700">{{ solicitud.observacionRespuesta }}</p>
                </div>
              </div>
            </section>

            <!-- Fechas -->
            <section>
              <h3 class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Fechas</h3>
              <div class="flex gap-3 flex-wrap">
                <div class="bg-slate-50 border border-slate-100 rounded-xl px-4 py-2.5 flex-1 min-w-40">
                  <p class="text-xs text-slate-400 mb-0.5">Solicitud recibida</p>
                  <p class="text-sm font-medium text-slate-700">{{ formatDateTime(solicitud.fechaSolicitud) }}</p>
                </div>
                <div v-if="solicitud.fechaRespuesta" class="bg-slate-50 border border-slate-100 rounded-xl px-4 py-2.5 flex-1 min-w-40">
                  <p class="text-xs text-slate-400 mb-0.5">Fecha de respuesta</p>
                  <p class="text-sm font-medium text-slate-700">{{ formatDateTime(solicitud.fechaRespuesta) }}</p>
                </div>
              </div>
            </section>

            <!-- Panel de acción -->
            <section v-if="solicitud.estado === 'PENDIENTE' && !accion">
              <div class="flex gap-3">
                <button
                  @click="accion = 'aprobar'"
                  :disabled="requisitosArray.length > 0 && !todosRequisitosChecked"
                  :class="['flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-semibold transition-all',
                    (requisitosArray.length > 0 && !todosRequisitosChecked)
                      ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-200 active:scale-[0.98]']"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
                  </svg>
                  Aprobar / Generar certificado
                </button>
                <button
                  @click="accion = 'rechazar'"
                  class="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-semibold border border-red-200 text-red-600 hover:bg-red-50 transition-all"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Rechazar
                </button>
              </div>
            </section>

            <!-- Confirmar aprobar -->
            <Transition name="action-slide">
              <section v-if="accion === 'aprobar'" class="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-3">
                <p class="text-sm font-semibold text-emerald-800 flex items-center gap-2">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
                  </svg>
                  Confirmar aprobación
                </p>
                <div>
                  <label class="block text-xs font-medium text-slate-600 mb-1">Observación (opcional)</label>
                  <textarea
                    v-model="observacion"
                    rows="2"
                    placeholder="Ej: Todo correcto, documentos en orden..."
                    class="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none transition-all"
                  />
                </div>
                <div class="flex gap-2">
                  <button
                    @click="confirmarAprobar"
                    :disabled="procesando"
                    class="flex-1 flex items-center justify-center gap-2 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <svg v-if="procesando" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                    </svg>
                    {{ procesando ? 'Procesando...' : 'Confirmar aprobación' }}
                  </button>
                  <button @click="cancelarAccion" class="px-4 py-2.5 rounded-xl text-sm text-slate-500 border border-slate-200 hover:bg-slate-50 transition-all">
                    Cancelar
                  </button>
                </div>
              </section>
            </Transition>

            <!-- Confirmar rechazar -->
            <Transition name="action-slide">
              <section v-if="accion === 'rechazar'" class="bg-red-50 border border-red-200 rounded-xl p-4 space-y-3">
                <p class="text-sm font-semibold text-red-800 flex items-center gap-2">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Confirmar rechazo
                </p>
                <div>
                  <label class="block text-xs font-medium text-slate-600 mb-1">
                    Motivo del rechazo <span class="text-red-400">*</span>
                  </label>
                  <textarea
                    v-model="observacion"
                    rows="2"
                    placeholder="Ej: Faltan documentos requeridos..."
                    class="w-full px-3 py-2 text-sm border rounded-xl focus:outline-none focus:ring-2 resize-none transition-all"
                    :class="motivoError ? 'border-red-300 focus:ring-red-400' : 'border-slate-200 focus:ring-red-400'"
                  />
                  <p v-if="motivoError" class="text-xs text-red-500 mt-1">{{ motivoError }}</p>
                </div>
                <div class="flex gap-2">
                  <button
                    @click="confirmarRechazar"
                    :disabled="procesando"
                    class="flex-1 flex items-center justify-center gap-2 py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-xl transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <svg v-if="procesando" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                    </svg>
                    {{ procesando ? 'Procesando...' : 'Confirmar rechazo' }}
                  </button>
                  <button @click="cancelarAccion" class="px-4 py-2.5 rounded-xl text-sm text-slate-500 border border-slate-200 hover:bg-slate-50 transition-all">
                    Cancelar
                  </button>
                </div>
              </section>
            </Transition>

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
.modal-fade-enter-active .relative,
.modal-fade-leave-active .relative {
  transition: transform 0.25s ease, opacity 0.2s ease;
}
.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}
.modal-fade-enter-from .relative {
  transform: translateY(12px) scale(0.98);
  opacity: 0;
}

.action-slide-enter-active,
.action-slide-leave-active {
  transition: all 0.2s ease;
}
.action-slide-enter-from,
.action-slide-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}
</style>