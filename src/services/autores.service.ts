import api from '@/services/axios'

export interface Autor {
  idAutor: number
  nombre: string
}

interface ApiResponse<T> {
  success: boolean
  message: string
  data: T
}

// Desenvuelve ApiResponse<T>. Si tu interceptor de axios ya lo desenvuelve,
// cambia `res.data.data` por `res.data`.
const unwrap = <T>(res: { data: ApiResponse<T> }) => res.data

export const autoresService = {
  listar: async () => (await api.get<ApiResponse<Autor[]>>('/autores')).data.data,

  buscar: async (q: string) =>
    (await api.get<ApiResponse<Autor[]>>('/autores/search', { params: { q } })).data.data,

  crear: async (nombre: string) =>
    unwrap(await api.post<ApiResponse<Autor>>('/autores', { nombre })),

  actualizar: async (id: number, nombre: string) =>
    unwrap(await api.put<ApiResponse<Autor>>(`/autores/${id}`, { nombre })),

  eliminar: async (id: number) =>
    unwrap(await api.delete<ApiResponse<null>>(`/autores/${id}`)),
}

export const getErrorMessage = (e: any, fallback = 'Ocurrió un error inesperado') =>
  e?.response?.data?.message ?? e?.message ?? fallback