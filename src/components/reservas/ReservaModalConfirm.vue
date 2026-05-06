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
import { obtenerLibro } from '@/services/libros.service'
import { primeraPortada, primeraEditorial, primerIsbn } from '@/utils/catalogo'
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

const libroDetalle = ref<any>(null)
const cargandoLibro = ref(true)

// Si hay reserva pendiente con biblioteca ya elegida, pre-seleccionar
onMounted(async () => {
  console.log('reservaStore', reservasStore.tienePendiente)
  console.log('reserva: ', reservasStore)
  const pendiente = reservasStore.reservaPendiente
  if (reservasStore.tienePendiente && pendiente) {
    bibliotecaId.value = String(pendiente.bibliotecaId ?? '')
    observaciones.value = pendiente.observaciones ?? ''
  } else {
    bibliotecaId.value = props.libro?.idBiblioteca ?? ''
  }
  // 2. Cargar datos completos del libro
  await cargarLibro()

  // 3. Debug opcional (puedes quitar luego)
  console.log('libroDetalle', libroDetalle.value)
  console.log('reservamodal', {
    bibliotecaId: bibliotecaId.value,
    enviando: enviando.value
  })
})

async function cargarLibro() {
  try {
    const resp = await obtenerLibro(props.libro.idLibro)
    libroDetalle.value = resp.data
  } catch (e) {
    console.error('Error cargando libro', e)
  } finally {
    cargandoLibro.value = false
  }
}
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

const autoresTexto = computed(() => {
  return libroDetalle.value?.autores?.map((a: any) => a.nombre).join(', ') || 'Autor desconocido'
})
const portada = computed(() => primeraPortada(libroDetalle.value?.ediciones))

const edicionPrincipal = computed(() => {
  return libroDetalle.value?.ediciones?.[0]
})

const disponible = computed(() => {
  return libroDetalle.value?.ejemplaresDisponibles > 0
})
</script>

<template>
  <!-- Backdrop -->
  <div class="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4"
    @click.self="emit('close')">
    <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
      <!-- Header -->
      <div class="bg-linear-to-br from-indigo-600 to-indigo-800 px-6 py-5">
        <div class="flex items-start gap-4">
          <!-- 📘 Portada -->
          <div class="w-14 h-20 rounded-lg overflow-hidden bg-white/10 border border-white/10 shrink-0">
            <img v-if="!cargandoLibro && portada" :src="portada" class="w-full h-full object-cover" />
            <div v-else class="w-full h-full flex items-center justify-center text-white/40 text-xs">
              <div class="animate-pulse w-full h-full bg-white/20"></div>
            </div>
          </div>

          <!-- 📄 Info -->
          <div class="flex-1 min-w-0">
            <p class="text-indigo-200 text-[11px] font-semibold uppercase tracking-wider">
              Confirmar reserva
            </p>

            <h2 class="text-white font-semibold text-lg leading-snug truncate mt-0.5">
              {{ libro.titulo }}
            </h2>

            <p class="text-indigo-300 text-sm mt-1 truncate">
              {{ cargandoLibro ? 'Cargando autores...' : autoresTexto }}
            </p>

            <!-- 🧩 metadata rápida -->
            <div v-if="!cargandoLibro" class="flex flex-wrap gap-2 mt-2 text-[11px] text-indigo-200/80">
              <span class="bg-white/10 px-2 py-0.5 rounded">
                {{ edicionPrincipal?.edicion }}
              </span>
              <span class="bg-white/10 px-2 py-0.5 rounded">
                {{ edicionPrincipal?.anoPublicacion }}
              </span>
              <span v-if="libroDetalle?.idioma" class="bg-white/10 px-2 py-0.5 rounded">
                {{ libroDetalle.idioma.toUpperCase() }}
              </span>
            </div>
          </div>

          <!-- ❌ Close -->
          <button class="text-indigo-300 hover:text-white shrink-0 transition-colors" @click="emit('close')"
            aria-label="Cerrar">
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <!-- Body -->
      <div class="px-6 py-5 space-y-4">
        <!-- Info reserva -->
        <div class="rounded-xl px-4 py-3 text-sm" :class="disponible
          ? 'bg-green-50 text-green-700'
          : 'bg-amber-50 text-amber-700'">
          <p v-if="disponible">
            Disponible ahora. Podrás retirarlo en la biblioteca seleccionada.
          </p>
          <p v-else>
            Actualmente no disponible. Serás añadido a la cola de espera.
            Recibirás una notificación cuando esté disponible el libro para retiro.
          </p>
        </div>
        <!-- Selector de biblioteca -->
        <div>
          <p class="text-xs text-slate-500 mb-1">Lugar de retiro</p>
          <div class="text-sm font-medium text-slate-900 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
            {{ reservasStore.tienePendiente
              ? reservasStore.reservaPendiente?.bibliotecaNombre
              : libroDetalle?.nombreBiblioteca }}
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
        <p class="text-xs text-slate-500 text-center">
          Al continuar, se registrará tu solicitud en el sistema.
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