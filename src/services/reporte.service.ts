/**
 * reporteService.ts
 * Centraliza todas las llamadas HTTP al módulo de Reportes de SIGEB.
 * Importar este servicio en los stores/composables — nunca llamar a api directamente.
 */

import api from '@/services/axios'

// ─── Tipos compartidos ────────────────────────────────────────────────────────

export interface PrestamoActivoDTO {
  idPrestamo: number
  estadoPrestamo: 'ACTIVO' | 'RENOVADO' | 'VENCIDO'
  tipoPrestamo: 'SALA' | 'DOMICILIO'
  fechaPrestamo: string
  fechaDevolucionEstimada: string
  vencido: boolean
  diasRestantes: number
  diasRetraso: number
  idUsuario: number
  nombreUsuario: string
  ci: string
  idEjemplar: number
  codigoEjemplar: string
  tituloLibro: string
  isbn: string
  editorial: string
  idBiblioteca: number
  nombreBiblioteca: string
  renovaciones: number
}

export interface PrestamosActivosResumen {
  fechaReporte: string
  totalRegistros: number
  soloActivos: number
  renovados: number
  yaVencidos: number
  vencenHoy: number
  diasVentana?: number | null
}

export interface PrestamosActivosResponse {
  resumen: PrestamosActivosResumen
  prestamos: PrestamoActivoDTO[]
}

// ─── Filtros ──────────────────────────────────────────────────────────────────

export interface PrestamoFiltroDTO {
  bibliotecaId?: number | null
  estado?: string | null
  fechaInicio?: string | null
  fechaFin?: string | null
}

export interface HistorialPrestamoFiltroDTO {
  bibliotecaId?: number | null
  usuarioId?: number | null
  libroId?: number | null
  estado?: string | null
  tipoPrestamo?: string | null
  fechaInicio?: string | null
  fechaFin?: string | null
}

export interface SancionFiltroDTO {
  bibliotecaId?: number | null
  usuarioId?: number | null
  tipo?: string | null
  estado?: string | null
  fechaInicio?: string | null
  fechaFin?: string | null
}

export interface CertificadoFiltroDTO {
  bibliotecaId?: number | null
  bibliotecarioId?: number | null
  estado?: string | null
  fechaInicio?: string | null
  fechaFin?: string | null
}

// ─── Servicio ─────────────────────────────────────────────────────────────────

export const reporteService = {

  // 1. Dashboard
  dashboard: (bibliotecaId?: number | null) =>
    api.get('/reportes/dashboard', {
      params: bibliotecaId ? { bibliotecaId } : {}
    }),

  // 2. Préstamos activos del día
  prestamosActivos: (bibliotecaId?: number | null) =>
    api.get('/reportes/prestamos-activos', {
      params: bibliotecaId ? { bibliotecaId } : {}
    }),

  // 3. Devoluciones pendientes vencidas
  devolucionesPendientes: (bibliotecaId?: number | null) =>
    api.get('/reportes/devoluciones-pendientes', {
      params: bibliotecaId ? { bibliotecaId } : {}
    }),

  // 4. Préstamos por vencer en N días
  prestamosPorVencer: (bibliotecaId?: number | null, dias = 3) =>
    api.get('/reportes/prestamos-por-vencer', {
      params: { ...(bibliotecaId ? { bibliotecaId } : {}), dias }
    }),

  // 5. Reporte general de préstamos
  prestamos: (filtro: PrestamoFiltroDTO) =>
    api.post('/reportes/prestamos', filtro),

  // 6. Historial avanzado de préstamos
  historialPrestamos: (filtro: HistorialPrestamoFiltroDTO) =>
    api.post('/reportes/prestamos/historial', filtro),

  // 7. Libros más prestados
  librosMasPrestados: (bibliotecaId?: number | null) =>
    api.get('/reportes/libros-mas-prestados', {
      params: bibliotecaId ? { bibliotecaId } : {}
    }),

  // 8. Libros menos prestados
  librosMenosPrestados: (bibliotecaId?: number | null) =>
    api.get('/reportes/libros-menos-prestados', {
      params: bibliotecaId ? { bibliotecaId } : {}
    }),

  // 9. Inventario de ejemplares
  inventario: (params: {
    bibliotecaId?: number | null
    categoriaId?: number | null
    estado?: string | null
    clasificacionDecimal?: string | null
  }) =>
    api.get('/reportes/inventario', {
      params: Object.fromEntries(
        Object.entries(params).filter(([, v]) => v != null && v !== '')
      )
    }),

  // 10. Estado de ejemplares por biblioteca
  estadoEjemplares: (bibliotecaId?: number | null) =>
    api.get('/reportes/estado-ejemplares', {
      params: bibliotecaId ? { bibliotecaId } : {}
    }),

  // 11. Deterioro físico de ejemplares
  deterioroEjemplares: (params: {
    bibliotecaId?: number | null
    fechaInicio?: string | null
    fechaFin?: string | null
  }) =>
    api.get('/reportes/deterioro-ejemplares', {
      params: Object.fromEntries(
        Object.entries(params).filter(([, v]) => v != null && v !== '')
      )
    }),

  // 12. Ejemplares sin circulación
  ejemplaresSinCirculacion: (bibliotecaId?: number | null) =>
    api.get('/reportes/ejemplares-sin-circulacion', {
      params: bibliotecaId ? { bibliotecaId } : {}
    }),

  // 13. Reporte de sanciones
  sanciones: (filtro: SancionFiltroDTO) =>
    api.post('/reportes/sanciones', filtro),

  // 14. Reporte de certificados de no deuda
  certificados: (filtro: CertificadoFiltroDTO) =>
    api.post('/reportes/certificados', filtro),
}