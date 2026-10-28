import api from '@/services/axios'
import { sancionService } from '@/services/sancion.service'
import { ESTADOS_PENDIENTES } from '@/constants/devolucion.constants'
import type { EstadoSancionUsuario, SancionResponse } from '@/types/notificacion.types'
import type { DevolucionPayload, DevolucionResultado, Prestamo } from '@/types/devolucion.types'

/** El backend responde `{ data: ... }` o directamente el payload. */
const unwrap = <T>(res: { data: any }): T => res.data?.data ?? res.data

export const devolucionService = {
  /**
   * Préstamos ACTIVO / RENOVADO / VENCIDO.
   * Sin `bibliotecaId` trae los de todo el sistema (admin).
   */
  async listarPendientes(bibliotecaId?: number): Promise<Prestamo[]> {
    const responses = await Promise.all(
      ESTADOS_PENDIENTES.map(estado =>
        bibliotecaId === undefined
          ? api.get(`/prestamos/estado/${estado}`)
          : api.get(`/prestamos/biblioteca/${bibliotecaId}`, { params: { estado } }),
      ),
    )
    const todos = responses.flatMap(r => unwrap<Prestamo[]>(r) ?? [])
    return [...new Map(todos.map(p => [p.id_prestamo, p])).values()]
  },

  async obtenerPrestamo(id: number): Promise<Prestamo> {
    return unwrap<Prestamo>(await api.get(`/prestamos/${id}`))
  },

  /** Banderas consolidadas del usuario (suspensión, deuda). */
  async estadoSanciones(usuarioId: number, bibliotecaId?: number): Promise<EstadoSancionUsuario> {
    return unwrap<EstadoSancionUsuario>(
      await api.get(`/sanciones/usuario/${usuarioId}/estado`, { params: { bibliotecaId } }),
    )
  },

  /** Sanciones activas completas (incluye REPOSICION con su `resolucion`). */
  async sancionesActivas(usuarioId: number): Promise<SancionResponse[]> {
    return unwrap<SancionResponse[]>(await sancionService.sancionesActivas(usuarioId)) ?? []
  },

  async registrar(payload: DevolucionPayload): Promise<DevolucionResultado> {
    return unwrap<DevolucionResultado>(await api.post('/prestamos/devolucion', payload))
  },
}
