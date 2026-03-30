import api from "@/services/axios";
import type { Ejemplar } from "@/types/catalogo";

/**
 * Listar todos los ejemplares
 */
export async function obtenerEjemplares(): Promise<Ejemplar[]> {
  try {
    const res = await api.get("/ejemplares");
    return Array.isArray(res.data.data) ? res.data.data : [];
  } catch (error) {
    console.error("Error cargando ejemplares:", error);
    throw new Error("No se pudo cargar los ejemplares");
  }
}
export async function obtenerEjemplar(id: number): Promise<Ejemplar> {
  const res = await api.get(`/api/ejemplares/${id}`);
  return res.data.data;
}
/**
 * Crear un ejemplar
 */
export async function crearEjemplar(
  data: Partial<Ejemplar>,
): Promise<Ejemplar> {
  try {
    const res = await api.post("/ejemplares", data);
    return res.data.data;
  } catch (error) {
    console.error("Error creando ejemplar:", error);
    throw new Error("No se pudo crear el ejemplar");
  }
}

/**
 * Actualizar un ejemplar
 */
export async function actualizarEjemplar(
  id_ejemplar: number,
  data: Partial<Ejemplar>,
): Promise<Ejemplar> {
  try {
    const res = await api.put(`/ejemplares/${id_ejemplar}`, data);
    return res.data.data;
  } catch (error) {
    console.error("Error actualizando ejemplar:", error);
    throw new Error("No se pudo actualizar el ejemplar");
  }
}

/**
 * Eliminar un ejemplar
 */
export async function eliminarEjemplar(id_ejemplar: number): Promise<void> {
  try {
    await api.delete(`/ejemplares/${id_ejemplar}`);
  } catch (error) {
    console.error("Error eliminando ejemplar:", error);
    throw new Error("No se pudo eliminar el ejemplar");
  }
}

/**
 * Cambiar estado de un ejemplar
 */
export async function cambiarEstadoEjemplar(
  id_ejemplar: number,
  nuevoEstado: string,
  motivo: string,
): Promise<Ejemplar> {
  try {
    const res = await api.put(`/ejemplares/${id_ejemplar}/estado`, {
      nuevoEstado,
      motivo,
    });
    return res.data;
  } catch (error) {
    console.error("Error cambiando estado del ejemplar:", error);
    throw new Error("No se pudo cambiar el estado del ejemplar");
  }
}

/**
 * Marcar un ejemplar como perdido
 */
export async function marcarPerdido(
  id_ejemplar: number,
  motivo: string,
): Promise<Ejemplar> {
  try {
    const res = await api.put(`/ejemplares/${id_ejemplar}/perdido`, null, {
      params: { motivo },
    });
    return res.data;
  } catch (error) {
    console.error("Error marcando ejemplar como perdido:", error);
    throw new Error("No se pudo marcar el ejemplar como perdido");
  }
}

/**
 * Dar de baja un ejemplar
 */
export async function darDeBaja(
  id_ejemplar: number,
  motivo: string,
): Promise<Ejemplar> {
  try {
    const res = await api.put(`/ejemplares/${id_ejemplar}/baja`, null, {
      params: { motivo },
    });
    return res.data;
  } catch (error) {
    console.error("Error dando de baja ejemplar:", error);
    throw new Error("No se pudo dar de baja el ejemplar");
  }
}

/**
 * Obtener historial de cambios de estado de un ejemplar
 */
export async function obtenerHistorial(id_ejemplar: number): Promise<any[]> {
  try {
    const res = await api.get(`/ejemplares/${id_ejemplar}/historial`);
    return Array.isArray(res.data.data) ? res.data.data : [];
  } catch (error) {
    console.error("Error obteniendo historial del ejemplar:", error);
    throw new Error("No se pudo obtener el historial del ejemplar");
  }
}
