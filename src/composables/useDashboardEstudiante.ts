import { ref } from 'vue'
import { dashboardService } from '../services/dashboard.service'
import type { EstudianteDashboardDTO } from '@/types/dashboard-estudiante.interface'


export function useDashboardEstudiante() {
  const data = ref<EstudianteDashboardDTO | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function load() {
    loading.value = true
    error.value = null
    try {
      data.value = await dashboardService.getDashboardEstudiante()
    } catch (err: any) {
      error.value = err?.response?.data?.message || err?.message || 'Error al cargar tu resumen'
    } finally {
      loading.value = false
    }
  }

  return { data, loading, error, load }
}