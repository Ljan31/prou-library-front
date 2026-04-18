<script setup lang="ts">
import { ref } from 'vue'
import CertificadoPdfViewer from './CertificadoPdfViewer.vue'

// ─── Types ────────────────────────────────────────────────────────────────────
interface Certificado {
  id_certificado: number
  fechaEmision: string
  fechaVencimiento: string
  codigo_verificacion: string
  estadoCertificado: 'VIGENTE' | 'VENCIDO' | 'ANULADO'
  urlDescarga: string
  bibliotecaNombre?: string
  usuario?: { nombreCompleto?: string }
}

// ─── Props & Emits ────────────────────────────────────────────────────────────
const props = defineProps<{
  show: boolean
  certificados: Certificado[]
  titulo?: string
  // Quién puede anular (staff)
  canAnular?: boolean
  anulandoId?: number | null
}>()

const emit = defineEmits<{
  close: []
  anular: [id: number]
}>()

// ─── PDF Viewer ───────────────────────────────────────────────────────────────
const pdfViewerShow = ref(false)
const pdfViewerCertId = ref<number | null>(null)

function abrirVisor(id: number) {
  pdfViewerCertId.value = id
  pdfViewerShow.value = true
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatDateTime(s?: string) {
  if (!s) return '—'
  return new Date(s).toLocaleString('es-BO', {
    day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function estadoCertClasses(estado: string) {
  const m: Record<string, string> = {
    VIGENTE: 'bg-emerald-100 text-emerald-700',
    VENCIDO: 'bg-amber-100 text-amber-700',
    ANULADO: 'bg-red-100 text-red-700',
  }
  return m[estado] ?? 'bg-slate-100 text-slate-600'
}

function cardBorderClass(estado: string) {
  if (estado === 'VIGENTE') return 'border-emerald-200 bg-emerald-50/40'
  if (estado === 'VENCIDO') return 'border-amber-100 bg-amber-50/30'
  return 'border-slate-200 bg-slate-50/40'
}
</script>

<template>
  <!-- PDF Viewer (z mayor para quedar por encima del modal) -->
  <CertificadoPdfViewer :show="pdfViewerShow" :certificado-id="pdfViewerCertId" @close="pdfViewerShow = false" />

  <Transition name="fade">
    <div v-if="show" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      @click.self="emit('close')">
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden"
        style="max-height: 85vh">

        <!-- Header -->
        <div class="flex items-center gap-3 px-6 pt-6 pb-4 border-b border-slate-100 flex-shrink-0">
          <div class="w-9 h-9 rounded-xl bg-indigo-100 flex items-center justify-center flex-shrink-0">
            <svg class="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div class="flex-1 min-w-0">
            <h3 class="font-semibold text-slate-900 text-sm">
              {{ titulo ?? 'Certificados' }}
            </h3>
            <p class="text-xs text-slate-400 mt-0.5">{{ certificados.length }} certificado(s) encontrado(s)</p>
          </div>
          <button @click="emit('close')" class="text-slate-400 hover:text-slate-600 transition-colors flex-shrink-0">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- Lista de certificados -->
        <div class="overflow-y-auto flex-1 p-4 space-y-3">

          <!-- Empty -->
          <div v-if="!certificados.length" class="py-10 text-center">
            <div class="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <svg class="w-6 h-6 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p class="text-sm text-slate-400">No hay certificados para mostrar</p>
          </div>

          <!-- Cards de certificados -->
          <div v-for="c in certificados" :key="c.id_certificado" class="rounded-xl border p-4 transition-all"
            :class="cardBorderClass(c.estadoCertificado)">
            <!-- Header card: estado + biblioteca -->
            <div class="flex items-center justify-between mb-3">
              <span :class="['text-xs font-bold px-2.5 py-1 rounded-full', estadoCertClasses(c.estadoCertificado)]">
                {{ c.estadoCertificado }}
              </span>
              <span class="text-xs text-slate-400 truncate ml-2">{{ c.bibliotecaNombre ?? '—' }}</span>
            </div>

            <!-- Código de verificación -->
            <p
              class="text-xs font-mono text-indigo-700 bg-indigo-50 rounded-lg px-3 py-1.5 mb-3 break-all select-all cursor-text">
              {{ c.codigo_verificacion }}
            </p>

            <!-- Fechas -->
            <div class="grid grid-cols-2 gap-2 text-xs mb-3">
              <div>
                <p class="text-slate-400 mb-0.5">Emitido</p>
                <p class="font-medium text-slate-700">{{ formatDateTime(c.fechaEmision) }}</p>
              </div>
              <div>
                <p class="text-slate-400 mb-0.5">Vence</p>
                <p class="font-medium"
                  :class="c.estadoCertificado === 'VIGENTE' ? 'text-emerald-700' : 'text-slate-500'">
                  {{ formatDateTime(c.fechaVencimiento) }}
                </p>
              </div>
            </div>

            <!-- Acciones -->
            <div class="flex gap-2">
              <!-- Ver PDF -->
              <button @click="abrirVisor(c.id_certificado)"
                class="flex-1 flex items-center justify-center gap-1.5 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                Ver PDF
              </button>

              <!-- Descargar (también abre el visor que tiene el botón descargar) -->
              <button @click="abrirVisor(c.id_certificado)"
                class="flex-1 flex items-center justify-center gap-1.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg transition-colors">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Descargar PDF
              </button>

              <!-- Anular (solo staff, solo VIGENTE) -->
              <button v-if="canAnular && c.estadoCertificado === 'VIGENTE'" @click="emit('anular', c.id_certificado)"
                :disabled="anulandoId === c.id_certificado"
                class="flex items-center gap-1.5 px-3 py-2 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-semibold rounded-lg transition-colors disabled:opacity-50 flex-shrink-0">
                <svg v-if="anulandoId === c.id_certificado" class="w-3.5 h-3.5 animate-spin" fill="none"
                  viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
                <svg v-else class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
                {{ anulandoId === c.id_certificado ? '...' : 'Anular' }}
              </button>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="px-6 py-4 border-t border-slate-100 flex-shrink-0">
          <button @click="emit('close')"
            class="w-full py-2 text-sm text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors font-medium">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>