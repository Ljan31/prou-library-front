<script setup lang="ts">
/**
 * ReportePdfModal.vue
 * Modal de previsualización PDF para el módulo de Reportes SIGEB.
 *
 * Uso:
 *   <ReportePdfModal
 *     v-model="mostrarPdf"
 *     :tipo="form.tipo"
 *     :datos="datosPrevisualizacion"
 *   />
 *
 * Props:
 *   modelValue  — boolean — controla la visibilidad del modal (v-model)
 *   tipo        — TipoReporte — tipo de reporte a renderizar
 *   datos       — ReporteDatos — objeto con resumen + detalle según tipo
 *   tituloBiblioteca — string opcional — nombre de la biblioteca filtrada
 *
 * El PDF se genera con jsPDF + jsPDF-AutoTable (importados vía CDN en index.html
 * o instalados con: npm install jspdf jspdf-autotable)
 *
 * Si usas Vite, instala los paquetes y cambia los imports:
 *   import jsPDF from 'jspdf'
 *   import autoTable from 'jspdf-autotable'
 */

import { computed, nextTick, onUnmounted, ref, watch } from 'vue'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import SButton from '@/components/ui/SButton.vue'
import SSkeleton from '@/components/feedback/SSkeleton.vue'

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type TipoReporte =
  | 'inventario'
  | 'prestamos'
  | 'libros-mas-prestados'
  | 'estado-ejemplares'

export interface DetalleEjemplar {
  idEjemplar: number
  codigoEjemplar: string
  tituloLibro: string
  isbn: string
  biblioteca: string
  estado: string
  clasificacionDecimal: string
  ubicacionFisica: string
}

export interface DetallePrestamo {
  idPrestamo: number
  usuario: string
  ci: string
  libro: string
  isbn: string
  biblioteca: string
  fechaPrestamo: string
  fechaDevolucionEstimada: string
  fechaDevolucionReal: string | null
  estadoPrestamo: string
  tipoPrestamo: string
  diasRetraso: number
}

export interface LibroMasPrestado {
  libroId: number
  titulo: string
  isbn: string
  cantidadPrestamos: number
}

export interface EstadoBiblioteca {
  biblioteca: string
  disponibles: number
  prestados: number
  reservados: number
  reparacion: number
  perdidos: number
  danados: number
  deteriorados: number
  bajas: number
}

export interface ReporteDatos {
  resumen?: Record<string, unknown>
  detalle?: DetalleEjemplar[]
  prestamos?: DetallePrestamo[]
  libros?: LibroMasPrestado[]
  bibliotecas?: EstadoBiblioteca[]
}

// ─── Props / Emits ────────────────────────────────────────────────────────────

interface Props {
  modelValue: boolean
  tipo: TipoReporte | ''
  datos: ReporteDatos
  tituloBiblioteca?: string
}

const props = withDefaults(defineProps<Props>(), {
  tituloBiblioteca: '',
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
}>()

// ─── Estado interno ───────────────────────────────────────────────────────────

const generando = ref(false)
const pdfUrl = ref<string | null>(null)
const errorPdf = ref<string | null>(null)

// ─── Helpers de formateo ──────────────────────────────────────────────────────

function fechaLegible(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('es-BO', { day: '2-digit', month: 'short', year: 'numeric' })
}

function tituloReporte(tipo: TipoReporte | ''): string {
  const map: Record<TipoReporte, string> = {
    'inventario': 'Reporte de Inventario',
    'prestamos': 'Reporte de Préstamos',
    'libros-mas-prestados': 'Libros Más Prestados',
    'estado-ejemplares': 'Estado de Ejemplares por Biblioteca',
  }
  return tipo ? map[tipo] : 'Reporte'
}

// ─── Carga dinámica de jsPDF ──────────────────────────────────────────────────
// Si ya tienes jsPDF instalado via npm, reemplaza esta función por imports directos.

// async function cargarJsPDF(): Promise<{ jsPDF: any; autoTable: any }> {
//   // Intenta usar los globals si ya están cargados (CDN en index.html)
//   if ((window as any).jspdf && (window as any).jspdf.jsPDF) {
//     return {
//       jsPDF: (window as any).jspdf.jsPDF,
//       autoTable: (window as any).jspdf.jsPDF.autoTable ?? (window as any).jsPDFAutoTable,
//     }
//   }
//   // Carga dinámica como módulo ESM desde CDN
//   const [jsPDFMod, autoTableMod] = await Promise.all([
//     import('https://cdn.jsdelivr.net/npm/jspdf@2.5.1/+esm' as any),
//     import('https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.3/+esm' as any),
//   ])
//   return {
//     jsPDF: jsPDFMod.default ?? jsPDFMod.jsPDF,
//     autoTable: autoTableMod.default,
//   }
// }

// ─── Generación del PDF ───────────────────────────────────────────────────────

async function generarPDF() {
  generando.value = true
  errorPdf.value = null

  // Revocar URL anterior si existe
  if (pdfUrl.value) {
    URL.revokeObjectURL(pdfUrl.value)
    pdfUrl.value = null
  }

  try {
    // const { jsPDF, autoTable } = await cargarJsPDF()
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'letter' })

    const INDIGO = [79, 70, 229] as [number, number, number]     // indigo-600
    const SLATE8 = [30, 41, 59] as [number, number, number]      // slate-800
    const SLATE5 = [100, 116, 139] as [number, number, number]   // slate-500
    const WHITE  = [255, 255, 255] as [number, number, number]
    const BGHEAD = [238, 242, 255] as [number, number, number]   // indigo-50

    const pageW = doc.internal.pageSize.getWidth()
    const hoy = new Date().toLocaleDateString('es-BO', { day: '2-digit', month: 'long', year: 'numeric' })
    const titulo = tituloReporte(props.tipo)

    // ── Encabezado ────────────────────────────────────────────────────────────
    doc.setFillColor(...INDIGO)
    doc.rect(0, 0, pageW, 22, 'F')

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(14)
    doc.setTextColor(...WHITE)
    doc.text('SIGEB — Sistema de Gestión Bibliográfica · UMSA', 14, 9)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.text(titulo, 14, 16)

    // Fecha + biblioteca (derecha)
    doc.setFontSize(8)
    doc.text(`Generado: ${hoy}`, pageW - 14, 9, { align: 'right' })
    if (props.tituloBiblioteca) {
      doc.text(props.tituloBiblioteca, pageW - 14, 15, { align: 'right' })
    }

    let startY = 28

    // ── Resumen (chips) ───────────────────────────────────────────────────────
    const resumen = props.datos.resumen
    if (resumen) {
      const entries = Object.entries(resumen).filter(([, v]) => typeof v === 'number')
      const chipW = 38
      const chipH = 14
      const gap = 4
      const totalW = entries.length * (chipW + gap) - gap
      let cx = 14

      entries.forEach(([key, val]) => {
        doc.setFillColor(...BGHEAD)
        doc.roundedRect(cx, startY, chipW, chipH, 2, 2, 'F')
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(11)
        doc.setTextColor(...INDIGO)
        doc.text(String(val), cx + chipW / 2, startY + 7, { align: 'center' })
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(7)
        doc.setTextColor(...SLATE5)
        const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).trim()
        doc.text(label, cx + chipW / 2, startY + 12, { align: 'center' })
        cx += chipW + gap
      })
      startY += chipH + 8
    }

    // ── Línea separadora ──────────────────────────────────────────────────────
    doc.setDrawColor(226, 232, 240) // slate-200
    doc.setLineWidth(0.3)
    doc.line(14, startY, pageW - 14, startY)
    startY += 4

    // ── Tabla según tipo ──────────────────────────────────────────────────────
    const estiloBase = {
      startY,
      margin: { left: 14, right: 14 },
      styles: {
        fontSize: 8,
        cellPadding: 3,
        font: 'helvetica',
        textColor: SLATE8,
        lineColor: [226, 232, 240] as [number, number, number],
        lineWidth: 0.2,
      },
      headStyles: {
        fillColor: INDIGO,
        textColor: WHITE,
        fontStyle: 'bold' as const,
        fontSize: 8,
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252] as [number, number, number],
      },
      didDrawPage: (data: any) => {
        // Footer en cada página
        const pageCount = doc.getNumberOfPages()
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(7)
        doc.setTextColor(...SLATE5)
        doc.text(
          `SIGEB · ${titulo} · ${hoy}  —  Página ${data.pageNumber} de ${pageCount}`,
          pageW / 2,
          doc.internal.pageSize.getHeight() - 6,
          { align: 'center' }
        )
      },
    }

    // Inventario
    if (props.tipo === 'inventario' && props.datos.detalle?.length) {
      autoTable(doc, {
        ...estiloBase,
        head: [['Código', 'Título', 'ISBN', 'Biblioteca', 'Estado', 'Clasificación', 'Ubicación']],
        body: props.datos.detalle.map(e => [
          e.codigoEjemplar,
          e.tituloLibro,
          e.isbn,
          e.biblioteca,
          e.estado,
          e.clasificacionDecimal,
          e.ubicacionFisica,
        ]),
        columnStyles: {
          0: { cellWidth: 22 },
          1: { cellWidth: 60 },
          2: { cellWidth: 30 },
          3: { cellWidth: 40 },
          4: { cellWidth: 22 },
          5: { cellWidth: 25 },
          6: { cellWidth: 'auto' },
        },
      })
    }

    // Préstamos
    else if (props.tipo === 'prestamos' && props.datos.prestamos?.length) {
      autoTable(doc, {
        ...estiloBase,
        head: [['#', 'Usuario', 'CI', 'Libro', 'Biblioteca', 'F. Préstamo', 'F. Estimada', 'Estado', 'Tipo', 'Días retraso']],
        body: props.datos.prestamos.map(p => [
          p.idPrestamo,
          p.usuario,
          p.ci,
          p.libro,
          p.biblioteca,
          fechaLegible(p.fechaPrestamo),
          fechaLegible(p.fechaDevolucionEstimada),
          p.estadoPrestamo,
          p.tipoPrestamo,
          p.diasRetraso > 0 ? `+${p.diasRetraso}d` : '—',
        ]),
        columnStyles: {
          0: { cellWidth: 10, halign: 'center' },
          1: { cellWidth: 38 },
          2: { cellWidth: 18 },
          3: { cellWidth: 50 },
          4: { cellWidth: 38 },
          5: { cellWidth: 24 },
          6: { cellWidth: 24 },
          7: { cellWidth: 20 },
          8: { cellWidth: 18 },
          9: { cellWidth: 18, halign: 'center' },
        },
        // Color condicional por estado
        didParseCell: (data: any) => {
          if (data.section === 'body' && data.column.index === 7) {
            const estado = String(data.cell.raw ?? '')
            if (estado === 'VENCIDO')   data.cell.styles.textColor = [185, 28, 28]
            if (estado === 'ACTIVO')    data.cell.styles.textColor = [4, 120, 87]
            if (estado === 'RENOVADO')  data.cell.styles.textColor = [29, 78, 216]
          }
          if (data.section === 'body' && data.column.index === 9) {
            if (String(data.cell.raw ?? '').startsWith('+')) {
              data.cell.styles.textColor = [185, 28, 28]
              data.cell.styles.fontStyle = 'bold'
            }
          }
        },
      })
    }

    // Libros más prestados
    else if (props.tipo === 'libros-mas-prestados' && props.datos.libros?.length) {
      autoTable(doc, {
        ...estiloBase,
        head: [['#', 'Título', 'ISBN', 'Cantidad de préstamos']],
        body: props.datos.libros.map((l, i) => [
          i + 1,
          l.titulo,
          l.isbn,
          l.cantidadPrestamos,
        ]),
        columnStyles: {
          0: { cellWidth: 12, halign: 'center' },
          1: { cellWidth: 120 },
          2: { cellWidth: 40 },
          3: { cellWidth: 40, halign: 'center', fontStyle: 'bold' },
        },
      })
    }

    // Estado ejemplares por biblioteca
    else if (props.tipo === 'estado-ejemplares' && props.datos.bibliotecas?.length) {
      autoTable(doc, {
        ...estiloBase,
        head: [['Biblioteca', 'Disponibles', 'Prestados', 'Reservados', 'Reparación', 'Perdidos', 'Dañados', 'Deteriorados', 'Bajas']],
        body: props.datos.bibliotecas.map(b => [
          b.biblioteca,
          b.disponibles,
          b.prestados,
          b.reservados,
          b.reparacion,
          b.perdidos,
          b.danados,
          b.deteriorados,
          b.bajas,
        ]),
        columnStyles: {
          0: { cellWidth: 60 },
          1: { halign: 'center' },
          2: { halign: 'center' },
          3: { halign: 'center' },
          4: { halign: 'center' },
          5: { halign: 'center' },
          6: { halign: 'center' },
          7: { halign: 'center' },
          8: { halign: 'center' },
        },
        didParseCell: (data: any) => {
          if (data.section === 'body') {
            const val = Number(data.cell.raw ?? 0)
            // Rojo si hay pérdidas o daños (cols 5 y 6)
            if ([5, 6].includes(data.column.index) && val > 0) {
              data.cell.styles.textColor = [185, 28, 28]
              data.cell.styles.fontStyle = 'bold'
            }
            // Verde para disponibles (col 1)
            if (data.column.index === 1) {
              data.cell.styles.textColor = [4, 120, 87]
              data.cell.styles.fontStyle = 'bold'
            }
          }
        },
      })
    }

    else {
      // Sin datos
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      doc.setTextColor(...SLATE5)
      doc.text('No hay datos disponibles para este reporte.', pageW / 2, startY + 20, { align: 'center' })
    }

    // ── Exportar como Blob → URL objeto ──────────────────────────────────────
    const blob = doc.output('blob')
    pdfUrl.value = URL.createObjectURL(blob)

  } catch (e: any) {
    console.error('[ReportePdfModal] Error al generar PDF:', e)
    errorPdf.value = 'No se pudo generar el PDF. Verifica que jsPDF esté instalado.'
  } finally {
    generando.value = false
  }
}

// ─── Ciclo de vida del modal ──────────────────────────────────────────────────

watch(() => props.modelValue, async (visible) => {
  if (visible) {
    await nextTick()
    generarPDF()
  } else {
    // Limpiar URL al cerrar para liberar memoria
    if (pdfUrl.value) {
      URL.revokeObjectURL(pdfUrl.value)
      pdfUrl.value = null
    }
    errorPdf.value = null
  }
})

onUnmounted(() => {
  if (pdfUrl.value) URL.revokeObjectURL(pdfUrl.value)
})

function cerrar() {
  emit('update:modelValue', false)
}

function descargar() {
  if (!pdfUrl.value) return
  const a = document.createElement('a')
  a.href = pdfUrl.value
  a.download = `reporte_${props.tipo}_${new Date().toISOString().slice(0, 10)}.pdf`
  a.click()
}

// Cerrar con Escape
function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') cerrar()
}

watch(() => props.modelValue, (v) => {
  if (v) window.addEventListener('keydown', onKeydown)
  else   window.removeEventListener('keydown', onKeydown)
}, { immediate: true })

onUnmounted(() => window.removeEventListener('keydown', onKeydown))

// ─── Computed ──────────────────────────────────────────────────────────────────
const titulo = computed(() => tituloReporte(props.tipo))
</script>

<template>
  <!-- Backdrop -->
  <Teleport to="body">
    <Transition name="modal-fade">
      <div
        v-if="modelValue"
        class="fixed inset-0 z-50 flex items-center justify-center p-4"
        style="background: rgba(15, 23, 42, 0.55); backdrop-filter: blur(2px);"
        @click.self="cerrar"
      >
        <!-- Panel del modal -->
        <Transition name="modal-slide">
          <div
            v-if="modelValue"
            class="relative bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden"
            style="width: min(95vw, 1100px); height: min(90vh, 820px);"
            role="dialog"
            aria-modal="true"
            :aria-label="`Vista previa PDF: ${titulo}`"
          >

            <!-- ── Header del modal ──────────────────────────────────────────── -->
            <div class="flex items-center justify-between gap-4 px-5 py-3.5 border-b border-slate-100 shrink-0">
              <div class="flex items-center gap-3">
                <!-- Ícono PDF -->
                <div class="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center shrink-0">
                  <svg class="w-4 h-4 text-red-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                    <line x1="9" y1="13" x2="15" y2="13"/>
                    <line x1="9" y1="17" x2="11" y2="17"/>
                  </svg>
                </div>
                <div>
                  <h2 class="text-sm font-semibold text-slate-900 leading-tight">{{ titulo }}</h2>
                  <p class="text-xs text-slate-400">
                    Vista previa del PDF
                    <span v-if="tituloBiblioteca"> · {{ tituloBiblioteca }}</span>
                  </p>
                </div>
              </div>

              <!-- Acciones del header -->
              <div class="flex items-center gap-2">
                <SButton
                  v-if="pdfUrl"
                  size="sm"
                  variant="secondary"
                  @click="generarPDF"
                >
                  <svg class="w-3.5 h-3.5 mr-1.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="23 4 23 10 17 10"/>
                    <polyline points="1 20 1 14 7 14"/>
                    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
                  </svg>
                  Regenerar
                </SButton>
                <SButton
                  v-if="pdfUrl"
                  size="sm"
                  @click="descargar"
                >
                  <svg class="w-3.5 h-3.5 mr-1.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="7 10 12 15 17 10"/>
                    <line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                  Descargar PDF
                </SButton>
                <!-- Cerrar -->
                <button
                  class="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                  aria-label="Cerrar vista previa"
                  @click="cerrar"
                >
                  <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
            </div>

            <!-- ── Cuerpo del modal ───────────────────────────────────────────── -->
            <div class="flex-1 min-h-0 relative bg-slate-100">

              <!-- Estado: generando -->
              <div
                v-if="generando"
                class="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-white"
              >
                <div class="w-12 h-12 rounded-full border-4 border-indigo-100 border-t-indigo-500 animate-spin"/>
                <div class="text-center space-y-2">
                  <p class="text-sm font-medium text-slate-700">Generando PDF…</p>
                  <p class="text-xs text-slate-400">Esto tarda solo un momento</p>
                </div>
                <div class="w-64 space-y-2.5 mt-2">
                  <SSkeleton width="100%" height="0.6rem" class="rounded"/>
                  <SSkeleton width="85%" height="0.6rem" class="rounded"/>
                  <SSkeleton width="92%" height="0.6rem" class="rounded"/>
                  <SSkeleton width="70%" height="0.6rem" class="rounded"/>
                </div>
              </div>

              <!-- Estado: error -->
              <div
                v-else-if="errorPdf"
                class="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-white p-6"
              >
                <div class="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center">
                  <svg class="w-7 h-7 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="15" y1="9" x2="9" y2="15"/>
                    <line x1="9" y1="9" x2="15" y2="15"/>
                  </svg>
                </div>
                <div class="text-center">
                  <p class="text-sm font-semibold text-slate-800 mb-1">No se pudo generar el PDF</p>
                  <p class="text-xs text-slate-500 max-w-sm">{{ errorPdf }}</p>
                </div>
                <SButton size="sm" @click="generarPDF">Intentar de nuevo</SButton>
              </div>

              <!-- Estado: PDF listo (iframe) -->
              <iframe
                v-else-if="pdfUrl"
                :src="pdfUrl + '#toolbar=1&navpanes=0&view=FitH'"
                class="w-full h-full border-0"
                title="Vista previa del reporte PDF"
              />
            </div>

            <!-- ── Footer ────────────────────────────────────────────────────── -->
            <div class="flex items-center justify-between px-5 py-2.5 border-t border-slate-100 bg-slate-50 shrink-0">
              <p class="text-xs text-slate-400">
                <svg class="w-3.5 h-3.5 inline-block mr-1 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                Generado localmente en tu navegador. Los datos no se envían a ningún servidor externo.
              </p>
              <SButton variant="ghost" size="sm" @click="cerrar">Cerrar</SButton>
            </div>

          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.2s ease;
}
.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}

.modal-slide-enter-active {
  transition: opacity 0.22s ease, transform 0.22s ease;
}
.modal-slide-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}
.modal-slide-enter-from,
.modal-slide-leave-to {
  opacity: 0;
  transform: translateY(12px) scale(0.98);
}
</style>