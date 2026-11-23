<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import SButton from '@/components/ui/SButton.vue'
import SCard from '@/components/ui/SCard.vue'
import SInput from '@/components/ui/SInput.vue'
import SSkeleton from '@/components/feedback/SSkeleton.vue'
import SEmptyState from '@/components/feedback/SEmptyState.vue'
import ConfirmModal from '@/components/bibliotecas/DeleteConfirmModal.vue'
import { usePermissions } from '@/composables/usePermissions'
import { useUiStore } from '@/stores/ui.store'
import { autoresService, getErrorMessage, type Autor } from '@/services/autores.service'
import AutorFormModal from './AutorFormModal.vue'

const ui = useUiStore()
const { can, isAdmin } = usePermissions()

// Crear/editar: ADMIN, BIBLIOTECARIO, AUXILIAR · Eliminar: solo ADMIN
const puedeEscribir = computed(() =>
  can('ROLE_ADMIN', 'ROLE_BIBLIOTECARIO', 'ROLE_AUXILIAR' as any)
)

/* ── Carga ── */
const autores = ref<Autor[]>([])
const cargando = ref(false)
const error = ref<string | null>(null)

async function cargar() {
  cargando.value = true
  error.value = null
  try {
    autores.value = await autoresService.listar()
  } catch (e) {
    error.value = getErrorMessage(e, 'No se pudieron cargar los autores')
  } finally {
    cargando.value = false
  }
}
onMounted(cargar)

/* ── Búsqueda (cliente, sin tildes ni mayúsculas) ── */
const busqueda = ref('')
const normalizar = (s: string) =>
  s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim()

const filtrados = computed(() => {
  const q = normalizar(busqueda.value)
  return [...autores.value]
    .filter((a) => !q || normalizar(a.nombre).includes(q))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
})

/* ── Paginación (el backend devuelve todo sin paginar) ── */
const pagina = ref(1)
const porPagina = 10
const totalPaginas = computed(() => Math.max(1, Math.ceil(filtrados.value.length / porPagina)))
const paginaItems = computed(() =>
  filtrados.value.slice((pagina.value - 1) * porPagina, pagina.value * porPagina)
)
watch(busqueda, () => (pagina.value = 1))
watch(totalPaginas, (n) => { if (pagina.value > n) pagina.value = n })

/* ── Modal crear / editar ── */
const formAbierto = ref(false)
const editando = ref<Autor | null>(null)

function abrirCrear() { editando.value = null; formAbierto.value = true }
function abrirEditar(a: Autor) { editando.value = a; formAbierto.value = true }

function onGuardado(a: Autor, modo: 'crear' | 'editar') {
  if (modo === 'crear') autores.value.push(a)
  else {
    const i = autores.value.findIndex((x) => x.idAutor === a.idAutor)
    if (i !== -1) autores.value[i] = a
  }
}
/* ── Eliminar (solo ADMIN) ── */
const aEliminar = ref<Autor | null>(null)
const eliminando = ref(false)

async function confirmarEliminar() {
  if (!aEliminar.value) return
  eliminando.value = true
  try {
    const res = await autoresService.eliminar(aEliminar.value.idAutor)
    autores.value = autores.value.filter((a) => a.idAutor !== aEliminar.value!.idAutor)
    ui.toast.success('Autor eliminado', res.message)
    aEliminar.value = null
  } catch (e) {
    ui.toast.error('No se pudo eliminar', getErrorMessage(e))
    aEliminar.value = null
  } finally {
    eliminando.value = false
  }
}
</script>

<template>
  <div>
    <!-- Resumen + acción -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
      <p class="text-sm text-slate-500">
        <span class="font-semibold text-slate-800">{{ autores.length }}</span>
        autor{{ autores.length !== 1 ? 'es' : '' }} registrado{{ autores.length !== 1 ? 's' : '' }}
      </p>
      <SButton v-if="puedeEscribir" variant="primary" @click="abrirCrear">
        <svg class="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
        </svg>
        Nuevo autor
      </SButton>
    </div>

    <!-- Búsqueda -->
    <SCard class="mb-5" padding="md">
      <SInput v-model="busqueda" placeholder="Buscar autor por nombre..." clearable />
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
      v-else-if="!filtrados.length"
      :title="busqueda ? 'Sin resultados' : 'Aún no hay autores'"
      :description="busqueda
        ? 'No se encontraron autores con ese nombre.'
        : 'Registra el primer autor para asociarlo a los libros.'"
      icon="search"
    >
      <template #action>
        <SButton v-if="busqueda" variant="ghost" size="sm" @click="busqueda = ''">Limpiar búsqueda</SButton>
        <SButton v-else-if="puedeEscribir" variant="primary" size="sm" @click="abrirCrear">Nuevo autor</SButton>
      </template>
    </SEmptyState>

    <!-- Tabla -->
    <template v-else>
      <div class="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full min-w-[480px] text-sm">
            <thead class="bg-slate-50 border-b border-slate-200">
              <tr class="text-left">
                <th class="w-[90px] px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">ID</th>
                <th class="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Nombre</th>
                <th v-if="puedeEscribir" class="w-[120px] px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr v-for="a in paginaItems" :key="a.idAutor" class="group hover:bg-slate-50/80 transition-colors">
                <td class="px-4 py-3 font-mono text-xs text-slate-400">#{{ a.idAutor }}</td>
                <td class="px-4 py-3">
                  <div class="flex items-center gap-3 min-w-0">
                    <div class="w-8 h-8 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-semibold flex-shrink-0">
                      {{ a.nombre.charAt(0).toUpperCase() }}
                    </div>
                    <span class="font-medium text-slate-800 truncate" :title="a.nombre">{{ a.nombre }}</span>
                  </div>
                </td>
                <td v-if="puedeEscribir" class="px-4 py-3">
                  <div class="flex items-center justify-end gap-1">
                    <button
                      class="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                      title="Editar autor" :aria-label="`Editar ${a.nombre}`" @click="abrirEditar(a)"
                    >
                      <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      v-if="isAdmin"
                      class="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Eliminar autor" :aria-label="`Eliminar ${a.nombre}`" @click="aEliminar = a"
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
          <span class="font-medium text-slate-700">{{ (pagina - 1) * porPagina + 1 }}</span>–<span class="font-medium text-slate-700">{{ Math.min(pagina * porPagina, filtrados.length) }}</span>
          de <span class="font-medium text-slate-700">{{ filtrados.length }}</span> autores
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
   <AutorFormModal v-model="formAbierto" :autor="editando" @saved="onGuardado" />

    <!-- Confirmar eliminar -->
    <ConfirmModal
      :model-value="!!aEliminar"
      :loading="eliminando"
      title="¿Eliminar autor?"
      :message="`¿Eliminar al autor «${aEliminar?.nombre}»? Esta acción no se puede deshacer.`"
      @update:model-value="(v: boolean) => { if (!v) aEliminar = null }"
      @confirm="confirmarEliminar"
    />
  </div>
</template>