export type TipoReporte =
  | 'prestamos-activos'
  | 'devoluciones-pendientes'
  | 'prestamos-por-vencer'
  | 'prestamos'
  | 'historial'
  | 'libros-mas-prestados'
  | 'libros-menos-prestados'
  | 'inventario'
  | 'estado-ejemplares'
  | 'deterioro-ejemplares'
  | 'ejemplares-sin-circulacion'
  | 'sanciones'
  | 'certificados'

/** Filtro ya aplicado al reporte, para rotular gráficos y PDF. */
export interface FiltroAplicado {
  label: string
  value: string
}
