import axios from 'axios'

const apiPublic = axios.create({
  baseURL: import.meta.env.VITE_SBF_API_URL ?? 'http://localhost:8080/api',
  headers: { 'Content-Type': 'application/json' },
})

// Solo manejo genérico de errores de red — sin redirecciones
apiPublic.interceptors.response.use(
  response => response,
  error => {
    // No redirigir, solo propagar el error para que el componente lo maneje
    return Promise.reject(error)
  },
)

export default apiPublic