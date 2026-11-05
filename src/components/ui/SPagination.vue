<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  page: number
  pageSize: number
  total: number
  pageSizeOptions?: number[]
  /** Páginas visibles a cada lado de la actual */
  siblingCount?: number
  /** Texto del resumen: "de 54 {itemLabel}" */
  itemLabel?: string
  loading?: boolean
  showPageSize?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  pageSizeOptions: () => [10, 20, 50],
  siblingCount: 1,
  itemLabel: 'registros',
  loading: false,
  showPageSize: true,
})

const emit = defineEmits<{
  'update:page': [value: number]
  'update:pageSize': [value: number]
}>()

const totalPages = computed(() => Math.max(1, Math.ceil(props.total / props.pageSize)))
const from = computed(() => (props.total === 0 ? 0 : (props.page - 1) * props.pageSize + 1))
const to = computed(() => Math.min(props.page * props.pageSize, props.total))

const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i)

/** [1, '…', 4, 5, 6, '…', 20] */
const pages = computed<(number | '…')[]>(() => {
  const last = totalPages.value
  const sib = props.siblingCount
  if (last <= sib * 2 + 5) return range(1, last)

  const left = Math.max(props.page - sib, 1)
  const right = Math.min(props.page + sib, last)
  const dotsLeft = left > 2
  const dotsRight = right < last - 1
  const edge = 3 + sib * 2

  if (!dotsLeft && dotsRight) return [...range(1, edge), '…', last]
  if (dotsLeft && !dotsRight) return [1, '…', ...range(last - edge + 1, last)]
  return [1, '…', ...range(left, right), '…', last]
})

function go(n: number) {
  const next = Math.min(Math.max(1, n), totalPages.value)
  if (next !== props.page && !props.loading) emit('update:page', next)
}

function onSize(e: Event) {
  emit('update:pageSize', Number((e.target as HTMLSelectElement).value))
}

const btn =
  'inline-flex h-9 min-w-9 items-center justify-center rounded-lg border px-2.5 text-xs font-medium transition-all ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 disabled:cursor-not-allowed disabled:opacity-40'
const btnIdle = 'border-slate-200 bg-white text-slate-600 hover:border-indigo-300 hover:text-indigo-600'
const btnActive = 'border-indigo-600 bg-indigo-600 text-white shadow-sm'
</script>

<template>
  <nav
    v-if="total > 0"
    aria-label="Paginación"
    class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
  >
    <!-- Resumen + tamaño de página -->
    <div class="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500">
      <p aria-live="polite">
        Mostrando
        <span class="font-medium text-slate-700">{{ from }}–{{ to }}</span>
        de
        <span class="font-medium text-slate-700">{{ total }}</span>
        {{ itemLabel }}
      </p>

      <slot name="summary-extra" />

      <label v-if="showPageSize && pageSizeOptions.length > 1" class="flex items-center gap-2">
        <span>Por página</span>
        <select
          :value="pageSize"
          :disabled="loading"
          class="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-700 outline-none transition-all focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-50"
          @change="onSize"
        >
          <option v-for="n in pageSizeOptions" :key="n" :value="n">{{ n }}</option>
        </select>
      </label>
    </div>

    <!-- Controles -->
    <div class="flex items-center justify-between gap-1.5 sm:justify-end">
      <button
        type="button"
        :class="[btn, btnIdle]"
        :disabled="page <= 1 || loading"
        aria-label="Página anterior"
        @click="go(page - 1)"
      >
        <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      <!-- Móvil: texto compacto -->
      <span class="px-2 text-xs text-slate-500 sm:hidden">
        Página <span class="font-medium text-slate-700">{{ page }}</span> de {{ totalPages }}
      </span>

      <!-- Escritorio / tablet: números -->
      <template v-for="(p, i) in pages" :key="`${p}-${i}`">
        <span v-if="p === '…'" class="hidden px-1 text-xs text-slate-400 sm:inline" aria-hidden="true">…</span>
        <button
          v-else
          type="button"
          :class="[btn, 'hidden sm:inline-flex', p === page ? btnActive : btnIdle]"
          :disabled="loading"
          :aria-label="`Ir a la página ${p}`"
          :aria-current="p === page ? 'page' : undefined"
          @click="go(p)"
        >
          {{ p }}
        </button>
      </template>

      <button
        type="button"
        :class="[btn, btnIdle]"
        :disabled="page >= totalPages || loading"
        aria-label="Página siguiente"
        @click="go(page + 1)"
      >
        <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  </nav>
</template>