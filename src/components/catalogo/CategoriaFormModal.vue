<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import SButton from '@/components/ui/SButton.vue'
import SInput from '@/components/ui/SInput.vue'
import { useUiStore } from '@/stores/ui.store'
import {
  CategoriaApiError,
  actualizarCategoria,
  crearCategoria,
  type CategoriaConConteo,
  type CategoriaPayload,
} from '@/services/categorias.service'
import { validarSoloLetras, validarSoloNumeros } from '@/utils/validators'

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    categoria?: CategoriaConConteo | null   // con valor → modo edición
    initialNombre?: string
  }>(),
  { categoria: null, initialNombre: '' }
)
const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void
  (e: 'saved', categoria: CategoriaConConteo, modo: 'crear' | 'editar'): void
}>()

const ui = useUiStore()
const MAX_NOMBRE = 150
const MAX_DESC = 500
const MAX_DEWEY = 20

const form = ref({ nombre: '', descripcion: '', dewey: '' })
const errores = ref({ nombre: '', descripcion: '', dewey: '' })
const guardando = ref(false)
const dialogRef = ref<HTMLElement | null>(null)

const esEdicion = computed(() => !!props.categoria)

watch(
  () => props.modelValue,
  async (abierto) => {
    if (!abierto) return
    form.value = {
      nombre: props.categoria?.nombre_categoria ?? props.initialNombre ?? '',
      descripcion: props.categoria?.descripcion ?? '',
      dewey: props.categoria?.codigo_dewey ?? '',
    }
    errores.value = { nombre: '', descripcion: '', dewey: '' }
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
  const n = form.value.nombre.trim()
  const d = form.value.descripcion.trim()
  const w = form.value.dewey.trim()
  errores.value = {
    nombre: !n ? 'El nombre es obligatorio' : n.length > MAX_NOMBRE ? `Máximo ${MAX_NOMBRE} caracteres` : '',
    descripcion: d.length > MAX_DESC ? `Máximo ${MAX_DESC} caracteres` : '',
    dewey: w.length > MAX_DEWEY ? `Máximo ${MAX_DEWEY} caracteres` : '',
  }
  return !Object.values(errores.value).some(Boolean)
}

async function guardar() {
  if (!validar()) return
  // PUT completo: siempre los tres campos; vacío → null (no choca con la unicidad de Dewey)
  const payload: CategoriaPayload = {
    nombre_categoria: form.value.nombre.trim(),
    descripcion: form.value.descripcion.trim() || null,
    codigo_dewey: form.value.dewey.trim() || null,
  }
  guardando.value = true
  try {
    if (props.categoria) {
      const res = await actualizarCategoria(props.categoria.id_categoria, payload)
      ui.toast.success('Categoría actualizada', `«${payload.nombre_categoria}» se guardó correctamente`)
      emit('saved', { librosCount: props.categoria.librosCount, ...res }, 'editar')
    } else {
      const res = await crearCategoria(payload)
      ui.toast.success('Categoría creada', `«${payload.nombre_categoria}» fue registrada`)
      emit('saved', { librosCount: 0, ...res }, 'crear')
    }
    emit('update:modelValue', false)
  } catch (e) {
    const status = e instanceof CategoriaApiError ? e.status : undefined
    const msg = e instanceof Error && e.message ? e.message : 'No se pudo guardar la categoría'
    if (status === 400 || status === 409) {
      if (/dewey/i.test(msg)) errores.value.dewey = msg
      else errores.value.nombre = msg
    } else {
      ui.toast.error('Error', msg)
    }
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
        aria-labelledby="cat-modal-title"
        class="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto"
        @keydown.esc.stop="cerrar"
      >
        <h2 id="cat-modal-title" class="text-lg font-semibold text-slate-900 mb-4">
          {{ esEdicion ? 'Editar categoría' : 'Nueva categoría' }}
        </h2>

        <form class="space-y-4" @submit.prevent="guardar">
          <SInput
            v-model="form.nombre"
            @input="form.nombre = validarSoloLetras(form.nombre)"
            label="Nombre"
            placeholder="Ej: Ciencias de la Educación"
            :required="true"
            :error-message="errores.nombre"
            :help-text="`${form.nombre.length}/${MAX_NOMBRE} caracteres`"
            @update:model-value="errores.nombre = ''"
            />
            <SInput
            v-model="form.dewey"
            @input="form.dewey = validarSoloNumeros(form.nombre)"
            label="Código Dewey (opcional)"
            placeholder="Ej: 370"
            :error-message="errores.dewey"
            :help-text="errores.dewey ? undefined : 'Debe ser único. Sin código o no numérico, cuenta como “Sin clasificar”.'"
            @update:model-value="errores.dewey = ''"
          />
          <SInput
            v-model="form.descripcion"
            type="textarea"
            label="Descripción (opcional)"
            placeholder="Breve descripción de la categoría"
            :error-message="errores.descripcion"
            :help-text="`${form.descripcion.length}/${MAX_DESC} caracteres`"
            @update:model-value="errores.descripcion = ''"
          />
          <div class="flex justify-end gap-2 pt-2">
            <SButton type="button" variant="secondary" :disabled="guardando" @click="cerrar">
              Cancelar
            </SButton>
            <SButton type="submit" variant="primary" :loading="guardando">
              {{ esEdicion ? 'Guardar cambios' : 'Crear categoría' }}
            </SButton>
          </div>
        </form>
      </div>
    </div>
  </Teleport>
</template>