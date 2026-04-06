/**
 * useUsers — estado y lógica compartida del módulo de usuarios.
 * Estado a nivel de módulo (singleton) para que UsersView y sus
 * sub-componentes compartan la misma lista reactiva sin prop-drilling.
 */
import { ref, computed } from "vue";
import { userService } from "@/services/user.service";
import { carreraService } from "@/services/estudiante.service";
import { bibliotecasService } from "@/services/bibliotecas.service";
import { useUiStore } from "@/stores/ui.store";
import type { UserResponse, RoleData } from "@/services/user.service";
import type { BibliotecaResponse } from "@/services/bibliotecas.service";

// ─── Module-level singleton state ─────────────────────────────────────────
const users = ref<UserResponse[]>([]);
const roles = ref<RoleData[]>([]);
const allCarreras = ref<
  {
    id_carrera: number;
    nombre_carrera: string;
    codigo_carrera: string | null;
  }[]
>([]);
const allBibliotecas = ref<BibliotecaResponse[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);

// ─── Generic response unwrapper ───────────────────────────────────────────
// Backend may return raw array OR { success, data: array }
function unwrapList<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === "object" && "data" in (data as object)) {
    const inner = (data as { data: unknown }).data;
    if (Array.isArray(inner)) return inner as T[];
  }
  return [];
}

function unwrapOne<T>(data: unknown): T {
  if (
    data &&
    typeof data === "object" &&
    "data" in (data as object) &&
    "success" in (data as object)
  ) {
    return (data as { data: T }).data;
  }
  return data as T;
}

// ─── Role helpers ─────────────────────────────────────────────────────────
export const roleLabelMap: Record<string, string> = {
  ROLE_ADMIN: "Admin",
  ROLE_BIBLIOTECARIO: "Bibliotecario",
  ROLE_ESTUDIANTE: "Estudiante",
};

export const roleBadgeMap: Record<string, string> = {
  ROLE_ADMIN: "bg-indigo-100 text-indigo-700 ring-indigo-200",
  ROLE_BIBLIOTECARIO: "bg-emerald-100 text-emerald-700 ring-emerald-200",
  ROLE_ESTUDIANTE: "bg-sky-100 text-sky-700 ring-sky-200",
};

export function roleLabel(name: string) {
  return roleLabelMap[name] ?? name;
}
export function roleBadgeClass(name: string) {
  return roleBadgeMap[name] ?? "bg-slate-100 text-slate-600 ring-slate-200";
}

// ─── Composable ───────────────────────────────────────────────────────────
export function useUsers() {
  const ui = useUiStore();

  // ── Fetch users ───────────────────────────────────────────────────────────
  async function fetchUsers(searchQuery = "", filterRole = "") {
    loading.value = true;
    error.value = null;
    try {
      let res;
      if (searchQuery.trim())
        res = await userService.search(searchQuery.trim());
      else if (filterRole) res = await userService.filterByRole(filterRole);
      else res = await userService.getAll();
      users.value = unwrapList<UserResponse>(res.data);
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : "Error al cargar usuarios";
    } finally {
      loading.value = false;
    }
  }

  async function fetchRoles() {
    try {
      const res = await userService.getRoles();
      roles.value = unwrapList<RoleData>(res.data);
    } catch {
      /* silent */
    }
  }

  async function loadAllCarreras() {
    try {
      const res = await carreraService.getAll();
      allCarreras.value = unwrapList(res.data);
    } catch {
      /* silent */
    }
  }

  async function loadBibliotecas() {
    try {
      const res = await bibliotecasService.getAll();
      allBibliotecas.value = unwrapList<BibliotecaResponse>(res.data);
    } catch {
      /* silent */
    }
  }

  // ── Toggle enabled ────────────────────────────────────────────────────────
  const togglingId = ref<number | null>(null);

  async function toggleEnabled(user: UserResponse) {
    togglingId.value = user.id_usuario;
    try {
      const res = await userService.toggleEnabled(user.id_usuario);
      // Always unwrap — backend may return ApiResponse<UserResponse> or UserResponse directly
      const updated: UserResponse = unwrapOne<UserResponse>(res.data);

      // Guard: make sure we got a valid object with persona before patching the list
      if (!updated || !updated.id_usuario) {
        throw new Error("Respuesta inesperada del servidor");
      }

      const idx = users.value.findIndex(
        (u) => u.id_usuario === user.id_usuario,
      );
      if (idx !== -1) users.value[idx] = updated;

      ui.toast.success(
        updated.enabled ? "Usuario activado" : "Usuario desactivado",
        updated.persona?.nombreCompleto ?? updated.username,
      );
    } catch (e: unknown) {
      ui.toast.error(
        "Error",
        e instanceof Error ? e.message : "No se pudo cambiar el estado",
      );
    } finally {
      togglingId.value = null;
    }
  }

  // ── Update user in list (called by UserEditModal via emit) ────────────────
  function patchUser(updated: UserResponse) {
    if (!updated?.id_usuario) return;
    const idx = users.value.findIndex(
      (u) => u.id_usuario === updated.id_usuario,
    );
    if (idx !== -1) users.value[idx] = updated;
    else users.value.unshift(updated);
  }

  // ── Role name by id ───────────────────────────────────────────────────────
  function roleNameForId(id: string | number) {
    return roles.value.find((r) => r.id_role === Number(id))?.name ?? "";
  }

  // ── Stats ─────────────────────────────────────────────────────────────────
  const stats = computed(() => ({
    total: users.value.length,
    active: users.value.filter((u) => u.enabled).length,
    admins: users.value.filter(
      (u) =>
        Array.isArray(u.roles) && u.roles.some((r) => r.name === "ROLE_ADMIN"),
    ).length,
    bibliotecarios: users.value.filter(
      (u) =>
        Array.isArray(u.roles) &&
        u.roles.some((r) => r.name === "ROLE_BIBLIOTECARIO"),
    ).length,
    estudiantes: users.value.filter(
      (u) =>
        Array.isArray(u.roles) &&
        u.roles.some((r) => r.name === "ROLE_ESTUDIANTE"),
    ).length,
  }));

  return {
    // State
    users,
    roles,
    allCarreras,
    allBibliotecas,
    loading,
    error,
    togglingId,
    stats,
    // Actions
    fetchUsers,
    fetchRoles,
    loadAllCarreras,
    loadBibliotecas,
    toggleEnabled,
    patchUser,
    roleNameForId,
  };
}
