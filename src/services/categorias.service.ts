import api from "@/services/axios";
import type { Categoria } from "@/types/catalogo";

/* ── Tipos extra (la gestión necesita el conteo de libros) ── */
export type CategoriaConConteo = Categoria & { librosCount: number };

export interface CategoriaDetalle extends CategoriaConConteo {
  librosRecientes: { idLibro: number; titulo: string }[];
}

export interface EstadisticasCategorias {
  totalCategorias: number;
  categoriasSinLibros: number;
  categoriasConMasLibros?: unknown[]; // forma de CategoriaConConteoResponse sin confirmar
}

export type DistribucionDewey = Record<string, number>;

// PUT completo: siempre se envían los tres campos (vacío → null)
export interface CategoriaPayload {
  nombre_categoria: string;
  descripcion: string | null;
  codigo_dewey: string | null;
}

/* ── Error con mensaje del backend + status ── */
export class CategoriaApiError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = "CategoriaApiError";
    this.status = status;
  }
}

function toApiError(e: any, fallback: string): CategoriaApiError {
  return new CategoriaApiError(
    e?.response?.data?.message ?? fallback,
    e?.response?.status,
  );
}

/* ═══════════════ Existentes (misma firma) ═══════════════ */

/** Lista tolerante a errores: devuelve [] si falla. Para selects y formularios. */
export async function obtenerCategorias(): Promise<Categoria[]> {
  try {
    const res = await api.get("/categorias");
    return Array.isArray(res.data.data) ? res.data.data : [];
  } catch (error) {
    console.error("Error cargando categorías:", error);
    return [];
  }
}

export async function crearCategoria(
  data: Partial<Categoria> | CategoriaPayload,
): Promise<Categoria> {
  try {
    const res = await api.post("/categorias", data);
    return res.data.data;
  } catch (error) {
    console.error("Error creando categoría:", error);
    throw toApiError(error, "No se pudo crear la categoría");
  }
}

export async function actualizarCategoria(
  id_categoria: number,
  data: Partial<Categoria> | CategoriaPayload,
): Promise<Categoria> {
  try {
    const res = await api.put(`/categorias/${id_categoria}`, data);
    return res.data.data;
  } catch (error) {
    console.error("Error actualizando categoría:", error);
    throw toApiError(error, "No se pudo actualizar la categoría");
  }
}

export async function eliminarCategoria(id_categoria: number): Promise<void> {
  try {
    await api.delete(`/categorias/${id_categoria}`);
  } catch (error) {
    console.error("Error eliminando categoría:", error);
    throw toApiError(error, "No se pudo eliminar la categoría");
  }
}

/* ═══════════════ Nuevas (gestión) ═══════════════ */

/** Lista ordenada por nombre. A diferencia de obtenerCategorias, lanza el error. */
export async function listarCategorias(): Promise<CategoriaConConteo[]> {
  try {
    const res = await api.get("/categorias/ordenadas");
    return Array.isArray(res.data.data) ? res.data.data : [];
  } catch (error) {
    throw toApiError(error, "No se pudieron cargar las categorías");
  }
}

export async function obtenerCategoriaDetalle(
  id_categoria: number,
): Promise<CategoriaDetalle> {
  try {
    const res = await api.get(`/categorias/${id_categoria}/detalle`);
    return res.data.data;
  } catch (error) {
    throw toApiError(error, "No se pudo cargar el detalle");
  }
}

export async function obtenerEstadisticasCategorias(): Promise<EstadisticasCategorias> {
  try {
    const res = await api.get("/categorias/estadisticas");
    return res.data.data;
  } catch (error) {
    throw toApiError(error, "No se pudieron cargar las estadísticas");
  }
}

export async function obtenerDistribucionDewey(): Promise<DistribucionDewey> {
  try {
    const res = await api.get("/categorias/distribucion-dewey");
    return res.data.data ?? {};
  } catch (error) {
    throw toApiError(error, "No se pudo cargar la distribución Dewey");
  }
}