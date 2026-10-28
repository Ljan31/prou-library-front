<script setup lang="ts">
import { computed } from 'vue'
import SModal from '@/components/ui/SModal.vue'
import SButton from '@/components/ui/SButton.vue'
import SBadge from '@/components/ui/SBadge.vue'
import SSkeleton from '@/components/feedback/SSkeleton.vue'
import SancionBadge from '@/components/sanciones/SancionBadge.vue'
import SancionAcciones from '@/components/sanciones/SancionAcciones.vue'
import type { SancionResponse } from '@/types/notificacion.types'
import {
  esReposicion, formatFecha, formatFechaHora, formatMonto, montoSancion, reposicionPendiente,
  resolucionDe, RESOLUCION_LABEL,
} from '@/utils/sancion.utils'

const props = defineProps<{ sancion: SancionResponse | null; loading?: boolean }>()
const emit = defineEmits<{
  pagar: [s: SancionResponse]
  'reposicion-fisica': [s: SancionResponse]
  condonar: [s: SancionResponse]
}>()
const open = defineModel<boolean>({ required: true })

const s = computed(() => props.sancion)
const repos = computed(() => !!s.value && esReposicion(s.value))
const titulo = computed(() => (repos.value ? 'Detalle de reposición' : 'Detalle de sanción'))

const resolucion = computed(() => (s.value ? resolucionDe(s.value) : null))
const resolucionLabel = computed(() =>
  resolucion.value ? (RESOLUCION_LABEL[resolucion.value] ?? resolucion.value) : '—',
)

interface Campo { label: string; value: string; sub?: string; destacado?: boolean; completo?: boolean }

const campos = computed<Campo[]>(() => {
  const x = s.value
  if (!x) return []
  const lista: Campo[] = [
    { label: 'Usuario', value: x.nombreUsuario, sub: `CI: ${x.ciUsuario}` },
    { label: 'Préstamo relacionado', value: x.prestamoId ? `#${x.prestamoId}` : '—' },
    { label: 'Biblioteca', value: x.nombreBiblioteca || '—' },
  ]
  if (repos.value) {
    lista.push(
      { label: 'Ejemplar perdido', value: x.codigoTopograficoConcat ?? '—', sub: x.tituloEjemplar ?? undefined },
      { label: 'Monto de reposición', value: formatMonto(montoSancion(x)), destacado: true },
    )
  } else {
    lista.push(
      { label: 'Días de retraso', value: x.diasRetraso != null ? String(x.diasRetraso) : '—' },
      { label: 'Monto de multa', value: formatMonto(montoSancion(x)), destacado: true },
    )
  }
  lista.push({ label: 'Observaciones', value: x.observaciones || '—', completo: true })
  return lista
})

/** Cronología construida con las fechas que envía el backend. */
const eventos = computed(() => {
  const x = s.value
  if (!x) return []
  const lista: { titulo: string; fecha: string; detalle?: string; tono: string }[] = [
    { titulo: 'Sanción generada', fecha: x.fechaGeneracion, tono: 'bg-slate-400' },
  ]
  if (x.fechaPago) {
    lista.push({
      titulo: 'Pago registrado', fecha: x.fechaPago, tono: 'bg-emerald-500',
      detalle: x.metodoPago ? `Método: ${x.metodoPago}` : undefined,
    })
  }
  if (x.fechaCondonacion) lista.push({ titulo: 'Condonada', fecha: x.fechaCondonacion, tono: 'bg-slate-500' })
  if (x.fechaResolucion && resolucion.value !== 'PENDIENTE') {
    lista.push({ titulo: 'Reposición resuelta', fecha: x.fechaResolucion, tono: 'bg-emerald-500', detalle: resolucionLabel.value })
  }
  return lista
})

const sinValorReposicion = computed(() => repos.value && !!s.value && montoSancion(s.value) <= 0)
</script>

<template>
  <SModal v-model="open" :title="titulo" size="lg">
    <div v-if="!s" class="space-y-2">
      <SSkeleton v-for="i in 5" :key="i" width="100%" height="1.5rem" />
    </div>

    <div v-else class="space-y-5 transition-opacity" :class="{ 'opacity-60': loading }" :aria-busy="loading">
      <!-- Cabecera -->
      <div class="flex flex-wrap items-center gap-2">
        <SancionBadge tipo="tipoSancion" :valor="s.tipoSancion" />
        <SancionBadge tipo="motivo" :valor="s.motivo" />
        <SancionBadge tipo="estado" :valor="s.estado" />
      </div>

      <!-- Campos -->
      <dl class="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
        <div v-for="c in campos" :key="c.label" :class="{ 'sm:col-span-2': c.completo }">
          <dt class="text-xs text-slate-500">{{ c.label }}</dt>
          <dd :class="c.destacado ? 'text-lg font-bold text-slate-800' : 'font-medium text-slate-800'">{{ c.value }}</dd>
          <dd v-if="c.sub" class="text-xs text-slate-400">{{ c.sub }}</dd>
        </div>

        <div v-if="repos">
          <dt class="text-xs text-slate-500">Forma de resolución</dt>
          <dd>
            <SBadge :variant="resolucion === 'PENDIENTE' ? 'warning' : 'success'" size="md">{{ resolucionLabel }}</SBadge>
          </dd>
        </div>

        <div v-if="!repos && (s.fechaInicioSuspension || s.fechaFinSuspension)">
          <dt class="text-xs text-slate-500">Suspensión</dt>
          <dd class="font-medium text-slate-800">
            {{ formatFecha(s.fechaInicioSuspension) }} → {{ formatFecha(s.fechaFinSuspension) }}
            <SBadge v-if="s.suspensionVigente" variant="danger" size="sm" :dot="true" class="ml-1">Vigente</SBadge>
            <SBadge v-else variant="default" size="sm" class="ml-1">Finalizada</SBadge>
          </dd>
        </div>
      </dl>

      <!-- Avisos -->
      <p v-if="reposicionPendiente(s)"
        class="p-3 rounded-xl bg-indigo-50 border border-indigo-100 text-xs text-indigo-800">
        <template v-if="sinValorReposicion">
          Esta reposición no tiene valor monetario: solo puede resolverse con un <strong>ejemplar físico</strong>.
        </template>
        <template v-else>
          Reposición pendiente. Puede resolverse con un <strong>pago</strong> o entregando un
          <strong>ejemplar físico</strong> de reemplazo.
        </template>
        La devolución del préstamo queda bloqueada hasta entonces.
      </p>

      <p v-if="!repos && s.estado === 'PAGADA' && s.suspensionVigente"
        class="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800">
        La multa fue pagada, pero la <strong>suspensión sigue vigente</strong> hasta
        {{ formatFecha(s.fechaFinSuspension) }}. El pago no levanta la suspensión.
      </p>

      <!-- Cronología -->
      <section aria-label="Cronología">
        <h3 class="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Cronología</h3>
        <ol class="space-y-2.5 border-l-2 border-slate-100 pl-4 ml-1">
          <li v-for="e in eventos" :key="e.titulo" class="relative">
            <span :class="['absolute -left-[1.4rem] top-1.5 w-2.5 h-2.5 rounded-full ring-2 ring-white', e.tono]" />
            <p class="text-sm font-medium text-slate-700">{{ e.titulo }}</p>
            <p class="text-xs text-slate-400">
              {{ formatFechaHora(e.fecha) }}<template v-if="e.detalle"> · {{ e.detalle }}</template>
            </p>
          </li>
        </ol>
      </section>
    </div>

    <template #footer>
      <SButton variant="secondary" @click="open = false">Cerrar</SButton>
      <SancionAcciones v-if="s" :sancion="s" @pagar="emit('pagar', $event)"
        @reposicion-fisica="emit('reposicion-fisica', $event)" @condonar="emit('condonar', $event)" />
    </template>
  </SModal>
</template>