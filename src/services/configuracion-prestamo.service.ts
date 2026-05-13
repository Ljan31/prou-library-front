import api from "./axios";
import type { AxiosResponse } from "axios";
// ─── Types ────────────────────────────────────────────────────────────────

export interface ConfiguracionPrestamo {
  idConfig: number;
  bibliotecaId: number;
  diasPrestamoMax: number;
  renovacionesMax: number;
  ejemplaresMaxDomicilio: number | null;
  multaPorDia: number | null;
  multaMaxDias: number | null;
  diasSuspension: number | null;
  diasReserva: number | null;
  ejemplaresMaxSala: number | null;
}

export interface ConfiguracionPrestamoPayload {
  bibliotecaId: number;
  diasPrestamoMax: number;
  renovacionesMax: number;
  ejemplaresMaxDomicilio?: number | null;
  multaPorDia?: number | null;
  multaMaxDias?: number | null;
  diasSuspension?: number | null;
  diasReserva?: number | null;
  ejemplaresMaxSala?: number | null;
}

export interface ReglasPrestamoDTO {
  idConfig: number;
  diasPrestamoMax: number | null;
  renovacionesMax: number | null;
  ejemplaresPermitidos: number | null;
  multaPorDia: number | null;
  multaMaxDias: number | null;
  diasSuspension: number | null;
  diasReserva: number | null;
}

export type TipoPrestamo = "DOMICILIO" | "SALA";

export const configuracionPrestamoService = {
  getByBiblioteca(bibliotecaId: number): Promise<ConfiguracionPrestamo> {
    return api
      .get(`/configuraciones-prestamo/biblioteca/${bibliotecaId}`)
      .then((r) => r.data);
  },

  getById(id: number): Promise<ConfiguracionPrestamo> {
    return api.get(`/configuraciones-prestamo/${id}`).then((r) => r.data);
  },

  create(
    payload: ConfiguracionPrestamoPayload,
  ): Promise<ConfiguracionPrestamo> {
    return api.post("/configuraciones-prestamo", payload).then((r) => r.data);
  },

  update(
    id: number,
    payload: ConfiguracionPrestamoPayload,
  ): Promise<ConfiguracionPrestamo> {
    return api
      .put(`/configuraciones-prestamo/${id}`, payload)
      .then((r) => r.data);
  },

  remove(id: number): Promise<void> {
    return api.delete(`/configuraciones-prestamo/${id}`).then((r) => r.data);
  },

  getReglas(
    bibliotecaId: number,
    tipoPrestamo: TipoPrestamo,
  ): Promise<ReglasPrestamoDTO> {
    return api
      .get(`/configuraciones-prestamo/biblioteca/${bibliotecaId}/reglas`, {
        params: { tipoPrestamo },
      })
      .then((r) => r.data);
  },

  calcularMulta(bibliotecaId: number, diasRetraso: number): Promise<number> {
    return api
      .get(
        `/configuraciones-prestamo/biblioteca/${bibliotecaId}/calcular-multa`,
        {
          params: { diasRetraso },
        },
      )
      .then((r) => r.data);
  },
};
