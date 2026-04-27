export type TipoNotificacion =
  | "RECORDATORIO_DEVOLUCION"
  | "VENCIMIENTO"
  | "RESERVA_DISPONIBLE"
  | "SANCION";

export type CanalNotificacion = "EMAIL" | "SISTEMA" | "SMS";
export type EstadoEnvio = "PENDIENTE" | "ENVIADO" | "FALLIDO";

export interface Notificacion {
  idNotificacion: number;
  tipoNotificacion: TipoNotificacion;
  asunto: string;
  mensaje: string;
  fechaEnvio: string | null;
  fechaLectura: string | null;
  estadoEnvio: EstadoEnvio;
  canal: CanalNotificacion;
  idReferencia: number | null;
  leida: boolean;
}

export interface PaginatedResponse<T> {
  content: T[];
  number: number;
  size: number;
  totalElements: number;
  totalPages: number;
  first: boolean;
  last: boolean;
}

export interface ContadorNoLeidas {
  total: number;
}

// ─── Sanciones ───────────────────────────────────────────────────────────────

export type TipoSancion = "MULTA" | "SUSPENSION" | "MULTA_Y_SUSPENSION";
export type MotivoSancion =
  | "RETRASO_DEVOLUCION"
  | "DANIO_EJEMPLAR"
  | "PERDIDA_EJEMPLAR"
  | "REINCIDENCIA";
export type EstadoSancion = "ACTIVA" | "PAGADA" | "CONDONADA";

export interface SancionResponse {
  idSancion: number;
  usuarioId: number;
  nombreUsuario: string;
  ciUsuario: string;
  prestamoId: number | null;
  bibliotecaId: number;
  nombreBiblioteca: string;
  tipoSancion: TipoSancion;
  motivo: MotivoSancion;
  estado: EstadoSancion;
  diasRetraso: number | null;
  montoMulta: number | null;
  diasSuspension: number | null;
  fechaGeneracion: string;
  fechaInicioSuspension: string | null;
  fechaFinSuspension: string | null;
  fechaPago: string | null;
  fechaCondonacion: string | null;
  metodoPago: string | null;
  observaciones: string | null;
  suspensionVigente: boolean;
}

export interface EstadoSancionUsuario {
  usuarioId: number;
  tieneSuspensionVigente: boolean;
  tieneDeudaPendiente: boolean;
  totalSancionesActivas: number;
  fechaFinSuspensionMasProxima: string | null;
}

export interface SancionManualRequest {
  usuarioId: number;
  bibliotecaId: number;
  prestamoId?: number | null;
  motivo: "DANIO_EJEMPLAR" | "PERDIDA_EJEMPLAR" | "REINCIDENCIA";
  montoFijo?: number | null;
  observaciones?: string;
}

export interface PagoMultaRequest {
  metodoPago: string;
  observaciones?: string;
}

export interface CondonacionRequest {
  observaciones: string;
}
