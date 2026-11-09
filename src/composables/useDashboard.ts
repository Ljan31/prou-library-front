import { ref } from 'vue'
import { dashboardService } from '../services/dashboard.service'
import type { DashboardDTO } from '@/types/dashboard.interface'
import { useBibliotecaId } from './useBibliotecaId'
export function useDashboard() {
  const data = ref<DashboardDTO | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)
  const bibliotecaId = useBibliotecaId()

  async function load() {
    loading.value = true
    error.value = null
    try {
      console.log(bibliotecaId.value)
      data.value = await dashboardService.getDashboard(bibliotecaId.value)
      console.log(data.value)
    } catch (err: any) {
      error.value =
        err?.response?.data?.message || err?.message || 'Error al cargar el dashboard'
    } finally {
      loading.value = false
    }
  }

  return { data, loading, error, load }
}