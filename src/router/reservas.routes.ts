import type { RouteRecordRaw } from "vue-router";

/** Rutas PÚBLICAS — agregar al nivel raíz de `routes` */
export const rutasPublicasReservas: RouteRecordRaw[] = [
  {
    path: "/catalogo-reservas",
    name: "catalogo-reservas",
    component: () => import("@/views/reservas/CatalogoReservasView.vue"),
    meta: {
      requiresAuth: false,
      title: "Catálogo de Reservas",
    },
  },
];

/** Rutas PROTEGIDAS — agregar en children del AppLayout (path: '/') */
export const rutasProtegidasReservas: RouteRecordRaw[] = [
  {
    path: "mis-reservas",
    name: "mis-reservas",
    component: () => import("@/views/reservas/MisReservasView.vue"),
    meta: {
      requiresAuth: true,
      roles: ["ROLE_ADMIN", "ROLE_BIBLIOTECARIO", "ROLE_ESTUDIANTE"] as const,
      title: "Mis Reservas",
      breadcrumb: "Mis Reservas",
    },
  },
  {
    path: "reservas",
    name: "reservas",
    component: () => import("@/views/reservas/ReservasAdminView.vue"),
    meta: {
      requiresAuth: true,
      roles: ["ROLE_ADMIN", "ROLE_BIBLIOTECARIO"] as const,
      title: "Gestión de Reservas",
      breadcrumb: "Reservas",
    },
  },
];
