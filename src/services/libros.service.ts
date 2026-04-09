import api from "@/services/axios";
import type { Libro } from "@/types/catalogo";

// ─── Tipos ────────────────────────────────────────────────────────────────

export interface BusquedaLibrosParams {
  titulo?: string;
  categoriaId?: number;
  isbn?: string; // busca dentro de las ediciones
  pagina?: number;
  size?: number;
  sort?: string;
}

export interface ResultadoBusqueda {
  libros: Libro[];
  totalPaginas: number;
  totalLibros: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function normalizar(data: unknown): Libro[] {
  if (Array.isArray(data)) return data as Libro[];
  if (data && typeof data === "object") {
    const d = data as Record<string, unknown>;
    if (Array.isArray(d.content)) return d.content as Libro[];
    if (Array.isArray(d.data)) return d.data as Libro[];
  }
  return [];
}

// ─── Caché en memoria ─────────────────────────────────────────────────────

let _cache: Libro[] | null = null;
let _cacheTs = 0;
const TTL = 30_000;

async function getTodos(): Promise<Libro[]> {
  if (_cache && Date.now() - _cacheTs < TTL) return _cache;
  const res = await api.get("/api/libros");
  _cache = normalizar(res.data);
  _cacheTs = Date.now();
  return _cache;
}

export function invalidarCacheLibros() {
  _cache = null;
  _cacheTs = 0;
}

// Filtrado local (fallback cuando la búsqueda avanzada falla)
function filtrarLocal(
  todos: Libro[],
  p: BusquedaLibrosParams,
): ResultadoBusqueda {
  let r = [...todos];
  if (p.titulo?.trim()) {
    const q = p.titulo.toLowerCase();
    r = r.filter((l) => l.titulo?.toLowerCase().includes(q));
  }
  if (p.categoriaId) {
    r = r.filter((l) => l.categoria?.id_categoria === p.categoriaId); //!
  }
  if (p.isbn?.trim()) {
    const q = p.isbn.trim();
    // El ISBN vive en las ediciones
    r = r.filter((l) => l.ediciones?.some((e) => e.isbn?.includes(q)));
  }
  r.sort((a, b) => (a.titulo ?? "").localeCompare(b.titulo ?? "", "es"));
  const size = p.size ?? 12;
  const page = (p.pagina ?? 1) - 1;
  const total = r.length;
  return {
    libros: r.slice(page * size, page * size + size),
    totalLibros: total,
    totalPaginas: Math.max(1, Math.ceil(total / size)),
  };
}

// ─── API pública ──────────────────────────────────────────────────────────

/**
 * Busca libros.
 * Intenta POST /api/libros/busqueda-avanzada; si falla usa GET + filtrado local.
 * Paginación: el backend usa page base-0.
 */
export async function buscarLibros(
  params: BusquedaLibrosParams,
): Promise<ResultadoBusqueda> {
  const { pagina = 1, size = 12, sort = "titulo,asc", ...filtros } = params;
  const pageBackend = pagina - 1; // backend es 0-indexed

  // ── Intento 1: búsqueda avanzada ──
  try {
    const body: Record<string, unknown> = {};
    if (filtros.titulo?.trim()) body.titulo = filtros.titulo.trim();
    if (filtros.categoriaId) body.categoriaId = filtros.categoriaId;
    if (filtros.isbn?.trim()) body.isbn = filtros.isbn.trim();

    const res = await api.post(
      `/libros/busqueda-avanzada?page=${pageBackend}&size=${size}&sort=${sort}`,
      body,
      { timeout: 8000 },
    );
    const d = res.data.data;
    return {
      libros: normalizar(d),
      totalLibros: d?.totalElements ?? normalizar(d).length,
      totalPaginas: d?.totalPages ?? 1,
    };
  } catch (e) {
    console.warn(
      "[libros.service] busqueda-avanzada falló → fallback local",
      e,
    );
  }

  // ── Fallback: GET /api/libros + filtrado en cliente ──
  try {
    const todos = await getTodos();
    return filtrarLocal(todos, { ...filtros, pagina, size });
  } catch (e) {
    console.error("[libros.service] GET /api/libros también falló", e);
    throw new Error("No se pudo cargar el catálogo. Verifica tu conexión.");
  }
}

// GET simple por query param ?q= (endpoint L3)
export async function buscarSimple(q: string): Promise<Libro[]> {
  const res = await api.get("/libros/search", { params: { q } });
  return normalizar(res.data);
}

export async function obtenerLibro(id: number): Promise<Libro> {
  const res = await api.get(`/libros/${id}`);
  return res.data;
}

// Crear libro: solo titulo, idioma, categoriaId, descripcion
export async function crearLibro(data: {
  titulo: string;
  idioma: string;
  categoriaId: number | null;
  descripcion?: string;
}): Promise<Libro> {
  const res = await api.post("/libros", data);
  invalidarCacheLibros();
  // El backend devuelve { status, message, data: Libro }
  return res.data?.data ?? res.data;
}

export async function actualizarLibro(
  id: number,
  data: {
    titulo?: string;
    idioma?: string;
    categoriaId?: number | null;
    descripcion?: string;
  },
): Promise<Libro> {
  const res = await api.put(`/libros/${id}`, data);
  invalidarCacheLibros();
  return res.data?.data ?? res.data;
}

export async function eliminarLibro(id: number): Promise<void> {
  await api.delete(`/libros/${id}`);
  invalidarCacheLibros();
}
