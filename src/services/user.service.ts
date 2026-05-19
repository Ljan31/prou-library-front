import api from "@/services/axios";
import type { AxiosResponse } from "axios";

export interface PersonaData {
  id_persona?: number;
  nombre: string;
  apellido_pat: string;
  apellido_mat: string;
  nombreCompleto?: string;
  ci: number;
  celular: string;
  email: string;
}

export interface RoleData {
  id_role: number;
  name: string;
}

export interface BibliotecaData {
  id_biblioteca: number;
  nombre: string;
}

export interface UserResponse {
  id_usuario: number;
  username: string;
  enabled: boolean;
  persona: PersonaData;
  roles: RoleData[];
  biblioteca: BibliotecaData | null;
}

export interface CreateUserPayload {
  username: string;
  password: string;
  persona: Omit<PersonaData, "id_persona" | "nombreCompleto">;
  roleIds: number[];
}

export interface UpdateUserPayload {
  nombre?: string;
  apellido_pat?: string;
  apellido_mat?: string;
  celular?: string;
  enabled?: boolean;
}
export interface ChangePasswordRequest {
  currentPassword: string
  newPassword: string
  confirmPassword: string
}

export interface AdminResetPasswordResponse {
  temporaryPassword: string
}

export const userService = {
  getAll(): Promise<AxiosResponse<UserResponse[]>> {
    return api.get("/users");
  },

  getById(id: number): Promise<AxiosResponse<UserResponse>> {
    return api.get(`/users/${id}`);
  },

  search(q: string): Promise<AxiosResponse<UserResponse[]>> {
    return api.get("/users/search", { params: { q } });
  },

  filterByRole(roleName: string): Promise<AxiosResponse<UserResponse[]>> {
    return api.get("/users/by-role", { params: { roleName } });
  },

  create(payload: CreateUserPayload): Promise<AxiosResponse<UserResponse>> {
    return api.post("/users", payload);
  },

  update(
    id: number,
    payload: UpdateUserPayload,
  ): Promise<AxiosResponse<UserResponse>> {
    return api.put(`/users/${id}`, payload);
  },

  toggleEnabled(id: number): Promise<AxiosResponse<UserResponse>> {
    return api.put(`/users/${id}/toggle-enabled`);
  },

  getRoles(): Promise<AxiosResponse<RoleData[]>> {
    return api.get("/roles");
  },
  /**
  * El propio usuario cambia su contraseña.
  * PUT /api/users/change-password
  */
  changePassword(payload: ChangePasswordRequest): Promise<AxiosResponse> {
    return api.put('/users/change-password', payload)
  },

  /**
   * Admin o Bibliotecario restablece la contraseña de otro usuario.
   * Devuelve una contraseña temporal.
   * PUT /api/users/{id}/reset-password
   */
  adminResetPassword(id: number): Promise<AxiosResponse<{ data: AdminResetPasswordResponse }>> {
    return api.put(`/users/${id}/reset-password`)
  },
};
