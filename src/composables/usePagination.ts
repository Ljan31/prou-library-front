import { computed, ref, watch, type Ref } from 'vue'

/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  PAGINACIÓN REUTILIZABLE (SIGEB)
 * ─────────────────────────────────────────────────────────────────────────────
 *  'client' → el back devuelve TODO; el front corta la lista en páginas.
 *  'server' → el back pagina; el front solo envía page/size y lee el total.
 *
 *  Para pasar TODO el sistema a paginación del back, cambia UNA línea:
 *    .env →  VITE_PAGINATION_MODE=server
 *  (o cambia el valor por defecto de abajo). También se puede forzar por vista
 *  con usePagination({ mode: 'server' }).
 */
export type PaginationMode = 'client' | 'server'

export const PAGINATION_MODE: PaginationMode =
  (import.meta.env.VITE_PAGINATION_MODE as PaginationMode | undefined) ?? 'client'

/** Cómo espera el back los parámetros. Ajustar aquí cuando esté definido. */
export const PAGINATION_API = {
  pageParam: 'page',
  sizeParam: 'size',
  /** 0 = Spring Data (primera página es 0) · 1 = primera página es 1 */
  pageBase: 0 as 0 | 1,
}

// ─── Normalizador de respuestas ──────────────────────────────────────────────
/**
 * Un solo lugar para adaptar la forma de la respuesta del back.
 * Hoy:    { data: [...] }
 * Mañana: { data: [...], total }  |  { content, totalElements }  |  { data: { content, totalElements } }
 */
export function parsePageResponse<T>(body: any): { items: T[]; total: number } {
  const payload = body?.data ?? body

  const items: T[] = Array.isArray(payload)
    ? payload
    : (payload?.content ?? payload?.items ?? payload?.data ?? [])

  const total: number =
    body?.total ??
    body?.meta?.total ??
    payload?.totalElements ??
    payload?.total ??
    items.length

  return { items, total }
}

// ─── Composable ──────────────────────────────────────────────────────────────
interface Options<T> {
  /**
   * client → lista COMPLETA (ya filtrada) que se va a cortar en páginas.
   * server → la página actual tal como la devolvió el back.
   */
  items: Ref<T[]>
  pageSize?: number
  mode?: PaginationMode
}

export function usePagination<T>(options: Options<T>) {
  const isServer = (options.mode ?? PAGINATION_MODE) === 'server'

  const page = ref(1)
  const pageSize = ref(options.pageSize ?? 10)
  const serverTotal = ref(0)

  const total = computed(() => (isServer ? serverTotal.value : options.items.value.length))
  const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))

  const paginatedItems = computed<T[]>(() => {
    if (isServer) return options.items.value
    const start = (page.value - 1) * pageSize.value
    return options.items.value.slice(start, start + pageSize.value)
  })

  const from = computed(() => (total.value === 0 ? 0 : (page.value - 1) * pageSize.value + 1))
  const to = computed(() => Math.min(page.value * pageSize.value, total.value))

  /** Parámetros listos para axios. Vacío en modo client (el back no los necesita). */
  const apiParams = computed<Record<string, number>>(() =>
    isServer
      ? {
        [PAGINATION_API.pageParam]: page.value - 1 + PAGINATION_API.pageBase,
        [PAGINATION_API.sizeParam]: pageSize.value,
      }
      : {},
  )

  // Si la lista se encoge (anular, filtrar, borrar) y la página ya no existe → retrocede.
  watch(totalPages, (tp) => { if (page.value > tp) page.value = tp }, { flush: 'sync' })
  // Cambiar el tamaño de página siempre vuelve a la primera.
  watch(pageSize, () => { page.value = 1 }, { flush: 'sync' })

  function setPage(n: number) { page.value = Math.min(Math.max(1, n), totalPages.value) }
  function setTotal(n: number) { serverTotal.value = n }
  function reset() { page.value = 1 }

  return {
    isServer,
    page, pageSize, total, totalPages,
    paginatedItems, from, to,
    apiParams,
    setPage, setTotal, reset,
  }
}