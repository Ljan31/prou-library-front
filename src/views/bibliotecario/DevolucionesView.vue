<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useUiStore } from '@/stores/ui.store'
import SEmptyState from '@/components/feedback/SEmptyState.vue'
import ModalPago from '@/components/sanciones/ModalPago.vue'
import ModalReposicionFisica from '@/components/sanciones/ModalReposicionFisica.vue'
import ModalRegistrarPerdida from '@/components/sanciones/ModalRegistrarPerdida.vue'

import PendientesPanel from '@/components/devoluciones/PendientesPanel.vue'
import BuscarIdPanel from '@/components/devoluciones/BuscarIdPanel.vue'
import PrestamoHeader from '@/components/devoluciones/PrestamoHeader.vue'
import SancionesStatus from '@/components/devoluciones/SancionesStatus.vue'
import ReposicionPanel from '@/components/devoluciones/ReposicionPanel.vue'
import CondicionSelector from '@/components/devoluciones/CondicionSelector.vue'
import EstadoEjemplarSelector from '@/components/devoluciones/EstadoEjemplarSelector.vue'
import DecisionSancionCard from '@/components/devoluciones/DecisionSancionCard.vue'
import DevolucionSubmitButton from '@/components/devoluciones/DevolucionSubmitButton.vue'
import DevolucionExito from '@/components/devoluciones/DevolucionExito.vue'
import ModalSancionDanio from '@/components/devoluciones/ModalSancionDanio.vue'
import DevIcon from '@/components/devoluciones/DevIcon.vue'

import { usePrestamosPendientes } from '@/composables/devoluciones/usePrestamosPendientes'
import { useBuscarPrestamo } from '@/composables/devoluciones/useBuscarPrestamo'
import { useSancionesPrestamo } from '@/composables/devoluciones/useSancionesPrestamo'
import { useFormularioDevolucion } from '@/composables/devoluciones/useFormularioDevolucion'
import { useSancionManual } from '@/composables/devoluciones/useSancionManual'
import type { MotivoSancion } from '@/constants/devolucion.constants'
import type { Prestamo } from '@/types/devolucion.types'
import type { SancionResponse } from '@/types/notificacion.types'

const ui = useUiStore()

// ─── Estado de la vista ───────────────────────────────────────────────────────
type Modo = 'lista' | 'buscar'
const modo = ref<Modo>('lista')
const prestamo = ref<Prestamo | null>(null)
const pagoAbierto = ref(false)
const perdidaAbierta = ref(false)
const fisicaAbierta = ref(false)
/** Sanción que se está pagando (multa o reposición) */
const sancionAPagar = ref<SancionResponse | null>(null)

// ─── Composables (reactive() desenvuelve los refs para usarlos en el template) ─
const pendientes = reactive(usePrestamosPendientes())
const buscador = reactive(useBuscarPrestamo())
const sanciones = reactive(useSancionesPrestamo(prestamo))
const form = reactive(
  useFormularioDevolucion(
    prestamo,
    () => sanciones.formularioBloqueado,
    () => pendientes.cargar(),
  ),
)
/** Tras registrar una sanción: si la devolución ya se hizo, se vuelve al inicio;
 *  si no, se recargan las sanciones para mostrar los bloqueos/opciones de resolución. */
function alRegistrarSancion() {
  if (form.success) return nuevaDevolucion()
  form.marcarSancionAplicada()
  sanciones.cargar()
}

/** La pérdida ya se registró: refresca pendientes y continúa el flujo. */
function alRegistrarReposicion() {
  pendientes.cargar()
  alRegistrarSancion()
}

/** Refresca lo que cambia al resolver una sanción (pago o reposición física). */
function alResolverSancion() {
  pendientes.cargar()
  sanciones.cargar()
}

const sancionManual = reactive(
  useSancionManual(prestamo, () => form.condicion, alRegistrarSancion),
)

// ─── Acciones ─────────────────────────────────────────────────────────────────
function seleccionar(p: Prestamo) {
  prestamo.value = p
  sanciones.reiniciar()
  form.reiniciar(p)
  sanciones.cargar()
}

function limpiarSeleccion() {
  prestamo.value = null
  sanciones.reiniciar()
  form.limpiarMensajes()
}

function nuevaDevolucion() {
  limpiarSeleccion()
  buscador.limpiar()
}

function cambiarModo(nuevo: Modo) {
  modo.value = nuevo
  limpiarSeleccion()
}

async function buscarPorId() {
  const encontrado = await buscador.buscar()
  if (encontrado) seleccionar(encontrado)
}

function abrirPago(sancion: SancionResponse | null) {
  if (!sancion) return
  sancionAPagar.value = sancion
  pagoAbierto.value = true
}

/** Pérdida → reposición; daño → sanción manual. */
function abrirSancion(motivo: MotivoSancion) {
  if (motivo === 'PERDIDA_EJEMPLAR') perdidaAbierta.value = true
  else sancionManual.abrir()
}

// ─── Derivados de presentación ────────────────────────────────────────────────
const placeholderObservaciones = computed(() => {
  if (form.ejemplarPerdido) return 'Describe las circunstancias de la pérdida...'
  if (form.hayDeterioro) return 'Describe el daño observado...'
  return 'Notas adicionales (opcional)...'
})

const MODOS: { value: Modo; label: string }[] = [
  { value: 'lista', label: 'Lista pendientes' },
  { value: 'buscar', label: 'Buscar por ID' },
]

onMounted(() => {
  ui.setBreadcrumbs([{ label: 'Préstamos', to: '/prestamos' }, { label: 'Devoluciones' }])
  pendientes.cargar()
})
</script>

<template>
  <div class="page-container space-y-6">
    <!-- Encabezado -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div>
        <h1 class="text-2xl font-bold text-slate-900">Devoluciones</h1>
        <p class="text-sm text-slate-500 mt-0.5">Registra la devolución de ejemplares prestados</p>
      </div>
      <div class="flex gap-1 bg-slate-100 p-1 rounded-xl self-start sm:self-auto">
        <button v-for="m in MODOS" :key="m.value" type="button"
          :class="['px-4 py-1.5 rounded-lg text-sm font-medium transition-all',
            modo === m.value ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-900']"
          @click="cambiarModo(m.value)">
          {{ m.label }}
        </button>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-5 gap-6">
      <!-- Izquierda: selector de préstamo -->
      <div class="lg:col-span-2 space-y-4">
        <PendientesPanel v-if="modo === 'lista'" v-model:search="pendientes.search" :items="pendientes.filtrados"
          :loading="pendientes.loading" :error="pendientes.error" :selected-id="prestamo?.id_prestamo"
          @select="seleccionar" @retry="pendientes.cargar()" />

        <BuscarIdPanel v-else v-model="buscador.id" :loading="buscador.loading" :error="buscador.error"
          :prestamo="prestamo" @buscar="buscarPorId" />
      </div>

      <!-- Derecha: devolución -->
      <div class="lg:col-span-3">
        <div v-if="!prestamo"
          class="bg-white rounded-2xl border border-slate-200 shadow-sm h-full flex items-center justify-center py-16">
          <SEmptyState title="Selecciona un préstamo"
            description="Elige un préstamo de la lista o busca por ID para registrar la devolución" icon="book" />
        </div>

        <DevolucionExito v-else-if="form.success" :prestamo="prestamo" :resultado="form.resultado"
          :hay-deterioro="form.hayDeterioro" :perdido="form.ejemplarPerdido"
          @sancion="abrirSancion" @nueva="nuevaDevolucion" />

        <div v-else class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <PrestamoHeader :prestamo="prestamo" @close="limpiarSeleccion" />

          <div :class="['p-6 space-y-6', prestamo.vencido ? 'bg-red-50/30' : '']">
            <SancionesStatus :loading="sanciones.loading" :estado="sanciones.estado" :multa="sanciones.multa"
              :hay-reposicion="!!sanciones.reposicion" :omitir-bloqueo="sanciones.omitirBloqueo"
              @pagar="abrirPago(sanciones.multa)" @omitir="sanciones.omitirBloqueo = true"
              @cancelar-omitir="sanciones.omitirBloqueo = false" />

            <ReposicionPanel v-if="sanciones.reposicionBloqueante" :sancion="sanciones.reposicionBloqueante"
              @pagar="abrirPago(sanciones.reposicionBloqueante)" @fisica="fisicaAbierta = true" />

            <div :class="['space-y-6', sanciones.formularioBloqueado && 'opacity-50 pointer-events-none']">
              <CondicionSelector v-model="form.condicion" :entrega="prestamo.condicionEntrega"
                :disabled="sanciones.formularioBloqueado" :hay-deterioro="form.hayDeterioro" />
              <EstadoEjemplarSelector v-model="form.estadoEjemplar" :disabled="sanciones.formularioBloqueado"
                :hay-deterioro="form.hayDeterioro" :perdido="form.ejemplarPerdido" />
            </div>

            <DecisionSancionCard v-if="form.requiereSancion" :decision-tomada="form.decisionTomada"
              :tipo="form.decisionTipo" :perdido="form.ejemplarPerdido"
              @aplicar="abrirSancion(form.ejemplarPerdido ? 'PERDIDA_EJEMPLAR' : 'DANIO_EJEMPLAR')"
              @omitir="form.omitirSancion" />

            <div>
              <label for="observaciones-devolucion" class="block text-sm font-semibold text-slate-700 mb-2">
                Observaciones
              </label>
              <textarea id="observaciones-devolucion" v-model="form.observaciones" rows="3"
                :placeholder="placeholderObservaciones"
                class="w-full px-4 py-3 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-all resize-none" />
            </div>

            <div v-if="form.error" role="alert"
              class="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600">
              <DevIcon name="warning" class="w-4 h-4 flex-shrink-0" />
              {{ form.error }}
            </div>

            <DevolucionSubmitButton :disabled="!form.puedeConfirmar" :loading="form.loading"
              :perdido="form.ejemplarPerdido" :deterioro="form.hayDeterioro"
              :reposicion-pendiente="sanciones.requiereReposicion" :sancion-pendiente="sanciones.bloqueoActivo"
              @click="form.confirmar" />
          </div>
        </div>
      </div>
    </div>

    <!-- Modales -->
    <ModalPago v-model="pagoAbierto" :sancion="sancionAPagar" @pagado="alResolverSancion" />

    <ModalSancionDanio v-model="sancionManual.open" v-model:monto="sancionManual.monto"
      v-model:observaciones="sancionManual.observaciones" :prestamo="prestamo"
      :condicion-devolucion="form.condicion" :loading="sancionManual.loading" @confirm="sancionManual.confirmar" />

    <ModalRegistrarPerdida v-model="perdidaAbierta" :prestamo="prestamo" @registrado="alRegistrarReposicion" />

    <ModalReposicionFisica v-model="fisicaAbierta" :sancion="sanciones.reposicionBloqueante"
      @registrado="alResolverSancion" />
  </div>
</template>
