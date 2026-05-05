export type EstadoReserva =
  | "ACTIVA"
  | "NOTIFICADA"
  | "ATENDIDA"
  | "CANCELADA"
  | "VENCIDA";

export interface ReservaResponse {
  idReserva: number;
  usuarioId: number;
  usuarioNombreCompleto: string;
  libroId: number;
  libroTitulo: string;
  ejemplarId: number | null;
  ejemplarCodigo: string | null;
  bibliotecaId: number;
  bibliotecaNombre: string;
  prestamoId: number | null;
  fechaReserva: string; // ISO 8601
  fechaVencimientoReserva: string | null; // solo cuando NOTIFICADA
  estadoReserva: EstadoReserva;
  prioridad: number;
  observaciones: string | null;
}

export interface CrearReservaPayload {
  libroId: number;
  bibliotecaId: number;
  observaciones?: string;
}

export interface ConvertirReservaPayload {
  reservaId: number;
  condicionEntrega: "EXCELENTE" | "BUENO" | "REGULAR" | "MALO";
  tipoDocumentoGarantia: "CI" | "CARNET_UNIVERSITARIO" | "PASAPORTE";
  observaciones?: string;
  fechaDevolucionEstimada?: string;
}

// Libro público (sin auth)
export interface LibroPublico {
  idLibro: number;
  titulo: string;
  autor: string;
  isbn: string;
  editorial?: string;
  anioPublicacion?: number;
  descripcion?: string;
  portadaUrl?: string;
  nombreCategoria?: string;
  ejemplaresDisponibles?: number;
  totalEjemplares?: number;
}

export interface BibliotecaPublica {
  idBiblioteca: number;
  nombreBiblioteca: string;
  descripcion?: string;
  carrera?: string;
}

// Store de reserva pendiente (antes del login)
export interface ReservaPendiente {
  libroId: number;
  libroTitulo: string;
  libroAutor: string;
  portadaUrl?: string;
  bibliotecaId: number;
  bibliotecaNombre: string;
  observaciones?: string;
}
