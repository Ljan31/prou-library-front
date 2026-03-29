<script setup lang="ts">
defineProps<{ name: string; class?: string }>()
</script>

<template>
  <!-- grid -->
  <svg v-if="name === 'grid'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" :class="$props.class">
    <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
    <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
  </svg>
  <!-- users -->
  <svg v-else-if="name === 'users'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" :class="$props.class">
    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
  </svg>
  <!-- building-library -->
  <svg v-else-if="name === 'building-library'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" :class="$props.class">
    <path d="M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11M20 10v11M8 14v3M12 14v3M16 14v3"/>
  </svg>
  <!-- book-open -->
  <svg v-else-if="name === 'book-open'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" :class="$props.class">
    <path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2zM22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/>
  </svg>
  <!-- archive-box -->
  <svg v-else-if="name === 'archive-box'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" :class="$props.class">
    <polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/>
    <line x1="10" y1="12" x2="14" y2="12"/>
  </svg>
  <!-- arrow-right-circle -->
  <svg v-else-if="name === 'arrow-right-circle'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" :class="$props.class">
    <circle cx="12" cy="12" r="10"/><polyline points="12 16 16 12 12 8"/><line x1="8" y1="12" x2="16" y2="12"/>
  </svg>
  <!-- arrow-left-circle -->
  <svg v-else-if="name === 'arrow-left-circle'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" :class="$props.class">
    <circle cx="12" cy="12" r="10"/><polyline points="12 8 8 12 12 16"/><line x1="16" y1="12" x2="8" y2="12"/>
  </svg>
  <!-- bookmark -->
  <svg v-else-if="name === 'bookmark'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" :class="$props.class">
    <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/>
  </svg>
  <!-- document-check -->
  <svg v-else-if="name === 'document-check'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" :class="$props.class">
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
    <polyline points="9 15 11 17 15 13"/>
  </svg>
  <!-- bell -->
  <svg v-else-if="name === 'bell'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" :class="$props.class">
    <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"/>
  </svg>
  <!-- chart-bar -->
  <svg v-else-if="name === 'chart-bar'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" :class="$props.class">
    <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/>
    <line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/>
  </svg>
  <!-- fallback -->
  <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" :class="$props.class">
    <circle cx="12" cy="12" r="10"/>
  </svg>
</template>
