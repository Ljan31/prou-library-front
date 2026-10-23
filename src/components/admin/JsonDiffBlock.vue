<script setup lang="ts">
import type { JsonLine, LineStatus, ParsedValue } from '@/utils/auditoria'

defineProps<{ title: string; parsed: ParsedValue; lines: JsonLine[] }>()

const rowClass: Record<LineStatus, string> = {
  same: '',
  container: '',
  changed: 'bg-amber-100 text-amber-900',
  added: 'bg-emerald-100 text-emerald-900',
  removed: 'bg-red-100 text-red-900',
}
const marker: Record<LineStatus, string> = { same: ' ', container: ' ', changed: '~', added: '+', removed: '−' }
const srText: Record<LineStatus, string> = { same: '', container: '', changed: 'Modificado: ', added: 'Agregado: ', removed: 'Eliminado: ' }
</script>

<template>
  <section class="min-w-0" :aria-label="title">
    <h3 class="mb-2 text-sm font-semibold text-slate-800">{{ title }}</h3>

    <p v-if="parsed.kind === 'empty'" class="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-4 text-sm text-slate-500">
      Sin información registrada
    </p>

    <!-- Texto plano: Vue lo escapa; nunca se usa v-html ni eval -->
    <pre v-else-if="parsed.kind === 'text'" tabindex="0"
      class="max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-800 focus-visible:outline-2 focus-visible:outline-indigo-600"
    >{{ parsed.raw }}</pre>

    <pre v-else tabindex="0"
      class="max-h-96 overflow-auto rounded-lg border border-slate-200 bg-slate-50 py-2 font-mono text-xs leading-5 text-slate-800 focus-visible:outline-2 focus-visible:outline-indigo-600"
    ><code><span v-for="(l, i) in lines" :key="i" class="flex px-2" :class="rowClass[l.status]"><span aria-hidden="true" class="w-4 shrink-0 select-none">{{ marker[l.status] }}</span><span v-if="srText[l.status]" class="sr-only">{{ srText[l.status] }}</span><span class="whitespace-pre">{{ l.text }}</span></span></code></pre>
  </section>
</template>
