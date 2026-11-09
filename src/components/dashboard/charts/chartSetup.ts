import { formatNumber } from '@/utils/format'
import {
  Chart, CategoryScale, LinearScale, PointElement, LineElement,
  BarElement, ArcElement, Tooltip, Legend, Filler
} from 'chart.js'
import type { TooltipItem } from 'chart.js'

Chart.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Tooltip, Legend, Filler)
Chart.defaults.font.family = "'DM Sans', system-ui, sans-serif"
Chart.defaults.color = '#64748b' // slate-500

export const COLORS = {
  indigo: '#4f46e5', sky: '#0ea5e9', emerald: '#059669', amber: '#f59e0b',
  orange: '#f97316', red: '#dc2626', violet: '#7c3aed', slate: '#94a3b8'
}
export const FALLBACK_COLORS = Object.values(COLORS)

export function tooltipLabel(ctx: TooltipItem<any>): string {
  const p = ctx.parsed
  const v = typeof p === 'number' ? p : ctx.chart.options.indexAxis === 'y' ? p.x : p.y
  const name = ctx.dataset.label || ctx.label
  return `${name}: ${formatNumber(v)}`
}

export const baseScaleY = { beginAtZero: true, ticks: { precision: 0 }, grid: { color: '#f1f5f9' } }