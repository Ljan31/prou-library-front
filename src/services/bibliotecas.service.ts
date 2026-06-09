import api from "./axios";
import type { AxiosResponse } from "axios";
// ─── Types ────────────────────────────────────────────────────────────────

export interface CarreraBasic {
  id_carrera: number;
  nombre_carrera: string;
  codigo_carrera: string;
}

export interface CarreraDetail extends CarreraBasic {
  bibliotecasCount: number;
}

export interface Biblioteca {
  id_biblioteca: number;
  nombre: string;
  tipoBiblioteca: "CENTRAL" | "CARRERA" | "ESPECIALIZADA";
  carrera?: CarreraBasic | null;
  direccion?: string;
  telefono?: string;
  email?: string;
  logoUrl?: string;
  horario_atencion?: string;
  estado: "ACTIVA" | "INACTIVA";
  ejemplaresTotal: number;
  ejemplaresDisponibles: number;
}

export interface CreateBibliotecaPayload {
  nombre: string;
  tipoBiblioteca: "CENTRAL" | "CARRERA" | "ESPECIALIZADA";
  carreraId?: number | null;
  direccion?: string;
  telefono?: string;
  email?: string;
  horario_atencion?: string;
  encargadoId?: number | null;
  estado: "ACTIVA" | "INACTIVA";
}

export interface CreateCarreraPayload {
  nombre_carrera: string;
  codigo_carrera: string;
}

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  timestamp?: string;
  errors?: unknown;
}
export interface EncargadoResponse {
  id_usuario: number;
  username: string;
  nombreCompleto: string;
  rol: "PRINCIPAL" | "AUXILIAR";
}

export interface BibliotecaResponse {
  id_biblioteca: number;
  nombre: string;
  tipoBiblioteca?: string;
  estado?: string;
  carrera?: { id_carrera: number; nombre_carrera: string } | null;
  direccion?: string;
  telefono?: string;
  email?: string;
  logoUrl?: string;
  horario_atencion?: string;
  ejemplaresTotal?: number;
  ejemplaresDisponibles?: number;
  encargados?: EncargadoResponse[];
}

function buildFormData(
  payload: Partial<CreateBibliotecaPayload>,
  logoFile?: File | null,
): FormData {
  const fd = new FormData();

  // fd.append("datos", JSON.stringify(payload));
  fd.append(
    "datos",
    new Blob([JSON.stringify(payload)], { type: "application/json" }),
  );

  if (logoFile) {
    fd.append("logo", logoFile);
  }

  return fd;
}

function buildEncargadosFormData(
  encargadosIds: number[],
  respaldoFile?: File | null,
): FormData {
  const fd = new FormData();

  fd.append(
    "encargadosIds",
    new Blob([JSON.stringify(encargadosIds)], { type: "application/json" }),
  );

  if (respaldoFile) {
    fd.append("respaldo", respaldoFile);
  }

  return fd;
}
// ─── Bibliotecas ──────────────────────────────────────────────────────────

export const bibliotecasService = {
  getAll(): Promise<ApiResponse<Biblioteca[]>> {
    return api.get("/bibliotecas").then((r) => r.data);
  },

  getById(id: number): Promise<ApiResponse<Biblioteca>> {
    return api.get(`/bibliotecas/${id}`).then((r) => r.data);
  },

  create(
    payload: CreateBibliotecaPayload,
    logoFile?: File | null,
  ): Promise<ApiResponse<Biblioteca>> {
    const fd = buildFormData(payload, logoFile);
    return api.post("/bibliotecas", fd).then((r) => {
      return r.data;
    });
  },

  update(
    id: number,
    payload: Partial<CreateBibliotecaPayload>,
    logoFile?: File | null,
  ): Promise<ApiResponse<Biblioteca>> {
    const fd = buildFormData(payload, logoFile);
    return api.put(`/bibliotecas/${id}`, fd).then((r) => r.data);
  },

  remove(id: number): Promise<AxiosResponse<ApiResponse<unknown>>> {
    // remove(id: number): Promise<ApiResponse<null>> {
    return api.delete(`/bibliotecas/${id}`).then((r) => r.data);
  },
  getByCarrera(carreraId: number): Promise<ApiResponse<Biblioteca[]>> {
    return api.get(`/bibliotecas/carrera/${carreraId}`).then((r) => r.data);
  },

  /** Asignar encargados a una biblioteca */
  assignEncargados(
    bibliotecaId: number,
    encargadosIds: number[],
    respaldoFile?: File | null,
  ): Promise<ApiResponse<null>> {
    const fd = buildEncargadosFormData(encargadosIds, respaldoFile);
    return api
      .put(`/bibliotecas/${bibliotecaId}/encargados`, fd)
      .then((r) => r.data);
  },
  removeEncargado(
    bibliotecaId: number,
    usuarioId: number,
  ): Promise<ApiResponse<null>> {
    return api
      .delete(`/bibliotecas/${bibliotecaId}/encargados/${usuarioId}`)
      .then((r) => r.data);
  },
  uploadEncargadoImagen(
    bibliotecaId: number,
    usuarioId: number,
    file: File,
  ): Promise<ApiResponse<{ imagenUrl: string }>> {
    const fd = new FormData();

    fd.append(
      "usuarioId",
      new Blob([JSON.stringify(usuarioId)], {
        type: "application/json",
      }),
    );

    fd.append("imagen", file);

    return api
      .post(`/bibliotecas/${bibliotecaId}/encargados/imagen`, fd)
      .then((r) => r.data);
  },
};

// ─── Carreras ─────────────────────────────────────────────────────────────

export const carrerasService = {
  getAll(): Promise<ApiResponse<CarreraDetail[]>> {
    return api.get("/carreras").then((r) => r.data);
  },

  getById(id: number): Promise<ApiResponse<CarreraDetail>> {
    return api.get(`/carreras/${id}`).then((r) => r.data);
  },

  create(payload: CreateCarreraPayload): Promise<ApiResponse<CarreraDetail>> {
    return api.post("/carreras", payload).then((r) => r.data);
  },

  update(
    id: number,
    payload: Partial<CreateCarreraPayload>,
  ): Promise<ApiResponse<CarreraDetail>> {
    return api.put(`/carreras/${id}`, payload).then((r) => r.data);
  },

  remove(id: number): Promise<ApiResponse<null>> {
    return api.delete(`/carreras/${id}`).then((r) => r.data);
  },
};
