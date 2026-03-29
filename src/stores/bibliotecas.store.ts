import { defineStore } from "pinia";
import { ref, computed } from "vue";
import {
  bibliotecasService,
  carrerasService,
  type Biblioteca,
  type CarreraDetail,
  type CreateBibliotecaPayload,
  type CreateCarreraPayload,
} from "@/services/bibliotecas.service";
import { useAuthStore } from "@/stores/auth.store";
import { useUiStore } from "@/stores/ui.store";

export const useBibliotecasStore = defineStore("bibliotecas", () => {
  const authStore = useAuthStore();
  const uiStore = useUiStore();

  // ─── State ───────────────────────────────────────────────────────────────
  const bibliotecas = ref<Biblioteca[]>([]);
  const carreras = ref<CarreraDetail[]>([]);
  const loading = ref(false);
  const loadingCarreras = ref(false);
  const error = ref<string | null>(null);

  // ─── Getters ─────────────────────────────────────────────────────────────

  /**
   * Admin sees all; bibliotecario sees only their assigned biblioteca.
   */
  const filteredBibliotecas = computed<Biblioteca[]>(() => {
    if (authStore.isAdmin) return bibliotecas.value;

    const bibId = authStore.user?.biblioteca?.id_biblioteca;
    if (!bibId) return [];
    return bibliotecas.value.filter((b) => b.id_biblioteca === bibId);
  });

  /**
   * Carreras related to the visible bibliotecas.
   */
  const filteredCarreras = computed<CarreraDetail[]>(() => {
    if (authStore.isAdmin) return carreras.value;

    // Gather carrera ids from visible bibliotecas
    const ids = new Set(
      filteredBibliotecas.value
        .filter((b) => b.carrera)
        .map((b) => b.carrera!.id_carrera),
    );
    return carreras.value.filter((c) => ids.has(c.id_carrera));
  });

  const totalActivas = computed(
    () => filteredBibliotecas.value.filter((b) => b.estado === "ACTIVA").length,
  );

  // ─── Actions ─────────────────────────────────────────────────────────────

  async function fetchBibliotecas() {
    loading.value = true;
    error.value = null;
    try {
      const res = await bibliotecasService.getAll();
      bibliotecas.value = res.data;
    } catch (e: unknown) {
      error.value =
        e instanceof Error ? e.message : "Error al cargar bibliotecas";
    } finally {
      loading.value = false;
    }
  }

  async function fetchCarreras() {
    loadingCarreras.value = true;
    try {
      const res = await carrerasService.getAll();
      carreras.value = res.data;
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : "Error al cargar carreras";
    } finally {
      loadingCarreras.value = false;
    }
  }

  async function fetchAll() {
    await Promise.all([fetchBibliotecas(), fetchCarreras()]);
  }

  // ── Biblioteca CRUD ──────────────────────────────────────────────────────

  async function createBiblioteca(
    payload: CreateBibliotecaPayload,
  ): Promise<boolean> {
    loading.value = true;
    try {
      const res = await bibliotecasService.create(payload);
      bibliotecas.value.unshift(res.data);
      uiStore.toast.success("Biblioteca creada", res.message);
      return true;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Error al crear biblioteca";
      uiStore.toast.error("Error", msg);
      return false;
    } finally {
      loading.value = false;
    }
  }

  async function updateBiblioteca(
    id: number,
    payload: Partial<CreateBibliotecaPayload>,
  ): Promise<boolean> {
    loading.value = true;
    try {
      const res = await bibliotecasService.update(id, payload);
      const idx = bibliotecas.value.findIndex((b) => b.id_biblioteca === id);
      if (idx !== -1) bibliotecas.value[idx] = res.data;
      uiStore.toast.success("Biblioteca actualizada", res.message);
      return true;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Error al actualizar";
      uiStore.toast.error("Error", msg);
      return false;
    } finally {
      loading.value = false;
    }
  }

  async function deleteBiblioteca(id: number): Promise<boolean> {
    loading.value = true;
    try {
      const res = await bibliotecasService.remove(id);
      bibliotecas.value = bibliotecas.value.filter(
        (b) => b.id_biblioteca !== id,
      );
      uiStore.toast.success("Biblioteca eliminada", res.message);
      return true;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Error al eliminar";
      uiStore.toast.error("Error", msg);
      return false;
    } finally {
      loading.value = false;
    }
  }

  // ── Carrera CRUD ─────────────────────────────────────────────────────────

  async function createCarrera(
    payload: CreateCarreraPayload,
  ): Promise<boolean> {
    loadingCarreras.value = true;
    try {
      const res = await carrerasService.create(payload);
      carreras.value.unshift(res.data);
      uiStore.toast.success("Carrera creada", res.message);
      return true;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Error al crear carrera";
      uiStore.toast.error("Error", msg);
      return false;
    } finally {
      loadingCarreras.value = false;
    }
  }

  async function updateCarrera(
    id: number,
    payload: Partial<CreateCarreraPayload>,
  ): Promise<boolean> {
    loadingCarreras.value = true;
    try {
      const res = await carrerasService.update(id, payload);
      const idx = carreras.value.findIndex((c) => c.id_carrera === id);
      if (idx !== -1) carreras.value[idx] = res.data;
      uiStore.toast.success("Carrera actualizada", res.message);
      return true;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Error al actualizar";
      uiStore.toast.error("Error", msg);
      return false;
    } finally {
      loadingCarreras.value = false;
    }
  }

  async function deleteCarrera(id: number): Promise<boolean> {
    loadingCarreras.value = true;
    try {
      const res = await carrerasService.remove(id);
      carreras.value = carreras.value.filter((c) => c.id_carrera !== id);
      uiStore.toast.success("Carrera eliminada", res.message);
      return true;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Error al eliminar";
      uiStore.toast.error("Error", msg);
      return false;
    } finally {
      loadingCarreras.value = false;
    }
  }

  return {
    // State
    bibliotecas,
    carreras,
    loading,
    loadingCarreras,
    error,
    // Getters
    filteredBibliotecas,
    filteredCarreras,
    totalActivas,
    // Actions
    fetchAll,
    fetchBibliotecas,
    fetchCarreras,
    createBiblioteca,
    updateBiblioteca,
    deleteBiblioteca,
    createCarrera,
    updateCarrera,
    deleteCarrera,
  };
});
