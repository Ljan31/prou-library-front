<script setup lang="ts">
/**
 * ConvertirReservaModal
 * Registra el retiro físico de una reserva NOTIFICADA.
 * Layout inspirado en el "Resumen del lote" de PrestamosView.
 */
import { ref, onMounted, computed } from 'vue'
import { reservasService } from '@/services/reservas.service'
import { useUiStore } from '@/stores/ui.store'
import { useMedia } from '@/composables/useMedia'
import api from '@/services/axios'
import type { ReservaResponse, ConvertirReservaPayload } from '@/types/reservas'

const props = defineProps<{ reserva: ReservaResponse }>()
const emit = defineEmits<{
  (e: 'close'): void
  (e: 'convertida'): void
}>()

const ui = useUiStore()
const { getUrl } = useMedia()
interface ReglasConfig {
  idConfig: number
  diasPrestamoMax: number | null
  renovacionesMax: number | null
  ejemplaresPermitidos: number | null
  multaPorDia: number | null
  multaMaxDias: number | null
  diasSuspension: number | null
}
onMounted(async () => {
  // fetchPrestamos()
  await loadBibliotecaConfig()
  fechaDevolucion.value = calcFechaDevolucion()
})


// ─── Formulario ───────────────────────────────────────────────────────────
type Condicion = 'EXCELENTE' | 'BUENO' | 'REGULAR' | 'MALO'
type TipoDoc = 'CI' | 'CARNET_UNIVERSITARIO' | 'PASAPORTE'

const condicionEntrega = ref<Condicion>('BUENO')
const tipoDocumento = ref<TipoDoc>('CI')
const observaciones = ref('')
const enviando = ref(false)
const errorMsg = ref<string | null>(null)

const CONDICIONES: Condicion[] = ['EXCELENTE', 'BUENO', 'REGULAR', 'MALO']
const TIPOS_DOC: { value: TipoDoc; label: string }[] = [
  { value: 'CI', label: '🪪 Carnet de Identidad' },
  { value: 'MATRICULA', label: '🎓 Matricula' },
  { value: 'PASAPORTE', label: '📘 Pasaporte' },
]

const condicionColors: Record<Condicion, string> = {
  EXCELENTE: 'border-emerald-500 bg-emerald-50 text-emerald-700',
  BUENO: 'border-indigo-500 bg-indigo-50 text-indigo-700',
  REGULAR: 'border-amber-500 bg-amber-50 text-amber-700',
  MALO: 'border-red-500 bg-red-50 text-red-700',
}

function inicialUsuario(nombre: string) {
  return nombre?.charAt(0)?.toUpperCase() ?? '?'
}

const configLoading = ref(false)
const reglasDomicilio = ref<ReglasConfig | null>(null)
const reglasSala = ref<ReglasConfig | null>(null)

async function loadBibliotecaConfig() {
  // const biblId = auth.user?.biblioteca?.id_biblioteca ?? auth.user?.biblioteca?.[0]?.id_biblioteca
  const biblId = props.reserva?.bibliotecaId ?? 0
  if (!biblId) return
  try {
    const [rDom, rSala] = await Promise.all([
      api.get(`/configuraciones-prestamo/biblioteca/${biblId}/reglas`, { params: { tipoPrestamo: 'DOMICILIO' } }),
      api.get(`/configuraciones-prestamo/biblioteca/${biblId}/reglas`, { params: { tipoPrestamo: 'SALA' } }),
    ])
    reglasDomicilio.value = rDom.data?.data ?? rDom.data
    reglasSala.value = rSala.data?.data ?? rSala.data
  } catch {
    // Config opcional — el sistema sigue funcionando sin ella
  } finally {
  }
}

const reglasActivas = computed<ReglasConfig | null>(() =>
  // tipoPrestamo.value === 'DOMICILIO' ? reglasDomicilio.value : reglasSala.value
  reglasDomicilio.value
)
function calcFechaDevolucion(): string {
  const dias = reglasActivas.value?.diasPrestamoMax ?? 3
  const d = new Date()
  d.setDate(d.getDate() + dias)
  return d.toISOString().split('T')[0]
}
const hoy = new Date().toISOString().split('T')[0]
const fechaDevolucion = ref('')
// ─── Acción ───────────────────────────────────────────────────────────────
async function confirmar() {
  enviando.value = true
  errorMsg.value = null
  try {
    const payload: ConvertirReservaPayload = {
      reservaId: props.reserva.idReserva,
      condicionEntrega: condicionEntrega.value,
      tipoDocumentoGarantia: tipoDocumento.value,
      observaciones: observaciones.value || undefined,
      fechaDevolucionEstimada: fechaDevolucion.value
    }
    await reservasService.convertir(payload)
    ui.toast.success('Préstamo registrado', `"${props.reserva.libroTitulo}" entregado correctamente.`)
    emit('convertida')
  } catch (e: unknown) {
    errorMsg.value = e instanceof Error ? e.message : 'No se pudo registrar el retiro'
  } finally {
    enviando.value = false
  }
}
</script>

<template>
  <!-- Backdrop -->
  <div class="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4"
    @click.self="emit('close')">
    <div class="bg-slate-100 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[90vh] overflow-y-auto">

      <!-- ── Header ─────────────────────────────────────────────────────── -->
      <div class="bg-white px-6 pt-5 pb-4 border-b border-slate-200 flex items-start justify-between gap-3">
        <div>
          <p class="text-xs text-slate-400 font-medium uppercase tracking-wide">Registrar retiro</p>
          <h2 class="text-lg font-bold text-slate-900 mt-0.5">Confirmar entrega</h2>
        </div>
        <button @click="emit('close')"
          class="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors shrink-0">
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div class="p-5 space-y-4">

        <!-- ── Resumen del retiro ─────────────────────────────────────── -->
        <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div class="px-5 py-3 border-b border-slate-100">
            <p class="text-sm font-semibold text-slate-700">Resumen del retiro</p>
          </div>
          <div class="p-4 space-y-3">

            <!-- Usuario -->
            <div class="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
              <div
                class="w-9 h-9 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
                {{ inicialUsuario(reserva.usuarioNombreCompleto) }}
              </div>
              <div class="min-w-0">
                <p class="text-sm font-semibold text-slate-800 capitalize truncate">
                  {{ reserva.usuarioNombreCompleto }}
                </p>
                <p class="text-xs text-slate-400">{{ reserva.bibliotecaNombre }}</p>
              </div>
              <span class="ml-auto text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 shrink-0">
                NOTIFICADA
              </span>
            </div>

            <!-- Libro / Ejemplar -->
            <div class="border border-slate-100 rounded-xl p-3 space-y-3">
              <!-- Info del libro -->
              <div class="flex items-center gap-3">
                <!-- Portada placeholder -->
                <div
                  class="w-10 h-14 rounded-lg border border-slate-100 bg-indigo-50 flex items-center justify-center shrink-0">
                  <svg class="w-5 h-5 text-indigo-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                      d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </div>
                <div class="flex-1 min-w-0">
                  <p class="font-semibold text-slate-800 text-sm leading-tight line-clamp-2">
                    {{ reserva.libroTitulo }}
                  </p>
                  <p v-if="reserva.ejemplarCodigo" class="text-xs text-slate-400 font-mono mt-0.5">
                    Ej: {{ reserva.ejemplarCodigo }}
                  </p>
                </div>
              </div>

              <!-- Condición al entregar -->
              <div>
                <p class="text-xs text-slate-500 font-semibold mb-2">Condición al entregar</p>
                <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button v-for="c in CONDICIONES" :key="c" @click="condicionEntrega = c" :class="['py-2 rounded-lg text-xs font-semibold border-2 transition-all',
                    condicionEntrega === c
                      ? condicionColors[c]
                      : 'border-slate-200 text-slate-500 hover:border-slate-300 bg-white']">
                    {{ c }}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- ── Formulario ────────────────────────────────────────────── -->
        <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-5">

          <!-- Documento de garantía -->
          <div>
            <label class="block text-sm font-semibold text-slate-700 mb-2">
              Documento de garantía <span class="text-red-400">*</span>
            </label>
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button v-for="t in TIPOS_DOC" :key="t.value" @click="tipoDocumento = t.value" :class="['py-2.5 px-3 rounded-xl border-2 text-xs font-semibold transition-all text-left',
                tipoDocumento === t.value
                  ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                  : 'border-slate-200 text-slate-500 hover:border-slate-300 bg-white']">
                {{ t.label }}
              </button>
            </div>
          </div>
          <div>
            <label class="block text-sm font-semibold text-slate-700 mb-1.5">
              Fecha de devolución estimada
              <span v-if="reglasActivas?.diasPrestamoMax" class="text-xs font-normal text-slate-400 ml-1">({{
                reglasActivas.diasPrestamoMax }} días según config)</span>
            </label>
            <input v-model="fechaDevolucion" type="date" :min="hoy"
              class="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-all" />
          </div>
          <!-- Observaciones -->
          <div>
            <label class="block text-sm font-semibold text-slate-700 mb-1.5">
              Observaciones <span class="text-xs font-normal text-slate-400">(opcional)</span>
            </label>
            <textarea v-model="observaciones" rows="2" placeholder="Notas adicionales sobre el estado del libro..."
              class="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl
                     focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-all resize-none
                     placeholder:text-slate-400" />
          </div>

          <!-- Error -->
          <div v-if="errorMsg"
            class="flex items-start gap-2 p-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600">
            <svg class="w-4 h-4 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            {{ errorMsg }}
          </div>
        </div>

        <!-- ── Acciones ───────────────────────────────────────────────── -->
        <div class="flex gap-3">
          <button @click="emit('close')" class="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold
                   hover:bg-slate-50 transition-colors">
            Cancelar
          </button>
          <button @click="confirmar" :disabled="enviando"
            class="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold
                   transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2">
            <svg v-if="enviando" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            {{ enviando ? 'Registrando…' : 'Confirmar entrega' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>