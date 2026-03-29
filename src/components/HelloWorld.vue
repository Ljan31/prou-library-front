<script setup lang="ts">
import { ref } from 'vue'
import {
  SButton,
  SInput,
  SAlert,
  SCard,
  SBadge,
  SSelect,
  SModal,
  STable,
  SToastContainer,
  useToast
} from '../components'

const toast = useToast()

const name = ref('')
const open = ref(false)

const options = [
  { value: '1', label: 'Opción 1' },
  { value: '2', label: 'Opción 2' }
]

const columns = [
  { key: 'name', label: 'Nombre' },
  { key: 'role', label: 'Rol' }
]

const rows = [
  { id: 1, name: 'Juan', role: 'Admin' },
  { id: 2, name: 'Ana', role: 'User' }
]

// 🔥 ejemplos de toast
const showSuccess = () => toast.success('Guardado correctamente')
const showError = () => toast.error('Ocurrió un error')
const showInfo = () => toast.info('Información importante')
const showWarning = () => toast.warning('Advertencia del sistema')
</script>

<template>
  <main style="padding: 2rem; max-width: 1000px; margin: auto;">

    <h1>SIGEB UI – Design System</h1>
    <p>Demostración de componentes</p>

    <!-- 🔔 Toast -->
    <section>
      <h2>Toast</h2>
      <SButton @click="showSuccess">Success</SButton>
      <SButton variant="danger" @click="showError">Error</SButton>
      <SButton variant="secondary" @click="showInfo">Info</SButton>
      <SButton variant="warning" @click="showWarning">Warning</SButton>
    </section>

    <!-- 🔘 Buttons -->
    <section>
      <h2>Buttons</h2>
      <SButton>Primary</SButton>
      <SButton variant="secondary">Secondary</SButton>
      <SButton variant="danger">Danger</SButton>
    </section>

    <!-- 🏷️ Badges -->
    <section>
      <h2>Badges</h2>
      <SBadge>Default</SBadge>
      <SBadge variant="success">Success</SBadge>
      <SBadge variant="warning">Warning</SBadge>
    </section>

    <!-- ⚠️ Alerts -->
    <section>
      <h2>Alerts</h2>
      <SAlert title="Información" variant="info">
        Este es un mensaje informativo
      </SAlert>
      <SAlert title="Error" variant="error">
        Algo salió mal
      </SAlert>
    </section>

    <!-- 🧾 Inputs -->
    <section>
      <h2>Inputs</h2>
      <SInput v-model="name" label="Nombre" placeholder="Escribe tu nombre" />
    </section>

    <!-- 🔽 Select -->
    <section>
      <h2>Select</h2>
      <SSelect :options="options" placeholder="Selecciona una opción" />
    </section>

    <!-- 🧱 Card -->
    <section>
      <h2>Card</h2>
      <SCard title="Card Title" subtitle="Subtítulo">
        Contenido dentro de la card
      </SCard>
    </section>

    <!-- 📊 Table -->
    <section>
      <h2>Table</h2>
      <STable :columns="columns" :rows="rows" />
    </section>

    <!-- 🪟 Modal -->
    <section>
      <h2>Modal</h2>
      <SButton @click="open = true">Abrir Modal</SButton>

      <SModal v-model="open" title="Ejemplo Modal">
        <p>Contenido del modal</p>
        <SButton @click="open = false">Cerrar</SButton>
      </SModal>
    </section>

  </main>

  <!-- 🚨 IMPORTANTE: container global -->
  <SToastContainer />
</template>