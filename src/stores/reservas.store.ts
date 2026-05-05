import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { reservasService } from "@/services/reservas.service";
import type {
  ReservaResponse,
  ReservaPendiente,
  CrearReservaPayload,
} from "@/types/reservas";
import { useUiStore } from "@/stores/ui.store";

export const useReservasStore = defineStore("reservas", () => {
  // ── Estado ──────────────────────────────────────────────────────────────
  const misReservas = ref<ReservaResponse[]>([]);
  const cargando = ref(false);
  const error = ref<string | null>(null);

  /**
   * Reserva pendiente: guardada cuando el usuario intenta reservar sin sesión.
   * Se persiste en sessionStorage para sobrevivir el redirect login → app.
   */
  const reservaPendiente = ref<ReservaPendiente | null>(
    (() => {
      try {
        const raw = sessionStorage.getItem("sigeb_reserva_pendiente");
        return raw ? JSON.parse(raw) : null;
      } catch {
        return null;
      }
    })(),
  );

  // ── Getters ──────────────────────────────────────────────────────────────
  const tienePendiente = computed(() => !!reservaPendiente.value);

  const reservasActivas = computed(() =>
    misReservas.value.filter(
      (r) => r.estadoReserva === "ACTIVA" || r.estadoReserva === "NOTIFICADA",
    ),
  );

  const reservasHistorial = computed(() =>
    misReservas.value.filter(
      (r) =>
        r.estadoReserva === "ATENDIDA" ||
        r.estadoReserva === "CANCELADA" ||
        r.estadoReserva === "VENCIDA",
    ),
  );

  // IDs de libros con reserva activa (para deshabilitar botón en catálogo)
  const libroIdsConReservaActiva = computed(
    () => new Set(reservasActivas.value.map((r) => r.libroId)),
  );

  // ── Acciones ─────────────────────────────────────────────────────────────

  /** Guarda una reserva pendiente antes de mandar al login */
  function guardarReservaPendiente(datos: ReservaPendiente) {
    reservaPendiente.value = datos;
    sessionStorage.setItem("sigeb_reserva_pendiente", JSON.stringify(datos));
  }

  /** Limpia la reserva pendiente tras procesarla o descartarla */
  function limpiarReservaPendiente() {
    reservaPendiente.value = null;
    sessionStorage.removeItem("sigeb_reserva_pendiente");
  }

  /** Carga las reservas del usuario autenticado */
  async function cargarMisReservas() {
    cargando.value = true;
    error.value = null;
    try {
      const { data } = await reservasService.misReservas();
      misReservas.value = data;
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : "Error al cargar reservas";
    } finally {
      cargando.value = false;
    }
  }

  /**
   * Confirma la reserva pendiente después del login.
   * Retorna la reserva creada o null si falla.
   */
  async function confirmarReservaPendiente(): Promise<ReservaResponse | null> {
    if (!reservaPendiente.value) return null;
    const ui = useUiStore();

    const payload: CrearReservaPayload = {
      libroId: reservaPendiente.value.libroId,
      bibliotecaId: reservaPendiente.value.bibliotecaId,
      observaciones: reservaPendiente.value.observaciones,
    };

    try {
      const { data } = await reservasService.crear(payload);
      limpiarReservaPendiente();
      await cargarMisReservas();

      if (data.estadoReserva === "NOTIFICADA") {
        ui.toast.success(
          "¡Libro disponible!",
          `"${data.libroTitulo}" está listo para retiro.`,
        );
      } else {
        ui.toast.success(
          "Reserva confirmada",
          `Estás en la posición ${data.prioridad} de la cola.`,
        );
      }
      return data;
    } catch (e: unknown) {
      const msg =
        e instanceof Error ? e.message : "No se pudo crear la reserva";
      ui.toast.error("Error al reservar", msg);
      return null;
    }
  }

  /** Crea una reserva directamente (usuario ya autenticado en catálogo) */
  async function crearReserva(
    payload: CrearReservaPayload,
  ): Promise<ReservaResponse | null> {
    const ui = useUiStore();
    cargando.value = true;
    try {
      const { data } = await reservasService.crear(payload);
      await cargarMisReservas();
      if (data.estadoReserva === "NOTIFICADA") {
        ui.toast.success(
          "¡Libro disponible!",
          `"${data.libroTitulo}" está listo para retiro.`,
        );
      } else {
        ui.toast.success(
          "Reserva creada",
          `Posición en cola: ${data.prioridad}`,
        );
      }
      return data;
    } catch (e: unknown) {
      const msg =
        e instanceof Error ? e.message : "No se pudo crear la reserva";
      ui.toast.error("Error", msg);
      return null;
    } finally {
      cargando.value = false;
    }
  }

  /** Cancela una reserva */
  async function cancelarReserva(
    id: number,
    motivo?: string,
  ): Promise<boolean> {
    const ui = useUiStore();
    try {
      await reservasService.cancelar(id, motivo);
      await cargarMisReservas();
      ui.toast.success(
        "Reserva cancelada",
        "Tu reserva ha sido cancelada correctamente.",
      );
      return true;
    } catch (e: unknown) {
      const msg =
        e instanceof Error ? e.message : "No se pudo cancelar la reserva";
      ui.toast.error("Error", msg);
      return false;
    }
  }

  return {
    // Estado
    misReservas,
    cargando,
    error,
    reservaPendiente,
    // Getters
    tienePendiente,
    reservasActivas,
    reservasHistorial,
    libroIdsConReservaActiva,
    // Acciones
    guardarReservaPendiente,
    limpiarReservaPendiente,
    confirmarReservaPendiente,
    cargarMisReservas,
    crearReserva,
    cancelarReserva,
  };
});
