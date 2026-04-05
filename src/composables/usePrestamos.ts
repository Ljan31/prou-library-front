import { ref, computed } from "vue";
import api from "@/services/axios";

export interface Prestamo {
  id_prestamo: number;
  estadoPrestamo: "ACTIVO" | "DEVUELTO" | "VENCIDO" | "RENOVADO";
  fechaDevolucionEstimada?: string;
  fechaDevolucionReal?: string;
  ejemplar?: {
    libro?: { titulo?: string };
    codigo_ejemplar?: string;
  };
}

export function usePrestamos() {
  const prestamos = ref<Prestamo[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  async function fetchPrestamos() {
    loading.value = true;
    error.value = null;
    try {
      const { data } = await api.get("/prestamos/mis-prestamos");
      prestamos.value = data.data ?? [];
    } catch (e: unknown) {
      error.value =
        e instanceof Error ? e.message : "No se pudieron cargar los préstamos";
    } finally {
      loading.value = false;
    }
  }

  const activos = computed(() =>
    prestamos.value.filter((p) => p.estadoPrestamo !== "DEVUELTO"),
  );

  const historial = computed(() =>
    prestamos.value.filter((p) => p.estadoPrestamo === "DEVUELTO"),
  );

  const tieneDeuda = computed(() =>
    prestamos.value.some((p) => p.estadoPrestamo !== "DEVUELTO"),
  );

  return {
    prestamos,
    loading,
    error,
    fetchPrestamos,
    activos,
    historial,
    tieneDeuda,
  };
}
