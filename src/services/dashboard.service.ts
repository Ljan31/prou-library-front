import api from '@/services/axios'
import type { DashboardDTO } from '@/types/dashboard.interface'

export const dashboardService = {
  // El alcance (global / biblioteca) lo decide el backend a partir del JWT.
  async getDashboard(bibliotecaId?: number | null): Promise<DashboardDTO> {
    const res = await api.get('/reportes/dashboard', {
      params: bibliotecaId != null
        ? { bibliotecaId }
        : {}
    })
    // Soporta respuesta envuelta { data: {...} } o directa
    console.log(res)
    return (res.data?.data ?? res.data) as DashboardDTO
  }

}
