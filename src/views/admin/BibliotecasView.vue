<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useBibliotecasStore } from '@/stores/bibliotecas.store'
import { useAuthStore } from '@/stores/auth.store'
import { useUiStore } from '@/stores/ui.store'
import type { Biblioteca, CarreraDetail } from '@/services/bibliotecas.service'

import BibliotecaFormModal from '@/components/bibliotecas/BibliotecaFormModal.vue'
import CarreraFormModal from '@/components/bibliotecas/CarreraFormModal.vue'
import DeleteConfirmModal from '@/components/bibliotecas/DeleteConfirmModal.vue'

// ─── Stores ───────────────────────────────────────────────────────────────
const store = useBibliotecasStore()
const authStore = useAuthStore()
const uiStore = useUiStore()

// ─── Init ─────────────────────────────────────────────────────────────────
onMounted(async () => {
  uiStore.setPageTitle('Gestión de Bibliotecas')
  uiStore.setBreadcrumbs([{ label: 'Dashboard', to: '/dashboard' }, { label: 'Bibliotecas' }])
  const data = await store.fetchAll()
  console.log('biblioteca', data)
})

// ─── Active tab ───────────────────────────────────────────────────────────
const activeTab = ref<'bibliotecas' | 'carreras'>('bibliotecas')

// ─── Search / filter ─────────────────────────────────────────────────────
const searchBib = ref('')
const searchCar = ref('')
const filterTipo = ref<string>('TODOS')
const filterEst = ref<string>('TODOS')

const filteredBibliotecas = computed(() => {
  let list = store.filteredBibliotecas
  if (searchBib.value.trim()) {
    const q = searchBib.value.toLowerCase()
    list = list.filter(b =>
      b.nombre.toLowerCase().includes(q) ||
      b.carrera?.nombre_carrera.toLowerCase().includes(q)
    )
  }
  if (filterTipo.value !== 'TODOS') list = list.filter(b => b.tipoBiblioteca === filterTipo.value)
  if (filterEst.value !== 'TODOS') list = list.filter(b => b.estado === filterEst.value)
  return list
})

const filteredCarreras = computed(() => {
  if (!searchCar.value.trim()) return store.filteredCarreras
  const q = searchCar.value.toLowerCase()
  return store.filteredCarreras.filter(c =>
    c.nombre_carrera.toLowerCase().includes(q) ||
    c.codigo_carrera.toLowerCase().includes(q)
  )
})

// ─── Modals ───────────────────────────────────────────────────────────────
const showBibModal = ref(false)
const editingBib = ref<Biblioteca | null>(null)
const showCarModal = ref(false)
const editingCar = ref<CarreraDetail | null>(null)
const showDelModal = ref(false)
const delTarget = ref<{ type: 'bib' | 'car'; id: number; name: string } | null>(null)

function openCreateBib() { editingBib.value = null; showBibModal.value = true }
function openEditBib(b: Biblioteca) { editingBib.value = b; showBibModal.value = true }
function openCreateCar() { editingCar.value = null; showCarModal.value = true }
function openEditCar(c: CarreraDetail) { editingCar.value = c; showCarModal.value = true }

function confirmDelete(type: 'bib' | 'car', id: number, name: string) {
  delTarget.value = { type, id, name }
  showDelModal.value = true
}

async function executeDelete() {
  if (!delTarget.value) return
  const { type, id } = delTarget.value
  const ok = type === 'bib'
    ? await store.deleteBiblioteca(id)
    : await store.deleteCarrera(id)
  if (ok) showDelModal.value = false
}

// ─── Helpers ──────────────────────────────────────────────────────────────
function tipoLabel(tipo: string) {
  return { CENTRAL: 'Central', CARRERA: 'Carrera', ESPECIALIZADA: 'Especializada' }[tipo] ?? tipo
}

function tipoColor(tipo: string) {
  return {
    CENTRAL: 'bg-blue-100 text-blue-700',
    CARRERA: 'bg-violet-100 text-violet-700',
    ESPECIALIZADA: 'bg-amber-100 text-amber-700'
  }[tipo] ?? 'bg-gray-100 text-gray-600'
}

function estadoColor(estado: string) {
  return estado === 'ACTIVA'
    ? 'bg-emerald-100 text-emerald-700'
    : 'bg-gray-100 text-gray-500'
}
</script>

<template>
  <div class="min-h-full bg-gray-50 p-6">

    <!-- Page header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
      <div>
        <h1 class="text-2xl font-bold text-gray-900 tracking-tight">Bibliotecas &amp; Carreras</h1>
        <p class="mt-1 text-sm text-gray-500">
          Gestión centralizada de bibliotecas y carreras de la facultad
        </p>
      </div>

      <!-- Stats mini -->
      <div class="flex items-center gap-3">
        <div class="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm">
          <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
          <span class="font-medium text-gray-700">{{ store.totalActivas }}</span>
          <span class="text-gray-400">activas</span>
        </div>
        <div class="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm">
          <span class="font-medium text-gray-700">{{ store.filteredCarreras.length }}</span>
          <span class="text-gray-400">carreras</span>
        </div>
      </div>
    </div>

    <!-- Tabs -->
    <div class="flex items-center gap-1 bg-white border border-gray-200 rounded-xl p-1 w-fit mb-6">
      <button
        v-for="tab in [{ key: 'bibliotecas', label: 'Bibliotecas', icon: 'M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z' }, { key: 'carreras', label: 'Carreras', icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4' }]"
        :key="tab.key" @click="activeTab = tab.key as any"
        class="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all" :class="activeTab === tab.key
          ? 'bg-primary-600 text-white shadow-sm'
          : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'">
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" :d="tab.icon" />
        </svg>
        {{ tab.label }}
      </button>
    </div>

    <!-- ═══════════════════════════════════════════════════════════════════ -->
    <!-- TAB: BIBLIOTECAS                                                    -->
    <!-- ═══════════════════════════════════════════════════════════════════ -->
    <div v-if="activeTab === 'bibliotecas'">
      <!-- Toolbar -->
      <div class="flex flex-col sm:flex-row gap-3 mb-5">
        <!-- Search -->
        <div class="relative flex-1 max-w-sm">
          <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24"
            stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input v-model="searchBib" type="text" placeholder="Buscar biblioteca o carrera…"
            class="w-full pl-9 pr-4 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-400" />
        </div>

        <!-- Filters -->
        <select v-model="filterTipo"
          class="px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500">
          <option value="TODOS">Todos los tipos</option>
          <option value="CENTRAL">Central</option>
          <option value="CARRERA">Carrera</option>
          <option value="ESPECIALIZADA">Especializada</option>
        </select>

        <select v-model="filterEst"
          class="px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500">
          <option value="TODOS">Todos los estados</option>
          <option value="ACTIVA">Activas</option>
          <option value="INACTIVA">Inactivas</option>
        </select>

        <!-- Create btn (admin only) -->
        <button v-if="authStore.isAdmin" @click="openCreateBib"
          class="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors whitespace-nowrap">
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          Nueva biblioteca
        </button>
      </div>

      <!-- Loading skeleton -->
      <div v-if="store.loading" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div v-for="i in 6" :key="i" class="bg-white rounded-xl border border-gray-200 p-5 animate-pulse">
          <div class="h-4 bg-gray-200 rounded w-3/4 mb-3" />
          <div class="h-3 bg-gray-100 rounded w-1/2 mb-2" />
          <div class="h-3 bg-gray-100 rounded w-2/3" />
        </div>
      </div>

      <!-- Error state -->
      <div v-else-if="store.error" class="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
        <svg class="w-8 h-8 text-red-400 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p class="text-sm font-medium text-red-700">{{ store.error }}</p>
        <button @click="store.fetchBibliotecas" class="mt-3 text-xs text-red-600 underline">Reintentar</button>
      </div>

      <!-- Empty state -->
      <div v-else-if="filteredBibliotecas.length === 0"
        class="bg-white border border-gray-200 rounded-xl p-12 text-center">
        <svg class="w-12 h-12 text-gray-300 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
            d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" />
        </svg>
        <p class="text-sm font-medium text-gray-500">No se encontraron bibliotecas</p>
        <p class="text-xs text-gray-400 mt-1">Intenta cambiar los filtros o crea una nueva.</p>
      </div>

      <!-- Grid of cards -->
      <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div v-for="bib in filteredBibliotecas" :key="bib.id_biblioteca"
          class="bg-white rounded-xl border border-gray-200 hover:border-primary-300 hover:shadow-md transition-all group">
          <!-- Card header -->
          <div class="px-5 pt-5 pb-4 border-b border-gray-100">
            <div class="flex items-start gap-3 mb-3">

              <!-- LOGO -->
              <div class="w-12 h-12 rounded-lg bg-gray-100 overflow-hidden flex items-center justify-center">
                <img v-if="bib.logoUrl" :src="bib.logoUrl" alt="logo" class="w-full h-full object-cover" />
                <!-- fallback -->
                <svg v-else class="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" />
                </svg>
              </div>

              <!-- INFO -->
              <div class="flex-1">
                <div class="flex items-start justify-between gap-2 mb-1">
                  <span :class="['text-xs font-medium px-2 py-0.5 rounded-full', tipoColor(bib.tipoBiblioteca)]">
                    {{ tipoLabel(bib.tipoBiblioteca) }}
                  </span>
                  <span :class="['text-xs font-medium px-2 py-0.5 rounded-full', estadoColor(bib.estado)]">
                    {{ bib.estado }}
                  </span>
                </div>

                <h3 class="font-semibold text-gray-800 text-sm leading-snug">
                  {{ bib.nombre }}
                </h3>

                <p v-if="bib.carrera" class="mt-1 text-xs text-gray-500">
                  {{ bib.carrera.nombre_carrera }}
                  <span class="text-gray-400">({{ bib.carrera.codigo_carrera }})</span>
                </p>
              </div>
            </div>
          </div>

          <!-- Card body -->
          <div class="px-5 py-4 space-y-2">
            <div v-if="bib.horario_atencion" class="flex items-center gap-2 text-xs text-gray-500">
              <svg class="w-3.5 h-3.5 flex-shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24"
                stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {{ bib.horario_atencion }}
            </div>
            <div v-if="bib.direccion" class="flex items-center gap-2 text-xs text-gray-500">
              <svg class="w-3.5 h-3.5 flex-shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24"
                stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              {{ bib.direccion }}
            </div>

            <!-- Ejemplares stats -->
            <div class="flex items-center gap-3 pt-1">
              <div class="flex-1 bg-gray-100 rounded-lg px-3 py-2 text-center">
                <p class="text-lg font-bold text-gray-800">{{ bib.ejemplaresTotal }}</p>
                <p class="text-xs text-gray-500">Total</p>
              </div>
              <div class="flex-1 bg-emerald-50 rounded-lg px-3 py-2 text-center">
                <p class="text-lg font-bold text-emerald-700">{{ bib.ejemplaresDisponibles }}</p>
                <p class="text-xs text-emerald-600">Disponibles</p>
              </div>
            </div>
          </div>

          <!-- Card actions -->
          <div v-if="authStore.isAdmin || authStore.isBibliotecario" class="flex items-center gap-2 px-5 pb-4">
            <button @click="openEditBib(bib)"
              class="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium text-primary-600 bg-primary-50 rounded-lg hover:bg-primary-100 transition-colors">
              <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Editar
            </button>
            <button v-if="authStore.isAdmin" @click="confirmDelete('bib', bib.id_biblioteca, bib.nombre)"
              class="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors">
              <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Eliminar
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- ═══════════════════════════════════════════════════════════════════ -->
    <!-- TAB: CARRERAS                                                       -->
    <!-- ═══════════════════════════════════════════════════════════════════ -->
    <div v-if="activeTab === 'carreras'">
      <!-- Toolbar -->
      <div class="flex flex-col sm:flex-row gap-3 mb-5">
        <div class="relative flex-1 max-w-sm">
          <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24"
            stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input v-model="searchCar" type="text" placeholder="Buscar carrera o código…"
            class="w-full pl-9 pr-4 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
        <button v-if="authStore.isAdmin" @click="openCreateCar"
          class="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors whitespace-nowrap">
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          Nueva carrera
        </button>
      </div>

      <!-- Loading -->
      <div v-if="store.loadingCarreras" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div v-for="i in 4" :key="i" class="bg-white rounded-xl border border-gray-200 p-5 animate-pulse">
          <div class="h-4 bg-gray-200 rounded w-2/3 mb-3" />
          <div class="h-3 bg-gray-100 rounded w-1/3" />
        </div>
      </div>

      <!-- Empty -->
      <div v-else-if="filteredCarreras.length === 0"
        class="bg-white border border-gray-200 rounded-xl p-12 text-center">
        <svg class="w-12 h-12 text-gray-300 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
            d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
        <p class="text-sm font-medium text-gray-500">No se encontraron carreras</p>
      </div>

      <!-- Table -->
      <div v-else class="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table class="w-full text-sm">
          <thead class="bg-gray-50 border-b border-gray-200">
            <tr>
              <th class="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Carrera</th>
              <th class="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Código</th>
              <th class="px-5 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Bibliotecas
              </th>
              <th v-if="authStore.isAdmin"
                class="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Acciones</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            <tr v-for="car in filteredCarreras" :key="car.id_carrera" class="hover:bg-gray-50 transition-colors">
              <td class="px-5 py-4">
                <div class="flex items-center gap-3">
                  <div
                    class="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600 flex-shrink-0">
                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5" />
                    </svg>
                  </div>
                  <span class="font-medium text-gray-800">{{ car.nombre_carrera }}</span>
                </div>
              </td>
              <td class="px-5 py-4">
                <code class="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">{{ car.codigo_carrera }}</code>
              </td>
              <td class="px-5 py-4 text-center">
                <span class="inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold"
                  :class="car.bibliotecasCount > 0 ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-500'">
                  {{ car.bibliotecasCount }}
                </span>
              </td>
              <td v-if="authStore.isAdmin" class="px-5 py-4">
                <div class="flex items-center justify-end gap-2">
                  <button @click="openEditCar(car)"
                    class="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                    title="Editar">
                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button @click="confirmDelete('car', car.id_carrera, car.nombre_carrera)"
                    class="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Eliminar">
                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- ─── Modals ─────────────────────────────────────────────────────── -->
    <BibliotecaFormModal v-model="showBibModal" :editing="editingBib" @saved="store.fetchBibliotecas" />

    <CarreraFormModal v-model="showCarModal" :editing="editingCar" @saved="store.fetchCarreras" />

    <DeleteConfirmModal v-model="showDelModal" :loading="store.loading || store.loadingCarreras"
      :title="`Eliminar ${delTarget?.type === 'bib' ? 'biblioteca' : 'carrera'}`"
      :message="`¿Estás seguro de que deseas eliminar «${delTarget?.name}»? Esta acción no se puede deshacer.`"
      @confirm="executeDelete" />
  </div>
</template>