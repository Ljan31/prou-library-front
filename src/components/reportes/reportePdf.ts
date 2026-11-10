/**
 * Construye el PDF de cualquier reporte en el navegador (jsPDF + autoTable).
 * Orden: encabezado → filtros aplicados → resumen → GRÁFICOS → tabla de detalle.
 * Los gráficos fallidos o sin datos se omiten sin romper la generación.
 */
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { format, parseISO } from 'date-fns'
import type { GraficoItem } from '@/composables/useReporteGraficos'
import type { FiltroAplicado, TipoReporte } from '@/types/reportes'
import { colorPorNombre, graficoToPng } from './chartConfig'

type RGB = [number, number, number]

const INDIGO: RGB = [79, 70, 229]
const SLATE8: RGB = [30, 41, 59]
const SLATE5: RGB = [100, 116, 139]
const BG_CHIP: RGB = [238, 242, 255]
const M = 14 // margen

const TITULOS: Record<TipoReporte, string> = {
  'prestamos-activos': 'Préstamos activos',
  'devoluciones-pendientes': 'Devoluciones pendientes vencidas',
  'prestamos-por-vencer': 'Préstamos por vencer',
  'prestamos': 'Reporte de préstamos',
  'historial': 'Historial avanzado de préstamos',
  'libros-mas-prestados': 'Libros más prestados',
  'libros-menos-prestados': 'Libros menos prestados',
  'inventario': 'Inventario de ejemplares',
  'estado-ejemplares': 'Estado de ejemplares por biblioteca',
  'deterioro-ejemplares': 'Deterioro físico de ejemplares',
  'ejemplares-sin-circulacion': 'Ejemplares sin circulación',
  'sanciones': 'Reporte de sanciones',
  'certificados': 'Certificados de no deuda',
}

export const tituloReporte = (t: TipoReporte | '') => (t ? TITULOS[t] : 'Reporte')

// ─── Formato ──────────────────────────────────────────────────────────────────

const fecha = (v?: string | null) => {
  if (!v) return '—'
  try { return format(parseISO(v), 'dd/MM/yyyy') } catch { return v }
}
const num = (v: unknown) => Number(v ?? 0).toLocaleString('es-BO')
const bs = (v: unknown) =>
  `Bs ${Number(v ?? 0).toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const txt = (v: unknown) => (v === null || v === undefined || v === '' ? '—' : String(v))

function rgbDe(hex: string, f = 0.8): RGB {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(c => Math.round(c * f)) as RGB
}

// ─── Resumen (chips) ──────────────────────────────────────────────────────────

function chips(tipo: TipoReporte, d: any): [string, string][] {
  if (tipo === 'ejemplares-sin-circulacion') {
    return [
      ['Sin historial de préstamos', num(d?.totalEjemplaresNuncaPrestados)],
      ['Total ejemplares', num(d?.totalEjemplares)],
      ['% sin circulación', `${Number(d?.porcentajeSinCirculacion ?? 0).toFixed(1)}%`],
    ]
  }
  const out: [string, string][] = []
  for (const [k, v] of Object.entries(d?.resumen ?? {})) {
    if (typeof v !== 'number') continue
    const e = k.replace(/([A-Z])/g, ' $1').toLowerCase()
    const label = e.charAt(0).toUpperCase() + e.slice(1)
    const valor = k.startsWith('monto') ? bs(v) : k.startsWith('porcentaje') ? `${v.toFixed(1)}%` : num(v)
    out.push([label, valor])
  }
  return out
}

// ─── Tablas por tipo ──────────────────────────────────────────────────────────

interface TablaPdf {
  head: string[]
  body: (string | number)[][]
  rows: any[]
  /** Columnas cuyo texto es un estado → se colorea por nombre. */
  estadoCols?: number[]
  center?: number[]
  fila?: (row: any) => RGB | undefined
}

const venceEn = (p: any) => {
  const n = Math.abs(p.diasRestantes)
  if (p.vencido || p.diasRestantes < 0) return `Retraso ${n} d`
  if (p.diasRestantes === 0) return 'Hoy'
  if (p.diasRestantes === 1) return 'Mañana'
  return `${p.diasRestantes} d`
}

function tabla(tipo: TipoReporte, d: any): TablaPdf {
  switch (tipo) {
    case 'prestamos-activos':
    case 'devoluciones-pendientes':
    case 'prestamos-por-vencer': {
      const rows: any[] = d?.prestamos ?? []
      return {
        head: ['Usuario', 'CI', 'Libro', 'Código', 'F. estimada', 'Estado', 'Vence en', 'Renov.'],
        rows,
        body: rows.map(p => [
          txt(p.nombreUsuario), txt(p.ci), txt(p.tituloLibro), txt(p.codigoEjemplar),
          fecha(p.fechaDevolucionEstimada), txt(p.estadoPrestamo), venceEn(p), txt(p.renovaciones),
        ]),
        estadoCols: [5],
        center: [7],
        // colores de fila del README: no se recalcula nada, se usa lo que manda el backend
        fila: p =>
          p.vencido || p.diasRestantes < 0 ? [255, 229, 229]
            : p.diasRestantes === 0 ? [255, 243, 224]
              : p.diasRestantes === 1 ? [255, 253, 231]
                : p.estadoPrestamo === 'RENOVADO' ? [227, 242, 253]
                  : undefined,
      }
    }

    case 'prestamos':
    case 'historial': {
      const rows: any[] = d?.prestamos ?? []
      const hist = tipo === 'historial'
      return {
        head: [
          '#', 'Usuario', 'CI', 'Libro', 'Biblioteca', 'F. préstamo', 'F. estimada', 'Estado', 'Tipo', 'Retraso',
          ...(hist ? ['Renov.', 'Cond. entrega', 'Cond. devol.'] : []),
        ],
        rows,
        body: rows.map(p => [
          txt(p.idPrestamo), txt(p.usuario), txt(p.ci), txt(p.libro), txt(p.biblioteca),
          fecha(p.fechaPrestamo), fecha(p.fechaDevolucionEstimada), txt(p.estadoPrestamo), txt(p.tipoPrestamo),
          p.diasRetraso > 0 ? `+${p.diasRetraso} d` : '—',
          ...(hist ? [txt(p.renovaciones), txt(p.condicionEntrega), txt(p.condicionDevolucion)] : []),
        ]),
        estadoCols: [7],
        center: [0, 9, ...(hist ? [10] : [])],
      }
    }

    case 'libros-mas-prestados':
    case 'libros-menos-prestados': {
      const rows: any[] = d?.libros ?? []
      console.log('d: ', d)
      return {
        // head: ['#', 'Título', 'ISBN', 'Préstamos'],
        head: ['#', 'Título', 'Préstamos'],
        rows,
        // body: rows.map((l, i) => [i + 1, txt(l.titulo), txt(l.isbn), num(l.cantidadPrestamos)]),
        body: rows.map((l, i) => [i + 1, txt(l.titulo), num(l.cantidadPrestamos)]),
        center: [0, 3],
      }
    }

    case 'inventario': {
      const rows: any[] = d?.detalle ?? []
      return {
        head: ['Código', 'Título', 'ISBN', 'Biblioteca', 'Estado', 'Clasificación', 'Ubicación'],
        rows,
        body: rows.map(e => [
          txt(e.codigoEjemplar), txt(e.tituloLibro), txt(e.isbn), txt(e.biblioteca),
          txt(e.estado), txt(e.clasificacionDecimal), txt(e.ubicacionFisica),
        ]),
        estadoCols: [4],
      }
    }

    case 'estado-ejemplares': {
      const rows: any[] = d?.bibliotecas ?? []
      return {
        head: ['Biblioteca', 'Disponibles', 'Prestados', 'Reservados', 'Reparación', 'Perdidos', 'Dañados', 'Deteriorados', 'Bajas'],
        rows,
        body: rows.map(b => [
          txt(b.nombreBiblioteca ?? b.biblioteca),
          num(b.disponibles), num(b.prestados), num(b.reservados), num(b.reparacion),
          num(b.perdidos), num(b.danados), num(b.deteriorados), num(b.bajas),
        ]),
        center: [1, 2, 3, 4, 5, 6, 7, 8],
      }
    }

    case 'deterioro-ejemplares': {
      const rows: any[] = d?.detalle ?? []
      return {
        head: ['Ejemplar', 'Libro', 'Usuario', 'CI', 'Cond. entrada', 'Cond. salida', 'Dif. nivel', 'F. devolución'],
        rows,
        body: rows.map(x => [
          txt(x.codigoEjemplar), txt(x.libro), txt(x.usuario), txt(x.ci),
          txt(x.condicionEntrega), txt(x.condicionDevolucion),
          x.diferenciaNivel > 0 ? `-${x.diferenciaNivel}` : x.diferenciaNivel < 0 ? `+${Math.abs(x.diferenciaNivel)}` : '0',
          fecha(x.fechaDevolucion),
        ]),
        center: [6],
        fila: x => (x.diferenciaNivel >= 2 ? [255, 229, 229] : x.diferenciaNivel > 0 ? [255, 253, 231] : undefined),
      }
    }

    case 'ejemplares-sin-circulacion': {
      const rows: any[] = d?.ejemplares ?? []
      return {
        head: ['Código', 'Libro', 'Editorial', 'Biblioteca', 'Clasificación', 'Ubicación', 'Estado'],
        rows,
        body: rows.map(e => [
          txt(e.codigoEjemplar), txt(e.libro), txt(e.editorial), txt(e.biblioteca),
          txt(e.clasificacionDecimal), txt(e.ubicacionFisica), txt(e.estadoEjemplar),
        ]),
        estadoCols: [6],
      }
    }

    case 'sanciones': {
      const rows: any[] = d?.sanciones ?? []
      return {
        head: ['Usuario', 'CI', 'Biblioteca', 'Tipo', 'Estado', 'Monto', 'Días susp.', 'Días retraso', 'F. inicio', 'F. fin', 'Libro origen'],
        rows,
        body: rows.map(s => [
          txt(s.usuario), txt(s.ci), txt(s.biblioteca), txt(s.tipoSancion), txt(s.estadoSancion),
          s.monto != null ? bs(s.monto) : '—', txt(s.diasSuspension), txt(s.diasRetraso),
          fecha(s.fechaInicio), fecha(s.fechaFin), txt(s.libroOrigen),
        ]),
        estadoCols: [3, 4],
        center: [6, 7],
      }
    }

    case 'certificados': {
      const rows: any[] = d?.certificados ?? []
      return {
        head: ['Código', 'Usuario', 'CI', 'Biblioteca', 'Bibliotecario', 'F. emisión', 'F. vencimiento', 'Estado'],
        rows,
        body: rows.map(c => [
          txt(c.codigoVerificacion), txt(c.usuario), txt(c.ci), txt(c.biblioteca), txt(c.bibliotecario),
          fecha(c.fechaEmision), fecha(c.fechaVencimiento), txt(c.estadoCertificado),
        ]),
        estadoCols: [7],
      }
    }
  }
}

// ─── Construcción ─────────────────────────────────────────────────────────────

export interface PdfInput {
  tipo: TipoReporte
  datos: any
  graficos: GraficoItem[]
  filtros: FiltroAplicado[]
  biblioteca?: string
}

export function construirPdf({ tipo, datos, graficos, filtros, biblioteca }: PdfInput): Blob {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'letter' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const W = pageW - 2 * M
  const titulo = tituloReporte(tipo)
  const ahora = format(new Date(), 'dd/MM/yyyy HH:mm')

  // ── a. Encabezado
  doc.setFillColor(...INDIGO)
  doc.rect(0, 0, pageW, 22, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.text('SIGEB — Sistema de Gestión Bibliográfica · UMSA', M, 9)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text(titulo, M, 16)
  doc.setFontSize(8)
  doc.text(`Generado: ${ahora}`, pageW - M, 9, { align: 'right' })
  if (biblioteca) doc.text(biblioteca, pageW - M, 15, { align: 'right' })

  let y = 29

  // ── b. Filtros aplicados
  if (filtros.length) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(...SLATE8)
    doc.text('Filtros aplicados', M, y)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...SLATE5)
    const linea = filtros.map(f => `${f.label}: ${f.value}`).join('   ·   ')
    const lineas: string[] = doc.splitTextToSize(linea, W)
    lineas.forEach((l, i) => doc.text(l, M, y + 4.5 + i * 4))
    y += 4.5 + lineas.length * 4 + 3
  }

  // ── c. Resumen
  const lista = chips(tipo, datos)
  if (lista.length) {
    const cw = 44, ch = 18, gap = 3
    let cx = M
    for (const [label, valor] of lista) {
      if (cx + cw > pageW - M + 0.1) { cx = M; y += ch + gap }
      doc.setFillColor(...BG_CHIP)
      doc.roundedRect(cx, y, cw, ch, 2, 2, 'F')
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(11)
      doc.setTextColor(...INDIGO)
      doc.text(valor, cx + cw / 2, y + 7, { align: 'center' })
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(6.5)
      doc.setTextColor(...SLATE5)
      const ls: string[] = doc.splitTextToSize(label, cw - 4).slice(0, 2)
      ls.forEach((l, i) => doc.text(l, cx + cw / 2, y + 11.5 + i * 3, { align: 'center' }))
      cx += cw + gap
    }
    y += ch + 6
  }

  // ── d. GRÁFICOS (los fallidos / sin datos se omiten)
  interface Img { titulo: string; url: string; dona: boolean }
  const imgs: Img[] = []
  for (const it of graficos) {
    if (it.status !== 'ok' || !it.grafico || it.grafico.sinDatos) continue
    try {
      const png = graficoToPng(it.grafico)
      imgs.push({ titulo: it.grafico.titulo, url: png.dataUrl, dona: it.grafico.tipoSugerido === 'DONA' })
    } catch (e) {
      console.error('[pdf] gráfico omitido:', it.key, e)
    }
  }

  const ANCHO_FULL = 170
  const LADO_DONA = 80
  const bloque = (par: Img[]) => {
    const dona = par[0].dona
    const w = dona ? LADO_DONA : ANCHO_FULL
    const h = dona ? LADO_DONA : (ANCHO_FULL * 420) / 900
    const total = par.length * w + (par.length - 1) * 10
    // no partir un gráfico entre dos páginas
    if (y + 6 + h > pageH - 14) { doc.addPage(); y = M }
    let x = M + (W - total) / 2
    for (const im of par) {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.setTextColor(...SLATE8)
      doc.text(im.titulo, x, y + 4)
      doc.addImage(im.url, 'PNG', x, y + 6, w, h, undefined, 'FAST')
      x += w + 10
    }
    y += 6 + h + 6
  }

  for (let i = 0; i < imgs.length;) {
    // dos DONA seguidas van lado a lado
    if (imgs[i].dona && imgs[i + 1]?.dona) { bloque([imgs[i], imgs[i + 1]]); i += 2 }
    else { bloque([imgs[i]]); i += 1 }
  }

  // ── e. Tabla de detalle
  const t = tabla(tipo, datos)
  if (y > pageH - 40) { doc.addPage(); y = M }

  if (!t.body.length) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(...SLATE5)
    doc.text('No hay registros para los filtros aplicados.', pageW / 2, y + 12, { align: 'center' })
  } else {
    autoTable(doc, {
      startY: y,
      head: [t.head],
      body: t.body,
      margin: { top: M, bottom: 14, left: M, right: M },
      styles: { fontSize: 7.5, cellPadding: 2.2, textColor: SLATE8, lineColor: [226, 232, 240], lineWidth: 0.2 },
      headStyles: { fillColor: INDIGO, textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: Object.fromEntries((t.center ?? []).map(i => [i, { halign: 'center' }])),
      didParseCell: (h: any) => {
        if (h.section !== 'body') return
        const fill = t.fila?.(t.rows[h.row.index])
        if (fill) h.cell.styles.fillColor = fill
        if (t.estadoCols?.includes(h.column.index)) {
          const c = colorPorNombre(String(h.cell.raw ?? ''))
          if (c) { h.cell.styles.textColor = rgbDe(c); h.cell.styles.fontStyle = 'bold' }
        }
      },
    })
  }

  // ── Pie con numeración real (X de N)
  const n = doc.getNumberOfPages()
  for (let i = 1; i <= n; i++) {
    doc.setPage(i)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(...SLATE5)
    doc.text(`SIGEB · ${titulo} · ${ahora}  —  Página ${i} de ${n}`, pageW / 2, pageH - 6, { align: 'center' })
  }

  return doc.output('blob')
}