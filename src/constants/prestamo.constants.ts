// Fuente única de constantes compartidas por NuevoPrestamo y ConvertirReservaModal.

export const CONDICIONES = ['EXCELENTE', 'BUENO', 'REGULAR', 'DAÑADO'] as const
export type Condicion = typeof CONDICIONES[number]

export const TIPOS_PRESTAMO = ['DOMICILIO', 'SALA'] as const
export type TipoPrestamo = typeof TIPOS_PRESTAMO[number]

export const TIPOS_DOCUMENTO: { value: Exclude<TipoDocumento, 'CI_Y_MATRICULA'>; label: string }[] = [
  { value: 'CI', label: '🪪 Carnet de Identidad' },
  { value: 'MATRICULA', label: '🎓 Matrícula' },
]
export type TipoDocumento = 'CI' | 'MATRICULA' | 'CI_Y_MATRICULA'

export const CONDICION_COLORS: Record<Condicion, string> = {
  EXCELENTE: 'border-emerald-500 bg-emerald-50 text-emerald-700',
  BUENO: 'border-indigo-500 bg-indigo-50 text-indigo-700',
  REGULAR: 'border-amber-500 bg-amber-50 text-amber-700',
  DAÑADO: 'border-red-500 bg-red-50 text-red-700',
}

export const DIAS_PRESTAMO_DEFAULT = 14
export const MAX_EJEMPLARES_DEFAULT = 5

export interface ReglasConfig {
  idConfig: number
  diasPrestamoMax: number | null
  renovacionesMax: number | null
  ejemplaresPermitidos: number | null
  multaPorDia: number | null
  multaMaxDias: number | null
  diasSuspension: number | null
}

export interface EstadoSancion {
  usuarioId: number
  tieneSuspensionVigente: boolean
  tieneDeudaPendiente: boolean
  tieneReposicionPendiente: boolean
  totalSancionesActivas: number
  fechaFinSuspensionMasProxima: string | null
}