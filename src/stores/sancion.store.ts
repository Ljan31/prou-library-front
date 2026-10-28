import { defineStore } from "pinia";
import { ref } from "vue";
import { sancionService } from "@/services/sancion.service";
import { useUiStore } from "@/stores/ui.store";
import type {
  SancionResponse,
  EstadoSancionUsuario,
  SancionManualRequest,
  PagoMultaRequest,
  CondonacionRequest,
  ReposicionRequest,
  ReposicionFisicaRequest,
  EstadoSancion,
} from "@/types/notificacion.types";

export const useSancionStore = defineStore("sanciones", () => {
  const ui = useUiStore();

  // ── Estado ──────────────────────────────────────────────────────────────
  const sanciones = ref<SancionResponse[]>([]);
  const sancionDetalle = ref<SancionResponse | null>(null);
  const estadoUsuario = ref<EstadoSancionUsuario | null>(null);
  const historial = ref<SancionResponse[]>([]);
  const cargando = ref(false);
  const cargandoDetalle = ref(false);
  const cargandoEstado = ref(false);
  const filtroEstado = ref<EstadoSancion>("ACTIVA");

  const activas = ref<SancionResponse[]>([]);
  const cargandoActivas = ref(false);
  const error = ref<string | null>(null);

  const errMsg = (e: any, fallback: string) =>
    e?.response?.data?.error ?? e?.response?.data?.message ?? fallback;

  /** Sincroniza lista y detalle con la respuesta del backend (única fuente de verdad). */
  function aplicar(data: SancionResponse) {
    const idx = sanciones.value.findIndex((s) => s.idSancion === data.idSancion);
    if (idx !== -1) sanciones.value[idx] = data;
    if (sancionDetalle.value?.idSancion === data.idSancion) sancionDetalle.value = data;
  }


  // ── Acciones ────────────────────────────────────────────────────────────
  async function cargarPorBiblioteca(
    bibliotecaId: number,
    estado: EstadoSancion = "ACTIVA",
  ) {
    cargando.value = true;
    filtroEstado.value = estado;
    console.log('cargarporbib')
    console.log(estado)
    try {
      const { data } = await sancionService.porBiblioteca(bibliotecaId, estado);
      console.log('sanciones: ', data)
      sanciones.value = data;
    } catch (e: any) {
      ui.toast.error("Error", errMsg(e, "No se pudieron cargar las sanciones"));
    } finally {
      cargando.value = false;
    }
  }

  async function cargarActivas(bibliotecaId: number) {
    cargandoActivas.value = true;
    try {
      const { data } = await sancionService.porBiblioteca(bibliotecaId, "ACTIVA");
      activas.value = data;
    } catch {
      activas.value = [];
    } finally {
      cargandoActivas.value = false;
    }
  }
  function abrirDetalle(s: SancionResponse) {
    sancionDetalle.value = s;
    return cargarDetalle(s.idSancion);
  }

  async function cargarDetalle(id: number) {
    cargandoDetalle.value = true;
    try {
      const { data } = await sancionService.obtener(id);
      sancionDetalle.value = data;
      aplicar(data);
      return data as SancionResponse;
    } catch (e: any) {
      ui.toast.error("Error", errMsg(e, "No se pudo cargar el detalle de la sanción"));
    } finally {
      cargandoDetalle.value = false;
    }
  }
  async function cargarEstadoUsuario(usuarioId: number) {
    cargandoEstado.value = true;
    try {
      const { data } = await sancionService.estadoSanciones(usuarioId);
      estadoUsuario.value = data;
    } catch (e) {
      console.error("Error al cargar estado de sanciones:", e);
    } finally {
      cargandoEstado.value = false;
    }
  }

  async function cargarHistorialUsuario(usuarioId: number) {
    cargando.value = true;
    try {
      const { data } = await sancionService.historialUsuario(usuarioId);
      historial.value = data;
    } catch (e: any) {
      ui.toast.error("Error", errMsg(e, "No se pudo cargar el historial"));
    } finally {
      cargando.value = false;
    }
  }

  async function registrarManual(payload: SancionManualRequest) {
    try {
      const { data } = await sancionService.registrarManual(payload);
      sanciones.value.unshift(data);
      ui.toast.success(
        "Sanción registrada",
        "La sanción fue registrada correctamente",
      );
      return data;
    } catch (e: any) {
      ui.toast.error("Error", errMsg(e, "No se pudo registrar la sanción"));
      throw e;
    }
  }

  /** Pérdida de ejemplar → sanción independiente de tipo REPOSICION. */
  async function registrarReposicion(payload: ReposicionRequest) {
    try {
      const { data } = await sancionService.registrarReposicion(payload);
      ui.toast.success(
        "Pérdida registrada",
        "Se generó la sanción de reposición y se notificó al usuario",
      );
      return data as SancionResponse;
    } catch (e: any) {
      ui.toast.error("Error", errMsg(e, "No se pudo registrar la pérdida del ejemplar"));
      throw e;
    }
  }

  async function registrarPago(id: number, payload: PagoMultaRequest) {
    try {
      const { data } = await sancionService.registrarPago(id, payload);
      const idx = sanciones.value.findIndex((s) => s.idSancion === id);
      if (idx !== -1) sanciones.value[idx] = data;
      ui.toast.success(
        "Pago registrado",
        `Multa pagada mediante ${payload.metodoPago}`,
      );
      return data;
    } catch (e: any) {
      ui.toast.error("Error", errMsg(e, "No se pudo registrar el pago"));
      throw e;
    }
  }

  async function registrarReposicionFisica(id: number, payload: ReposicionFisicaRequest) {
    try {
      const { data } = await sancionService.registrarReposicionFisica(id, payload);
      aplicar(data);
      ui.toast.success(
        "Reposición registrada",
        "El ejemplar de reemplazo fue registrado y el inventario fue actualizado",
      );
      return data as SancionResponse;
    } catch (e: any) {
      ui.toast.error("Error", errMsg(e, "No se pudo registrar la reposición física"));
      throw e;
    }
  }

  async function condonarSancion(id: number, payload: CondonacionRequest) {
    try {
      const { data } = await sancionService.condonar(id, payload);
      const idx = sanciones.value.findIndex((s) => s.idSancion === id);
      if (idx !== -1) sanciones.value[idx] = data;
      ui.toast.success(
        "Sanción condonada",
        "La sanción fue condonada exitosamente",
      );
      return data;
    } catch (e: any) {
      ui.toast.error("Error", errMsg(e, "No se pudo condonar la sanción"));
      throw e;
    }
  }

  async function procesarDevolucionTardia(idPrestamo: number) {
    try {
      const { data } =
        await sancionService.procesarDevolucionTardia(idPrestamo);
      ui.toast.warning(
        "Sanción generada",
        `Se generó una sanción por devolución tardía`,
      );
      return data;
    } catch (e: any) {
      ui.toast.error("Error", errMsg(e, "Error al procesar la devolución tardía"));
      throw e;
    }
  }

  function limpiarEstadoUsuario() {
    estadoUsuario.value = null;
  }

  return {
    sanciones,
    sancionDetalle,
    estadoUsuario,
    historial,
    cargando,
    cargandoDetalle,
    cargandoEstado,
    filtroEstado,
    activas,
    cargandoActivas,
    error,
    cargarPorBiblioteca,
    cargarActivas,
    abrirDetalle,
    cargarDetalle,
    cargarEstadoUsuario,
    cargarHistorialUsuario,
    registrarManual,
    registrarReposicion,
    registrarPago,
    registrarReposicionFisica,
    condonarSancion,
    procesarDevolucionTardia,
    limpiarEstadoUsuario,
  };
});
