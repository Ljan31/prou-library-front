<script setup lang="ts">
withDefaults(defineProps<{
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info'
  size?: 'sm' | 'md'
  dot?: boolean
}>(), {
  variant: 'default',
  size: 'sm'
})
</script>

<template>
  <span class="inline-flex items-center gap-1 font-medium rounded-full" :class="[
    size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-2.5 py-1',
    variant === 'primary' ? 'bg-primary-100 text-primary-700' :
      variant === 'success' ? 'bg-emerald-100 text-emerald-700' :
        variant === 'warning' ? 'bg-amber-100 text-amber-700' :
          variant === 'danger' ? 'bg-red-100 text-red-700' :
            variant === 'info' ? 'bg-blue-100 text-blue-700' :
              'bg-slate-100 text-slate-600'
  ]">
    <span v-if="dot" class="w-1.5 h-1.5 rounded-full" :class="variant === 'primary' ? 'bg-primary-600' :
        variant === 'success' ? 'bg-emerald-600' :
          variant === 'warning' ? 'bg-amber-500' :
            variant === 'danger' ? 'bg-red-600' :
              variant === 'info' ? 'bg-blue-600' :
                'bg-slate-500'
      "></span>
    <slot></slot>
  </span>
</template>
