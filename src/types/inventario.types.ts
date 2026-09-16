import type { Ejemplar } from '@/types/catalogo'

/** Vista activa dentro del inventario: catálogo agrupado por libro o listado plano de ejemplares. */
export type Vista = 'libros' | 'ejemplares'

/** Opción de biblioteca usada en el filtro de administrador. */
export interface BibliotecaOpcion {
  id: number
  nombre: string
}

/** Claves por las que se puede ordenar la tabla de ejemplares. */
export type SortKey = 'codigoEjemplar' | 'titulo' | 'estado' | 'fecha' | 'biblioteca'

/** Sub-modal activo dentro de la vista de inventario. */
export type Modal = 'form' | 'estado' | 'historial' | 'confirmarEliminar' | 'transferir' | 'confirmarEliminarLibro' | null

/** Agrupación de ejemplares bajo un mismo libro, usada en la vista "libros". */
export interface LibroAgrupado {
  idLibro: number
  titulo: string
  autores: string
  idioma: string
  codigoTopograficoConcat: string
  clasificacionDecimal: string
  cutterAutor: string
  cutterTitulo: string
  isbn: string          // primer ISBN
  categoria: string
  imagenPortada: string
  total: number
  disponibles: number
  prestados: number
  bibliotecas: string[]
  ejemplares: Ejemplar[]
  expandido: boolean
}