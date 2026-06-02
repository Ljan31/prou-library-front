import { h, defineComponent } from 'vue'
import type { Component } from 'vue'

// Tipo para los iconos
export type IconComponent = Component

// Helper para crear iconos
const createIcon = (children: any[]): IconComponent => {
  return defineComponent({
    render: () => h('svg', {
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      "stroke-width": "1.8",
      class: "w-4 h-4"
    }, children)
  })
}

// ==================== ICONOS ====================

export const BookIcon: IconComponent = createIcon([
  h('path', { d: "M4 19.5A2.5 2.5 0 0 1 6.5 17H20" }),
  h('path', { d: "M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" })
])

export const ClockIcon: IconComponent = createIcon([
  h('circle', { cx: "12", cy: "12", r: "10" }),
  h('polyline', { points: "12 6 12 12 16 14" })
])

export const BookmarkIcon: IconComponent = createIcon([
  h('path', { d: "M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" })
])

export const ShieldIcon: IconComponent = createIcon([
  h('path', { d: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" })
])

export const UsersIcon: IconComponent = createIcon([
  h('path', { d: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" }),
  h('circle', { cx: "9", cy: "7", r: "4" }),
  h('path', { d: "M23 21v-2a4 4 0 0 0-3-3.87" }),
  h('path', { d: "M16 3.13a4 4 0 0 1 0 7.75" })
])

export const DocumentCheckIcon: IconComponent = createIcon([
  h('path', { d: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" }),
  h('polyline', { points: "14 2 14 8 20 8" }),
  h('polyline', { points: "9 15 11 17 15 13" })
])

export const LibraryIcon: IconComponent = createIcon([
  h('path', { d: "M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" }),
  h('polyline', { points: "9 22 9 12 15 12 15 22" })
])

export const ChartIcon: IconComponent = createIcon([
  h('line', { x1: "18", y1: "20", x2: "18", y2: "10" }),
  h('line', { x1: "12", y1: "20", x2: "12", y2: "4" }),
  h('line', { x1: "6", y1: "20", x2: "6", y2: "14" })
])

export const PlusIcon: IconComponent = createIcon([
  h('line', { x1: "12", y1: "5", x2: "12", y2: "19" }),
  h('line', { x1: "5", y1: "12", x2: "19", y2: "12" })
])

export const ReturnIcon: IconComponent = createIcon([
  h('polyline', { points: "1 4 1 10 7 10" }),
  h('path', { d: "M3.51 15a9 9 0 1 0 .49-3.36" })
])

export const BoxIcon: IconComponent = createIcon([
  h('path', { d: "M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" }),
  h('polyline', { points: "3.27 6.96 12 12.01 20.73 6.96" }),
  h('line', { x1: "12", y1: "22.08", x2: "12", y2: "12" })
])