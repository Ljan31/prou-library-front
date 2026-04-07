/**
 * useUsers — estado y lógica compartida del módulo de usuarios.
 * Estado singleton a nivel de módulo para evitar prop-drilling.
 */
import { ref, computed } from "vue";
import { userService } from "@/services/user.service";
import { carreraService } from "@/services/estudiante.service";
import { bibliotecasService } from "@/services/bibliotecas.service";
import { useUiStore } from "@/stores/ui.store";
import type { UserResponse, RoleData } from "@/services/user.service";
import type { BibliotecaResponse } from "@/services/bibliotecas.service";

// ─── Singleton state ──────────────────────────────────────────────────────
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

// ─── Response unwrappers ──────────────────────────────────────────────────
/** Extrae un array de cualquier forma de respuesta del backend */
export function unwrapList<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === "object") {
    const d = (data as Record<string, unknown>).data;
    if (Array.isArray(d)) return d as T[];
  }
  return [];
}

/** Extrae un objeto único de cualquier forma de respuesta del backend */
export function unwrapOne<T>(data: unknown): T {
  if (
    data &&
    typeof data === "object" &&
    "success" in (data as object) &&
    "data" in (data as object)
  ) {
    return (data as { data: T }).data;
  }
  return data as T;
}

/** Valida que el objeto tiene los campos mínimos de UserResponse */
function isValidUser(u: unknown): u is UserResponse {
  if (!u || typeof u !== "object") return false;
  const obj = u as Record<string, unknown>;
  return typeof obj.id_usuario === "number" && typeof obj.username === "string";
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

  // ── Fetch ─────────────────────────────────────────────────────────────────
  async function fetchUsers(searchQuery = "", filterRole = "") {
    loading.value = true;
    error.value = null;
    try {
      let res;
      if (searchQuery.trim())
        res = await userService.search(searchQuery.trim());
      else if (filterRole) res = await userService.filterByRole(filterRole);
      else res = await userService.getAll();
      // Filter out any malformed items before storing
      users.value = unwrapList<UserResponse>(res.data).filter(isValidUser);
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
      console.log("res", res);
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
      const updated = unwrapOne<UserResponse>(res.data);
      if (!isValidUser(updated))
        throw new Error("Respuesta inesperada del servidor");
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

  // ── Patch / add user in list ──────────────────────────────────────────────
  function patchUser(updated: UserResponse) {
    if (!isValidUser(updated)) return;
    const idx = users.value.findIndex(
      (u) => u.id_usuario === updated.id_usuario,
    );
    if (idx !== -1) users.value[idx] = updated;
    else users.value.unshift(updated);
  }

  /** Adds a newly created user to the top of the list (safe) */
  function addUser(raw: unknown) {
    const u = isValidUser(raw) ? raw : unwrapOne<UserResponse>(raw);
    if (isValidUser(u)) users.value.unshift(u);
  }

  // ── Role helper ───────────────────────────────────────────────────────────
  function roleNameForId(id: string | number) {
    return roles.value.find((r) => r.id_role === Number(id))?.name ?? "";
  }

  // ── Stats (fully defensive — guards every field) ──────────────────────────
  const stats = computed(() => {
    const valid = users.value.filter(isValidUser);
    return {
      total: valid.length,
      active: valid.filter((u) => u.enabled === true).length,
      admins: valid.filter(
        (u) =>
          Array.isArray(u.roles) &&
          u.roles.some((r) => r.name === "ROLE_ADMIN"),
      ).length,
      bibliotecarios: valid.filter(
        (u) =>
          Array.isArray(u.roles) &&
          u.roles.some((r) => r.name === "ROLE_BIBLIOTECARIO"),
      ).length,
      estudiantes: valid.filter(
        (u) =>
          Array.isArray(u.roles) &&
          u.roles.some((r) => r.name === "ROLE_ESTUDIANTE"),
      ).length,
    };
  });

  return {
    users,
    roles,
    allCarreras,
    allBibliotecas,
    loading,
    error,
    togglingId,
    stats,
    fetchUsers,
    fetchRoles,
    loadAllCarreras,
    loadBibliotecas,
    toggleEnabled,
    patchUser,
    addUser,
    roleNameForId,
  };
}
