<script setup lang="ts">
/**
 * ReservaModalConfirm
 *
 * Modal que permite al usuario autenticado seleccionar la biblioteca
 * y confirmar la reserva. Maneja dos casos:
 *   1. Usuario ya autenticado → crea la reserva directamente.
 *   2. Reserva pendiente post-login → usa confirmarReservaPendiente().
 */
import { ref, onMounted, computed } from 'vue'
import { useReservasStore } from '@/stores/reservas.store'
import SButton from '@/components/ui/SButton.vue'
import SSelect from '@/components/ui/SSelect.vue'
import type { LibroPublico, BibliotecaPublica } from '@/types/reservas'

interface Props {
  libro: LibroPublico
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'confirmada'): void
}>()

const reservasStore = useReservasStore()

const bibliotecaId = ref<string>('')
const observaciones = ref('')
const enviando = ref(false)
const errorMsg = ref<string | null>(null)

// Si hay reserva pendiente con biblioteca ya elegida, pre-seleccionar
onMounted(() => {
  console.log('reservaStore', reservasStore.tienePendiente)
  console.log('reserva: ', reservasStore)
  const pendiente = reservasStore.reservaPendiente

  if (reservasStore.tienePendiente && pendiente) {
    bibliotecaId.value = String(pendiente.bibliotecaId ?? '')
    observaciones.value = pendiente.observaciones ?? ''
  } else {
    bibliotecaId.value = props.libro?.idBiblioteca ?? ''
  }

  console.log('reservamodal', {
    bibliotecaId: bibliotecaId.value,
    enviando: enviando.value
  })
})

const puedeConfirmar = computed(
  () => !!bibliotecaId.value && !enviando.value
)

async function confirmar() {
  if (!puedeConfirmar.value) return
  errorMsg.value = null
  enviando.value = true

  try {
    // Caso 1: hay una reserva pendiente desde antes del login
    if (reservasStore.tienePendiente) {
      // Actualizar biblioteca seleccionada en la pendiente
      const pending = reservasStore.reservaPendiente!
      reservasStore.guardarReservaPendiente({
        ...pending,
        bibliotecaId: Number(bibliotecaId.value),
        bibliotecaNombre: props.libro.nombreBiblioteca ?? '',
        observaciones: observaciones.value || undefined,
      })
      const resultado = await reservasStore.confirmarReservaPendiente()
      if (!resultado) {
        errorMsg.value = 'No se pudo confirmar la reserva. Intenta de nuevo.'
        return
      }
    } else {
      // Caso 2: reserva directa desde el catálogo (usuario ya estaba autenticado)
      const resultado = await reservasStore.crearReserva({
        libroId: props.libro.idLibro,
        bibliotecaId: Number(bibliotecaId.value),
        observaciones: observaciones.value || undefined,
      })
      if (!resultado) {
        errorMsg.value = 'No se pudo crear la reserva. Verifica que no tengas una activa para este libro.'
        return
      }
    }
    console.log('reservaIDS: ', reservasStore.libroIdsConReservaActiva)
    emit('confirmada')
  } finally {
    enviando.value = false
  }
}
</script>

<template>
  <!-- Backdrop -->
  <div class="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4"
    @click.self="emit('close')">
    <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
      <!-- Header -->
      <div class="bg-linear-to-br from-indigo-600 to-indigo-800 px-6 py-5">
        <div class="flex items-start justify-between">
          <div class="flex-1 min-w-0">
            <p class="text-indigo-200 text-xs font-medium uppercase tracking-wide">Confirmar reserva</p>
            <h2 class="text-white font-bold text-lg mt-0.5 leading-tight">{{ libro.titulo }}</h2>
            <p class="text-indigo-300 text-sm mt-0.5">{{ libro.autor }}</p>
          </div>
          <button class="text-indigo-300 hover:text-white ml-4 shrink-0" @click="emit('close')" aria-label="Cerrar">
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <!-- Body -->
      <div class="px-6 py-5 space-y-4">
        <!-- Info reserva -->
        <div class="bg-indigo-50 rounded-xl px-4 py-3 text-sm text-indigo-700">
          <p>
            Al confirmar, quedarás en la cola de espera para este libro.
            Recibirás una notificación cuando esté disponible para retiro.
          </p>
        </div>

        <!-- Selector de biblioteca -->
        <div>
          <label class="block text-sm font-medium text-slate-700 mb-1.5">
            Biblioteca de retiro <span class="text-red-500">*</span>
          </label>
          <div class="text-sm text-slate-900 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
            {{ reservasStore.tienePendiente
              ? reservasStore.reservaPendiente?.bibliotecaNombre
              : libro.nombreBiblioteca }}
          </div>
        </div>

        <!-- Observaciones -->
        <div>
          <label class="block text-sm font-medium text-slate-700 mb-1.5">
            Observaciones <span class="text-xs text-slate-400">(opcional)</span>
          </label>
          <textarea v-model="observaciones" rows="2" placeholder="Ej: Necesito el libro para el lunes..." class="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 resize-none
                   focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent
                   placeholder:text-slate-400" />
        </div>

        <!-- Error -->
        <p v-if="errorMsg" class="text-red-500 text-sm bg-red-50 rounded-lg px-3 py-2">
          {{ errorMsg }}
        </p>
      </div>

      <!-- Footer -->
      <div class="px-6 pb-6 flex gap-3">
        <SButton variant="secondary" class="flex-1" @click="emit('close')">
          Cancelar
        </SButton>
        <SButton variant="primary" class="flex-1" :loading="enviando" :disabled="!puedeConfirmar" @click="confirmar">
          {{ enviando ? 'Reservando…' : 'Confirmar reserva' }}
        </SButton>
      </div>
    </div>
  </div>
</template>