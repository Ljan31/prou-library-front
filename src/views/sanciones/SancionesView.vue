<script setup lang="ts">
import { computed, onMounted, ref, watch, type Ref } from 'vue'
import { useUiStore } from '@/stores/ui.store'
import { useSancionStore } from '@/stores/sancion.store'
import { useBibliotecaId } from '@/composables/useBibliotecaId'
import SCard from '@/components/ui/SCard.vue'
import SButton from '@/components/ui/SButton.vue'
import SEmptyState from '@/components/feedback/SEmptyState.vue'
import SSkeleton from '@/components/feedback/SSkeleton.vue'
import SBadge from '@/components/ui/SBadge.vue'
import SancionBadge from '@/components/sanciones/SancionBadge.vue'
import MetricCard from '@/components/sanciones/MetricCard.vue'
import SancionAcciones from '@/components/sanciones/SancionAcciones.vue'
import ModalPago from '@/components/sanciones/ModalPago.vue'
import ModalCondonar from '@/components/sanciones/ModalCondonar.vue'
import ModalSancionManual from '@/components/sanciones/ModalSancionManual.vue'
import ModalDetalleSancion from '@/components/sanciones/ModalDetalleSancion.vue'
import ModalReposicionFisica from '@/components/sanciones/ModalReposicionFisica.vue'
import ModalRegistrarPerdida from '@/components/sanciones/ModalRegistrarPerdida.vue'
import type { EstadoSancion, SancionResponse } from '@/types/notificacion.types'
import {
  esReposicion, estaPagada, formatFecha, formatMonto, montoSancion, reposicionPendiente, reposicionResuelta,
} from '@/utils/sancion.utils'

const ui = useUiStore()
const store = useSancionStore()
const bibliotecaId = useBibliotecaId()

const ESTADOS: { value: EstadoSancion; label: string }[] = [
  { value: 'ACTIVA', label: 'Activas' },
  { value: 'PAGADA', label: 'Pagadas' },
  { value: 'CONDONADA', label: 'Condonadas' },
]
const POR_PAGINA = 10

// ── Modales ──
const detalleAbierto = ref(false)
const pagoAbierto = ref(false)
const condonarAbierto = ref(false)
const fisicaAbierto = ref(false)
const perdidaAbierta = ref(false)
const manualAbierto = ref(false)
const sancionAccion = ref<SancionResponse | null>(null)

// ── Carga ──
onMounted(() => {
  ui.setBreadcrumbs([{ label: 'Sanciones' }])
  cargar()
})

async function cargar(estado: EstadoSancion = store.filtroEstado) {
  const id = bibliotecaId.value
  if (!id) return
  const tareas: Promise<unknown>[] = [store.cargarPorBiblioteca(id, estado)]
  // Las métricas siempre muestran las ACTIVAS, sin importar el filtro de la lista
  if (estado !== 'ACTIVA') tareas.push(store.cargarActivas(id))
  await Promise.all(tareas)
}

// ── Acciones ──
function abrirDetalle(s: SancionResponse) {
  detalleAbierto.value = true
  store.abrirDetalle(s)
}

/** Abre un modal de acción. Si venía del detalle, lo cierra para no apilar modales. */
function iniciarAccion(s: SancionResponse, modal: Ref<boolean>) {
  sancionAccion.value = s
  detalleAbierto.value = false
  modal.value = true
}
const abrirPago = (s: SancionResponse) => iniciarAccion(s, pagoAbierto)
const abrirCondonar = (s: SancionResponse) => iniciarAccion(s, condonarAbierto)
const abrirReposicionFisica = (s: SancionResponse) => iniciarAccion(s, fisicaAbierto)

// ── Métricas (siempre sobre las activas) ──
const metricas = computed(() => {
  const activas = store.activas
  const multas = activas.filter(s => !esReposicion(s) && !estaPagada(s)).reduce((acc, s) => acc + montoSancion(s), 0)
  const reposiciones = activas.filter(reposicionPendiente)
  const totalRepos = reposiciones.reduce((acc, s) => acc + montoSancion(s), 0)
  return [
    { clave: 'activas', label: 'Sanciones activas', value: activas.length, tone: 'red', icon: 'alert' },
    { clave: 'multas', label: 'Multas pendientes', value: formatMonto(multas), tone: 'amber', icon: 'money' },
    { clave: 'repos', label: 'Reposiciones pendientes', value: reposiciones.length, hint: formatMonto(totalRepos), tone: 'indigo', icon: 'book' },
    { clave: 'susp', label: 'Suspensiones vigentes', value: activas.filter(s => s.suspensionVigente).length, tone: 'red', icon: 'lock' },
  ] as const
})
const cargandoMetricas = computed(() => store.cargando || store.cargandoActivas)

// ── Búsqueda y paginación (en cliente) ──
const busqueda = ref('')
const pagina = ref(1)

const filtradas = computed(() => {
  const q = busqueda.value.trim().toLowerCase()
  if (!q) return store.sanciones
  return store.sanciones.filter(s =>
    [s.nombreUsuario, s.ciUsuario, s.tituloEjemplar ?? '', s.prestamoId ? String(s.prestamoId) : '']
      .some(c => c.toLowerCase().includes(q)),
  )
})
const totalPaginas = computed(() => Math.max(1, Math.ceil(filtradas.value.length / POR_PAGINA)))
const paginaActual = computed(() => Math.min(pagina.value, totalPaginas.value))
const desde = computed(() => (paginaActual.value - 1) * POR_PAGINA)
const visibles = computed(() => filtradas.value.slice(desde.value, desde.value + POR_PAGINA))

watch([busqueda, () => store.filtroEstado], () => (pagina.value = 1))

const etiquetaFiltro = computed(() => ESTADOS.find(e => e.value === store.filtroEstado)?.label.toLowerCase() ?? '')
const thClass = 'px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide'
</script>

<template>
  <div>
    <div class="page-container space-y-6">
      <!-- Encabezado -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 class="text-xl font-semibold text-slate-900">Sanciones</h1>
          <p class="text-sm text-slate-500 mt-0.5">Multas, suspensiones y reposiciones de ejemplares</p>
        </div>
        <div class="flex gap-2">
          <SButton variant="outline" @click="perdidaAbierta = true">Registrar pérdida</SButton>
          <SButton variant="danger" icon-left="plus" @click="manualAbierto = true">Nueva sanción</SButton>
        </div>
      </div>

      <!-- Métricas -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard v-for="m in metricas" :key="m.clave" :label="m.label" :value="m.value"
          :hint="'hint' in m ? m.hint : undefined" :tone="m.tone" :icon="m.icon" :loading="cargandoMetricas" />
      </div>

      <!-- Listado -->
      <SCard padding="none">
        <div class="flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3 border-b border-slate-100">
          <div class="flex bg-slate-100 rounded-lg p-1 gap-1 self-start" role="tablist" aria-label="Estado de la sanción">
            <button v-for="e in ESTADOS" :key="e.value" type="button" role="tab"
              :aria-selected="store.filtroEstado === e.value"
              class="px-3 py-1.5 text-sm font-medium rounded-md transition-all"
              :class="store.filtroEstado === e.value ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'"
              @click="cargar(e.value)">
              {{ e.label }}
            </button>
          </div>

          <input v-model="busqueda" type="search" placeholder="Buscar por usuario, CI, libro o #préstamo"
            aria-label="Buscar sanciones"
            class="sm:ml-auto w-full sm:w-72 px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400" />

          <SButton variant="ghost" size="sm" aria-label="Recargar" @click="cargar()">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
              <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
            </svg>
          </SButton>
        </div>

        <!-- Sin biblioteca -->
        <div v-if="!bibliotecaId" class="py-10">
          <SEmptyState title="Sin biblioteca asignada"
            description="Tu usuario no tiene una biblioteca asociada para consultar sanciones." icon="inbox" />
        </div>

        <!-- Cargando -->
        <div v-else-if="store.cargando" class="p-6 space-y-3">
          <SSkeleton v-for="i in 5" :key="i" width="100%" height="2.75rem" />
        </div>

        <!-- Error -->
        <div v-else-if="store.error" class="py-10 text-center space-y-3" role="alert">
          <p class="text-sm text-red-600">{{ store.error }}</p>
          <SButton variant="outline" size="sm" @click="cargar()">Reintentar</SButton>
        </div>

        <!-- Vacío -->
        <div v-else-if="!filtradas.length" class="py-10">
          <SEmptyState :title="busqueda ? 'Sin resultados' : 'Sin sanciones'"
            :description="busqueda
              ? `Ninguna sanción coincide con «${busqueda}».`
              : `No hay sanciones ${etiquetaFiltro} en esta biblioteca.`" icon="inbox" />
        </div>

        <template v-else>
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead>
                <tr class="border-b border-slate-100 bg-slate-50/60">
                  <th scope="col" :class="[thClass, 'text-left']">Usuario</th>
                  <th scope="col" :class="[thClass, 'text-left']">Sanción</th>
                  <th scope="col" :class="[thClass, 'text-right']">Monto</th>
                  <th scope="col" :class="[thClass, 'text-left']">Estado</th>
                  <th scope="col" :class="[thClass, 'text-right']">Acciones</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-50">
                <tr v-for="s in visibles" :key="s.idSancion" class="hover:bg-slate-50/70 transition-colors">
                  <td class="px-4 py-3">
                    <p class="font-medium text-slate-800">{{ s.nombreUsuario }}</p>
                    <p class="text-xs text-slate-400">CI: {{ s.ciUsuario }}</p>
                  </td>

                  <td class="px-4 py-3">
                    <div class="flex flex-wrap gap-1">
                      <SancionBadge tipo="tipoSancion" :valor="s.tipoSancion" />
                      <SancionBadge tipo="motivo" :valor="s.motivo" />
                    </div>
                    <p v-if="s.tituloEjemplar" class="mt-1 text-[11px] text-slate-400 truncate max-w-[14rem]">
                      {{ s.tituloEjemplar }}
                    </p>
                  </td>

                  <td class="px-4 py-3 text-right">
                    <span class="font-semibold text-slate-800">{{ formatMonto(montoSancion(s)) }}</span>
                    <p class="text-[11px]" :class="estaPagada(s) ? 'text-emerald-600 font-medium' : 'text-slate-400'">
                      {{ estaPagada(s) ? 'pagada' : esReposicion(s) ? 'reposición' : 'multa' }}
                    </p>
                  </td>
                  <td class="px-4 py-3">
                    <SancionBadge tipo="estado" :valor="s.estado" />
                    <p v-if="reposicionPendiente(s)" class="mt-1 text-[11px] font-medium text-red-600">
                      Reposición pendiente
                    </p>
                    <p v-else-if="reposicionResuelta(s)" class="mt-1 text-[11px] font-medium text-emerald-600">
                      Reposición regularizada
                    </p>
                    <p v-if="s.fechaFinSuspension" class="mt-1 text-[11px]"
                      :class="s.suspensionVigente ? 'text-red-600 font-medium' : 'text-slate-400'">
                      Suspensión hasta {{ formatFecha(s.fechaFinSuspension) }}
                      <SBadge v-if="s.suspensionVigente" variant="danger" size="sm" :dot="true" class="ml-1">Vigente</SBadge>
                    </p>
                  </td>

                  <td class="px-4 py-3">
                    <SancionAcciones :sancion="s" compact @detalle="abrirDetalle" @pagar="abrirPago"
                      @reposicion-fisica="abrirReposicionFisica" @condonar="abrirCondonar" />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Paginación -->
          <div class="flex items-center justify-between gap-3 px-4 py-3 border-t border-slate-100 text-xs text-slate-500">
            <span>
              Mostrando {{ desde + 1 }}–{{ Math.min(desde + POR_PAGINA, filtradas.length) }} de {{ filtradas.length }}
            </span>
            <div class="flex items-center gap-2">
              <SButton variant="ghost" size="sm" :disabled="paginaActual === 1" @click="pagina = paginaActual - 1">
                Anterior
              </SButton>
              <span>Página {{ paginaActual }} de {{ totalPaginas }}</span>
              <SButton variant="ghost" size="sm" :disabled="paginaActual === totalPaginas" @click="pagina = paginaActual + 1">
                Siguiente
              </SButton>
            </div>
          </div>
        </template>
      </SCard>
    </div>

    <!-- Modales -->
    <ModalDetalleSancion v-model="detalleAbierto" :sancion="store.sancionDetalle" :loading="store.cargandoDetalle"
      @pagar="abrirPago" @reposicion-fisica="abrirReposicionFisica" @condonar="abrirCondonar" />
    <ModalPago v-model="pagoAbierto" :sancion="sancionAccion" @pagado="cargar()" />
    <ModalCondonar v-model="condonarAbierto" :sancion="sancionAccion" @condonado="cargar()" />
    <ModalReposicionFisica v-model="fisicaAbierto" :sancion="sancionAccion" @registrado="cargar()" />
    <ModalRegistrarPerdida v-model="perdidaAbierta" @registrado="cargar()" />
    <ModalSancionManual v-model="manualAbierto" @registrado="cargar()" />
  </div>
</template>
