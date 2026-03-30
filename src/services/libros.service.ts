import api from "@/services/axios";
import type { Libro } from "@/types/catalogo";

// ─── Tipos ────────────────────────────────────────────────────────────────

export interface BusquedaLibrosParams {
  titulo?: string;
  autor?: string;
  isbn?: string;
  editorial?: string;
  anoPublicacion?: number;
  categoriaId?: number;
  bibliotecaId?: number;
  pagina?: number;
  size?: number;
  sort?: string;
}

export interface ResultadoBusqueda {
  libros: Libro[];
  totalPaginas: number;
  totalLibros: number;
}

// ─── Helpers internos ─────────────────────────────────────────────────────

/** Normaliza cualquier respuesta del backend a un array de libros */
function normalizarRespuesta(data: unknown): Libro[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object") {
    const d = data as Record<string, unknown>;
    if (Array.isArray(d.content)) return d.content as Libro[];
    if (Array.isArray(d.data)) return d.data as Libro[];
    if (Array.isArray(d.libros)) return d.libros as Libro[];
  }
  return [];
}

/** Filtra y pagina localmente cuando la búsqueda avanzada falla */
function filtrarLocalmente(
  todos: Libro[],
  params: BusquedaLibrosParams,
): ResultadoBusqueda {
  let resultado = [...todos];

  if (params.titulo?.trim()) {
    const q = params.titulo.toLowerCase();
    resultado = resultado.filter(
      (l) =>
        l.titulo?.toLowerCase().includes(q) ||
        l.isbn?.toLowerCase().includes(q) ||
        l.editorial?.toLowerCase().includes(q),
    );
  }

  if (params.categoriaId) {
    resultado = resultado.filter(
      (l) => l.categoria?.id_categoria === params.categoriaId,
    );
  }

  if (params.isbn?.trim()) {
    resultado = resultado.filter((l) => l.isbn?.includes(params.isbn!));
  }

  if (params.editorial?.trim()) {
    const q = params.editorial.toLowerCase();
    resultado = resultado.filter((l) => l.editorial?.toLowerCase().includes(q));
  }

  // Ordenar por título
  resultado.sort((a, b) =>
    (a.titulo ?? "").localeCompare(b.titulo ?? "", "es"),
  );

  const size = params.size ?? 12;
  const page = (params.pagina ?? 1) - 1; // 0-indexed
  const total = resultado.length;
  const slice = resultado.slice(page * size, page * size + size);

  return {
    libros: slice,
    totalLibros: total,
    totalPaginas: Math.max(1, Math.ceil(total / size)),
  };
}

// ─── Caché en memoria para el listado completo (evita llamadas repetidas) ─

let cacheLibros: Libro[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 30_000; // 30 s

async function obtenerTodosLosLibros(): Promise<Libro[]> {
  const ahora = Date.now();
  if (cacheLibros && ahora - cacheTimestamp < CACHE_TTL_MS) {
    return cacheLibros;
  }
  const res = await api.get("/libros");
  console.log({ res });
  cacheLibros = normalizarRespuesta(res.data.data);
  console.log({ cacheLibros });
  cacheTimestamp = ahora;
  return cacheLibros;
}

/** Invalida el caché (llamar tras crear/editar/eliminar) */
export function invalidarCacheLibros() {
  cacheLibros = null;
  cacheTimestamp = 0;
}

// ─── API pública ──────────────────────────────────────────────────────────

/**
 * Busca libros con filtros.
 * Estrategia:
 *   1. Intenta POST /libros/busqueda-avanzada (con paginación server-side)
 *   2. Si falla (404, 500, red) → cae en GET /libros + filtrado local
 */
export async function buscarLibros(
  params: BusquedaLibrosParams,
): Promise<ResultadoBusqueda> {
  const { pagina = 1, size = 12, sort = "titulo,asc", ...filtros } = params;

  // ── Intento 1: búsqueda avanzada en el servidor ──
  try {
    const body: Record<string, unknown> = {};
    if (filtros.titulo?.trim()) body.titulo = filtros.titulo.trim();
    // if (filtros.autor?.trim()) body.autor = filtros.autor.trim();
    // if (filtros.isbn?.trim()) body.isbn = filtros.isbn.trim();
    // if (filtros.editorial?.trim()) body.editorial = filtros.editorial.trim();
    // if (filtros.anoPublicacion) body.anoPublicacion = filtros.anoPublicacion;
    // if (filtros.categoriaId) body.categoriaId = filtros.categoriaId;
    // if (filtros.bibliotecaId) body.bibliotecaId = filtros.bibliotecaId;
    console.log("Request body:", body);
    console.log(
      "URL:",
      `/libros/busqueda-avanzada?page=${pagina}&size=${size}&sort=${sort}`,
    );
    const res = await api.post(
      `/libros/busqueda-avanzada?page=${pagina}&size=${size}&sort=${sort}`,
      "",
      { timeout: 8000 },
    );

    const data = res.data;
    console.log(res);
    const libros = normalizarRespuesta(data.data);

    return {
      libros,
      totalLibros: data?.totalElements ?? libros.length,
      totalPaginas:
        data?.totalPages ?? Math.max(1, Math.ceil(libros.length / size)),
    };
  } catch (errAvanzada) {
    // El endpoint de búsqueda avanzada no existe o falló → fallback local
    console.warn(
      "[libros.service] /busqueda-avanzada falló, usando filtrado local:",
      errAvanzada,
    );
  }

  // ── Fallback: GET /libros + filtrado en cliente ──
  try {
    const todos = await obtenerTodosLosLibros();
    return filtrarLocalmente(todos, { ...filtros, pagina, size });
  } catch (errListado) {
    console.error("[libros.service] GET /libros también falló:", errListado);
    throw new Error("No se pudo cargar el catálogo. Verifica tu conexión.");
  }
}

export async function obtenerLibro(id: number): Promise<Libro> {
  const res = await api.get(`/libros/${id}`);
  return res.data.data;
}

export async function crearLibro(
  data: Omit<Libro, "id_libro" | "ejemplaresTotal" | "ejemplaresDisponibles">,
): Promise<Libro> {
  const res = await api.post("/libros", data);
  invalidarCacheLibros();
  return res.data;
}

export async function actualizarLibro(
  id: number,
  data: Partial<Libro>,
): Promise<Libro> {
  const res = await api.put(`/libros/${id}`, data);
  invalidarCacheLibros();
  return res.data.data;
}

export async function eliminarLibro(id: number): Promise<void> {
  await api.delete(`/libros/${id}`);
  invalidarCacheLibros();
}
