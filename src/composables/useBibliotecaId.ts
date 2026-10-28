import { computed } from 'vue'
import { useAuthStore } from '@/stores/auth.store'

/**
 * ID de la biblioteca activa del usuario.
 * Centraliza el acceso: `auth.user.biblioteca` puede ser un array o un objeto.
 */
export function useBibliotecaId() {
  const auth = useAuthStore()
  return computed<number | undefined>(() => {
    const b = auth.user?.biblioteca as unknown
    const first = Array.isArray(b) ? b[0] : b
    return (first as { id_biblioteca?: number } | undefined)?.id_biblioteca
  })
}
