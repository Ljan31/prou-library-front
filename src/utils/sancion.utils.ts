import type { SancionResponse } from '@/types/notificacion.types'

/** Una sanción de tipo REPOSICION es independiente de la multa por retraso. */
export const esReposicion = (s: Pick<SancionResponse, 'tipoSancion'>) =>
  s.tipoSancion === 'REPOSICION'

/**
 * Forma de resolución de la sanción. El backend la envía como `formaResolucion`
 * (`resolucion` se mantiene por compatibilidad con respuestas anteriores).
 */
export const resolucionDe = (s: Pick<SancionResponse, 'resolucion' | 'formaResolucion'>) =>
  s.formaResolucion ?? s.resolucion ?? null

/** Monto correcto según el tipo: reposición → montoReposicion, resto → montoMulta. */
export const montoSancion = (s: SancionResponse) =>
  esReposicion(s) ? (s.montoReposicion ?? 0) : (s.montoMulta ?? 0)

/** Reposición activa cuya forma de resolución aún está PENDIENTE. */
export const reposicionPendiente = (s: SancionResponse) =>
  esReposicion(s) && s.estado === 'ACTIVA' && resolucionDe(s) === 'PENDIENTE'

/** Reposición ya resuelta (pago o reposición física). */
export const reposicionResuelta = (s: SancionResponse) =>
  esReposicion(s) && resolucionDe(s) !== 'PENDIENTE'
/**
 * La deuda ya fue saldada. Una MULTA_Y_SUSPENSION pagada sigue ACTIVA mientras dure
 * la suspensión, por eso no basta con mirar `estado`: también cuenta `fechaPago`.
 */
export const estaPagada = (s: Pick<SancionResponse, 'estado' | 'fechaPago'>) =>
  s.estado === 'PAGADA' || !!s.fechaPago

/** Se puede pagar: activa, con monto, y (si es reposición) todavía pendiente. */
export const puedePagar = (s: SancionResponse) =>
  s.estado === 'ACTIVA' &&
  !estaPagada(s) &&
  montoSancion(s) > 0 &&
  (!esReposicion(s) || resolucionDe(s) === 'PENDIENTE')

export function formatFecha(f?: string | null) {
  if (!f) return '—'
  const [y, m, d] = f.split('T')[0].split('-')
  return `${d}/${m}/${y}`
}

export function formatFechaHora(f?: string | null) {
  if (!f) return '—'
  const [fecha, hora] = f.split('T')
  return hora ? `${formatFecha(fecha)} ${hora.slice(0, 5)}` : formatFecha(fecha)
}

export const formatMonto = (n?: number | null) => `Bs ${(n ?? 0).toFixed(2)}`

/** Etiquetas legibles de la forma de resolución (ajustar a los enums definitivos del backend). */
export const RESOLUCION_LABEL: Record<string, string> = {
  PENDIENTE: 'Pendiente',
  PAGO: 'Pagada en dinero',
  PAGADA: 'Pagada en dinero',
  REPOSICION_FISICA: 'Reposición física',
  CONDONADA: 'Condonada',
}