<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import SButton from '@/components/ui/SButton.vue'
import SInput from '@/components/ui/SInput.vue'
import { useUiStore } from '@/stores/ui.store'
import { autoresService, getErrorMessage, type Autor } from '@/services/autores.service'

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    autor?: Autor | null      // con valor → modo edición
    initialNombre?: string    // para precargar lo que el usuario ya escribió
  }>(),
  { autor: null, initialNombre: '' }
)
const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void
  (e: 'saved', autor: Autor, modo: 'crear' | 'editar'): void
}>()

const ui = useUiStore()
const MAX_NOMBRE = 200

const nombre = ref('')
const error = ref('')
const guardando = ref(false)
const dialogRef = ref<HTMLElement | null>(null)

const esEdicion = computed(() => !!props.autor)
const nombreLimpio = computed(() => nombre.value.trim())

// Cada vez que se abre: se reinicia el estado y se enfoca el input
watch(
  () => props.modelValue,
  async (abierto) => {
    if (!abierto) return
    nombre.value = props.autor?.nombre ?? props.initialNombre ?? ''
    error.value = ''
    await nextTick()
    dialogRef.value?.querySelector<HTMLInputElement>('input')?.focus()
  },
  { immediate: true }
)

function cerrar() {
  if (guardando.value) return
  emit('update:modelValue', false)
}

function validar(): boolean {
  if (!nombreLimpio.value) error.value = 'El nombre es obligatorio'
  else if (nombreLimpio.value.length > MAX_NOMBRE) error.value = `Máximo ${MAX_NOMBRE} caracteres`
  else error.value = ''
  return !error.value
}

async function guardar() {
  if (!validar()) return
  guardando.value = true
  try {
    if (props.autor) {
      const res = await autoresService.actualizar(props.autor.idAutor, nombreLimpio.value)
      ui.toast.success('Autor actualizado', res.message)
      emit('saved', res.data, 'editar')
    } else {
      const res = await autoresService.crear(nombreLimpio.value)
      ui.toast.success('Autor creado', res.message)
      emit('saved', res.data, 'crear')
    }
    emit('update:modelValue', false)
  } catch (e: any) {
    const status = e?.response?.status
    const msg = getErrorMessage(e, 'No se pudo guardar el autor')
    // 400 / 409 (p. ej. "Ya existe un autor con nombre: …") → dentro del campo
    if (status === 400 || status === 409) error.value = msg
    else ui.toast.error('Error', msg)
  } finally {
    guardando.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="modelValue"
      class="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      @click.self="cerrar"
    >
      <div
        ref="dialogRef"
        role="dialog"
        aria-modal="true"
        aria-labelledby="autor-modal-title"
        class="bg-white rounded-2xl shadow-xl w-full max-w-md p-6"
        @keydown.esc.stop="cerrar"
      >
        <h2 id="autor-modal-title" class="text-lg font-semibold text-slate-900 mb-4">
          {{ esEdicion ? 'Editar autor' : 'Nuevo autor' }}
        </h2>

        <form @submit.prevent="guardar">
          <SInput
            v-model="nombre"
            label="Nombre del autor"
            placeholder="Ej: Julio Cortázar"
            :required="true"
            :error-message="error"
            :help-text="`${nombre.length}/${MAX_NOMBRE} caracteres`"
            @update:model-value="error = ''"
          />
          <div class="flex justify-end gap-2 mt-6">
            <SButton type="button" variant="secondary" :disabled="guardando" @click="cerrar">
              Cancelar
            </SButton>
            <SButton type="submit" variant="primary" :loading="guardando">
              {{ esEdicion ? 'Guardar cambios' : 'Crear autor' }}
            </SButton>
          </div>
        </form>
      </div>
    </div>
  </Teleport>
</template>