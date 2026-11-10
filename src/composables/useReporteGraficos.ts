/**
 *
 * Decide qué gráficos lleva cada reporte (contrato, sección 6 de reporteService.ts),
 * los pide DESPUÉS de la tabla y en paralelo (Promise.allSettled), y expone
 * `esperar()` para que el PDF aguarde a que todos terminen.
 */
import { ref } from 'vue'
import { reporteService, type GraficoDTO } from '@/services/reporte.service'
import type { TipoReporte } from '@/types/reportes'

export interface GraficoItem {
  key: string
  titulo: string
  /** Solo para dimensionar el skeleton; el layout final usa grafico.tipoSugerido. */
  esDona: boolean
  status: 'loading' | 'ok' | 'error'
  grafico?: GraficoDTO
}

/** Filtros del reporte + respuesta ya cargada de la tabla. */
export interface GraficoCtx {
  bibliotecaId: number | null
  fechaInicio: string
  fechaFin: string
  estadoPrestamo: string
  tipoPrestamo: string
  estadoSancion: string
  tipoSancion: string
  usuarioId: number | null
  libroId: number | null
  /** Respuesta del reporte (resumen, etc.) para los gráficos que se arman en el frontend. */
  data: any
}

interface Spec {
  key: string
  titulo: string
  esDona: boolean
  load: () => Promise<GraficoDTO>
}

const unwrap = (res: any): GraficoDTO => res?.data?.data ?? res?.data
const nz = (v: string | null | undefined) => v || null

/** DONA armada en el frontend a partir del resumen del reporte. */
function dona(id: string, titulo: string, unidad: string, pares: [string, number][]): GraficoDTO {
  const valores = pares.map(([, v]) => Number(v) || 0)
  const total = valores.reduce((a, b) => a + b, 0)
  return {
    id, titulo, unidad, total,
    tipoSugerido: 'DONA',
    etiquetas: pares.map(([e]) => e),
    series: [{ nombre: titulo, valores }],
    sinDatos: total === 0,
  }
}

function crearSpecs(tipo: TipoReporte, c: GraficoCtx): { items: Spec[]; aviso: string | null } {
  const g = reporteService.graficos
  const f = { bibliotecaId: c.bibliotecaId, fechaInicio: nz(c.fechaInicio), fechaFin: nz(c.fechaFin) }
  const resumen = c.data?.resumen ?? {}

  const remoto = (key: string, titulo: string, fn: () => Promise<any>, esDona = false): Spec => ({
    key, titulo, esDona, load: async () => unwrap(await fn()),
  })
  const local = (key: string, titulo: string, build: () => GraficoDTO): Spec => ({
    key, titulo, esDona: true, load: async () => build(),
  })

  switch (tipo) {
    case 'prestamos':
      return {
        aviso: null,
        items: [
          remoto('prestamos-por-mes', 'Préstamos por mes', () => g.prestamosPorMes({ ...f, estado: nz(c.estadoPrestamo) })),
          remoto('prestamos-por-estado', 'Préstamos por estado', () => g.prestamosPorEstado(f), true),
          remoto('prestamos-por-tipo', 'Sala vs. domicilio', () => g.prestamosPorTipo({ ...f, estado: nz(c.estadoPrestamo) }), true),
        ],
      }

    case 'historial':
      // Los gráficos no soportan usuarioId ni libroId.
      if (c.usuarioId || c.libroId) {
        return { items: [], aviso: 'Los gráficos no están disponibles al filtrar por usuario o libro.' }
      }
      return {
        aviso: null,
        items: [
          remoto('prestamos-por-mes', 'Préstamos por mes', () =>
            g.prestamosPorMes({ ...f, estado: nz(c.estadoPrestamo), tipoPrestamo: nz(c.tipoPrestamo) })),
        ],
      }

    case 'libros-mas-prestados':
      return {
        aviso: null,
        items: [
          remoto('libros-mas-prestados', 'Top 10 libros más prestados', () =>
            g.librosMasPrestados({ bibliotecaId: c.bibliotecaId, limite: 10 })),
          remoto('prestamos-por-area', 'Préstamos por área temática', () =>
            g.prestamosPorArea({ bibliotecaId: c.bibliotecaId })),
        ],
      }

    case 'libros-menos-prestados':
      return {
        aviso: null,
        items: [
          remoto('libros-menos-prestados', 'Top 10 libros menos prestados', () =>
            g.librosMenosPrestados({ bibliotecaId: c.bibliotecaId, limite: 10 })),
        ],
      }

    case 'prestamos-activos':
      return {
        aviso: null,
        items: [
          local('prestamos-activos-dona', 'Préstamos por situación', () => {
            let pares: [string, number][] = [
              ['Activos', resumen.soloActivos], ['Renovados', resumen.renovados], ['Vencidos', resumen.yaVencidos],
            ]
            const suma = pares.reduce((a, [, v]) => a + (Number(v) || 0), 0)
            const lista: any[] = c.data?.prestamos ?? []
            // `yaVencidos` puede solaparse con activos/renovados: si no suman el total,
            // se parte la lista en categorías excluyentes para no contar dos veces.
            if (suma !== resumen.totalRegistros && lista.length) {
              const venc = lista.filter(p => p.vencido).length
              const ren = lista.filter(p => !p.vencido && p.estadoPrestamo === 'RENOVADO').length
              pares = [['Activos', lista.length - venc - ren], ['Renovados', ren], ['Vencidos', venc]]
            }
            return dona('prestamos-activos-dona', 'Préstamos por situación', 'préstamos', pares)
          }),
        ],
      }

    case 'devoluciones-pendientes':
      return {
        aviso: null,
        items: [remoto('vencidos-por-tramo', 'Vencidos por tramo de retraso', () => g.vencidosPorTramo(c.bibliotecaId))],
      }

    case 'inventario':
    case 'estado-ejemplares':
      return {
        aviso: null,
        items: [
          remoto('estado-ejemplares', 'Estado de ejemplares', () => g.estadoEjemplares(c.bibliotecaId), !!c.bibliotecaId),
        ],
      }

    case 'deterioro-ejemplares':
      return {
        aviso: null,
        items: [
          local('deterioro-dona', 'Estado físico al devolver', () =>
            dona('deterioro-dona', 'Estado físico al devolver', 'devoluciones', [
              ['Con deterioro', resumen.totalConDeterioro],
              ['Sin cambio', resumen.sinCambio],
              ['Mejoró', resumen.mejorados],
            ])),
        ],
      }

    case 'ejemplares-sin-circulacion':
      return {
        aviso: null,
        items: [
          local('sin-circulacion-dona', 'Ejemplares con y sin préstamos', () => {
            const nunca = Number(c.data?.totalEjemplaresNuncaPrestados) || 0
            const total = Number(c.data?.totalEjemplares) || 0
            return dona('sin-circulacion-dona', 'Ejemplares con y sin préstamos', 'ejemplares', [
              ['Nunca prestados', nunca],
              ['Con préstamos', Math.max(0, total - nunca)],
            ])
          }),
        ],
      }

    case 'sanciones':
      return {
        // Montos y tipo solo respetan biblioteca y fechas; la dona de estados sí refleja todo el filtro.
        aviso: c.estadoSancion || c.tipoSancion
          ? 'Los gráficos de monto y tipo consideran solo biblioteca y fechas, no el estado ni el tipo elegidos.'
          : null,
        items: [
          remoto('sanciones-montos', 'Monto de sanciones por estado', () => g.sancionesMontos(f)),
          remoto('sanciones-por-tipo', 'Sanciones por tipo', () => g.sancionesPorTipo(f), true),
          local('sanciones-estado-dona', 'Sanciones por estado', () =>
            dona('sanciones-estado-dona', 'Sanciones por estado', 'sanciones', [
              ['Activas', resumen.activas], ['Pagadas', resumen.pagadas], ['Condonadas', resumen.condonadas],
            ])),
        ],
      }

    case 'certificados':
      return {
        aviso: null,
        items: [
          local('certificados-dona', 'Certificados por estado', () =>
            dona('certificados-dona', 'Certificados por estado', 'certificados', [
              ['Vigentes', resumen.vigentes], ['Vencidos', resumen.vencidos], ['Anulados', resumen.anulados],
            ])),
        ],
      }

    case 'prestamos-por-vencer':
    default:
      return { items: [], aviso: null }
  }
}

export function useReporteGraficos() {
  const items = ref<GraficoItem[]>([])
  const aviso = ref<string | null>(null)

  let specs: Spec[] = []
  let ronda = 0
  let pendiente: Promise<unknown> = Promise.resolve()

  async function ejecutar(i: number, r: number) {
    const s = specs[i]
    items.value[i] = { ...items.value[i], status: 'loading' }
    try {
      const grafico = await s.load()
      if (r === ronda) items.value[i] = { ...items.value[i], status: 'ok', grafico }
    } catch (e) {
      console.error(`[gráficos] ${s.key}`, e)
      if (r === ronda) items.value[i] = { ...items.value[i], status: 'error' }
    }
  }

  /** Pide todos los gráficos del reporte en paralelo. Un fallo no afecta a los demás. */
  function cargar(tipo: TipoReporte, ctx: GraficoCtx) {
    const r = ++ronda
    const plan = crearSpecs(tipo, ctx)
    specs = plan.items
    aviso.value = plan.aviso
    items.value = specs.map(s => ({ key: s.key, titulo: s.titulo, esDona: s.esDona, status: 'loading' as const }))
    pendiente = Promise.allSettled(specs.map((_, i) => ejecutar(i, r)))
    return pendiente
  }

  function reintentar(key: string) {
    const i = specs.findIndex(s => s.key === key)
    if (i >= 0) pendiente = ejecutar(i, ronda)
  }

  /** El PDF espera aquí a que TODOS los gráficos hayan terminado (ok o error). */
  const esperar = () => pendiente

  function limpiar() {
    ronda++
    specs = []
    items.value = []
    aviso.value = null
    pendiente = Promise.resolve()
  }

  return { items, aviso, cargar, reintentar, esperar, limpiar }
}