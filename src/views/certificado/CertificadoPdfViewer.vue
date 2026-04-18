<script setup lang="ts">
import { ref, watch } from 'vue'
import api from '@/services/axios'

// ─── Props & Emits ────────────────────────────────────────────────────────────
const props = defineProps<{
  certificadoId: number | null
  show: boolean
}>()

const emit = defineEmits<{
  close: []
}>()

// ─── State ────────────────────────────────────────────────────────────────────
const pdfBlobUrl = ref<string | null>(null)
const cargando = ref(false)
const error = ref<string | null>(null)

// Carga el PDF cuando se abre el modal
watch(() => props.show, async (val) => {
  if (val && props.certificadoId) {
    await cargarPdf(props.certificadoId)
  } else if (!val) {
    limpiar()
  }
})

async function cargarPdf(id: number) {
  cargando.value = true
  error.value = null
  pdfBlobUrl.value = null
  try {
    const res = await api.get(`/certificados/${id}/download`, {
      responseType: 'blob',
    })
    const blob = new Blob([res.data], { type: 'application/pdf' })
    pdfBlobUrl.value = URL.createObjectURL(blob)
  } catch (e: unknown) {
    error.value = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      ?? 'No se pudo cargar el PDF. Intenta descargarlo directamente.'
  } finally {
    cargando.value = false
  }
}

async function descargar(id: number) {
  try {
    const res = await api.get(`/certificados/${id}/download`, { responseType: 'blob' })
    const blob = new Blob([res.data], { type: 'application/pdf' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `certificado-${id}.pdf`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  } catch {
    // silently fail — ya tiene el visor
  }
}

function limpiar() {
  if (pdfBlobUrl.value) {
    URL.revokeObjectURL(pdfBlobUrl.value)
    pdfBlobUrl.value = null
  }
  error.value = null
  cargando.value = false
}

function cerrar() {
  limpiar()
  emit('close')
}
</script>

<template>
  <Transition name="modal">
    <div v-if="show" class="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      @click.self="cerrar">
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col overflow-hidden"
        style="max-height: 92vh">

        <!-- Header -->
        <div class="flex items-center gap-3 px-5 py-4 border-b border-slate-100 flex-shrink-0">
          <div class="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0">
            <svg class="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          </div>
          <div class="flex-1 min-w-0">
            <h3 class="font-semibold text-slate-900 text-sm">Vista previa del certificado</h3>
            <p class="text-xs text-slate-400 mt-0.5">Certificado #{{ certificadoId }}</p>
          </div>
          <div class="flex items-center gap-2 flex-shrink-0">
            <!-- Descargar -->
            <button v-if="certificadoId" @click="descargar(certificadoId)"
              class="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg transition-colors">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Descargar
            </button>
            <!-- Cerrar -->
            <button @click="cerrar" class="text-slate-400 hover:text-slate-600 transition-colors p-1">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <!-- Contenido del visor -->
        <div class="flex-1 bg-slate-100 overflow-hidden relative" style="min-height: 400px">

          <!-- Cargando -->
          <div v-if="cargando" class="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-100">
            <div class="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
            <p class="text-sm text-slate-500">Cargando vista previa...</p>
          </div>

          <!-- Error -->
          <div v-else-if="error" class="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6">
            <div class="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center">
              <svg class="w-7 h-7 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div class="text-center">
              <p class="text-sm font-medium text-slate-700">No se pudo cargar la vista previa</p>
              <p class="text-xs text-slate-400 mt-1">{{ error }}</p>
            </div>
            <button v-if="certificadoId" @click="descargar(certificadoId)"
              class="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-colors">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Descargar PDF igualmente
            </button>
          </div>

          <!-- PDF embed -->
          <embed v-else-if="pdfBlobUrl" :src="pdfBlobUrl" type="application/pdf" class="w-full h-full"
            style="min-height: 500px" />
        </div>

        <!-- Footer info -->
        <div class="px-5 py-3 border-t border-slate-100 bg-slate-50/50 flex-shrink-0">
          <p class="text-xs text-slate-400 text-center">
            Si el visor no carga correctamente, usa el botón <strong>Descargar</strong> para abrir el PDF en tu
            dispositivo.
          </p>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}

.modal-enter-active .bg-white,
.modal-leave-active .bg-white {
  transition: transform 0.2s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .bg-white {
  transform: scale(0.96) translateY(8px);
}
</style>