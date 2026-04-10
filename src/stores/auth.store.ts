import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { authService, type LoginCredentials } from "@/services/auth.service";
import type { AuthUser, RoleKey, MeResponseData } from "@/types";
import type { Biblioteca } from "@/services/bibliotecas.service";

// ─── Role normalizer ──────────────────────────────────────────────────────
function normalizeRoles(raw: unknown): RoleKey[] {
  if (!Array.isArray(raw)) return [];

  return (
    raw
      .map((r) => {
        if (typeof r === "string") return r as RoleKey;
        if (typeof r === "object" && r !== null && "name" in r)
          return (r as { name: RoleKey }).name;
        return null;
      })
      // .filter(Boolean) as RoleKey[];
      .filter((r): r is RoleKey => Boolean(r))
  );
}
// Nueva función para normalizar bibliotecas
function normalizeBibliotecas(raw: unknown): Biblioteca[] {
  if (Array.isArray(raw)) {
    return raw;
  }
  if (raw && typeof raw === "object") {
    return [raw as Biblioteca]; // por si /me devuelve objeto singular
  }
  return [];
}
function mapMeToAuthUser(me: MeResponseData): AuthUser {
  return {
    id: me.id_usuario,
    username: me.username,
    roles: normalizeRoles(me.roles),
    persona: me.persona,
    biblioteca: normalizeBibliotecas(me.biblioteca ?? me.biblioteca),
  };
}
// Nueva función auxiliar para extraer la biblioteca (singular)
function extractBiblioteca(loginData: any): any {
  // Si ya viene como objeto (caso del /me)
  if (loginData.biblioteca) {
    return loginData.biblioteca;
  }

  // Si viene como array (caso del login)
  if (
    Array.isArray(loginData.bibliotecas) &&
    loginData.bibliotecas.length > 0
  ) {
    return loginData.bibliotecas[0]; // tomamos la primera (normalmente solo tiene una)
  }

  return null;
}

// ─── Store ────────────────────────────────────────────────────────────────
export const useAuthStore = defineStore("auth", () => {
  const user = ref<AuthUser | null>(null);
  const token = ref<string | null>(localStorage.getItem("sigeb_token"));
  const loading = ref(false);
  const error = ref<string | null>(null);
  const initialized = ref(false);

  // ─── Getters ────────────────────────────────────────────────────────────
  const isAuthenticated = computed(() => !!user.value && !!token.value);

  const roles = computed<RoleKey[]>(() => user.value?.roles ?? []);

  const isAdmin = computed(() => roles.value.includes("ROLE_ADMIN"));
  const isBibliotecario = computed(() =>
    roles.value.includes("ROLE_BIBLIOTECARIO"),
  );
  const isEstudiante = computed(() => roles.value.includes("ROLE_ESTUDIANTE"));
  // const isAuxiliar = computed(() => roles.value.includes("ROLE_AUXILIAR"));
  const primaryRole = computed<RoleKey | null>(() => {
    if (isAdmin.value) return "ROLE_ADMIN";
    if (isBibliotecario.value) return "ROLE_BIBLIOTECARIO";
    if (isEstudiante.value) return "ROLE_ESTUDIANTE";
    return null;
  });

  const displayName = computed(
    () => user.value?.persona.nombreCompleto ?? user.value?.username ?? "",
  );

  const bibliotecas = computed(() => user.value?.biblioteca ?? []);
  // const bibliotecaNombre = computed(
  //   () => user.value?.biblioteca?.nombre ?? null,
  // );
  // Nombres de todas las bibliotecas (como array de strings)
  const bibliotecaNombre = computed<string[]>(() =>
    bibliotecas.value.map((b) => b.nombre).filter(Boolean),
  );

  // Nombres unidos en un solo string (útil para mostrar en UI)
  const bibliotecasNombresTexto = computed(
    () => bibliotecaNombre.value.join(", ") || "Sin biblioteca asignada",
  );
  function hasRole(role: RoleKey): boolean {
    return roles.value.includes(role);
  }

  function hasAnyRole(checkRoles: RoleKey[]): boolean {
    return checkRoles.some((r) => roles.value.includes(r));
  }

  // ─── Actions ────────────────────────────────────────────────────────────
  function setToken(newToken: string) {
    token.value = newToken;
    localStorage.setItem("sigeb_token", newToken);
  }

  function clearSession() {
    user.value = null;
    token.value = null;
    error.value = null;
    localStorage.removeItem("sigeb_token");
  }

  async function login(credentials: LoginCredentials) {
    loading.value = true;
    error.value = null;
    try {
      const loginData = await authService.login(credentials);
      console.log("loginData", loginData);
      // Save token first (interceptor will attach it to the /me call)
      setToken(loginData.token);

      // Build user from login response (roles are strings here)
      user.value = {
        id: loginData.id,
        username: loginData.username,
        roles: normalizeRoles(loginData.roles),
        persona: loginData.persona,
        biblioteca: normalizeBibliotecas(
          loginData.bibliotecas ?? loginData.bibliotecas,
        ),
      };
      console.log("user", user);
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error de autenticación";
      error.value = msg;
      clearSession();
      return false;
    } finally {
      loading.value = false;
    }
  }

  async function logout() {
    loading.value = true;
    try {
      await authService.logout();
    } finally {
      clearSession();
      loading.value = false;
    }
  }

  /**
   * Restore session from stored token.
   * Called once on app startup.
   */
  async function initSession() {
    if (initialized.value) return;
    initialized.value = true;

    if (!token.value) return;

    loading.value = true;
    try {
      const me = await authService.me();
      user.value = mapMeToAuthUser(me);
    } catch {
      // Token invalid / expired
      clearSession();
    } finally {
      loading.value = false;
    }
  }

  return {
    // State
    user,
    token,
    loading,
    error,
    initialized,
    // Getters
    isAuthenticated,
    roles,
    isAdmin,
    isBibliotecario,
    isEstudiante,
    primaryRole,
    displayName,
    bibliotecaNombre,
    bibliotecasNombresTexto,
    // Methods
    hasRole,
    hasAnyRole,
    login,
    logout,
    initSession,
    clearSession,
  };
});
