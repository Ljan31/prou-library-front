import api from "@/services/axios";
import type { Categoria } from "@/types/catalogo";

export async function obtenerCategorias(): Promise<Categoria[]> {
  try {
    const res = await api.get("/categorias");
    return Array.isArray(res.data.data) ? res.data.data : [];
  } catch (error) {
    console.error("Error cargando categorías:", error);
    return [];
  }
}

/**
 * Crear una nueva categoría
 */
export async function crearCategoria(
  data: Partial<Categoria>,
): Promise<Categoria> {
  try {
    const res = await api.post("/categorias", data);
    return res.data.data;
  } catch (error) {
    console.error("Error creando categoría:", error);
    throw new Error("No se pudo crear la categoría");
  }
}

/**
 * Actualizar una categoría existente
 */
export async function actualizarCategoria(
  id_categoria: number,
  data: Partial<Categoria>,
): Promise<Categoria> {
  try {
    const res = await api.put(`/categorias/${id_categoria}`, data);
    return res.data.data;
  } catch (error) {
    console.error("Error actualizando categoría:", error);
    throw new Error("No se pudo actualizar la categoría");
  }
}

/**
 * Eliminar una categoría
 */
export async function eliminarCategoria(id_categoria: number): Promise<void> {
  try {
    await api.delete(`/categorias/${id_categoria}`);
  } catch (error) {
    console.error("Error eliminando categoría:", error);
    throw new Error("No se pudo eliminar la categoría");
  }
}
