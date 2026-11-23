// Códigos ISO 639-1 (y 639-3 donde no existe el de 2 letras)
export const IDIOMAS_FRECUENTES = ['es', 'qu', 'ay', 'gn', 'en', 'pt', 'fr', 'de', 'it', 'la']

const IDIOMAS_OTROS = [
  'af', 'ar', 'bg', 'ca', 'cs', 'da', 'el', 'et', 'eu', 'fa', 'fi', 'gl', 'he', 'hi', 'hr',
  'hu', 'id', 'ja', 'ko', 'lt', 'lv', 'nl', 'no', 'pl', 'ro', 'ru', 'sk', 'sl', 'sr',
  'sv', 'tr', 'uk', 'vi', 'zh',
]

// Nombres que Intl no resuelva bien en algunos navegadores
const NOMBRES_PROPIOS: Record<string, string> = {
  qu: 'Quechua',
  ay: 'Aymara',
  gn: 'Guaraní',
}

const nombres = new Intl.DisplayNames(['es'], { type: 'language' })

const capitalizar = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export function nombreIdioma(codigo?: string | null): string {
  if (!codigo) return '—'
  if (NOMBRES_PROPIOS[codigo]) return NOMBRES_PROPIOS[codigo]
  try {
    return capitalizar(nombres.of(codigo) ?? codigo)
  } catch {
    return codigo.toUpperCase()   // código desconocido: se muestra tal cual
  }
}

const aOpcion = (c: string) => ({ value: c, label: nombreIdioma(c) })

export const opcionesFrecuentes = IDIOMAS_FRECUENTES.map(aOpcion)
export const opcionesOtros = IDIOMAS_OTROS.map(aOpcion).sort((a, b) =>
  a.label.localeCompare(b.label, 'es')
)