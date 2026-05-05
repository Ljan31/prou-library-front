import api from "@/services/axios";
import type {
  ReservaResponse,
  CrearReservaPayload,
  ConvertirReservaPayload,
} from "@/types/reservas";

// ─── Tipos públicos (sin auth) ─────────────────────────────────────────────
// Para el catálogo público usamos fetch sin token

export async function obtenerLibrosPublicos(params?: {
  titulo?: string;
  categoriaId?: number;
  pagina?: number;
  size?: number;
}) {
  const query = new URLSearchParams();
  if (params?.titulo) query.set("titulo", params.titulo);
  if (params?.categoriaId) query.set("categoriaId", String(params.categoriaId));
  if (params?.pagina) query.set("page", String((params.pagina ?? 1) - 1));
  if (params?.size) query.set("size", String(params.size));

  const res = await api.get(`/libros?${query}`);
  console.log("res", res);
  if (!res.data.success) throw new Error("Error al cargar el catálogo");
  return res.data.data;
}

export async function obtenerBibliotecasPublicas() {
  const res = await fetch(`/bibliotecas`);
  if (!res.ok) throw new Error("Error al cargar bibliotecas");
  return res.json();
}

export async function obtenerCategoriasPublicas() {
  const res = await fetch(`/categorias`);
  if (!res.ok) return [];
  return res.json();
}

// ─── Endpoints autenticados ────────────────────────────────────────────────

export const reservasService = {
  misReservas(): Promise<{ data: ReservaResponse[] }> {
    return api.get("/reservas/mis-reservas");
  },

  byId(id: number): Promise<{ data: ReservaResponse }> {
    return api.get(`/reservas/${id}`);
  },

  byBiblioteca(
    bibliotecaId: number,
    estado?: string,
  ): Promise<{ data: ReservaResponse[] }> {
    const params = estado ? { estado } : {};
    return api.get(`/reservas/biblioteca/${bibliotecaId}`, { params });
  },

  cola(
    libroId: number,
    bibliotecaId: number,
  ): Promise<{ data: ReservaResponse[] }> {
    return api.get("/reservas/cola", { params: { libroId, bibliotecaId } });
  },

  crear(payload: CrearReservaPayload): Promise<{ data: ReservaResponse }> {
    return api.post("/reservas", payload);
  },

  cancelar(id: number, motivo?: string): Promise<{ data: ReservaResponse }> {
    return api.patch(
      `/reservas/${id}/cancelar`,
      motivo ? { motivo } : undefined,
    );
  },

  convertir(
    payload: ConvertirReservaPayload,
  ): Promise<{ data: ReservaResponse }> {
    return api.post("/reservas/convertir", payload);
  },
};
