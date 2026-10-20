<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import api from '@/services/axios'
import { useAuthStore } from '@/stores/auth.store'
import { useUiStore } from '@/stores/ui.store'
import { useRoute } from 'vue-router'

const ui = useUiStore()

const route = useRoute()
const auth = useAuthStore()
interface UsuarioCertificado {
  id_usuario: number
  nombreCompleto: string
  username: string
  ci: string
  email: string
}

interface Certificado {
  id_certificado: number
  codigo_verificacion: string
  estadoCertificado: 'VIGENTE' | 'VENCIDO' | 'ANULADO'
  fechaEmision: string | null
  fechaVencimiento: string | null
  bibliotecaId: number
  bibliotecaNombre: string
  solicitudId: number
  urlDescarga: string | null
  pdf_generado: string | null
  usuario: UsuarioCertificado
  bibliotecario: UsuarioCertificado
}

interface ValidacionResult {
  valido: boolean
  mensaje: string
  certificado: Certificado | null
}

const codigoValidar = ref('')
const validando = ref(false)
const validacionResult = ref<ValidacionResult | null>(null)
const validacionError = ref<string | null>(null)
const puedeIntroducirCodigo = computed(() => auth.isAuthenticated)

// const certificado = computed(
//   () => validacionResult.value?.certificado ?? null
// )
// const estadoPresentacion = computed(() => {
//   const resultado = validacionResult.value

//   if (!resultado?.valido || !resultado.certificado) {
//     return 'NO_VERIFICADO'
//   }

//   return resultado.certificado.estadoCertificado
// })
async function validarCertificado() {
   const codigo = codigoValidar.value.trim()

  if (!codigo || validando.value) return
  validando.value = true
  validacionResult.value = null
  validacionError.value = null

  try {
    const { data } = await api.get(`/certificados/validar/${encodeURIComponent(codigo)}`)
    console.log('validar: ', data.data)
    const resultado: ValidacionResult = data.data ?? data
    validacionResult.value = resultado

  } catch (e: any) {
    validacionError.value = e.response?.data?.message || 'No se pudo verificar el certificado. Inténtalo nuevamente.'
  } finally {
    validando.value = false
  }
}
onMounted(() => {
  const codigo = route.params.codigo

  if (typeof codigo === 'string' && codigo.trim()) {
    codigoValidar.value = codigo
    validarCertificado()
  }
})
function formatDateTime(s?: string) {
  if (!s) return '—'
  return new Date(s).toLocaleString('es-BO', {
    day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
  })
}

function estadoCertClasses(estado: string) {
  const m: Record<string, string> = {
    VIGENTE: 'bg-emerald-100 text-emerald-700',
    VENCIDO: 'bg-amber-100 text-amber-700',
    ANULADO: 'bg-red-100 text-red-700',
  }
  return m[estado] ?? 'bg-slate-100 text-slate-600'
}
</script>

<template>
  <div class="space-y-6">

    <!-- ═══════════════════ VALIDAR ═══════════════════ -->
    <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div class="flex items-center gap-2.5 px-5 py-4 border-b border-slate-100 bg-slate-50/50">
        <svg class="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
        <h3 class="font-semibold text-slate-800 text-sm">Verificar autenticidad de certificado</h3>
      </div>
      <div v-if="puedeIntroducirCodigo"  class="p-5 space-y-4">
        <p class="text-sm text-slate-500">Ingresa el código de verificación del certificado para comprobar su validez
          y
          estado.</p>
        <div class="flex gap-3">
          <div class="relative flex-1">
            <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none"
              stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <input v-model="codigoValidar" type="text" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              @keyup.enter="validarCertificado"
              class="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-all font-mono" />
          </div>
          <button @click="validarCertificado" :disabled="!codigoValidar.trim() || validando" :class="['px-4 py-2.5 text-sm font-semibold rounded-xl transition-all flex items-center gap-2 flex-shrink-0',
            codigoValidar.trim() && !validando
              ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm'
              : 'bg-slate-100 text-slate-400 cursor-not-allowed']">
            <svg v-if="validando" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
            <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            {{ validando ? 'Verificando...' : 'Verificar' }}
          </button>
        </div>
        <div v-if="validacionError"
          class="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600">
          <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          {{ validacionError }}
        </div>
      </div>
    </div>

    <Transition name="fade">
      <div v-if="validacionResult" class="bg-white rounded-2xl border shadow-sm overflow-hidden"
        :class="validacionResult.valido ? 'border-emerald-200' : 'border-red-200'">
        <div :class="['flex items-center gap-3 px-5 py-4 border-b',
          validacionResult.valido ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100']">
          <div :class="['w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0',
            validacionResult.valido ? 'bg-emerald-500' : 'bg-red-500']">
            <svg v-if="validacionResult.valido" class="w-5 h-5 text-white" fill="none" stroke="currentColor"
              viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
            </svg>
            <svg v-else class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <div>
           <p
              :class="[
                'font-bold',
                validacionResult.valido &&
                validacionResult.certificado?.estadoCertificado === 'VIGENTE'
                  ? 'text-emerald-800'
                  : 'text-amber-800'
              ]"
            >
              {{
                !validacionResult.valido
                  ? 'Certificado no verificado'
                  : validacionResult.certificado?.estadoCertificado === 'ANULADO'
                    ? 'Certificado anulado'
                    : validacionResult.certificado?.estadoCertificado === 'VENCIDO'
                      ? 'Certificado vencido'
                      : validacionResult.certificado?.estadoCertificado === 'VIGENTE'
                        ? 'Certificado auténtico y vigente'
                        : 'Autenticidad confirmada'
              }}
            </p>
            <p :class="['text-xs', validacionResult.valido ? 'text-emerald-600' : 'text-red-600']">{{
              validacionResult.mensaje }}</p>
          </div>
        </div>
       <div
            v-if="validacionResult.certificado"
            class="p-5 sm:p-6 space-y-6"
          >
            <!-- Titular del certificado -->
            <div class="space-y-1">
              <p class="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Titular del certificado
              </p>

              <h2 class="text-xl sm:text-2xl font-bold text-slate-900 break-words">
                {{
                  validacionResult.certificado.usuario?.nombreCompleto?.trim()
                    || 'Nombre no disponible'
                }}
              </h2>

              <p class="text-sm text-slate-500">
                Certificado emitido por
                <span class="font-medium text-slate-700">
                  {{ validacionResult.certificado.bibliotecaNombre }}
                </span>
              </p>
            </div>

            <!-- Información del certificado -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">

              <!-- Estado -->
              <div class="rounded-xl bg-slate-50 border border-slate-100 p-4">
                <p class="text-xs text-slate-500 mb-2">
                  Estado del certificado
                </p>

                <span
                  :class="[
                    'inline-flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-full',
                    estadoCertClasses(
                      validacionResult.certificado.estadoCertificado
                    )
                  ]"
                >
                  <span class="w-1.5 h-1.5 rounded-full bg-current"></span>

                  {{ validacionResult.certificado.estadoCertificado }}
                </span>
              </div>

              <!-- Biblioteca -->
              <div class="rounded-xl bg-slate-50 border border-slate-100 p-4">
                <p class="text-xs text-slate-500 mb-1">
                  Biblioteca emisora
                </p>

                <p class="text-sm font-semibold text-slate-800">
                  {{ validacionResult.certificado.bibliotecaNombre }}
                </p>
              </div>

              <!-- Fecha de emisión -->
              <div class="rounded-xl border border-slate-100 p-4">
                <p class="text-xs text-slate-500 mb-1">
                  Fecha de emisión
                </p>

                <p class="text-sm font-medium text-slate-800">
                  {{ formatDateTime(validacionResult.certificado.fechaEmision!) }}
                </p>
              </div>

              <!-- Fecha de vencimiento -->
              <div class="rounded-xl border border-slate-100 p-4">
                <p class="text-xs text-slate-500 mb-1">
                  Fecha de vencimiento
                </p>

                <p class="text-sm font-medium text-slate-800">
                  {{ formatDateTime(validacionResult.certificado.fechaVencimiento!) }}
                </p>
              </div>
            </div>

            <!-- Código de verificación -->
            <div class="border-t border-slate-100 pt-4">
              <p class="text-xs font-medium text-slate-500 mb-2">
                Código de verificación
              </p>

              <p
                class="font-mono text-xs sm:text-sm text-indigo-700 break-all select-all"
              >
                {{ validacionResult.certificado.codigo_verificacion }}
              </p>
            </div>

            <!-- Descarga
            <div
              v-if="validacionResult.certificado.urlDescarga"
              class="border-t border-slate-100 pt-4"
            >
              <a
                :href="`${API_BASE_URL}${validacionResult.certificado.urlDescarga}`"
                target="_blank"
                rel="noopener noreferrer"
                class="w-full sm:w-auto inline-flex justify-center items-center gap-2 px-4 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors"
              >
                <svg
                  class="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>

                Descargar certificado PDF
              </a>
            </div> -->
          </div>


      </div>
    </Transition>

    <div class="bg-slate-50 rounded-2xl border border-slate-200 p-5">
      <h4 class="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
        <svg class="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        ¿Cómo verificar un certificado?
      </h4>
      <ul class="space-y-2 text-sm text-slate-500">
        <li class="flex items-start gap-2">
          <span
            class="w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">1</span>
          <span>El certificado contiene un código UUID o un código QR en la sección de verificación.</span>
        </li>
        <li class="flex items-start gap-2">
          <span
            class="w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">2</span>
          <span>Ingresa el código o escanea el QR con tu cámara para ser redirigido automáticamente.</span>
        </li>
        <li class="flex items-start gap-2">
          <span
            class="w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">3</span>
          <span>El sistema mostrará si el certificado es válido, vencido o no existe.</span>
        </li>
      </ul>
    </div>
  </div>

</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(8px);
}
</style>