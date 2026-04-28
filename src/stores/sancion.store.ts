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
  const cargandoEstado = ref(false);
  const filtroEstado = ref<EstadoSancion>("ACTIVA");

  // ── Acciones ────────────────────────────────────────────────────────────
  async function cargarPorBiblioteca(
    bibliotecaId: number,
    estado: EstadoSancion = "ACTIVA",
  ) {
    cargando.value = true;
    filtroEstado.value = estado;
    try {
      const { data } = await sancionService.porBiblioteca(bibliotecaId, estado);
      sanciones.value = data;
    } catch (e: any) {
      ui.toast.error(
        "Error",
        e?.response?.data?.error ?? "No se pudieron cargar las sanciones",
      );
    } finally {
      cargando.value = false;
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
      ui.toast.error(
        "Error",
        e?.response?.data?.error ?? "No se pudo cargar el historial",
      );
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
      const msg = e?.response?.data?.error ?? "No se pudo registrar la sanción";
      ui.toast.error("Error", msg);
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
      const msg = e?.response?.data?.error ?? "No se pudo registrar el pago";
      ui.toast.error("Error", msg);
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
      const msg = e?.response?.data?.error ?? "No se pudo condonar la sanción";
      ui.toast.error("Error", msg);
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
      const msg =
        e?.response?.data?.error ?? "Error al procesar la devolución tardía";
      ui.toast.error("Error", msg);
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
    cargandoEstado,
    filtroEstado,
    cargarPorBiblioteca,
    cargarEstadoUsuario,
    cargarHistorialUsuario,
    registrarManual,
    registrarPago,
    condonarSancion,
    procesarDevolucionTardia,
    limpiarEstadoUsuario,
  };
});
