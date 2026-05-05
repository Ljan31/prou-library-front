<script setup lang="ts">
import type { LibroPublico } from '@/types/reservas'

interface Props {
  libro: LibroPublico
  yaReservado?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  yaReservado: false,
})

const emit = defineEmits<{
  (e: 'reservar', libro: LibroPublico): void
}>()

const hayDisponibles = computed(() =>
  (props.libro.ejemplaresDisponibles ?? 1) > 0
)

const textoBoton = computed(() => {
  if (props.yaReservado) return 'Ya reservado'
  if (!hayDisponibles.value) return 'Reservar (en cola)'
  console.log('datos')
  console.log(props.libro)
  return 'Reservar'
})

import { computed } from 'vue'
</script>

<template>
  <div
    class="group bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-md hover:border-indigo-200 transition-all duration-200 flex flex-col">
    <!-- Portada -->
    <div class="relative bg-gradient-to-br from-slate-100 to-indigo-50 aspect-[3/4] overflow-hidden">
      <img v-if="libro.ediciones?.length" :src="libro.ediciones[0].imagenPortada" :alt="libro.titulo"
        class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
      <div v-else class="w-full h-full flex items-center justify-center">
        <svg class="w-12 h-12 text-indigo-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1"
            d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      </div>

      <!-- Badge disponibilidad -->
      <div class="absolute top-2 right-2">
        <span v-if="libro.ejemplaresDisponibles !== undefined" :class="[
          'text-xs font-medium px-2 py-0.5 rounded-full',
          hayDisponibles
            ? 'bg-emerald-100 text-emerald-700'
            : 'bg-amber-100 text-amber-700'
        ]">
          {{ hayDisponibles ? `${libro.ejemplaresDisponibles} disp.` : 'Sin stock' }}
        </span>
      </div>

      <!-- Badge ya reservado -->
      <div v-if="yaReservado" class="absolute inset-0 bg-indigo-900/50 flex items-center justify-center">
        <span class="bg-white text-indigo-700 text-xs font-semibold px-3 py-1.5 rounded-full shadow">
          ✓ Reservado
        </span>
      </div>
    </div>

    <!-- Info -->
    <div class="p-3 flex flex-col flex-1">
      <p class="text-xs text-indigo-500 font-medium mb-0.5 truncate">
        {{ libro.nombreCategoria ?? 'Sin categoría' }}
      </p>
      <h3 class="font-semibold text-slate-900 text-sm leading-snug line-clamp-2 flex-1">
        {{ libro.titulo }}
      </h3>
      <p class="text-xs text-slate-500 mt-1 truncate">{{ libro.autor }}</p>

      <button :disabled="yaReservado" :class="[
        'mt-3 w-full text-xs font-medium py-2 rounded-lg transition-colors',
        yaReservado
          ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
          : 'bg-indigo-600 hover:bg-indigo-700 text-white'
      ]" @click="!yaReservado && emit('reservar', libro)">
        {{ textoBoton }}
      </button>
    </div>
  </div>
</template>