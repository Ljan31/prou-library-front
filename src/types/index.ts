// ─── Auth & User Types ─────────────────────────────────────────────────────

export type RoleKey = "ROLE_ADMIN" | "ROLE_BIBLIOTECARIO" | "ROLE_ESTUDIANTE";

export interface Persona {
  id_persona: number;
  nombre: string;
  apellido_pat: string;
  apellido_mat: string;
  nombreCompleto: string;
  ci: number;
  celular: string;
  email: string;
}

export interface Biblioteca {
  id_biblioteca: number;
  nombre: string;
}

export interface RoleObject {
  id_role: number;
  name: RoleKey;
}

/** Shape returned by POST /api/auth/login */
export interface LoginResponseData {
  token: string;
  id: number;
  username: string;
  roles: RoleKey[]; // array of strings from login
  persona: Persona;
  biblioteca: Biblioteca | null;
}

/** Shape returned by GET /api/auth/me */
export interface MeResponseData {
  id_usuario: number;
  username: string;
  roles: RoleObject[]; // array of objects from /me
  persona: Persona;
  biblioteca: Biblioteca | null;
}

/** Unified internal user shape used across the app */
export interface AuthUser {
  id: number;
  username: string;
  roles: RoleKey[]; // always normalized to string array
  persona: Persona;
  biblioteca: Biblioteca | null;
}

// ─── API Response wrapper ──────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data: T;
}

// ─── Role Permission Map ───────────────────────────────────────────────────

export interface NavItem {
  label: string;
  to: string;
  icon: string;
  roles: RoleKey[];
  children?: NavItem[];
}
