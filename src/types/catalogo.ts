// ─── types/catalogo.ts ────────────────────────────────────────────────────

export interface Categoria {
  id_categoria: number;
  nombre_categoria: string;
  descripcion: string;
  codigo_dewey: string;
  librosCount?: number;
}

export interface Libro {
  idLibro: number;
  titulo: string;
  idioma: string;
  descripcion?: string;
  categoria?: Categoria;
  ediciones: Edicion[];
  ejemplaresTotal: number;
  ejemplaresDisponibles: number;
}

export interface Edicion {
  idEdicion: number;
  isbn: string;
  editorial: string;
  anoPublicacion: number;
  edicion?: string; // "4ta", "1ª", etc.
  numeroPaginas?: number;
  imagenPortada?: string;
  libro?: { idLibro: number; titulo: string };
  ejemplaresTotal?: number;
  ejemplaresDisponibles?: number;
}
export type EstadoEjemplar =
  | "DISPONIBLE"
  | "PRESTADO"
  | "RESERVADO"
  | "EN_REPARACION"
  | "DAÑADO"
  | "BAJA"
  | "PERDIDO"
  | "DETERIORADO";

export interface Ejemplar {
  idEjemplar: number;
  codigoEjemplar: string;
  codigoTopografico?: string;
  codigoTopograficoConcat?: string;
  clasificacionDecimal?: string;
  cutterAutor?: string;
  cutterTitulo?: string;
  ubicacionFisica?: string;
  estadoEjemplar: EstadoEjemplar;
  fechaAdquisicion?: string;
  precioCompra?: number;
  observaciones?: string;
  edicion?: {
    idEdicion: number;
    isbn: string;
    editorial?: string;
    anoPublicacion?: number;
    idLibro?: number;
    titulo?: string;
  };
  biblioteca?: {
    idBiblioteca: number;
    nombre: string;
    tipoBiblioteca?: string;
  };
  prestamoActivo?: unknown | null;
}
export interface HistorialItem {
  idHistorial: number;
  estadoAnterior: EstadoEjemplar | null;
  estadoNuevo: EstadoEjemplar;
  fechaCambio: string;
  motivo: string;
  usuarioCambio?: {
    idUsuario: number;
    username: string;
    nombreCompleto: string;
  };
}

export interface DisponibilidadLibro {
  libroId: number;
  tituloLibro: string;
  totalEjemplares: number;
  ejemplaresDisponibles: number;
  ejemplaresPrestados: number;
  ejemplaresReservados: number;
  hayDisponibles: boolean;
  porBiblioteca: Array<{
    biblioteca: { idBiblioteca: number; nombre: string };
    total: number;
    disponibles: number;
  }>;
}
