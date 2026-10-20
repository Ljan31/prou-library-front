<!--
  PlantillaManager.vue
  Administración de plantillas .docx por biblioteca.
  Solo ADMIN / BIBLIOTECARIO pueden usarlo.

  Props:
    bibliotecaId  – ID de la biblioteca activa
    nombreBib     – Nombre para mostrar
  Emits:
    plantilla-actualizada – cuando se sube una nueva plantilla
-->
<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useUiStore } from '@/stores/ui.store'
import { useAuthStore } from '@/stores/auth.store'
import { useMedia } from '@/composables/useMedia'
import api from '@/services/axios'
import CertificadoPdfViewer from '@/views/certificado/CertificadoPdfViewer.vue';

// ─── Props / Emits ────────────────────────────────────────────────────────
const props = defineProps<{
  bibliotecaId: number
  nombreBib: string
}>()

const emit = defineEmits<{
  (e: 'plantilla-actualizada', url: string): void
}>()

const ui = useUiStore()
const auth = useAuthStore()
 const { getUrl } = useMedia()
// ─── State ────────────────────────────────────────────────────────────────
const plantillaActual = ref<string | null>(null)      // URL de la plantilla en servidor
const plantillaInfo = ref<{ nombre: string; fecha: string, id: number } | null>(null)
const loadingInfo = ref(false)
const uploading = ref(false)


const pdfViewerShow = ref(false)
const pdfViewerCertId = ref<number | null>(null)

function abrirVisor(id: number) { 
  console.log('abrirVisor', id)
  pdfViewerCertId.value = id; pdfViewerShow.value = true 
}
  
// Subida de imagen de firma
const firmaUrl = ref<string | null>(null)
const selloUrl = ref<string | null>(null)
const uploadingFirma = ref(false)
const uploadingSello = ref(false)

// File inputs ref
const fileInputPlantilla = ref<HTMLInputElement | null>(null)
const fileInputFirma = ref<HTMLInputElement | null>(null)
const fileInputSello = ref<HTMLInputElement | null>(null)

// Coordinador o director
type CargoResponsable = 'COORDINADOR' | 'DIRECTOR'

const cargoResponsable = ref<CargoResponsable>('COORDINADOR')
const nombreResponsable = ref('')
const savingResponsable = ref(false)

// Drag & drop
const isDragging = ref(false)

// ─── Permisos ─────────────────────────────────────────────────────────────
const canManage = computed(() => auth.isAdmin || auth.isBibliotecario)

// ─── Cargar info actual ───────────────────────────────────────────────────
async function cargarInfo() {
  loadingInfo.value = true
  try {
    const { data } = await api.get(`/plantillas/biblioteca/${props.bibliotecaId}`)
    console.log('cargarInfo',data)
    plantillaActual.value = data?.data?.url ?? null

    const firma = data?.data?.firmaUrl ?? null;
    firmaUrl.value = firma ? getUrl(firma) : null;

    const sello = data?.data?.selloUrl ?? null;
    selloUrl.value = sello ? getUrl(sello) : null;
    cargoResponsable.value =
      data?.data?.cargoResponsable ?? 'COORDINADOR'

    nombreResponsable.value =
      data?.data?.nombreResponsable ?? ''
    console.log('planillaCertificado: ', data.data)
    plantillaInfo.value = {
      id: data?.data?.idFormato ?? 0,
      nombre: data?.data?.nombreArchivo ?? 'certificado_no_adeudo.docx',
      fecha: data?.data?.fechaActualizacion
        ? new Date(data?.data?.fechaActualizacion).toLocaleDateString('es-BO', {
            day: '2-digit', month: 'long', year: 'numeric',
          })
        : '—',
    }
  } catch {
    // 404 = sin plantilla aún, no es error
    plantillaActual.value = null
    plantillaInfo.value = null
  } finally {
    loadingInfo.value = false
  }
}


watch(
  () => props.bibliotecaId,
  () => cargarInfo(),
  { immediate: true }
)

// ─── Subir plantilla .docx ────────────────────────────────────────────────
function validarDocx(file: File): boolean {
  const allowed = [
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ]
  if (!allowed.includes(file.type) && !file.name.endsWith('.docx')) {
    ui.toast.error('Formato inválido', 'Solo se aceptan archivos .docx')
    return false
  }
  if (file.size > 10 * 1024 * 1024) {
    ui.toast.error('Archivo muy grande', 'El límite es 10 MB')
    return false
  }
  return true
}

function validarImagen(file: File): boolean {
  const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
  if (!allowed.includes(file.type)) {
    ui.toast.error('Formato inválido', 'Solo se aceptan PNG, JPG o WEBP')
    return false
  }
  if (file.size > 2 * 1024 * 1024) {
    ui.toast.error('Imagen muy grande', 'El límite es 2 MB')
    return false
  }
  return true
}

async function subirPlantilla(file: File) {
  if (!validarDocx(file)) return
  uploading.value = true
  try {
    const formData = new FormData()
    formData.append('archivo', file)
    formData.append('bibliotecaId', String(props.bibliotecaId))
    const { data } = await api.post(`/plantillas/biblioteca/${props.bibliotecaId}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    // console.log(data)
    // plantillaActual.value = data.url
    // plantillaInfo.value = {
    //   nombre: data.nombreArchivo ?? file.name,
    //   fecha: new Date().toLocaleDateString('es-BO', { day: '2-digit', month: 'long', year: 'numeric' }),
    // }
    // ui.toast.success('Plantilla actualizada', `${props.nombreBib}`)
    // emit('plantilla-actualizada', data.url)
    // Volver a consultar el estado real del servidor
    await cargarInfo()

    ui.toast.success(
      'Plantilla actualizada',
      `${props.nombreBib}`
    )

    emit('plantilla-actualizada', plantillaActual.value ?? '')
  } catch (e: unknown) {
    const msg = (e as any)?.response?.data?.message ?? 'Error al subir la plantilla'
    ui.toast.error('Error', msg)
  } finally {
    uploading.value = false
    if (fileInputPlantilla.value) fileInputPlantilla.value.value = ''
  }
}

async function subirImagen(tipo: 'firma' | 'sello', file: File) {
  if (!validarImagen(file)) return
  if (tipo === 'firma') uploadingFirma.value = true
  else uploadingSello.value = true
  try {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('bibliotecaId', String(props.bibliotecaId))
    formData.append('tipo', tipo)
    const { data } = await api.post('/plantillas/imagen', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    // if (tipo === 'firma') firmaUrl.value = data.url
    // else selloUrl.value = data.url
    // ui.toast.success(`${tipo === 'firma' ? 'Firma' : 'Sello'} actualizado`, '')
    
    // Recargar firma y sello desde el backend.
    // cargarInfo también aplica getUrl() a las rutas recibidas.
    await cargarInfo()

    ui.toast.success(
      tipo === 'firma' ? 'Firma actualizada' : 'Sello actualizado',
      `Biblioteca: ${props.nombreBib}`
    )
  } catch (e: unknown) {
    ui.toast.error('Error', (e as any)?.response?.data?.message ?? 'Error al subir imagen')
  } finally {
    if (tipo === 'firma') uploadingFirma.value = false
    else uploadingSello.value = false
    if (tipo === 'firma' && fileInputFirma.value) fileInputFirma.value.value = ''
    if (tipo === 'sello' && fileInputSello.value) fileInputSello.value.value = ''
  }
}

// ─── Drag & Drop ──────────────────────────────────────────────────────────
function onDrop(e: DragEvent) {
  isDragging.value = false
  const file = e.dataTransfer?.files?.[0]
   if (file) {
    prepararSubida('plantilla', file)
  }
}

function onFileChange(e: Event, tipo: TipoArchivo) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]

  if (!file) return

  prepararSubida(tipo, file)
}

// Modal de confirmación de subida
type TipoArchivo = 'plantilla' | 'firma' | 'sello'

interface ArchivoPendiente {
  tipo: TipoArchivo
  file: File
}

const archivoPendiente = ref<ArchivoPendiente | null>(null)
const showModalConfirmacion = ref(false)

const nombreArchivoPendiente = computed(
  () => archivoPendiente.value?.file.name ?? ''
)

const tipoArchivoTexto = computed(() => {
  const tipo = archivoPendiente.value?.tipo

  if (tipo === 'plantilla') return 'plantilla del certificado'
  if (tipo === 'firma') return 'firma digital'
  if (tipo === 'sello') return 'sello institucional'

  return 'archivo'
})
function prepararSubida(tipo: TipoArchivo, file: File) {
  // Validar antes de solicitar confirmación
  const valido =
    tipo === 'plantilla'
      ? validarDocx(file)
      : validarImagen(file)

  if (!valido) {
    limpiarInput(tipo)
    return
  }

  archivoPendiente.value = { tipo, file }
  showModalConfirmacion.value = true
}

function limpiarInput(tipo: TipoArchivo) {
  if (tipo === 'plantilla' && fileInputPlantilla.value) {
    fileInputPlantilla.value.value = ''
  }

  if (tipo === 'firma' && fileInputFirma.value) {
    fileInputFirma.value.value = ''
  }

  if (tipo === 'sello' && fileInputSello.value) {
    fileInputSello.value.value = ''
  }
}

function cancelarSubida() {
  const tipo = archivoPendiente.value?.tipo

  showModalConfirmacion.value = false
  archivoPendiente.value = null

  if (tipo) limpiarInput(tipo)
}

async function confirmarSubida() {
  const pendiente = archivoPendiente.value
  if (!pendiente) return

  // Cerrar el modal de confirmación antes de ejecutar la petición.
  showModalConfirmacion.value = false

  try {
    if (pendiente.tipo === 'plantilla') {
      await subirPlantilla(pendiente.file)
    } else {
      await subirImagen(pendiente.tipo, pendiente.file)
    }
  } finally {
    archivoPendiente.value = null
  }
}

async function guardarResponsable() {
  const nombre = nombreResponsable.value.trim()

  if (!nombre) {
    ui.toast.error(
      'Campo obligatorio',
      'Ingresa el nombre del coordinador o director'
    )
    return
  }

  savingResponsable.value = true

  try {
    await api.put(
      `/plantillas/biblioteca/${props.bibliotecaId}/responsable`,
      {
        cargoResponsable: cargoResponsable.value,
        nombreResponsable: nombre,
      }
    )

    ui.toast.success(
      'Datos actualizados',
      `Se guardó el responsable de ${props.nombreBib}`
    )
  } catch (e: unknown) {
    const msg =
      (e as any)?.response?.data?.message ??
      'Error al guardar los datos del responsable'

    ui.toast.error('Error', msg)
  } finally {
    savingResponsable.value = false
  }
}

</script>

<template>
  <div class="space-y-5">
    <CertificadoPdfViewer :show="pdfViewerShow" :certificado-id="pdfViewerCertId" @close="pdfViewerShow = false" tipo="planilla"/>

    <!-- ── Plantilla .docx ────────────────────────────────────────── -->
    <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div class="flex items-center gap-2.5 px-5 py-4 border-b border-slate-100 bg-slate-50/50">
        <div class="w-7 h-7 rounded-lg bg-indigo-100 flex items-center justify-center">
          <svg class="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <h3 class="font-semibold text-slate-800 text-sm">Plantilla del certificado (.docx)</h3>
      </div>

      <div class="p-5 space-y-4">
        <!-- Info plantilla actual -->
        <div v-if="loadingInfo" class="h-14 bg-slate-100 rounded-xl animate-pulse" />

        <div v-else-if="plantillaInfo"
          class="flex items-center gap-3 p-3 bg-indigo-50 rounded-xl border border-indigo-100">
          <div class="w-10 h-10 rounded-lg bg-indigo-600 flex items-center justify-center flex-shrink-0">
            <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div class="flex-1 min-w-0">
            <p class="font-semibold text-slate-800 text-sm truncate">{{ plantillaInfo.nombre }}</p>
            <p class="text-xs text-slate-500">Actualizada: {{ plantillaInfo.fecha }}</p>
          </div>
          <button v-if="plantillaActual" @click="abrirVisor(plantillaInfo.id)"
            class="text-xs text-indigo-600 hover:underline font-medium flex items-center gap-1">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Descargar
          </button>
        </div>

        <div v-else class="p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700 flex items-center gap-2">
          <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Sin plantilla configurada para esta biblioteca
        </div>

        <!-- Zona de carga -->
        <div v-if="canManage"
          @dragover.prevent="isDragging = true"
          @dragleave.prevent="isDragging = false"
          @drop.prevent="onDrop"
          :class="[
            'border-2 border-dashed rounded-xl p-6 text-center transition-all cursor-pointer',
            isDragging ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200 hover:border-indigo-300 hover:bg-slate-50'
          ]"
          @click="fileInputPlantilla?.click()"
        >
          <input
            ref="fileInputPlantilla"
            type="file"
            accept=".docx"
            class="hidden"
            @change="e => onFileChange(e, 'plantilla')"
          />
          <svg v-if="!uploading" class="w-8 h-8 text-slate-300 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          <svg v-else class="w-8 h-8 text-indigo-400 mx-auto mb-2 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
          </svg>
          <p class="text-sm font-medium text-slate-600">
            {{ uploading ? 'Subiendo plantilla...' : 'Arrastra o haz clic para subir' }}
          </p>
          <p class="text-xs text-slate-400 mt-1">Solo archivos .docx · Máx. 10 MB</p>
        </div>

        <!-- Variables disponibles -->
        <div class="bg-slate-50 rounded-xl p-4 border border-slate-100">
          <p class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Variables disponibles en la plantilla</p>
          <div class="flex flex-wrap gap-1.5">
            <code
              v-for="v in ['{{nombre}}','{{ci}}','{{ciudad}}','{{fecha}}','{{cargo}}','{{responsable}}']"
              :key="v"
              class="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded font-mono"
            >{{ v }}</code>
          </div>
          <p class="text-xs text-slate-400 mt-2">
            Para imágenes usa comandos en la plantilla:
          </p>
          <div class="flex flex-wrap gap-1.5 mt-1">
            <code
              v-for="v in ['+++IMAGE(firma)+++','+++IMAGE(sello)+++','+++IMAGE(qr)+++']"
              :key="v"
              class="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded font-mono"
            >{{ v }}</code>
          </div>
        </div>
      </div>
    </div>

    <!-- ── Firma digital y sello ──────────────────────────────────── -->
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">

      <!-- Firma -->
      <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div class="flex items-center gap-2 px-4 py-3 border-b border-slate-100 bg-slate-50/50">
          <div class="w-6 h-6 rounded-lg bg-emerald-100 flex items-center justify-center">
            <svg class="w-3.5 h-3.5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </div>
          <span class="font-semibold text-slate-800 text-sm">Firma digital</span>
        </div>
        <div class="p-4 space-y-3">
          <!-- Preview -->
          <div class="h-24 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-center overflow-hidden">
            <img v-if="firmaUrl" :src="firmaUrl" class="max-h-full max-w-full object-contain" alt="Firma" />
            <span v-else class="text-xs text-slate-300">Sin firma configurada</span>
          </div>
          <input ref="fileInputFirma" type="file" accept="image/png,image/jpeg,image/webp" class="hidden"
            @change="e => onFileChange(e, 'firma')" />
          <button v-if="canManage" @click="fileInputFirma?.click()" :disabled="uploadingFirma"
            class="w-full py-2 text-xs font-semibold rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors flex items-center justify-center gap-2 disabled:opacity-60">
            <svg v-if="uploadingFirma" class="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
            {{ uploadingFirma ? 'Subiendo...' : (firmaUrl ? 'Reemplazar firma' : 'Subir firma') }}
          </button>
        </div>
      </div>

      <!-- Sello -->
      <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div class="flex items-center gap-2 px-4 py-3 border-b border-slate-100 bg-slate-50/50">
          <div class="w-6 h-6 rounded-lg bg-blue-100 flex items-center justify-center">
            <svg class="w-3.5 h-3.5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
            </svg>
          </div>
          <span class="font-semibold text-slate-800 text-sm">Sello institucional</span>
        </div>
        <div class="p-4 space-y-3">
          <div class="h-24 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-center overflow-hidden">
            <img v-if="selloUrl" :src="selloUrl" class="max-h-full max-w-full object-contain" alt="Sello" />
            <span v-else class="text-xs text-slate-300">Sin sello configurado</span>
          </div>
          <input ref="fileInputSello" type="file" accept="image/png,image/jpeg,image/webp" class="hidden"
            @change="e => onFileChange(e, 'sello')" />
          <button v-if="canManage" @click="fileInputSello?.click()" :disabled="uploadingSello"
            class="w-full py-2 text-xs font-semibold rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors flex items-center justify-center gap-2 disabled:opacity-60">
            <svg v-if="uploadingSello" class="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
            {{ uploadingSello ? 'Subiendo...' : (selloUrl ? 'Reemplazar sello' : 'Subir sello') }}
          </button>
        </div>
      </div>

    </div>

    
<!-- Coordinador o director -->
<div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
  <div class="flex items-center gap-2 px-4 py-3 border-b border-slate-100 bg-slate-50/50">
    <div class="w-6 h-6 rounded-lg bg-violet-100 flex items-center justify-center">
      <span class="text-violet-600 font-bold">R</span>
    </div>
    <span class="font-semibold text-slate-800 text-sm">
      Responsable de la biblioteca
    </span>
  </div>

  <div class="p-4 space-y-4">
    <div>
      <label class="block text-sm font-medium text-slate-700 mb-1">
        Cargo
      </label>

      <select
        v-model="cargoResponsable"
        class="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none"
      >
        <option value="COORDINADOR">Coordinador</option>
        <option value="DIRECTOR">Director</option>
      </select>
    </div>

    <div>
      <label class="block text-sm font-medium text-slate-700 mb-1">
        Nombre completo
      </label>

      <input
        v-model="nombreResponsable"
        type="text"
        maxlength="60"
        placeholder="Ej. Juan Pérez García"
        class="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none"
      />
    </div>

    <button
      v-if="canManage"
      type="button"
      :disabled="savingResponsable"
      @click="guardarResponsable"
      class="w-full rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
    >
      {{ savingResponsable ? 'Guardando...' : 'Guardar responsable' }}
    </button>
  </div>
</div>



  <!-- Modal de confirmación de subida -->
<div
  v-if="showModalConfirmacion && archivoPendiente"
  class="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 p-4"
  @click.self="cancelarSubida"
  @keydown.esc="cancelarSubida"
>
  <div
    role="dialog"
    aria-modal="true"
    aria-labelledby="titulo-confirmacion"
    class="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl"
  >
    <!-- Encabezado -->
    <div class="flex items-center gap-3 border-b border-slate-100 p-5">
      <div
        class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600"
      >
        <svg
          class="h-6 w-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M12 9v3m0 4h.01M10.3 3.86L1.82 18.5A2 2 0 003.55 21h16.9a2 2 0 001.73-2.5L13.7 3.86a2 2 0 00-3.4 0z"
          />
        </svg>
      </div>

      <div class="min-w-0 flex-1">
        <h3
          id="titulo-confirmacion"
          class="text-base font-semibold text-slate-800"
        >
          Confirmar actualización
        </h3>
        <p class="mt-1 text-sm text-slate-500">
          Biblioteca: {{ nombreBib }}
        </p>
      </div>

      <button
        type="button"
        aria-label="Cerrar modal"
        class="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
        @click="cancelarSubida"
      >
        ✕
      </button>
    </div>

    <!-- Contenido -->
    <div class="space-y-4 p-5">
      <p class="text-sm leading-6 text-slate-600">
        ¿Estás seguro de que deseas actualizar la
        <strong>{{ tipoArchivoTexto }}</strong>?
      </p>

      <div
        class="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3"
      >
        <div
          class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600"
        >
          <svg
            class="h-5 w-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 16V4m0 0L7 9m5-5l5 5M5 14v5a1 1 0 001 1h12a1 1 0 001-1v-5"
            />
          </svg>
        </div>

        <div class="min-w-0 flex-1">
          <p class="truncate text-sm font-medium text-slate-800">
            {{ nombreArchivoPendiente }}
          </p>
          <p class="text-xs text-slate-500">
            {{ (archivoPendiente.file.size / 1024 / 1024).toFixed(2) }} MB
          </p>
        </div>
      </div>

      <p class="text-xs leading-5 text-amber-700">
        Esta acción actualizará el archivo almacenado en el servidor.
        ¿Deseas continuar?
      </p>
    </div>

    <!-- Acciones -->
    <div
      class="flex justify-end gap-3 border-t border-slate-100 bg-slate-50 p-4"
    >
      <button
        type="button"
        class="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
        @click="cancelarSubida"
      >
        Cancelar
      </button>

      <button
        type="button"
        class="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700"
        @click="confirmarSubida"
      >
        Confirmar actualización
      </button>
    </div>
  </div>
</div>

  </div>
</template>