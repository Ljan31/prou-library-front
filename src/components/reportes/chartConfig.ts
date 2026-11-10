/**
 *
 * Única fuente de verdad para dibujar los gráficos de reportes:
 *  - SChart.vue lo usa para la pantalla.
 *  - reportePdf.ts lo usa para renderizar PNG fuera de pantalla
 *    (tema claro, fondo blanco, sin animación, tamaño fijo).
 * Así un mismo estado tiene el mismo color en pantalla y en el PDF.
 */
import {
  Chart,
  LineController,
  BarController,
  DoughnutController,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Tooltip,
  Legend,
  Filler,
  type ChartConfiguration,
  type Plugin,
} from 'chart.js'
import { format, parse } from 'date-fns'
import { es } from 'date-fns/locale'
import type { GraficoDTO } from '@/services/reporte.service'

Chart.register(
  LineController, BarController, DoughnutController,
  CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement,
  Tooltip, Legend, Filler
)

const FUENTE = "'DM Sans', system-ui, -apple-system, sans-serif"
Chart.defaults.font.family = FUENTE
Chart.defaults.color = '#475569'

// ─── Colores por NOMBRE (no por posición) ─────────────────────────────────────

const norm = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim().replace(/\s+/g, '_')

const COLORES: Record<string, string> = {
  // ejemplares
  DISPONIBLE: '#10b981', PRESTADO: '#f59e0b', RESERVADO: '#0ea5e9',
  EN_REPARACION: '#f97316', REPARACION: '#f97316',
  BAJA: '#94a3b8', PERDIDO: '#ef4444', DETERIORADO: '#eab308', DANADO: '#e11d48',
  // préstamos
  ACTIVO: '#10b981', RENOVADO: '#3b82f6', VENCIDO: '#ef4444',
  DEVUELTO: '#64748b', CANCELADO: '#475569',
  SALA: '#6366f1', DOMICILIO: '#14b8a6',
  // sanciones
  ACTIVA: '#ef4444', PAGADA: '#10b981', CONDONADA: '#94a3b8',
  MULTA: '#f59e0b', SUSPENSION: '#ef4444', SUSPENSIONES: '#ef4444', MULTA_Y_SUSPENSION: '#8b5cf6',
  // certificados
  VIGENTE: '#10b981', ANULADO: '#64748b',
  // deterioro / circulación
  CON_DETERIORO: '#ef4444', SIN_CAMBIO: '#10b981', MEJORO: '#10b981',
  NUNCA_PRESTADOS: '#f59e0b', CON_PRESTAMOS: '#6366f1',
}

export const PALETA = [
  '#6366f1', '#14b8a6', '#f59e0b', '#ec4899', '#0ea5e9',
  '#8b5cf6', '#84cc16', '#f97316', '#64748b', '#06b6d4',
]

/** Rampa de severidad para "vencidos por tramo de retraso". */
const TRAMOS = ['#fbbf24', '#f97316', '#ef4444', '#b91c1c', '#7f1d1d']

/** Acepta singular/plural y mayúsculas/acentos: "Vencidos" → VENCIDO. */
export function colorPorNombre(nombre: string): string | null {
  const k = norm(nombre ?? '')
  return COLORES[k] ?? COLORES[k.replace(/S$/, '')] ?? null
}

// ─── Formato ──────────────────────────────────────────────────────────────────

export const esMonto = (unidad: string) =>
  ['monto', 'bs'].includes((unidad ?? '').trim().toLowerCase())

const fmtNum = (v: number) => v.toLocaleString('es-BO', { maximumFractionDigits: 2 })

export const fmtValor = (v: number, unidad: string) =>
  esMonto(unidad)
    ? `Bs ${v.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : fmtNum(v)

/** "2026-03" → "mar 2026". Otras etiquetas pasan sin cambio. */
export function formatEtiqueta(e: string): string {
  if (/^\d{4}-\d{2}$/.test(e)) {
    return format(parse(e, 'yyyy-MM', new Date()), 'MMM yyyy', { locale: es })
  }
  return e
}

const truncar = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + '…' : s)

const tituloEje = (unidad: string) =>
  esMonto(unidad) ? 'Monto (Bs)' : unidad.charAt(0).toUpperCase() + unidad.slice(1)

/** Texto oscuro o blanco según el fondo, para valores dentro de barras/porciones. */
function textoSobre(hex: string): string {
  const n = parseInt((hex || '#000000').slice(1), 16)
  const luz = 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)
  return luz > 165 ? '#1e293b' : '#ffffff'
}

/** Descripción corta para lectores de pantalla (aria-label del canvas). */
export function resumenAccesible(g: GraficoDTO): string {
  const s = g.series[0]
  if (!s) return g.titulo
  const partes = g.etiquetas.map((e, i) => `${formatEtiqueta(e)}: ${fmtNum(s.valores[i] ?? 0)}`)
  return `${g.titulo}. ${partes.join(', ')}`
}

// ─── Plugins propios (valores siempre visibles, también al imprimir) ──────────

const fondoBlanco: Plugin = {
  id: 'fondoBlanco',
  beforeDraw(chart) {
    const { ctx, width, height } = chart
    ctx.save()
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, width, height)
    ctx.restore()
  },
}

function dibujarDona(chart: Chart, g: GraficoDTO) {
  const ctx = chart.ctx
  const ds: any = chart.data.datasets[0]
  const meta = chart.getDatasetMeta(0)
  const datos = (ds.data as number[]).map(Number)
  const suma = datos.reduce((a, b) => a + b, 0)
  if (!suma || !meta.data.length) return

  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  meta.data.forEach((el: any, i: number) => {
    const v = datos[i]
    if (!v) return
    const a = el.getProps(['x', 'y', 'startAngle', 'endAngle', 'innerRadius', 'outerRadius'], true)
    const mid = (a.startAngle + a.endAngle) / 2
    const pct = Math.round((v / suma) * 100)

    if (a.endAngle - a.startAngle > 0.4) {
      // porción grande: valor y % dentro
      const r = (a.innerRadius + a.outerRadius) / 2
      const x = a.x + Math.cos(mid) * r
      const y = a.y + Math.sin(mid) * r
      ctx.fillStyle = textoSobre(ds.backgroundColor[i])
      ctx.font = `700 12px ${FUENTE}`
      ctx.fillText(fmtNum(v), x, y - 7)
      ctx.font = `500 11px ${FUENTE}`
      ctx.fillText(`${pct}%`, x, y + 7)
    } else {
      // porción pequeña: etiqueta por fuera
      const r = a.outerRadius + 6
      ctx.fillStyle = '#334155'
      ctx.font = `600 11px ${FUENTE}`
      ctx.textAlign = Math.cos(mid) >= 0 ? 'left' : 'right'
      ctx.fillText(`${fmtNum(v)} (${pct}%)`, a.x + Math.cos(mid) * r, a.y + Math.sin(mid) * r)
      ctx.textAlign = 'center'
    }
  })

  // total al centro
  const c: any = meta.data[0]
  const centro = c.getProps(['x', 'y'], true)
  ctx.fillStyle = '#0f172a'
  ctx.font = `700 20px ${FUENTE}`
  ctx.fillText(fmtNum(suma), centro.x, centro.y - 6)
  ctx.fillStyle = '#64748b'
  ctx.font = `500 11px ${FUENTE}`
  ctx.fillText(esMonto(g.unidad) ? 'Bs' : g.unidad, centro.x, centro.y + 12)
}

function valueLabelsPlugin(g: GraficoDTO): Plugin {
  const tipo = g.tipoSugerido
  return {
    id: 'valueLabels',
    afterDatasetsDraw(chart) {
      const ctx = chart.ctx
      ctx.save()
      if (tipo === 'DONA') {
        dibujarDona(chart, g)
        ctx.restore()
        return
      }
      ctx.font = `600 11px ${FUENTE}`
      chart.data.datasets.forEach((ds: any, di: number) => {
        const meta = chart.getDatasetMeta(di)
        if (meta.hidden) return
        meta.data.forEach((el: any, i: number) => {
          const v = Number(ds.data[i])
          if (!Number.isFinite(v)) return
          if (tipo === 'BARRAS_APILADAS' && v === 0) return
          const txt = fmtNum(v)
          const p = el.getProps(['x', 'y', 'base'], true)

          if (tipo === 'LINEA') {
            ctx.fillStyle = '#334155'
            ctx.textAlign = 'center'
            ctx.textBaseline = 'bottom'
            ctx.fillText(txt, p.x, p.y - 8)
          } else if (tipo === 'BARRAS') {
            ctx.fillStyle = '#334155'
            ctx.textAlign = 'center'
            ctx.textBaseline = 'bottom'
            ctx.fillText(txt, p.x, p.y - 4)
          } else if (tipo === 'BARRAS_HORIZONTALES') {
            ctx.fillStyle = '#334155'
            ctx.textAlign = 'left'
            ctx.textBaseline = 'middle'
            ctx.fillText(txt, p.x + 6, p.y)
          } else {
            // BARRAS_APILADAS: valor dentro del segmento si cabe
            const alto = Math.abs(p.base - p.y)
            if (alto < 14) return
            const color = typeof ds.backgroundColor === 'string' ? ds.backgroundColor : '#64748b'
            ctx.fillStyle = textoSobre(color)
            ctx.textAlign = 'center'
            ctx.textBaseline = 'middle'
            ctx.fillText(txt, p.x, (p.base + p.y) / 2)
          }
        })
      })
      ctx.restore()
    },
  }
}

// ─── Configuración ────────────────────────────────────────────────────────────

export function buildChartConfig(g: GraficoDTO, opts: { pdf?: boolean } = {}): ChartConfiguration {
  const pdf = !!opts.pdf
  const unidad = g.unidad ?? ''
  const etiquetas = g.etiquetas.map(formatEtiqueta)
  const plugins: Plugin[] = [valueLabelsPlugin(g)]
  if (pdf) plugins.push(fondoBlanco)

  const base: any = {
    responsive: !pdf,
    maintainAspectRatio: false,
    animation: pdf ? false : { duration: 350 },
  }
  if (pdf) base.devicePixelRatio = 2

  // ── DONA: se ocultan las porciones en cero (el backend las manda para orden estable)
  if (g.tipoSugerido === 'DONA') {
    const serie = g.series[0]
    const idx = g.etiquetas
      .map((_, i) => i)
      .filter(i => Number(serie?.valores[i] ?? 0) > 0)
    const datos = idx.map(i => Number(serie.valores[i]))
    const suma = datos.reduce((a, b) => a + b, 0)
    const colores = idx.map((i, k) => colorPorNombre(g.etiquetas[i]) ?? PALETA[k % PALETA.length])

    return {
      type: 'doughnut',
      data: {
        labels: idx.map(i => etiquetas[i]),
        datasets: [{ data: datos, backgroundColor: colores, borderColor: '#ffffff', borderWidth: 2 }],
      },
      options: {
        ...base,
        cutout: '58%',
        layout: { padding: 34 },
        plugins: {
          legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 10, padding: 14 } },
          tooltip: {
            callbacks: {
              label: (c: any) => {
                const v = Number(c.parsed)
                const pct = Math.round((v / suma) * 100)
                const u = esMonto(unidad) ? '' : ` ${unidad}`
                return `${c.label}: ${fmtValor(v, unidad)}${u} (${pct}%)`
              },
            },
          },
        },
      },
      plugins,
    } as ChartConfiguration
  }

  // ── Barras / líneas
  const horizontal = g.tipoSugerido === 'BARRAS_HORIZONTALES'
  const apilado = g.tipoSugerido === 'BARRAS_APILADAS'
  const esLinea = g.tipoSugerido === 'LINEA'
  const multi = g.series.length > 1

  const datasets = g.series.map((s, i) => {
    const colorSerie = colorPorNombre(s.nombre) ?? PALETA[i % PALETA.length]

    if (esLinea) {
      return {
        label: s.nombre, data: s.valores,
        borderColor: colorSerie, backgroundColor: colorSerie + '26',
        pointBackgroundColor: colorSerie, pointRadius: 4,
        cubicInterpolationMode: 'monotone', fill: !multi, borderWidth: 2,
      }
    }

    let fondo: string | string[] = colorSerie
    if (!apilado && !multi) {
      // una serie: si TODAS las etiquetas tienen color por nombre (p. ej. ACTIVA/PAGADA) → una barra por color
      const porEtiqueta = g.etiquetas.map(e => colorPorNombre(e))
      if (porEtiqueta.every(Boolean)) fondo = porEtiqueta as string[]
      else if (g.id.includes('tramo')) fondo = g.etiquetas.map((_, k) => TRAMOS[Math.min(k, TRAMOS.length - 1)])
    }
    return {
      label: s.nombre, data: s.valores, backgroundColor: fondo,
      borderRadius: 4, maxBarThickness: horizontal ? 22 : 56,
    }
  })

  const tickValor = (v: string | number) =>
    esMonto(unidad) || Number.isInteger(Number(v)) ? Number(v).toLocaleString('es-BO') : ''

  const ejeValor: any = {
    beginAtZero: true,
    grace: '12%',
    stacked: apilado,
    title: { display: true, text: tituloEje(unidad) },
    ticks: { callback: tickValor },
    grid: { color: '#e2e8f0' },
  }
  const ejeCategoria: any = {
    stacked: apilado,
    grid: { display: false },
    ticks: {
      callback(this: any, v: any) {
        return truncar(String(this.getLabelForValue(v)), horizontal ? 30 : 16)
      },
    },
  }

  return {
    type: esLinea ? 'line' : 'bar',
    data: { labels: etiquetas, datasets },
    options: {
      ...base,
      ...(horizontal ? { indexAxis: 'y' } : {}),
      ...(esLinea || apilado ? { interaction: { mode: 'index', intersect: false } } : {}),
      scales: horizontal ? { x: ejeValor, y: ejeCategoria } : { x: ejeCategoria, y: ejeValor },
      plugins: {
        legend: { display: multi, position: 'bottom', labels: { usePointStyle: true, boxWidth: 10 } },
        tooltip: {
          callbacks: {
            // título completo (el eje lo trunca)
            title: (items: any[]) => (items.length ? etiquetas[items[0].dataIndex] : ''),
            label: (c: any) => {
              const v = horizontal ? c.parsed.x : c.parsed.y
              const txt = esMonto(unidad) ? fmtValor(v, unidad) : `${fmtValor(v, unidad)} ${unidad}`
              return multi ? `${c.dataset.label}: ${txt}` : txt
            },
          },
        },
      },
    },
    plugins,
  } as ChartConfiguration
}

// ─── PNG para el PDF ──────────────────────────────────────────────────────────

export interface GraficoPng {
  dataUrl: string
  width: number
  height: number
}

/**
 * Renderiza el gráfico fuera de pantalla: fondo blanco, tema claro, sin animación,
 * tamaño fijo (900×420; DONA 420×420) y 2x de resolución. Independiente del ancho
 * de pantalla del usuario.
 */
export function graficoToPng(g: GraficoDTO): GraficoPng {
  const width = g.tipoSugerido === 'DONA' ? 420 : 900
  const height = 420
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const chart = new Chart(canvas, buildChartConfig(g, { pdf: true }))
  try {
    return { dataUrl: chart.toBase64Image('image/png', 1), width, height }
  } finally {
    chart.destroy()
  }
}