import { computed, ref } from 'vue'
import { useAuthStore } from '@/stores/auth.store'
import { devolucionService } from '@/services/devolucion.service'
import {
  compararPorUrgencia,
  getApiMessage,
  getCiUsuario,
  getCodigoEjemplar,
  getNombreUsuario,
  getTitulo,
} from '@/utils/devolucion.utils'
import type { Prestamo } from '@/types/devolucion.types'
import { useBibliotecaId } from '@/composables/useBibliotecaId'

/** Lista de préstamos por devolver, según el rol del usuario. */
export function usePrestamosPendientes() {
  const auth = useAuthStore()
  const bibliotecaId = useBibliotecaId()

  const items = ref<Prestamo[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const search = ref('')

  async function cargar() {
    const roles = auth.user?.roles ?? []
    const esAdmin = roles.includes('ROLE_ADMIN')
    const esBiblio = roles.includes('ROLE_BIBLIOTECARIO') || roles.includes('ROLE_AUXILIAR')

    loading.value = true
    error.value = null
    try {
      let lista: Prestamo[] = []
      if (esAdmin) {
        lista = await devolucionService.listarPendientes()
      } else if (esBiblio && bibliotecaId.value !== undefined) {
        lista = await devolucionService.listarPendientes(bibliotecaId.value)
      }
      items.value = [...lista].sort(compararPorUrgencia)
    } catch (e) {
      items.value = []
      error.value = getApiMessage(e, 'No se pudieron cargar los préstamos pendientes')
    } finally {
      loading.value = false
    }
  }

  const filtrados = computed(() => {
    const q = search.value.trim().toLowerCase()
    if (!q) return items.value
    return items.value.filter(p =>
      [getTitulo(p), getNombreUsuario(p), getCodigoEjemplar(p), getCiUsuario(p), String(p.id_prestamo)]
        .some(campo => campo.toLowerCase().includes(q)),
    )
  })

  return { items, filtrados, loading, error, search, cargar }
}
