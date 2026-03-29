import type { NavItem, RoleKey } from "@/types";

const ALL_ROLES: RoleKey[] = [
  "ROLE_ADMIN",
  "ROLE_BIBLIOTECARIO",
  "ROLE_ESTUDIANTE",
];
const STAFF_ROLES: RoleKey[] = ["ROLE_ADMIN", "ROLE_BIBLIOTECARIO"];

export const NAV_ITEMS: NavItem[] = [
  {
    label: "Dashboard",
    to: "/dashboard",
    icon: "grid",
    roles: ALL_ROLES,
  },
  {
    label: "Usuarios",
    to: "/usuarios",
    icon: "users",
    roles: ["ROLE_ADMIN"],
  },
  {
    label: "Bibliotecas",
    to: "/bibliotecas",
    icon: "building-library",
    roles: ["ROLE_ADMIN"],
  },
  {
    label: "Catálogo",
    to: "/catalogo",
    icon: "book-open",
    roles: ALL_ROLES,
  },
  {
    label: "Inventario",
    to: "/inventario",
    icon: "archive-box",
    roles: STAFF_ROLES,
  },
  {
    label: "Préstamos",
    to: "/prestamos",
    icon: "arrow-right-circle",
    roles: STAFF_ROLES,
  },
  {
    label: "Devoluciones",
    to: "/devoluciones",
    icon: "arrow-left-circle",
    roles: STAFF_ROLES,
  },
  {
    label: "Mis Préstamos",
    to: "/mis-prestamos",
    icon: "bookmark",
    roles: ["ROLE_ESTUDIANTE"],
  },
  {
    label: "Certificados",
    to: "/certificados",
    icon: "document-check",
    roles: ALL_ROLES,
  },
  {
    label: "Notificaciones",
    to: "/notificaciones",
    icon: "bell",
    roles: ALL_ROLES,
  },
  {
    label: "Reportes",
    to: "/reportes",
    icon: "chart-bar",
    roles: ["ROLE_ADMIN", "ROLE_BIBLIOTECARIO"],
  },
];
