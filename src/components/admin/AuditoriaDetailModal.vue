<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { SButton } from '@/components'
import type { AuditoriaResponse } from '@/types/auditoria'
import { buildDiff, formatAuditDate, parseAuditValue, userDisplay } from '@/utils/auditoria'
import AuditActionBadge from './AuditActionBadge.vue'
import JsonDiffBlock from './JsonDiffBlock.vue'

const props = defineProps<{ modelValue: boolean; record: AuditoriaResponse | null }>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()

// <dialog> nativo: focus trap, Esc y retorno de foco gestionados por el navegador.
const dialog = ref<HTMLDialogElement | null>(null)

watch(() => props.modelValue, async (open) => {
  await nextTick()
  const d = dialog.value
  if (!d) return
  if (open && !d.open) d.showModal()
  else if (!open && d.open) d.close()
})

const close = () => emit('update:modelValue', false)
const onBackdrop = (e: MouseEvent) => { if (e.target === dialog.value) close() }

const prev = computed(() => parseAuditValue(props.record?.valoresAnteriores))
const next = computed(() => parseAuditValue(props.record?.valoresNuevos))
const diff = computed(() => buildDiff(prev.value, next.value))
const user = computed(() => userDisplay(props.record?.usuario ?? null))

const dash = (v: unknown) => (v === null || v === undefined || v === '' ? '—' : String(v))
</script>

<template>
  <dialog ref="dialog" aria-labelledby="audit-detail-title"
    class="m-auto w-[min(70rem,calc(100vw-1.5rem))] max-h-[92vh] rounded-xl border-0 p-0 text-slate-800 shadow-2xl backdrop:bg-slate-900/50"
    @close="close" @click="onBackdrop">
    <div v-if="record" class="flex max-h-[92vh] flex-col">
      <header class="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
        <div>
          <h2 id="audit-detail-title" class="text-lg font-semibold text-slate-900">Detalle de auditoría #{{ record.id_auditoria }}</h2>
          <p class="mt-0.5 text-sm text-slate-500">{{ formatAuditDate(record.fechaHora) }}</p>
        </div>
        <SButton variant="ghost" size="sm" aria-label="Cerrar detalle" @click="close">Cerrar</SButton>
      </header>

      <div class="space-y-6 overflow-y-auto px-5 py-5">
        <dl class="grid grid-cols-1 gap-x-6 gap-y-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <div><dt class="text-slate-500">Acción</dt><dd class="mt-1"><AuditActionBadge :accion="record.accion" /></dd></div>
          <div><dt class="text-slate-500">Tabla afectada</dt><dd class="mt-1 font-medium">{{ dash(record.tablaAfectada) }}</dd></div>
          <div><dt class="text-slate-500">ID del registro</dt><dd class="mt-1 font-medium">{{ dash(record.id_registro) }}</dd></div>
          <div><dt class="text-slate-500">Dirección IP</dt><dd class="mt-1 font-medium">{{ dash(record.ipAddress) }}</dd></div>
          <div class="sm:col-span-2">
            <dt class="text-slate-500">Usuario responsable</dt>
            <dd class="mt-1">
              <p class="font-medium">{{ user.primary }}</p>
              <p v-if="record.usuario" class="text-slate-600">
                <span v-if="user.secondary">@{{ user.secondary }} · </span>ID {{ record.usuario.id_usuario }}
                <span v-if="record.usuario.email"> · {{ record.usuario.email }}</span>
                <span v-if="record.usuario.ci"> · CI {{ record.usuario.ci }}</span>
              </p>
            </dd>
          </div>
        </dl>

        <div>
          <p v-if="diff.comparable" class="mb-3 text-sm text-slate-600" role="status">
            {{ diff.changedCount ? `${diff.changedCount} campo(s) con diferencias resaltados.` : 'No se detectaron diferencias entre ambos valores.' }}
            <span class="text-slate-500">Leyenda: ~ modificado · + agregado · − eliminado.</span>
          </p>
          <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <JsonDiffBlock title="Valores anteriores" :parsed="prev" :lines="diff.prevLines" />
            <JsonDiffBlock title="Valores nuevos" :parsed="next" :lines="diff.nextLines" />
          </div>
          <p class="mt-3 text-xs text-slate-500">Los campos con nombres como contraseña, token o hash se muestran ocultos.</p>
        </div>
      </div>
    </div>
  </dialog>
</template>
