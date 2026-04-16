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
  RESERVADO: {
    label: "Reservado",
    dot: "bg-blue-400",
    clases: "bg-blue-100 text-blue-700",
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
    clases: "bg-slate-100 text-slate-500",
  },
  PERDIDO: {
    label: "Perdido",
    dot: "bg-slate-600",
    clases: "bg-slate-200 text-slate-700",
  },
  DETERIORADO: {
    label: "Deteriorado",
    dot: "bg-orange-400",
    clases: "bg-orange-100 text-orange-700",
  },
};

/** Primer ISBN de las ediciones de un libro */
export function primerIsbn(ediciones: { isbn?: string }[] | undefined): string {
  return ediciones?.find((e) => e.isbn)?.isbn ?? "—";
}

/** Primera imagen de portada de las ediciones */
export function primeraPortada(
  ediciones: { imagenPortada?: string }[] | undefined,
): string {
  return ediciones?.find((e) => e.imagenPortada)?.imagenPortada ?? "";
}

/** Editorial + año de la primera edición */
export function primeraEditorial(
  ediciones: { editorial?: string; anoPublicacion?: number }[] | undefined,
): string {
  const ed = ediciones?.[0];
  if (!ed) return "—";
  return [ed.editorial, ed.anoPublicacion].filter(Boolean).join(" · ");
}
