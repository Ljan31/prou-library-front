// ─── Condición física del ejemplar ───────────────────────────────────────────
export const CONDICIONES = ['EXCELENTE', 'BUENO', 'REGULAR', 'DAÑADO'] as const
export type Condicion = (typeof CONDICIONES)[number]
export const CONDICION_DEFAULT: Condicion = 'BUENO'

/** Mientras mayor el número, peor condición. Sirve para detectar deterioro. */
export const ORDEN_CONDICION: Record<Condicion, number> = {
  EXCELENTE: 0,
  BUENO: 1,
  REGULAR: 2,
  DAÑADO: 3,
}

// ─── Estado del ejemplar ─────────────────────────────────────────────────────
export const ESTADOS_EJEMPLAR = ['DISPONIBLE', 'DETERIORADO', 'DAÑADO', 'PERDIDO'] as const
export type EstadoEjemplar = (typeof ESTADOS_EJEMPLAR)[number]

/** Estado que se sugiere automáticamente según la condición elegida. */
export const ESTADO_EJEMPLAR_SUGERIDO: Record<Condicion, EstadoEjemplar> = {
  EXCELENTE: 'DISPONIBLE',
  BUENO: 'DISPONIBLE',
  REGULAR: 'DETERIORADO',
  DAÑADO: 'DAÑADO',
}

export const ESTADO_EJEMPLAR_LABEL: Record<EstadoEjemplar, string> = {
  DISPONIBLE: '✓ DISPONIBLE',
  DETERIORADO: '⚠ DETERIORADO',
  DAÑADO: '✗ DAÑADO',
  PERDIDO: '⊘ PERDIDO',
}

// ─── Préstamos pendientes de devolución ──────────────────────────────────────
export const ESTADOS_PENDIENTES = ['ACTIVO', 'RENOVADO', 'VENCIDO'] as const

// ─── Sanciones ───────────────────────────────────────────────────────────────
export type MotivoSancion = 'DANIO_EJEMPLAR' | 'PERDIDA_EJEMPLAR'

// ─── Clases de color (Tailwind) ──────────────────────────────────────────────
export const CONDICION_CLASSES: Record<Condicion, string> = {
  EXCELENTE: 'border-emerald-500 bg-emerald-50 text-emerald-700',
  BUENO: 'border-blue-500 bg-blue-50 text-blue-700',
  REGULAR: 'border-amber-500 bg-amber-50 text-amber-700',
  DAÑADO: 'border-red-500 bg-red-50 text-red-700',
}

export const CONDICION_TEXT: Record<Condicion, string> = {
  EXCELENTE: 'text-emerald-600',
  BUENO: 'text-blue-600',
  REGULAR: 'text-amber-600',
  DAÑADO: 'text-red-600',
}

export const ESTADO_EJEMPLAR_CLASSES: Record<EstadoEjemplar, string> = {
  DISPONIBLE: 'border-emerald-500 bg-emerald-50 text-emerald-700',
  DETERIORADO: 'border-amber-500 bg-amber-50 text-amber-700',
  DAÑADO: 'border-red-500 bg-red-50 text-red-700',
  PERDIDO: 'border-slate-500 bg-slate-100 text-slate-700',
}
