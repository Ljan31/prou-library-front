import { ref } from 'vue'
import { devolucionService } from '@/services/devolucion.service'
import type { Prestamo } from '@/types/devolucion.types'

/** Búsqueda de un préstamo por ID. Devuelve el préstamo o `null`. */
export function useBuscarPrestamo() {
  const id = ref<string | number>('')
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function buscar(): Promise<Prestamo | null> {
    const n = parseInt(String(id.value))
    if (!n) return null

    loading.value = true
    error.value = null
    try {
      const prestamo = await devolucionService.obtenerPrestamo(n)
      if (prestamo.estadoPrestamo === 'DEVUELTO') {
        error.value = 'Este préstamo ya fue devuelto'
        return null
      }
      return prestamo
    } catch {
      error.value = 'No se encontró un préstamo activo con ese ID'
      return null
    } finally {
      loading.value = false
    }
  }

  function limpiar() {
    id.value = ''
    error.value = null
  }

  return { id, loading, error, buscar, limpiar }
}
