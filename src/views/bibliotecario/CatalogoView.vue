<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useUiStore } from '@/stores/ui.store'
import { useAuthStore } from '@/stores/auth.store'
import { usePermissions } from '@/composables/usePermissions'
import { useReservasStore } from '@/stores/reservas.store'
import SButton from '@/components/ui/SButton.vue'
import SInput from '@/components/ui/SInput.vue'
import SSelect from '@/components/ui/SSelect.vue'
import SCard from '@/components/ui/SCard.vue'
import SSkeleton from '@/components/feedback/SSkeleton.vue'
import SEmptyState from '@/components/feedback/SEmptyState.vue'
import LibroReservaCard from '@/components/reservas/LibroReservaCard.vue'
import ReservaModalConfirm from '@/components/reservas/ReservaModalConfirm.vue'
import LibroCard from '@/components/catalogo/LibroCard.vue'
import LibroFormModal from '@/components/catalogo/LibroFormModal.vue'
import LibroDetalleModal from '@/components/catalogo/LibroDetalleModal.vue'
import type { Libro, Categoria } from '@/types/catalogo'
import { buscarLibros, eliminarLibro as eliminarLibroService, obtenerLibro } from '@/services/libros.service'
import { obtenerCategorias } from '@/services/categorias.service'
import type { LibroPublico, BibliotecaPublica } from '@/types/reservas'
import ConfirmModal from '@/components/ui/ConfirmModal.vue'

const ui = useUiStore()
const auth = useAuthStore()
const { isAdmin, isBibliotecario } = usePermissions()
const reservasStore = useReservasStore()

// ─── Estado UI ────────────────────────────────────────────────────────────
const mostrarFormModal = ref(false)
const mostrarDetalleModal = ref(false)
const mostrarConfirmEliminar = ref(false)
const libroSeleccionado = ref<Libro | null>(null)
const libroParaEditar = ref<Libro | null>(null)
const libroParaEliminar = ref<Libro | null>(null)
const eliminando = ref(false)
const vistaActual = ref<'grid' | 'lista'>('grid')

// ─── Filtros ──────────────────────────────────────────────────────────────
const busqueda = ref('')
const categoriaFiltro = ref('')
const anioFiltro = ref<number | null>(null)
const pagina = ref(1)
const porPagina = 12

// ─── Categorías ───────────────────────────────────────────────────────────
const categorias = ref<Categoria[]>([])
const biblioteca = ref<BibliotecaPublica>()

// Modal de confirmación de reserva
const mostrarModal = ref(false)

const opcionesCategorias = computed(() => [
  { value: '', label: 'Todas las categorías' },
  ...categorias.value.map(c => ({
    value: String(c.id_categoria),      // ← idCategoria (nuevo campo)
    label: c.nombre_categoria           // ← nombreCategoria (nuevo campo)
  }))
])

// ─── Libros ───────────────────────────────────────────────────────────────
const cargandoLibros = ref(false)
const errorLibros = ref<string | null>(null)
const libros = ref<Libro[]>([])
const totalPaginas = ref(1)
const totalLibros = ref(0)

onMounted(async () => {
  ui.setBreadcrumbs([{ label: 'Catálogo', to: '/catalogo' }])
  await Promise.all([cargarCategorias(), ejecutarBusqueda()])

  if (auth.isAuthenticated && reservasStore.tienePendiente) {
    const pending = reservasStore.reservaPendiente!
    libroSeleccionado.value = {
      idLibro: pending.libroId,
      titulo: pending.libroTitulo,
      autor: pending.libroAutor,
      isbn: '',
      portadaUrl: pending.portadaUrl,
    }
    mostrarModal.value = true
  }
})
watch(
  () => auth.isAuthenticated,
  async (isAuth) => {
    if (isAuth) {
      await reservasStore.cargarMisReservas()
    }
  },
  { immediate: true }
)
async function cargarCategorias() {
  try {
    categorias.value = await obtenerCategorias()
  }
  catch { categorias.value = [] }
}

async function ejecutarBusqueda() {
  cargandoLibros.value = true
  errorLibros.value = null
  try {
    const resultado = await buscarLibros({
      titulo: busqueda.value,
      categoriaId: categoriaFiltro.value ? Number(categoriaFiltro.value) : undefined,
      autor: busqueda.value || undefined,
      anoPublicacion: anioFiltro.value ?? undefined,
      pagina: pagina.value,
      size: porPagina,
    })
    libros.value = resultado.libros
    totalPaginas.value = resultado.totalPaginas
    totalLibros.value = resultado.totalLibros
  } catch (e: unknown) {
    errorLibros.value = e instanceof Error ? e.message : 'Error al cargar libros'
    libros.value = []
  } finally {
    cargandoLibros.value = false
  }
}

let debounceTimer: ReturnType<typeof setTimeout>
watch([busqueda, categoriaFiltro, anioFiltro], () => {
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
function cerrarFormModal() {
  mostrarFormModal.value = false
  // Pequeño delay para limpiar el formulario antes de destruirlo
  setTimeout(() => {
    libroParaEditar.value = null
  }, 300)
}

function abrirConfirmEliminar(libro: Libro) {
  libroParaEliminar.value = libro
  mostrarConfirmEliminar.value = true
}

// Ejecuta la eliminación cuando el usuario confirma
async function confirmarEliminacionLibro() {
  if (!libroParaEliminar.value) return

  const libro = libroParaEliminar.value
  eliminando.value = true

  try {
    await eliminarLibroService(libro.idLibro)

    ui.toast.success('Eliminado', `"${libro.titulo}" ha sido eliminado correctamente`)

    await ejecutarBusqueda()

    // Si el libro eliminado estaba abierto en detalle, cerrarlo
    if (libroSeleccionado.value?.idLibro === libro.idLibro) {
      mostrarDetalleModal.value = false
      libroSeleccionado.value = null
    }
  } catch (e: unknown) {
    const mensaje = e instanceof Error ? e.message : 'No se pudo eliminar el libro'
    ui.toast.error('Error', mensaje)
  } finally {
    eliminando.value = false
    mostrarConfirmEliminar.value = false
    libroParaEliminar.value = null
  }
}
// Cuando se guarda el libro, refrescar la lista Y el libro abierto en detalle
async function onLibroGuardado() {
  mostrarFormModal.value = false
  await ejecutarBusqueda()
  // Si el libro guardado es el que está en el detalle, refrescarlo
  if (libroSeleccionado.value && libroParaEditar.value?.idLibro === libroSeleccionado.value.idLibro) {
    try {
      libroSeleccionado.value = await obtenerLibro(libroSeleccionado.value.idLibro)
    } catch { /* sin problema */ }
  }
  ui.toast.success('Guardado', libroParaEditar.value ? 'Libro actualizado' : 'Libro creado')
}

// El detalle pide refrescar el libro (cuando se agrega edición/ejemplar)
async function onDetalleEditar(libro: Libro) {
  mostrarDetalleModal.value = false
  // Pequeño delay para que el sub-modal del detalle haya cerrado
  await new Promise(r => setTimeout(r, 50))
  libroParaEditar.value = libro
  mostrarFormModal.value = true
}
function resetFiltros() {
  busqueda.value = ''
  categoriaFiltro.value = ''
  anioFiltro.value = null
  pagina.value = 1
  ejecutarBusqueda()
}

// reserva
function iniciarReserva(libro: LibroPublico) {
  libroSeleccionado.value = libro
  if (!auth.isAuthenticated) {
    // Guardar intención en el store
    reservasStore.guardarReservaPendiente({
      libroId: libro.idLibro,
      libroTitulo: libro.titulo,
      libroAutor: libro.autor,
      portadaUrl: libro.portadaUrl,
      // La biblioteca se selecciona en el modal, pero guardamos placeholder
      bibliotecaId: libro.idBiblioteca,
      bibliotecaNombre: libro.nombreBiblioteca,
    })
    // Redirigir a login con retorno al catálogo
    router.push({ name: 'login', query: { redirect: '/catalogo-reservas' } })
    return
  }

  mostrarModal.value = true
}
function onModalClose() {
  mostrarModal.value = false
  libroSeleccionado.value = null
}

async function onReservaConfirmada() {
  mostrarModal.value = false
  libroSeleccionado.value = null
  // Recargar para actualizar disponibilidad si aplica
  await cargarCatalogo()
}
const libroIdsReservados = computed(() =>
  auth.isAuthenticated ? reservasStore.libroIdsConReservaActiva : new Set<number>()
)
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

        <div class="flex flex-col items-start gap-2">

          <!-- Fila 1: botones de vista -->
          <div class="flex rounded-lg border border-slate-200 overflow-hidden">
            <button @click="vistaActual = 'grid'" :class="[
              'px-3 py-1.5 text-sm transition-colors',
              vistaActual === 'grid'
                ? 'bg-indigo-600 text-white'
                : 'text-slate-600 hover:bg-slate-50'
            ]">
              <!-- icono -->
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6z
                   M14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6z
                   M4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2z
                   M14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
            </button>

            <button @click="vistaActual = 'lista'" :class="[
              'px-3 py-1.5 text-sm transition-colors',
              vistaActual === 'lista'
                ? 'bg-indigo-600 text-white'
                : 'text-slate-600 hover:bg-slate-50'
            ]">
              <!-- icono -->
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
            </button>
          </div>

          <!-- Fila 2: link -->
          <div v-if="auth.isAuthenticated">
            <button class="text-xs text-slate-500 hover:text-indigo-600 underline"
              @click="router.push('/mis-reservas')">
              Ver mis reservas →
            </button>
          </div>

        </div>

        <!-- <SButton v-if="isAdmin || isBibliotecario" @click="abrirCrear" variant="primary">
          <svg class="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          Nuevo libro
        </SButton> -->

      </div>
    </div>
    <!-- Banner reserva pendiente post-login -->
    <div v-if="auth.isAuthenticated && reservasStore.tienePendiente"
      class="mt-6 bg-indigo-50 border border-indigo-200 rounded-xl px-5 py-4 flex items-start gap-3">
      <!-- Icono -->
      <svg class="w-5 h-5 text-indigo-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
          d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>

      <!-- Texto -->
      <div class="flex-1">
        <p class="text-indigo-900 font-medium text-sm">
          Tienes una reserva pendiente
        </p>
        <p class="text-indigo-700 text-xs mt-0.5">
          "{{ reservasStore.reservaPendiente?.libroTitulo }}" — Selecciona la biblioteca y confirma.
        </p>
      </div>

      <!-- Acción -->
      <button class="ml-auto text-xs font-medium text-indigo-600 hover:text-indigo-800 transition" @click="mostrarModal = true; libroSeleccionado = {
        idLibro: reservasStore.reservaPendiente!.libroId,
        titulo: reservasStore.reservaPendiente!.libroTitulo,
        autor: reservasStore.reservaPendiente!.libroAutor,
        isbn: '',
        portadaUrl: reservasStore.reservaPendiente?.portadaUrl
      }">
        Confirmar →
      </button>
    </div>

    <!-- Filtros -->
    <SCard class="mb-6" padding="md">
      <div class="flex flex-col sm:flex-row gap-3">
        <!-- <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"> -->
        <SInput v-model="busqueda" placeholder="Buscar por Título, Autor..." icon-left="search" clearable
          class="flex-1" />
        <!-- Año -->
        <SInput v-model="anioFiltro" type="number" placeholder="Año" />
        <!-- Autor -->
        <!-- <SInput v-model="autorFiltro" placeholder="Autor" clearable /> -->
        <SSelect v-model="categoriaFiltro" :options="opcionesCategorias" class="sm:w-64" />
        <!-- Botón reset -->
        <SButton variant="secondary" @click="resetFiltros" title="Restablecer filtros">
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-3-6.7M21 3v6h-6" />
          </svg>
        </SButton>
      </div>
    </SCard>

    <!-- Cargando -->
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
      <SButton variant="ghost" size="sm" class="mt-3" @click="ejecutarBusqueda">Reintentar</SButton>
    </div>

    <!-- Sin resultados -->
    <SEmptyState v-else-if="!libros.length" title="Sin resultados"
      description="No hay libros que coincidan con tu búsqueda." icon="search">
      <template #action>
        <SButton variant="ghost" size="sm" @click="busqueda = ''; categoriaFiltro = ''">Limpiar filtros</SButton>
      </template>
    </SEmptyState>

    <!-- Libros -->
    <div v-else>
      <div :class="vistaActual === 'grid'
        ? 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4'
        : 'flex flex-col gap-3'">
        <!-- <LibroCard v-for="libro in libros" :key="libro.idLibro" :libro="libro" :vista="vistaActual"
          :puede-editar="isAdmin || isBibliotecario" @ver="abrirDetalle" @editar="abrirEditar"
          @eliminar="abrirConfirmEliminar" /> -->
        <LibroReservaCard v-for="libro in libros" :key="libro.idLibro" :libro="libro" :vista="vistaActual"
          :ya-reservado="libroIdsReservados.has(libro.idLibro)" @reservar="iniciarReserva" @ver="abrirDetalle" />

      </div>

      <!-- Paginación -->
      <div v-if="totalPaginas > 1" class="flex items-center justify-center gap-2 mt-8">
        <SButton variant="ghost" size="sm" :disabled="pagina === 1" @click="cambiarPagina(pagina - 1)">Anterior
        </SButton>
        <span class="text-sm text-slate-600">Página {{ pagina }} de {{ totalPaginas }}</span>
        <SButton variant="ghost" size="sm" :disabled="pagina === totalPaginas" @click="cambiarPagina(pagina + 1)">
          Siguiente
        </SButton>
      </div>
    </div>

    <!-- Modales -->
    <LibroFormModal v-if="mostrarFormModal" :key="mostrarFormModal ? 'open' : 'closed'" :libro="libroParaEditar"
      :categorias="categorias" @close="cerrarFormModal" @saved="onLibroGuardado" />

    <LibroDetalleModal v-if="mostrarDetalleModal && libroSeleccionado" :libro="libroSeleccionado"
      @close="mostrarDetalleModal = false" @editar="onDetalleEditar" />

    <ConfirmModal v-model="mostrarConfirmEliminar" title="¿Eliminar libro?" variant="danger"
      confirm-label="Sí, eliminar" :loading="eliminando" @confirm="confirmarEliminacionLibro">
      Se eliminará permanentemente el libro

      <span class="font-semibold text-slate-800">
        "{{ libroParaEliminar?.titulo }}"
      </span>

      <span class="text-xs text-slate-400 mt-2 block">
        Esta acción no se puede deshacer.
      </span>
    </ConfirmModal>

    <!-- ─── Modal de confirmación ────────────────────────────────────────── -->
    <ReservaModalConfirm v-if="mostrarModal && libroSeleccionado" :libro="libroSeleccionado" @close="onModalClose"
      @confirmada="onReservaConfirmada" />
  </div>
</template>