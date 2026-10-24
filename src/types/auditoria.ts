// src/types/auditoria.ts
export type AccionAuditoria = AccionAuditoriaValor

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


export const ACCIONES_AUDITORIA = [
  // Operaciones sobre registros
  {
    value: 'CREAR',
    label: 'Creaciones',
    group: 'Operaciones sobre registros',
  },
  {
    value: 'ACTUALIZAR',
    label: 'Modificaciones',
    group: 'Operaciones sobre registros',
  },
  {
    value: 'ELIMINAR',
    label: 'Eliminaciones',
    group: 'Operaciones sobre registros',
  },
  {
    value: 'CAMBIAR',
    label: 'Cambios',
    group: 'Operaciones sobre registros',
  },

  // Gestión de biblioteca
  {
    value: 'ASIGNAR_ENCARGADO_BIBLIOTECA',
    label: 'Asignación de encargado',
    group: 'Gestión de biblioteca',
  },
  {
    value: 'REMOVER_ENCARGADO',
    label: 'Retirada de encargado',
    group: 'Gestión de biblioteca',
  },

  // Ejemplares
  {
    value: 'DARBAJA_EJEMPLAR',
    label: 'Bajas de ejemplares',
    group: 'Ejemplares',
  },
  {
    value: 'REPORTAR_DANADO_EJEMPLAR',
    label: 'Reportes de daños',
    group: 'Ejemplares',
  },

  // Préstamos y reservas
  {
    value: 'CONVERTIR_RESERVA_PRESTAMO',
    label: 'Reservas convertidas en préstamos',
    group: 'Préstamos y reservas',
  },

  // Certificados
  {
    value: 'SUBIR_PLANTILLA_CERTIFICADO',
    label: 'Carga de plantillas',
    group: 'Certificados',
  },
  {
    value: 'APROBAR_SOLICITUD_CERTIFICADO',
    label: 'Solicitudes aprobadas',
    group: 'Certificados',
  },
  {
    value: 'RECHAZAR_SOLICITUD_CERTIFICADO',
    label: 'Solicitudes rechazadas',
    group: 'Certificados',
  },

  // Otras operaciones
  {
    value: 'ANULAR',
    label: 'Anulaciones',
    group: 'Otras operaciones',
  },
  {
    value: 'RESTABLECER',
    label: 'Restablecimientos',
    group: 'Otras operaciones',
  },
  {
    value: 'SANCIONAR',
    label: 'Sanciones',
    group: 'Otras operaciones',
  },
  {
    value: 'RENOVAR',
    label: 'Renovaciones',
    group: 'Otras operaciones',
  },
] as const

export type AccionAuditoriaValor =
  (typeof ACCIONES_AUDITORIA)[number]['value']
export type FilterErrors = Partial<Record<keyof AuditoriaFilters, string>>

export type AuditoriaEndpoint = 'registro' | 'fechas' | 'usuario' | 'tabla' | 'accion' | 'all'
