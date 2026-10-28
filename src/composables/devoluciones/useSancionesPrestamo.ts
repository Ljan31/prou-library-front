import { computed, ref, type Ref } from 'vue'
import { devolucionService } from '@/services/devolucion.service'
import { esReposicion, montoSancion, reposicionPendiente } from '@/utils/sancion.utils'
import type { EstadoSancionUsuario, SancionResponse } from '@/types/notificacion.types'
import type { Prestamo, SancionPago } from '@/types/devolucion.types'
import { useBibliotecaId } from '@/composables/useBibliotecaId'

/**
 * Sanciones del usuario del préstamo seleccionado y reglas de bloqueo.
 *
 * Distingue dos sanciones del mismo préstamo:
 *  - `multa`: retraso / daño (tipo MULTA, SUSPENSION…). Se puede pagar o "proceder de todas formas".
 *  - `reposicion`: pérdida (tipo REPOSICION). Bloquea la devolución hasta resolverla
 *    por pago o por reposición física.
 */
export function useSancionesPrestamo(prestamo: Ref<Prestamo | null>) {
  const bibliotecaId = useBibliotecaId()

  const estado = ref<EstadoSancionUsuario | null>(null)
  const activas = ref<SancionResponse[]>([])
  const loading = ref(false)
  /** El bibliotecario decide continuar pese a la multa. */
  const omitirBloqueo = ref(false)

  // Evita que una respuesta lenta pise la de un préstamo seleccionado después
  let ultimaPeticion = 0

  async function cargar() {
    const usuarioId = prestamo.value?.usuario?.id_usuario
    const peticion = ++ultimaPeticion
    estado.value = null
    activas.value = []
    if (!usuarioId) {
      loading.value = false
      return
    }

    loading.value = true
    try {
      const [e, a] = await Promise.all([
        devolucionService.estadoSanciones(usuarioId, bibliotecaId.value),
        devolucionService.sancionesActivas(usuarioId),
      ])
      console.log('e: ', e)
      console.log('a: ', a)
      if (peticion === ultimaPeticion) {
        estado.value = e
        activas.value = a
      }
    } catch {
      /* sin datos: el formulario queda sin banners */
    } finally {
      if (peticion === ultimaPeticion) loading.value = false
    }
  }

  function reiniciar() {
    ultimaPeticion++
    estado.value = null
    activas.value = []
    loading.value = false
    omitirBloqueo.value = false
  }

  // ── Derivados ──
  const delPrestamo = computed(() => activas.value.filter(s => s.prestamoId === prestamo.value?.id_prestamo))

  const multa = computed(() => delPrestamo.value.find(s => !esReposicion(s)) ?? null)
  const reposicion = computed(() => delPrestamo.value.find(esReposicion) ?? null)

  /** Reposición activa y aún PENDIENTE de resolver (bloquea la devolución). */
  const reposicionBloqueante = computed(() => {
    const r = reposicion.value
    return r && reposicionPendiente(r) ? r : null
  })

  const requiereReposicion = computed(() => !!reposicionBloqueante.value)
  const bloqueoActivo = computed(() => !!multa.value && !omitirBloqueo.value)
  const formularioBloqueado = computed(() => requiereReposicion.value || bloqueoActivo.value)

  /** Adapta una sanción al formato que espera <ModalPago>. */
  function aSancionPago(s: SancionResponse): SancionPago {
    return {
      idSancion: s.idSancion,
      nombreUsuario: s.nombreUsuario,
      ciUsuario: s.ciUsuario,
      montoMulta: montoSancion(s), // reposición → montoReposicion
      tipoSancion: s.tipoSancion,
      estado: s.estado,
      fechaFinSuspension: s.fechaFinSuspension,
      observaciones: null,
    }
  }

  return {
    estado,
    loading,
    omitirBloqueo,
    multa,
    reposicion,
    reposicionBloqueante,
    requiereReposicion,
    bloqueoActivo,
    formularioBloqueado,
    cargar,
    reiniciar,
    aSancionPago,
  }
}
