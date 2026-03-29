<script setup lang="ts">
withDefaults(defineProps<{
  variant?:   'default' | 'bordered' | 'elevated'
  padding?:   'none' | 'sm' | 'md' | 'lg'
  hoverable?: boolean
}>(), {
  variant: 'default',
  padding: 'md'
})
</script>

<template>
  <div
    class="bg-white rounded-xl transition-all duration-150"
    :class="[
      variant === 'bordered'  ? 'border border-slate-200' :
      variant === 'elevated'  ? 'shadow-md' :
      'border border-slate-100',
      padding === 'none' ? '' :
      padding === 'sm'   ? 'p-4' :
      padding === 'lg'   ? 'p-8' : 'p-5',
      hoverable ? 'hover:shadow-md hover:-translate-y-0.5 cursor-pointer' : '',
      'shadow-[0_2px_16px_rgba(0,0,0,0.04)]'
    ]"
  >
    <slot />
  </div>
</template>
