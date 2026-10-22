
<script setup lang="ts">
import { ref, watch, computed, onBeforeUnmount } from 'vue'
import type {
  Biblioteca,
  CreateBibliotecaPayload
} from '@/services/bibliotecas.service'
import { useBibliotecasStore } from '@/stores/bibliotecas.store'
import { usePermissions } from '@/composables/usePermissions'
import { useMedia } from '@/composables/useMedia'

const { isAdmin } = usePermissions()
const { getUrl } = useMedia()

const props = defineProps<{
  bibliotecaId: number
  nombreBib?: string
}>()

const emit = defineEmits<{
  (e: 'saved'): void
}>()

const store = useBibliotecasStore()

const form = ref<CreateBibliotecaPayload>({
  nombre: '',
  tipoBiblioteca: 'CARRERA',
  carreraId: null,
  direccion: '',
  telefono: '',
  email: '',
  horario_atencion: '',
  encargadoId: null,
  estado: 'ACTIVA'
})

const biblioteca = ref<Biblioteca | null>(null)
const loading = ref(false)
const submitting = ref(false)
const errors = ref<Record<string, string>>({})
const mensaje = ref('')
const errorCarga = ref('')

const logoFile = ref<File | null>(null)
const logoPreview = ref<string | null>(null)
const logoActual = ref<string | null>(null)

let objectUrl: string | null = null

const puedeGuardar = computed(() =>
  !!props.bibliotecaId && !loading.value && !submitting.value
)

function liberarPreview() {
  if (objectUrl) {
    URL.revokeObjectURL(objectUrl)
    objectUrl = null
  }
}

function cargarFormulario(b: Biblioteca) {
  biblioteca.value = b

  form.value = {
    nombre: b.nombre ?? '',
    tipoBiblioteca: b.tipoBiblioteca ?? 'CARRERA',
    carreraId: b.carrera?.id_carrera ?? null,
    direccion: b.direccion ?? '',
    telefono: b.telefono ?? '',
    email: b.email ?? '',
    horario_atencion: b.horario_atencion ?? '',
    encargadoId: null,
    estado: b.estado ?? 'ACTIVA'
  }

  liberarPreview()
  logoFile.value = null
  logoActual.value = b.logoUrl ?? null
  logoPreview.value = getUrl(logoActual.value)

  errors.value = {}
  mensaje.value = ''
}

async function cargarBiblioteca() {
  if (!props.bibliotecaId) {
    biblioteca.value = null
    errorCarga.value = 'Selecciona una biblioteca para continuar.'
    return
  }

  loading.value = true
  errorCarga.value = ''
  mensaje.value = ''

  try {
    // Ajusta estos nombres si tu store usa otros métodos
    // o propiedades para consultar las bibliotecas.
    await store.fetchBibliotecas()

    const encontrada = store.bibliotecas.find(
      b => b.id_biblioteca === props.bibliotecaId
    )

    if (!encontrada) {
      biblioteca.value = null
      errorCarga.value = 'No se encontró la biblioteca seleccionada.'
      return
    }

    cargarFormulario(encontrada)
  } catch {
    errorCarga.value = 'No fue posible cargar la información.'
  } finally {
    loading.value = false
  }
}

watch(
  () => props.bibliotecaId,
  () => cargarBiblioteca(),
  { immediate: true }
)

function validar(): boolean {
  errors.value = {}

  if (!form.value.nombre.trim()) {
    errors.value.nombre = 'El nombre es obligatorio.'
  }

  if (
    form.value.tipoBiblioteca === 'CARRERA' &&
    !form.value.carreraId
  ) {
    errors.value.carreraId = 'Selecciona una carrera.'
  }

  if (
    form.value.email &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.value.email)
  ) {
    errors.value.email = 'El correo electrónico no es válido.'
  }

  return Object.keys(errors.value).length === 0
}

function cambiarLogo(event: Event) {
  const input = event.target as HTMLInputElement
  const archivo = input.files?.[0]

  if (!archivo) return

  if (!archivo.type.startsWith('image/')) {
    errors.value.logo = 'Selecciona una imagen válida.'
    input.value = ''
    return
  }

  if (archivo.size > 2 * 1024 * 1024) {
    errors.value.logo = 'La imagen no debe superar los 2 MB.'
    input.value = ''
    return
  }

  delete errors.value.logo
  liberarPreview()

  logoFile.value = archivo
  objectUrl = URL.createObjectURL(archivo)
  logoPreview.value = objectUrl
}

function cancelarCambioLogo() {
  liberarPreview()
  logoFile.value = null
  logoPreview.value = logoActual.value
  delete errors.value.logo
}

async function guardarCambios() {
  if (!validar() || !puedeGuardar.value) return

  submitting.value = true
  mensaje.value = ''

  try {
    const ok = await store.updateBiblioteca(
      props.bibliotecaId,
      form.value,
      logoFile.value
    )

    if (!ok) {
      mensaje.value = 'No se pudieron guardar los cambios.'
      return
    }

    mensaje.value = 'Información actualizada correctamente.'

    await cargarBiblioteca()
    emit('saved')
  } catch {
    mensaje.value = 'Ocurrió un error al actualizar la biblioteca.'
  } finally {
    submitting.value = false
  }
}

onBeforeUnmount(() => liberarPreview())
</script>

<template>
  <section class="space-y-6">

    <!-- Encabezado -->
    <header class="flex items-center gap-3">
      <div class="p-3 rounded-xl bg-indigo-50 text-indigo-600">
        <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24"
             stroke="currentColor" stroke-width="1.8">
          <path stroke-linecap="round" stroke-linejoin="round"
                d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6M9 9h.01M15 9h.01"/>
        </svg>
      </div>

      <div>
        <h2 class="text-xl font-bold text-slate-800">
          Información general
        </h2>
        <p class="text-sm text-slate-500">
          {{ nombreBib || biblioteca?.nombre || 'Datos de la biblioteca' }}
        </p>
      </div>
    </header>

    <!-- Cargando -->
    <div v-if="loading"
         class="bg-white border border-slate-100 rounded-2xl p-8 text-center">
      <p class="text-sm text-slate-500">Cargando información...</p>
    </div>

    <!-- Error -->
    <div v-else-if="errorCarga"
         class="bg-white border border-red-100 rounded-2xl p-6">
      <p class="text-sm text-red-600">{{ errorCarga }}</p>

      <button type="button" @click="cargarBiblioteca"
              class="mt-4 px-4 py-2 rounded-lg bg-indigo-600
                     text-white text-sm hover:bg-indigo-700">
        Reintentar
      </button>
    </div>

    <!-- Formulario -->
    <form v-else-if="biblioteca"
          @submit.prevent="guardarCambios"
          class="space-y-6">

      <!-- Datos principales -->
      <div class="bg-white rounded-2xl border border-slate-100 shadow-sm">
        <div class="px-6 py-4 border-b border-slate-100">
          <h3 class="font-semibold text-slate-800">
            Datos de identificación
          </h3>
          <p class="text-sm text-slate-500 mt-1">
            Nombre, tipo y logo de la biblioteca.
          </p>
        </div>

        <div class="p-6 grid grid-cols-1 md:grid-cols-3 gap-5">

          <!-- Nombre -->
          <div class="md:col-span-2">
            <label class="block text-sm font-medium text-slate-700 mb-1">
              Nombre *
            </label>
            <input v-model="form.nombre"
                   type="text"
                   maxlength="30"
                   placeholder="Ej.: Biblioteca Central FHCE"
                   class="w-full px-3 py-2.5 rounded-xl border text-sm
                          focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                   :class="errors.nombre
                     ? 'border-red-400 bg-red-50'
                     : 'border-slate-200 focus:border-indigo-500'"/>
            <p v-if="errors.nombre" class="text-xs text-red-600 mt-1">
              {{ errors.nombre }}
            </p>
          </div>

          <!-- Logo -->
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">
              Logo institucional
            </label>

            <label class="min-h-32 flex flex-col items-center justify-center
                          gap-2 p-3 rounded-xl border-2 border-dashed
                          border-slate-200 hover:border-indigo-300
                          cursor-pointer">
              <img v-if="logoPreview"
                   :src="logoPreview"
                   alt="Logo de la biblioteca"
                   class="w-16 h-16 object-contain"/>

              <svg v-else class="w-8 h-8 text-slate-400"
                   fill="none" viewBox="0 0 24 24"
                   stroke="currentColor" stroke-width="1.5">
                <path stroke-linecap="round" stroke-linejoin="round"
                      d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M7.5 9 12 4.5 16.5 9M12 4.5V16"/>
              </svg>

              <span class="text-xs text-center text-slate-500">
                {{ logoFile ? logoFile.name : 'Seleccionar logo' }}
              </span>

              <input type="file" accept="image/*"
                     class="sr-only" @change="cambiarLogo"/>
            </label>

            <button v-if="logoFile" type="button"
                    @click="cancelarCambioLogo"
                    class="text-xs text-red-600 mt-2">
              Cancelar cambio de logo
            </button>

            <p v-if="errors.logo" class="text-xs text-red-600 mt-1">
              {{ errors.logo }}
            </p>
          </div>

          <!-- Tipo -->
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">
              Tipo de biblioteca
            </label>

            <select
              v-model="form.tipoBiblioteca"
              :disabled="!isAdmin"
              class="w-full px-3 py-2.5 rounded-xl border border-slate-200
                    text-sm bg-white disabled:bg-slate-100
                    disabled:text-slate-500 disabled:cursor-not-allowed"
            >
              <option value="CENTRAL">Central</option>
              <option value="CARRERA">Carrera</option>
              <option value="ESPECIALIZADA">Especializada</option>
            </select>

            <p v-if="!isAdmin" class="text-xs text-slate-400 mt-1">
              Solo el administrador puede modificar este campo.
            </p>
          </div>

          <!-- Carrera -->
         <div
          v-if="form.tipoBiblioteca === 'CARRERA'"
          class="md:col-span-2"
        >
          <label class="block text-sm font-medium text-slate-700 mb-1">
            Carrera asociada
          </label>

          <!-- Administrador: puede editar -->
          <select
            v-if="isAdmin"
            v-model="form.carreraId"
            class="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm"
          >
            <option :value="null" disabled>
              Seleccionar carrera...
            </option>

            <option
              v-for="c in store.carreras"
              :key="c.id_carrera"
              :value="c.id_carrera"
            >
              {{ c.nombre_carrera }} ({{ c.codigo_carrera }})
            </option>
          </select>

          <!-- Bibliotecario: solo visualiza -->
          <div
            v-else
            class="w-full px-3 py-2.5 rounded-xl border border-slate-200
                  bg-slate-50 text-sm text-slate-700"
          >
            {{ biblioteca?.carrera?.nombre_carrera ?? 'Carrera no disponible' }}
            <span
              v-if="biblioteca?.carrera?.codigo_carrera"
              class="text-slate-500"
            >
              ({{ biblioteca.carrera.codigo_carrera }})
            </span>
          </div>
        </div>
        </div>
      </div>

      <!-- Contacto -->
      <div class="bg-white rounded-2xl border border-slate-100 shadow-sm">
        <div class="px-6 py-4 border-b border-slate-100">
          <h3 class="font-semibold text-slate-800">
            Información de contacto
          </h3>
          <p class="text-sm text-slate-500 mt-1">
            Dirección, teléfono, correo y horario de atención.
          </p>
        </div>

        <div class="p-6 space-y-5">
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">
              Dirección
            </label>
            <input v-model="form.direccion"
                   type="text" maxlength="50"
                   placeholder="Av. principal, edificio, oficina..."
                   class="w-full px-3 py-2.5 rounded-xl border
                          border-slate-200 text-sm"/>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-1">
                Teléfono
              </label>
              <input v-model="form.telefono"
                     type="text" inputmode="numeric" maxlength="8"
                     placeholder="73456789"
                     @input="form.telefono = form.telefono.replace(/\D/g, '').slice(0, 8)"
                     class="w-full px-3 py-2.5 rounded-xl border
                            border-slate-200 text-sm"/>
            </div>

            <div>
              <label class="block text-sm font-medium text-slate-700 mb-1">
                Correo electrónico
              </label>
              <input v-model="form.email"
                     type="email" maxlength="30"
                     placeholder="biblioteca@institucion.edu"
                     class="w-full px-3 py-2.5 rounded-xl border text-sm"
                     :class="errors.email ? 'border-red-400' : 'border-slate-200'"/>
              <p v-if="errors.email" class="text-xs text-red-600 mt-1">
                {{ errors.email }}
              </p>
            </div>
          </div>

          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">
              Horario de atención
            </label>
            <input v-model="form.horario_atencion"
                   type="text" maxlength="30"
                   placeholder="Lunes a viernes 8:00 - 18:00"
                   class="w-full px-3 py-2.5 rounded-xl border
                          border-slate-200 text-sm"/>
          </div>
        </div>
      </div>

      <!-- Estado -->
      <div class="bg-white rounded-2xl border border-slate-100
                  shadow-sm p-6">
        <label class="block text-sm font-medium text-slate-700 mb-2">
          Estado de la biblioteca
        </label>
        <select v-model="form.estado"
                class="w-full sm:w-64 px-3 py-2.5 rounded-xl border
                       border-slate-200 text-sm bg-white">
          <option value="ACTIVA">Activa</option>
          <option value="INACTIVA">Inactiva</option>
        </select>
      </div>

      <!-- Mensaje -->
      <div v-if="mensaje"
           role="status"
           class="px-4 py-3 rounded-xl text-sm"
           :class="mensaje.includes('correctamente')
             ? 'bg-emerald-50 text-emerald-700'
             : 'bg-red-50 text-red-700'">
        {{ mensaje }}
      </div>

      <!-- Acciones -->
      <div class="flex justify-end">
        <button type="submit"
                :disabled="!puedeGuardar"
                class="inline-flex items-center gap-2 px-5 py-3
                       rounded-xl bg-indigo-600 text-white text-sm
                       font-semibold hover:bg-indigo-700
                       disabled:opacity-50 disabled:cursor-not-allowed">
          {{ submitting ? 'Guardando cambios...' : 'Guardar cambios' }}
        </button>
      </div>

    </form>
  </section>
</template>
