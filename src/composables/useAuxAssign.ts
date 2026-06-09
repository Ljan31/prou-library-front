/**
 * useAuxAssign — lógica reutilizable para asignar encargados a bibliotecas.
 * Soporta: estudiantes como auxiliares (con filtro por carrera)
 *          y bibliotecarios como encargados (sin filtro de carrera).
 */
import axios from "axios";
import { ref, watch } from "vue";
import { useUiStore } from "@/stores/ui.store";
import { useUsers } from "@/composables/useUsers";
import { bibliotecasService } from "@/services/bibliotecas.service";
import type { BibliotecaResponse } from "@/services/bibliotecas.service";
import type { UserResponse } from "@/services/user.service";

export function useAuxAssign() {
  const ui = useUiStore();
  const { allBibliotecas, refreshBibliotecas } = useUsers();

  // ─── State ────────────────────────────────────────────────────────────────
  const auxCarreraId = ref<number | "">("");
  const auxBibliotecaId = ref<number | "">("");
  const auxBibliotecas = ref<BibliotecaResponse[]>([]);
  const auxBibliotecasLoading = ref(false);
  const auxLoading = ref(false);
  const auxError = ref("");
  const auxSuccess = ref(false);
  const auxResolucionFile = ref<File | null>(null);
  const auxResolucionPreview = ref<string>("");

  function resetAux() {
    auxCarreraId.value = "";
    auxBibliotecaId.value = "";
    auxBibliotecas.value = [];
    auxError.value = "";
    auxSuccess.value = false;
    auxResolucionFile.value = null;
    auxResolucionPreview.value = "";
  }

  // ─── Load bibliotecas by carrera (for students) ───────────────────────────
  function watchCarrera() {
    watch(auxCarreraId, async (carreraId) => {
      auxBibliotecaId.value = "";
      auxBibliotecas.value = [];
      auxError.value = "";
      auxSuccess.value = false;
      if (!carreraId) return;

      auxBibliotecasLoading.value = true;
      try {
        // Use cached global list first (match by carrera)
        const local = allBibliotecas.value.filter(
          (b) => b.carrera?.id_carrera === Number(carreraId),
        );
        if (local.length) {
          auxBibliotecas.value = local;
        } else {
          // Fallback: query API
          const res = await bibliotecasService.getByCarrera(Number(carreraId));
          const raw = res.data as any;
          auxBibliotecas.value = Array.isArray(raw) ? raw : (raw?.data ?? []);
        }
      } catch {
        /* silent */
      } finally {
        auxBibliotecasLoading.value = false;
      }
    });
  }

  /**
   * Load ALL bibliotecas for the aux selector (used for bibliotecarios,
   * who are not restricted to a single carrera).
   */
  async function loadAllBibliotecasForPicker() {
    if (allBibliotecas.value.length) {
      auxBibliotecas.value = allBibliotecas.value;
      return;
    }
    auxBibliotecasLoading.value = true;
    try {
      const res = await bibliotecasService.getAll();
      const raw = res.data as any;
      const list: BibliotecaResponse[] = Array.isArray(raw)
        ? raw
        : (raw?.data ?? []);
      auxBibliotecas.value = list;
    } catch {
      /* silent */
    } finally {
      auxBibliotecasLoading.value = false;
    }
  }

  // ─── Duplicate check (checks encargados of the selected library) ──────────
  function isDuplicate(user: UserResponse): boolean {
    if (!auxBibliotecaId.value) return false;
    // Check in the loaded list
    const bib = auxBibliotecas.value.find(
      (b) => b.id_biblioteca === Number(auxBibliotecaId.value),
    );
    if (bib?.encargados?.some((e) => e.id_usuario === user.id_usuario))
      return true;
    // Also check in global cache (more up-to-date)
    const bibGlobal = allBibliotecas.value.find(
      (b) => b.id_biblioteca === Number(auxBibliotecaId.value),
    );
    return (
      bibGlobal?.encargados?.some((e) => e.id_usuario === user.id_usuario) ??
      false
    );
  }

  function onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    auxResolucionFile.value = file;
    auxResolucionPreview.value = URL.createObjectURL(file);
  }

  // ─── Get selected library object ──────────────────────────────────────────
  function selectedBib(): BibliotecaResponse | null {
    if (!auxBibliotecaId.value) return null;
    return (
      auxBibliotecas.value.find(
        (b) => b.id_biblioteca === Number(auxBibliotecaId.value),
      ) ??
      allBibliotecas.value.find(
        (b) => b.id_biblioteca === Number(auxBibliotecaId.value),
      ) ??
      null
    );
  }

  // ─── Assign ───────────────────────────────────────────────────────────────
  /**
   * @param user         The user to assign
   * @param needsCarrera If true (estudiante), auxCarreraId is required
   */
  async function assignAux(
    user: UserResponse,
    needsCarrera = true,
  ): Promise<boolean> {
    auxError.value = "";
    auxSuccess.value = false;

    if (needsCarrera && !auxCarreraId.value) {
      auxError.value = "Selecciona la carrera del estudiante";
      return false;
    }
    if (!auxBibliotecaId.value) {
      auxError.value = "Selecciona una biblioteca";
      return false;
    }
    // Frontend duplicate check
    if (isDuplicate(user)) {
      auxError.value = `${user.persona?.nombreCompleto ?? user.username} ya es encargado de esta biblioteca`;
      return false;
    }

    auxLoading.value = true;
    try {
      await bibliotecasService.assignEncargados(
        Number(auxBibliotecaId.value),
        [user.id_usuario],
        auxResolucionFile.value,
      );

      const bibNombre = selectedBib()?.nombre ?? "";
      auxSuccess.value = true;
      ui.toast.success(
        "Encargado asignado",
        `${user.persona?.nombreCompleto ?? user.username} → ${bibNombre}`,
      );

      // ✅ Refresh global bibliotecas cache so the UI reflects the new encargado
      await refreshBibliotecas();

      // Reset picker fields (keep modal open for potential multiple assignments)
      auxCarreraId.value = "";
      auxBibliotecaId.value = "";
      auxBibliotecas.value = [];
      auxResolucionFile.value = null;
      auxResolucionPreview.value = "";
      return true;
    } catch (e: unknown) {
      let msg = "No se pudo asignar como encargado";

      if (axios.isAxiosError(e)) {
        msg =
          e.response?.data?.message ||
          e.response?.data?.error ||
          e.message;
      } else if (e instanceof Error) {
        msg = e.message;
      }

      const lower = msg.toLowerCase();

      if (
        lower.includes("duplicado") ||
        lower.includes("ya está") ||
        lower.includes("already") ||
        lower.includes("ya es encargado")
      ) {
        msg = `${user.persona?.nombreCompleto ?? user.username} ya es encargado de esta biblioteca`;
      }

      auxError.value = msg;

      ui.toast.error(
        "Error al asignar encargado",
        msg,
      );

      return false;
    } finally {
      auxLoading.value = false;
    }
  }

  return {
    auxCarreraId,
    auxBibliotecaId,
    auxBibliotecas,
    auxBibliotecasLoading,
    auxLoading,
    auxError,
    auxSuccess,
    auxResolucionFile,
    auxResolucionPreview,
    resetAux,
    watchCarrera,
    loadAllBibliotecasForPicker,
    assignAux,
    onFileSelected,
    selectedBib,
    isDuplicate,
  };
}
