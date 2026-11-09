const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

/** 12345 -> "12.345" · null -> "—" (los nulos son "no disponible", no cero) */
export const formatNumber = (n: number | null | undefined): string =>
  n == null ? '—' : String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.')

export const monthLabel = (anio: number, mes: number): string =>
  `${MESES[mes - 1] ?? mes} ${anio}`

export const titleCase = (s: string): string =>
  s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : s