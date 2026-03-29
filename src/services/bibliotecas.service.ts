import api from "./axios";

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
}

// ─── Bibliotecas ──────────────────────────────────────────────────────────

export const bibliotecasService = {
  getAll(): Promise<ApiResponse<Biblioteca[]>> {
    return api.get("/bibliotecas").then((r) => r.data);
  },

  getById(id: number): Promise<ApiResponse<Biblioteca>> {
    return api.get(`/bibliotecas/${id}`).then((r) => r.data);
  },

  create(payload: CreateBibliotecaPayload): Promise<ApiResponse<Biblioteca>> {
    return api.post("/bibliotecas", payload).then((r) => r.data);
  },

  update(
    id: number,
    payload: Partial<CreateBibliotecaPayload>,
  ): Promise<ApiResponse<Biblioteca>> {
    return api.put(`/bibliotecas/${id}`, payload).then((r) => r.data);
  },

  remove(id: number): Promise<ApiResponse<null>> {
    return api.delete(`/bibliotecas/${id}`).then((r) => r.data);
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
