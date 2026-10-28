export interface UsuarioPrestamo {
  id_usuario?: number
  username?: string
  // El backend puede devolver estos datos planos o dentro de `persona`
  nombreCompleto?: string
  ci?: number | string
  persona?: { nombreCompleto?: string; ci?: number | string }
}

export interface EjemplarPrestamo {
  id_ejemplar?: number
  codigoEjemplar?: string
  codigo_ejemplar?: string
  edicion?: { titulo?: string; imagenPortada?: string; editorial?: string }
  libro?: { titulo?: string }
}

export interface Prestamo {
  id_prestamo: number
  estadoPrestamo: 'ACTIVO' | 'RENOVADO' | 'DEVUELTO' | 'VENCIDO'
  vencido: boolean
  condicionEntrega?: string
  renovaciones?: number
  fechaPrestamo?: string
  fechaDevolucionEstimada?: string
  usuario?: UsuarioPrestamo
  ejemplar?: EjemplarPrestamo
  biblioteca?: { id?: number; id_biblioteca?: number; nombre?: string }
}

export interface DevolucionPayload {
  prestamoId: number
  condicionDevolucion: string
  estadoEjemplar: string
  observaciones: string
}

export interface DevolucionResultado {
  fechaDevolucionReal?: string
  condicionDevolucion?: string
}
export interface SancionPago {
  idSancion: number
  nombreUsuario: string
  ciUsuario: string
  montoMulta: number | null
  tipoSancion?: string
  estado?: string
  fechaFinSuspension?: string | null
  observaciones?: string | null
}