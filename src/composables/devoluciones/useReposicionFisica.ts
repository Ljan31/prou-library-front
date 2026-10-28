import { ref } from 'vue'
import { useSancionStore } from '@/stores/sancion.store'
import type { SancionResponse } from '@/types/notificacion.types'

/** Resuelve una reposición PENDIENTE con un ejemplar físico de reemplazo. */
export function useReposicionFisica(getSancion: () => SancionResponse | null, onResuelta?: () => void) {
  const sancionStore = useSancionStore()

  const open = ref(false)
  const observaciones = ref('')
  const loading = ref(false)

  function abrir() {
    observaciones.value = ''
    open.value = true
  }

  async function confirmar() {
    const sancion = getSancion()
    if (!sancion || loading.value) return

    loading.value = true
    try {
      await sancionStore.registrarReposicionFisica(sancion.idSancion, {
        observaciones: observaciones.value || undefined,
      })
      open.value = false
      onResuelta?.()
    } catch {
      /* el store ya notificó el error */
    } finally {
      loading.value = false
    }
  }

  return { open, observaciones, loading, abrir, confirmar }
}
