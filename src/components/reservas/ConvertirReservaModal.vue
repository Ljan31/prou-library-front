<script setup lang="ts">
/**
 * ConvertirReservaModal
 * Registra el retiro físico de una reserva NOTIFICADA y permite imprimir el ticket.
 * Reglas de negocio (tipo, fecha, sanciones, validación) vienen de usePrestamoRules,
 * las mismas que usa NuevoPrestamo.
 */
import { ref, computed, onMounted } from 'vue'
import { reservasService } from '@/services/reservas.service'
import { useUiStore } from '@/stores/ui.store'
import { useAuthStore } from '@/stores/auth.store'
import { usePrestamoRules } from '@/composables/usePrestamoRules'
import TicketPrestamo, {
  type Prestamo,
  type UsuarioTicket,
} from '@/components/bibliotecas/TicketPrestamo.vue'
import {
  CONDICIONES, CONDICION_COLORS, TIPOS_PRESTAMO, TIPOS_DOCUMENTO,
  type Condicion, type TipoDocumento,
} from '@/constants/prestamo.constants'
import type { ReservaResponse, ConvertirReservaPayload } from '@/types/reservas'

const props = defineProps<{ reserva: ReservaResponse }>()
const emit = defineEmits<{
  (e: 'close'): void
  (e: 'convertida'): void
}>()

const ui = useUiStore()
const auth = useAuthStore()

// ─── Reglas compartidas ─────────────────────────────────────────────────────
const {
  tipoPrestamo, reglasActivas, reglasSala, requiereFecha, hoy,
  fechaDevolucion, fechaDevolucionPayload, loadReglas, configLoading,
  loadSancion, sancionLoading, usuarioBloqueado, mensajeSancion, detalleSancion,
  validar,
} = usePrestamoRules({
  bibliotecaId: () => props.reserva?.bibliotecaId,
  tipoInicial: 'DOMICILIO',
})

onMounted(async () => {
  await Promise.all([
    loadReglas(),
    props.reserva.usuarioId ? loadSancion(props.reserva.usuarioId) : Promise.resolve(),
  ])
})


// ─── Formulario ─────────────────────────────────────────────────────────────
type DocSimple = Exclude<TipoDocumento, 'CI_Y_MATRICULA'>

const condicionEntrega = ref<Condicion>('BUENO')
const documentosSeleccionados = ref<DocSimple[]>([])
const observaciones = ref('')
const enviando = ref(false)
const errorMsg = ref<string | null>(null)

const inicialUsuario = (n: string) => n?.charAt(0)?.toUpperCase() ?? '?'

function toggleDocumento(tipo: DocSimple) {
  documentosSeleccionados.value = documentosSeleccionados.value.includes(tipo)
    ? documentosSeleccionados.value.filter(t => t !== tipo)
    : [...documentosSeleccionados.value, tipo]
}

const tipoDocumentoGarantia = computed<TipoDocumento | null>(() => {
  const d = documentosSeleccionados.value
  if (d.length === 2) return 'CI_Y_MATRICULA'
  return d[0] ?? null
})

const errores = computed(() =>
  validar({
    usuarioId: props.reserva.usuarioId,
    condiciones: [condicionEntrega.value],
    tipoDocumento: tipoDocumentoGarantia.value,   // ← antes se validaba un ref fijo en 'CI'
    fechaDevolucion: fechaDevolucion.value,
    cantidadEjemplares: 1,
  }),
)
const canConfirm = computed(() => !sancionLoading.value && !configLoading.value && errores.value.length === 0)
// ─── Ticket ─────────────────────────────────────────────────────────────────
const convertido = ref(false)
const showTicket = ref(false)
const prestamosParaTicket = ref<Prestamo[]>([])
const usuarioParaTicket = ref<UsuarioTicket | null>(null)

function construirTicket(respuesta: any) {
  // Tolera distintas formas de respuesta del backend
  const p = respuesta?.data?.data ?? respuesta?.data ?? respuesta ?? {}
  prestamosParaTicket.value = [p]
  const usr = p.usuario
  if (usr) {
    usuarioParaTicket.value = {
      id_usuario: usr.id_usuario ?? 0,
      persona: {
        nombreCompleto: usr.nombreCompleto ?? usr.username ?? '',
        ci: usr.ci ?? '',
        matricula: usr.matricula ?? null,
        domicilio: usr.domicilio,
        celular: usr.celular,
      },
    }
  }
}

// ─── Acción ─────────────────────────────────────────────────────────────────
async function confirmar() {
  const errs = errores.value
  if (errs.length) { errorMsg.value = errs[0]; return }

  enviando.value = true
  errorMsg.value = null
  try {
    const payload: ConvertirReservaPayload = {
      reservaId: props.reserva.idReserva,
      tipoPrestamo: tipoPrestamo.value,
      condicionEntrega: condicionEntrega.value,
      tipoDocumentoGarantia: tipoDocumentoGarantia.value!,
      observaciones: observaciones.value || undefined,
      fechaDevolucionEstimada: fechaDevolucionPayload.value!,
    }
    const respuesta = await reservasService.convertir(payload)
    construirTicket(respuesta)
    convertido.value = true
    ui.toast.success('Préstamo registrado', `"${props.reserva.libroTitulo}" entregado correctamente.`)
    showTicket.value = true // abre la vista previa; el usuario decide imprimir/descargar
  } catch (e: unknown) {
    const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
    errorMsg.value = msg ?? (e instanceof Error ? e.message : 'No se pudo registrar el retiro')
  } finally {
    enviando.value = false
  }
}

/** Si ya se convirtió, avisamos al padre solo al cerrar (para que no desmonte el ticket antes). */
function cerrar() {
  if (convertido.value) emit('convertida')
  else emit('close')
}
</script>

<template>
  <div class="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4"
    @click.self="cerrar">
    <div class="bg-slate-100 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[90vh] overflow-y-auto"
      role="dialog" aria-modal="true" aria-labelledby="convertir-title">

      <!-- Header -->
      <div class="bg-white px-6 pt-5 pb-4 border-b border-slate-200 flex items-start justify-between gap-3">
        <div>
          <p class="text-xs text-slate-400 font-medium uppercase tracking-wide">Registrar retiro</p>
          <h2 id="convertir-title" class="text-lg font-bold text-slate-900 mt-0.5">
            {{ convertido ? 'Entrega registrada' : 'Confirmar entrega' }}
          </h2>
        </div>
        <button @click="cerrar" aria-label="Cerrar"
          class="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors shrink-0">
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- ═══ ÉXITO ═══ -->
      <div v-if="convertido" class="p-5">
        <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center space-y-4">
          <div class="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
            <svg class="w-10 h-10 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <p class="text-lg font-bold text-slate-800">¡Préstamo registrado!</p>
            <p class="text-sm text-slate-500 mt-1 capitalize">{{ reserva.usuarioNombreCompleto }}</p>
            <p class="text-xs text-slate-400 mt-0.5 line-clamp-2">{{ reserva.libroTitulo }}</p>
          </div>
          <div class="flex flex-col sm:flex-row gap-3 justify-center">
            <button @click="showTicket = true"
              class="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-sm font-semibold transition-all flex items-center justify-center gap-2">
              🖨️ Imprimir ticket
            </button>
            <button @click="cerrar"
              class="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-all">
              Listo
            </button>
          </div>
        </div>
      </div>

      <!-- ═══ FORMULARIO ═══ -->
      <div v-else class="p-5 space-y-4">

        <!-- Tipo de préstamo -->
        <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <p class="text-sm font-semibold text-slate-700 mb-3">Tipo de préstamo <span class="text-red-400">*</span></p>
          <div class="grid grid-cols-2 gap-3">
            <button v-for="t in TIPOS_PRESTAMO" :key="t" type="button" @click="tipoPrestamo = t"
              :aria-pressed="tipoPrestamo === t"
              :class="['py-3 rounded-xl border-2 transition-all text-left px-4',
                tipoPrestamo === t ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 hover:border-slate-300 bg-white']">
              <div class="flex items-center gap-2 mb-1">
                <span class="text-lg">{{ t === 'DOMICILIO' ? '🏠' : '📖' }}</span>
                <span :class="['text-sm font-bold', tipoPrestamo === t ? 'text-indigo-700' : 'text-slate-700']">{{ t }}</span>
              </div>
              <p class="text-xs text-slate-400">
                <template v-if="t === 'DOMICILIO'">Para llevar a casa</template>
                <template v-else>{{ reglasSala?.ejemplaresPermitidos ? 'Sin límite de días' : 'Solo dentro de la biblioteca' }}</template>
              </p>
            </button>
          </div>
        </div>

        <!-- Resumen del retiro -->
        <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div class="px-5 py-3 border-b border-slate-100">
            <p class="text-sm font-semibold text-slate-700">Resumen del retiro</p>
          </div>
          <div class="p-4 space-y-3">

            <div :class="['flex items-center gap-3 p-3 rounded-xl', usuarioBloqueado ? 'bg-red-50' : 'bg-slate-50']">
              <div :class="['w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0',
                usuarioBloqueado ? 'bg-red-500' : 'bg-indigo-600']">
                {{ inicialUsuario(reserva.usuarioNombreCompleto) }}
              </div>
              <div class="min-w-0">
                <p class="text-sm font-semibold text-slate-800 capitalize truncate">{{ reserva.usuarioNombreCompleto }}</p>
                <p class="text-xs text-slate-400">{{ reserva.bibliotecaNombre }}</p>
              </div>
              <svg v-if="sancionLoading" class="ml-auto w-5 h-5 text-slate-400 animate-spin shrink-0" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
              <span v-else class="ml-auto text-xs font-bold px-2 py-0.5 rounded-full shrink-0"
                :class="usuarioBloqueado ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'">
                {{ usuarioBloqueado ? 'BLOQUEADO' : 'NOTIFICADA' }}
              </span>
            </div>

            <div v-if="usuarioBloqueado" role="alert"
              class="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
              <svg class="w-4 h-4 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div class="flex-1">
                <p class="font-semibold">{{ mensajeSancion }}</p>
                <p v-if="detalleSancion" class="text-xs mt-1 text-red-600">{{ detalleSancion }}</p>
                <p class="text-xs mt-1">Este usuario no puede retirar préstamos en este momento.</p>
              </div>
            </div>

            <div class="border border-slate-100 rounded-xl p-3 space-y-3">
              <div class="flex items-center gap-3">
                <div class="w-10 h-14 rounded-lg border border-slate-100 bg-indigo-50 flex items-center justify-center shrink-0">
                  <svg class="w-5 h-5 text-indigo-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                      d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </div>
                <div class="flex-1 min-w-0">
                  <p class="font-semibold text-slate-800 text-sm leading-tight line-clamp-2">{{ reserva.libroTitulo }}</p>
                  <p v-if="reserva.ejemplarCodigo" class="text-xs text-slate-400 font-mono mt-0.5">Ej: {{ reserva.ejemplarCodigo }}</p>
                </div>
              </div>

              <div>
                <p class="text-xs text-slate-500 font-semibold mb-2">Condición al entregar <span class="text-red-400">*</span></p>
                <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button v-for="c in CONDICIONES" :key="c" type="button" @click="condicionEntrega = c"
                    :aria-pressed="condicionEntrega === c"
                    :class="['py-2 rounded-lg text-xs font-semibold border-2 transition-all',
                      condicionEntrega === c ? CONDICION_COLORS[c] : 'border-slate-200 text-slate-500 hover:border-slate-300 bg-white']">
                    {{ c }}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Formulario -->
        <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-5">

          <div>
            <label class="block text-sm font-semibold text-slate-700 mb-2">
              Documento de garantía <span class="text-red-400">*</span>
            </label>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button v-for="t in TIPOS_DOCUMENTO" :key="t.value" type="button" @click="toggleDocumento(t.value)"
                :aria-pressed="documentosSeleccionados.includes(t.value)"
                :class="['py-2.5 px-3 rounded-xl border-2 text-xs font-semibold transition-all text-left',
                  documentosSeleccionados.includes(t.value)
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                    : 'border-slate-200 text-slate-500 hover:border-slate-300 bg-white']">
                {{ t.label }}
              </button>
            </div>
            <p class="text-xs text-slate-400 mt-2">Puedes seleccionar uno o ambos documentos.</p>
          </div>

          <div v-if="requiereFecha">
            <label for="fecha-dev" class="block text-sm font-semibold text-slate-700 mb-1.5">
              Fecha de devolución estimada
              <span v-if="reglasActivas?.diasPrestamoMax" class="text-xs font-normal text-slate-400 ml-1">
                ({{ reglasActivas.diasPrestamoMax }} días según config)
              </span>
            </label>
            <input id="fecha-dev" v-model="fechaDevolucion" type="date" :min="hoy"
              class="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-all" />
          </div>
          <div v-else
            class="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-sm text-emerald-700">
            Préstamo en sala — sin fecha límite de devolución
          </div>

          <div>
            <label for="obs" class="block text-sm font-semibold text-slate-700 mb-1.5">
              Observaciones <span class="text-xs font-normal text-slate-400">(opcional)</span>
            </label>
            <textarea id="obs" v-model="observaciones" rows="2" placeholder="Notas adicionales sobre el estado del libro..."
              class="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-all resize-none placeholder:text-slate-400" />
          </div>

          <div v-if="errorMsg" role="alert"
            class="flex items-start gap-2 p-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600">
            <svg class="w-4 h-4 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            {{ errorMsg }}
          </div>
        </div>

        <!-- Acciones -->
        <div class="flex gap-3">
          <button @click="cerrar"
            class="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition-colors">
            Cancelar
          </button>
          <button @click="confirmar" :disabled="!canConfirm || enviando"
            class="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2">
            <svg v-if="enviando" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            {{ enviando ? 'Registrando…' : 'Confirmar entrega' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Ticket (Teleport a body, queda encima del modal) -->
    <TicketPrestamo v-model="showTicket" :prestamos="prestamosParaTicket" :usuario="usuarioParaTicket"
      :tipo="tipoPrestamo" :fecha-devolucion="fechaDevolucion" :biblioteca-nombre="reserva.bibliotecaNombre" :logo="auth.user?.biblioteca?.[0]?.logoUrl"/>
  </div>
</template>