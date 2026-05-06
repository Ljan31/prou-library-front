<script setup lang="ts">

import { ref, computed, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store'
import { useReservasStore } from '@/stores/reservas.store'
import SInput from '@/components/ui/SInput.vue'
import SSelect from '@/components/ui/SSelect.vue'
import SButton from '@/components/ui/SButton.vue'
import SCard from '@/components/ui/SCard.vue'
import SSkeleton from '@/components/feedback/SSkeleton.vue'
import SEmptyState from '@/components/feedback/SEmptyState.vue'
import LibroReservaCard from '@/components/reservas/LibroReservaCard.vue'
import ReservaModalConfirm from '@/components/reservas/ReservaModalConfirm.vue'
import type { Libro, Categoria } from '@/types/catalogo'
import type { LibroPublico, BibliotecaPublica } from '@/types/reservas'
import { buscarLibros } from '@/services/libros.service'
import { obtenerCategorias } from '@/services/categorias.service'

const router = useRouter()
const auth = useAuthStore()
const reservasStore = useReservasStore()

// ─── Estado UI ────────────────────────────────────────────────────────────
const cargando = ref(false)
const error = ref<string | null>(null)
const libros = ref<LibroPublico[]>([])
const totalLibros = ref(0)
const totalPaginas = ref(1)
const pagina = ref(1)
const POR_PAGINA = 12

// Filtros
const busqueda = ref('')
const categoriaFiltro = ref('')
const anioFiltro = ref<number | null>(null)

// Datos auxiliares
const categorias = ref<Categoria[]>([])
const biblioteca = ref<BibliotecaPublica>()

// Modal de confirmación de reserva
const mostrarModal = ref(false)
const libroSeleccionado = ref<LibroPublico | null>(null)


const opcionesCategorias = computed(() => [
  { value: '', label: 'Todas las categorías' },
  ...categorias.value.map(c => ({
    value: String(c.id_categoria),      // ← idCategoria (nuevo campo)
    label: c.nombre_categoria           // ← nombreCategoria (nuevo campo)
  }))
])


// ─── Carga inicial ────────────────────────────────────────────────────────
onMounted(async () => {
  await Promise.all([cargarCatalogo(), cargarCategorias()])

  // Si el usuario acaba de iniciar sesión y tiene una reserva pendiente,
  // abrir automáticamente el modal de confirmación
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
async function cargarCatalogo() {
  cargando.value = true
  error.value = null
  try {
    const resultado = await buscarLibros({
      titulo: busqueda.value,
      categoriaId: categoriaFiltro.value ? Number(categoriaFiltro.value) : undefined,
      autor: busqueda.value || undefined,
      anoPublicacion: anioFiltro.value ?? undefined,
      pagina: pagina.value,
      size: POR_PAGINA,
    })
    libros.value = resultado.libros
    totalPaginas.value = resultado.totalPaginas
    totalLibros.value = resultado.totalLibros
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'Error al cargar el catálogo'
    libros.value = []
  } finally {
    cargando.value = false
  }
}

async function cargarCategorias() {
  try {
    categorias.value = await obtenerCategorias()
  }
  catch { categorias.value = [] }
}
// Debounce en búsqueda
let debounce: ReturnType<typeof setTimeout>
watch([busqueda, categoriaFiltro, anioFiltro], () => {
  pagina.value = 1
  clearTimeout(debounce)
  debounce = setTimeout(cargarCatalogo, 400)
})

function cambiarPagina(nueva: number) {
  pagina.value = nueva
  cargarCatalogo()
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

// ─── Flujo de reserva ─────────────────────────────────────────────────────
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
    // router.push({ name: 'login', query: { redirect: '/catalogo-reservas' } })
    router.push({ name: 'login', query: { redirect: '/catalogo' } })
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

// Libros con reserva activa del usuario (para badge)
const libroIdsReservados = computed(() =>
  auth.isAuthenticated ? reservasStore.libroIdsConReservaActiva : new Set<number>()
)
function resetFiltros() {
  busqueda.value = ''
  categoriaFiltro.value = ''
  anioFiltro.value = null
  pagina.value = 1
  cargarCatalogo()
}
</script>

<template>
  <div class="min-h-screen bg-slate-50">
    <!-- ─── Hero Header ─────────────────────────────────────────────────── -->
    <div class="bg-linear-to-br from-indigo-700 to-indigo-900 text-white">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p class="text-indigo-300 text-sm font-medium tracking-wide uppercase mb-1">
              Facultad de Humanidades y Ciencias de la Educación — UMSA
            </p>
            <h1 class="text-3xl sm:text-4xl font-bold">Catálogo de Reservas</h1>
            <p class="text-indigo-200 mt-2">
              Explora el fondo bibliográfico y reserva el libro que necesitas.
            </p>
          </div>

          <!-- Acceso rápido si no está autenticado -->
          <div v-if="!auth.isAuthenticated" class="flex gap-3 shrink-0">
            <SButton variant="secondary" size="sm" @click="router.push('/login')">
              Iniciar sesión
            </SButton>
            <SButton variant="primary" size="sm" @click="router.push('/register')">
              Registrarse
            </SButton>
          </div>

          <!-- Info si está autenticado -->
          <div v-else class="text-right shrink-0">
            <p class="text-indigo-200 text-sm">Bienvenido,</p>
            <p class="font-semibold">{{ auth.displayName }}</p>
            <button class="text-xs text-indigo-300 hover:text-white mt-1 underline"
              @click="router.push('/mis-reservas')">
              Ver mis reservas →
            </button>
          </div>
        </div>

        <!-- Banner reserva pendiente post-login -->
        <div v-if="auth.isAuthenticated && reservasStore.tienePendiente"
          class="mt-6 bg-amber-500/20 border border-amber-400/40 rounded-xl px-5 py-4 flex items-start gap-3">
          <svg class="w-5 h-5 text-amber-300 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p class="text-amber-100 font-medium text-sm">Tienes una reserva pendiente de confirmar</p>
            <p class="text-amber-200 text-xs mt-0.5">
              "{{ reservasStore.reservaPendiente?.libroTitulo }}" — Selecciona la biblioteca y confirma.
            </p>
          </div>
          <button class="ml-auto text-amber-300 hover:text-white text-xs underline shrink-0" @click="mostrarModal = true; libroSeleccionado = {
            idLibro: reservasStore.reservaPendiente!.libroId,
            titulo: reservasStore.reservaPendiente!.libroTitulo,
            autor: reservasStore.reservaPendiente!.libroAutor,
            isbn: '',
            portadaUrl: reservasStore.reservaPendiente?.portadaUrl
          }">
            Confirmar ahora
          </button>
        </div>
      </div>
    </div>

    <!-- ─── Filtros ──────────────────────────────────────────────────────── -->
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <SCard class="-mt-6 mb-8 shadow-lg" padding="md">
        <div class="flex flex-col sm:flex-row gap-3">
          <SInput v-model="busqueda" placeholder="Buscar por título, autor, ISBN..." icon-left="search" clearable
            class="flex-1" />
          <SInput v-model="anioFiltro" type="number" placeholder="Año" />
          <SSelect v-model="categoriaFiltro" :options="opcionesCategorias" class="sm:w-64" />
          <SButton variant="secondary" @click="resetFiltros" title="Restablecer filtros">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M21 12a9 9 0 11-3-6.7M21 3v6h-6" />
            </svg>
          </SButton>
        </div>
        <div class="mt-2 text-xs text-slate-400">
          {{ totalLibros }} libro{{ totalLibros !== 1 ? 's' : '' }}
          encontrado{{ totalLibros !== 1 ? 's' : '' }}
        </div>
      </SCard>

      <!-- ─── Estados ───────────────────────────────────────────────────── -->

      <!-- Cargando -->
      <div v-if="cargando" class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mb-12">
        <SSkeleton v-for="i in 8" :key="i" width="100%" height="300px" />
      </div>

      <!-- Error -->
      <div v-else-if="error" class="text-center py-16">
        <p class="text-red-500 text-sm">{{ error }}</p>
        <SButton variant="ghost" size="sm" class="mt-3" @click="cargarCatalogo">
          Reintentar
        </SButton>
      </div>

      <!-- Sin resultados -->
      <SEmptyState v-else-if="!libros.length" title="Sin resultados"
        description="No hay libros que coincidan con tu búsqueda." icon="search" class="mb-12">
        <template #action>
          <SButton variant="ghost" size="sm" @click="busqueda = ''; categoriaFiltro = ''">
            Limpiar filtros
          </SButton>
        </template>
      </SEmptyState>

      <!-- Grilla de libros -->
      <div v-else>
        <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
          <LibroReservaCard v-for="libro in libros" :key="libro.idLibro" :libro="libro"
            :ya-reservado="libroIdsReservados.has(libro.idLibro)" @reservar="iniciarReserva" />
        </div>

        <!-- Paginación -->
        <div v-if="totalPaginas > 1" class="flex items-center justify-center gap-2 pb-12">
          <SButton variant="ghost" size="sm" :disabled="pagina === 1" @click="cambiarPagina(pagina - 1)">
            ← Anterior
          </SButton>
          <span class="text-sm text-slate-600 px-3">
            Página {{ pagina }} de {{ totalPaginas }}
          </span>
          <SButton variant="ghost" size="sm" :disabled="pagina === totalPaginas" @click="cambiarPagina(pagina + 1)">
            Siguiente →
          </SButton>
        </div>
      </div>
    </div>

    <!-- ─── Modal de confirmación ────────────────────────────────────────── -->
    <ReservaModalConfirm v-if="mostrarModal && libroSeleccionado" :libro="libroSeleccionado" @close="onModalClose"
      @confirmada="onReservaConfirmada" />
  </div>
</template>