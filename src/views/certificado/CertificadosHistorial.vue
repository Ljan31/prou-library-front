<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useAuthStore } from '@/stores/auth.store'
import { usePermissions } from '@/composables/usePermissions'
import { useUiStore } from '@/stores/ui.store'
import api from '@/services/axios'
import CertificadosModal from './CertificadosModal.vue'
import CertificadoPdfViewer from './CertificadoPdfViewer.vue'

const auth = useAuthStore()
const { isAdmin, isBibliotecario } = usePermissions()
const ui = useUiStore()

// ─── Types ────────────────────────────────────────────────────────────────────
interface Certificado {
  id_certificado: number
  fechaEmision: string
  fechaVencimiento: string
  codigo_verificacion: string
  estadoCertificado: 'VIGENTE' | 'VENCIDO' | 'ANULADO'
  urlDescarga: string
  bibliotecaId?: number
  bibliotecaNombre?: string
  usuario?: { id_usuario?: number; nombreCompleto?: string; ci?: number | string; username?: string }
  bibliotecario?: { nombreCompleto?: string }
}

interface Biblioteca {
  id_biblioteca: number
  nombre: string
}

// ─── Init ─────────────────────────────────────────────────────────────────────
onMounted(() => {
  if (isAdmin.value) fetchBibliotecas()
  fetchCertificados()
})

// ─── Bibliotecas (solo admin) ─────────────────────────────────────────────────
const bibliotecas = ref<Biblioteca[]>([])

async function fetchBibliotecas() {
  try {
    const { data } = await api.get('/bibliotecas')
    bibliotecas.value = data.data ?? data ?? []
  } catch { bibliotecas.value = [] }
}

// ─── Filtros ──────────────────────────────────────────────────────────────────
const filtroEstado = ref<'' | 'VIGENTE' | 'VENCIDO' | 'ANULADO'>('')
const filtroBiblioteca = ref<number | ''>('')  // solo admin
const busqueda = ref('')
let busquedaDebounce: ReturnType<typeof setTimeout>

watch(busqueda, () => {
  clearTimeout(busquedaDebounce)
  busquedaDebounce = setTimeout(fetchCertificados, 400)
})
watch([filtroEstado, filtroBiblioteca], fetchCertificados)

// ─── Datos ────────────────────────────────────────────────────────────────────
const certificados = ref<Certificado[]>([])
const loading = ref(false)
const error = ref<string | null>(null)

const bibliotecarioId = computed(() => auth.user?.biblioteca?.[0]?.id_biblioteca ?? null)

async function fetchCertificados() {
  loading.value = true
  error.value = null
  try {
    let url = ''
    const params: Record<string, unknown> = {}

    if (isAdmin.value) {
      // Admin: puede filtrar por biblioteca o traer todos
      const bibId = filtroBiblioteca.value || null
      url = bibId ? `/certificados/biblioteca/${bibId}` : '/certificados'
      if (filtroEstado.value) params.estado = filtroEstado.value
    } else {
      // Bibliotecario: solo su biblioteca
      url = `/certificados/biblioteca/${bibliotecarioId.value}`
      if (filtroEstado.value) params.estado = filtroEstado.value
    }

    const { data } = await api.get(url, { params })
    certificados.value = data.data ?? []
  } catch (e: unknown) {
    error.value = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      ?? 'No se pudieron cargar los certificados'
    certificados.value = []
  } finally {
    loading.value = false
  }
}

// Filtro local por búsqueda (nombre o código)
const certificadosFiltrados = computed(() => {
  if (!busqueda.value.trim()) return certificados.value
  const q = busqueda.value.toLowerCase()
  return certificados.value.filter(c =>
    c.usuario?.nombreCompleto?.toLowerCase().includes(q) ||
    c.codigo_verificacion.toLowerCase().includes(q) ||
    String(c.usuario?.ci ?? '').includes(q)
  )
})

// ─── Anular ───────────────────────────────────────────────────────────────────
const anulandoId = ref<number | null>(null)

async function anularCertificado(id: number) {
  anulandoId.value = id
  try {
    await api.patch(`/certificados/${id}/anular`)
    ui.toast.success('Certificado anulado', 'El certificado fue anulado correctamente')
    fetchCertificados()
    // Refrescar modal si estaba abierto con ese usuario
    if (modalCerts.value.length) {
      const cert = certificados.value.find(c => c.id_certificado === id)
      if (cert?.usuario?.id_usuario) {
        fetchUsuarioCerts(cert.usuario.id_usuario)
      }
    }
  } catch {
    ui.toast.error('Error', 'No se pudo anular el certificado')
  } finally {
    anulandoId.value = null
  }
}

// ─── Modal ver certs de usuario ───────────────────────────────────────────────
const showModal = ref(false)
const modalCerts = ref<Certificado[]>([])
const modalTitulo = ref('')
const modalUserId = ref<number | null>(null)

async function fetchUsuarioCerts(userId: number) {
  try {
    const { data } = await api.get(`/certificados/usuario/${userId}`)
    modalCerts.value = data.data ?? []
  } catch { modalCerts.value = [] }
}

async function verCertsUsuario(cert: Certificado) {
  if (!cert.usuario?.id_usuario) return
  modalUserId.value = cert.usuario.id_usuario
  modalTitulo.value = `Certificados de ${cert.usuario.nombreCompleto ?? 'usuario'}`
  await fetchUsuarioCerts(cert.usuario.id_usuario)
  showModal.value = true
}

async function handleAnularDesdeModal(id: number) {
  await anularCertificado(id)
  if (modalUserId.value) await fetchUsuarioCerts(modalUserId.value)
}

// ─── PDF Viewer ───────────────────────────────────────────────────────────────
const pdfViewerShow = ref(false)
const pdfViewerCertId = ref<number | null>(null)

function abrirVisor(id: number) {
  pdfViewerCertId.value = id
  pdfViewerShow.value = true
}

// ─── Stats rápidas ────────────────────────────────────────────────────────────
const stats = computed(() => ({
  total: certificados.value.length,
  vigentes: certificados.value.filter(c => c.estadoCertificado === 'VIGENTE').length,
  vencidos: certificados.value.filter(c => c.estadoCertificado === 'VENCIDO').length,
  anulados: certificados.value.filter(c => c.estadoCertificado === 'ANULADO').length,
}))

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatDate(s?: string) {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('es-BO', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatDateTime(s?: string) {
  if (!s) return '—'
  return new Date(s).toLocaleString('es-BO', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function estadoCertClasses(estado: string) {
  const m: Record<string, string> = {
    VIGENTE: 'bg-emerald-100 text-emerald-700',
    VENCIDO: 'bg-amber-100 text-amber-700',
    ANULADO: 'bg-red-100 text-red-700',
  }
  return m[estado] ?? 'bg-slate-100 text-slate-600'
}
</script>

<template>
  <div class="space-y-5">

    <!-- Subcomponentes -->
    <CertificadoPdfViewer :show="pdfViewerShow" :certificado-id="pdfViewerCertId" @close="pdfViewerShow = false" />

    <CertificadosModal :show="showModal" :certificados="modalCerts" :titulo="modalTitulo" :can-anular="true"
      :anulando-id="anulandoId" @close="showModal = false" @anular="handleAnularDesdeModal" />

    <!-- Stats -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <div class="bg-white rounded-xl border border-slate-200 p-4">
        <p class="text-xs text-slate-400 mb-1">Total</p>
        <p class="text-2xl font-bold text-slate-800">{{ stats.total }}</p>
      </div>
      <div class="bg-white rounded-xl border border-emerald-200 p-4">
        <p class="text-xs text-slate-400 mb-1">Vigentes</p>
        <p class="text-2xl font-bold text-emerald-600">{{ stats.vigentes }}</p>
      </div>
      <div class="bg-white rounded-xl border border-amber-200 p-4">
        <p class="text-xs text-slate-400 mb-1">Vencidos</p>
        <p class="text-2xl font-bold text-amber-600">{{ stats.vencidos }}</p>
      </div>
      <div class="bg-white rounded-xl border border-red-200 p-4">
        <p class="text-xs text-slate-400 mb-1">Anulados</p>
        <p class="text-2xl font-bold text-red-500">{{ stats.anulados }}</p>
      </div>
    </div>

    <!-- Filtros -->
    <div class="bg-white rounded-xl border border-slate-200 p-4 flex flex-col sm:flex-row gap-3">

      <!-- Búsqueda -->
      <div class="relative flex-1">
        <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" fill="none"
          stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input v-model="busqueda" type="text" placeholder="Buscar por nombre, CI o código..."
          class="w-full h-9 pl-9 pr-3 text-sm rounded-lg border border-slate-200 bg-slate-50 text-slate-900 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all" />
      </div>

      <!-- Filtro biblioteca (solo admin) -->
      <select v-if="isAdmin" v-model="filtroBiblioteca"
        class="h-9 px-3 text-sm rounded-lg border border-slate-200 bg-slate-50 text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all">
        <option value="">Todas las bibliotecas</option>
        <option v-for="b in bibliotecas" :key="b.id_biblioteca" :value="b.id_biblioteca">{{ b.nombre }}</option>
      </select>

      <!-- Filtro estado -->
      <div class="flex gap-1">
        <button
          v-for="f in [{ v: '', l: 'Todos' }, { v: 'VIGENTE', l: 'Vigente' }, { v: 'VENCIDO', l: 'Vencido' }, { v: 'ANULADO', l: 'Anulado' }]"
          :key="f.v" @click="filtroEstado = f.v as typeof filtroEstado" :class="['px-3 h-9 rounded-lg text-xs font-medium transition-all border',
            filtroEstado === f.v
              ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
              : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300 hover:text-indigo-600']">
          {{ f.l }}
        </button>
      </div>

      <!-- Refresh -->
      <button @click="fetchCertificados"
        class="h-9 px-3 rounded-lg border border-slate-200 text-slate-500 hover:text-slate-700 hover:border-slate-300 transition-all"
        title="Actualizar">
        <svg class="w-4 h-4" :class="{ 'animate-spin': loading }" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      </button>
    </div>

    <!-- Tabla / Lista -->
    <div class="bg-white rounded-xl border border-slate-200 overflow-hidden">

      <!-- Loading skeletons -->
      <div v-if="loading" class="p-4 space-y-3">
        <div v-for="i in 5" :key="i" class="flex items-center gap-4">
          <div class="w-8 h-8 rounded-full bg-slate-100 animate-pulse flex-shrink-0" />
          <div class="flex-1 space-y-1.5">
            <div class="h-3 bg-slate-100 rounded animate-pulse w-2/5" />
            <div class="h-2.5 bg-slate-100 rounded animate-pulse w-1/3" />
          </div>
          <div class="h-6 w-16 bg-slate-100 rounded-full animate-pulse" />
          <div class="h-6 w-12 bg-slate-100 rounded animate-pulse" />
        </div>
      </div>

      <!-- Error -->
      <div v-else-if="error" class="flex flex-col items-center justify-center py-16 gap-3">
        <svg class="w-10 h-10 text-red-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <p class="text-sm text-slate-500">{{ error }}</p>
        <button @click="fetchCertificados" class="text-sm text-indigo-600 hover:underline">Reintentar</button>
      </div>

      <!-- Empty -->
      <div v-else-if="!certificadosFiltrados.length" class="flex flex-col items-center justify-center py-16 gap-3">
        <svg class="w-10 h-10 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <p class="text-sm font-medium text-slate-500">No se encontraron certificados</p>
        <p class="text-xs text-slate-400">Prueba con otros filtros</p>
      </div>

      <!-- Tabla de datos -->
      <div v-else class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-slate-100 bg-slate-50/60">
              <th class="text-left text-xs font-medium text-slate-500 px-4 py-3">Estudiante</th>
              <th class="text-left text-xs font-medium text-slate-500 px-4 py-3 hidden md:table-cell">Código</th>
              <th class="text-left text-xs font-medium text-slate-500 px-4 py-3 hidden lg:table-cell">Emitido</th>
              <th class="text-left text-xs font-medium text-slate-500 px-4 py-3 hidden sm:table-cell">Vence</th>
              <th v-if="isAdmin" class="text-left text-xs font-medium text-slate-500 px-4 py-3 hidden xl:table-cell">
                Biblioteca</th>
              <th class="text-left text-xs font-medium text-slate-500 px-4 py-3">Estado</th>
              <th class="text-right text-xs font-medium text-slate-500 px-4 py-3">Acciones</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-50">
            <tr v-for="c in certificadosFiltrados" :key="c.id_certificado"
              class="hover:bg-slate-50/60 transition-colors">
              <!-- Estudiante -->
              <td class="px-4 py-3">
                <div class="flex items-center gap-2.5">
                  <div
                    class="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-semibold text-xs flex-shrink-0">
                    {{ (c.usuario?.nombreCompleto?.[0] ?? '?').toUpperCase() }}
                  </div>
                  <div class="min-w-0">
                    <p class="font-medium text-slate-800 text-sm truncate capitalize">{{ c.usuario?.nombreCompleto ??
                      '—' }}</p>
                    <p class="text-xs text-slate-400">CI: {{ c.usuario?.ci ?? '—' }}</p>
                  </div>
                </div>
              </td>

              <!-- Código -->
              <td class="px-4 py-3 hidden md:table-cell">
                <span class="font-mono text-xs text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                  {{ c.codigo_verificacion.split('-')[0] }}...
                </span>
              </td>

              <!-- Emitido -->
              <td class="px-4 py-3 text-xs text-slate-500 hidden lg:table-cell">
                {{ formatDateTime(c.fechaEmision) }}
              </td>

              <!-- Vence -->
              <td class="px-4 py-3 hidden sm:table-cell">
                <span class="text-xs"
                  :class="c.estadoCertificado === 'VIGENTE' ? 'text-emerald-600 font-medium' : 'text-slate-400'">
                  {{ formatDate(c.fechaVencimiento) }}
                </span>
              </td>

              <!-- Biblioteca (solo admin) -->
              <td v-if="isAdmin" class="px-4 py-3 text-xs text-slate-500 hidden xl:table-cell">
                {{ c.bibliotecaNombre ?? '—' }}
              </td>

              <!-- Estado -->
              <td class="px-4 py-3">
                <span :class="['text-xs font-bold px-2.5 py-0.5 rounded-full', estadoCertClasses(c.estadoCertificado)]">
                  {{ c.estadoCertificado }}
                </span>
              </td>

              <!-- Acciones -->
              <td class="px-4 py-3">
                <div class="flex items-center justify-end gap-1.5">
                  <!-- Ver todos los certs del usuario -->
                  <button v-if="c.usuario?.id_usuario" @click="verCertsUsuario(c)"
                    class="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                    title="Ver certificados del usuario">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  </button>

                  <!-- Vista previa PDF -->
                  <button @click="abrirVisor(c.id_certificado)"
                    class="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                    title="Ver PDF">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                  </button>

                  <!-- Anular -->
                  <button v-if="c.estadoCertificado === 'VIGENTE'" @click="anularCertificado(c.id_certificado)"
                    :disabled="anulandoId === c.id_certificado"
                    class="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-40"
                    title="Anular certificado">
                    <svg v-if="anulandoId === c.id_certificado" class="w-4 h-4 animate-spin" fill="none"
                      viewBox="0 0 24 24">
                      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                    </svg>
                    <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                    </svg>
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        <!-- Contador de resultados -->
        <div class="px-4 py-3 border-t border-slate-100 bg-slate-50/50">
          <p class="text-xs text-slate-400">
            Mostrando {{ certificadosFiltrados.length }} de {{ certificados.length }} certificado(s)
            <span v-if="busqueda"> · filtrado por "{{ busqueda }}"</span>
          </p>
        </div>
      </div>
    </div>
  </div>
</template>