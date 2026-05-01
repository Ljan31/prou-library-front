<script setup lang="ts">
import { computed } from 'vue'
import { primeraPortada, primeraEditorial, primerIsbn } from '@/utils/catalogo'
import type { Libro } from '@/types/catalogo'

const props = defineProps<{
  libro: Libro
  vista: 'grid' | 'lista'
  puedeEditar: boolean
}>()

const emit = defineEmits<{
  ver: [libro: Libro]
  editar: [libro: Libro]
  eliminar: [libro: Libro]
}>()
const portada = computed(() => primeraPortada(props.libro.ediciones))
const editorial = computed(() => primeraEditorial(props.libro.ediciones))
const isbn = computed(() => primerIsbn(props.libro.ediciones))
const numEdiciones = computed(() => props.libro.ediciones?.length ?? 0)
</script>

<template>
  <!-- ── Vista GRID ── -->
  <div v-if="vista === 'grid'"
    class="group relative bg-white rounded-xl border border-slate-200 overflow-hidden hover:border-indigo-300 hover:shadow-md transition-all duration-200 cursor-pointer"
    @click="emit('ver', libro)">
    <!-- Portada -->
    <div class="relative aspect-[2/3] bg-gradient-to-br from-indigo-50 to-slate-100 overflow-hidden">
      <img v-if="portada" :src="portada" :alt="libro.titulo"
        class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
      <div v-else class="w-full h-full flex items-center justify-center">
        <svg class="w-12 h-12 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
            d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      </div>

      <!-- Badge disponibilidad -->
      <div class="absolute top-2 right-2">
        <span :class="['text-xs font-medium px-2 py-0.5 rounded-full',
          libro.ejemplaresDisponibles === 0 ? 'bg-red-100 text-red-700' :
            libro.ejemplaresDisponibles <= 1 ? 'bg-amber-100 text-amber-700' :
              'bg-emerald-100 text-emerald-700']">
          {{ libro.ejemplaresDisponibles }} disp.
        </span>
      </div>

      <!-- Acciones hover — solo staff -->
      <div v-if="puedeEditar"
        class="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2"
        @click.stop>
        <button @click.stop="emit('editar', libro)"
          class="bg-white/90 hover:bg-white text-slate-700 p-2 rounded-lg transition-colors" title="Editar">
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </button>
        <button @click.stop="emit('eliminar', libro)"
          class="bg-white/90 hover:bg-red-50 text-red-600 p-2 rounded-lg transition-colors" title="Eliminar">
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    </div>

    <!-- Info -->
    <div class="p-3">
      <p class="text-xs text-indigo-600 font-medium mb-0.5 truncate">
        {{ libro.categoria?.nombreCategoria }}
      </p>
      <h3 class="text-sm font-semibold text-slate-900 line-clamp-2 leading-tight mb-1">
        {{ libro.titulo }}
      </h3>
      <p class="text-xs text-slate-500 truncate">{{ editorial }}</p>
      <p class="text-xs text-slate-400 mt-1">
        {{ numEdiciones }} edición{{ numEdiciones !== 1 ? 'es' : '' }} ·
        {{ libro.ejemplaresTotal }} ejemplar{{ libro.ejemplaresTotal !== 1 ? 'es' : '' }}
      </p>
    </div>
  </div>

  <!-- ── Vista LISTA ── -->
  <div v-else
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

    <!-- Acciones -->
    <div v-if="puedeEditar" class="flex items-center gap-1 flex-shrink-0" @click.stop>
      <button @click.stop="emit('editar', libro)"
        class="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors">
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      </button>
      <button @click.stop="emit('eliminar', libro)"
        class="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors">
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>
    </div>
  </div>
</template>