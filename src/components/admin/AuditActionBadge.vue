<script setup lang="ts">
import { computed } from 'vue'
import { SBadge } from '@/components'
import { normAccion } from '@/utils/auditoria'

const props = defineProps<{
  accion: string | null | undefined
}>()

const label = computed(() => normAccion(props.accion) || 'DESCONOCIDA')

const variant = computed(() => {
  const accion = label.value

  if (accion.startsWith('CREAR')) return 'success'
  if (accion.startsWith('ACTUALIZAR')) return 'info'
  if (accion.startsWith('ELIMINAR')) return 'danger'
  if (accion.startsWith('ANULAR')) return 'warning'
  if (accion.startsWith('RESTABLECER')) return 'purple'
  if (accion.startsWith('SANCIONAR')) return 'danger'
  if (accion.startsWith('RENOVAR')) return 'teal'

  return 'default'
})
</script>

<template>
  <SBadge :variant="variant" :dot="true">
    {{ label }}
  </SBadge>
</template>