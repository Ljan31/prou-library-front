<script setup lang="ts">
import type { Biblioteca } from '@/services/bibliotecas.service'

const model = defineModel<boolean>({ required: true })

defineProps<{
  biblioteca: Biblioteca
}>()
</script>

<template>
  <Transition
    enter-active-class="transition duration-200 ease-out"
    enter-from-class="opacity-0 scale-95"
    enter-to-class="opacity-100 scale-100"
    leave-active-class="transition duration-150 ease-in"
    leave-from-class="opacity-100 scale-100"
    leave-to-class="opacity-0 scale-95"
  >
    <div
      v-if="model"
      class="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <!-- Backdrop -->
      <div
        class="absolute inset-0 bg-black/50 backdrop-blur-sm"
        @click="model = false"
      />

      <!-- Modal -->
      <div
        class="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden"
      >
        <!-- Header -->
        <div
          class="bg-gradient-to-r from-primary-600 to-primary-700 px-6 py-5 text-white"
        >
          <div class="flex items-start justify-between">
            <div>
              <h2 class="text-xl font-bold">
                Encargados de Biblioteca
              </h2>

              <p class="mt-1 text-primary-100 text-sm">
                {{ biblioteca.nombre }}
              </p>
            </div>

            <button
              @click="model = false"
              class="p-2 rounded-lg hover:bg-white/10 transition-colors"
            >
              <svg
                class="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        <!-- Body -->
        <div class="p-6">
          <!-- Stats -->
          <div
            class="mb-5 flex items-center gap-3 rounded-xl bg-gray-50 border border-gray-200 px-4 py-3"
          >
            <div
              class="w-10 h-10 rounded-lg bg-primary-100 flex items-center justify-center"
            >
              <svg
                class="w-5 h-5 text-primary-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M17 20h5V4H2v16h5m10 0v-2a4 4 0 00-8 0v2m8 0H9m4-8a4 4 0 100-8 4 4 0 000 8z"
                />
              </svg>
            </div>

            <div>
              <p class="text-sm text-gray-500">
                Encargados asignados
              </p>
              <p class="font-bold text-lg text-gray-800">
                {{ biblioteca.encargados?.length ?? 0 }}
              </p>
            </div>
          </div>

          <!-- Lista -->
          <div
            v-if="biblioteca.encargados?.length"
            class="space-y-3 max-h-[400px] overflow-y-auto pr-1"
          >
            <div
              v-for="enc in biblioteca.encargados"
              :key="enc.idUsuario"
              class="border border-gray-200 rounded-xl p-4 hover:border-primary-300 hover:bg-primary-50/30 transition-all"
            >
              <div class="flex items-center gap-4">
                <!-- Avatar -->
                <div
                  class="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold"
                >
                  {{ enc.nombreCompleto.charAt(0).toUpperCase() }}
                </div>

                <!-- Datos -->
                <div class="flex-1 min-w-0">
                  <h3 class="font-semibold text-gray-900 truncate">
                    {{ enc.nombreCompleto }}
                  </h3>

                  <p class="text-sm text-gray-500">
                    @{{ enc.username }}
                  </p>
                </div>

            
              </div>
            </div>
          </div>

          <!-- Empty -->
          <div
            v-else
            class="py-12 text-center"
          >
            <div
              class="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center"
            >
              <svg
                class="w-8 h-8 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="1.5"
                  d="M17 20h5V4H2v16h5m10 0v-2a4 4 0 00-8 0v2m8 0H9m4-8a4 4 0 100-8 4 4 0 000 8z"
                />
              </svg>
            </div>

            <p class="font-medium text-gray-600">
              No hay encargados asignados
            </p>

            <p class="text-sm text-gray-400 mt-1">
              Esta biblioteca aún no tiene responsables registrados.
            </p>
          </div>
        </div>

        <!-- Footer -->
        <div
          class="px-6 py-4 border-t border-gray-100 flex justify-end"
        >
          <button
            @click="model = false"
            class="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>