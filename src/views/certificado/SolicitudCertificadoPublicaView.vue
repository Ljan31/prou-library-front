<script setup lang="ts">
/**
 * SolicitudCertificadoPublicaView.vue
 * Ruta pública: /solicitar-certificado  (requiresAuth: false)
 *
 * USA apiPublic (@/services/axios-public) — SIN interceptores de auth.
 * Nunca redirige al login por error de red o 401.
 */
import { ref, computed, watch } from 'vue'
import apiPublic from '@/services/axios-public'
import {razonCertificadoService} from '@/services/razon-certificado.service'
// ─── Types ────────────────────────────────────────────────────────────────────
interface Biblioteca {
  id_biblioteca: number
  nombre: string
  direccion?: string
}

interface RazonCertificado {
  idRazon: number
  id?: number          // por si el backend devuelve cualquiera de los dos
  nombre: string
  descripcion?: string
  requisitos?: string[]
  activo?: boolean
}

interface SolicitudResponse {
  id: number
  nombres: string
  apellidos: string
  ci: string
  bibliotecaNombre: string
  razonNombre: string
  requisitos?: string
  descripcion?: string
  estado: string
  fechaSolicitud: string
  email?: string
}

const REQUISITO_LABELS: Record<string, string> = {
  cd:     'CD / Respaldo digital',
  carta:  'Carta institucional',
  tesis:  'Documento de tesis',
  recibo: 'Recibo de pago de arancel',
  carnet: 'Carnet de identidad original',
  foto:   'Fotografía reciente (2×2)',
}

// ─── Normalizar id de razón (idRazon o id) ────────────────────────────────────
function razonId(r: RazonCertificado): number {
  return r.idRazon ?? r.id ?? 0
}

// ─── Bibliotecas ──────────────────────────────────────────────────────────────
const bibliotecas        = ref<Biblioteca[]>([])
const bibliotecasLoading = ref(true)
const bibliotecasError   = ref(false)
const selectedBibliotecaId = ref<number | null>(null)

async function fetchBibliotecas() {
  bibliotecasLoading.value = true
  bibliotecasError.value   = false
  try {
    const { data } = await apiPublic.get('/bibliotecas')
    bibliotecas.value = data.data ?? data ?? []
  } catch {
    bibliotecasError.value = true
  } finally {
    bibliotecasLoading.value = false
  }
}
fetchBibliotecas()

// ─── Razones ──────────────────────────────────────────────────────────────────
const razones        = ref<RazonCertificado[]>([])
const razonesLoading = ref(false)
const selectedRazonId = ref<number | null>(null)

watch(selectedBibliotecaId, async (id) => {
  razones.value = []
  selectedRazonId.value = null
  if (!id) return
  razonesLoading.value = true
  try {
     const data = await razonCertificadoService.getByBiblioteca(id)
    const raw: RazonCertificado[] = data.data ?? data ?? []
    razones.value = raw.filter(r => r.activo !== false)
  } catch {
    razones.value = []
  } finally {
    razonesLoading.value = false
  }
})

const selectedRazon = computed(() =>
  razones.value.find(r => razonId(r) === selectedRazonId.value) ?? null
)
const requisitosRazon = computed<string[]>(() =>
  (selectedRazon.value?.requisitos ?? []).map(r => REQUISITO_LABELS[r] ?? r)
)

// ─── Formulario ───────────────────────────────────────────────────────────────
const form = ref({
  nombres:     '',
  apellidos:   '',
  ci:          '',
  matricula:   '',
  email:       '',
  telefono:    '',
  descripcion: '',
})
const errors = ref<Record<string, string>>({})

function validar(): boolean {
  const e: Record<string, string> = {}
  if (!selectedBibliotecaId.value)  e.biblioteca  = 'Selecciona una biblioteca'
  if (!selectedRazonId.value)       e.razon       = 'Selecciona el tipo de certificado'
  if (!form.value.nombres.trim())   e.nombres     = 'Requerido'
  if (!form.value.apellidos.trim()) e.apellidos   = 'Requerido'
  if (!form.value.ci.trim())        e.ci          = 'Requerido'
  if (form.value.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.value.email))
                                    e.email       = 'Correo inválido'
  if (form.value.descripcion.length > 500)
                                    e.descripcion = 'Máximo 500 caracteres'
  errors.value = e
  return !Object.keys(e).length
}

// ─── Envío ────────────────────────────────────────────────────────────────────
const enviando           = ref(false)
const solicitudOk        = ref(false)
const solicitudData      = ref<SolicitudResponse | null>(null)
const envioError         = ref<string | null>(null)
const requisitosAlEnviar = ref<string[]>([])

async function enviar() {
  if (!validar()) return
  enviando.value   = true
  envioError.value = null
  requisitosAlEnviar.value = [...requisitosRazon.value]

  const payload: Record<string, unknown> = {
    bibliotecaId:       selectedBibliotecaId.value,
    nombres:            form.value.nombres.trim(),
    apellidos:          form.value.apellidos.trim(),
    ci:                 form.value.ci.trim(),
    razonCertificadoId: selectedRazonId.value,
  }
  if (form.value.matricula.trim())   payload.matricula   = form.value.matricula.trim()
  if (form.value.descripcion.trim()) payload.descripcion = form.value.descripcion.trim()
  if (form.value.email.trim())       payload.email       = form.value.email.trim()
  if (form.value.telefono.trim())    payload.telefono    = form.value.telefono.trim()

  try {
    const { data } = await apiPublic.post('/solicitudes-certificado', payload)
    if (data.success || data.data) {
      solicitudData.value = data.data
      solicitudOk.value   = true
    } else {
      envioError.value = data.message ?? 'No se pudo registrar la solicitud'
    }
  } catch (e: unknown) {
    envioError.value =
      (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      ?? 'Error al enviar. Intenta de nuevo.'
  } finally {
    enviando.value = false
  }
}

function nuevaSolicitud() {
  solicitudOk.value   = false
  solicitudData.value = null
  envioError.value    = null
  selectedBibliotecaId.value = null
  selectedRazonId.value      = null
  form.value = { nombres: '', apellidos: '', ci: '', matricula: '', email: '', telefono: '', descripcion: '' }
  errors.value             = {}
  requisitosAlEnviar.value = []
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatDateTime(s?: string) {
  if (!s) return '—'
  return new Date(s).toLocaleString('es-BO', {
    day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function inputCls(field: string) {
  return errors.value[field]
    ? 'border-red-300 bg-red-50/60 focus:ring-red-400/30 focus:border-red-400'
    : 'border-slate-200 bg-white focus:ring-indigo-400/30 focus:border-indigo-400'
}

const selectBaseCls = 'w-full px-3 py-2.5 text-sm border rounded-xl focus:outline-none focus:ring-2 transition-all appearance-none bg-no-repeat pr-9'
const selectArrow   = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2394a3b8' stroke-width='2'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E")`
</script>

<template>
  <div class="min-h-screen bg-slate-50 flex flex-col">

    <!-- ── Header institucional ──────────────────────────────────────────── -->
    <header class="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-sm">
      <div class="max-w-3xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
        <div class="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center flex-shrink-0">
          <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
              d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-xs font-bold text-slate-800 leading-tight truncate">Universidad Mayor de San Andrés</p>
          <p class="text-[11px] text-slate-500 leading-tight truncate">Fac. de Humanidades y Ciencias de la Educación · SIGEB</p>
        </div>
        <a href="/login"
          class="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-600 font-medium hover:bg-slate-50 hover:border-indigo-300 hover:text-indigo-600 transition-all">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
          </svg>
          Iniciar sesión
        </a>
      </div>
    </header>

    <!-- ── Contenido ─────────────────────────────────────────────────────── -->
    <main class="flex-1 max-w-3xl mx-auto w-full px-4 sm:px-6 py-8 space-y-5">

      <!-- ════════════════════════════
           PANTALLA DE ÉXITO
      ════════════════════════════ -->
      <Transition name="fade" mode="out-in">
        <div v-if="solicitudOk && solicitudData" key="ok" class="space-y-5">

          <!-- Banner -->
          <div class="rounded-2xl bg-emerald-600 text-white overflow-hidden shadow-xl shadow-emerald-200/60">
            <div class="px-6 py-8 text-center">
              <div class="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-4">
                <svg class="w-9 h-9 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 class="text-xl font-bold mb-2">¡Solicitud enviada!</h2>
              <p class="text-emerald-100 text-sm leading-relaxed">
                Los encargados de <strong>{{ solicitudData.bibliotecaNombre }}</strong> fueron notificados y procesarán tu solicitud a la brevedad.
              </p>
              <div class="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-white/15 rounded-xl text-sm font-mono font-bold tracking-wide">
                N° {{ solicitudData.id }}
              </div>
            </div>
          </div>

          <!-- Resumen -->
          <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div class="px-5 py-3.5 border-b border-slate-100 bg-slate-50/60">
              <h3 class="text-sm font-semibold text-slate-800">Resumen de la solicitud</h3>
            </div>
            <div class="p-5 grid grid-cols-2 gap-3 text-sm">
              <div>
                <p class="text-xs text-slate-400 mb-0.5">Solicitante</p>
                <p class="font-semibold text-slate-800 capitalize">{{ solicitudData.nombres }} {{ solicitudData.apellidos }}</p>
              </div>
              <div>
                <p class="text-xs text-slate-400 mb-0.5">CI</p>
                <p class="font-semibold text-slate-800">{{ solicitudData.ci }}</p>
              </div>
              <div>
                <p class="text-xs text-slate-400 mb-0.5">Biblioteca</p>
                <p class="font-semibold text-slate-800">{{ solicitudData.bibliotecaNombre }}</p>
              </div>
              <div>
                <p class="text-xs text-slate-400 mb-0.5">Tipo de certificado</p>
                <p class="font-semibold text-slate-800">{{ solicitudData.razonNombre }}</p>
              </div>
              <div class="col-span-2">
                <p class="text-xs text-slate-400 mb-0.5">Fecha de solicitud</p>
                <p class="font-semibold text-slate-800">{{ formatDateTime(solicitudData.fechaSolicitud) }}</p>
              </div>
            </div>
          </div>

          <!-- Requisitos -->
          <div v-if="requisitosAlEnviar.length" class="bg-amber-50 border border-amber-300 rounded-2xl overflow-hidden">
            <div class="flex items-center gap-3 px-5 py-3.5 border-b border-amber-200 bg-amber-100/60">
              <svg class="w-4 h-4 text-amber-700 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              <p class="text-sm font-bold text-amber-900">Documentos a presentar al recoger el certificado</p>
            </div>
            <ul class="p-5 space-y-2.5">
              <li v-for="(req, i) in requisitosAlEnviar" :key="i"
                class="flex items-center gap-3 text-sm text-amber-900 font-medium">
                <div class="w-5 h-5 rounded-full bg-amber-200 flex items-center justify-center text-[10px] font-bold text-amber-800 flex-shrink-0">
                  {{ i + 1 }}
                </div>
                {{ req }}
              </li>
            </ul>
            <div class="px-5 pb-4">
              <p class="text-xs text-amber-600 flex items-center gap-1.5 pt-3 border-t border-amber-200">
                <svg class="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0zM15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Dirígete a <strong class="mx-0.5">{{ solicitudData.bibliotecaNombre }}</strong> con estos documentos cuando te notifiquen.
              </p>
            </div>
          </div>

          <!-- Pasos siguientes -->
          <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <h4 class="text-sm font-semibold text-slate-800 mb-4">¿Qué sigue ahora?</h4>
            <ol class="space-y-3">
              <li v-for="(s, i) in [
                'El encargado de la biblioteca revisará tu solicitud.',
                'Verificarán que no tengas préstamos pendientes ni deudas.',
                solicitudData.email
                  ? `Te notificarán a ${solicitudData.email} cuando el certificado esté listo.`
                  : 'Puedes consultar el estado directamente en la biblioteca.',
                'Recoge el certificado presentando los documentos requeridos.',
              ]" :key="i" class="flex items-start gap-3 text-sm text-slate-600">
                <div class="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                  {{ i + 1 }}
                </div>
                <span class="pt-0.5 leading-relaxed">{{ s }}</span>
              </li>
            </ol>
          </div>

          <!-- Acciones -->
          <div class="flex flex-col sm:flex-row gap-3">
            <button @click="nuevaSolicitud"
              class="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl border border-slate-200 text-sm text-slate-600 font-medium hover:bg-slate-50 transition-all">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Nueva solicitud
            </button>
            <a href="/login"
              class="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-all shadow-lg shadow-indigo-200">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
              </svg>
              Ir al sistema (login)
            </a>
          </div>

        </div>

        <!-- ════════════════════════════
             FORMULARIO
        ════════════════════════════ -->
        <div v-else key="form" class="space-y-5">

          <!-- Título -->
          <div class="text-center pt-2 space-y-1">
            <h1 class="text-2xl font-bold text-slate-900 tracking-tight">Solicitud de Certificado</h1>
            <p class="text-sm text-slate-500">Completa el formulario — los encargados serán notificados automáticamente.</p>
          </div>

          <!-- Info sin cuenta -->
          <div class="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-2xl">
            <svg class="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p class="text-xs text-blue-800 leading-relaxed">
              ¿Tienes cuenta en SIGEB?
              <a href="/login" class="font-semibold underline underline-offset-2 hover:text-blue-900 ml-1">Inicia sesión</a>
              para completar tus datos automáticamente y verificar tu estado de préstamos en tiempo real.
            </p>
          </div>

          <!-- ── CARD PRINCIPAL ── -->
          <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">

            <!-- Sección: Biblioteca & Tipo -->
            <div class="px-5 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2.5">
              <div class="w-7 h-7 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0">
                <svg class="w-3.5 h-3.5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" />
                </svg>
              </div>
              <h2 class="text-sm font-semibold text-slate-800">Biblioteca y tipo de certificado</h2>
            </div>

            <div class="p-5 space-y-4">

              <!-- Error bibliotecas -->
              <div v-if="bibliotecasError"
                class="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600">
                No se pudieron cargar las bibliotecas.
                <button @click="fetchBibliotecas" class="underline ml-1 font-medium">Reintentar</button>
              </div>

              <!-- Grid selects -->
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">

                <!-- Biblioteca -->
                <div>
                  <label class="block text-xs font-medium text-slate-600 mb-1.5">
                    Biblioteca <span class="text-red-400">*</span>
                  </label>
                  <div v-if="bibliotecasLoading" class="w-full h-10 border border-slate-200 rounded-xl bg-slate-100 animate-pulse" />
                  <div v-else class="relative">
                    <select
                      v-model.number="selectedBibliotecaId"
                      :class="[selectBaseCls, errors.biblioteca
                        ? 'border-red-300 bg-red-50/60 focus:ring-red-400/30 focus:border-red-400'
                        : 'border-slate-200 bg-white focus:ring-indigo-400/30 focus:border-indigo-400']"
                      :style="{ backgroundImage: selectArrow, backgroundSize: '1rem', backgroundPosition: 'right 0.625rem center' }"
                    >
                      <option :value="null" disabled>Seleccionar biblioteca...</option>
                      <option v-for="b in bibliotecas" :key="b.id_biblioteca" :value="b.id_biblioteca">
                        {{ b.nombre }}
                      </option>
                    </select>
                  </div>
                  <p v-if="errors.biblioteca" class="text-xs text-red-500 mt-1">{{ errors.biblioteca }}</p>
                </div>

                <!-- Tipo certificado -->
                <div>
                  <label class="block text-xs font-medium text-slate-600 mb-1.5">
                    Tipo de certificado <span class="text-red-400">*</span>
                  </label>
                  <!-- Sin biblioteca seleccionada -->
                  <div v-if="!selectedBibliotecaId"
                    class="w-full h-10 border border-slate-200 rounded-xl bg-slate-50 flex items-center px-3 cursor-not-allowed">
                    <span class="text-xs text-slate-400">Primero selecciona una biblioteca</span>
                  </div>
                  <!-- Cargando -->
                  <div v-else-if="razonesLoading"
                    class="w-full h-10 border border-slate-200 rounded-xl bg-slate-100 animate-pulse" />
                  <!-- Sin razones -->
                  <div v-else-if="!razones.length"
                    class="w-full h-10 border border-amber-200 rounded-xl bg-amber-50 flex items-center px-3">
                    <span class="text-xs text-amber-600">Sin tipos configurados para esta biblioteca</span>
                  </div>
                  <!-- Select -->
                  <div v-else class="relative">
                    <select
                      v-model.number="selectedRazonId"
                      :class="[selectBaseCls, errors.razon
                        ? 'border-red-300 bg-red-50/60 focus:ring-red-400/30 focus:border-red-400'
                        : 'border-slate-200 bg-white focus:ring-indigo-400/30 focus:border-indigo-400']"
                      :style="{ backgroundImage: selectArrow, backgroundSize: '1rem', backgroundPosition: 'right 0.625rem center' }"
                    >
                      <option :value="null" disabled>Seleccionar tipo...</option>
                      <option v-for="r in razones" :key="razonId(r)" :value="razonId(r)">
                        {{ r.nombre }}
                      </option>
                    </select>
                  </div>
                  <p v-if="errors.razon" class="text-xs text-red-500 mt-1">{{ errors.razon }}</p>
                </div>
              </div>

              <!-- Requisitos al elegir razón -->
              <Transition name="slide-fade">
                <div v-if="selectedRazon" class="space-y-2">
                  <p v-if="selectedRazon.descripcion" class="text-xs text-slate-500 leading-relaxed px-1">
                    {{ selectedRazon.descripcion }}
                  </p>
                  <div v-if="requisitosRazon.length"
                    class="flex items-start gap-2.5 p-3.5 bg-amber-50 border border-amber-200 rounded-xl">
                    <svg class="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                    </svg>
                    <div class="flex-1 min-w-0">
                      <p class="text-xs font-bold text-amber-800 mb-1.5">Al recoger el certificado deberás presentar:</p>
                      <ul class="space-y-1">
                        <li v-for="(req, i) in requisitosRazon" :key="i"
                          class="flex items-center gap-2 text-xs text-amber-800 font-medium">
                          <svg class="w-3 h-3 text-amber-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
                          </svg>
                          {{ req }}
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              </Transition>
            </div>

            <!-- Divisor -->
            <div class="h-px bg-slate-100 mx-5" />

            <!-- Sección: Datos personales -->
            <div class="px-5 py-4 bg-slate-50/50 flex items-center gap-2.5">
              <div class="w-7 h-7 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0">
                <svg class="w-3.5 h-3.5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <h2 class="text-sm font-semibold text-slate-800">Datos personales</h2>
            </div>

            <div class="px-5 pb-5 space-y-4">

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label class="block text-xs font-medium text-slate-600 mb-1.5">Nombre(s) <span class="text-red-400">*</span></label>
                  <input v-model="form.nombres" type="text" autocomplete="given-name" placeholder="Ej. Carlos Alberto"
                    :class="['w-full px-3 py-2.5 text-sm border rounded-xl focus:outline-none focus:ring-2 transition-all', inputCls('nombres')]" />
                  <p v-if="errors.nombres" class="text-xs text-red-500 mt-1">{{ errors.nombres }}</p>
                </div>
                <div>
                  <label class="block text-xs font-medium text-slate-600 mb-1.5">Apellido(s) <span class="text-red-400">*</span></label>
                  <input v-model="form.apellidos" type="text" autocomplete="family-name" placeholder="Ej. Mamani López"
                    :class="['w-full px-3 py-2.5 text-sm border rounded-xl focus:outline-none focus:ring-2 transition-all', inputCls('apellidos')]" />
                  <p v-if="errors.apellidos" class="text-xs text-red-500 mt-1">{{ errors.apellidos }}</p>
                </div>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label class="block text-xs font-medium text-slate-600 mb-1.5">Carnet de Identidad <span class="text-red-400">*</span></label>
                  <input v-model="form.ci" type="text" autocomplete="off" placeholder="Ej. 12345678"
                    :class="['w-full px-3 py-2.5 text-sm border rounded-xl focus:outline-none focus:ring-2 transition-all', inputCls('ci')]" />
                  <p v-if="errors.ci" class="text-xs text-red-500 mt-1">{{ errors.ci }}</p>
                </div>
                <div>
                  <label class="block text-xs font-medium text-slate-600 mb-1.5">N° Matrícula <span class="text-slate-400 font-normal">(opcional)</span></label>
                  <input v-model="form.matricula" type="text" autocomplete="off" placeholder="Ej. 20230125"
                    class="w-full px-3 py-2.5 text-sm border border-slate-200 bg-white rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400/30 focus:border-indigo-400 transition-all" />
                </div>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label class="block text-xs font-medium text-slate-600 mb-1.5">Correo electrónico <span class="text-slate-400 font-normal">(opcional)</span></label>
                  <input v-model="form.email" type="email" autocomplete="email" placeholder="correo@ejemplo.com"
                    :class="['w-full px-3 py-2.5 text-sm border rounded-xl focus:outline-none focus:ring-2 transition-all', inputCls('email')]" />
                  <p v-if="errors.email" class="text-xs text-red-500 mt-1">{{ errors.email }}</p>
                  <p v-else class="text-[10px] text-slate-400 mt-1">Para recibir notificación cuando esté listo.</p>
                </div>
                <div>
                  <label class="block text-xs font-medium text-slate-600 mb-1.5">Teléfono / Celular <span class="text-slate-400 font-normal">(opcional)</span></label>
                  <input v-model="form.telefono" type="tel" autocomplete="tel" placeholder="Ej. 76543210"
                    class="w-full px-3 py-2.5 text-sm border border-slate-200 bg-white rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400/30 focus:border-indigo-400 transition-all" />
                </div>
              </div>

              <div>
                <label class="block text-xs font-medium text-slate-600 mb-1.5">Motivo / Observaciones <span class="text-slate-400 font-normal">(opcional)</span></label>
                <textarea v-model="form.descripcion" rows="3" maxlength="500"
                  placeholder="Describe brevemente el motivo de tu solicitud..."
                  :class="['w-full px-3 py-2.5 text-sm border rounded-xl focus:outline-none focus:ring-2 resize-none transition-all placeholder:text-slate-400', inputCls('descripcion')]" />
                <div class="flex justify-between mt-1">
                  <p v-if="errors.descripcion" class="text-xs text-red-500">{{ errors.descripcion }}</p>
                  <p class="text-xs text-slate-400 ml-auto">{{ form.descripcion.length }}/500</p>
                </div>
              </div>

              <!-- Error de envío -->
              <Transition name="slide-fade">
                <div v-if="envioError"
                  class="flex items-start gap-3 p-3.5 bg-red-50 border border-red-200 rounded-xl">
                  <svg class="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" stroke-width="1.5" />
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01" />
                  </svg>
                  <div>
                    <p class="text-sm font-semibold text-red-700">No se pudo enviar la solicitud</p>
                    <p class="text-xs mt-0.5 text-red-600">{{ envioError }}</p>
                  </div>
                </div>
              </Transition>

              <!-- Errores de validación resumidos (si hay pero el usuario no los ve) -->
              <Transition name="slide-fade">
                <div v-if="Object.keys(errors).length && !enviando"
                  class="flex items-start gap-2.5 p-3 bg-red-50 border border-red-200 rounded-xl">
                  <svg class="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <p class="text-xs text-red-600">Revisa los campos marcados en rojo antes de continuar.</p>
                </div>
              </Transition>

              <!-- Botón enviar -->
              <button @click="enviar" :disabled="enviando" type="button"
                :class="['w-full py-3.5 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2',
                  !enviando
                    ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-200 active:scale-[0.98]'
                    : 'bg-indigo-400 text-white cursor-not-allowed']">
                <svg v-if="enviando" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
                <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
                {{ enviando ? 'Enviando solicitud...' : 'Enviar solicitud' }}
              </button>

              <p class="text-xs text-center text-slate-400">
                Al enviar, los encargados de la biblioteca serán notificados automáticamente.
              </p>

            </div>
          </div>

        </div>
      </Transition>
    </main>

    <!-- ── Footer ───────────────────────────────────────────────────────── -->
    <footer class="border-t border-slate-200 bg-white mt-6">
      <div class="max-w-3xl mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-2">
        <p class="text-xs text-slate-400">© {{ new Date().getFullYear() }} SIGEB — Sistema de Gestión Bibliográfica · UMSA</p>
        <p class="text-xs text-slate-400">Facultad de Humanidades y Ciencias de la Educación</p>
      </div>
    </footer>

  </div>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.25s ease, transform 0.25s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; transform: translateY(8px); }

.slide-fade-enter-active { transition: opacity 0.2s ease, transform 0.2s ease; }
.slide-fade-leave-active { transition: opacity 0.15s ease; }
.slide-fade-enter-from { opacity: 0; transform: translateY(-6px); }
.slide-fade-leave-to { opacity: 0; }
</style>