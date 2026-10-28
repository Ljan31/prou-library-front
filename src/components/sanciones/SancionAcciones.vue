<script setup lang="ts">
/**
 * Acciones disponibles para una sanción (pagar, reposición física, condonar).
 * Única fuente de las reglas: se usa en la tabla (compact) y en el footer del detalle.
 */
import { computed, nextTick, onBeforeUnmount, ref } from 'vue'
import SButton from '@/components/ui/SButton.vue'
import { useAuthStore } from '@/stores/auth.store'
import {
  esReposicion, formatMonto, montoSancion, puedePagar, reposicionPendiente,
} from '@/utils/sancion.utils'
import type { SancionResponse } from '@/types/notificacion.types'

type Clave = 'pagar' | 'reposicion-fisica' | 'condonar'
interface Accion { clave: Clave; label: string; variant: 'success' | 'outline' | 'danger' }

const props = withDefaults(defineProps<{ sancion: SancionResponse; compact?: boolean }>(), { compact: false })
const emit = defineEmits<{
  detalle: [s: SancionResponse]
  pagar: [s: SancionResponse]
  'reposicion-fisica': [s: SancionResponse]
  condonar: [s: SancionResponse]
}>()

const auth = useAuthStore()

const acciones = computed<Accion[]>(() => {
  const s = props.sancion
  const lista: Accion[] = []

  if (puedePagar(s)) {
    const base = esReposicion(s) ? 'Pagar reposición' : 'Registrar pago'
    lista.push({
      clave: 'pagar',
      variant: 'success',
      label: props.compact ? base : `${base} (${formatMonto(montoSancion(s))})`,
    })
  }
  if (reposicionPendiente(s)) {
    lista.push({ clave: 'reposicion-fisica', variant: 'outline', label: props.compact ? 'Reposición física' : 'Registrar reposición física' })
  }
  // Solo ADMIN puede condonar
  if (s.estado === 'ACTIVA' && auth.isAdmin) {
    lista.push({ clave: 'condonar', variant: 'danger', label: 'Condonar' })
  }
  return lista
})

/** Compacto: una acción visible + el resto en el menú ⋯ */
const visibles = computed(() => (props.compact ? acciones.value.slice(0, 1) : acciones.value))
const enMenu = computed(() => (props.compact ? acciones.value.slice(1) : []))

function ejecutar(a: Accion) {
  cerrarMenu()
  emit(a.clave, props.sancion)
}

// ── Menú ⋯ (teleport + posición fija para que no lo recorte el overflow de la tabla) ──
const menuAbierto = ref(false)
const trigger = ref<HTMLButtonElement | null>(null)
const menu = ref<HTMLElement | null>(null)
const posicion = ref({ top: 0, right: 0 })

async function alternarMenu() {
  if (menuAbierto.value) return cerrarMenu()
  const r = trigger.value?.getBoundingClientRect()
  if (r) posicion.value = { top: r.bottom + 4, right: window.innerWidth - r.right }
  menuAbierto.value = true
  await nextTick()
  document.addEventListener('mousedown', clickFuera)
  document.addEventListener('keydown', teclado)
  window.addEventListener('scroll', cerrarMenu, true)
  window.addEventListener('resize', cerrarMenu)
}

function cerrarMenu() {
  if (!menuAbierto.value) return
  menuAbierto.value = false
  document.removeEventListener('mousedown', clickFuera)
  document.removeEventListener('keydown', teclado)
  window.removeEventListener('scroll', cerrarMenu, true)
  window.removeEventListener('resize', cerrarMenu)
}

function clickFuera(e: MouseEvent) {
  const t = e.target as Node
  if (!menu.value?.contains(t) && !trigger.value?.contains(t)) cerrarMenu()
}

function teclado(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    cerrarMenu()
    trigger.value?.focus()
  }
}

onBeforeUnmount(cerrarMenu)
</script>

<template>
  <div class="flex items-center justify-end gap-1.5 flex-wrap">
    <SButton v-if="compact" variant="ghost" size="xs" @click="emit('detalle', sancion)">Detalle</SButton>

    <SButton v-for="a in visibles" :key="a.clave" :variant="a.variant" :size="compact ? 'xs' : 'md'"
      @click="ejecutar(a)">
      {{ a.label }}
    </SButton>

    <template v-if="enMenu.length">
      <button ref="trigger" type="button" aria-haspopup="menu" :aria-expanded="menuAbierto"
        aria-label="Más acciones"
        class="w-7 h-7 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 flex items-center justify-center transition-colors"
        @click="alternarMenu">
        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" />
        </svg>
      </button>

      <Teleport to="body">
        <div v-if="menuAbierto" ref="menu" role="menu"
          class="fixed z-50 w-48 bg-white border border-slate-200 rounded-xl shadow-lg py-1"
          :style="{ top: `${posicion.top}px`, right: `${posicion.right}px` }">
          <button v-for="a in enMenu" :key="a.clave" type="button" role="menuitem"
            :class="['w-full text-left px-3 py-2 text-sm hover:bg-slate-50 transition-colors',
              a.variant === 'danger' ? 'text-red-600' : 'text-slate-700']"
            @click="ejecutar(a)">
            {{ a.label }}
          </button>
        </div>
      </Teleport>
    </template>
  </div>
</template>
