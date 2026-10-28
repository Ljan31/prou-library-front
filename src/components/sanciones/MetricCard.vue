<script setup lang="ts">
import SCard from '@/components/ui/SCard.vue'
import SSkeleton from '@/components/feedback/SSkeleton.vue'

type Tone = 'red' | 'amber' | 'indigo' | 'slate'
type Icon = 'alert' | 'money' | 'book' | 'lock'

withDefaults(
  defineProps<{
    label: string
    value: string | number
    hint?: string
    tone?: Tone
    icon: Icon
    loading?: boolean
  }>(),
  { tone: 'slate', loading: false },
)

const TONES: Record<Tone, { box: string; icon: string; value: string }> = {
  red: { box: 'bg-red-100', icon: 'text-red-600', value: 'text-red-600' },
  amber: { box: 'bg-amber-100', icon: 'text-amber-600', value: 'text-amber-600' },
  indigo: { box: 'bg-indigo-100', icon: 'text-indigo-600', value: 'text-indigo-600' },
  slate: { box: 'bg-slate-100', icon: 'text-slate-600', value: 'text-slate-700' },
}

const ICONS: Record<Icon, string[]> = {
  alert: ['M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z', 'M12 9v4', 'M12 17h.01'],
  money: ['M12 1v22', 'M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6'],
  book: ['M4 19.5A2.5 2.5 0 016.5 17H20', 'M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z'],
  lock: ['M5 11h14a2 2 0 012 2v7a2 2 0 01-2 2H5a2 2 0 01-2-2v-7a2 2 0 012-2z', 'M7 11V7a5 5 0 0110 0v4'],
}
</script>

<template>
  <SCard padding="md">
    <div class="flex items-center gap-3">
      <div :class="['w-10 h-10 rounded-xl flex items-center justify-center shrink-0', TONES[tone].box]">
        <svg :class="['w-5 h-5', TONES[tone].icon]" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path v-for="d in ICONS[icon]" :key="d" :d="d" />
        </svg>
      </div>
      <div class="min-w-0">
        <p class="text-xs text-slate-500 font-medium">{{ label }}</p>
        <SSkeleton v-if="loading" width="4rem" height="1.5rem" class="mt-0.5" />
        <template v-else>
          <p :class="['text-2xl font-bold', TONES[tone].value]">{{ value }}</p>
          <p v-if="hint" class="text-xs text-slate-400">{{ hint }}</p>
        </template>
      </div>
    </div>
  </SCard>
</template>
