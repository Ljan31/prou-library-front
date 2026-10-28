import type { Prestamo } from '@/types/devolucion.types'

const MS_POR_DIA = 86_400_000

export function formatDate(s?: string) {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('es-BO', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function diasVencido(fecha?: string): number {
  if (!fecha) return 0
  return Math.floor((Date.now() - new Date(fecha).getTime()) / MS_POR_DIA)
}

/** `vencido` lo calcula el backend; el estado VENCIDO también cuenta. */
export const esVencido = (p: Prestamo) => p.vencido || p.estadoPrestamo === 'VENCIDO'

export const getTitulo = (p: Prestamo, fallback = '') =>
  p.ejemplar?.edicion?.titulo ?? p.ejemplar?.libro?.titulo ?? fallback

export const getCodigoEjemplar = (p: Prestamo) =>
  p.ejemplar?.codigoEjemplar ?? p.ejemplar?.codigo_ejemplar ?? ''

export const getNombreUsuario = (p: Prestamo) =>
  p.usuario?.persona?.nombreCompleto ?? p.usuario?.nombreCompleto ?? p.usuario?.username ?? ''

export const getCiUsuario = (p: Prestamo) =>
  String(p.usuario?.ci ?? p.usuario?.persona?.ci ?? '')

/** Vencidos primero; luego por id. */
export function compararPorUrgencia(a: Prestamo, b: Prestamo) {
  const va = esVencido(a)
  const vb = esVencido(b)
  if (va !== vb) return va ? -1 : 1
  return a.id_prestamo - b.id_prestamo
}

/** Extrae el mensaje de error del backend (`message` o `error`). */
export function getApiMessage(err: unknown, fallback: string): string {
  const data = (err as { response?: { data?: { message?: string; error?: string } } })?.response?.data
  return data?.message ?? data?.error ?? fallback
}
export const getBibliotecaIdPrestamo = (p: Prestamo): number | undefined =>
  p.biblioteca?.id_biblioteca ?? p.biblioteca?.id
