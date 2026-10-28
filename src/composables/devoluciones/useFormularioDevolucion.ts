import { computed, ref, toValue, watch, type MaybeRefOrGetter, type Ref } from 'vue'
import { useUiStore } from '@/stores/ui.store'
import { devolucionService } from '@/services/devolucion.service'
import {
  CONDICION_DEFAULT,
  CONDICIONES,
  ESTADO_EJEMPLAR_SUGERIDO,
  ORDEN_CONDICION,
  type Condicion,
  type EstadoEjemplar,
} from '@/constants/devolucion.constants'
import { getApiMessage } from '@/utils/devolucion.utils'
import type { DevolucionResultado, Prestamo } from '@/types/devolucion.types'

type DecisionSancion = 'APLICADA' | 'OMITIDA' | null

/**
 * Formulario de devolución: campos, reglas derivadas y envío.
 * @param bloqueado  true cuando una sanción impide confirmar (ver useSancionesPrestamo)
 * @param onRegistrada  se ejecuta tras registrar con éxito (p. ej. refrescar la lista)
 */
export function useFormularioDevolucion(
  prestamo: Ref<Prestamo | null>,
  bloqueado: MaybeRefOrGetter<boolean>,
  onRegistrada?: () => void,
) {
  const ui = useUiStore()

  // ── Campos ──
  const condicion = ref<Condicion>(CONDICION_DEFAULT)
  const estadoEjemplar = ref<EstadoEjemplar>('DISPONIBLE')
  const observaciones = ref('')

  // ── Envío ──
  const loading = ref(false)
  const error = ref<string | null>(null)
  const success = ref(false)
  const resultado = ref<DevolucionResultado | null>(null)

  // ── Decisión sobre sanción por deterioro/pérdida ──
  const decisionTomada = ref(false)
  const decisionTipo = ref<DecisionSancion>(null)

  // ── Derivados ──
  const hayDeterioro = computed(() => {
    const entrega = prestamo.value?.condicionEntrega as Condicion | undefined
    if (!entrega || !(entrega in ORDEN_CONDICION)) return false
    return ORDEN_CONDICION[condicion.value] > ORDEN_CONDICION[entrega]
  })

  const ejemplarPerdido = computed(() => estadoEjemplar.value === 'PERDIDO')

  const requiereSancion = computed(
    () => condicion.value === 'REGULAR' || condicion.value === 'DAÑADO' || estadoEjemplar.value !== 'DISPONIBLE',
  )

  const puedeConfirmar = computed(
    () =>
      !!prestamo.value &&
      !toValue(bloqueado) &&
      (!requiereSancion.value || decisionTomada.value) &&
      !loading.value,
  )

  // ── Reacciones ──
  watch(condicion, c => {
    estadoEjemplar.value = ESTADO_EJEMPLAR_SUGERIDO[c]
  })
  watch([condicion, estadoEjemplar], resetDecision)

  // ── Acciones ──
  function resetDecision() {
    decisionTomada.value = false
    decisionTipo.value = null
  }

  function omitirSancion() {
    decisionTomada.value = true
    decisionTipo.value = 'OMITIDA'
  }

  function marcarSancionAplicada() {
    decisionTomada.value = true
    decisionTipo.value = 'APLICADA'
  }

  /** Prepara el formulario para un préstamo recién seleccionado. */
  function reiniciar(p: Prestamo) {
    const entrega = p.condicionEntrega as Condicion | undefined
    // Sugerimos la misma condición con que se entregó
    condicion.value = entrega && CONDICIONES.includes(entrega) ? entrega : CONDICION_DEFAULT
    estadoEjemplar.value = ESTADO_EJEMPLAR_SUGERIDO[condicion.value]
    observaciones.value = ''
    limpiarMensajes()
    resultado.value = null
    resetDecision()
  }

  function limpiarMensajes() {
    error.value = null
    success.value = false
  }

  async function confirmar() {
    const p = prestamo.value
    if (!puedeConfirmar.value || !p) return

    loading.value = true
    error.value = null
    success.value = false
    try {
      resultado.value = await devolucionService.registrar({
        prestamoId: p.id_prestamo,
        condicionDevolucion: condicion.value,
        estadoEjemplar: estadoEjemplar.value,
        observaciones: observaciones.value || 'Devolución registrada',
      })
      success.value = true
      ui.toast.success('Devuelto', 'La devolución fue registrada correctamente')
      onRegistrada?.()
    } catch (e) {
      error.value = getApiMessage(e, 'No se pudo registrar la devolución')
      ui.toast.error('Error', error.value)
    } finally {
      loading.value = false
    }
  }

  return {
    condicion,
    estadoEjemplar,
    observaciones,
    loading,
    error,
    success,
    resultado,
    decisionTomada,
    decisionTipo,
    hayDeterioro,
    ejemplarPerdido,
    requiereSancion,
    puedeConfirmar,
    reiniciar,
    limpiarMensajes,
    omitirSancion,
    marcarSancionAplicada,
    confirmar,
  }
}
