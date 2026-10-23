<script setup lang="ts">
withDefaults(defineProps<{
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'purple' | 'teal'
  size?: 'sm' | 'md'
  dot?: boolean
}>(), {
  variant: 'default',
  size: 'sm',
})
</script>

<template>
  <span
    class="inline-flex items-center gap-1 font-medium rounded-full"
    :class="[
      size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-2.5 py-1',
      {
        'bg-primary-100 text-primary-700': variant === 'primary',
        'bg-emerald-100 text-emerald-700': variant === 'success',
        'bg-amber-100 text-amber-700': variant === 'warning',
        'bg-red-100 text-red-700': variant === 'danger',
        'bg-blue-100 text-blue-700': variant === 'info',
        'bg-violet-100 text-violet-700': variant === 'purple',
        'bg-teal-100 text-teal-700': variant === 'teal',
        'bg-slate-100 text-slate-600': variant === 'default',
      },
    ]"
  >
    <span
      v-if="dot"
      class="w-1.5 h-1.5 rounded-full"
      :class="{
        'bg-primary-600': variant === 'primary',
        'bg-emerald-600': variant === 'success',
        'bg-amber-500': variant === 'warning',
        'bg-red-600': variant === 'danger',
        'bg-blue-600': variant === 'info',
        'bg-violet-600': variant === 'purple',
        'bg-teal-600': variant === 'teal',
        'bg-slate-500': variant === 'default',
      }"
    />
    <slot />
  </span>
</template>