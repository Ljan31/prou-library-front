import api from "@/services/axios";
import type { Edicion } from "@/types/catalogo";

export interface EdicionPayload {
  isbn: string;
  editorial: string;
  anoPublicacion: number;
  edicion?: string;
  numeroPaginas?: number | null;
  libroId: number;
  /** URL externa de portada (Caso B). Ignorado si se envía un archivo. */
  imagenPortada?: string;
}
function normalizar(data: unknown): Edicion[] {
  if (Array.isArray(data)) return data as Edicion[];
  if (data && typeof data === "object") {
    const d = data as Record<string, unknown>;
    if (Array.isArray(d.content)) return d.content as Edicion[];
    if (Array.isArray(d.data)) return d.data as Edicion[];
  }
  return [];
}

function unwrap<T>(data: unknown): T {
  if (data && typeof data === "object") {
    const d = data as Record<string, unknown>;
    if (d.data) return d.data as T;
  }
  return data as T;
}

/**
 * Construye un FormData con la parte "datos" como JSON string
 * y la parte "portada" como archivo si se proporcionó.
 * Caso A → payload + archivo
 * Caso B → payload con imagenPortadaUrl (sin archivo)
 * Caso C → payload sin portada (mantiene la existente)
 */
function buildFormData(
  payload: EdicionPayload,
  portadaFile?: File | null,
): FormData {
  console.log("build");
  console.log(payload, portadaFile);
  const fd = new FormData();

  // fd.append("datos", JSON.stringify(payload));
  fd.append(
    "datos",
    new Blob([JSON.stringify(payload)], { type: "application/json" }),
  );

  if (portadaFile) {
    fd.append("portada", portadaFile);
  }

  return fd;
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

/**
 * POST /api/ediciones  — multipart/form-data
 * @param payload  datos JSON de la edición
 * @param portadaFile  archivo de imagen (Caso A) o null/undefined (Caso B/C)
 */
export async function crearEdicion(
  payload: EdicionPayload,
  portadaFile?: File | null,
): Promise<Edicion> {
  console.log("crear");
  console.log(payload, portadaFile);
  console.log("--------------");
  const fd = buildFormData(payload, portadaFile);
  console.log("fd");
  console.log(fd);
  for (const [key, value] of fd.entries()) {
    console.log(key, value);
  }
  const res = await api.post("/ediciones", fd);
  return unwrap<Edicion>(res.data);
}

/**
 * PUT /api/ediciones/{id}  — multipart/form-data
 * @param portadaFile  nuevo archivo (Caso A), null = sin cambios en portada (Caso C)
 */
export async function actualizarEdicion(
  id: number,
  payload: Omit<EdicionPayload, "libroId"> & { libroId?: number },
  portadaFile?: File | null,
): Promise<Edicion> {
  const fd = buildFormData(payload as EdicionPayload, portadaFile);
  const res = await api.put(`/ediciones/${id}`, fd);
  return unwrap<Edicion>(res.data);
}

/** DELETE /api/ediciones/{id} — solo ROLE_ADMIN */
export async function eliminarEdicion(id: number): Promise<void> {
  await api.delete(`/ediciones/${id}`);
}
