<script setup lang="ts">
/**
 * TicketPrestamo.vue
 * Componente reutilizable de ticket de préstamo.
 * Genera vista previa modal + impresión directa + descarga PDF (80mm térmico).
 *
 * Uso:
 *   <TicketPrestamo
 *     :prestamos="prestamosCreados"
 *     :usuario="selectedUser"
 *     :tipo="tipoPrestamo"
 *     :fecha-devolucion="fechaDevolucion"
 *     :biblioteca-nombre="auth.bibliotecaNombre"
 *     v-model="showTicket"
 *   />
 */

import { computed } from 'vue'

// ─── Props ───────────────────────────────────────────────────────────────────
const props = withDefaults(defineProps<{
  modelValue: boolean
  prestamos: PrestamoTicket[]
  usuario: UsuarioTicket | null
  tipo?: 'DOMICILIO' | 'SALA'
  fechaDevolucion?: string
  bibliotecaNombre?: string | null
}>(), {
  tipo: 'DOMICILIO',
  fechaDevolucion: '',
  bibliotecaNombre: null,
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

// ─── Types ───────────────────────────────────────────────────────────────────
export interface PrestamoTicket {
  id_prestamo: number
  ejemplar?: {
    codigoEjemplar?: string
    ubicacionFisica?: string
    edicion?: {
      titulo?: string
      autor?: string
      anoPublicacion?: number
      isbn?: string
      imagenPortada?: string
      editorial?: string
    }
  }
  libro?: {
    titulo?: string
    autor?: string
    anio?: number | string
    anoPublicacion?: number
    isbn?: string
  }
  bibliotecarioPrestamo?: {
    id_usuario: number
    username: string
    nombreCompleto: string
    ci: number | string
    email?: string | null
  }
  tipoDocumentoGarantia?: string
}

export interface UsuarioTicket {
  id_usuario: number
  persona: {
    nombreCompleto: string
    ci: number | string
    matricula?: string | null
    domicilio?: string
    celular?: string
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const fechaHoy = new Date().toLocaleDateString('es-BO', {
  day: '2-digit', month: '2-digit', year: 'numeric'
})

function formatDate(s?: string) {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('es-BO', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function getTitulo(p: PrestamoTicket) {
  return p.ejemplar?.edicion?.titulo ?? p.libro?.titulo ?? '—'
}
function getAutor(p: PrestamoTicket) {
  return p.ejemplar?.edicion?.autor ?? p.libro?.autor ?? '—'
}
function getAnio(p: PrestamoTicket) {
  return p.ejemplar?.edicion?.anoPublicacion ?? p.libro?.anio ?? p.libro?.anoPublicacion ?? '—'
}
function getCodigo(p: PrestamoTicket) {
  return p.ejemplar?.codigoEjemplar ?? '—'
}
function getIsbn(p: PrestamoTicket) {
  return p.ejemplar?.edicion?.isbn ?? p.libro?.isbn ?? '—'
}
function getEditorial(p: PrestamoTicket) {
  return p.ejemplar?.edicion?.editorial ?? '—'
}

const bibliotecaLabel = computed(() => props.bibliotecaNombre ?? 'Biblioteca FHCE — UMSA')

// ─── Imprimir (ventana del sistema) ──────────────────────────────────────────
function imprimir() {
  const el = document.getElementById('ticket-thermal-content')
  if (!el) return
  const w = window.open('', '_blank', 'width=420,height=800')
  if (!w) return
  w.document.write(`<!DOCTYPE html>
<html><head>
<meta charset="UTF-8">
<title>Ticket SIGEB</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  @page { size: 80mm auto; margin: 4mm; }
  body {
    font-family: 'Courier New', Courier, monospace;
    font-size: 10px;
    width: 72mm;
    color: #000;
    background: #fff;
  }
  .ticket { padding: 4px; }
  .logo-svg { display: block; margin: 0 auto 4px; }
  .center { text-align: center; }
  .bold { font-weight: bold; }
  .header-title { font-size: 14px; font-weight: bold; letter-spacing: 3px; }
  .header-sub { font-size: 8px; color: #555; }
  .divider { border: none; border-top: 1px dashed #000; margin: 6px 0; }
  .section-title { font-size: 8px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; color: #555; margin-bottom: 3px; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 1.5px 0; font-size: 9.5px; vertical-align: top; line-height: 1.4; }
  td.label { font-weight: bold; width: 36%; color: #333; padding-right: 4px; }
  td.value { color: #000; }
  .book-divider { border-top: 1px dotted #aaa; margin: 5px 0; }
  .firma-area { margin-top: 20px; border-top: 1px solid #000; padding-top: 3px; text-align: center; }
  .footer-note { font-size: 7.5px; color: #777; text-align: center; margin-top: 6px; line-height: 1.5; }
  @media print { body { width: 72mm; } }
</style>
</head><body>
<div class="ticket">
${el.innerHTML}
</div>
</body></html>`)
  w.document.close()
  w.focus()
  setTimeout(() => { w.print(); w.close() }, 400)
}

// ─── Descargar PDF (html2canvas + jsPDF via CDN) ──────────────────────────────
async function descargarPDF() {
  const el = document.getElementById('ticket-thermal-content')
  if (!el) return

  // Carga dinámica de librerías si no están disponibles
  if (!(window as any).html2canvas) {
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js')
  }
  if (!(window as any).jspdf) {
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js')
  }

  const h2c = (window as any).html2canvas
  const { jsPDF } = (window as any).jspdf

  // Clonar y aplicar estilos monoespaciados para el render
  const clone = el.cloneNode(true) as HTMLElement
  clone.style.cssText = `
    font-family: 'Courier New', Courier, monospace;
    font-size: 10px;
    width: 272px;
    background: white;
    color: black;
    padding: 12px;
    line-height: 1.5;
  `
  document.body.appendChild(clone)

  try {
    const canvas = await h2c(clone, {
      scale: 3,
      useCORS: true,
      backgroundColor: '#ffffff',
      width: 272,
    })

    const imgData = canvas.toDataURL('image/png')
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: [80, (canvas.height / canvas.width) * 80 + 8],
    })

    const pdfW = pdf.internal.pageSize.getWidth()
    const pdfH = (canvas.height / canvas.width) * pdfW

    pdf.addImage(imgData, 'PNG', 0, 0, pdfW, pdfH)

    const nombre = props.usuario?.persona.nombreCompleto.replace(/\s+/g, '_') ?? 'usuario'
    pdf.save(`ticket_prestamo_${nombre}_${fechaHoy.replace(/\//g, '-')}.pdf`)
  } finally {
    document.body.removeChild(clone)
  }
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = src; s.onload = () => resolve(); s.onerror = reject
    document.head.appendChild(s)
  })
}

function close() {
  emit('update:modelValue', false)
}
</script>

<template>
  <!-- ─── Modal Overlay ─────────────────────────────────────────────────────── -->
  <Teleport to="body">
    <div v-if="modelValue" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      @click.self="close">

      <div class="bg-white rounded-2xl shadow-2xl flex flex-col w-full max-w-sm max-h-[92vh]">

        <!-- Header -->
        <div class="flex items-center justify-between px-5 py-4 border-b border-slate-100 flex-shrink-0">
          <div class="flex items-center gap-2.5">
            <div class="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center">
              <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
            </div>
            <div>
              <p class="font-semibold text-slate-800 text-sm">Ticket de Préstamo</p>
              <p class="text-xs text-slate-400">{{ prestamos.length }} ejemplar(es)</p>
            </div>
          </div>
          <button @click="close" class="text-slate-400 hover:text-slate-600 transition-colors">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- Preview area (scrollable) -->
        <div class="flex-1 overflow-y-auto p-5 bg-slate-100">
          <!-- Sombra tipo papel -->
          <div class="mx-auto" style="width: 272px;">
            <div class="shadow-[0_4px_24px_rgba(0,0,0,0.18)] rounded-sm">

              <!-- ═══ CONTENIDO DEL TICKET (este div se captura para PDF e impresión) ═══ -->
              <div id="ticket-thermal-content" class="bg-white px-4 py-5 space-y-0"
                style="font-family:'Courier New',Courier,monospace; font-size:10px; width:272px; color:#000; line-height:1.5;">

                <!-- Logo SVG de biblioteca de ejemplo -->
                <div class="text-center mb-3">
                  <svg width="52" height="52" viewBox="0 0 52 52" fill="none" xmlns="http://www.w3.org/2000/svg"
                    class="mx-auto mb-1">
                    <!-- Columnas de biblioteca -->
                    <rect x="4" y="8" width="44" height="4" rx="1" fill="#1e293b" />
                    <rect x="8" y="12" width="4" height="24" rx="0.5" fill="#1e293b" />
                    <rect x="15" y="12" width="4" height="24" rx="0.5" fill="#1e293b" />
                    <rect x="22" y="12" width="4" height="24" rx="0.5" fill="#1e293b" />
                    <rect x="29" y="12" width="4" height="24" rx="0.5" fill="#1e293b" />
                    <rect x="36" y="12" width="4" height="24" rx="0.5" fill="#1e293b" />
                    <!-- Base -->
                    <rect x="4" y="36" width="44" height="4" rx="1" fill="#1e293b" />
                    <!-- Escalones -->
                    <rect x="2" y="40" width="48" height="3" rx="0.5" fill="#1e293b" />
                    <rect x="0" y="43" width="52" height="3" rx="0.5" fill="#1e293b" />
                    <!-- Libro abierto pequeño encima -->
                    <path d="M21 6 Q26 4 31 6 Q26 8 21 6Z" fill="#4f46e5" />
                  </svg>

                  <p style="font-size:13px; font-weight:900; letter-spacing:3px; margin-bottom:1px;">SIGEB</p>
                  <p style="font-size:8px; color:#555; line-height:1.4;">{{ bibliotecaLabel }}</p>
                  <p style="font-size:8px; color:#555;">FHCE — UMSA</p>
                </div>

                <hr style="border:none; border-top:1px dashed #999; margin:6px 0;" />

                <!-- Un bloque por libro prestado -->
                <div v-for="(p, idx) in prestamos" :key="p.id_prestamo">
                  <div v-if="idx > 0" style="border-top:1px dotted #bbb; margin:7px 0;" />

                  <!-- <p
                    style="font-size:8px; font-weight:bold; text-transform:uppercase; color:#666; margin-bottom:3px; letter-spacing:0.5px;">
                    Ejemplar {{ prestamos.length > 1 ? idx + 1 : '' }} · #{{ p.id_prestamo }}
                  </p> -->

                  <table style="width:100%; border-collapse:collapse;">
                    <tr>
                      <td
                        style="font-weight:bold; width:36%; color:#333; padding:1.5px 4px 1.5px 0; font-size:9.5px; vertical-align:top;">
                        TÍTULO:</td>
                      <td style="font-size:9.5px; padding:1.5px 0; vertical-align:top;">{{ getTitulo(p) }}</td>
                    </tr>
                    <tr>
                      <td
                        style="font-weight:bold; color:#333; padding:1.5px 4px 1.5px 0; font-size:9.5px; vertical-align:top;">
                        AUTOR:</td>
                      <td style="font-size:9.5px; padding:1.5px 0;">{{ getAutor(p) }}</td>
                    </tr>
                    <tr>
                      <td style="font-weight:bold; color:#333; padding:1.5px 4px 1.5px 0; font-size:9.5px;">AÑO:</td>
                      <td style="font-size:9.5px; padding:1.5px 0;">{{ getAnio(p) }}</td>
                    </tr>
                    <!-- <tr>
                      <td style="font-weight:bold; color:#333; padding:1.5px 4px 1.5px 0; font-size:9.5px;">EDITORIAL:
                      </td>
                      <td style="font-size:9.5px; padding:1.5px 0;">{{ getEditorial(p) }}</td>
                    </tr> -->
                    <tr>
                      <td style="font-weight:bold; color:#333; padding:1.5px 4px 1.5px 0; font-size:9.5px;">CÓDIGO:</td>
                      <td style="font-size:9.5px; padding:1.5px 0; font-weight:bold;">{{ getCodigo(p) }}</td>
                    </tr>
                    <!-- <tr>
                      <td style="font-weight:bold; color:#333; padding:1.5px 4px 1.5px 0; font-size:9.5px;">ISBN:</td>
                      <td style="font-size:9.5px; padding:1.5px 0;">{{ getIsbn(p) }}</td>
                    </tr> -->
                    <!-- <tr v-if="p.ejemplar?.ubicacionFisica">
                      <td style="font-weight:bold; color:#333; padding:1.5px 4px 1.5px 0; font-size:9.5px;">UBICACIÓN:
                      </td>
                      <td style="font-size:9.5px; padding:1.5px 0;">{{ p.ejemplar.ubicacionFisica }}</td>
                    </tr> -->
                  </table>
                </div>

                <hr style="border:none; border-top:1px dashed #999; margin:8px 0;" />

                <!-- Datos del usuario -->
                <!-- <p
                  style="font-size:8px; font-weight:bold; text-transform:uppercase; color:#666; margin-bottom:3px; letter-spacing:0.5px;">
                  Datos del usuario</p> -->

                <table style="width:100%; border-collapse:collapse;" v-if="usuario">
                  <tr>
                    <td
                      style="font-weight:bold; width:36%; color:#333; padding:1.5px 4px 1.5px 0; font-size:9.5px; vertical-align:top;">
                      NOMBRE:</td>
                    <td style="font-size:9.5px; padding:1.5px 0; text-transform:uppercase; font-weight:bold;">{{
                      usuario.persona.nombreCompleto }}</td>
                  </tr>
                  <tr>
                    <td style="font-weight:bold; color:#333; padding:1.5px 4px 1.5px 0; font-size:9.5px;">C.I.:</td>
                    <td style="font-size:9.5px; padding:1.5px 0;">{{ usuario.persona.ci }}</td>
                  </tr>
                  <tr v-if="usuario.persona.matricula">
                    <td style="font-weight:bold; color:#333; padding:1.5px 4px 1.5px 0; font-size:9.5px;">MATRÍCULA:
                    </td>
                    <td style="font-size:9.5px; padding:1.5px 0;">{{ usuario.persona.matricula }}</td>
                  </tr>
                  <tr v-if="usuario.persona.domicilio">
                    <td
                      style="font-weight:bold; color:#333; padding:1.5px 4px 1.5px 0; font-size:9.5px; vertical-align:top;">
                      DOMICILIO:</td>
                    <td style="font-size:9.5px; padding:1.5px 0;">{{ usuario.persona.domicilio }}</td>
                  </tr>
                  <tr v-if="usuario.persona.celular">
                    <td style="font-weight:bold; color:#333; padding:1.5px 4px 1.5px 0; font-size:9.5px;">CELULAR:</td>
                    <td style="font-size:9.5px; padding:1.5px 0;">{{ usuario.persona.celular }}</td>
                  </tr>
                  <tr v-if="prestamos[0]?.tipoDocumentoGarantia">
                    <td style="font-weight:bold; color:#333; padding:1.5px 4px 1.5px 0; font-size:9.5px;">
                      DOC. GARANTÍA:
                    </td>
                    <td style="font-size:9.5px; padding:1.5px 0; font-weight:bold;">
                      {{ prestamos[0]?.tipoDocumentoGarantia }}
                    </td>
                  </tr>
                </table>

                <hr style="border:none; border-top:1px dashed #999; margin:8px 0;" />

                <!-- Fechas y tipo -->
                <table style="width:100%; border-collapse:collapse;">
                  <tr>
                    <td style="font-weight:bold; width:36%; color:#333; padding:1.5px 4px 1.5px 0; font-size:9.5px;">
                      FECHA:</td>
                    <td style="font-size:9.5px; padding:1.5px 0;">{{ fechaHoy }}</td>
                  </tr>
                  <!-- <tr>
                    <td style="font-weight:bold; color:#333; padding:1.5px 4px 1.5px 0; font-size:9.5px;">TIPO:</td>
                    <td style="font-size:9.5px; padding:1.5px 0; font-weight:bold;">{{ tipo }}</td>
                  </tr> -->
                  <tr v-if="tipo === 'DOMICILIO' && fechaDevolucion">
                    <td
                      style="font-weight:bold; color:#333; padding:1.5px 4px 1.5px 0; font-size:9.5px; vertical-align:top;">
                      DEVOLUCIÓN:</td>
                    <td style="font-size:9.5px; padding:1.5px 0; font-weight:bold; color:#c00;">{{
                      formatDate(fechaDevolucion) }}</td>
                  </tr>
                  <tr v-else-if="tipo === 'SALA'">
                    <td style="font-weight:bold; color:#333; padding:1.5px 4px 1.5px 0; font-size:9.5px;">DEVOLUCIÓN:
                    </td>
                    <td style="font-size:9.5px; padding:1.5px 0; color:#555; font-style:italic;">Solo en sala — mismo
                      día</td>
                  </tr>
                </table>

                <!-- Firma -->
                <div style="margin-top:22px; padding-top:4px; text-align:center;">
                  <!-- Espacio para firma física -->
                  <div style="height:28px;" />
                  <div style="border-top:1px solid #000; width:120px; margin:0 auto 3px;" />
                  <!-- <p style="font-size:9px; color:#444; font-weight:bold;">FIRMA RESPONSABLE</p> -->
                  <!-- <p style="font-size:9px; color:#555; margin-top:2px;">{{ bibliotecaLabel }}</p> -->
                  <p style="font-size:9px; color:#444; font-weight:bold;">
                    RESPONSABLE: {{ prestamos[0]?.bibliotecarioPrestamo?.nombreCompleto || '—' }}
                  </p>
                </div>

                <!-- Nota legal -->
                <p style="font-size:7.5px; color:#888; text-align:center; margin-top:8px; line-height:1.5;">
                  Este comprobante acredita el préstamo de los<br />
                  ejemplares descritos. Conservar hasta su devolución.<br />
                  SIGEB — Sistema de Gestión Bibliográfica
                </p>

              </div>
              <!-- fin ticket-thermal-content -->
            </div>
          </div>
        </div>

        <!-- Botones de acción -->
        <div class="flex gap-2 p-4 border-t border-slate-100 flex-shrink-0">
          <button @click="close"
            class="px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
            Cerrar
          </button>
          <button @click="descargarPDF"
            class="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-all flex items-center justify-center gap-2">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
            </svg>
            PDF
          </button>
          <button @click="imprimir"
            class="flex-1 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold transition-all flex items-center justify-center gap-2">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Imprimir
          </button>
        </div>

      </div>
    </div>
  </Teleport>
</template>