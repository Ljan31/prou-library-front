// src/services/auditoria.service.ts
// Solo consulta (GET). Reutiliza el cliente axios del proyecto: el JWT se adjunta
// y el 401 redirige a /login en sus interceptores. Aquí NO se toca ni registra el token.
import { isAxiosError, isCancel } from 'axios'
import api from '@/services/axios'
import type { AuditoriaResponse } from '@/types/auditoria'

const BASE = '/auditoria' // el prefijo /api lo aporta la baseURL de axios.ts

export type AuditoriaErrorKind = 'session' | 'forbidden' | 'network' | 'server' | 'client' | 'format'

export class AuditoriaServiceError extends Error {
  kind: AuditoriaErrorKind
  status?: number
  constructor(kind: AuditoriaErrorKind, message: string, status?: number) {
    super(message)
    this.name = 'AuditoriaServiceError'
    this.kind = kind
    this.status = status
  }
}

export interface RequestOptions {
  signal?: AbortSignal
}

export function isAbortError(e: unknown): boolean {
  return isCancel(e) || (e as { code?: string } | null)?.code === 'ERR_CANCELED'
}

function backendMessage(data: unknown): string | null {
  const m = (data as { message?: unknown } | null)?.message
  return typeof m === 'string' && m.trim() && m.length <= 200 ? m.trim() : null
}

export function toServiceError(e: unknown): AuditoriaServiceError {
  if (e instanceof AuditoriaServiceError) return e
  if (isAxiosError(e)) {
    const status = e.response?.status
    if (!e.response) return new AuditoriaServiceError('network', 'No se pudo conectar con el servidor. Revisa tu conexión.')
    if (status === 401) return new AuditoriaServiceError('session', 'Tu sesión expiró. Inicia sesión nuevamente.', 401)
    if (status === 403) return new AuditoriaServiceError('forbidden', 'No tienes permisos para consultar la auditoría.', 403)
    if (status && status >= 500) return new AuditoriaServiceError('server', 'El servidor no pudo procesar la consulta. Intenta de nuevo en unos minutos.', status)
    return new AuditoriaServiceError('client', backendMessage(e.response.data) ?? 'No se pudo completar la consulta.', status)
  }
  return new AuditoriaServiceError('server', 'Ocurrió un error inesperado al consultar la auditoría.')
}

/** Extrae `data` de ApiResponse<T> sin asumir la forma: acepta arreglo o página {content: []}. */
export function extractList(payload: unknown): AuditoriaResponse[] {
  let data: unknown = payload
  if (payload && typeof payload === 'object' && !Array.isArray(payload) && 'success' in payload) {
    const r = payload as { success: boolean; message: string | null; data: unknown }
    if (r.success === false) throw new AuditoriaServiceError('client', r.message?.trim() || 'La consulta no fue exitosa.')
    data = r.data
  }
  if (data === null || data === undefined) return []
  const list = Array.isArray(data) ? data : Array.isArray((data as { content?: unknown }).content) ? (data as { content: unknown[] }).content : null
  if (!list) throw new AuditoriaServiceError('format', 'La respuesta del servidor no tiene el formato esperado.')
  return list.filter((x): x is AuditoriaResponse => !!x && typeof x === 'object')
}

async function request(url: string, opts: RequestOptions = {}, params?: Record<string, string>) {
  try {
    const res = await api.get<unknown>(url, { signal: opts.signal, params })
    return extractList(res.data)
  } catch (e) {
    if (isAbortError(e)) throw e // lo gestiona quien cancela
    throw toServiceError(e)
  }
}

const seg = (v: string | number) => encodeURIComponent(String(v))

export const auditoriaService = {
  getAll: (o?: RequestOptions) => request(BASE, o),
  getByUsuario: (usuarioId: number, o?: RequestOptions) => request(`${BASE}/usuario/${seg(usuarioId)}`, o),
  getByTabla: (tabla: string, o?: RequestOptions) => request(`${BASE}/tabla/${seg(tabla)}`, o),
  getByRegistro: (tabla: string, idRegistro: string | number, o?: RequestOptions) =>
    request(`${BASE}/registro/${seg(tabla)}/${seg(idRegistro)}`, o),
  getByAccion: (accion: string, o?: RequestOptions) => request(`${BASE}/accion/${seg(accion)}`, o),
  // inicio/fin en ISO local sin zona, p. ej. 2026-10-01T00:00:00 (axios codifica los params)
  getByFechas: (inicio: string, fin: string, o?: RequestOptions) => request(`${BASE}/fechas`, o, { inicio, fin }),
}