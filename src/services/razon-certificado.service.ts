import api from '@/services/axios'

// ─── Types ────────────────────────────────────────────────────────────────────
export interface RazonCertificado {
  idRazon: number
  bibliotecaId: number | null
  nombre: string
  descripcion: string
  requisitos: string[]
  activo: boolean
}

export interface RazonCertificadoPayload {
  bibliotecaId: number | null
  nombre: string
  descripcion: string
  requisitos: string[]
  activo: boolean
}

// ─── Requisito labels ─────────────────────────────────────────────────────────
export const REQUISITO_LABELS: Record<string, string> = {
  cd: 'CD obligatorio',
  carta: 'Carta institucional',
  tesis: 'Documento de tesis',
}

export const REQUISITOS_DISPONIBLES = Object.keys(REQUISITO_LABELS)
export function mapRazon(dto: any): RazonCertificado { return { ...dto, requisitos: normalizeRequisitos(dto.requisitos) } }
function normalizeRequisitos(requisitos: any): string[] {
  if (Array.isArray(requisitos)) return requisitos

  if (typeof requisitos === 'string') {
    try {
      return JSON.parse(requisitos)
    } catch {
      return []
    }
  }

  return []
}
// ─── Service ──────────────────────────────────────────────────────────────────
export const razonCertificadoService = {
  getAll(): Promise<RazonCertificado[]> {
    return api.get('/razones-certificado').then(r => r.data?.data ?? r.data)
  },

  getByBiblioteca(bibliotecaId: number): Promise<RazonCertificado[]> {
    return api
      .get(`/razones-certificado/biblioteca/${bibliotecaId}`)
      .then(r => r.data?.data ?? r.data)
  },

  getById(id: number): Promise<RazonCertificado> {
    return api.get(`/razones-certificado/${id}`).then(r => r.data?.data ?? r.data)
  },

  create(payload: RazonCertificadoPayload): Promise<RazonCertificado> {
    return api.post('/razones-certificado', payload).then(r => r.data?.data ?? r.data)
  },

  update(id: number, payload: RazonCertificadoPayload): Promise<RazonCertificado> {
    return api.put(`/razones-certificado/${id}`, payload).then(r => r.data?.data ?? r.data)
  },

  delete(id: number): Promise<void> {
    return api.delete(`/razones-certificado/${id}`).then(() => undefined)
  },
}