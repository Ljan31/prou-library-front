<template>
  <div class="s-table-container">
    <!-- Loading overlay -->
    <div v-if="loading" class="s-table-overlay" aria-live="polite" aria-label="Cargando datos">
      <div class="s-table-skeleton">
        <div v-for="i in skeletonRows" :key="i" class="s-table-skeleton__row">
          <div v-for="j in columns.length" :key="j" class="skeleton s-table-skeleton__cell" />
        </div>
      </div>
    </div>

    <!-- Empty state -->
    <div v-else-if="!loading && (!rows || rows.length === 0)" class="s-table-empty">
      <slot name="empty">
        <div class="s-table-empty__icon" aria-hidden="true">
          <svg viewBox="0 0 64 64" fill="none">
            <rect x="8" y="12" width="48" height="40" rx="6" stroke="currentColor" stroke-width="2.5"
              stroke-dasharray="5 3" />
            <path d="M20 28h24M20 36h16" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" />
            <circle cx="48" cy="48" r="10" fill="var(--color-neutral-100)" stroke="var(--color-neutral-300)"
              stroke-width="2" />
            <path d="M44 48h8M48 44v8" stroke="var(--color-neutral-400)" stroke-width="2" stroke-linecap="round" />
          </svg>
        </div>
        <p class="s-table-empty__title">{{ emptyTitle }}</p>
        <p v-if="emptySubtitle" class="s-table-empty__subtitle">{{ emptySubtitle }}</p>
        <slot name="empty-action" />
      </slot>
    </div>

    <!-- Table -->
    <div v-else class="s-table-wrapper" :class="compact && 's-table-wrapper--compact'">
      <table class="s-table" :aria-label="caption">
        <caption v-if="caption" class="sr-only">{{ caption }}</caption>
        <thead>
          <tr>
            <th v-for="col in columns" :key="col.key"
              :class="['s-table__th', col.align && `s-table__th--${col.align}`, col.sortable && 's-table__th--sortable']"
              :style="col.width ? { width: col.width } : {}" :aria-sort="sortState(col.key)" scope="col"
              @click="col.sortable && toggleSort(col.key)">
              <span class="s-table__th-inner">
                {{ col.label }}
                <span v-if="col.sortable" class="s-table__sort-icon" aria-hidden="true">
                  <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
                    <path v-if="sortKey === col.key && sortDir === 'asc'" d="M8 3l4 6H4l4-6z" />
                    <path v-else-if="sortKey === col.key && sortDir === 'desc'" d="M8 13l-4-6h8l-4 6z" />
                    <path v-else d="M5 6l3-3 3 3H5zm6 4l-3 3-3-3h6z" />
                  </svg>
                </span>
              </span>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, idx) in rows" :key="row[rowKey] ?? idx"
            :class="['s-table__row', clickableRows && 's-table__row--clickable', selectedRows?.includes(row[rowKey]) && 's-table__row--selected']"
            :tabindex="clickableRows ? 0 : undefined" @click="clickableRows && $emit('row-click', row)"
            @keydown.enter="clickableRows && $emit('row-click', row)">
            <td v-for="col in columns" :key="col.key"
              :class="['s-table__td', col.align && `s-table__td--${col.align}`]">
              <slot :name="`cell-${col.key}`" :row="row" :value="row[col.key]" :index="idx">
                {{ row[col.key] ?? '—' }}
              </slot>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Pagination -->
    <div v-if="pagination && !loading && rows && rows.length > 0" class="s-table-pagination">
      <span class="s-table-pagination__info">
        Mostrando {{ paginationFrom }} – {{ paginationTo }} de {{ totalRows }} resultados
      </span>
      <div class="s-table-pagination__controls">
        <button class="s-table-pagination__btn" :disabled="page <= 1" aria-label="Página anterior"
          @click="$emit('update:page', page - 1)">
          <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
            <path fill-rule="evenodd"
              d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
              clip-rule="evenodd" />
          </svg>
        </button>
        <button v-for="p in pageNumbers" :key="p"
          :class="['s-table-pagination__btn', p === page && 's-table-pagination__btn--active']"
          :aria-label="`Página ${p}`" :aria-current="p === page ? 'page' : undefined" @click="$emit('update:page', p)">
          {{ p }}
        </button>
        <button class="s-table-pagination__btn" :disabled="page >= totalPages" aria-label="Página siguiente"
          @click="$emit('update:page', page + 1)">
          <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
            <path fill-rule="evenodd"
              d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
              clip-rule="evenodd" />
          </svg>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

interface Column {
  key: string
  label: string
  sortable?: boolean
  align?: 'left' | 'center' | 'right'
  width?: string
}

interface Props {
  columns: Column[]
  rows?: Record<string, unknown>[]
  rowKey?: string
  loading?: boolean
  skeletonRows?: number
  emptyTitle?: string
  emptySubtitle?: string
  compact?: boolean
  clickableRows?: boolean
  selectedRows?: unknown[]
  caption?: string
  pagination?: boolean
  page?: number
  pageSize?: number
  totalRows?: number
}

const props = withDefaults(defineProps<Props>(), {
  rowKey: 'id',
  skeletonRows: 5,
  emptyTitle: 'Sin resultados',
  emptySubtitle: 'No se encontraron datos para mostrar.',
  page: 1,
  pageSize: 10,
  totalRows: 0,
})

defineEmits<{
  'row-click': [row: Record<string, unknown>]
  'update:page': [p: number]
  'sort': [key: string, dir: 'asc' | 'desc']
}>()

const sortKey = ref<string>('')
const sortDir = ref<'asc' | 'desc'>('asc')

function toggleSort(key: string) {
  if (sortKey.value === key) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortKey.value = key
    sortDir.value = 'asc'
  }
}

function sortState(key: string) {
  if (sortKey.value !== key) return 'none'
  return sortDir.value === 'asc' ? 'ascending' : 'descending'
}

const totalPages = computed(() => Math.max(1, Math.ceil(props.totalRows / props.pageSize)))
const paginationFrom = computed(() => (props.page - 1) * props.pageSize + 1)
const paginationTo = computed(() => Math.min(props.page * props.pageSize, props.totalRows))

const pageNumbers = computed(() => {
  const range: number[] = []
  const start = Math.max(1, props.page - 2)
  const end = Math.min(totalPages.value, props.page + 2)
  for (let i = start; i <= end; i++) range.push(i)
  return range
})
</script>

<style scoped>
.s-table-container {
  position: relative;
  border: 1px solid var(--color-neutral-200);
  border-radius: var(--radius-xl);
  overflow: hidden;
  background: var(--color-neutral-0);
  box-shadow: var(--shadow-sm);
}

/* ── Loading ── */
.s-table-overlay {
  padding: 1.5rem;
}

.s-table-skeleton__row {
  display: flex;
  gap: 1rem;
  margin-bottom: 0.75rem;
}

.s-table-skeleton__cell {
  flex: 1;
  height: 2rem;
  min-width: 0;
}

.s-table-skeleton__cell:first-child {
  max-width: 3rem;
}

/* ── Empty ── */
.s-table-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 4rem 2rem;
  gap: 0.75rem;
}

.s-table-empty__icon {
  color: var(--color-neutral-300);
  margin-bottom: 0.5rem;
}

.s-table-empty__icon svg {
  width: 64px;
  height: 64px;
}

.s-table-empty__title {
  font-weight: var(--font-semibold);
  color: var(--color-neutral-700);
  font-size: var(--text-base);
}

.s-table-empty__subtitle {
  color: var(--color-neutral-400);
  font-size: var(--text-sm);
  text-align: center;
  max-width: 320px;
}

/* ── Table ── */
.s-table-wrapper {
  overflow-x: auto;
}

.s-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--text-sm);
}

/* Header */
.s-table__th {
  padding: 0.75rem 1rem;
  text-align: left;
  font-weight: var(--font-semibold);
  font-size: var(--text-xs);
  color: var(--color-neutral-500);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  background: var(--color-neutral-50);
  border-bottom: 1px solid var(--color-neutral-200);
  white-space: nowrap;
}

.s-table__th--center {
  text-align: center;
}

.s-table__th--right {
  text-align: right;
}

.s-table__th--sortable {
  cursor: pointer;
  user-select: none;
  transition: color var(--transition-fast);
}

.s-table__th--sortable:hover {
  color: var(--color-neutral-800);
}

.s-table__th-inner {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
}

.s-table__sort-icon {
  color: var(--color-neutral-400);
  display: flex;
  align-items: center;
}

/* Compact variant */
.s-table-wrapper--compact .s-table__th,
.s-table-wrapper--compact .s-table__td {
  padding: 0.5rem 0.75rem;
}

/* Rows */
.s-table__row {
  border-bottom: 1px solid var(--color-neutral-100);
  transition: background var(--transition-fast);
}

.s-table__row:last-child {
  border-bottom: none;
}

.s-table__row:hover {
  background: var(--color-neutral-50);
}

.s-table__row--clickable {
  cursor: pointer;
}

.s-table__row--clickable:focus-visible {
  outline: 2px solid var(--color-primary-500);
  outline-offset: -2px;
}

.s-table__row--selected {
  background: var(--color-primary-50) !important;
}

/* Cells */
.s-table__td {
  padding: 0.875rem 1rem;
  color: var(--color-neutral-700);
  vertical-align: middle;
}

.s-table__td--center {
  text-align: center;
}

.s-table__td--right {
  text-align: right;
}

/* ── Pagination ── */
.s-table-pagination {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.875rem 1rem;
  border-top: 1px solid var(--color-neutral-200);
  background: var(--color-neutral-50);
  gap: 1rem;
  flex-wrap: wrap;
}

.s-table-pagination__info {
  font-size: var(--text-xs);
  color: var(--color-neutral-500);
}

.s-table-pagination__controls {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.s-table-pagination__btn {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 2rem;
  height: 2rem;
  padding: 0 0.5rem;
  border: 1px solid var(--color-neutral-200);
  border-radius: var(--radius-md);
  background: var(--color-neutral-0);
  color: var(--color-neutral-600);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.s-table-pagination__btn:hover:not(:disabled) {
  background: var(--color-primary-50);
  border-color: var(--color-primary-300);
  color: var(--color-primary-700);
}

.s-table-pagination__btn--active {
  background: var(--color-primary-600) !important;
  border-color: var(--color-primary-600) !important;
  color: white !important;
}

.s-table-pagination__btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* Screen reader only */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}
</style>