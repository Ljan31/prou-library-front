/**
 * useAuxAssign — lógica reutilizable para el flujo de asignar
 * un estudiante como auxiliar de biblioteca.
 *
 * Usado por UserEditModal y UserDetailPanel.
 */
import { ref, watch } from "vue";
import { useUiStore } from "@/stores/ui.store";
import { useUsers } from "@/composables/useUsers";
import { bibliotecasService } from "@/services/bibliotecas.service";
import type {
  BibliotecaResponse,
  EncargadoResponse,
} from "@/services/bibliotecas.service";
import type { CarreraBasic } from "@/services/estudiante.service";
import type { UserResponse } from "@/services/user.service";

export function useAuxAssign() {
  const ui = useUiStore();
  const { allBibliotecas } = useUsers();

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

  // Cuando cambia la carrera, cargar bibliotecas de esa carrera
  function watchCarrera() {
    watch(auxCarreraId, async (carreraId) => {
      auxBibliotecaId.value = "";
      auxBibliotecas.value = [];
      auxError.value = "";
      auxSuccess.value = false;
      if (!carreraId) return;
      auxBibliotecasLoading.value = true;
      try {
        const local = allBibliotecas.value.filter(
          (b) => b.carrera?.id_carrera === Number(carreraId),
        );
        if (local.length) {
          auxBibliotecas.value = local;
        } else {
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

  // Validar: ¿ya es encargado de esa biblioteca?
  function isDuplicate(user: UserResponse): boolean {
    console.log("isduplicate");
    console.log(user);
    console.log(auxBibliotecaId.value);
    if (!auxBibliotecaId.value) return false;
    const bib = auxBibliotecas.value.find(
      (b) => b.id_biblioteca === Number(auxBibliotecaId.value),
    );
    console.log(bib);
    return (
      bib?.encargados?.some((e) => e.id_usuario === user.id_usuario) ?? false
    );
  }

  function onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    auxResolucionFile.value = file;
    auxResolucionPreview.value = URL.createObjectURL(file);
  }

  async function assignAux(
    user: UserResponse,
    carreras: CarreraBasic[],
  ): Promise<boolean> {
    auxError.value = "";
    auxSuccess.value = false;
    if (!auxCarreraId.value) {
      auxError.value = "Selecciona la carrera";
      return false;
    }
    if (!auxBibliotecaId.value) {
      auxError.value = "Selecciona una biblioteca";
      return false;
    }
    if (isDuplicate(user)) {
      auxError.value = `${user.persona?.nombreCompleto ?? user.username} ya es encargado de esta biblioteca`;
      return false;
    }
    auxLoading.value = true;
    try {
      await bibliotecasService.assignEncargados(Number(auxBibliotecaId.value), [
        user.id_usuario,
      ]);

      // Si hay imagen de resolución, subirla
      if (auxResolucionFile.value) {
        try {
          await bibliotecasService.uploadEncargadoImagen(
            Number(auxBibliotecaId.value),
            user.id_usuario,
            auxResolucionFile.value,
          );
        } catch {
          // La asignación fue exitosa aunque la imagen falló — notificar sin bloquear
          ui.toast.warning(
            "Auxiliar asignado",
            "No se pudo subir la imagen de resolución",
          );
        }
      }

      const bibNombre =
        auxBibliotecas.value.find(
          (b) => b.id_biblioteca === Number(auxBibliotecaId.value),
        )?.nombre ?? "";
      auxSuccess.value = true;
      ui.toast.success(
        "Auxiliar asignado",
        `${user.persona?.nombreCompleto ?? user.username} → ${bibNombre}`,
      );
      // Reset picker after success (but keep section open for multiple assignments)
      auxCarreraId.value = "";
      auxBibliotecaId.value = "";
      auxBibliotecas.value = [];
      auxResolucionFile.value = null;
      auxResolucionPreview.value = "";
      return true;
    } catch (e: unknown) {
      const msg =
        e instanceof Error ? e.message : "No se pudo asignar como auxiliar";
      // Backend duplicate check
      if (
        msg.toLowerCase().includes("duplicado") ||
        msg.toLowerCase().includes("ya está")
      ) {
        auxError.value = "Este usuario ya es encargado de esta biblioteca";
      } else {
        auxError.value = msg;
      }
      return false;
    } finally {
      auxLoading.value = false;
    }
  }

  // Obtener la biblioteca seleccionada (para mostrar encargados actuales)
  function selectedBib() {
    return (
      auxBibliotecas.value.find(
        (b) => b.id_biblioteca === Number(auxBibliotecaId.value),
      ) ?? null
    );
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
    assignAux,
    onFileSelected,
    selectedBib,
    isDuplicate,
  };
}
