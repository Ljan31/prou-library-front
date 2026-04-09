import api from "@/services/axios";
import type { Edicion } from "@/types/catalogo";

function normalizar(data: unknown): Edicion[] {
  if (Array.isArray(data)) return data as Edicion[];
  if (data && typeof data === "object") {
    const d = data as Record<string, unknown>;
    if (Array.isArray(d.content)) return d.content as Edicion[];
    if (Array.isArray(d.data)) return d.data as Edicion[];
  }
  return [];
}

function unwrap(data: unknown): Edicion {
  if (data && typeof data === "object") {
    const d = data as Record<string, unknown>;
    if (d.data) return d.data as Edicion;
  }
  return data as Edicion;
}

/** GET /api/ediciones/libro/{libroId} */
export async function obtenerEdicionesPorLibro(
  libroId: number,
): Promise<Edicion[]> {
  const res = await api.get(`/ediciones/libro/${libroId}`);
  return normalizar(res.data);
}

/** GET /api/ediciones/{id} */
export async function obtenerEdicion(id: number): Promise<Edicion> {
  const res = await api.get(`/ediciones/${id}`);
  return res.data;
}

/** POST /api/ediciones */
export async function crearEdicion(data: {
  isbn: string;
  editorial: string;
  anoPublicacion: number;
  edicion?: string;
  numeroPaginas?: number | null;
  imagenPortada?: string;
  libroId: number;
}): Promise<Edicion> {
  const res = await api.post("/ediciones", data);
  return unwrap(res.data);
}

/** PUT /api/ediciones/{id} */
export async function actualizarEdicion(
  id: number,
  data: {
    isbn?: string;
    editorial?: string;
    anoPublicacion?: number;
    edicion?: string;
    numeroPaginas?: number | null;
    imagenPortada?: string;
    libroId?: number;
  },
): Promise<Edicion> {
  const res = await api.put(`/ediciones/${id}`, data);
  return unwrap(res.data);
}

/** DELETE /api/ediciones/{id} — solo ROLE_ADMIN */
export async function eliminarEdicion(id: number): Promise<void> {
  await api.delete(`/ediciones/${id}`);
}
