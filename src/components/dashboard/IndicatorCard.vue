<script setup lang="ts">
import type { Component } from 'vue'
import SCard from '@/components/ui/SCard.vue'
import { formatNumber } from '@/utils/format';

defineProps<{
  label: string
  value: number | null
  sub?: string
  icon: Component
  color: string
  ring: string
  alert?: boolean
}>()
</script>

<template>
  <SCard padding="lg" class="relative overflow-hidden">
    <span v-if="alert" class="absolute top-3 right-3 w-2 h-2 rounded-full bg-red-500 animate-pulse" aria-hidden="true" />
    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0">
        <p class="text-xs font-medium text-slate-500 leading-tight">{{ label }}</p>
        <p class="text-2xl font-bold text-slate-900 mt-1 tabular-nums">{{ formatNumber(value) }}</p>
        <p v-if="sub" class="text-xs text-slate-400 mt-1">{{ sub }}</p>
      </div>
      <div class="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ring-4" :class="[color, ring]">
        <component :is="icon" />
      </div>
    </div>
  </SCard>
</template>