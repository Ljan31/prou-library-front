/**
 * Reglas de negocio compartidas para crear un préstamo
 * (NuevoPrestamo y ConvertirReservaModal).
 *
 * Responsabilidades:
 *  - Tipo de préstamo (DOMICILIO / SALA)
 *  - Configuración de la biblioteca (días, máx. ejemplares)
 *  - Fecha de devolución según tipo y configuración
 *  - Estado de sanciones del usuario (bloqueo + mensajes)
 *  - Validación del formulario de confirmación
 *
 * NO hace: UI, toasts ni el POST final (eso queda en cada vista).
 */
import { ref, computed, toValue, watch, type MaybeRefOrGetter } from 'vue'
import api from '@/services/axios'
import {
  DIAS_PRESTAMO_DEFAULT,
  MAX_EJEMPLARES_DEFAULT,
  type Condicion,
  type EstadoSancion,
  type ReglasConfig,
  type TipoDocumento,
  type TipoPrestamo,
} from '@/constants/prestamo.constants'

interface Options {
  bibliotecaId: MaybeRefOrGetter<number | null | undefined>
  tipoInicial?: TipoPrestamo
  /** false si el usuario está inhabilitado (campo `enabled` del backend). */
  usuarioHabilitado?: MaybeRefOrGetter<boolean>
}

export interface ValidacionInput {
  usuarioId?: number | null
  condiciones: (Condicion | null | undefined)[]
  tipoDocumento?: TipoDocumento | null
  fechaDevolucion?: string | null
  cantidadEjemplares: number
}

const isoHoy = () => new Date().toISOString().split('T')[0]

export function usePrestamoRules(opts: Options) {
  const tipoPrestamo = ref<TipoPrestamo>(opts.tipoInicial ?? 'DOMICILIO')

  // ─── Configuración de biblioteca ────────────────────────────────────────
  const configLoading = ref(false)
  const reglasDomicilio = ref<ReglasConfig | null>(null)
  const reglasSala = ref<ReglasConfig | null>(null)

  async function loadReglas() {
    const biblId = toValue(opts.bibliotecaId)
    if (!biblId) return
    configLoading.value = true
    try {
      const get = (tipo: TipoPrestamo) =>
        api.get(`/configuraciones-prestamo/biblioteca/${biblId}/reglas`, { params: { tipoPrestamo: tipo } })
      const [rDom, rSala] = await Promise.all([get('DOMICILIO'), get('SALA')])
      reglasDomicilio.value = rDom.data?.data ?? rDom.data
      reglasSala.value = rSala.data?.data ?? rSala.data
    } catch {
      // Config opcional: se usan valores por defecto
    } finally {
      configLoading.value = false
    }
  }

  const reglasActivas = computed<ReglasConfig | null>(() =>
    tipoPrestamo.value === 'DOMICILIO' ? reglasDomicilio.value : reglasSala.value,
  )
  const maxEjemplares = computed(() => reglasActivas.value?.ejemplaresPermitidos ?? MAX_EJEMPLARES_DEFAULT)
  const requiereFecha = computed(() => tipoPrestamo.value === 'DOMICILIO')
  const hoy = isoHoy()

  // ─── Fecha de devolución ────────────────────────────────────────────────
  function calcFechaDevolucion(): string {
    const dias = reglasActivas.value?.diasPrestamoMax ?? DIAS_PRESTAMO_DEFAULT
    const d = new Date()
    d.setDate(d.getDate() + dias)
    return d.toISOString().split('T')[0]
  }
  const fechaDevolucion = ref(calcFechaDevolucion())
  const recalcularFecha = () => { fechaDevolucion.value = calcFechaDevolucion() }

  // Cambia el tipo → recalcular. Cargan reglas → recalcular.
  watch([tipoPrestamo, reglasDomicilio, reglasSala], recalcularFecha)

  /** Valor a enviar al backend: SALA no lleva fecha. */
  const fechaDevolucionPayload = computed(() => (requiereFecha.value ? fechaDevolucion.value : null))

  // ─── Sanciones ──────────────────────────────────────────────────────────
  const sancionEstado = ref<EstadoSancion | null>(null)
  const sancionLoading = ref(false)

  async function loadSancion(usuarioId: number) {
    sancionEstado.value = null
    sancionLoading.value = true
    try {
      const { data } = await api.get(`/sanciones/usuario/${usuarioId}/estado`, {
        params: { bibliotecaId: toValue(opts.bibliotecaId) },
      })
      sancionEstado.value = data?.data ?? data
    } catch {
      sancionEstado.value = null
    } finally {
      sancionLoading.value = false
    }
  }
  const resetSancion = () => { sancionEstado.value = null }

  const inhabilitado = computed(() => toValue(opts.usuarioHabilitado ?? true) === false)

  const usuarioSancionado = computed(
    () => !!sancionEstado.value?.tieneDeudaPendiente || !!sancionEstado.value?.tieneReposicionPendiente,
  )

  const usuarioBloqueado = computed(() => {
    const s = sancionEstado.value
    const porSancion = !!s && (s.tieneSuspensionVigente || s.tieneDeudaPendiente || s.tieneReposicionPendiente)
    return porSancion || inhabilitado.value
  })

  const mensajeSancion = computed(() => {
    if (inhabilitado.value) return 'Usuario inhabilitado'
    const s = sancionEstado.value
    if (!s) return ''
    const partes = [
      s.tieneSuspensionVigente && 'suspensión activa',
      s.tieneDeudaPendiente && 'deuda pendiente',
      s.tieneReposicionPendiente && 'reposición pendiente',
    ].filter(Boolean) as string[]
    if (!partes.length) return ''
    const texto = partes.length > 1
      ? `${partes.slice(0, -1).join(', ')} y ${partes.at(-1)}`
      : partes[0]
    return `Usuario con ${texto}`
  })

  const detalleSancion = computed(() => {
    const s = sancionEstado.value
    if (!s) return ''
    const partes: string[] = []
    if (s.tieneSuspensionVigente && s.fechaFinSuspensionMasProxima)
      partes.push(`Suspensión hasta: ${s.fechaFinSuspensionMasProxima}`)
    if (s.tieneDeudaPendiente) partes.push('Tiene deuda pendiente')
    if (s.tieneReposicionPendiente) partes.push('Tiene reposición pendiente')
    if (s.totalSancionesActivas > 0) partes.push(`${s.totalSancionesActivas} sanciones activas`)
    return partes.join(' • ')
  })

  // ─── Validación del formulario ──────────────────────────────────────────
  function validar(i: ValidacionInput): string[] {
    const errores: string[] = []
    if (!i.usuarioId) errores.push('Falta el usuario')
    if (usuarioBloqueado.value) errores.push(mensajeSancion.value || 'El usuario no puede realizar préstamos')
    if (i.cantidadEjemplares < 1) errores.push('Debe seleccionar al menos un ejemplar')
    if (i.cantidadEjemplares > maxEjemplares.value)
      errores.push(`Máximo ${maxEjemplares.value} ejemplares en préstamo ${tipoPrestamo.value.toLowerCase()}`)
    if (i.condiciones.some(c => !c)) errores.push('Indique la condición de cada ejemplar')
    if (!i.tipoDocumento) errores.push('Seleccione el documento de garantía')
    if (requiereFecha.value) {
      if (!i.fechaDevolucion) errores.push('Indique la fecha de devolución')
      else if (i.fechaDevolucion < hoy) errores.push('La fecha de devolución no puede ser anterior a hoy')
    }
    return errores
  }

  return {
    // tipo + config
    tipoPrestamo, configLoading, reglasDomicilio, reglasSala, reglasActivas,
    maxEjemplares, requiereFecha, hoy, loadReglas,
    // fecha
    fechaDevolucion, fechaDevolucionPayload, calcFechaDevolucion, recalcularFecha,
    // sanciones
    sancionEstado, sancionLoading, loadSancion, resetSancion,
    usuarioSancionado, usuarioBloqueado, mensajeSancion, detalleSancion,
    // validación
    validar,
  }
}