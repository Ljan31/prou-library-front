import api from "@/services/axios";
import type { AxiosResponse } from "axios";

// ─── Types ────────────────────────────────────────────────────────────────

export interface CarreraBasic {
  id_carrera: number;
  nombre_carrera: string;
  codigo_carrera: string | null;
  matricula: string | null;
}

export interface UserCarreraItem {
  carreraId: number;
  matricula?: string;
}

export interface CreateEstudiantePayload {
  username: string;
  password: string;
  persona: {
    nombre: string;
    apellido_pat: string;
    apellido_mat?: string;
    ci: number;
    celular?: string;
    email: string;
  };
  userCarreras?: UserCarreraItem[];
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  timestamp: string;
  errors: unknown | null;
}

export interface UserCarreraResponse {
  id: number;
  usuario: {
    id_usuario: number;
    username: string;
    nombreCompleto: string | null;
    email: string | null;
  };
  carrera: {
    id_carrera: number;
    nombre_carrera: string;
    codigo_carrera: string | null;
    matricula: string | null;
  };
  matricula: string | null;
  fechaAsignacion: string;
}

export interface AssignCarreraPayload {
  usuarioId: number;
  carreraId: number;
  matricula?: string;
}

// ─── Student service ──────────────────────────────────────────────────────

export const estudianteService = {
  /** POST /api/users/estudiante — registro público, sin auth */
  register(
    payload: CreateEstudiantePayload,
  ): Promise<AxiosResponse<ApiResponse<unknown>>> {
    return api.post("/users/estudiante", payload);
  },
};

// ─── Career assignment service ────────────────────────────────────────────

export const carreraService = {
  /** GET /api/carreras — lista todas las carreras disponibles */
  getAll(): Promise<AxiosResponse<CarreraBasic[]>> {
    return api.get("/carreras");
  },

  /** GET /api/usuarios-carreras/usuario/:id — carreras de un usuario */
  getByUsuario(
    usuarioId: number,
  ): Promise<AxiosResponse<ApiResponse<CarreraBasic[]>>> {
    return api.get(`/usuarios-carreras/usuario/${usuarioId}`);
  },

  /** POST /api/usuarios-carreras — asignar carrera */
  assign(
    payload: AssignCarreraPayload,
  ): Promise<AxiosResponse<ApiResponse<UserCarreraResponse>>> {
    return api.post("/usuarios-carreras", payload);
  },

  /** PUT /api/usuarios-carreras/:id — actualizar asignación */
  update(
    id: number,
    payload: AssignCarreraPayload,
  ): Promise<AxiosResponse<ApiResponse<UserCarreraResponse>>> {
    return api.put(`/usuarios-carreras/${id}`, payload);
  },

  /** DELETE /api/usuarios-carreras/usuario/:userId/carrera/:carreraId */
  remove(
    usuarioId: number,
    carreraId: number,
  ): Promise<AxiosResponse<ApiResponse<null>>> {
    return api.delete(
      `/usuarios-carreras/usuario/${usuarioId}/carrera/${carreraId}`,
    );
  },
};
