// src/types/auditoria.ts
export type AccionAuditoria = 'CREAR' | 'ACTUALIZAR' | 'ELIMINAR'

export interface ApiResponse<T> {
  success: boolean
  message: string | null
  data: T
}

export interface AuditoriaUsuario {
  id_usuario: number
  username: string | null
  nombreCompleto?: string | null
  email?: string | null
  ci?: string | null
}

/** Contrato de AuditoriaResponse. Todo campo puede venir null/ausente. */
export interface AuditoriaResponse {
  id_auditoria: number
  usuario: AuditoriaUsuario | null
  accion: string | null
  tablaAfectada: string | null
  id_registro: number | null
  valoresAnteriores: string | null
  valoresNuevos: string | null
  fechaHora: string | null
  ipAddress: string | null
}

/** Estado del formulario de filtros (todo como string/null para v-model). */
export interface AuditoriaFilters {
  usuarioId: number | null
  accion: '' | AccionAuditoria
  tabla: string
  idRegistro: string
  fechaInicio: string // yyyy-MM-dd (input type="date")
  fechaFin: string // yyyy-MM-dd
}

export type FilterErrors = Partial<Record<keyof AuditoriaFilters, string>>

export type AuditoriaEndpoint = 'registro' | 'fechas' | 'usuario' | 'tabla' | 'accion' | 'all'
