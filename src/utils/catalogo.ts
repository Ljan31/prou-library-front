// ─── utils/catalogo.ts ────────────────────────────────────────────────────
import type { EstadoEjemplar } from "@/types/catalogo";

export const estadoEjemplarConfig: Record<
  EstadoEjemplar,
  {
    label: string;
    dot: string;
    clases: string;
  }
> = {
  DISPONIBLE: {
    label: "Disponible",
    dot: "bg-emerald-500",
    clases: "bg-emerald-100 text-emerald-700",
  },
  PRESTADO: {
    label: "Prestado",
    dot: "bg-red-500",
    clases: "bg-red-100 text-red-700",
  },
  EN_REPARACION: {
    label: "En reparación",
    dot: "bg-amber-400",
    clases: "bg-amber-100 text-amber-700",
  },
  DAÑADO: {
    label: "Dañado",
    dot: "bg-amber-500",
    clases: "bg-amber-100 text-amber-700",
  },
  BAJA: {
    label: "Baja",
    dot: "bg-slate-400",
    clases: "bg-slate-100 text-slate-600",
  },
  PERDIDO: {
    label: "Perdido",
    dot: "bg-slate-500",
    clases: "bg-slate-200 text-slate-700",
  },
};
