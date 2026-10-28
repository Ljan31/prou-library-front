<script setup lang="ts">
/**
 * Registra la pérdida de un ejemplar (POST /sanciones/reposicion).
 * - Sin `prestamo`: muestra un buscador de préstamos pendientes (vista Sanciones).
 * - Con `prestamo`: va directo al formulario (vista Devoluciones).
 */
import { computed, ref, watch } from 'vue'
import SModal from '@/components/ui/SModal.vue'
import SButton from '@/components/ui/SButton.vue'
import SInput from '@/components/ui/SInput.vue'
import { useAuthStore } from '@/stores/auth.store'
import { useUiStore } from '@/stores/ui.store'
import { useSancionStore } from '@/stores/sancion.store'
import { useBibliotecaId } from '@/composables/useBibliotecaId'
import { devolucionService } from '@/services/devolucion.service'
import {
  compararPorUrgencia, esVencido, getApiMessage, getBibliotecaIdPrestamo, getCiUsuario,
  getCodigoEjemplar, getNombreUsuario, getTitulo,
} from '@/utils/devolucion.utils'
import type { Prestamo } from '@/types/devolucion.types'
import type { SancionResponse } from '@/types/notificacion.types'

const props = withDefaults(defineProps<{ prestamo?: Prestamo | null }>(), { prestamo: null })
const emit = defineEmits<{ registrado: [sancion: SancionResponse] }>()
const open = defineModel<boolean>({ required: true })

const auth = useAuthStore()
const ui = useUiStore()
const store = useSancionStore()
const bibliotecaUsuario = useBibliotecaId()

// ── Selección de préstamo ──
const seleccionado = ref<Prestamo | null>(null)
const lista = ref<Prestamo[]>([])
const cargandoLista = ref(false)
const errorLista = ref<string | null>(null)
const busqueda = ref('')

const filtrados = computed(() => {
  const q = busqueda.value.trim().toLowerCase()
  if (!q) return lista.value
  return lista.value.filter(p =>
    [getTitulo(p), getNombreUsuario(p), getCodigoEjemplar(p), getCiUsuario(p), String(p.id_prestamo)]
      .some(c => c.toLowerCase().includes(q)),
  )
})

// ── Formulario ──
const monto = ref<string | number>('')
const observaciones = ref('')
const loading = ref(false)
const intentado = ref(false)

const montoNum = computed(() => Number(String(monto.value ?? '').trim()))
const montoValido = computed(
  () => String(monto.value ?? '').trim() !== '' && Number.isFinite(montoNum.value) && montoNum.value >= 0,
)
const errorMonto = computed(() =>
  intentado.value && !montoValido.value ? 'Ingresa un valor mayor a 0' : undefined,
)

watch(open, abierto => {
  if (abierto) iniciar()
})

function seleccionar(p: Prestamo) {
  seleccionado.value = p
  console.log('seleccionMODALREGISTRARPERIDAD: ',seleccionado.value)
  observaciones.value = `Ejemplar perdido. Código: ${getCodigoEjemplar(p)}`
}

async function iniciar() {
  monto.value = ''
  observaciones.value = ''
  busqueda.value = ''
  intentado.value = false
  if (props.prestamo) return seleccionar(props.prestamo)
  seleccionado.value = null
  await cargarLista()
}

async function cargarLista() {
  cargandoLista.value = true
  errorLista.value = null
  try {
    const bibliotecaId = auth.isAdmin ? undefined : bibliotecaUsuario.value
    if (!auth.isAdmin && bibliotecaId === undefined) {
      lista.value = []
      errorLista.value = 'Tu usuario no tiene una biblioteca asignada'
      return
    }
    lista.value = (await devolucionService.listarPendientes(bibliotecaId)).sort(compararPorUrgencia)
  } catch (e) {
    lista.value = []
    errorLista.value = getApiMessage(e, 'No se pudieron cargar los préstamos')
  } finally {
    cargandoLista.value = false
  }
}

async function confirmar() {
  intentado.value = true
  const p = seleccionado.value
  if (!p || !montoValido.value || loading.value) return

  const bibliotecaId = getBibliotecaIdPrestamo(p) ?? bibliotecaUsuario.value
  if (bibliotecaId === undefined) {
    ui.toast.error('Datos incompletos', 'No se pudo determinar la biblioteca')
    return
  }

  loading.value = true
  try {
    const data = await store.registrarReposicion({
      prestamoId: p.id_prestamo,
      bibliotecaId,
      montoReposicion: montoNum.value,
      observaciones: observaciones.value.trim() || undefined,
    })
    open.value = false
    emit('registrado', data)
  } catch {
    /* el store ya mostró el error del backend */
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <SModal v-model="open" title="Registrar pérdida del ejemplar" size="lg">
    <!-- Paso 1: elegir préstamo -->
    <div v-if="!seleccionado" class="space-y-3">
      <p class="text-sm text-slate-600">Elige el préstamo cuyo ejemplar se perdió.</p>
      <input v-model="busqueda" type="text" placeholder="Buscar por título, usuario, CI, código o #préstamo"
        aria-label="Buscar préstamo"
        class="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400" />

      <div v-if="cargandoLista" class="space-y-2">
        <div v-for="i in 4" :key="i" class="h-14 bg-slate-100 rounded-xl animate-pulse" />
      </div>
      <div v-else-if="errorLista" class="p-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600" role="alert">
        {{ errorLista }}
        <button type="button" class="ml-2 font-semibold underline" @click="cargarLista">Reintentar</button>
      </div>
      <p v-else-if="!filtrados.length" class="py-8 text-center text-sm text-slate-400">
        {{ busqueda ? 'Ningún préstamo coincide con la búsqueda' : 'No hay préstamos pendientes' }}
      </p>
      <ul v-else class="max-h-72 overflow-y-auto divide-y divide-slate-100 rounded-xl border border-slate-200">
        <li v-for="p in filtrados" :key="p.id_prestamo">
          <button type="button" class="w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors"
            @click="seleccionar(p)">
            <div class="flex items-center gap-2">
              <span class="text-xs font-bold text-slate-400">#{{ p.id_prestamo }}</span>
              <span v-if="esVencido(p)" class="text-[11px] font-bold text-red-600 bg-red-50 px-1.5 rounded">VENCIDO</span>
            </div>
            <p class="text-sm font-semibold text-slate-800 truncate">{{ getTitulo(p, 'Sin título') }}</p>
            <p class="text-xs text-slate-500 truncate">
              {{ getNombreUsuario(p) }} · CI {{ getCiUsuario(p) }} · {{ getCodigoEjemplar(p) }}
            </p>
          </button>
        </li>
      </ul>
    </div>

    <!-- Paso 2: datos de la pérdida -->
    <div v-else class="space-y-4">
      <div class="bg-slate-50 rounded-xl p-4 space-y-1.5 text-sm">
        <div class="flex items-center justify-between">
          <span class="text-xs font-bold text-slate-400">Préstamo #{{ seleccionado.id_prestamo }}</span>
          <button v-if="!prestamo" type="button" class="text-xs font-semibold text-indigo-600 hover:underline"
            @click="seleccionado = null">Cambiar</button>
        </div>
        <div class="flex justify-between gap-4">
          <span class="text-slate-500">Libro</span>
          <span class="font-medium text-right">{{ getTitulo(seleccionado, 'Sin título') }}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-slate-500">Ejemplar</span>
          <span class="font-medium">{{ getCodigoEjemplar(seleccionado) }}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-slate-500">Usuario</span>
          <span class="font-medium capitalize">{{ getNombreUsuario(seleccionado) }}</span>
        </div>
      </div>

      <p class="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
        Al confirmar, el ejemplar se marca como <strong>perdido</strong>, se genera una sanción de reposición
        y se notifica al usuario. Luego podrá resolverse con pago o con un ejemplar físico.
      </p>

      <SInput v-model="monto" label="Valor de reposición (Bs)" type="number" placeholder="Ej: 120.00"
        help-text="Monto que pagaría el usuario si repone el ejemplar con dinero" :required="true"
        :error-message="errorMonto" />

      <SInput v-model="observaciones" type="textarea" label="Observaciones"
        placeholder="Circunstancias de la pérdida..." />
    </div>

    <template #footer>
      <SButton variant="secondary" :disabled="loading" @click="open = false">Cancelar</SButton>
      <SButton variant="danger" :loading="loading" :disabled="!seleccionado" @click="confirmar">
        Registrar pérdida
      </SButton>
    </template>
  </SModal>
</template>
