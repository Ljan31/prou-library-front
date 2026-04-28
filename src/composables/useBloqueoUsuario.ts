// src/composables/useBloqueoUsuario.ts
import { ref } from "vue";
import { sancionService } from "@/services/sancion.service";
import type { EstadoSancionUsuario } from "@/types/notificacion.types";

/**
 * Composable para verificar si un usuario tiene bloqueos activos.
 * Úsalo en el formulario de préstamos antes de permitir el registro.
 *
 * @example
 * const { estado, loading, verificar, bloqueado } = useBloqueoUsuario()
 * await verificar(usuarioId)
 * if (bloqueado.value) { ... }
 */
export function useBloqueoUsuario() {
  const estado = ref<EstadoSancionUsuario | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  const bloqueado = computed(
    () => estado.value?.tieneSuspensionVigente ?? false,
  );
  const tieneDeuda = computed(() => estado.value?.tieneDeudaPendiente ?? false);

  async function verificar(usuarioId: number) {
    if (!usuarioId) return;
    loading.value = true;
    error.value = null;
    try {
      const { data } = await sancionService.estadoSanciones(usuarioId);
      estado.value = data;
    } catch (e: any) {
      error.value =
        e?.response?.data?.error ?? "Error al verificar estado del usuario";
      estado.value = null;
    } finally {
      loading.value = false;
    }
  }

  function limpiar() {
    estado.value = null;
    error.value = null;
  }

  return { estado, loading, error, bloqueado, tieneDeuda, verificar, limpiar };
}

// necesario importar computed
import { computed } from "vue";
