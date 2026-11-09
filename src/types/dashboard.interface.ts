export interface PeriodoPrestamosDTO { anio: number; mes: number; cantidad: number }
export interface PrestamoEstadoDTO { estado: string; cantidad: number }
export interface LibroMasPrestadoDTO { idLibro: number; titulo: string; cantidad: number }
export interface PrestamoPorTipoDTO { tipo: string; cantidad: number }
export interface PrestamoPorBibliotecaDTO { bibliotecaId: number; biblioteca: string; cantidad: number }
export interface DevolucionPorMesDTO { anio: number; mes: number; puntuales: number; tardias: number }
export interface CondicionDevolucionDTO { condicion: string; cantidad: number }

export interface DashboardDTO {
  nombreBiblioteca: string | null

  totalLibros: number
  totalEjemplares: number
  totalPrestamosActivos: number
  totalPrestamosVencidos: number
  totalUsuarios: number | null // null = no disponible (NO convertir a 0)
  totalReservas: number
  totalSancionesActivas: number
  totalCertificadosEmitidos: number

  prestamosPorMes: PeriodoPrestamosDTO[]
  prestamosPorEstado: PrestamoEstadoDTO[]
  librosMasPrestados: LibroMasPrestadoDTO[]
  prestamosPorTipo: PrestamoPorTipoDTO[]
  prestamosPorBiblioteca: PrestamoPorBibliotecaDTO[]
  devolucionesPorMes: DevolucionPorMesDTO[]
  condicionDevoluciones: CondicionDevolucionDTO[]
}