// src/utils/auditoria.ts — lógica pura (sin Vue), fácil de probar.
import type { AuditoriaEndpoint, AuditoriaFilters, AuditoriaResponse, FilterErrors } from '@/types/auditoria'

/* ───────────── Fechas ───────────── */
const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?)?(Z|[+-]\d{2}:?\d{2})?$/

/** Fecha sin zona = hora local del backend: NO se interpreta como UTC. */
export function parseAuditDate(value: string | null | undefined): Date | null {
  if (!value) return null
  const m = ISO_RE.exec(value.trim())
  if (!m) return null
  if (m[7]) {
    const d = new Date(value)
    return Number.isNaN(d.getTime()) ? null : d
  }
  const [, y, mo, d, h = '0', mi = '0', s = '0'] = m
  const date = new Date(+y, +mo - 1, +d, +h, +mi, +s)
  return Number.isNaN(date.getTime()) ? null : date
}

const fmt = new Intl.DateTimeFormat('es-BO', {
  day: '2-digit', month: '2-digit', year: 'numeric',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
})

export function formatAuditDate(value: string | null | undefined): string {
  if (!value) return '—'
  const d = parseAuditDate(value)
  return d ? fmt.format(d) : value
}

/** yyyy-MM-dd → ISO local esperado por Spring (sin zona). */
export function toApiRange(inicio: string, fin: string) {
  return { inicio: `${inicio}T00:00:00`, fin: `${fin}T23:59:59` }
}

/* ───────────── Presentación ───────────── */
export const normAccion = (a: string | null | undefined) => (a ?? '').trim().toUpperCase()

export function userDisplay(u: AuditoriaResponse['usuario']) {
  if (!u) return { primary: 'Usuario no disponible', secondary: '' }
  const name = u.nombreCompleto?.trim()
  const username = u.username?.trim()
  return { primary: name || username || `Usuario #${u.id_usuario}`, secondary: name && username ? username : '' }
}

export function sortByFechaDesc(list: AuditoriaResponse[]): AuditoriaResponse[] {
  const t = (r: AuditoriaResponse) => parseAuditDate(r.fechaHora)?.getTime() ?? -Infinity
  return [...list].sort((a, b) => t(b) - t(a) || (b.id_auditoria ?? 0) - (a.id_auditoria ?? 0))
}

export function computeStats(list: AuditoriaResponse[]) {
  const s = {
    total: list.length,
    crear: 0,
    actualizar: 0,
    eliminar: 0,
  }

  for (const r of list) {
    const accion = normAccion(r.accion)

    if (accion.startsWith('CREAR')) {
      s.crear++
    } else if (accion.startsWith('ACTUALIZAR')) {
      s.actualizar++
    } else if (accion.startsWith('ELIMINAR')) {
      s.eliminar++
    }
  }

  return s
}

/* ───────────── Filtros ───────────── */
export const emptyFilters = (): AuditoriaFilters => ({
  usuarioId: null, accion: '', tabla: '', idRegistro: '', fechaInicio: '', fechaFin: '',
})

export function validateFilters(f: AuditoriaFilters): FilterErrors {
  const e: FilterErrors = {}
  if (f.idRegistro.trim()) {
    if (!/^\d+$/.test(f.idRegistro.trim())) e.idRegistro = 'Ingresa un número entero.'
    if (!f.tabla.trim()) e.tabla = 'Indica la tabla para buscar por ID de registro.'
  }
  if (!!f.fechaInicio !== !!f.fechaFin) {
    const msg = 'Indica ambas fechas para filtrar por rango.'
    if (!f.fechaInicio) e.fechaInicio = msg
    else e.fechaFin = msg
  } else if (f.fechaInicio && f.fechaFin && f.fechaInicio > f.fechaFin) {
    e.fechaInicio = 'La fecha inicial no puede ser posterior a la final.'
  }
  return e
}

export interface RequestPlan {
  endpoint: AuditoriaEndpoint
  /** criterios resueltos en el servidor; el resto se filtra en el cliente */
  handled: Array<'tabla' | 'idRegistro' | 'fechas' | 'usuarioId' | 'accion'>
}

/** No hay endpoint combinado: se elige el más selectivo y el resto se aplica sobre su resultado. */
export function planRequest(f: AuditoriaFilters): RequestPlan {
  if (f.tabla.trim() && f.idRegistro.trim()) return { endpoint: 'registro', handled: ['tabla', 'idRegistro'] }
  if (f.fechaInicio && f.fechaFin) return { endpoint: 'fechas', handled: ['fechas'] }
  if (f.usuarioId != null) return { endpoint: 'usuario', handled: ['usuarioId'] }
  if (f.tabla.trim()) return { endpoint: 'tabla', handled: ['tabla'] }
  if (f.accion) return { endpoint: 'accion', handled: ['accion'] }
  return { endpoint: 'all', handled: [] }
}

export function applyClientFilters(list: AuditoriaResponse[], f: AuditoriaFilters, handled: RequestPlan['handled']) {
  const done = new Set(handled)
  const from = f.fechaInicio ? parseAuditDate(`${f.fechaInicio}T00:00:00`)?.getTime() : undefined
  const to = f.fechaFin ? parseAuditDate(`${f.fechaFin}T23:59:59`)?.getTime() : undefined
  return list.filter((r) => {
    if (!done.has('usuarioId') && f.usuarioId != null && r.usuario?.id_usuario !== f.usuarioId) return false
    if (!done.has('accion') && f.accion && normAccion(r.accion) !== f.accion) return false
    if (!done.has('tabla') && f.tabla.trim() && (r.tablaAfectada ?? '').toLowerCase() !== f.tabla.trim().toLowerCase()) return false
    if (!done.has('idRegistro') && f.idRegistro.trim() && String(r.id_registro) !== f.idRegistro.trim()) return false
    if (!done.has('fechas') && (from !== undefined || to !== undefined)) {
      const t = parseAuditDate(r.fechaHora)?.getTime()
      if (t === undefined) return false
      if (from !== undefined && t < from) return false
      if (to !== undefined && t > to) return false
    }
    return true
  })
}

/* ───────────── Valores anteriores / nuevos ───────────── */
export type ParsedValue = { kind: 'empty' } | { kind: 'json'; value: object } | { kind: 'text'; raw: string }

/** Intenta JSON (también doblemente serializado). Nunca lanza ni ejecuta contenido. */
export function parseAuditValue(raw: unknown): ParsedValue {
  if (raw === null || raw === undefined) return { kind: 'empty' }
  if (typeof raw === 'object') return { kind: 'json', value: raw as object }
  const text = String(raw)
  const t = text.trim()
  if (!t || t === 'null') return { kind: 'empty' }
  try {
    let v: unknown = JSON.parse(t)
    if (typeof v === 'string') {
      const inner = v.trim()
      if (inner.startsWith('{') || inner.startsWith('[')) {
        try { v = JSON.parse(inner) } catch { /* se queda como texto */ }
      }
    }
    if (v && typeof v === 'object') return { kind: 'json', value: v as object }
  } catch { /* no es JSON */ }
  return { kind: 'text', raw: text }
}

export const SENSITIVE_KEY = /pass(word)?|contrase|token|secret|hash|api[_-]?key/i
const MASK = '••••••'

type Json = unknown
function flatten(v: Json, path = '', out = new Map<string, string>()) {
  if (Array.isArray(v)) {
    if (!v.length) out.set(path, '[]')
    else v.forEach((c, i) => flatten(c, `${path}[${i}]`, out))
  } else if (v && typeof v === 'object') {
    const keys = Object.keys(v)
    if (!keys.length) out.set(path, '{}')
    else keys.forEach((k) => flatten((v as Record<string, Json>)[k], path ? `${path}.${k}` : k, out))
  } else out.set(path, JSON.stringify(v) ?? 'undefined')
  return out
}

export type LineStatus = 'same' | 'changed' | 'added' | 'removed' | 'container'
export interface JsonLine { text: string; status: LineStatus }

function buildLines(root: Json, other: Map<string, string> | null, side: 'old' | 'new'): JsonLine[] {
  const mine = flatten(root)
  const out: JsonLine[] = []
  const walk = (v: Json, path: string, key: string | null, depth: number, comma: boolean) => {
    const pad = '  '.repeat(depth)
    const label = key === null ? '' : `${JSON.stringify(key)}: `
    const c = comma ? ',' : ''
    const isArr = Array.isArray(v)
    if (v && typeof v === 'object' && Object.keys(v).length > 0) {
      out.push({ text: `${pad}${label}${isArr ? '[' : '{'}`, status: 'container' })
      const entries: Array<[string | null, string, Json]> = isArr
        ? (v as Json[]).map((x, i) => [null, `${path}[${i}]`, x])
        : Object.entries(v as Record<string, Json>).map(([k, x]) => [k, path ? `${path}.${k}` : k, x])
      entries.forEach(([k, p, x], i) => walk(x, p, k, depth + 1, i < entries.length - 1))
      out.push({ text: `${pad}${isArr ? ']' : '}'}${c}`, status: 'container' })
      return
    }
    const sensitive = key !== null && SENSITIVE_KEY.test(key) && v !== null && v !== undefined
    const shown = sensitive ? `"${MASK}"` : (JSON.stringify(v) ?? 'null')
    let status: LineStatus = 'same'
    if (other) {
      const o = other.get(path)
      if (o === undefined) status = side === 'old' ? 'removed' : 'added'
      else if (o !== mine.get(path)) status = 'changed'
    }
    out.push({ text: `${pad}${label}${shown}${c}`, status })
  }
  walk(root, '', null, 0, false)
  return out
}

export interface AuditDiff {
  comparable: boolean
  changedCount: number
  prevLines: JsonLine[]
  nextLines: JsonLine[]
}

export function buildDiff(prev: ParsedValue, next: ParsedValue): AuditDiff {
  const pj = prev.kind === 'json' ? prev.value : null
  const nj = next.kind === 'json' ? next.value : null
  const comparable = pj !== null && nj !== null
  const pf = pj ? flatten(pj) : null
  const nf = nj ? flatten(nj) : null
  let changedCount = 0
  if (comparable && pf && nf) {
    for (const k of new Set([...pf.keys(), ...nf.keys()])) if (pf.get(k) !== nf.get(k)) changedCount++
  }
  return {
    comparable, changedCount,
    prevLines: pj ? buildLines(pj, comparable ? nf : null, 'old') : [],
    nextLines: nj ? buildLines(nj, comparable ? pf : null, 'new') : [],
  }
}

function redact(v: Json, key = ''): Json {
  if (Array.isArray(v)) return v.map((x) => redact(x))
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, redact(x, k)]))
  return SENSITIVE_KEY.test(key) && v != null ? MASK : v
}

/* ───────────── Exportación CSV (sin dependencias) ───────────── */
const cell = (v: unknown) => {
  let s = v === null || v === undefined ? '' : String(v)
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}` // evita inyección de fórmulas en Excel
  return `"${s.replace(/"/g, '""')}"`
}
const compact = (raw: string | null) => {
  const p = parseAuditValue(raw)
  return p.kind === 'json' ? JSON.stringify(redact(p.value)) : p.kind === 'text' ? p.raw : ''
}

export function recordsToCsv(list: AuditoriaResponse[]): string {
  const head = ['ID', 'Fecha y hora', 'Usuario', 'Username', 'Acción', 'Tabla', 'ID registro', 'IP', 'Valores anteriores', 'Valores nuevos']
  const rows = list.map((r) => {
    const u = userDisplay(r.usuario)
    return [r.id_auditoria, formatAuditDate(r.fechaHora), u.primary, r.usuario?.username ?? '', normAccion(r.accion), r.tablaAfectada, r.id_registro, r.ipAddress, compact(r.valoresAnteriores), compact(r.valoresNuevos)]
  })
  return '\uFEFF' + [head, ...rows].map((r) => r.map(cell).join(',')).join('\r\n')
}
