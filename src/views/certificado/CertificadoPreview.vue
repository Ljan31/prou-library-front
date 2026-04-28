<script setup lang="ts">
/**
 * CertificadoPreview.vue
 *
 * Muestra el certificado en un modal de vista previa con opción de imprimir.
 * Esto genera el PDF desde el frontend (no del backend).
 * El QR apunta al endpoint de validación.
 */
import { computed, onMounted, onUnmounted } from 'vue'

interface Certificado {
  id_certificado: number
  fechaEmision: string
  fechaVencimiento: string
  codigo_verificacion: string
  estadoCertificado: 'VIGENTE' | 'VENCIDO' | 'ANULADO'
  bibliotecaNombre?: string
  bibliotecario?: { nombreCompleto?: string }
}

const props = defineProps<{
  certificado: Certificado
  nombreUsuario: string
  ciUsuario: string
}>()

const emit = defineEmits<{ close: [] }>()

// Cerrar con Escape
function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close')
}
const origin = computed(() => {
  return typeof window !== 'undefined'
    ? window.location.origin
    : ''
})
onMounted(() => {
  if (typeof window !== 'undefined') {
    window.addEventListener('keydown', onKeydown)
  }
})

onUnmounted(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('keydown', onKeydown)
  }
})

// QR apuntando a validación
const qrUrl = computed(() => {
  if (!origin.value) return ''
  const url = `${window.location.origin}/certificados?tab=validar&codigo=${props.certificado.codigo_verificacion}`
  return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(url)}&ecc=M&margin=4`
})

function formatDateTime(s?: string) {
  if (!s) return '—'
  return new Date(s).toLocaleString('es-BO', {
    day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function formatDate(s?: string) {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('es-BO', { day: '2-digit', month: 'long', year: 'numeric' })
}

function imprimir() {
  window.print()
}
</script>

<template>
  <!-- Overlay -->
  <Transition name="fade">
    <div class="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      @click.self="emit('close')">
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col overflow-hidden"
        style="max-height: 92vh">

        <!-- Barra de acciones (se oculta al imprimir) -->
        <div class="no-print flex items-center gap-3 px-5 py-4 border-b border-slate-100 bg-slate-50/80 flex-shrink-0">
          <div class="flex-1 min-w-0">
            <h3 class="font-semibold text-slate-900 text-sm">Vista previa del certificado</h3>
            <p class="text-xs text-slate-400 mt-0.5">Generado desde el sistema · se imprimirá tal como se muestra</p>
          </div>
          <div class="flex items-center gap-2 flex-shrink-0">
            <button @click="imprimir"
              class="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Imprimir / Guardar PDF
            </button>
            <button @click="emit('close')"
              class="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <!-- Área de certificado imprimible -->
        <div class="overflow-y-auto flex-1 p-6 bg-slate-100 no-print-bg" id="cert-print-area">
          <div class="cert-page bg-white shadow-md mx-auto" style="width: 100%; max-width: 680px">

            <!-- Borde decorativo exterior -->
            <div class="border-[6px] border-indigo-700 m-4 p-6">

              <!-- Borde interior doble -->
              <div class="border-2 border-indigo-300 p-5">

                <!-- Encabezado con logos -->
                <div class="text-center mb-6 pb-4 border-b-2 border-indigo-100">
                  <!-- Escudo / Logo -->
                  <div class="flex items-center justify-center mb-3">
                    <div class="w-16 h-16 rounded-full bg-indigo-700 flex items-center justify-center shadow-md">
                      <svg class="w-9 h-9 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                          d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                      </svg>
                    </div>
                  </div>
                  <p class="text-xs font-bold text-indigo-800 tracking-widest uppercase">Estado Plurinacional de Bolivia
                  </p>
                  <h2 class="text-base font-bold text-slate-900 uppercase tracking-wide mt-0.5">
                    Universidad Mayor de San Andrés
                  </h2>
                  <p class="text-sm text-slate-600 font-medium">Facultad de Humanidades y Ciencias de la Educación</p>
                  <p class="text-xs text-slate-400 mt-0.5">Sistema de Gestión Bibliográfica – SIGEB</p>
                </div>

                <!-- Título del documento -->
                <div class="text-center mb-6">
                  <div class="inline-block border-b-2 border-t-2 border-indigo-700 py-2 px-6">
                    <h3 class="text-xl font-black text-indigo-800 uppercase tracking-[0.2em]">
                      Certificado de No Deuda
                    </h3>
                    <p class="text-xs text-slate-500 tracking-widest uppercase mt-0.5">Bibliográfica</p>
                  </div>
                  <p class="text-xs text-slate-400 mt-2 font-mono">
                    N° {{ certificado.id_certificado.toString().padStart(6, '0') }}
                  </p>
                </div>

                <!-- Cuerpo del certificado -->
                <div class="text-[13px] text-slate-700 leading-relaxed mb-6 text-justify px-2">
                  <p class="mb-3">
                    La <strong>Facultad de Humanidades y Ciencias de la Educación</strong> de la
                    <strong>Universidad Mayor de San Andrés</strong>, a través de su
                    <strong>Sistema de Gestión Bibliográfica (SIGEB)</strong>:
                  </p>
                  <p class="mb-3 text-center text-[15px]">
                    <strong class="text-slate-900">CERTIFICA</strong>
                  </p>
                  <p>
                    Que el/la señor/a <strong class="text-slate-900 uppercase text-sm">{{ nombreUsuario }}</strong>,
                    portador/a del Carnet de Identidad <strong class="text-slate-900">N° {{ ciUsuario }}</strong>,
                    <strong>NO REGISTRA</strong> préstamos bibliográficos pendientes ni deudas activas en las
                    bibliotecas
                    de esta Facultad a la fecha de emisión del presente documento.
                  </p>
                  <p class="mt-3 text-xs text-slate-500 italic">
                    El presente certificado es válido para los trámites académicos y administrativos que el interesado
                    considere pertinentes.
                  </p>
                </div>

                <!-- Datos del certificado + QR -->
                <div class="grid grid-cols-3 gap-4 mb-6">
                  <!-- Datos -->
                  <div class="col-span-2 space-y-2 text-xs">
                    <div class="flex gap-2">
                      <div class="flex-1 bg-slate-50 rounded-lg border border-slate-200 p-2.5">
                        <p class="text-slate-400 mb-0.5 text-[10px] uppercase font-semibold tracking-wider">Fecha de
                          Emisión</p>
                        <p class="font-semibold text-slate-800">{{ formatDateTime(certificado.fechaEmision) }}</p>
                      </div>
                      <div class="flex-1 bg-slate-50 rounded-lg border border-slate-200 p-2.5">
                        <p class="text-slate-400 mb-0.5 text-[10px] uppercase font-semibold tracking-wider">Válido hasta
                        </p>
                        <p class="font-semibold text-slate-800">{{ formatDate(certificado.fechaVencimiento) }}</p>
                      </div>
                    </div>
                    <div class="bg-indigo-50 rounded-lg border border-indigo-200 p-2.5">
                      <p class="text-indigo-400 mb-0.5 text-[10px] uppercase font-semibold tracking-wider">Código de
                        Verificación</p>
                      <p class="font-mono font-bold text-indigo-700 text-[11px] break-all select-all">
                        {{ certificado.codigo_verificacion }}
                      </p>
                    </div>
                    <div class="bg-slate-50 rounded-lg border border-slate-200 p-2.5">
                      <p class="text-slate-400 mb-0.5 text-[10px] uppercase font-semibold tracking-wider">Biblioteca</p>
                      <p class="font-semibold text-slate-700">{{ certificado.bibliotecaNombre ?? '—' }}</p>
                    </div>
                  </div>

                  <!-- QR -->
                  <div
                    class="flex flex-col items-center justify-center bg-white rounded-xl border-2 border-indigo-200 p-2 gap-1.5">
                    <img :src="qrUrl" alt="QR de verificación" class="w-full max-w-[120px] rounded" />
                    <p class="text-[9px] text-slate-400 text-center leading-tight font-medium">
                      Escanear para<br>verificar autenticidad
                    </p>
                  </div>
                </div>

                <!-- Instrucción de verificación -->
                <div class="bg-slate-50 rounded-lg border border-slate-200 p-2.5 mb-6 text-center">
                  <p class="text-[10px] text-slate-500">
                    Para verificar la autenticidad de este certificado, ingrese el código en:
                    <strong class="text-indigo-600">{{ origin }}/certificados</strong>
                    → Validar Código, o escanee el código QR.
                  </p>
                </div>

                <!-- Firma -->
                <div class="flex justify-between items-end pt-4 border-t border-slate-200">
                  <!-- Firma estudiante -->
                  <div class="text-center flex-1">
                    <div class="w-32 border-b border-slate-400 mb-1 mx-auto" />
                    <p class="text-xs text-slate-600 font-medium uppercase">{{ nombreUsuario }}</p>
                    <p class="text-[10px] text-slate-400">Estudiante · CI: {{ ciUsuario }}</p>
                  </div>

                  <!-- Sello -->
                  <div class="flex-shrink-0 mx-4">
                    <div
                      class="w-16 h-16 rounded-full border-2 border-dashed border-slate-300 flex items-center justify-center">
                      <p class="text-[8px] text-slate-300 text-center leading-tight font-semibold uppercase">
                        Sello<br>Oficial</p>
                    </div>
                  </div>

                  <!-- Firma bibliotecario -->
                  <div class="text-center flex-1">
                    <div class="w-32 border-b border-slate-400 mb-1 mx-auto" />
                    <p class="text-xs text-slate-600 font-medium uppercase">
                      {{ certificado.bibliotecario?.nombreCompleto ?? 'Encargado de Biblioteca' }}
                    </p>
                    <p class="text-[10px] text-slate-400">{{ certificado.bibliotecaNombre ?? 'Biblioteca' }}</p>
                  </div>
                </div>

                <!-- Footer del certificado -->
                <div class="mt-4 pt-3 border-t border-slate-100 text-center">
                  <p class="text-[9px] text-slate-300 tracking-wider">
                    Documento generado electrónicamente por SIGEB — Universidad Mayor de San Andrés
                  </p>
                </div>

              </div><!-- fin borde interior -->
            </div><!-- fin borde exterior -->

          </div>
        </div>

        <!-- Nota de ayuda (se oculta al imprimir) -->
        <div class="no-print flex-shrink-0 px-5 py-3 border-t border-slate-100 bg-slate-50/80">
          <p class="text-xs text-slate-400 text-center">
            <svg class="w-3.5 h-3.5 inline mr-1 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Al imprimir, selecciona <strong>"Guardar como PDF"</strong> en la impresora para obtener un archivo PDF.
            Los márgenes se ajustan automáticamente.
          </p>
        </div>

      </div>
    </div>
  </Transition>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* ── Estilos de impresión ── */
@media print {

  /* Ocultar todo lo que no sea el certificado */
  .no-print {
    display: none !important;
  }

  /* El área de impresión ocupa toda la página */
  #cert-print-area {
    position: fixed !important;
    inset: 0 !important;
    overflow: visible !important;
    background: white !important;
    padding: 0 !important;
    margin: 0 !important;
  }

  .cert-page {
    box-shadow: none !important;
    max-width: 100% !important;
    width: 100% !important;
    margin: 0 !important;
  }

  /* Asegurar que el modal sea fullscreen en impresión */
  .fixed {
    position: static !important;
  }

  /* Forzar colores de impresión */
  * {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }

  @page {
    margin: 10mm;
    size: A4 portrait;
  }
}
</style>