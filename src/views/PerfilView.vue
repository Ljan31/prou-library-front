<script setup lang="ts">
import { onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth.store'
import { useUiStore } from '@/stores/ui.store'
import SCard from '@/components/ui/SCard.vue'
import SBadge from '@/components/ui/SBadge.vue'

const auth = useAuthStore()
const ui = useUiStore()
onMounted(() => ui.setBreadcrumbs([{ label: 'Perfil' }]))

const roleLabel: Record<string, string> = {
  ROLE_ADMIN: 'Administrador',
  ROLE_BIBLIOTECARIO: 'Bibliotecario',
  ROLE_ESTUDIANTE: 'Estudiante'
}
const roleVariant: Record<string, 'primary' | 'info' | 'success'> = {
  ROLE_ADMIN: 'primary',
  ROLE_BIBLIOTECARIO: 'info',
  ROLE_ESTUDIANTE: 'success'
}
</script>

<template>
  <div class="page-container max-w-2xl">
    <div class="mb-6">
      <h1 class="text-xl font-semibold text-slate-900">Mi Perfil</h1>
      <p class="text-sm text-slate-500 mt-0.5">Información personal y datos de cuenta</p>
    </div>

    <SCard padding="lg">
      <!-- Avatar + name -->
      <div class="flex items-center gap-4 pb-6 border-b border-slate-100 mb-6">
        <div
          class="w-16 h-16 rounded-2xl bg-primary-100 flex items-center justify-center text-primary-700 text-2xl font-bold">
          {{ auth.displayName.charAt(0).toUpperCase() }}
        </div>
        <div>
          <h2 class="text-lg font-semibold text-slate-900">{{ auth.displayName }}</h2>
          <p class="text-sm text-slate-500">@{{ auth.user?.username }}</p>
          <div class="flex items-center gap-1.5 mt-2 flex-wrap">
            <SBadge v-for="role in auth.roles" :key="role" :variant="roleVariant[role] ?? 'default'" :dot="true">
              {{ roleLabel[role] ?? role }}
            </SBadge>
          </div>
        </div>
      </div>

      <!-- Info grid -->
      <dl class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <dt class="text-xs font-medium text-slate-400 uppercase tracking-wider">Nombre completo</dt>
          <dd class="mt-1 text-sm font-medium text-slate-800">{{ auth.user?.persona.nombreCompleto ?? '–' }}</dd>
        </div>
        <div>
          <dt class="text-xs font-medium text-slate-400 uppercase tracking-wider">Correo electrónico</dt>
          <dd class="mt-1 text-sm font-medium text-slate-800">{{ auth.user?.persona.email ?? '–' }}</dd>
        </div>
        <div>
          <dt class="text-xs font-medium text-slate-400 uppercase tracking-wider">Cédula de Identidad</dt>
          <dd class="mt-1 text-sm font-medium text-slate-800">{{ auth.user?.persona.ci ?? '–' }}</dd>
        </div>
        <div>
          <dt class="text-xs font-medium text-slate-400 uppercase tracking-wider">Celular</dt>
          <dd class="mt-1 text-sm font-medium text-slate-800">{{ auth.user?.persona.celular ?? '–' }}</dd>
        </div>
        <div v-if="auth.bibliotecaNombre">
          <dt class="text-xs font-medium text-slate-400 uppercase tracking-wider">Biblioteca asignada</dt>
          <dd class="mt-1 text-sm font-medium text-slate-800">{{ auth.bibliotecaNombre }}</dd>
        </div>
      </dl>
    </SCard>
  </div>
</template>
