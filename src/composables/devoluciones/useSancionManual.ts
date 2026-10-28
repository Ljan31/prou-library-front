import { ref, type Ref } from 'vue'
import { useUiStore } from '@/stores/ui.store'
import { useSancionStore } from '@/stores/sancion.store'
import type { Condicion } from '@/constants/devolucion.constants'
import type { Prestamo } from '@/types/devolucion.types'
import { useBibliotecaId } from '@/composables/useBibliotecaId'

/**
 * Sanción manual por DAÑO del ejemplar (multa).
 * La pérdida NO pasa por aquí: usa useRegistrarReposicion.
 * El store ya muestra los toasts de éxito y de error del backend.
 */
export function useSancionManual(
  prestamo: Ref<Prestamo | null>,
  getCondicionDevolucion: () => Condicion,
  onAplicada?: () => void,
) {
  const ui = useUiStore()
  const sancionStore = useSancionStore()
  const bibliotecaId = useBibliotecaId()

  const open = ref(false)
  const monto = ref<string | number>('')
  const observaciones = ref('')
  const loading = ref(false)

  function abrir() {
    monto.value = ''
    observaciones.value = `Ejemplar devuelto con daños. Condición entrega: ${prestamo.value?.condicionEntrega ?? 'N/D'
      } → Devolución: ${getCondicionDevolucion()}`
    open.value = true
  }

  async function confirmar() {
    const p = prestamo.value
    if (!p || loading.value) return

    const montoTxt = String(monto.value ?? '').trim()
    if (montoTxt !== '' && (!Number.isFinite(Number(montoTxt)) || Number(montoTxt) < 0)) {
      ui.toast.error('Monto inválido', 'Ingresa un monto válido')
      return
    }

    const usuarioId = p.usuario?.id_usuario
    if (!usuarioId || bibliotecaId.value === undefined) {
      ui.toast.error('Datos incompletos', 'No se pudo determinar el usuario o la biblioteca')
      return
    }

    loading.value = true
    try {
      await sancionStore.registrarManual({
        usuarioId,
        bibliotecaId: bibliotecaId.value,
        prestamoId: p.id_prestamo,
        motivo: 'DANIO_EJEMPLAR',
        montoFijo: montoTxt ? parseFloat(montoTxt) : null,
        observaciones: observaciones.value || undefined,
      })
      open.value = false
      onAplicada?.()
    } catch {
      /* el store ya notificó el error */
    } finally {
      loading.value = false
    }
  }

  return { open, monto, observaciones, loading, abrir, confirmar }
}
