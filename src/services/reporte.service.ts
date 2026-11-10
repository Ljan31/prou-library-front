/**
 * reporteService.ts
 * Centraliza todas las llamadas HTTP al módulo de Reportes de SIGEB.
 * Importar este servicio en los stores/composables — nunca llamar a api directamente.
 *
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
  /** El backend aún no lo envía (Edicion no expone ISBN). Opcional hasta agregarlo. */
  isbn?: string | null
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

// ─── Gráficos ─────────────────────────────────────────────────────────────────

export type TipoGrafico =
  | 'LINEA'
  | 'BARRAS'
  | 'BARRAS_HORIZONTALES'
  | 'BARRAS_APILADAS'
  | 'DONA'

export interface SerieGraficoDTO {
  nombre: string
  /** valores[i] corresponde a GraficoDTO.etiquetas[i] */
  valores: number[]
}

export interface GraficoDTO {
  /** Estable, p. ej. 'prestamos-por-mes'. Usar como key y para nombrar la imagen del PDF. */
  id: string
  titulo: string
  tipoSugerido: TipoGrafico
  /** Qué cuentan los valores: 'préstamos', 'ejemplares', 'sanciones', 'monto'. */
  unidad: string
  etiquetas: string[]
  /** DONA siempre trae exactamente una serie. */
  series: SerieGraficoDTO[]
  total: number
  /** true → no dibujar; mostrar estado vacío. */
  sinDatos: boolean
}

export interface DashboardGraficosDTO {
  prestamosPorMes: GraficoDTO
  librosMasPrestados: GraficoDTO
  prestamosPorEstado: GraficoDTO
  vencidosPorTramo: GraficoDTO
  estadoEjemplares: GraficoDTO
}

/** Filtros comunes de los gráficos. Mismos valores que el reporte al que acompañan. */
export interface GraficoFiltro {
  bibliotecaId?: number | null
  /** yyyy-MM-dd. Vacío = sin límite inferior. */
  fechaInicio?: string | null
  /** yyyy-MM-dd. Vacío = sin límite superior. */
  fechaFin?: string | null
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

// ─── Utilidades ───────────────────────────────────────────────────────────────

/** Quita null / undefined / '' para no mandar "?estado=" vacío al backend. */
const soloConValor = (params: Record<string, unknown>) =>
  Object.fromEntries(
    Object.entries(params).filter(([, v]) => v != null && v !== '')
  )

// ─── Servicio ─────────────────────────────────────────────────────────────────

export const reporteService = {

  // 1. Dashboard (totales)
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
    api.get('/reportes/inventario', { params: soloConValor(params) }),

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
    api.get('/reportes/deterioro-ejemplares', { params: soloConValor(params) }),

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

  // ─── 15. GRÁFICOS ───────────────────────────────────────────────────────────
  // Todos devuelven ApiResponse<GraficoDTO> (res.data.data) salvo `dashboard`.
  // Ver el CONTRATO al inicio de este archivo (secciones 1-7).
  graficos: {

    /** Los 5 gráficos del dashboard del bibliotecario en una sola petición. → DashboardGraficosDTO */
    dashboard: (bibliotecaId?: number | null) =>
      api.get('/reportes/graficos/dashboard', { params: soloConValor({ bibliotecaId }) }),

    /**
     * LINEA — préstamos por mes. Ya trae los meses sin préstamos en cero.
     * Reportes: prestamos (con estado), historial (con estado y tipoPrestamo).
     */
    prestamosPorMes: (f: GraficoFiltro & { estado?: string | null; tipoPrestamo?: string | null }) =>
      api.get('/reportes/graficos/prestamos-por-mes', { params: soloConValor({ ...f }) }),

    /** DONA — préstamos por estado. Reporte: prestamos. Acepta `tipoPrestamo` ('SALA' | 'DOMICILIO'). */
    prestamosPorEstado: (f: GraficoFiltro & { tipoPrestamo?: string | null }) =>
      api.get('/reportes/graficos/prestamos-por-estado', { params: soloConValor({ ...f }) }),

    /** DONA — sala vs domicilio. Reporte: prestamos. Acepta `estado`. */
    prestamosPorTipo: (f: GraficoFiltro & { estado?: string | null }) =>
      api.get('/reportes/graficos/prestamos-por-tipo', { params: soloConValor({ ...f }) }),

    /**
     * BARRAS_HORIZONTALES — top N libros más prestados. Reporte: libros-mas-prestados.
     * `limite` 1-50 (default 10). Títulos largos: truncar con tooltip.
     */
    librosMasPrestados: (f: GraficoFiltro & { limite?: number }) =>
      api.get('/reportes/graficos/libros-mas-prestados', { params: soloConValor({ ...f }) }),

    /** BARRAS_HORIZONTALES — top N menos prestados (con ≥1 préstamo). Reporte: libros-menos-prestados. */
    librosMenosPrestados: (f: GraficoFiltro & { limite?: number }) =>
      api.get('/reportes/graficos/libros-menos-prestados', { params: soloConValor({ ...f }) }),

    /** BARRAS_HORIZONTALES — préstamos por área temática (clase Dewey). Reporte: libros-mas-prestados. */
    prestamosPorArea: (f: GraficoFiltro) =>
      api.get('/reportes/graficos/prestamos-por-area', { params: soloConValor({ ...f }) }),

    /** BARRAS — devoluciones vencidas por tramo de retraso (foto de HOY, sin fechas). Reporte: devoluciones-pendientes. */
    vencidosPorTramo: (bibliotecaId?: number | null) =>
      api.get('/reportes/graficos/vencidos-por-tramo', { params: soloConValor({ bibliotecaId }) }),

    /**
     * BARRAS_APILADAS (varias bibliotecas) o DONA (una sola) — estado de ejemplares.
     * Reportes: inventario, estado-ejemplares. Sin fechas.
     */
    estadoEjemplares: (bibliotecaId?: number | null) =>
      api.get('/reportes/graficos/estado-ejemplares', { params: soloConValor({ bibliotecaId }) }),

    /** BARRAS — monto de sanciones por estado (ACTIVA = pendiente, PAGADA = cobrado). Reporte: sanciones. */
    sancionesMontos: (f: GraficoFiltro) =>
      api.get('/reportes/graficos/sanciones-montos', { params: soloConValor({ ...f }) }),

    /** DONA — sanciones por tipo (MULTA, SUSPENSION, MULTA_Y_SUSPENSION). Reporte: sanciones. */
    sancionesPorTipo: (f: GraficoFiltro) =>
      api.get('/reportes/graficos/sanciones-por-tipo', { params: soloConValor({ ...f }) }),
  },
}