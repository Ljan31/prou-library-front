<script setup lang="ts">
/**
 * Modal de vista previa del PDF. Al abrirse genera el PDF en el navegador
 * (con los gráficos ya cargados) y lo muestra en un iframe.
 *
 *   <ReportePdfModal v-model="mostrar" :tipo :datos :graficos :filtros :titulo-biblioteca />
 */
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import SButton from '@/components/ui/SButton.vue'
import type { GraficoItem } from '@/composables/useReporteGraficos'
import type { FiltroAplicado, TipoReporte } from '@/types/reportes'
import { construirPdf, tituloReporte } from './reportePdf'

const props = withDefaults(defineProps<{
  modelValue: boolean
  tipo: TipoReporte | ''
  datos: Record<string, any> | null
  graficos?: GraficoItem[]
  filtros?: FiltroAplicado[]
  tituloBiblioteca?: string
}>(), {
  graficos: () => [],
  filtros: () => [],
  tituloBiblioteca: '',
})

const emit = defineEmits<{ (e: 'update:modelValue', v: boolean): void }>()

const generando = ref(false)
const pdfUrl = ref<string | null>(null)
const errorPdf = ref<string | null>(null)
const btnCerrar = ref<HTMLButtonElement | null>(null)

const titulo = computed(() => tituloReporte(props.tipo))
const incluidos = computed(() => props.graficos.filter(g => g.status === 'ok' && !g.grafico?.sinDatos).length)
const fallidos = computed(() => props.graficos.filter(g => g.status === 'error').length)

function liberar() {
  if (pdfUrl.value) URL.revokeObjectURL(pdfUrl.value)
  pdfUrl.value = null
}

async function generarPDF() {
  if (!props.tipo) return
  generando.value = true
  errorPdf.value = null
  liberar()
  // deja pintar el spinner antes del trabajo síncrono (render de gráficos + tabla)
  await new Promise<void>(r => requestAnimationFrame(() => setTimeout(r, 0)))
  try {
    const blob = construirPdf({
      tipo: props.tipo,
      datos: props.datos ?? {},
      graficos: props.graficos,
      filtros: props.filtros,
      biblioteca: props.tituloBiblioteca,
    })
    pdfUrl.value = URL.createObjectURL(blob)
  } catch (e) {
    console.error('[ReportePdfModal] Error al generar PDF:', e)
    errorPdf.value = 'No se pudo generar el PDF. Revisa la consola para más detalle.'
  } finally {
    generando.value = false
  }
}

const cerrar = () => emit('update:modelValue', false)
const onKeydown = (e: KeyboardEvent) => { if (e.key === 'Escape') cerrar() }

watch(() => props.modelValue, async (abierto) => {
  if (abierto) {
    window.addEventListener('keydown', onKeydown)
    generarPDF()
    await nextTick()
    btnCerrar.value?.focus()
  } else {
    window.removeEventListener('keydown', onKeydown)
    liberar()
    errorPdf.value = null
  }
}, { immediate: true })

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  liberar()
})

function descargar() {
  if (!pdfUrl.value) return
  const a = document.createElement('a')
  a.href = pdfUrl.value
  a.download = `reporte_${props.tipo}_${new Date().toISOString().slice(0, 10)}.pdf`
  a.click()
}

// Navegadores móviles (iOS) no muestran PDF dentro de un iframe
const abrirEnPestana = () => { if (pdfUrl.value) window.open(pdfUrl.value, '_blank') }
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="modelValue"
        class="fixed inset-0 z-50 flex items-center justify-center p-4"
        style="background: rgba(15, 23, 42, 0.55); backdrop-filter: blur(2px);"
        @click.self="cerrar"
      >
        <div
          class="modal-panel relative bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden"
          style="width: min(95vw, 1100px); height: min(90vh, 820px);"
          role="dialog"
          aria-modal="true"
          :aria-label="`Vista previa PDF: ${titulo}`"
        >
          <!-- Header -->
          <div class="flex items-center justify-between gap-4 px-5 py-3.5 border-b border-slate-100 shrink-0">
            <div class="flex items-center gap-3 min-w-0">
              <div class="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center shrink-0">
                <svg class="w-4 h-4 text-red-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                </svg>
              </div>
              <div class="min-w-0">
                <h2 class="text-sm font-semibold text-slate-900 leading-tight truncate">{{ titulo }}</h2>
                <p class="text-xs text-slate-400 truncate">
                  Vista previa del PDF
                  <template v-if="tituloBiblioteca"> · {{ tituloBiblioteca }}</template>
                  · {{ incluidos }} {{ incluidos === 1 ? 'gráfico incluido' : 'gráficos incluidos' }}
                </p>
              </div>
            </div>

            <div class="flex items-center gap-2 shrink-0">
              <SButton v-if="pdfUrl" size="sm" variant="secondary" @click="generarPDF">Regenerar</SButton>
              <SButton v-if="pdfUrl" size="sm" @click="descargar">
                <svg class="w-3.5 h-3.5 mr-1.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                Descargar PDF
              </SButton>
              <button
                ref="btnCerrar"
                class="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-300"
                aria-label="Cerrar vista previa"
                @click="cerrar"
              >
                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
          </div>

          <!-- Aviso: gráficos omitidos -->
          <p
            v-if="fallidos"
            class="px-5 py-2 text-xs bg-amber-50 text-amber-800 border-b border-amber-100 shrink-0"
          >
            {{ fallidos }} {{ fallidos === 1 ? 'gráfico no se pudo cargar y se omitió' : 'gráficos no se pudieron cargar y se omitieron' }} del PDF.
          </p>

          <!-- Cuerpo -->
          <div class="flex-1 min-h-0 relative bg-slate-100">
            <div v-if="generando" class="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white" role="status">
              <div class="w-12 h-12 rounded-full border-4 border-indigo-100 border-t-indigo-500 animate-spin" />
              <p class="text-sm font-medium text-slate-700">Generando PDF…</p>
              <p class="text-xs text-slate-400">Armando tablas y gráficos</p>
            </div>

            <div v-else-if="errorPdf" class="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-white p-6" role="alert">
              <p class="text-sm font-semibold text-slate-800">No se pudo generar el PDF</p>
              <p class="text-xs text-slate-500 max-w-sm text-center">{{ errorPdf }}</p>
              <SButton size="sm" @click="generarPDF">Intentar de nuevo</SButton>
            </div>

            <iframe
              v-else-if="pdfUrl"
              :src="pdfUrl + '#toolbar=1&navpanes=0&view=FitH'"
              class="w-full h-full border-0"
              title="Vista previa del reporte en PDF"
            />
          </div>

          <!-- Footer -->
          <div class="flex items-center justify-between gap-3 px-5 py-2.5 border-t border-slate-100 bg-slate-50 shrink-0">
            <p class="text-xs text-slate-400">Generado en tu navegador. Los datos no se envían a ningún servidor externo.</p>
            <div class="flex items-center gap-2">
              <SButton v-if="pdfUrl" variant="ghost" size="sm" @click="abrirEnPestana">Abrir en pestaña</SButton>
              <SButton variant="ghost" size="sm" @click="cerrar">Cerrar</SButton>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-enter-active,
.modal-leave-active { transition: opacity 0.2s ease; }
.modal-enter-from,
.modal-leave-to { opacity: 0; }
.modal-enter-active .modal-panel,
.modal-leave-active .modal-panel { transition: transform 0.2s ease; }
.modal-enter-from .modal-panel,
.modal-leave-to .modal-panel { transform: translateY(12px) scale(0.98); }
</style>