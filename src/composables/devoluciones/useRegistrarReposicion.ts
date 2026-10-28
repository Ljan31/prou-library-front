import { ref, type Ref } from 'vue'
import { useUiStore } from '@/stores/ui.store'
import { useSancionStore } from '@/stores/sancion.store'
import { getCodigoEjemplar } from '@/utils/devolucion.utils'
import type { Prestamo } from '@/types/devolucion.types'
import { useBibliotecaId } from '@/composables/useBibliotecaId'

/**
 * Pérdida del ejemplar → POST /sanciones/reposicion.
 * El backend marca el ejemplar como PERDIDO y notifica al usuario;
 * la sanción queda con resolución PENDIENTE.
 */
export function useRegistrarReposicion(prestamo: Ref<Prestamo | null>, onRegistrada?: () => void) {
  const ui = useUiStore()
  const sancionStore = useSancionStore()
  const bibliotecaId = useBibliotecaId()

  const open = ref(false)
  const monto = ref<string | number>('')
  const observaciones = ref('')
  const loading = ref(false)

  function abrir() {
    const p = prestamo.value
    console.log('p ', p)
    monto.value = ''
    observaciones.value = `Ejemplar perdido. Código: ${p ? getCodigoEjemplar(p) : ''}`
    open.value = true
  }

  async function confirmar() {
    const p = prestamo.value
    if (!p || loading.value) return

    const montoTxt = String(monto.value ?? '').trim()
    const montoNum = Number(montoTxt)
    if (montoTxt === '' || !Number.isFinite(montoNum) || montoNum < 0) {
      ui.toast.error('Monto inválido', 'Ingresa el valor de reposición del ejemplar')
      return
    }
    if (bibliotecaId.value === undefined) {
      ui.toast.error('Datos incompletos', 'No se pudo determinar la biblioteca')
      return
    }

    loading.value = true
    try {
      await sancionStore.registrarReposicion({
        prestamoId: p.id_prestamo,
        bibliotecaId: bibliotecaId.value,
        montoReposicion: montoNum,
        observaciones: observaciones.value || undefined,
      })
      open.value = false
      onRegistrada?.()
    } catch {
      /* el store ya notificó el error */
    } finally {
      loading.value = false
    }
  }

  return { open, monto, observaciones, loading, abrir, confirmar }
}
