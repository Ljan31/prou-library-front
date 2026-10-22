<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import api from '@/services/axios'
import { useAuthStore } from '@/stores/auth.store'
import { usePermissions } from '@/composables/usePermissions'

import ConfiguracionPrestamo from '@/components/bibliotecas/ConfiguracionPrestamo.vue'
import RazonesCertificado from '@/components/bibliotecas/RazonesCertificado.vue'
import PlantillasManager from '@/components/bibliotecas/PlantillaManager.vue'
import InformacionGeneral from '@/components/bibliotecas/InformacionGeneral.vue'

const router = useRouter()
const auth = useAuthStore()
const { isAdmin } = usePermissions()

interface Biblioteca {
  id_biblioteca: number
  nombre: string
}

interface SeccionConfig {
  id: string
  titulo: string
  descripcion: string
  rutaBase: string
  icono: string
  colorBg: string
  colorTexto: string
}

// ─── Init ─────────────────────────────────────────────────────────────────────
onMounted(() => {
  if (isAdmin.value) {
    fetchBibliotecas()
  }
})

// ─── Bibliotecas (Admin / Bibliotecario) ──────────────────────────────────────
const bibliotecas = ref<Biblioteca[]>([])
const selectedBibliotecaId = ref<number | null>(null)

async function fetchBibliotecas() {
  try {
    const { data } = await api.get('/bibliotecas')
    bibliotecas.value = data.data ?? data ?? []
  } catch { 
    bibliotecas.value = [] 
  }
}

// Acceso seguro al array de bibliotecas del usuario logueado
const bibliotecarioId = computed(() => auth.user?.biblioteca?.[0]?.id_biblioteca ?? null)

// ID final unificado que usará la interfaz de forma reactiva
const targetBibliotecaId = computed(() =>
  isAdmin.value ? selectedBibliotecaId.value : bibliotecarioId.value
)

// Indica si las opciones de configuración están listas para usarse
const puedeConfigurar = computed(() => targetBibliotecaId.value !== null)

// Nombre de la biblioteca activa para mostrar en el subtítulo del bloque
const nombreBibliotecaActiva = computed(() => {
  if (!puedeConfigurar.value) return 'Ninguna biblioteca seleccionada'
  if (!isAdmin.value) return auth.user?.biblioteca?.[0]?.nombre ?? 'Mi Biblioteca'
  
  const encontrada = bibliotecas.value.find(b => b.id_biblioteca === selectedBibliotecaId.value)
  return encontrada ? encontrada.nombre : 'Biblioteca seleccionada'
})

// ─── Definición de Tarjetas (UI) ──────────────────────────────────────────────
const secciones = ref<SeccionConfig[]>([
  {
    id: 'general',
    titulo: 'Información general',
    descripcion: 'Nombre, ubicación y datos de contacto.',
    rutaBase: '/ajustes/biblioteca',
    icono: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
    colorBg: 'bg-blue-50',
    colorTexto: 'text-blue-600'
  },
  {
    id: 'plantilla',
    titulo: 'Plantilla de Certificado',
    descripcion: 'Carga de formato base, firmas digitales y sellos institucionales.',
    rutaBase: '/ajustes/certificados',
    icono: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
    colorBg: 'bg-emerald-50',
    colorTexto: 'text-emerald-600'
  },
  {
    id: 'solicitudes',
    titulo: 'Solicitudes',
    descripcion: 'Gestión de motivos de solicitud (Egreso, Trámite, etc.) y sus requisitos asociados.',
    rutaBase: '/ajustes/solicitudes',
    icono: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01',
    colorBg: 'bg-amber-50',
    colorTexto: 'text-amber-600'
  },
  {
    id: 'reglas',
    titulo: 'Reglas de emisión',
    descripcion: 'Días máximos, límite de ejemplares, días de suspensión y multas por retraso.',
    rutaBase: '/ajustes/reglas',
    icono: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
    colorBg: 'bg-purple-50',
    colorTexto: 'text-purple-600'
  },
])

// Componentes que se abrirán dentro de esta pantalla
const componentesConfig = {
  general: InformacionGeneral,
  reglas: ConfiguracionPrestamo,
  solicitudes: RazonesCertificado,
  plantilla: PlantillasManager,
}

type SeccionDinamica = keyof typeof componentesConfig

const seccionActiva = ref<SeccionDinamica | null>(null)

const componenteActivo = computed(() => {
  if (!seccionActiva.value) return null
  return componentesConfig[seccionActiva.value]
})

// Propiedades específicas de cada componente
const propsComponenteActivo = computed(() => {
  if (seccionActiva.value === 'reglas') {
    return {
      bibliotecaId: targetBibliotecaId.value!,
      nombreBib: nombreBibliotecaActiva.value,
    }
  }
  if (seccionActiva.value === 'plantilla') {
    return {
      bibliotecaId: targetBibliotecaId.value!,
      nombreBib: nombreBibliotecaActiva.value,
    }
  }

  return {
    bibliotecaId: targetBibliotecaId.value!,
  }
})

function volverAjustes() {
  seccionActiva.value = null
}

function irAConfiguracion(rutaBase: string, id: string) {
  if (!puedeConfigurar.value) return
  // Si la tarjeta tiene un componente registrado, lo mostramos
  if (id in componentesConfig) {
    seccionActiva.value = id as SeccionDinamica
    return
  }
  router.push({
    path: rutaBase,
    query: { id: targetBibliotecaId.value }
  })
}
</script>

<template>
  <div class="p-6 max-w-7xl mx-auto space-y-8 select-none">
    
    <!-- ── Header ── -->
    <div class="flex items-center gap-4">
      <div class="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
        <!-- Icono Ajustes Izquierda Superior -->
        <svg xmlns="http://w3.org" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
        </svg>
      </div>
      <div>
        <h1 class="text-2xl font-bold text-slate-900">Ajustes de Biblioteca</h1>
        <p class="text-sm text-slate-500">Administra la información y las configuraciones de tu biblioteca.</p>
      </div>
    </div>

    <!-- ── Contexto de Biblioteca (Admin Selector o Info Fija) ── -->
    <div v-if="isAdmin" class="bg-white rounded-2xl border border-slate-100 p-5 space-y-3 shadow-sm">
      <span class="text-[10px] font-bold tracking-wider uppercase text-slate-400 block">
        Biblioteca Seleccionada
      </span>

      <div class="flex flex-col md:flex-row md:items-center gap-4 justify-between">
        <div class="flex items-center gap-3">
          <div class="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
            <!-- Icono Edificio Biblioteca -->
            <svg xmlns="http://w3.org" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" />
            </svg>
          </div>
          <div>
            <h3 class="font-semibold text-slate-800 text-base">{{ nombreBibliotecaActiva }}</h3>
            <p class="text-xs text-slate-400 mt-0.5">
              {{ puedeConfigurar ? 'Biblioteca activa para configurar' : 'Por favor, selecciona una biblioteca de la lista para continuar.' }}
            </p>
          </div>
        </div>

        <!-- Selector de Contexto (Admin) -->
        <div v-if="isAdmin" class="w-full md:w-72">
          <select 
            v-model="selectedBibliotecaId"
            class="w-full px-4 py-2.5 text-sm font-medium border border-slate-200 rounded-xl bg-slate-50 text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer"
          >
            <option :value="null">Elegir biblioteca...</option>
            <option v-for="b in bibliotecas" :key="b.id_biblioteca" :value="b.id_biblioteca">
              {{ b.nombre }}
            </option>
          </select>
        </div>
      </div>

      <p v-if="isAdmin" class="text-[11px] text-slate-400 italic pt-1">
        * Para el administrador, este campo será un selector de bibliotecas.
      </p>
    </div>

    <!-- ── Sección Inferior: Grid de Configuraciones ── -->
    <div v-if="!seccionActiva" class="space-y-5">
      <h2 class="text-lg font-bold text-slate-800 tracking-tight">Configuraciones</h2>
      
      <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div 
          v-for="seccion in secciones" 
          :key="seccion.id"
          class="group bg-white rounded-2xl border p-5 flex flex-col justify-between transition-all duration-300 shadow-sm"
          :class="[
            puedeConfigurar 
              ? 'border-slate-100 hover:shadow-md hover:border-slate-200/80 cursor-pointer' 
              : 'border-slate-100 opacity-40 cursor-not-allowed select-none'
          ]"
          @click="irAConfiguracion(seccion.rutaBase, seccion.id)"
        >
          <div class="space-y-4">
            <!-- Icono Dinámico -->
            <div class="w-10 h-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-105 duration-300" :class="seccion.colorBg">
              <svg xmlns="http://w3.org" class="h-5 w-5" :class="seccion.colorTexto" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" :d="seccion.icono" />
              </svg>
            </div>

            <!-- Título y Descripción -->
            <div class="space-y-1">
              <h3 class="font-bold text-slate-800 text-base transition-colors" :class="puedeConfigurar ? 'group-hover:text-indigo-600' : ''">
                {{ seccion.titulo }}
              </h3>
              <p class="text-sm text-slate-500 leading-relaxed">
                {{ seccion.descripcion }}
              </p>
            </div>
          </div>

          <!-- Enlace de acción -->
          <div class="pt-5 mt-auto">
            <button 
              :disabled="!puedeConfigurar"
              class="inline-flex items-center gap-1.5 text-xs font-bold transition-colors disabled:pointer-events-none"
              :class="puedeConfigurar ? 'text-indigo-600 group-hover:text-indigo-700' : 'text-slate-400'"
            >
              <span>Configurar</span>
              <svg xmlns="http://w3.org" class="h-3.5 w-3.5 transform transition-transform" :class="puedeConfigurar ? 'group-hover:translate-x-0.5' : ''" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
    <!-- Vista dinámica de configuraciones -->
    <div
      v-if="seccionActiva && componenteActivo && puedeConfigurar"
      class="space-y-4"
    >
      <button
        type="button"
        @click="volverAjustes"
        class="mb-2 text-sm font-medium text-indigo-600 hover:text-indigo-800"
      >
        ← Volver a Ajustes de Biblioteca
      </button>

      <component
        :is="componenteActivo"
        v-bind="propsComponenteActivo"
      />
    </div>
  </div>

</template>
