<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import BaseModal from './BaseModal.vue'
import { obtenerEjemplaresPorLibro } from '@/services/ejemplares.service'
import { useMedia } from '@/composables/useMedia'
import { estadoEjemplarConfig, primeraPortada } from '@/utils/catalogo'
import type { Libro, Ejemplar } from '@/types/catalogo'

const props = defineProps<{ libro: Libro }>()
const emit = defineEmits<{ close: []; editar: [libro: Libro] }>()

const { getUrl } = useMedia()
// ─── Tabs ─────────────────────────────────────────────────────────────────
const tabActiva = ref<'info' | 'ediciones' | 'ejemplares'>('info')

// ─── Ejemplares (de todas las ediciones del libro) ────────────────────────
const cargandoEjemplares = ref(false)
const ejemplares = ref<Ejemplar[]>([])

onMounted(() => cargarEjemplares())

async function cargarEjemplares() {
  cargandoEjemplares.value = true
  try {
    ejemplares.value = await obtenerEjemplaresPorLibro(props.libro.idLibro)
  } catch {
    ejemplares.value = []
  } finally {
    cargandoEjemplares.value = false
  }
}
const estadisticasEdiciones = computed(() => {
  return (props.libro.ediciones ?? []).map(ed => {
    const ejemplaresEdicion = ejemplares.value.filter(
      ej => ej.edicion?.idEdicion === ed.idEdicion
    )

    return {
      ...ed,
      ejemplaresTotal: ejemplaresEdicion.length,
      ejemplaresDisponibles: ejemplaresEdicion.filter(
        ej => ej.estadoEjemplar === 'DISPONIBLE'
      ).length
    }
  })
})
</script>

<template>
  <BaseModal :title="libro.titulo" size="xl" @close="emit('close')">

    <!-- ── Tabs ── -->
    <div class="flex border-b border-slate-200 mb-5 -mt-1 gap-1">
      <button v-for="tab in [
        { key: 'info', label: 'Información' },
        { key: 'ediciones', label: `Ediciones (${libro.ediciones?.length ?? 0})` },
        { key: 'ejemplares', label: `Ejemplares (${ejemplares.length})` },
      ]" :key="tab.key" @click="tabActiva = tab.key as any" :class="['px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px',
        tabActiva === tab.key
          ? 'border-indigo-600 text-indigo-600'
          : 'border-transparent text-slate-500 hover:text-slate-700']">{{ tab.label }}</button>
    </div>

    <!-- ── TAB: Info ── -->
    <div v-show="tabActiva === 'info'" class="space-y-5">
      <div class="flex gap-5">
        <!-- Portada de la primera edición que tenga -->
        <div class="flex-shrink-0 w-28">
          <div
            class="aspect-[2/3] rounded-xl overflow-hidden bg-gradient-to-br from-indigo-50 to-slate-100 border border-slate-200">
            <img v-if="getUrl(primeraPortada(libro.ediciones))" :src="getUrl(primeraPortada(libro.ediciones))"
              :alt="libro.titulo" class="w-full h-full object-cover" />
            <div v-else class="w-full h-full flex items-center justify-center">
              <svg class="w-8 h-8 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                  d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
          </div>
          <div class="mt-2 text-center">
            <span :class="['text-sm font-semibold',
              libro.ejemplaresDisponibles === 0 ? 'text-red-600' :
                libro.ejemplaresDisponibles <= 1 ? 'text-amber-600' : 'text-emerald-600']">
              {{ libro.ejemplaresDisponibles }}
            </span>
            <span class="text-xs text-slate-500"> / {{ ejemplares.length }} disp.</span>
          </div>
        </div>

        <!-- Metadatos -->
        <div class="flex-1 space-y-3">
          <span
            class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700">
            {{ libro.categoria?.nombre_categoria }}
          </span>
          <dl class="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <div>
              <dt class="text-xs text-slate-500">Idioma</dt>
              <dd class="text-slate-800 mt-0.5 uppercase">{{ libro.idioma }}</dd>
            </div>
            <div>
              <dt class="text-xs text-slate-500">Ediciones</dt>
              <dd class="text-slate-800 mt-0.5">{{ libro.ediciones?.length ?? 0 }}</dd>
            </div>
            <div>
              <dt class="text-xs text-slate-500">Ejemplares totales</dt>
              <dd class="text-slate-800 mt-0.5">{{ ejemplares.length }}</dd>
            </div>
            <div>
              <dt class="text-xs text-slate-500">Disponibles</dt>
              <dd class="text-slate-800 mt-0.5">{{ libro.ejemplaresDisponibles }}</dd>
            </div>
            <div>
              <dt class="text-xs text-slate-500">Autores</dt>
               <dd class="text-slate-800 mt-0.5">
                {{ ejemplares[0]?.autores || 'Sin autores registrados' }}
              </dd>
            </div>
          </dl>
        </div>
      </div>
      <div v-if="libro.descripcion" class="bg-slate-50 rounded-xl p-4">
        <p class="text-xs font-medium text-slate-500 mb-1.5">Descripción</p>
        <p class="text-sm text-slate-700 leading-relaxed">{{ libro.descripcion }}</p>
      </div>
    </div>

    <!-- ── TAB: Ediciones ── -->
    <div v-show="tabActiva === 'ediciones'">

      <div v-if="!libro.ediciones?.length" class="text-center py-8">
        <p class="text-sm text-slate-500">Este libro no tiene ediciones registradas.</p>
      </div>

    
      <div v-else class="space-y-3">
        <div
          v-for="ed in estadisticasEdiciones"
          :key="ed.idEdicion"
          class="border border-slate-200 rounded-xl overflow-hidden"
        >
          <div class="flex items-center gap-4 px-4 py-3 bg-slate-50">

            <!-- Portada -->
            <div class="w-10 h-14 flex-shrink-0 rounded-lg overflow-hidden bg-slate-200">
              <img
                v-if="ed.imagenPortada"
                :src="getUrl(ed.imagenPortada)"
                :alt="ed.isbn || 'Portada'"
                class="w-full h-full object-cover"
              />
            </div>

            <!-- Información -->
            <div class="flex-1 min-w-0">
              <p v-if="ed.isbn"  class="text-xs font-mono font-semibold text-slate-900">
                ISBN: {{ ed.isbn || 'No registrado' }}
              </p>

              <p class="text-xs text-slate-600">
                {{ ed.editorial }} · {{ ed.anoPublicacion }}
                <template v-if="ed.edicion"> · {{ ed.edicion }}</template>
                <template v-if="ed.numeroPaginas">
                  · {{ ed.numeroPaginas }} págs.
                </template>
              </p>

              <!-- Estadísticas -->
              <div class="flex items-center gap-3 mt-2">
                <span class="text-xs text-slate-500">
                  Total:
                  <strong class="text-slate-800">
                    {{ ed.ejemplaresTotal }}
                  </strong>
                </span>

                <span class="text-xs text-emerald-600">
                  Disponibles:
                  <strong>{{ ed.ejemplaresDisponibles }}</strong>
                </span>

                <span class="text-xs text-slate-500">
                  No disponibles:
                  <strong>
                    {{ ed.ejemplaresTotal - ed.ejemplaresDisponibles }}
                  </strong>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>

    <!-- ── TAB: Ejemplares ── -->
    <div v-show="tabActiva === 'ejemplares'">

      <div v-if="cargandoEjemplares" class="flex justify-center py-8">
        <svg class="w-6 h-6 animate-spin text-indigo-400" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>

      <div v-else-if="!ejemplares.length" class="text-center py-8">
        <p class="text-sm text-slate-500">No hay ejemplares registrados para este libro.</p>
      </div>

      <div v-else class="space-y-2">
        <div v-for="ej in ejemplares" :key="ej.idEjemplar"
          class="flex items-center gap-3 px-4 py-3 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors">
          <span :class="['w-2 h-2 rounded-full flex-shrink-0',
            estadoEjemplarConfig[ej.estadoEjemplar]?.dot ?? 'bg-slate-300']" />
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="font-mono text-sm font-medium text-slate-900">{{ ej.codigoEjemplar }}</span>
              <span :class="['text-xs px-1.5 py-0.5 rounded font-medium',
                estadoEjemplarConfig[ej.estadoEjemplar]?.clases ?? 'bg-slate-100 text-slate-600']">
                {{ estadoEjemplarConfig[ej.estadoEjemplar]?.label ?? ej.estadoEjemplar }}
              </span>
              <!-- Edición a la que pertenece -->
              <span class="text-xs text-slate-400 font-mono" v-if="ej.edicion?.isbn">
                {{ ej.edicion.isbn }}
              </span>
            </div>
            <p class="text-xs text-slate-500 mt-0.5 truncate">
              {{ ej.ubicacionFisica }}
              <template v-if="ej.codigoTopografico"> · {{ ej.codigoTopografico }}</template>
              <template v-if="ej.biblioteca?.nombre"> · {{ ej.biblioteca.nombre }}</template>
            </p>
          </div>
        </div>
      </div>
    </div>

  </BaseModal>

</template>