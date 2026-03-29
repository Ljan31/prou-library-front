/**
 * useApi — Composable genérico para consumir endpoints del backend.
 * Los Equipos 2 y 3 pueden usarlo en cualquier módulo para manejar
 * loading, error y data de forma consistente.
 *
 * Uso:
 *   const { data, loading, error, execute } = useApi(() => api.get('/libros'))
 */
import { ref, type Ref } from "vue";
import type { AxiosError } from "axios";

interface UseApiReturn<T> {
  data: Ref<T | null>;
  loading: Ref<boolean>;
  error: Ref<string | null>;
  execute: (...args: unknown[]) => Promise<T | null>;
  reset: () => void;
}

export function useApi<T>(
  fn: (...args: unknown[]) => Promise<T>,
  options: { immediate?: boolean } = {},
): UseApiReturn<T> {
  const data = ref<T | null>(null) as Ref<T | null>;
  const loading = ref(false);
  const error = ref<string | null>(null);

  async function execute(...args: unknown[]): Promise<T | null> {
    loading.value = true;
    error.value = null;
    try {
      const result = await fn(...args);
      data.value = result;
      return result;
    } catch (err) {
      const axiosErr = err as AxiosError<{ message?: string }>;
      error.value =
        axiosErr.response?.data?.message ??
        axiosErr.message ??
        "Error inesperado";
      return null;
    } finally {
      loading.value = false;
    }
  }

  function reset() {
    data.value = null;
    loading.value = false;
    error.value = null;
  }

  if (options.immediate) execute();

  return { data, loading, error, execute, reset };
}
