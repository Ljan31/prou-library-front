import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useMedia } from '@/composables/useMedia'
import { useUiStore } from '@/stores/ui.store'
import { useAuthStore } from '@/stores/auth.store'
import { usePermissions } from '@/composables/usePermissions'

import {
  obtenerEjemplares,
  obtenerEjemplaresPorBiblioteca,
  transferir,
} from '@/services/ejemplares.service'
import { eliminarLibro } from '@/services/libros.service'
import api from '@/services/axios'
import type { Ejemplar } from '@/types/catalogo'
import { bibliotecasService } from '@/services/bibliotecas.service'

import type {
  Vista,
  BibliotecaOpcion,
  SortKey,
  Modal,
  LibroAgrupado,
} from '@/types/inventario.types'

/**
 * Encapsula todo el estado y la lógica de negocio de la vista de Inventario:
 * carga de bibliotecas/ejemplares, filtros, ordenamiento, paginación (vista
 * "ejemplares" y vista "libros" agrupados), control de sub-modales y las
 * acciones CRUD (crear, editar, cambiar estado, eliminar, transferir).
 *
 * La vista (InventarioView.vue) sólo consume lo que este composable expone
 * y se limita a la presentación.
 */
export function useInventario() {
  const ui = useUiStore()
  const auth = useAuthStore()
  const { isAdmin, isBibliotecario } = usePermissions()
  const router = useRouter()
  const { getUrl } = useMedia()

  onMounted(() => {
    ui.setBreadcrumbs([
      { label: 'Dashboard', to: '/dashboard' },
      { label: 'Inventario' },
    ])
    cargarBibliotecas()
    cargarEjemplares()
  })
  // watch(
  //   () => bibliotecaPropia.value,
  //   (bib) => {
  //     console.log('bib', bib)
  //     if (bib.length > 0) {
  //       cargarEjemplares()
  //     }
  //   },
  //   { immediate: true }
  // )

  // ══════════════════════════════════════════════════════════════════
  // VISTA — ejemplares | libros
  // ══════════════════════════════════════════════════════════════════
  const vistaActiva = ref<Vista>(
    (sessionStorage.getItem('inventario_vista') as Vista) ?? 'libros'
  )
  watch(vistaActiva, (v) => sessionStorage.setItem('inventario_vista', v))

  // ══════════════════════════════════════════════════════════════════
  // BIBLIOTECAS (admin)
  // ══════════════════════════════════════════════════════════════════
  const bibliotecas = ref<BibliotecaOpcion[]>([])
  const cargandoBibs = ref(false)
  const filtroBiblioteca = ref<number | ''>('')   // '' = todas

  // ─── Biblioteca del usuario logueado ──────────────────────────────────────
  const bibliotecaPropia = computed<BibliotecaOpcion | null>(() => {
    const lista = auth.user?.biblioteca
    if (!lista || lista.length === 0) return null

    const bib = lista[0] // 👈 tomas la primera

    const id = (bib.id_biblioteca ?? bib.idBiblioteca ?? bib.id) as number | undefined
    const nombre = (bib.nombre ?? bib.name) as string | undefined

    return id && nombre ? { id, nombre } : null
  })

  async function cargarBibliotecas() {
    if (!isAdmin.value) return
    cargandoBibs.value = true
    try {
      const res = await bibliotecasService.getAll()
      const raw = (res.data as any)?.data ?? res.data
      const lista = Array.isArray(raw) ? raw : []
      bibliotecas.value = lista
        .filter((b: any) => b.estado === 'ACTIVA' || !b.estado)
        .map((b: any) => ({
          id: b.id_biblioteca ?? b.idBiblioteca ?? b.id,
          nombre: b.nombre ?? b.name,
        }))
    } catch { }
    finally { cargandoBibs.value = false }
  }

  // Cuando admin cambia el filtro de biblioteca, recargar
  watch(filtroBiblioteca, () => cargarEjemplares())

  // ─── Carga de datos ───────────────────────────────────────────────────────
  const cargando = ref(false)
  const error = ref<string | null>(null)
  const todos = ref<Ejemplar[]>([])
  const pdfActivo = ref(false)
  async function cargarEjemplares() {
    cargando.value = true
    error.value = null
    try {
      // if (isBibliotecario.value && !isAdmin.value && bibliotecaPropia.value) {
      //   // Bibliotecario: solo ve su biblioteca
      //   todos.value = await obtenerEjemplaresPorBiblioteca(bibliotecaPropia.value.id)
      //   console.log('ejemplares', todos.value)
      // } else {
      //   // Admin: todos los ejemplares
      //   todos.value = await obtenerEjemplares()
      //   console.log('isadmin ejemplares', todos.value)
      // }
      if (isAdmin.value) {
        if (filtroBiblioteca.value !== '') {
          todos.value = await obtenerEjemplaresPorBiblioteca(filtroBiblioteca.value as number)
        } else {
          todos.value = await obtenerEjemplares()
        }
      } else if (isBibliotecario.value && bibliotecaPropia.value) {
        todos.value = await obtenerEjemplaresPorBiblioteca(bibliotecaPropia.value.id)
      } else {
        todos.value = []
      }
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : 'Error al cargar ejemplares'
    } finally {
      cargando.value = false
    }
  }

  // ─── Filtros ──────────────────────────────────────────────────────────────
  const busqueda = ref('')
  const estadoFiltro = ref('')
  const anioFiltro = ref<number | null>(null)

  const opcionesEstado = [
    { value: '', label: 'Todos los estados' },
    { value: 'DISPONIBLE', label: '🟢 Disponible' },
    { value: 'PRESTADO', label: '🔴 Prestado' },
    { value: 'RESERVADO', label: '🔵 Reservado' },
    { value: 'DETERIORADO', label: '🟠 Deteriorado' },
    { value: 'EN_REPARACION', label: '🟣 En reparación' },
    { value: 'DAÑADO', label: '🟡 Dañado' },
    { value: 'BAJA', label: '⬛ Baja' },
    { value: 'PERDIDO', label: '⬛ Perdido' },
  ]
  const normalizar = (valor: any) =>
    String(valor ?? '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim()

  const ejemplaresFiltrados = computed(() => {
    console.log('todos', todos.value);
    let lista = todos.value
    if (busqueda.value.trim()) {
      const q = normalizar(busqueda.value)

      lista = lista.filter(e => {
        const codigo = normalizar(
          [
            e.edicion?.idioma?.charAt(0),
            e.clasificacionDecimal,
            `${e.cutterAutor ?? ''}${e.cutterTitulo ?? ''}`
          ]
            .filter(Boolean)
            .join(' ')
        )

        return (
          e.codigoEjemplar?.toLowerCase().includes(q) ||
          e.codigoTopografico?.toLowerCase().includes(q) ||
          e.codigoTopograficoConcat?.toLowerCase().includes(q) ||
          e.ubicacionFisica?.toLowerCase().includes(q) ||
          e.edicion?.isbn?.toLowerCase().includes(q) ||
          e.edicion?.titulo?.toLowerCase().includes(q) ||
          e.autores?.toLowerCase().includes(q) ||

          // 🔥 Búsqueda del código
          codigo.startsWith(q)
        )
      })
    }

    if (anioFiltro.value !== null && anioFiltro.value !== '') {
      lista = lista.filter(
        e => Number(e.edicion?.anoPublicacion) === Number(anioFiltro.value)
      )
    }
    if (estadoFiltro.value) {
      lista = lista.filter(e => e.estadoEjemplar === estadoFiltro.value)
    }
    return lista
  })


  // ══════════════════════════════════════════════════════════════════
  // ORDENAMIENTO (Vista Ejemplares)
  // ══════════════════════════════════════════════════════════════════
  const sortKey = ref<SortKey>('codigoEjemplar')
  const sortAsc = ref(true)

  function toggleSort(key: SortKey) {
    if (sortKey.value === key) sortAsc.value = !sortAsc.value
    else { sortKey.value = key; sortAsc.value = true }
  }

  const ejemplaresOrdenados = computed(() => {
    const lista = [...ejemplaresFiltrados.value]
    lista.sort((a, b) => {
      let va: string | number = ''
      let vb: string | number = ''
      switch (sortKey.value) {
        case 'codigoEjemplar': va = a.codigoEjemplar ?? ''; vb = b.codigoEjemplar ?? ''; break
        case 'titulo': va = a.edicion?.titulo ?? ''; vb = b.edicion?.titulo ?? ''; break
        case 'estado': va = a.estadoEjemplar ?? ''; vb = b.estadoEjemplar ?? ''; break
        case 'fecha': va = a.fechaAdquisicion ?? ''; vb = b.fechaAdquisicion ?? ''; break
        case 'biblioteca': va = a.biblioteca?.nombre ?? ''; vb = b.biblioteca?.nombre ?? ''; break
      }
      const cmp = String(va).localeCompare(String(vb), 'es', { numeric: true })
      return sortAsc.value ? cmp : -cmp
    })
    return lista
  })

  // ── Paginación vista ejemplares ───────────────────────────────────
  const paginaEj = ref(1)
  const porPaginaEj = 10
  watch(ejemplaresFiltrados, () => { paginaEj.value = 1 })

  const totalPaginasEj = computed(() =>
    Math.max(1, Math.ceil(ejemplaresOrdenados.value.length / porPaginaEj))
  )
  const ejemplaresPagina = computed(() =>
    ejemplaresOrdenados.value.slice(
      (paginaEj.value - 1) * porPaginaEj,
      paginaEj.value * porPaginaEj,
    )
  )

  // ══════════════════════════════════════════════════════════════════
  // VISTA LIBROS AGRUPADOS
  // ══════════════════════════════════════════════════════════════════
  const librosExpandidos = ref<Set<number>>(new Set())

  const librosAgrupados = computed<LibroAgrupado[]>(() => {
    const mapa = new Map<number, LibroAgrupado>()
    let i = 1;
    for (const ej of ejemplaresFiltrados.value) {
      i++;
      const idLibro = (ej.edicion as any)?.idLibro ?? (ej.edicion as any)?.libro?.idLibro ?? 0
      if (!mapa.has(idLibro)) {
        mapa.set(idLibro, {
          idLibro,
          titulo: ej.edicion?.titulo ?? '—titulo-',
          autores: ej.autores ?? '—sin autor(es)-',
          isbn: ej.edicion?.isbn ?? '—isbn-',
          idioma: ej.edicion?.idioma ?? '-s/n',
          codigoTopograficoConcat: ej.codigoTopograficoConcat ?? '-s/c-',
          clasificacionDecimal: ej.clasificacionDecimal ?? '-',
          cutterAutor: ej.cutterAutor ?? '-',
          cutterTitulo: ej.cutterTitulo ?? '-',
          categoria: (ej.edicion as any)?.categoria?.nombreCategoria ?? '',
          imagenPortada: ej.edicion?.imagenPortada ?? '',
          total: 0,
          disponibles: 0,
          prestados: 0,
          bibliotecas: [],
          ejemplares: [],
          expandido: false,
        })
      }
      const libro = mapa.get(idLibro)!
      libro.total++
      if (ej.estadoEjemplar === 'DISPONIBLE') libro.disponibles++
      if (ej.estadoEjemplar === 'PRESTADO') libro.prestados++
      const bib = ej.biblioteca?.nombre
      if (bib && !libro.bibliotecas.includes(bib)) libro.bibliotecas.push(bib)
      libro.ejemplares.push(ej)
    }
    return Array.from(mapa.values()).sort((a, b) =>
      a.titulo.localeCompare(b.titulo, 'es')
    )
  })

  // Paginación vista libros
  const paginaLib = ref(1)
  const porPaginaLib = 10
  watch(librosAgrupados, () => { paginaLib.value = 1 })

  const totalPaginasLib = computed(() =>
    Math.max(1, Math.ceil(librosAgrupados.value.length / porPaginaLib))
  )
  const librosPagina = computed(() =>
    librosAgrupados.value.slice(
      (paginaLib.value - 1) * porPaginaLib,
      paginaLib.value * porPaginaLib,
    )
  )

  // function toggleLibro(libro: LibroAgrupado) {
  //   console.log('toggleLibro', libro)
  //   console.log('expendido', libro.expandido)
  //   libro.expandido = !libro.expandido
  //   console.log('libro', libro.expendido)
  // }

  function toggleLibro(libro: LibroAgrupado) {
    if (librosExpandidos.value.has(libro.idLibro)) {
      librosExpandidos.value.delete(libro.idLibro)
    } else {
      librosExpandidos.value.add(libro.idLibro)
    }
  }
  // ─── Stats resumen ────────────────────────────────────────────────────────
  const stats = computed(() => {
    const l = todos.value
    return {
      total: l.length,
      disponibles: l.filter(e => e.estadoEjemplar === 'DISPONIBLE').length,
      prestados: l.filter(e => e.estadoEjemplar === 'PRESTADO').length,
      deteriorados: l.filter(e => e.estadoEjemplar === 'DETERIORADO').length,
      reparacion: l.filter(e => ['EN_REPARACION', 'DAÑADO'].includes(e.estadoEjemplar)).length,
      inactivos: l.filter(e => ['BAJA', 'PERDIDO'].includes(e.estadoEjemplar)).length,
    }
  })

  // ─── Control de sub-modales ───────────────────────────────────────────────
  const modalActivo = ref<Modal>(null)
  const ejemplarSeleccionado = ref<Ejemplar | null>(null)
  const ejemplarEditando = ref<Ejemplar | null>(null)
  const eliminando = ref(false)
  const mostrarLibroModal = ref(false)
  const mostrarLibroModalRapido = ref(false)

  // Transferir
  const nuevaBibliotecaId = ref<number | null>(null)
  const motivoTransferir = ref('')
  const transfiriendo = ref(false)
  const errorTransferir = ref('')
  const libroId = ref<number | null>(null)
  function cerrarModal() {
    modalActivo.value = null
    ejemplarSeleccionado.value = null
    ejemplarEditando.value = null
    nuevaBibliotecaId.value = null
    motivoTransferir.value = ''
    errorTransferir.value = ''
    mostrarLibroModalRapido.value = false
  }

  function irANuevoEjemplar() {
    router.push('/inventario/new')
  }

  function abrirCrear() {
    ejemplarEditando.value = null
    modalActivo.value = 'crear'
  }

  function abrirEditar(e: Ejemplar) {
    libroId.value = e.edicion?.idLibro
    ejemplarEditando.value = e
    modalActivo.value = 'editar'
  }

  function abrirEditarEjemplar(e: Ejemplar) {
    ejemplarEditando.value = e
    modalActivo.value = 'form'
  }

  function abrirEstado(e: Ejemplar) {
    ejemplarSeleccionado.value = e
    modalActivo.value = 'estado'
  }

  function abrirHistorial(e: Ejemplar) {
    ejemplarSeleccionado.value = e
    modalActivo.value = 'historial'
  }

  function abrirConfirmarEliminar(e: Ejemplar) {
    ejemplarSeleccionado.value = e
    modalActivo.value = 'confirmarEliminar'
  }

  function abrirConfirmarEliminarLibro(e: Ejemplar) {
    ejemplarSeleccionado.value = e
    modalActivo.value = 'confirmarEliminarLibro'
  }

  function abrirTransferir(e: Ejemplar) {
    ejemplarSeleccionado.value = e
    modalActivo.value = 'transferir'
  }
  function verPdf(url: string) {
    window.open(getUrl(url), '_blank')
  }

  // ─── Acciones ─────────────────────────────────────────────────────────────
  function onGuardado() {
    cerrarModal()
    cargarEjemplares()
    ui.toast.success('Guardado', 'Ejemplar guardado correctamente')
  }

  function onEstadoCambiado() {
    cerrarModal()
    cargarEjemplares()
    ui.toast.success('Estado actualizado', 'El estado del ejemplar fue cambiado')
  }

  async function confirmarEliminar() {
    console.log(ejemplarSeleccionado.value)
    if (!ejemplarSeleccionado.value) return
    eliminando.value = true
    try {
      await api.delete(`/ejemplares/${ejemplarSeleccionado.value.id_ejemplar}`)
      ui.toast.success('Eliminado', `Ejemplar ${ejemplarSeleccionado.value.codigoTopograficoConcat} eliminado`)
      cerrarModal()
      cargarEjemplares()
    } catch (e: unknown) {
      ui.toast.error('Error', e instanceof Error ? e.response?.data?.message : 'No se pudo eliminar')
    } finally {
      eliminando.value = false
    }
  }
  async function confirmarEliminarLibro() {
    if (!ejemplarSeleccionado.value) return
    const idLibro = ejemplarSeleccionado.value.edicion?.idLibro

    if (!idLibro) {
      ui.toast.error(
        'Error',
        'No se encontró el libro asociado al ejemplar'
      )
      return
    }

    eliminando.value = true
    try {
      await eliminarLibro(idLibro)
      ui.toast.success('Eliminado', `Libro ${ejemplarSeleccionado.value.edicion?.titulo} eliminado`)
      cerrarModal()
      cargarEjemplares()
    } catch (e: unknown) {
      ui.toast.error('Error', e instanceof Error ? e.response?.data?.message : 'No se pudo eliminar')
    } finally {
      eliminando.value = false
    }
  }

  async function confirmarTransferir() {
    if (!ejemplarSeleccionado.value || !nuevaBibliotecaId.value) return
    if (!motivoTransferir.value.trim()) { errorTransferir.value = 'El motivo es requerido'; return }
    transfiriendo.value = true
    errorTransferir.value = ''
    try {
      await transferir(
        ejemplarSeleccionado.value.idEjemplar,
        nuevaBibliotecaId.value,
        motivoTransferir.value
      )
      ui.toast.success('Transferido', 'Ejemplar transferido correctamente')
      cerrarModal()
      cargarEjemplares()
    } catch (e: unknown) {
      errorTransferir.value = e instanceof Error ? e.message : 'Error al transferir'
    } finally {
      transfiriendo.value = false
    }
  }

  // ─── Exportar a CSV (simple) ───────────────────────────────────────────────
  function exportarCSV() {
    const cols = ['Código', 'Topográfico', 'Estado', 'Ubicación', 'ISBN', 'Título', 'Biblioteca', 'Adquisición', 'Precio']
    const filas = ejemplaresFiltrados.value.map(e => [
      e.codigoEjemplar,
      e.codigoTopografico ?? '',
      e.estadoEjemplar,
      e.ubicacionFisica ?? '',
      e.edicion?.isbn ?? '',
      e.edicion?.titulo ?? '',
      e.biblioteca?.nombre ?? '',
      e.fechaAdquisicion ?? '',
      e.precioCompra ?? '',
    ])
    const csv = [cols, ...filas].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `inventario-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // ── Helpers ────────────────────────────────────────────────────────
  function sortIcon(key: SortKey) {
    if (sortKey.value !== key) return 'text-slate-300'
    return sortAsc.value ? 'text-indigo-500 rotate-0' : 'text-indigo-500 rotate-180'
  }

  function disponibilidadColor(disponibles: number, total: number) {
    const pct = total ? disponibles / total : 0
    if (pct >= 0.6) return 'bg-emerald-500'
    if (pct >= 0.3) return 'bg-amber-400'
    return 'bg-red-500'
  }
  function resetFiltros() {
    busqueda.value = ''
    estadoFiltro.value = ''
    anioFiltro.value = null
    paginaEj.value = 1
    paginaLib.value = 1
    // ejecutarBusqueda()
    cargarEjemplares()
  }
  return {
    // acceso directo (stores, permisos, router, utilidades)
    ui,
    auth,
    isAdmin,
    isBibliotecario,
    router,
    getUrl,

    // vista activa
    vistaActiva,

    // bibliotecas
    bibliotecas,
    cargandoBibs,
    filtroBiblioteca,
    bibliotecaPropia,
    cargarBibliotecas,

    // carga de ejemplares
    cargando,
    error,
    todos,
    pdfActivo,
    cargarEjemplares,
    resetFiltros,

    // filtros
    busqueda,
    estadoFiltro,
    anioFiltro,
    opcionesEstado,
    ejemplaresFiltrados,

    // ordenamiento
    sortKey,
    sortAsc,
    toggleSort,
    ejemplaresOrdenados,
    sortIcon,

    // paginación vista ejemplares
    paginaEj,
    porPaginaEj,
    totalPaginasEj,
    ejemplaresPagina,

    // vista libros agrupados
    librosExpandidos,
    librosAgrupados,
    paginaLib,
    porPaginaLib,
    totalPaginasLib,
    librosPagina,
    toggleLibro,

    // stats
    stats,

    // sub-modales y acciones
    modalActivo,
    ejemplarSeleccionado,
    ejemplarEditando,
    eliminando,
    mostrarLibroModal,
    mostrarLibroModalRapido,
    nuevaBibliotecaId,
    motivoTransferir,
    transfiriendo,
    errorTransferir,
    libroId,
    cerrarModal,
    irANuevoEjemplar,
    abrirCrear,
    abrirEditar,
    abrirEditarEjemplar,
    abrirEstado,
    abrirHistorial,
    abrirConfirmarEliminar,
    abrirConfirmarEliminarLibro,
    abrirTransferir,
    verPdf,
    onGuardado,
    onEstadoCambiado,
    confirmarEliminar,
    confirmarEliminarLibro,
    confirmarTransferir,
    exportarCSV,
    disponibilidadColor,
  }
}