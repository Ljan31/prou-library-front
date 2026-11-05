<script setup lang="ts">
/**
 * TicketPrestamo.vue
 * Componente reutilizable de ticket de préstamo.
 * Genera vista previa modal + impresión directa + descarga PDF (80mm térmico).
 *
 * Uso:
 *   <TicketPrestamo
 *     v-model="showTicket"
 *     :prestamos="prestamosCreados"
 *     :usuario="selectedUser"
 *     :tipo="tipoPrestamo"
 *     :fecha-devolucion="fechaDevolucion"
 *     :biblioteca-nombre="auth.bibliotecaNombre"
 *   />
 */

import { computed } from 'vue'
import { useMedia } from '@/composables/useMedia'
import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'
// ─── Types ───────────────────────────────────────────────────────────────────
export interface Prestamo {
  id_prestamo: number
  estadoPrestamo: 'ACTIVO' | 'RENOVADO' | 'DEVUELTO'
  vencido: boolean
  renovaciones?: number
  condicionEntrega?: string
  condicionDevolucion?: string
  fechaPrestamo?: string
  fechaDevolucionEstimada?: string
  fechaDevolucionReal?: string
  observaciones?: string
  tipoPrestamo?: string
  tipoDocumentoGarantia?: string
  usuario?: {
    id_usuario?: number
    ci?: string | number
    nombreCompleto?: string; 
    domicilio?: string; celular?: string; matricula?: string
    username?: string
  }
  ejemplar?: {
    codigoEjemplar?: string
    codigo_ejemplar?: string
    codigoTopograficoConcat?: string
    estadoEjemplar?: string
    ubicacionFisica?: string
    autores?: string
    libro?: { titulo?: string }
    edicion?: {
      titulo?: string; autor?: string; imagenPortada?: string
      editorial?: string; edicion?: string; anoPublicacion?: number; isbn?: string
    }
  }
  biblioteca?: { nombre?: string; id_biblioteca?: number }
  bibliotecarioPrestamo?: { nombreCompleto?: string; ci?: string | number }
  bibliotecarioDevolucion?: { nombreCompleto?: string; ci?: string | number }
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
const { getUrl } = useMedia()
// ─── Props ───────────────────────────────────────────────────────────────────
const props = withDefaults(defineProps<{
  modelValue: boolean
  prestamos: Prestamo[]
  usuario: UsuarioTicket | null
  tipo?: 'DOMICILIO' | 'SALA'
  fechaDevolucion?: string
  bibliotecaNombre?: string | null
  logo?: string | null
}>(), {
  tipo: 'DOMICILIO',
  fechaDevolucion: '',
  bibliotecaNombre: null,
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

// ─── Estilos inline compartidos ──────────────────────────────────────────────
// Deben ser inline: la impresión y el PDF copian solo el innerHTML del ticket.
const TBL = 'width:100%; border-collapse:collapse;'
const LBL = 'font-weight:bold; width:36%; color:#333; padding:1.5px 4px 1.5px 0; font-size:9.5px; vertical-align:top;'
const VAL = 'font-size:9.5px; padding:1.5px 0; vertical-align:top;'

// ─── Helpers ─────────────────────────────────────────────────────────────────
const fechaHoy = new Date().toLocaleDateString('es-BO', {
  day: '2-digit', month: '2-digit', year: 'numeric'
})

function formatDate(s?: string) {
  if (!s) return '—'
  // Si viene YYYY-MM-DD, evitamos la conversión UTC
  const [year, month, day] = s.substring(0, 10).split('-')

  return `${day}/${month}/${year}`
}

function formatDateTime(s?: string | null) {
  if (!s) return '—'

  const date = new Date(s)

  return date.toLocaleDateString('es-BO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  })
}
const getTitulo = (p: Prestamo) => p.ejemplar?.edicion?.titulo ?? p.ejemplar?.libro?.titulo ?? '—'
const getAutor = (p: Prestamo) => p.ejemplar?.autores ?? '—'
const getAnio = (p: Prestamo) =>
  p.ejemplar?.edicion?.anoPublicacion ?? '—'
const getCodigo = (p: Prestamo) => {
  const topografico = p.ejemplar?.codigoTopograficoConcat;
  const ejemplar = p.ejemplar?.codigoEjemplar;
  
  return topografico || ejemplar || '—';
};

const DOC_LABELS: Record<string, string> = {
  CI: 'CARNET DE IDENTIDAD',
  MATRICULA: 'MATRÍCULA',
  CI_Y_MATRICULA: 'CI Y MATRÍCULA',
  PASAPORTE: 'PASAPORTE',
}
const docGarantia = computed(() => {
  const t = props.prestamos[0]?.tipoDocumentoGarantia
  return t ? (DOC_LABELS[t] ?? t.replace(/_/g, ' ')) : ''
})

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
  table { width: 100%; border-collapse: collapse; }
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

  if (!el) {
    console.error('No se encontró el contenido del ticket')
    return
  }

  const clone = el.cloneNode(true) as HTMLElement

  clone.style.cssText = `
    font-family: 'Courier New', Courier, monospace;
    font-size: 10px;
    width: 272px;
    box-sizing: border-box;
    background: white;
    color: black;
    padding: 12px;
    line-height: 1.5;
  `

  document.body.appendChild(clone)

  try {
    // Generar imagen del ticket
    const canvas = await html2canvas(clone, {
      scale: 3,
      useCORS: true,
      backgroundColor: '#ffffff',
      width: 272,
    })

    const imgData = canvas.toDataURL('image/png')

    // Calcular dimensiones del PDF
    const pdfW = 80
    const pdfH = (canvas.height / canvas.width) * pdfW + 8

    // Crear PDF térmico de 80 mm
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: [pdfW, pdfH],
    })

    pdf.addImage(
      imgData,
      'PNG',
      0,
      0,
      pdfW,
      pdfH - 8
    )

    // Descargar archivo
    const nombre = props.usuario?.persona.nombreCompleto
      .replace(/\s+/g, '_') ?? 'usuario'

    pdf.save(
      `ticket_prestamo_${nombre}_${fechaHoy.replace(/\//g, '-')}.pdf`
    )

  } catch (error) {
    console.error('Error al generar el PDF del ticket:', error)
    alert('No se pudo generar el PDF. Intente nuevamente.')

  } finally {
    document.body.removeChild(clone)
  }
}

function close() {
  emit('update:modelValue', false)
}
</script>

<template>
  <Teleport to="body">
    <div v-if="modelValue" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      @click.self="close">

      <div class="bg-white rounded-2xl shadow-2xl flex flex-col w-full max-w-sm max-h-[92vh]">

        <!-- Header -->
        <div class="flex items-center justify-between px-5 py-4 border-b border-slate-100 flex-shrink-0">
          <div class="flex items-center gap-2.5">
            <div class="w-8 h-8 rounded-lg overflow-hidden flex items-center justify-center shrink-0">
              <img
                v-if="logo"
                :src="getUrl(logo)"
                alt="Logo de biblioteca"
                class="w-full h-full object-contain"
              />

              <div v-else class="w-full h-full rounded-lg bg-slate-900 flex items-center justify-center">
                <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
              </div>
            </div>
            <div>
              <p class="font-semibold text-slate-800 text-sm">Ticket de Préstamo</p>
              <p class="text-xs text-slate-400">{{ prestamos.length }} ejemplar(es)</p>
            </div>
          </div>
          <button @click="close" aria-label="Cerrar" class="text-slate-400 hover:text-slate-600 transition-colors">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- Preview -->
        <div class="flex-1 overflow-y-auto p-5 bg-slate-100">
          <div class="mx-auto" style="width: 272px;">
            <div class="shadow-[0_4px_24px_rgba(0,0,0,0.18)] rounded-sm">

              <!-- ═══ CONTENIDO DEL TICKET (se captura para PDF e impresión) ═══ -->
              <div id="ticket-thermal-content" class="bg-white px-4 py-5"
                style="font-family:'Courier New',Courier,monospace; font-size:10px; width:272px; color:#000; line-height:1.5;">
                <div v-if="logo" class="text-center mb-3">
                  <img
                    v-if="logo"
                    :src="getUrl(logo)"
                    alt="Logo de biblioteca"
                    style="width: 50px; height: 50px; object-fit: contain; display: block; margin: 0 auto 6px;"
                  />
                  <p style="font-size:13px; font-weight:900; letter-spacing:3px; margin-bottom:1px;">SIGEB</p>
                  <p style="font-size:8px; color:#555; line-height:1.4;">{{ bibliotecaLabel }}</p>
                  <p style="font-size:8px; color:#555;">FHCE — UMSA</p>

                </div>
                <!-- Logo -->
                <div v-else class="text-center mb-3">
                  <svg width="52" height="52" viewBox="0 0 52 52" fill="none" xmlns="http://www.w3.org/2000/svg"
                    class="mx-auto mb-1">
                    <rect x="4" y="8" width="44" height="4" rx="1" fill="#1e293b" />
                    <rect x="8" y="12" width="4" height="24" rx="0.5" fill="#1e293b" />
                    <rect x="15" y="12" width="4" height="24" rx="0.5" fill="#1e293b" />
                    <rect x="22" y="12" width="4" height="24" rx="0.5" fill="#1e293b" />
                    <rect x="29" y="12" width="4" height="24" rx="0.5" fill="#1e293b" />
                    <rect x="36" y="12" width="4" height="24" rx="0.5" fill="#1e293b" />
                    <rect x="4" y="36" width="44" height="4" rx="1" fill="#1e293b" />
                    <rect x="2" y="40" width="48" height="3" rx="0.5" fill="#1e293b" />
                    <rect x="0" y="43" width="52" height="3" rx="0.5" fill="#1e293b" />
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

                  <table :style="TBL">
                    <tbody>
                      <tr>
                        <td :style="LBL">TÍTULO:</td>
                        <td :style="VAL">{{ getTitulo(p) }}</td>
                      </tr>
                      <tr>
                        <td :style="LBL">AUTOR:</td>
                        <td :style="VAL">{{ getAutor(p) }}</td>
                      </tr>
                      <tr>
                        <td :style="LBL">AÑO:</td>
                        <td :style="VAL">{{ getAnio(p) }}</td>
                      </tr>
                      <tr>
                        <td :style="LBL">CÓDIGO:</td>
                        <td :style="VAL + ' font-weight:bold;'">{{ getCodigo(p) }}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <hr style="border:none; border-top:1px dashed #999; margin:8px 0;" />

                <!-- Datos del usuario -->
                <table v-if="usuario" :style="TBL">
                  <tbody>
                    <tr>
                      <td :style="LBL">NOMBRE:</td>
                      <td :style="VAL + ' text-transform:uppercase; font-weight:bold;'">
                        {{ usuario.persona.nombreCompleto }}
                      </td>
                    </tr>
                    <tr>
                      <td :style="LBL">C.I.:</td>
                      <td :style="VAL">{{ usuario.persona.ci }}</td>
                    </tr>
                    <tr v-if="usuario.persona.matricula">
                      <td :style="LBL">MATRÍCULA:</td>
                      <td :style="VAL">{{ usuario.persona.matricula }}</td>
                    </tr>
                    <tr v-if="usuario.persona.domicilio">
                      <td :style="LBL">DOMICILIO:</td>
                      <td :style="VAL">{{ usuario.persona.domicilio }}</td>
                    </tr>
                    <tr v-if="usuario.persona.celular">
                      <td :style="LBL">CELULAR:</td>
                      <td :style="VAL">{{ usuario.persona.celular }}</td>
                    </tr>
                    <tr v-if="docGarantia">
                      <td :style="LBL">DOC. GARANTÍA:</td>
                      <td :style="VAL + ' font-weight:bold;'">{{ docGarantia }}</td>
                    </tr>
                  </tbody>
                </table>

                <hr style="border:none; border-top:1px dashed #999; margin:8px 0;" />

                <!-- Fechas -->
                <table :style="TBL">
                  <tbody>
                    <tr>
                      <td :style="LBL">FECHA:</td>
                      <td :style="VAL"> {{ formatDateTime(prestamos[0]?.  fechaPrestamo) }}</td>
                    </tr>
                    <tr v-if="tipo === 'DOMICILIO' && fechaDevolucion">
                      <td :style="LBL">DEVOLUCIÓN:</td>
                      <td :style="VAL + ' font-weight:bold; color:#c00;'">{{ formatDate(fechaDevolucion) }}</td>
                    </tr>
                    <tr v-else-if="tipo === 'SALA'">
                      <td :style="LBL">DEVOLUCIÓN:</td>
                      <td :style="VAL + ' color:#555; font-style:italic;'">Solo en sala — mismo día</td>
                    </tr>
                  </tbody>
                </table>

                <!-- Firma -->
                <div style="margin-top:22px; padding-top:4px; text-align:center;">
                  <div style="height:28px;" />
                  <div style="border-top:1px solid #000; width:120px; margin:0 auto 3px;" />
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

        <!-- Acciones -->
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