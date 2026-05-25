// src/services/solicitudes-certificado.service.ts
import api from '@/services/axios'

export type EstadoSolicitud = 'PENDIENTE' | 'APROBADA' | 'RECHAZADA'

export interface SolicitudCertificado {
  id: number
  nombres: string
  apellidos: string
  ci: string
  matricula: string
  email: string
  telefono: string
  bibliotecaId: number
  bibliotecaNombre: string
  razonId: number
  razonNombre: string
  requisitos: string
  descripcion: string
  estado: EstadoSolicitud
  fechaSolicitud: string
  fechaRespuesta: string | null
  observacionRespuesta: string | null
  atendidoPorId: number | null
  atendidoPorNombre: string | null
}

export interface CrearSolicitudPayload {
  bibliotecaId: number
  nombres: string
  apellidos: string
  ci: string
  matricula: string
  razonCertificadoId: number
  descripcion?: string
  email?: string
  telefono?: string
}

export interface PageResponse<T> {
  content: T[]
  totalElements: number
  totalPages: number
  number: number
  size: number
}

const SolicitudesCertificadoService = {
  /** POST /api/solicitudes-certificado — permitAll */
  crear(payload: CrearSolicitudPayload): Promise<SolicitudCertificado> {
    return api
      .post('/solicitudes-certificado', payload)
      .then(r => r.data?.data ?? r.data)
  },

  /** GET /api/solicitudes-certificado/mis-solicitudes — ESTUDIANTE */
  misSolicitudes(page = 0, size = 10): Promise<PageResponse<SolicitudCertificado>> {
    return api
      .get('/solicitudes-certificado/mis-solicitudes', { params: { page, size } })
      .then(r => r.data?.data ?? r.data)
  },

  /** GET /api/solicitudes-certificado/biblioteca/{id} — ADMIN, BIBLIOTECARIO */
  porBiblioteca(
    bibliotecaId: number,
    estado?: EstadoSolicitud | '',
  ): Promise<SolicitudCertificado[]> {
    return api
      .get(`/solicitudes-certificado/biblioteca/${bibliotecaId}`, {
        params: estado ? { estado } : {},
      })
      .then(r => r.data?.data ?? r.data ?? [])
  },

  /** GET /api/solicitudes-certificado/todas — ADMIN paginado */
  todas(page = 0, size = 10): Promise<PageResponse<SolicitudCertificado>> {
    return api
      .get('/solicitudes-certificado/todas', { params: { page, size } })
      .then(r => r.data?.data ?? r.data)
  },

  /** GET /api/solicitudes-certificado/{id} */
  detalle(id: number): Promise<SolicitudCertificado> {
    return api
      .get(`/solicitudes-certificado/${id}`)
      .then(r => r.data?.data ?? r.data)
  },

  /** PATCH /api/solicitudes-certificado/{id}/aprobar */
  aprobar(id: number, observacion?: string): Promise<SolicitudCertificado> {
    return api
      .patch(`/solicitudes-certificado/${id}/aprobar`, null, {
        params: observacion ? { observacion } : {},
      })
      .then(r => r.data?.data ?? r.data)
  },

  /** PATCH /api/solicitudes-certificado/{id}/rechazar */
  rechazar(id: number, observacion: string): Promise<SolicitudCertificado> {
    return api
      .patch(`/solicitudes-certificado/${id}/rechazar`, null, {
        params: { observacion },
      })
      .then(r => r.data?.data ?? r.data)
  },
}

export default SolicitudesCertificadoService