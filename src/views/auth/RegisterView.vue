<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { estudianteService, carreraService } from '@/services/estudiante.service'
import type { CarreraBasic, UserCarreraItem } from '@/services/estudiante.service'

const router = useRouter()

// ─── Steps ────────────────────────────────────────────────────────────────
// step 1: datos de cuenta
// step 2: datos personales
// step 3: carreras (opcional)
// step 4: éxito
const currentStep = ref(1)
const TOTAL_STEPS = 3

// ─── Form data ────────────────────────────────────────────────────────────
const account = reactive({
  username: '',
  password: '',
  confirmPassword: '',
})

const persona = reactive({
  nombre: '',
  apellido_pat: '',
  apellido_mat: '',
  ci: '',
  celular: '',
  email: '',
})

// Selected careers with matricula
const selectedCarreras = ref<{ carreraId: number; nombre: string; matricula: string }[]>([])

// Available careers loaded from backend
const carreras = ref<CarreraBasic[]>([])
const carrerasLoading = ref(false)
const carrerasError = ref(false)

// Carrera to add (picker)
const pickerCarreraId = ref<number | ''>('')
const pickerMatricula = ref('')
const pickerError = ref('')

// ─── Validation errors ────────────────────────────────────────────────────
const errAccount = reactive<Record<string, string>>({})
const errPersona = reactive<Record<string, string>>({})

// ─── Submission ───────────────────────────────────────────────────────────
const submitting = ref(false)
const submitError = ref('')

// ─── Load carreras ────────────────────────────────────────────────────────
onMounted(async () => {
  carrerasLoading.value = true
  try {
    const res = await carreraService.getAll()
    carreras.value = res.data.data
  } catch {
    carrerasError.value = true
  } finally {
    carrerasLoading.value = false
  }
})

// ─── Computed ─────────────────────────────────────────────────────────────
const availableCarreras = computed(() =>
  carreras.value.filter(c => !selectedCarreras.value.some(s => s.carreraId === c.id_carrera))
)

const progressPct = computed(() => Math.round((currentStep.value / TOTAL_STEPS) * 100))

// ─── Step labels ─────────────────────────────────────────────────────────
const steps = [
  { n: 1, label: 'Cuenta' },
  { n: 2, label: 'Datos personales' },
  { n: 3, label: 'Carreras' },
]

// ─── Validate step 1 ──────────────────────────────────────────────────────
function validateAccount(): boolean {
  Object.keys(errAccount).forEach(k => delete errAccount[k])
  if (!account.username.trim()) errAccount.username = 'El usuario es requerido'
  else if (!/^[a-z0-9._-]+$/i.test(account.username)) errAccount.username = 'Solo letras, números, puntos y guiones'
  if (!account.password) errAccount.password = 'La contraseña es requerida'
  else if (account.password.length < 6) errAccount.password = 'Mínimo 6 caracteres'
  if (!account.confirmPassword) errAccount.confirmPassword = 'Confirma tu contraseña'
  else if (account.password !== account.confirmPassword) errAccount.confirmPassword = 'Las contraseñas no coinciden'
  return Object.keys(errAccount).length === 0
}

// ─── Validate step 2 ──────────────────────────────────────────────────────
function validatePersona(): boolean {
  Object.keys(errPersona).forEach(k => delete errPersona[k])
  if (!persona.nombre.trim()) errPersona.nombre = 'Requerido'
  if (!persona.apellido_pat.trim()) errPersona.apellido_pat = 'Requerido'
  if (!persona.ci.trim() || isNaN(Number(persona.ci))) errPersona.ci = 'CI numérico requerido'
  if (!persona.email.trim()) errPersona.email = 'Requerido'
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(persona.email)) errPersona.email = 'Email inválido'
  return Object.keys(errPersona).length === 0
}

// ─── Navigation ──────────────────────────────────────────────────────────
function nextStep() {
  if (currentStep.value === 1 && !validateAccount()) return
  if (currentStep.value === 2 && !validatePersona()) return
  currentStep.value++
}

function prevStep() {
  if (currentStep.value > 1) currentStep.value--
}

// ─── Add career ──────────────────────────────────────────────────────────
function addCarrera() {
  pickerError.value = ''
  if (!pickerCarreraId.value) {
    pickerError.value = 'Selecciona una carrera'
    return
  }
  const found = carreras.value.find(c => c.id_carrera === Number(pickerCarreraId.value))
  if (!found) return
  selectedCarreras.value.push({
    carreraId: found.id_carrera,
    nombre: found.nombre_carrera,
    matricula: pickerMatricula.value.trim(),
  })
  pickerCarreraId.value = ''
  pickerMatricula.value = ''
}

function removeCarrera(carreraId: number) {
  selectedCarreras.value = selectedCarreras.value.filter(c => c.carreraId !== carreraId)
}

// ─── Submit ───────────────────────────────────────────────────────────────
async function handleSubmit() {
  submitError.value = ''
  submitting.value = true
  try {
    const payload = {
      username: account.username.trim(),
      password: account.password,
      persona: {
        nombre: persona.nombre.trim(),
        apellido_pat: persona.apellido_pat.trim(),
        apellido_mat: persona.apellido_mat.trim() || undefined,
        ci: Number(persona.ci),
        celular: persona.celular.trim() || undefined,
        email: persona.email.trim(),
      },
      userCarreras: selectedCarreras.value.length
        ? selectedCarreras.value.map(c => ({
          carreraId: c.carreraId,
          matricula: c.matricula || undefined,
        }) as UserCarreraItem)
        : undefined,
    }
    await estudianteService.register(payload)
    currentStep.value = 4 // success screen
  } catch (e: unknown) {
    // const msg = e instanceof Error ? e.message : 'No se pudo completar el registro'
    let msg = 'No se pudo completar el registro'

    if (typeof e === 'object' && e !== null && 'response' in e) {
      const err = e as any
      msg = err.response?.data?.message || msg
      // console.log("BACKEND 👉", err.response?.data)
    } else if (e instanceof Error) {
      msg = e.message
    }
    // Try to map to field-level errors
    const lower = msg.toLowerCase()
    if (lower.includes('username')) {
      currentStep.value = 1
      errAccount.username = msg
    } else if (lower.includes('ci')) {
      currentStep.value = 2
      errPersona.ci = msg
    } else if (lower.includes('email')) {
      currentStep.value = 2
      errPersona.email = msg
    } else {
      submitError.value = msg
    }
  } finally {
    submitting.value = false
  }
}

// ─── Password strength ───────────────────────────────────────────────────
const passwordStrength = computed(() => {
  const p = account.password
  if (!p) return { score: 0, label: '', color: '' }
  let score = 0
  if (p.length >= 6) score++
  if (p.length >= 10) score++
  if (/[A-Z]/.test(p)) score++
  if (/[0-9]/.test(p)) score++
  if (/[^A-Za-z0-9]/.test(p)) score++
  const labels = ['', 'Muy débil', 'Débil', 'Aceptable', 'Fuerte', 'Muy fuerte']
  const colors = ['', 'bg-red-500', 'bg-orange-400', 'bg-yellow-400', 'bg-emerald-400', 'bg-emerald-600']
  return { score, label: labels[score] ?? '', color: colors[score] ?? '' }
})
</script>

<template>
  <div
    class="min-h-screen bg-linear-to-br from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center p-4">

    <!-- Background blobs -->
    <div class="fixed inset-0 pointer-events-none overflow-hidden">
      <div class="absolute -top-40 -left-40 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl" />
      <div class="absolute -bottom-32 -right-32 w-96 h-96 bg-violet-600/10 rounded-full blur-3xl" />
    </div>

    <div class="relative w-full max-w-lg">

      <!-- Logo header -->
      <div class="flex items-center justify-between mb-6">
        <div class="flex items-center gap-2.5">
          <div class="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center shadow-lg shadow-indigo-900/40">
            <svg class="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
            </svg>
          </div>
          <span class="font-display text-white font-bold text-lg tracking-tight">SIGEB</span>
        </div>
        <button class="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors"
          @click="router.push('/login')">
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M15 19l-7-7 7-7" stroke-linecap="round" />
          </svg>
          Volver al login
        </button>
      </div>

      <!-- Card -->
      <div class="bg-white/5 border border-white/10 rounded-2xl backdrop-blur-md overflow-hidden">

        <!-- ══ SUCCESS SCREEN ══ -->
        <Transition name="fade" mode="out-in">
          <div v-if="currentStep === 4" key="success" class="p-10 flex flex-col items-center text-center gap-4">
            <div
              class="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center">
              <svg class="w-8 h-8 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                stroke-width="2">
                <path d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" stroke-linecap="round"
                  stroke-linejoin="round" />
              </svg>
            </div>
            <div>
              <h2 class="text-xl font-semibold text-white mb-2">¡Registro exitoso!</h2>
              <p class="text-slate-400 text-sm leading-relaxed max-w-xs mx-auto">
                Tu cuenta ha sido creada correctamente. Ya puedes iniciar sesión con tu usuario
                <span class="text-indigo-300 font-mono font-medium">{{ account.username }}</span>.
              </p>
            </div>
            <div v-if="selectedCarreras.length"
              class="w-full bg-white/5 rounded-xl p-3 border border-white/10 text-left">
              <p class="text-xs text-slate-400 mb-2 font-medium">Carreras asignadas</p>
              <div class="space-y-1">
                <div v-for="c in selectedCarreras" :key="c.carreraId"
                  class="flex items-center gap-2 text-sm text-slate-300">
                  <svg class="w-3.5 h-3.5 text-emerald-400 shrink-0" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" stroke-width="2.5">
                    <path d="M5 13l4 4L19 7" stroke-linecap="round" stroke-linejoin="round" />
                  </svg>
                  {{ c.nombre }}
                  <span v-if="c.matricula" class="text-slate-500 font-mono text-xs">· {{ c.matricula }}</span>
                </div>
              </div>
            </div>
            <button
              class="mt-2 w-full h-10 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-500 transition-colors"
              @click="router.push('/login')">
              Ir al login
            </button>
          </div>

          <!-- ══ FORM STEPS ══ -->
          <div v-else key="form">
            <!-- Progress header -->
            <div class="px-6 pt-6 pb-4 border-b border-white/8">
              <div class="flex items-center justify-between mb-4">
                <div>
                  <h2 class="text-lg font-semibold text-white">Crear cuenta de estudiante</h2>
                  <p class="text-slate-400 text-xs mt-0.5">Paso {{ currentStep }} de {{ TOTAL_STEPS }}</p>
                </div>
              </div>

              <!-- Step indicators -->
              <div class="flex items-center gap-2">
                <template v-for="(step, idx) in steps" :key="step.n">
                  <div class="flex items-center gap-2">
                    <div
                      class="w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 transition-all duration-300"
                      :class="currentStep > step.n
                        ? 'bg-emerald-500 text-white'
                        : currentStep === step.n
                          ? 'bg-indigo-500 text-white'
                          : 'bg-white/10 text-slate-500'">
                      <svg v-if="currentStep > step.n" class="w-3 h-3" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" stroke-width="3">
                        <path d="M5 13l4 4L19 7" stroke-linecap="round" stroke-linejoin="round" />
                      </svg>
                      <span v-else>{{ step.n }}</span>
                    </div>
                    <span class="text-xs hidden sm:block"
                      :class="currentStep === step.n ? 'text-white font-medium' : 'text-slate-500'">
                      {{ step.label }}
                    </span>
                  </div>
                  <div v-if="idx < steps.length - 1" class="flex-1 h-px transition-colors duration-300"
                    :class="currentStep > step.n ? 'bg-emerald-500/50' : 'bg-white/10'" />
                </template>
              </div>
            </div>

            <!-- Step content -->
            <div class="p-6">
              <Transition name="slide-up" mode="out-in">

                <!-- ── STEP 1: Account ── -->
                <div v-if="currentStep === 1" key="s1" class="space-y-4">
                  <div>
                    <h3 class="text-base font-medium text-white mb-0.5">Datos de tu cuenta</h3>
                    <p class="text-xs text-slate-400">Con estos datos podrás iniciar sesión</p>
                  </div>

                  <!-- Username -->
                  <div>
                    <label class="block text-xs font-medium text-slate-300 mb-1">
                      Nombre de usuario <span class="text-red-400">*</span>
                    </label>
                    <input v-model="account.username" type="text" placeholder="ej. maria.lopez" autocomplete="username" minlength="4" maxlength="15"
                      class="w-full h-10 px-3 text-sm rounded-lg border text-white placeholder:text-slate-500 bg-white/6 outline-none transition-all focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500/50"
                      :class="errAccount.username ? 'border-red-500/60' : 'border-white/10'"
                      @input="delete errAccount.username" />
                    <p v-if="errAccount.username" class="text-xs text-red-400 mt-1">{{ errAccount.username }}</p>
                    <p v-else class="text-xs text-slate-500 mt-1">Solo letras, números, puntos y guiones</p>
                  </div>

                  <!-- Password -->
                  <div>
                    <label class="block text-xs font-medium text-slate-300 mb-1">
                      Contraseña <span class="text-red-400">*</span>
                    </label>
                    <input v-model="account.password" type="password" placeholder="Mínimo 6 caracteres"  minlength="6" maxlength="20"
                      autocomplete="new-password"
                      class="w-full h-10 px-3 text-sm rounded-lg border text-white placeholder:text-slate-500 bg-white/6 outline-none transition-all focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500/50"
                      :class="errAccount.password ? 'border-red-500/60' : 'border-white/10'"
                      @input="delete errAccount.password" />
                    <!-- Strength bar -->
                    <div v-if="account.password" class="mt-2 space-y-1">
                      <div class="flex gap-1">
                        <div v-for="i in 5" :key="i" class="h-1 flex-1 rounded-full transition-all duration-300"
                          :class="i <= passwordStrength.score ? passwordStrength.color : 'bg-white/10'" />
                      </div>
                      <p class="text-xs" :class="passwordStrength.score >= 4 ? 'text-emerald-400' : 'text-slate-400'">
                        {{ passwordStrength.label }}
                      </p>
                    </div>
                    <p v-if="errAccount.password" class="text-xs text-red-400 mt-1">{{ errAccount.password }}</p>
                  </div>

                  <!-- Confirm password -->
                  <div>
                    <label class="block text-xs font-medium text-slate-300 mb-1">
                      Confirmar contraseña <span class="text-red-400">*</span>
                    </label>
                    <input v-model="account.confirmPassword" type="password" placeholder="Repite tu contraseña"
                      autocomplete="new-password"  minlength="6" maxlength="20"
                      class="w-full h-10 px-3 text-sm rounded-lg border text-white placeholder:text-slate-500 bg-white/6 outline-none transition-all focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500/50"
                      :class="errAccount.confirmPassword ? 'border-red-500/60' : 'border-white/10'"
                      @input="delete errAccount.confirmPassword" />
                    <p v-if="errAccount.confirmPassword" class="text-xs text-red-400 mt-1">{{ errAccount.confirmPassword
                    }}</p>
                  </div>
                </div>

                <!-- ── STEP 2: Personal data ── -->
                <div v-else-if="currentStep === 2" key="s2" class="space-y-4">
                  <div>
                    <h3 class="text-base font-medium text-white mb-0.5">Datos personales</h3>
                    <p class="text-xs text-slate-400">Información de identificación del estudiante</p>
                  </div>

                  <div class="grid grid-cols-2 gap-3">
                    <!-- Nombre -->
                    <div>
                      <label class="block text-xs font-medium text-slate-300 mb-1">Nombre <span
                          class="text-red-400">*</span></label>
                      <input v-model="persona.nombre" type="text" placeholder="Carlos" maxlength="20"
                        class="w-full h-9 px-3 text-sm rounded-lg border text-white placeholder:text-slate-500 bg-white/6 outline-none transition-all focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500/50"
                        :class="errPersona.nombre ? 'border-red-500/60' : 'border-white/10'"
                        @input="delete errPersona.nombre" />
                      <p v-if="errPersona.nombre" class="text-xs text-red-400 mt-0.5">{{ errPersona.nombre }}</p>
                    </div>

                    <!-- CI -->
                    <div>
                      <label class="block text-xs font-medium text-slate-300 mb-1">CI <span
                          class="text-red-400">*</span></label>
                      <input v-model="persona.ci" type="text" placeholder="7564823" inputmode="numeric" maxlength="10"
                        class="w-full h-9 px-3 text-sm rounded-lg border text-white placeholder:text-slate-500 bg-white/6 outline-none transition-all focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500/50"
                        :class="errPersona.ci ? 'border-red-500/60' : 'border-white/10'"
                         @input="
                            persona.ci = persona.ci.replace(/\D/g, '').slice(0, 10);
                            delete errPersona.ci;
                          " />
                      <p v-if="errPersona.ci" class="text-xs text-red-400 mt-0.5">{{ errPersona.ci }}</p>
                    </div>

                    <!-- Apellido paterno -->
                    <div>
                      <label class="block text-xs font-medium text-slate-300 mb-1">Ap. Paterno <span
                          class="text-red-400">*</span></label>
                      <input v-model="persona.apellido_pat" type="text" placeholder="Ramos" maxlength="25"
                        class="w-full h-9 px-3 text-sm rounded-lg border text-white placeholder:text-slate-500 bg-white/6 outline-none transition-all focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500/50"
                        :class="errPersona.apellido_pat ? 'border-red-500/60' : 'border-white/10'"
                        @input="delete errPersona.apellido_pat" />
                      <p v-if="errPersona.apellido_pat" class="text-xs text-red-400 mt-0.5">{{ errPersona.apellido_pat
                      }}</p>
                    </div>

                    <!-- Apellido materno -->
                    <div>
                      <label class="block text-xs font-medium text-slate-300 mb-1">Ap. Materno</label>
                      <input v-model="persona.apellido_mat" type="text" placeholder="Vargas" maxlength="25"
                        class="w-full h-9 px-3 text-sm rounded-lg border border-white/10 text-white placeholder:text-slate-500 bg-white/6 outline-none transition-all focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500/50" />
                    </div>

                    <!-- Email -->
                    <div class="col-span-2">
                      <label class="block text-xs font-medium text-slate-300 mb-1">Email institucional <span
                          class="text-red-400">*</span></label>
                      <input v-model="persona.email" type="email" placeholder="carlos.ramos@estudiante.edu" maxlength="30"
                        class="w-full h-9 px-3 text-sm rounded-lg border text-white placeholder:text-slate-500 bg-white/6 outline-none transition-all focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500/50"
                        :class="errPersona.email ? 'border-red-500/60' : 'border-white/10'"
                        @input="delete errPersona.email" />
                      <p v-if="errPersona.email" class="text-xs text-red-400 mt-0.5">{{ errPersona.email }}</p>
                    </div>

                    <!-- Celular -->
                    <div class="col-span-2">
                      <label class="block text-xs font-medium text-slate-300 mb-1">Celular</label>
                      <input v-model="persona.celular" type="text"
                        inputmode="numeric"
                        maxlength="15"
                        placeholder="73456789"
                        @input="persona.celular = persona.celular.replace(/\D/g, '').slice(0, 15)"
                        class="w-full h-9 px-3 text-sm rounded-lg border border-white/10 text-white placeholder:text-slate-500 bg-white/6 outline-none transition-all focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500/50" />
                    </div>
                  </div>
                </div>

                <!-- ── STEP 3: Carreras ── -->
                <div v-else-if="currentStep === 3" key="s3" class="space-y-4">
                  <div>
                    <h3 class="text-base font-medium text-white mb-0.5">Asignación de carreras</h3>
                    <p class="text-xs text-slate-400">Opcional — puedes agregar tus carreras ahora o más tarde</p>
                  </div>

                  <!-- Career picker -->
                  <div class="bg-white/5 rounded-xl border border-white/10 p-4 space-y-3">
                    <p class="text-xs font-medium text-slate-300">Agregar carrera</p>

                    <!-- Loading state -->
                    <div v-if="carrerasLoading" class="flex items-center gap-2 text-xs text-slate-400">
                      <svg class="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Cargando carreras…
                    </div>

                    <!-- Error state -->
                    <div v-else-if="carrerasError" class="text-xs text-amber-400 flex items-center gap-1.5">
                      <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path
                          d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
                          stroke-linecap="round" stroke-linejoin="round" />
                      </svg>
                      No se pudieron cargar las carreras
                    </div>

                    <!-- Picker UI -->
                    <template v-else>
                      <div class="flex gap-2">
                        <select v-model="pickerCarreraId"
                          class="flex-1 h-9 px-3 text-sm rounded-lg border border-white/10 bg-white/6 text-white outline-none transition-all focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500/50"
                          :class="pickerError ? 'border-red-500/60' : ''">
                          <option value="">Seleccionar carrera…</option>
                          <option v-for="c in availableCarreras" :key="c.id_carrera" :value="c.id_carrera"
                            class="bg-slate-800 text-white">
                            {{ c.nombre_carrera }}
                            <template v-if="c.codigo_carrera"> ({{ c.codigo_carrera }})</template>
                          </option>
                        </select>
                      </div>

                      <div class="flex gap-2">
                        <input v-model="pickerMatricula" type="text" placeholder="Matrícula (opcional)" 
                          inputmode="numeric"
                          maxlength="15"
                          @input="pickerMatricula = pickerMatricula.replace(/\D/g, '').slice(0, 15)"
                          class="flex-1 h-9 px-3 text-sm rounded-lg border border-white/10 bg-white/6 text-white placeholder:text-slate-500 outline-none transition-all focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500/50" />
                        <button
                          class="h-9 px-4 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-500 transition-colors disabled:opacity-50 shrink-0"
                          :disabled="!pickerCarreraId" @click="addCarrera">
                          Agregar
                        </button>
                      </div>
                      <p v-if="pickerError" class="text-xs text-red-400">{{ pickerError }}</p>
                    </template>
                  </div>

                  <!-- Selected careers list -->
                  <div v-if="selectedCarreras.length" class="space-y-2">
                    <p class="text-xs font-medium text-slate-400">Carreras seleccionadas</p>
                    <TransitionGroup name="list" tag="div" class="space-y-2">
                      <div v-for="c in selectedCarreras" :key="c.carreraId"
                        class="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                        <svg class="w-4 h-4 text-emerald-400 shrink-0" viewBox="0 0 24 24" fill="none"
                          stroke="currentColor" stroke-width="1.5">
                          <path
                            d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5"
                            stroke-linecap="round" stroke-linejoin="round" />
                        </svg>
                        <div class="flex-1 min-w-0">
                          <p class="text-sm text-white font-medium truncate">{{ c.nombre }}</p>
                          <p v-if="c.matricula" class="text-xs text-slate-400 font-mono">{{ c.matricula }}</p>
                        </div>
                        <button
                          class="w-6 h-6 flex items-center justify-center rounded text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                          @click="removeCarrera(c.carreraId)">
                          <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                            stroke-width="2">
                            <path d="M6 18L18 6M6 6l12 12" stroke-linecap="round" />
                          </svg>
                        </button>
                      </div>
                    </TransitionGroup>
                  </div>

                  <div v-else class="flex flex-col items-center gap-2 py-4 text-slate-500">
                    <svg class="w-8 h-8 opacity-50" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                      stroke-width="1.5">
                      <path
                        d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5"
                        stroke-linecap="round" stroke-linejoin="round" />
                    </svg>
                    <p class="text-xs">Sin carreras seleccionadas — puedes continuar sin asignar</p>
                  </div>

                  <!-- Submit error -->
                  <Transition name="slide-up">
                    <div v-if="submitError"
                      class="flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                      <svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                        stroke-width="2">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8" x2="12" y2="12" />
                        <line x1="12" y1="16" x2="12.01" y2="16" />
                      </svg>
                      {{ submitError }}
                    </div>
                  </Transition>
                </div>

              </Transition>
            </div>

            <!-- Navigation footer -->
            <div class="px-6 pb-6 flex gap-3">
              <button v-if="currentStep > 1"
                class="h-10 px-4 rounded-lg border border-white/10 text-slate-300 text-sm hover:bg-white/5 transition-colors"
                @click="prevStep">
                Atrás
              </button>

              <button v-if="currentStep < TOTAL_STEPS"
                class="flex-1 h-10 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-500 transition-colors"
                @click="nextStep">
                Continuar
              </button>

              <button v-else
                class="flex-1 h-10 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-500 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                :disabled="submitting" @click="handleSubmit">
                <svg v-if="submitting" class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                {{ submitting ? 'Registrando...' : 'Crear mi cuenta' }}
              </button>
            </div>
          </div>
        </Transition>
      </div>

      <!-- Link to login -->
      <p v-if="currentStep !== 4" class="text-center text-xs text-slate-500 mt-4">
        ¿Ya tienes cuenta?
        <button class="text-indigo-400 hover:text-indigo-300 transition-colors ml-1" @click="router.push('/login')">
          Inicia sesión
        </button>
      </p>
    </div>
  </div>
</template>

<style scoped>
.list-enter-active,
.list-leave-active {
  transition: all 0.25s ease;
}

.list-enter-from {
  opacity: 0;
  transform: translateY(-6px);
}

.list-leave-to {
  opacity: 0;
  transform: translateX(10px);
}
</style>