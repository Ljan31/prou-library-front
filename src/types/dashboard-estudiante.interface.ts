import type { PeriodoPrestamosDTO } from './dashboard.interface'

export interface PrestamoActivoDTO {
  idPrestamo: number
  idLibro: number
  titulo: string
  tipo: string                    // SALA | DOMICILIO
  estado: string                  // ACTIVO | RENOVADO | VENCIDO
  fechaPrestamo: string           // ISO yyyy-MM-dd
  fechaEstimadaDevolucion: string // ISO yyyy-MM-dd
  diasRestantes: number           // calculado en backend; negativo = días de retraso
  idBiblioteca: number
  nombreBiblioteca: string
}

export interface ReservaActivaDTO {
  idReserva: number
  idLibro: number
  titulo: string
  estado: string                  // ACTIVA | NOTIFICADA
  fechaReserva: string
  idBiblioteca: number
  nombreBiblioteca: string
}

export interface SancionActivaDTO {
  idPrestamo: number
  idSancion: number
  motivo: string
  fechaInicio: string
  fechaFin: string | null
  idBiblioteca: number
  nombreBiblioteca: string
  tituloLibro: string
}

export interface CertificadoNoDeudaDTO {
  habilitado: boolean
  motivo: string | null           // por qué no está habilitado (préstamos pendientes, sanción, etc.)
}

export interface EstudianteDashboardDTO {
  totalPrestamosActivos: number
  totalPrestamosVencidos: number
  totalPrestamosHistoricos: number
  totalReservasActivas: number
  totalSancionesActivas: number
  certificadoNoDeuda: CertificadoNoDeudaDTO

  prestamosActivos: PrestamoActivoDTO[]
  reservasActivas: ReservaActivaDTO[]
  sancionesActivas: SancionActivaDTO[]
  prestamosPorMes: PeriodoPrestamosDTO[] // últimos 6 meses, meses sin actividad = 0
}