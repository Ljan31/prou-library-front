/**
 * usePermissions — Composable de permisos por rol.
 * Centraliza la lógica de autorización para que los Equipos 2 y 3
 * no dependan directamente del store en cada componente.
 *
 * Uso:
 *   const { can, isAdmin, isBibliotecario } = usePermissions()
 *   v-if="can('ROLE_ADMIN')"
 */
import { computed } from "vue";
import { useAuthStore } from "@/store/auth.store";
import type { RoleKey } from "@/types";

export function usePermissions() {
  const auth = useAuthStore();

  function can(...roles: RoleKey[]): boolean {
    return auth.hasAnyRole(roles);
  }

  const isAdmin = computed(() => auth.isAdmin);
  const isBibliotecario = computed(() => auth.isBibliotecario);
  const isEstudiante = computed(() => auth.isEstudiante);
  const isStaff = computed(() => auth.isAdmin || auth.isBibliotecario);

  return { can, isAdmin, isBibliotecario, isEstudiante, isStaff };
}
