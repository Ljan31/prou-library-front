<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useUiStore } from '@/stores/ui.store'
import { useAuthStore } from '@/stores/auth.store'
import { usePermissions } from '@/composables/usePermissions'

import SButton from '@/components/ui/SButton.vue'
import SInput from '@/components/ui/SInput.vue'
import SSelect from '@/components/ui/SSelect.vue'
import SCard from '@/components/ui/SCard.vue'
import SSkeleton from '@/components/feedback/SSkeleton.vue'
import SEmptyState from '@/components/feedback/SEmptyState.vue'
import LibroCard from '@/components/catalogo/LibroCard.vue'
import LibroFormModal from '@/components/catalogo/LibroFormModal.vue'
import LibroDetalleModal from '@/components/catalogo/LibroDetalleModal.vue'

import type { Libro, Categoria } from '@/types/catalogo'
import { buscarLibros, eliminarLibro as eliminarLibroService } from '@/services/libros.service'
import { obtenerCategorias } from '@/services/categorias.service'

const ui = useUiStore()
const auth = useAuthStore()
const { isAdmin, isBibliotecario } = usePermissions()

// ─── Estado UI ────────────────────────────────────────────────────────────
const mostrarFormModal = ref(false)
const mostrarDetalleModal = ref(false)
const libroSeleccionado = ref<Libro | null>(null)
const libroParaEditar = ref<Libro | null>(null)
const vistaActual = ref<'grid' | 'lista'>('grid')

// ─── Filtros ──────────────────────────────────────────────────────────────
const busqueda = ref('')
const categoriaFiltro = ref('')
const pagina = ref(1)
const porPagina = 12

// ─── Categorías ───────────────────────────────────────────────────────────
const categorias = ref<Categoria[]>([])

const opcionesCategorias = computed(() => [
  { value: '', label: 'Todas las categorías' },
  ...categorias.value.map(c => ({
    value: String(c.id_categoria),
    label: c.nombre_categoria
  }))
])

// ─── Libros ───────────────────────────────────────────────────────────────
const cargandoLibros = ref(false)
const errorLibros = ref<string | null>(null)
const libros = ref<Libro[]>([])
const totalPaginas = ref(1)
const totalLibros = ref(0)

// ─── Inicialización ───────────────────────────────────────────────────────
onMounted(async () => {
  ui.setBreadcrumbs([{ label: 'Catálogo', to: '/catalogo' }])
  // Carga en paralelo para arrancar más rápido
  await Promise.all([cargarCategorias(), ejecutarBusqueda()])
})

async function cargarCategorias() {
  try {
    categorias.value = await obtenerCategorias()
  } catch {
    categorias.value = []
  }
}

async function ejecutarBusqueda() {
  cargandoLibros.value = true
  errorLibros.value = null

  try {
    const { libros: resultado, totalPaginas: totalP, totalLibros: totalL } = await buscarLibros({
      titulo: busqueda.value,
      categoriaId: categoriaFiltro.value ? Number(categoriaFiltro.value) : undefined,
      pagina: pagina.value,
      size: porPagina,
      sort: 'titulo,asc',
    })

    libros.value = resultado
    totalPaginas.value = totalP
    totalLibros.value = totalL
  } catch (e: unknown) {
    errorLibros.value = e instanceof Error ? e.message : 'Error al cargar libros'
    libros.value = []
  } finally {
    cargandoLibros.value = false
  }
}

// Debounce en filtros
let debounceTimer: ReturnType<typeof setTimeout>
watch([busqueda, categoriaFiltro], () => {
  pagina.value = 1
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(ejecutarBusqueda, 400)
})

function cambiarPagina(nueva: number) {
  pagina.value = nueva
  ejecutarBusqueda()
}

// ─── Acciones ─────────────────────────────────────────────────────────────
function abrirDetalle(libro: Libro) {
  libroSeleccionado.value = libro
  mostrarDetalleModal.value = true
}

function abrirCrear() {
  libroParaEditar.value = null
  mostrarFormModal.value = true
}

function abrirEditar(libro: Libro) {
  libroParaEditar.value = libro
  mostrarFormModal.value = true
}

async function eliminarLibro(libro: Libro) {
  if (!confirm(`¿Eliminar "${libro.titulo}"? Esta acción no se puede deshacer.`)) return
  try {
    await eliminarLibroService(libro.id_libro)
    ui.toast.success('Libro eliminado', `"${libro.titulo}" fue eliminado correctamente`)
    ejecutarBusqueda()
  } catch {
    ui.toast.error('Error', 'No se pudo eliminar el libro')
  }
}

function onLibroGuardado() {
  mostrarFormModal.value = false
  ejecutarBusqueda()
  ui.toast.success(
    'Guardado',
    libroParaEditar.value ? 'Libro actualizado correctamente' : 'Libro creado correctamente'
  )
}
</script>

<template>
  <div class="page-container">
    <!-- Header -->
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-2xl font-semibold text-slate-900">Catálogo Bibliográfico</h1>
        <p class="text-sm text-slate-500 mt-0.5">
          {{ totalLibros }} libro{{ totalLibros !== 1 ? 's' : '' }}
          encontrado{{ totalLibros !== 1 ? 's' : '' }}
        </p>
      </div>

      <div class="flex items-center gap-3">
        <!-- Toggle vista -->
        <div class="flex rounded-lg border border-slate-200 overflow-hidden">
          <button @click="vistaActual = 'grid'" :class="['px-3 py-1.5 text-sm transition-colors',
            vistaActual === 'grid' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-50']">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6z
                   M14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6z
                   M4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2z
                   M14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
          </button>
          <button @click="vistaActual = 'lista'" :class="['px-3 py-1.5 text-sm transition-colors',
            vistaActual === 'lista' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-50']">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
          </button>
        </div>

        <SButton v-if="isAdmin || isBibliotecario" @click="abrirCrear" variant="primary">
          <svg class="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          Nuevo libro
        </SButton>
      </div>
    </div>

    <!-- Filtros -->
    <SCard class="mb-6" padding="md">
      <div class="flex flex-col sm:flex-row gap-3">
        <SInput v-model="busqueda" placeholder="Buscar por título, autor o ISBN..." icon-left="search" clearable
          class="flex-1" />
        <SSelect v-model="categoriaFiltro" :options="opcionesCategorias" class="sm:w-64" />
      </div>
    </SCard>

    <!-- Cargando → skeletons -->
    <div v-if="cargandoLibros">
      <div :class="vistaActual === 'grid'
        ? 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4'
        : 'flex flex-col gap-3'">
        <div v-for="i in 8" :key="i">
          <SSkeleton v-if="vistaActual === 'grid'" width="100%" height="280px" />
          <SSkeleton v-else width="100%" height="80px" />
        </div>
      </div>
    </div>

    <!-- Error -->
    <div v-else-if="errorLibros" class="text-center py-12">
      <p class="text-red-500 text-sm">{{ errorLibros }}</p>
      <SButton variant="ghost" size="sm" class="mt-3" @click="ejecutarBusqueda">
        Reintentar
      </SButton>
    </div>

    <!-- Sin resultados -->
    <SEmptyState v-else-if="!libros.length" title="Sin resultados"
      description="No hay libros que coincidan con tu búsqueda." icon="search">
      <template #action>
        <SButton variant="ghost" size="sm" @click="busqueda = ''; categoriaFiltro = ''">
          Limpiar filtros
        </SButton>
      </template>
    </SEmptyState>

    <!-- Libros -->
    <div v-else>
      <div :class="vistaActual === 'grid'
        ? 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4'
        : 'flex flex-col gap-3'">
        <LibroCard v-for="libro in libros" :key="libro.id_libro" :libro="libro" :vista="vistaActual"
          :puede-editar="isAdmin || isBibliotecario" @ver="abrirDetalle" @editar="abrirEditar"
          @eliminar="eliminarLibro" />
      </div>

      <!-- Paginación -->
      <div v-if="totalPaginas > 1" class="flex items-center justify-center gap-2 mt-8">
        <SButton variant="ghost" size="sm" :disabled="pagina === 1" @click="cambiarPagina(pagina - 1)">
          Anterior
        </SButton>
        <span class="text-sm text-slate-600">Página {{ pagina }} de {{ totalPaginas }}</span>
        <SButton variant="ghost" size="sm" :disabled="pagina === totalPaginas" @click="cambiarPagina(pagina + 1)">
          Siguiente
        </SButton>
      </div>
    </div>

    <!-- Modales -->
    <LibroFormModal v-if="mostrarFormModal" :libro="libroParaEditar" :categorias="categorias ?? []"
      @close="mostrarFormModal = false" @saved="onLibroGuardado" />

    <LibroDetalleModal v-if="mostrarDetalleModal && libroSeleccionado" :libro="libroSeleccionado"
      @close="mostrarDetalleModal = false" @editar="(l) => { mostrarDetalleModal = false; abrirEditar(l) }" />
  </div>
</template>