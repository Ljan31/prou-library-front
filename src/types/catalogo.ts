// ─── types/catalogo.ts ────────────────────────────────────────────────────

export interface Categoria {
  id_categoria: number;
  nombre_categoria: string;
  descripcion: string;
  codigo_dewey: string;
  librosCount?: number;
}

export interface Libro {
  id_libro: number;
  isbn: string;
  titulo: string;
  editorial: string;
  anoPublicacion: number;
  edicion: string;
  numero_paginas?: number;
  idioma: string;
  categoria?: Categoria;
  descripcion?: string;
  imagen_portada?: string;
  ejemplaresTotal: number;
  ejemplaresDisponibles: number;
}

export type EstadoEjemplar =
  | "DISPONIBLE"
  | "PRESTADO"
  | "EN_REPARACION"
  | "DAÑADO"
  | "BAJA"
  | "PERDIDO";

export interface Ejemplar {
  id_ejemplar: number;
  libroId: number;
  bibliotecaId: number;
  codigo_ejemplar: string;
  codigo_topografico: string;
  ubicacion_fisica?: string;
  estadoEjemplar: EstadoEjemplar;
  fechaAdquisicion?: string;
  precio_compra?: number;
  observaciones?: string;
  prestamoActivo?: unknown | null;
  pdf?: string;
  pdfPreview?: string;
}
