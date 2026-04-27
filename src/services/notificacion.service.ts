import api from "@/services/axios";
import type {
  Notificacion,
  PaginatedResponse,
  ContadorNoLeidas,
} from "@/types/notificacion.types";

export const notificacionService = {
  listar(params: { page?: number; size?: number; sort?: string } = {}) {
    return api.get<PaginatedResponse<Notificacion>>("/notificaciones", {
      params,
    });
  },

  listarNoLeidas() {
    return api.get<Notificacion[]>("/notificaciones/no-leidas");
  },

  contarNoLeidas() {
    return api.get<ContadorNoLeidas>("/notificaciones/no-leidas/contador");
  },

  marcarLeida(id: number) {
    return api.patch(`/notificaciones/${id}/leida`);
  },

  marcarTodasLeidas() {
    return api.patch("/notificaciones/leidas");
  },
};
