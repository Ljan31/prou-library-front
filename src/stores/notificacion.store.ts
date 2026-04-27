import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { notificacionService } from "@/services/notificacion.service";
import type { Notificacion } from "@/types/notificacion.types";

export const useNotificacionStore = defineStore("notificaciones", () => {
  // ── Estado ──────────────────────────────────────────────────────────────
  const notificaciones = ref<Notificacion[]>([]);
  const noLeidas = ref<Notificacion[]>([]);
  const totalNoLeidas = ref(0);
  const cargando = ref(false);
  const dropdownAbierto = ref(false);
  const paginacion = ref({ page: 0, totalPages: 0, totalElements: 0 });

  // ── Getters ─────────────────────────────────────────────────────────────
  const tienePendientes = computed(() => totalNoLeidas.value > 0);
  const badgeLabel = computed(() =>
    totalNoLeidas.value > 99 ? "99+" : String(totalNoLeidas.value),
  );

  // ── Acciones ────────────────────────────────────────────────────────────
  async function cargarBandeja(page = 0) {
    cargando.value = true;
    try {
      const { data } = await notificacionService.listar({
        page,
        size: 20,
        sort: "fechaEnvio,desc",
      });
      notificaciones.value = data.content;
      paginacion.value.page = data.number;
      paginacion.value.totalPages = data.totalPages;
      paginacion.value.totalElements = data.totalElements;
    } catch (e) {
      console.error("Error al cargar bandeja:", e);
    } finally {
      cargando.value = false;
    }
  }

  async function cargarNoLeidas() {
    try {
      const { data } = await notificacionService.listarNoLeidas();
      noLeidas.value = data;
    } catch (e) {
      console.error("Error al cargar no leídas:", e);
    }
  }

  async function actualizarContador() {
    try {
      const { data } = await notificacionService.contarNoLeidas();
      totalNoLeidas.value = data.total;
    } catch (e) {
      console.error("Error al actualizar contador:", e);
    }
  }

  async function marcarLeida(id: number) {
    try {
      await notificacionService.marcarLeida(id);
      const n = notificaciones.value.find((n) => n.idNotificacion === id);
      if (n) n.leida = true;
      noLeidas.value = noLeidas.value.filter((n) => n.idNotificacion !== id);
      if (totalNoLeidas.value > 0) totalNoLeidas.value--;
    } catch (e) {
      console.error("Error al marcar como leída:", e);
    }
  }

  async function marcarTodasLeidas() {
    try {
      await notificacionService.marcarTodasLeidas();
      notificaciones.value.forEach((n) => (n.leida = true));
      noLeidas.value = [];
      totalNoLeidas.value = 0;
    } catch (e) {
      console.error("Error al marcar todas:", e);
    }
  }

  function toggleDropdown() {
    dropdownAbierto.value = !dropdownAbierto.value;
    if (dropdownAbierto.value) cargarNoLeidas();
  }

  function cerrarDropdown() {
    dropdownAbierto.value = false;
  }

  return {
    notificaciones,
    noLeidas,
    totalNoLeidas,
    cargando,
    dropdownAbierto,
    paginacion,
    tienePendientes,
    badgeLabel,
    cargarBandeja,
    cargarNoLeidas,
    actualizarContador,
    marcarLeida,
    marcarTodasLeidas,
    toggleDropdown,
    cerrarDropdown,
  };
});
