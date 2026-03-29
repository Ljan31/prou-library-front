<script setup lang="ts">
withDefaults(defineProps<{
  width?:   string
  height?:  string
  rounded?: boolean
}>(), { rounded: false })
</script>

<template>
  <div
    class="skeleton"
    :class="rounded ? 'rounded-full' : 'rounded-lg'"
    :style="{ width: width ?? '100%', height: height ?? '1rem' }"
  />
</template>
