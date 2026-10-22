
<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount } from 'vue'
import type { Biblioteca } from '@/services/bibliotecas.service'

const model = defineModel<boolean>({ required: true })

const props = defineProps<{
  biblioteca: Biblioteca
}>()

const encargados = computed(() => props.biblioteca.encargados ?? [])

const totalEncargados = computed(() => encargados.value.length)

function iniciales(nombre?: string) {
  if (!nombre?.trim()) return 'U'

  return nombre
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(palabra => palabra.charAt(0).toUpperCase())
    .join('')
}

function cerrarConEscape(event: KeyboardEvent) {
  if (event.key === 'Escape' && model.value) {
    model.value = false
  }
}

onMounted(() => {
  window.addEventListener('keydown', cerrarConEscape)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', cerrarConEscape)
})
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="model"
        class="fixed inset-0 z-50 flex items-center justify-center
               bg-slate-950/50 backdrop-blur-sm p-3 sm:p-6"
        @click.self="model = false"
      >
        <Transition
          appear
          enter-active-class="transition duration-200 ease-out"
          enter-from-class="opacity-0 translate-y-3 scale-[0.98]"
          enter-to-class="opacity-100 translate-y-0 scale-100"
          leave-active-class="transition duration-150 ease-in"
          leave-from-class="opacity-100 translate-y-0 scale-100"
          leave-to-class="opacity-0 translate-y-2 scale-[0.98]"
        >
          <section
            v-if="model"
            role="dialog"
            aria-modal="true"
            aria-labelledby="encargados-titulo"
            class="relative w-full max-w-2xl max-h-[90vh]
                   flex flex-col overflow-hidden rounded-2xl
                   bg-white shadow-2xl ring-1 ring-black/5"
          >
            <!-- Header -->
            <header
              class="relative overflow-hidden bg-gradient-to-br
                     from-indigo-700 via-indigo-600 to-violet-600
                     px-5 py-6 sm:px-7 sm:py-7 text-white"
            >
              <!-- Decoración -->
              <div
                class="absolute -right-8 -top-12 h-40 w-40
                       rounded-full bg-white/10"
              />
              <div
                class="absolute right-16 -bottom-16 h-36 w-36
                       rounded-full bg-white/5"
              />

              <div class="relative flex items-start justify-between gap-4">
                <div class="flex items-start gap-4 min-w-0">
                  <div
                    class="flex h-12 w-12 shrink-0 items-center
                           justify-center rounded-2xl border
                           border-white/20 bg-white/15 shadow-inner"
                  >
                    <svg
                      class="h-6 w-6"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      stroke-width="1.7"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M16 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2m16 0v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75M10 11a4 4 0 100-8 4 4 0 000 8z"
                      />
                    </svg>
                  </div>

                  <div class="min-w-0">
                    <p
                      class="mb-1 text-[11px] font-semibold uppercase
                             tracking-[0.16em] text-indigo-100"
                    >
                      Administración de biblioteca
                    </p>

                    <h2
                      id="encargados-titulo"
                      class="text-xl sm:text-2xl font-bold tracking-tight"
                    >
                      Encargados
                    </h2>

                    <p class="mt-1.5 text-sm text-indigo-100/90
                              break-words">
                      {{ biblioteca.nombre }}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  aria-label="Cerrar ventana"
                  @click="model = false"
                  class="shrink-0 rounded-xl p-2 text-white/80
                         hover:bg-white/15 hover:text-white
                         focus:outline-none focus:ring-2
                         focus:ring-white/70 transition-colors"
                >
                  <svg
                    class="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>

              <!-- Indicador -->
              <div class="relative mt-6 flex items-center gap-2">
                <span
                  class="inline-flex items-center gap-2 rounded-full
                         border border-white/20 bg-white/10
                         px-3 py-1.5 text-xs font-medium"
                >
                  <span class="h-2 w-2 rounded-full bg-emerald-300" />
                  {{ totalEncargados }}
                  {{ totalEncargados === 1
                    ? 'encargado asignado'
                    : 'encargados asignados' }}
                </span>
              </div>
            </header>

            <!-- Resumen -->
            <div class="border-b border-slate-100 bg-slate-50/80 px-5
                        py-4 sm:px-7">
              <div class="flex items-center justify-between gap-3">
                <div>
                  <h3 class="text-sm font-semibold text-slate-800">
                    Personal responsable
                  </h3>
                  <p class="mt-0.5 text-xs text-slate-500">
                    Usuarios vinculados a esta biblioteca.
                  </p>
                </div>

                <div
                  class="flex h-11 min-w-11 items-center justify-center
                         rounded-xl border border-indigo-100
                         bg-white px-3 text-lg font-bold text-indigo-700
                         shadow-sm"
                >
                  {{ totalEncargados }}
                </div>
              </div>
            </div>

            <!-- Contenido -->
            <div class="flex-1 overflow-y-auto px-5 py-5 sm:px-7">
              <!-- Lista -->
              <div v-if="totalEncargados" class="space-y-3">
                <article
                  v-for="(enc, index) in encargados"
                  :key="enc.idUsuario"
                  class="group flex items-center gap-3 sm:gap-4
                         rounded-2xl border border-slate-200
                         bg-white p-3.5 sm:p-4
                         transition-all duration-200
                         hover:border-indigo-200 hover:bg-indigo-50/30
                         hover:shadow-sm"
                >
                  <!-- Avatar -->
                  <div
                    class="relative flex h-12 w-12 shrink-0
                           items-center justify-center rounded-2xl
                           bg-gradient-to-br from-indigo-100 to-violet-100
                           text-sm font-bold text-indigo-700
                           ring-1 ring-indigo-100"
                  >
                    {{ iniciales(enc.nombreCompleto) }}

                    <span
                      class="absolute -bottom-1 -right-1
                             h-3.5 w-3.5 rounded-full
                             border-2 border-white bg-emerald-500"
                      :aria-label="`Encargado ${index + 1}`"
                    />
                  </div>

                  <!-- Datos -->
                  <div class="min-w-0 flex-1">
                    <h4
                      class="truncate text-sm font-semibold
                             text-slate-800 group-hover:text-indigo-700"
                    >
                      {{ enc.nombreCompleto || 'Usuario sin nombre' }}
                    </h4>

                    <div class="mt-1 flex min-w-0 items-center gap-1.5">
                      <svg
                        class="h-3.5 w-3.5 shrink-0 text-slate-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        stroke-width="1.8"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.5 20.1a7.5 7.5 0 0115 0A17.9 17.9 0 0112 22.5a17.9 17.9 0 01-7.5-2.4z"
                        />
                      </svg>

                      <p class="truncate text-xs text-slate-500">
                        @{{ enc.username || 'sin usuario' }}
                      </p>
                    </div>
                  </div>

                  <!-- Identificador -->
                  <div
                    class="hidden sm:flex shrink-0 items-center gap-1.5
                           rounded-lg bg-emerald-50 px-2.5 py-1.5
                           text-[11px] font-medium text-emerald-700"
                  >
                    <svg
                      class="h-3.5 w-3.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      stroke-width="2"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M5 12l4 4L19 6"
                      />
                    </svg>
                    Asignado
                  </div>
                </article>
              </div>

              <!-- Estado vacío -->
              <div
                v-else
                class="flex flex-col items-center justify-center
                       rounded-2xl border border-dashed border-slate-200
                       bg-slate-50/70 px-5 py-12 text-center"
              >
                <div
                  class="mb-4 flex h-16 w-16 items-center justify-center
                         rounded-2xl bg-white text-slate-400
                         shadow-sm ring-1 ring-slate-200"
                >
                  <svg
                    class="h-8 w-8"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    stroke-width="1.5"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="M16 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2m16 0v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75M10 11a4 4 0 100-8 4 4 0 000 8z"
                    />
                  </svg>
                </div>

                <h3 class="text-base font-semibold text-slate-800">
                  Sin encargados asignados
                </h3>

                <p class="mt-2 max-w-xs text-sm leading-6 text-slate-500">
                  Esta biblioteca todavía no tiene usuarios responsables
                  vinculados.
                </p>
              </div>
            </div>

            <!-- Footer -->
            <footer
              class="flex items-center justify-between gap-3
                     border-t border-slate-100 bg-white
                     px-5 py-4 sm:px-7"
            >
              <p class="hidden sm:block text-xs text-slate-400">
                Información de responsables de la biblioteca.
              </p>

              <button
                type="button"
                @click="model = false"
                class="w-full sm:w-auto rounded-xl bg-slate-900
                       px-5 py-2.5 text-sm font-semibold text-white
                       shadow-sm transition-colors hover:bg-slate-700
                       focus:outline-none focus:ring-2
                       focus:ring-slate-400 focus:ring-offset-2"
              >
                Cerrar
              </button>
            </footer>
          </section>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>
