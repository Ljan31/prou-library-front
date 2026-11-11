import api from '@/services/axios'
import type { EstudianteDashboardDTO } from '@/types/dashboard-estudiante.interface'
import type { DashboardDTO } from '@/types/dashboard.interface'

const unwrap = <T>(res: any): T => (res.data?.data ?? res.data) as T

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
  },
  async getDashboardEstudiante(): Promise<EstudianteDashboardDTO> {
    return unwrap<EstudianteDashboardDTO>(await api.get('/reportes/dashboard/estudiante'))
  }
}
