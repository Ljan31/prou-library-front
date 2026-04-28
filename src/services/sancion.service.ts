import api from "@/services/axios";
import type {
  SancionResponse,
  EstadoSancionUsuario,
  SancionManualRequest,
  PagoMultaRequest,
  CondonacionRequest,
} from "@/types/notificacion.types";

export const sancionService = {
  procesarDevolucionTardia(idPrestamo: number) {
    return api.post<SancionResponse>(
      `/sanciones/prestamo/${idPrestamo}/procesar`,
    );
  },

  registrarManual(data: SancionManualRequest) {
    return api.post<SancionResponse>("/sanciones/manual", data);
  },

  buscarPorId(id: number) {
    return api.get<SancionResponse>(`/sanciones/${id}`);
  },

  historialUsuario(usuarioId: number) {
    return api.get<SancionResponse[]>(
      `/sanciones/usuario/${usuarioId}/historial`,
    );
  },

  sancionesActivas(usuarioId: number) {
    return api.get<SancionResponse[]>(
      `/sanciones/usuario/${usuarioId}/activas`,
    );
  },

  estadoSanciones(usuarioId: number) {
    return api.get<EstadoSancionUsuario>(
      `/sanciones/usuario/${usuarioId}/estado`,
    );
  },

  porBiblioteca(
    bibliotecaId: number,
    estado: "ACTIVA" | "PAGADA" | "CONDONADA" = "ACTIVA",
  ) {
    return api.get<SancionResponse[]>(`/sanciones/biblioteca/${bibliotecaId}`, {
      params: { estado },
    });
  },

  registrarPago(id: number, data: PagoMultaRequest) {
    return api.patch<SancionResponse>(`/sanciones/${id}/pago`, data);
  },

  condonar(id: number, data: CondonacionRequest) {
    return api.patch<SancionResponse>(`/sanciones/${id}/condonar`, data);
  },
};
