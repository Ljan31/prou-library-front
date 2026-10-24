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

  // Creación y aprobación
  if (accion.startsWith('CREAR')) return 'success'
  if (accion.startsWith('APROBAR')) return 'success'

  // Actualizaciones y cambios
  if (accion.startsWith('ACTUALIZAR')) return 'info'
  if (accion === 'CAMBIAR') return 'info'

  // Eliminación, rechazo y sanciones
  if (accion.startsWith('ELIMINAR')) return 'danger'
  if (accion.startsWith('DARBAJA')) return 'danger'
  if (accion.startsWith('RECHAZAR')) return 'danger'
  if (accion.startsWith('SANCIONAR')) return 'danger'

  // Advertencias e incidencias
  if (accion.startsWith('ANULAR')) return 'warning'
  if (accion.startsWith('REPORTAR')) return 'warning'
  if (accion.startsWith('REMOVER')) return 'warning'

  // Acciones especializadas
  if (accion.startsWith('RESTABLECER')) return 'purple'
  if (accion.startsWith('SUBIR')) return 'purple'
  if (accion.startsWith('RENOVAR')) return 'teal'
  if (accion.startsWith('CONVERTIR')) return 'teal'
  if (accion.startsWith('ASIGNAR')) return 'primary'

  return 'default'
})
</script>

<template>
  <SBadge :variant="variant" :dot="true">
    {{ label }}
  </SBadge>
</template>