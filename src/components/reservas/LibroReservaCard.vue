<script setup lang="ts">
import type { LibroPublico } from '@/types/reservas'
import { useAuthStore } from '@/stores/auth.store'
import { primeraPortada, primeraEditorial, primerIsbn } from '@/utils/catalogo'
const auth = useAuthStore()
interface Props {
  libro: LibroPublico
  yaReservado?: boolean
  vista?: 'grid' | 'lista'
}
const props = withDefaults(defineProps<Props>(), {
  yaReservado: false,
  vista: 'grid'
})

const emit = defineEmits<{
  reservar: [libro: LibroPublico]
  ver: [libro: LibroPublico]
}>()

const hayDisponibles = computed(() =>
  (props.libro.ejemplaresDisponibles ?? 1) > 0
)
const portada = computed(() => primeraPortada(props.libro.ediciones))
const editorial = computed(() => primeraEditorial(props.libro.ediciones))
const isbn = computed(() => primerIsbn(props.libro.ediciones))
const numEdiciones = computed(() => props.libro.ediciones?.length ?? 0)

const textoBoton = computed(() => {
  if (props.yaReservado) return 'Ya reservado'
  if (!hayDisponibles.value) return 'Reservar (en cola)'
  return 'Reservar'
})

import { computed } from 'vue'
</script>

<template>
  <div v-if="vista === 'grid'"
    class="group bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-md hover:border-indigo-200 transition-all duration-200 flex flex-col">
    <!-- Portada -->
    <div class="relative bg-gradient-to-br from-slate-100 to-indigo-50 aspect-[3/4] overflow-hidden">
      <img v-if="portada" :src="portada" :alt="libro.titulo"
        class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy"
        @click="emit('ver', libro)" />
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
        {{ libro?.categoria?.nombre_categoria }}
      </p>
      <h3 class="font-semibold text-slate-900 text-sm leading-snug line-clamp-2 flex-1">
        {{ libro.titulo }}
      </h3>

      <!-- Editorial (primera edición) -->
      <p class="text-xs text-slate-500 truncate">
        {{ editorial }}
      </p>

      <!-- Ediciones + ejemplares -->
      <!-- <p class="text-xs text-slate-400 mt-1">
        {{ libro.ediciones?.length || 0 }} edición{{ (libro.ediciones?.length || 0) !== 1 ? 'es' : '' }} ·
        {{ libro.ejemplaresTotal }} ejemplar{{ libro.ejemplaresTotal !== 1 ? 'es' : '' }}
      </p> -->

      <!-- Autores -->
      <p class="text-xs text-slate-500 mt-1 truncate">
        {{libro.autores?.map(a => a.nombre).join(', ') || 'Sin autores'}}
      </p>

      <button v-if="auth.isEstudiante || !auth.isAuthenticated" :disabled="yaReservado" :class="[
        'mt-3 w-full text-xs font-medium py-2 rounded-lg transition-colors',
        yaReservado
          ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
          : 'bg-indigo-600 hover:bg-indigo-700 text-white'
      ]" @click="!yaReservado && emit('reservar', libro)">
        {{ textoBoton }}
      </button>


    </div>
  </div>

  <div v-if="vista === 'lista'"
    class="flex items-center gap-4 bg-white rounded-xl border border-slate-200 px-4 py-3 hover:border-indigo-300 hover:shadow-sm transition-all duration-200 cursor-pointer"
    @click="emit('ver', libro)">
    <!-- Miniatura -->
    <div class="w-12 h-16 flex-shrink-0 rounded-lg overflow-hidden bg-gradient-to-br from-indigo-50 to-slate-100">
      <img v-if="portada" :src="portada" :alt="libro.titulo" class="w-full h-full object-cover" loading="lazy" />
      <div v-else class="w-full h-full flex items-center justify-center">
        <svg class="w-5 h-5 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
            d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      </div>
    </div>

    <!-- Info -->
    <div class="flex-1 min-w-0">
      <div class="flex items-center gap-2 mb-0.5 flex-wrap">
        <p class="text-xs text-indigo-600 font-medium">{{ libro.categoria?.nombreCategoria }}</p>
        <span class="text-slate-200">·</span>
        <p class="text-xs text-slate-400 font-mono">ISBN: {{ isbn }}</p>
      </div>
      <h3 class="text-sm font-semibold text-slate-900 truncate">{{ libro.titulo }}</h3>
      <p class="text-xs text-slate-500">{{ editorial }} · {{ libro.idioma }}</p>
    </div>

    <!-- Disponibilidad -->
    <div class="hidden sm:flex flex-col items-end gap-1 flex-shrink-0">
      <span :class="['text-xs font-medium px-2 py-0.5 rounded-full',
        libro.ejemplaresDisponibles === 0 ? 'bg-red-100 text-red-700' :
          libro.ejemplaresDisponibles <= 1 ? 'bg-amber-100 text-amber-700' :
            'bg-emerald-100 text-emerald-700']">
        {{ libro.ejemplaresDisponibles }} / {{ libro.ejemplaresTotal }} disponibles
      </span>
      <p class="text-xs text-slate-400">
        {{ numEdiciones }} edición{{ numEdiciones !== 1 ? 'es' : '' }}
      </p>
    </div>
  </div>
</template>