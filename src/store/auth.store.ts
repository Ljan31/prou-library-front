import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { authService, type LoginCredentials } from "@/services/auth.service";
import type { AuthUser, RoleKey, MeResponseData } from "@/types";

// ─── Role normalizer ──────────────────────────────────────────────────────
function normalizeRoles(raw: unknown): RoleKey[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((r) => {
      if (typeof r === "string") return r as RoleKey;
      if (typeof r === "object" && r !== null && "name" in r)
        return (r as { name: RoleKey }).name;
      return null;
    })
    .filter(Boolean) as RoleKey[];
}

function mapMeToAuthUser(me: MeResponseData): AuthUser {
  return {
    id: me.id_usuario,
    username: me.username,
    roles: normalizeRoles(me.roles),
    persona: me.persona,
    biblioteca: me.biblioteca ?? null,
  };
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

  const primaryRole = computed<RoleKey | null>(() => {
    if (isAdmin.value) return "ROLE_ADMIN";
    if (isBibliotecario.value) return "ROLE_BIBLIOTECARIO";
    if (isEstudiante.value) return "ROLE_ESTUDIANTE";
    return null;
  });

  const displayName = computed(
    () => user.value?.persona.nombreCompleto ?? user.value?.username ?? "",
  );

  const bibliotecaNombre = computed(
    () => user.value?.biblioteca?.nombre ?? null,
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

      // Save token first (interceptor will attach it to the /me call)
      setToken(loginData.token);

      // Build user from login response (roles are strings here)
      user.value = {
        id: loginData.id,
        username: loginData.username,
        roles: normalizeRoles(loginData.roles),
        persona: loginData.persona,
        biblioteca: loginData.biblioteca ?? null,
      };

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
    // Methods
    hasRole,
    hasAnyRole,
    login,
    logout,
    initSession,
    clearSession,
  };
});
