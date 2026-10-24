// src/composables/useAuditoria.ts
import { computed, reactive, ref } from 'vue'
import { auditoriaService, isAbortError, toServiceError, type AuditoriaErrorKind } from '@/services/auditoria.service'
import type { AuditoriaFilters, AuditoriaResponse, AuditoriaUsuario, FilterErrors } from '@/types/auditoria'
import { applyClientFilters, computeStats, emptyFilters, planRequest, sortByFechaDesc, validateFilters } from '@/utils/auditoria'

export type LoadMode = 'initial' | 'filters' | 'refresh'
export const PAGE_SIZE = 12

export function useAuditoria() {
  const filters = reactive<AuditoriaFilters>(emptyFilters())
  const applied = ref<AuditoriaFilters>(emptyFilters())
  const filterErrors = ref<FilterErrors>({})

  const records = ref<AuditoriaResponse[]>([])
  const loadMode = ref<LoadMode | null>(null)
  const hasLoaded = ref(false)
  const error = ref<{ kind: AuditoriaErrorKind; message: string } | null>(null)
  const page = ref(1)

  // Usuarios/tablas vistos en respuestas del servidor (no se inventa endpoint de usuarios).
  const knownUsers = ref(new Map<number, AuditoriaUsuario>())
  const knownTables = ref(new Set<string>())

  let controller: AbortController | null = null
  let seq = 0

  const loading = computed(() => loadMode.value !== null)
  const plan = computed(() => planRequest(applied.value))
  const stats = computed(() => computeStats(records.value))
  const totalPages = computed(() => Math.max(1, Math.ceil(records.value.length / PAGE_SIZE)))
  const pageRows = computed(() => records.value.slice((page.value - 1) * PAGE_SIZE, page.value * PAGE_SIZE))
  const hasActiveFilters = computed(() => JSON.stringify(applied.value) !== JSON.stringify(emptyFilters()))
  const userOptions = computed(() =>
    [...knownUsers.value.values()].sort((a, b) => (a.nombreCompleto || a.username || '').localeCompare(b.nombreCompleto || b.username || '')),
  )

  function fetchPlanned(f: AuditoriaFilters, signal: AbortSignal) {
    const o = { signal }
    switch (planRequest(f).endpoint) {
      case 'registro': return auditoriaService.getByRegistro(f.tabla.trim(), f.idRegistro.trim(), o)
      case 'fechas': return auditoriaService.getByFechas(`${f.fechaInicio}T00:00:00`, `${f.fechaFin}T23:59:59`, o)
      case 'usuario': return auditoriaService.getByUsuario(f.usuarioId as number, o)
      case 'tabla': return auditoriaService.getByTabla(f.tabla.trim(), o)
      case 'accion': return auditoriaService.getByAccion(f.accion, o)
      default: return auditoriaService.getAll(o)
    }
  }

  async function load(mode: LoadMode) {
    controller?.abort() // cancela la consulta anterior si cambió el filtro rápidamente
    controller = new AbortController()
    const mine = ++seq
    loadMode.value = mode
    error.value = null
    try {
      const raw = await fetchPlanned(applied.value, controller.signal)
      if (mine !== seq) return
      for (const r of raw) {
        if (r.usuario?.id_usuario != null) knownUsers.value.set(r.usuario.id_usuario, r.usuario)
        if (r.tablaAfectada) knownTables.value.add(r.tablaAfectada)
      }
      records.value = sortByFechaDesc(applyClientFilters(raw, applied.value, planRequest(applied.value).handled))
      page.value = Math.min(page.value, totalPages.value)
      hasLoaded.value = true
    } catch (e) {
      if (isAbortError(e) || mine !== seq) return
      const err = toServiceError(e)
      error.value = { kind: err.kind, message: err.message }
      if (err.kind === 'forbidden' || err.kind === 'session') records.value = [] // no mostrar datos sin permiso
    } finally {
      if (mine === seq) loadMode.value = null
    }
  }

  const init = () => load('initial')
  const refresh = () => load('refresh')

  function apply() {
    filterErrors.value = validateFilters(filters)
    if (Object.keys(filterErrors.value).length) return false
    applied.value = { ...filters }
    page.value = 1
    load('filters')
    return true
  }

  function clear() {
    Object.assign(filters, emptyFilters())
    filterErrors.value = {}
    applied.value = emptyFilters()
    page.value = 1
    load('filters')
  }

  const abort = () => { seq++; controller?.abort() }

  return {
    filters, filterErrors, records, loadMode, loading, hasLoaded, error, page, totalPages, pageRows,
    stats, plan, hasActiveFilters, userOptions, knownTables, init, refresh, apply, clear, abort,
  }
}
