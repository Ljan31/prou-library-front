import api from "@/services/axios";
import type {
  Ejemplar,
  EstadoEjemplar,
  HistorialItem,
  DisponibilidadLibro,
} from "@/types/catalogo";

function normArr<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === "object") {
    const d = data as Record<string, unknown>;
    if (Array.isArray(d.content)) return d.content as T[];
    if (Array.isArray(d.data)) return d.data as T[];
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

// ─── Consultas ────────────────────────────────────────────────────────────

/** GET /api/ejemplares */
export async function obtenerEjemplares(): Promise<Ejemplar[]> {
  const res = await api.get("/ejemplares");
  return normArr<Ejemplar>(res.data);
}

/** GET /api/ejemplares/{id} */
export async function obtenerEjemplar(id: number): Promise<Ejemplar> {
  const res = await api.get(`/ejemplares/${id}`);
  return res.data;
}

/** GET /api/ejemplares/codigo/{codigo} */
export async function obtenerEjemplarPorCodigo(
  codigo: string,
): Promise<Ejemplar> {
  const res = await api.get(`/ejemplares/codigo/${encodeURIComponent(codigo)}`);
  return res.data;
}

/** GET /api/ejemplares/edicion/{edicionId} */
export async function obtenerEjemplaresPorEdicion(
  edicionId: number,
): Promise<Ejemplar[]> {
  const res = await api.get(`/ejemplares/edicion/${edicionId}`);
  return normArr<Ejemplar>(res.data);
}

/** GET /api/ejemplares/libro/{libroId} — todas las ediciones */
export async function obtenerEjemplaresPorLibro(
  libroId: number,
): Promise<Ejemplar[]> {
  const res = await api.get(`/ejemplares/libro/${libroId}`);
  return normArr<Ejemplar>(res.data);
}

/** GET /api/ejemplares/biblioteca/{bibliotecaId} */
export async function obtenerEjemplaresPorBiblioteca(
  bibliotecaId: number,
): Promise<Ejemplar[]> {
  const res = await api.get(`/ejemplares/biblioteca/${bibliotecaId}`);
  return normArr<Ejemplar>(res.data);
}

/** GET /api/ejemplares/estado/{estado} */
export async function obtenerEjemplaresPorEstado(
  estado: EstadoEjemplar,
): Promise<Ejemplar[]> {
  const res = await api.get(`/ejemplares/estado/${estado}`);
  return normArr<Ejemplar>(res.data);
}

/** GET /api/ejemplares/libro/{libroId}/disponibles */
export async function obtenerDisponiblesPorLibro(
  libroId: number,
): Promise<Ejemplar[]> {
  const res = await api.get(`/ejemplares/libro/${libroId}/disponibles`);
  return normArr<Ejemplar>(res.data);
}

/** GET /api/ejemplares/libro/{libroId}/disponibilidad */
export async function obtenerDisponibilidadLibro(
  libroId: number,
): Promise<DisponibilidadLibro> {
  const res = await api.get(`/ejemplares/libro/${libroId}/disponibilidad`);
  return res.data;
}

/** GET /api/ejemplares/{id}/historial */
export async function obtenerHistorial(id: number): Promise<HistorialItem[]> {
  const res = await api.get(`/ejemplares/${id}/historial`);
  return normArr<HistorialItem>(res.data);
}

// ─── Mutaciones ───────────────────────────────────────────────────────────

/** POST /api/ejemplares — ahora usa edicionId, no libroId */
export async function crearEjemplar(data: {
  codigoEjemplar: string;
  codigoTopografico?: string;
  clasificacionDecimal?: string;
  cutterAutor?: string;
  cutterTitulo?: string;
  ubicacionFisica?: string;
  edicionId: number; // ← campo nuevo
  bibliotecaId: number;
  estadoEjemplar?: EstadoEjemplar;
  fechaAdquisicion?: string;
  precioCompra?: number | null;
  observaciones?: string;
}): Promise<Ejemplar> {
  const res = await api.post("/ejemplares", data);
  return unwrap<Ejemplar>(res.data);
}

/** PUT /api/ejemplares/{id} */
export async function actualizarEjemplar(
  id: number,
  data: {
    codigoEjemplar?: string;
    codigoTopografico?: string;
    clasificacionDecimal?: string;
    cutterAutor?: string;
    cutterTitulo?: string;
    ubicacionFisica?: string;
    edicionId?: number;
    bibliotecaId?: number;
    precioCompra?: number | null;
    observaciones?: string;
  },
): Promise<Ejemplar> {
  const res = await api.put(`/ejemplares/${id}`, data);
  return unwrap<Ejemplar>(res.data);
}

/** PUT /api/ejemplares/{id}/estado */
export async function cambiarEstado(
  id: number,
  payload: {
    nuevoEstado: EstadoEjemplar;
    motivo: string;
  },
): Promise<Ejemplar> {
  const res = await api.put(`/ejemplares/${id}/estado`, payload);
  return unwrap<Ejemplar>(res.data);
}

/** PUT /api/ejemplares/{id}/baja?motivo=... — solo ROLE_ADMIN */
export async function darDeBaja(id: number, motivo: string): Promise<void> {
  await api.put(`/ejemplares/${id}/baja`, null, { params: { motivo } });
}

/** PUT /api/ejemplares/{id}/perdido?motivo=... */
export async function marcarPerdido(id: number, motivo: string): Promise<void> {
  await api.put(`/ejemplares/${id}/perdido`, null, { params: { motivo } });
}

/** PUT /api/ejemplares/{ejemplarId}/transferir/{nuevaBibliotecaId}?motivo=... — solo ROLE_ADMIN */
export async function transferir(
  ejemplarId: number,
  nuevaBibliotecaId: number,
  motivo: string,
): Promise<void> {
  await api.put(
    `/ejemplares/${ejemplarId}/transferir/${nuevaBibliotecaId}`,
    null,
    {
      params: { motivo },
    },
  );
}
export async function eliminarEjemplar(id: number): Promise<void> {
  await api.delete(`/ejemplares/${id}`);
}
