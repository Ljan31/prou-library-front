<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import SButton from '@/components/ui/SButton.vue'
import SCard from '@/components/ui/SCard.vue'
import SInput from '@/components/ui/SInput.vue'
import SBadge from '@/components/ui/SBadge.vue'
import SSkeleton from '@/components/feedback/SSkeleton.vue'
import SSpinner from '@/components/feedback/SSpinner.vue'
import SEmptyState from '@/components/feedback/SEmptyState.vue'
import ConfirmModal from '@/components/bibliotecas/DeleteConfirmModal.vue'
import { usePermissions } from '@/composables/usePermissions'
import { useUiStore } from '@/stores/ui.store'
import {
  CategoriaApiError,
  eliminarCategoria,
  listarCategorias,
  obtenerCategoriaDetalle,
  obtenerDistribucionDewey,
  obtenerEstadisticasCategorias,
  type CategoriaConConteo,
  type CategoriaDetalle,
  type DistribucionDewey,
  type EstadisticasCategorias,
} from '@/services/categorias.service'
import CategoriaFormModal from './CategoriaFormModal.vue'

const ui = useUiStore()
const { can, isAdmin } = usePermissions()

const puedeEscribir = computed(() =>
  can('ROLE_ADMIN', 'ROLE_BIBLIOTECARIO', 'ROLE_AUXILIAR' as any)
)

// El servicio siempre lanza CategoriaApiError (message del backend + status)
const msgDe = (e: unknown, fb: string) => (e instanceof Error && e.message ? e.message : fb)

/* ── Carga de lista ── */
const categorias = ref<CategoriaConConteo[]>([])
const cargando = ref(false)
const error = ref<string | null>(null)

async function cargar() {
  cargando.value = true
  error.value = null
  try {
    categorias.value = await listarCategorias()
  } catch (e) {
    error.value = msgDe(e, 'No se pudieron cargar las categorías')
  } finally {
    cargando.value = false
  }
}

/* ── Estadísticas + Dewey (secundarias: si fallan, no bloquean la lista) ── */
const stats = ref<EstadisticasCategorias | null>(null)
const dewey = ref<DistribucionDewey | null>(null)
const cargandoStats = ref(false)
const deweyAbierto = ref(false)

async function cargarStats() {
  cargandoStats.value = true
  const [s, d] = await Promise.allSettled([
    obtenerEstadisticasCategorias(),
    obtenerDistribucionDewey(),
  ])
  stats.value = s.status === 'fulfilled' ? s.value : null
  dewey.value = d.status === 'fulfilled' ? d.value : null
  cargandoStats.value = false
}

onMounted(() => {
  cargar()
  cargarStats()
})

const deweyEntradas = computed(() => Object.entries(dewey.value ?? {}))
const deweyMax = computed(() => Math.max(1, ...deweyEntradas.value.map(([, n]) => n)))

/* ── Búsqueda en cliente ── */
const busqueda = ref('')
const normalizar = (s: string | null | undefined) =>
  (s ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim()

const filtradas = computed(() => {
  const q = normalizar(busqueda.value)
  if (!q) return categorias.value
  return categorias.value.filter(
    (c) =>
      normalizar(c.nombre_categoria).includes(q) ||
      normalizar(c.codigo_dewey).includes(q) ||
      normalizar(c.descripcion).includes(q)
  )
})

/* ── Paginación ── */
const pagina = ref(1)
const porPagina = 10
const totalPaginas = computed(() => Math.max(1, Math.ceil(filtradas.value.length / porPagina)))
const paginaItems = computed(() =>
  filtradas.value.slice((pagina.value - 1) * porPagina, pagina.value * porPagina)
)
watch(busqueda, () => (pagina.value = 1))
watch(totalPaginas, (n) => { if (pagina.value > n) pagina.value = n })

/* ── Formulario crear / editar ── */

const formAbierto = ref(false)
const editando = ref<CategoriaConConteo | null>(null)

function abrirCrear() { editando.value = null; formAbierto.value = true }
function abrirEditar(c: CategoriaConConteo) { editando.value = c; formAbierto.value = true }

function onGuardado(c: CategoriaConConteo, modo: 'crear' | 'editar') {
  if (modo === 'crear') {
    categorias.value.push(c)
    categorias.value.sort((a, b) => a.nombre_categoria.localeCompare(b.nombre_categoria, 'es'))
  } else {
    const i = categorias.value.findIndex((x) => x.id_categoria === c.id_categoria)
    if (i !== -1) categorias.value[i] = c
  }
  cargarStats() // cambia total, "sin libros" y distribución Dewey
}


/* ── Detalle ── */
const detalleAbierto = ref(false)
const detalle = ref<CategoriaDetalle | null>(null)
const cargandoDetalle = ref(false)
const errorDetalle = ref<string | null>(null)
const detalleRef = ref<HTMLElement | null>(null)
let detalleReq = 0

async function abrirDetalle(c: CategoriaConConteo) {
  const req = ++detalleReq
  detalle.value = null
  errorDetalle.value = null
  detalleAbierto.value = true
  cargandoDetalle.value = true
  await nextTick()
  detalleRef.value?.focus()
  try {
    const d = await obtenerCategoriaDetalle(c.id_categoria)
    if (req === detalleReq) detalle.value = d
  } catch (e) {
    if (req === detalleReq) errorDetalle.value = msgDe(e, 'No se pudo cargar el detalle')
  } finally {
    if (req === detalleReq) cargandoDetalle.value = false
  }
}

/* ── Eliminar (solo ADMIN) ── */
const aEliminar = ref<CategoriaConConteo | null>(null)
const eliminando = ref(false)

async function confirmarEliminar() {
  if (!aEliminar.value) return
  const { id_categoria, nombre_categoria } = aEliminar.value
  eliminando.value = true
  try {
    await eliminarCategoria(id_categoria)
    categorias.value = categorias.value.filter((c) => c.id_categoria !== id_categoria)
    ui.toast.success('Categoría eliminada', `«${nombre_categoria}» fue eliminada`)
    cargarStats()
  } catch (e) {
    // Ej: "No se puede eliminar la categoría porque tiene N libro(s) asociado(s)"
    ui.toast.error('No se pudo eliminar', msgDe(e, 'Error al eliminar la categoría'))
  } finally {
    aEliminar.value = null
    eliminando.value = false
  }
}
</script>
<template>
  <div>
    <!-- Resumen + acción -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
      <p class="text-sm text-slate-500">
        <span class="font-semibold text-slate-800">{{ categorias.length }}</span>
        categoría{{ categorias.length !== 1 ? 's' : '' }} registrada{{ categorias.length !== 1 ? 's' : '' }}
      </p>
      <SButton v-if="puedeEscribir" variant="primary" @click="abrirCrear">
        <svg class="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
        </svg>
        Nueva categoría
      </SButton>
    </div>

    <!-- Estadísticas -->
    <div class="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
      <SCard padding="md">
        <p class="text-xs text-slate-500 mb-1">Total categorías</p>
        <SSkeleton v-if="cargandoStats && !stats" width="48px" height="2rem" />
        <p v-else class="text-2xl font-semibold text-slate-900">{{ stats?.totalCategorias ?? categorias.length }}</p>
      </SCard>
      <SCard padding="md">
        <p class="text-xs text-slate-500 mb-1">Sin libros</p>
        <SSkeleton v-if="cargandoStats && !stats" width="48px" height="2rem" />
        <p v-else class="text-2xl font-semibold text-amber-600">{{ stats?.categoriasSinLibros ?? '—' }}</p>
      </SCard>
      <SCard padding="md" class="col-span-2 sm:col-span-1">
        <p class="text-xs text-slate-500 mb-1">Clasificación Dewey</p>
        <button
          class="text-sm font-medium text-indigo-600 hover:text-indigo-700 disabled:text-slate-400 disabled:cursor-not-allowed"
          :disabled="!deweyEntradas.length"
          :aria-expanded="deweyAbierto"
          aria-controls="dewey-panel"
          @click="deweyAbierto = !deweyAbierto"
        >
          {{ deweyAbierto ? 'Ocultar distribución' : 'Ver distribución' }}
        </button>
      </SCard>
    </div>

    <!-- Distribución Dewey (barras CSS, sin librería de gráficos) -->
    <SCard v-if="deweyAbierto && deweyEntradas.length" id="dewey-panel" class="mb-5" padding="md">
      <h3 class="text-sm font-semibold text-slate-800 mb-3">Categorías por rango Dewey</h3>
      <ul class="space-y-2">
        <li v-for="[rango, n] in deweyEntradas" :key="rango" class="flex items-center gap-3 text-xs">
          <span class="w-48 sm:w-56 flex-shrink-0 text-slate-600 truncate" :title="rango">{{ rango }}</span>
          <div class="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              class="h-full rounded-full bg-indigo-500 transition-all duration-300"
              :style="{ width: `${(n / deweyMax) * 100}%` }"
            />
          </div>
          <span class="w-6 text-right font-medium text-slate-700 tabular-nums">{{ n }}</span>
        </li>
      </ul>
    </SCard>

    <!-- Búsqueda -->
    <SCard class="mb-5" padding="md">
      <SInput v-model="busqueda" placeholder="Buscar por nombre, código Dewey o descripción..." clearable />
    </SCard>

    <!-- Cargando -->
    <div v-if="cargando" class="space-y-2" aria-busy="true">
      <SSkeleton v-for="i in 6" :key="i" width="100%" height="56px" />
    </div>

    <!-- Error -->
    <div v-else-if="error" class="text-center py-10">
      <p class="text-sm text-red-500">{{ error }}</p>
      <SButton variant="ghost" size="sm" class="mt-3" @click="cargar">Reintentar</SButton>
    </div>

    <!-- Vacío -->
    <SEmptyState
      v-else-if="!filtradas.length"
      :title="busqueda ? 'Sin resultados' : 'Aún no hay categorías'"
      :description="busqueda
        ? 'No se encontraron categorías con ese criterio.'
        : 'Crea la primera categoría para clasificar los libros.'"
      icon="search"
    >
      <template #action>
        <SButton v-if="busqueda" variant="ghost" size="sm" @click="busqueda = ''">Limpiar búsqueda</SButton>
        <SButton v-else-if="puedeEscribir" variant="primary" size="sm" @click="abrirCrear">Nueva categoría</SButton>
      </template>
    </SEmptyState>

    <!-- Tabla -->
    <template v-else>
      <div class="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full min-w-[720px] text-sm">
            <thead class="bg-slate-50 border-b border-slate-200">
              <tr class="text-left">
                <th class="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Categoría</th>
                <th class="w-[110px] px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Dewey</th>
                <th class="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Descripción</th>
                <th class="w-[90px] px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-wider text-slate-500">Libros</th>
                <th class="w-[140px] px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-500">Acciones</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr
                v-for="c in paginaItems"
                :key="c.id_categoria"
                class="group hover:bg-slate-50/80 transition-colors cursor-pointer"
                @click="abrirDetalle(c)"
              >
                <td class="px-4 py-3">
                  <span class="font-medium text-slate-800">{{ c.nombre_categoria }}</span>
                </td>
                <td class="px-4 py-3">
                  <span v-if="c.codigo_dewey" class="font-mono text-xs font-semibold text-indigo-600">{{ c.codigo_dewey }}</span>
                  <span v-else class="text-xs text-slate-300">Sin clasificar</span>
                </td>
                <td class="px-4 py-3 max-w-[320px]">
                  <p v-if="c.descripcion" class="text-xs text-slate-500 line-clamp-2" :title="c.descripcion">{{ c.descripcion }}</p>
                  <span v-else class="text-xs text-slate-300">—</span>
                </td>
                <td class="px-4 py-3 text-center">
                  <SBadge :variant="c.librosCount > 0 ? 'primary' : 'default'">{{ c.librosCount }}</SBadge>
                </td>
                <td class="px-4 py-3" @click.stop>
                  <div class="flex items-center justify-end gap-1">
                    <button
                      class="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                      title="Ver detalle" :aria-label="`Ver detalle de ${c.nombre_categoria}`" @click="abrirDetalle(c)"
                    >
                      <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                          d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    </button>
                    <button
                      v-if="puedeEscribir"
                      class="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                      title="Editar categoría" :aria-label="`Editar ${c.nombre_categoria}`" @click="abrirEditar(c)"
                    >
                      <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <!-- Deshabilitado si tiene libros: el backend lo rechazaría igual -->
                    <button
                      v-if="isAdmin"
                      class="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-slate-400"
                      :disabled="c.librosCount > 0"
                      :title="c.librosCount > 0 ? `No se puede eliminar: tiene ${c.librosCount} libro(s) asociado(s)` : 'Eliminar categoría'"
                      :aria-label="`Eliminar ${c.nombre_categoria}`"
                      @click="aEliminar = c"
                    >
                      <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
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

      <!-- Paginación -->
      <div v-if="totalPaginas > 1" class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-4">
        <p class="text-xs text-slate-500">
          Mostrando
          <span class="font-medium text-slate-700">{{ (pagina - 1) * porPagina + 1 }}</span>–<span class="font-medium text-slate-700">{{ Math.min(pagina * porPagina, filtradas.length) }}</span>
          de <span class="font-medium text-slate-700">{{ filtradas.length }}</span> categorías
        </p>
        <div class="flex items-center gap-1">
          <button
            class="p-2 rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            :disabled="pagina === 1" title="Página anterior" aria-label="Página anterior" @click="pagina--"
          >
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <template v-for="p in totalPaginas" :key="p">
            <button
              v-if="Math.abs(p - pagina) <= 2 || p === 1 || p === totalPaginas"
              :class="['min-w-8 h-8 px-2 rounded-lg text-sm font-medium transition-colors',
                p === pagina ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50']"
              :aria-current="p === pagina ? 'page' : undefined" @click="pagina = p"
            >{{ p }}</button>
            <span v-else-if="Math.abs(p - pagina) === 3" class="text-slate-400 text-sm px-1">…</span>
          </template>
          <button
            class="p-2 rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            :disabled="pagina === totalPaginas" title="Página siguiente" aria-label="Página siguiente" @click="pagina++"
          >
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    </template>

    <!-- Modal crear / editar -->
    <CategoriaFormModal v-model="formAbierto" :categoria="editando" @saved="onGuardado" />

    <!-- Modal detalle -->
    <Teleport to="body">
      <div
        v-if="detalleAbierto"
        class="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
        @click.self="detalleAbierto = false" @keydown.esc="detalleAbierto = false"
      >
        <div
          ref="detalleRef" tabindex="-1" role="dialog" aria-modal="true" aria-labelledby="cat-detalle-title"
          class="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto focus:outline-none"
        >
          <div v-if="cargandoDetalle" class="flex justify-center py-10" aria-busy="true"><SSpinner /></div>

          <div v-else-if="errorDetalle" class="text-center py-8">
            <p class="text-sm text-red-500">{{ errorDetalle }}</p>
          </div>

          <template v-else-if="detalle">
            <div class="flex items-start justify-between gap-3 mb-1">
              <h2 id="cat-detalle-title" class="text-lg font-semibold text-slate-900">{{ detalle.nombre_categoria }}</h2>
              <SBadge v-if="detalle.codigo_dewey" variant="primary">Dewey {{ detalle.codigo_dewey }}</SBadge>
            </div>
            <p class="text-sm text-slate-500 mb-4">{{ detalle.descripcion || 'Sin descripción.' }}</p>

            <h3 class="text-sm font-semibold text-slate-800 mb-2">
              Libros recientes
              <span class="font-normal text-slate-400">({{ detalle.librosRecientes.length }} de {{ detalle.librosCount }})</span>
            </h3>
            <ul v-if="detalle.librosRecientes.length" class="divide-y divide-slate-100 border border-slate-200 rounded-lg">
              <li v-for="l in detalle.librosRecientes" :key="l.idLibro" class="px-3 py-2 text-sm text-slate-700">
                {{ l.titulo }}
              </li>
            </ul>
            <p v-else class="text-sm text-slate-400">Esta categoría aún no tiene libros asociados.</p>
          </template>

          <div class="flex justify-end mt-6">
            <SButton variant="secondary" @click="detalleAbierto = false">Cerrar</SButton>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Confirmar eliminar -->
    <ConfirmModal
      :model-value="!!aEliminar"
      :loading="eliminando"
      title="¿Eliminar categoría?"
      :message="`¿Eliminar la categoría «${aEliminar?.nombre_categoria}»? Esta acción no se puede deshacer.`"
      @update:model-value="(v: boolean) => { if (!v) aEliminar = null }"
      @confirm="confirmarEliminar"
    />
  </div>
</template>