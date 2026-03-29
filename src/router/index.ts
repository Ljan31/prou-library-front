import {
  createRouter,
  createWebHistory,
  type RouteRecordRaw,
} from "vue-router";
import type { RoleKey } from "@/types";

// ─── Route meta augmentation ───────────────────────────────────────────────
declare module "vue-router" {
  interface RouteMeta {
    requiresAuth?: boolean;
    roles?: RoleKey[];
    title?: string;
    breadcrumb?: string;
  }
}

// ─── Routes ────────────────────────────────────────────────────────────────
const routes: RouteRecordRaw[] = [
  {
    path: "/login",
    name: "login",
    component: () => import("@/views/auth/LoginView.vue"),
    meta: { title: "Iniciar Sesión", requiresAuth: false },
  },
  {
    path: "/",
    component: () => import("@/layouts/AppLayout.vue"),
    meta: { requiresAuth: true },
    children: [
      { path: "", redirect: "/dashboard" },
      {
        path: "dashboard",
        name: "dashboard",
        component: () => import("@/views/dashboard/DashboardView.vue"),
        meta: {
          roles: ["ROLE_ADMIN", "ROLE_BIBLIOTECARIO", "ROLE_ESTUDIANTE"],
          title: "Dashboard",
          breadcrumb: "Dashboard",
        },
      },
      // Admin
      {
        path: "usuarios",
        name: "usuarios",
        component: () => import("@/views/admin/UsuariosView.vue"),
        meta: {
          roles: ["ROLE_ADMIN"],
          title: "Usuarios",
          breadcrumb: "Usuarios",
        },
      },
      {
        path: "bibliotecas",
        name: "bibliotecas",
        component: () => import("@/views/admin/BibliotecasView.vue"),
        meta: {
          roles: ["ROLE_ADMIN"],
          title: "Bibliotecas",
          breadcrumb: "Bibliotecas",
        },
      },
      {
        path: "reportes",
        name: "reportes",
        component: () => import("@/views/admin/ReportesView.vue"),
        meta: {
          roles: ["ROLE_ADMIN", "ROLE_BIBLIOTECARIO"],
          title: "Reportes",
          breadcrumb: "Reportes",
        },
      },
      // Staff + shared
      {
        path: "catalogo",
        name: "catalogo",
        component: () => import("@/views/bibliotecario/CatalogoView.vue"),
        meta: {
          roles: ["ROLE_ADMIN", "ROLE_BIBLIOTECARIO", "ROLE_ESTUDIANTE"],
          title: "Catálogo",
          breadcrumb: "Catálogo",
        },
      },
      {
        path: "inventario",
        name: "inventario",
        component: () => import("@/views/bibliotecario/InventarioView.vue"),
        meta: {
          roles: ["ROLE_ADMIN", "ROLE_BIBLIOTECARIO"],
          title: "Inventario",
          breadcrumb: "Inventario",
        },
      },
      {
        path: "prestamos",
        name: "prestamos",
        component: () => import("@/views/bibliotecario/PrestamosView.vue"),
        meta: {
          roles: ["ROLE_ADMIN", "ROLE_BIBLIOTECARIO"],
          title: "Préstamos",
          breadcrumb: "Préstamos",
        },
      },
      {
        path: "devoluciones",
        name: "devoluciones",
        component: () => import("@/views/bibliotecario/DevolucionesView.vue"),
        meta: {
          roles: ["ROLE_ADMIN", "ROLE_BIBLIOTECARIO"],
          title: "Devoluciones",
          breadcrumb: "Devoluciones",
        },
      },
      // Estudiante
      {
        path: "mis-prestamos",
        name: "mis-prestamos",
        component: () => import("@/views/estudiante/MisPrestamosView.vue"),
        meta: {
          roles: ["ROLE_ESTUDIANTE"],
          title: "Mis Préstamos",
          breadcrumb: "Mis Préstamos",
        },
      },
      // All roles
      {
        path: "certificados",
        name: "certificados",
        component: () => import("@/views/CertificadosView.vue"),
        meta: {
          roles: ["ROLE_ADMIN", "ROLE_BIBLIOTECARIO", "ROLE_ESTUDIANTE"],
          title: "Certificados",
          breadcrumb: "Certificados",
        },
      },
      {
        path: "notificaciones",
        name: "notificaciones",
        component: () => import("@/views/NotificacionesView.vue"),
        meta: {
          roles: ["ROLE_ADMIN", "ROLE_BIBLIOTECARIO", "ROLE_ESTUDIANTE"],
          title: "Notificaciones",
          breadcrumb: "Notificaciones",
        },
      },
      {
        path: "perfil",
        name: "perfil",
        component: () => import("@/views/PerfilView.vue"),
        meta: {
          roles: ["ROLE_ADMIN", "ROLE_BIBLIOTECARIO", "ROLE_ESTUDIANTE"],
          title: "Mi Perfil",
          breadcrumb: "Perfil",
        },
      },
    ],
  },
  {
    path: "/403",
    name: "403",
    component: () => import("@/views/errors/ForbiddenView.vue"),
    meta: { title: "Acceso Denegado" },
  },
  {
    path: "/:pathMatch(.*)*",
    name: "404",
    component: () => import("@/views/errors/NotFoundView.vue"),
    meta: { title: "No encontrado" },
  },
];

// ─── Router ────────────────────────────────────────────────────────────────
const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior(_to, _from, savedPosition) {
    return savedPosition ?? { top: 0 };
  },
});

// ─── Global navigation guard ───────────────────────────────────────────────
router.beforeEach(async (to, _from) => {
  const { useAuthStore } = await import("@/stores/auth.store");
  const { useUiStore } = await import("@/stores/ui.store");

  const auth = useAuthStore();
  const ui = useUiStore();

  // Restore session once on first navigation
  if (!auth.initialized) {
    await auth.initSession();
  }

  // Update document title
  if (to.meta.title) {
    ui.setPageTitle(to.meta.title as string);
  }

  const requiresAuth = to.meta.requiresAuth !== false;
  const routeRoles = to.meta.roles as RoleKey[] | undefined;

  // 1. Needs auth but not logged in → login
  if (requiresAuth && !auth.isAuthenticated) {
    return { name: "login", query: { redirect: to.fullPath } };
  }

  // 2. Already logged in, hitting /login → dashboard
  if (!requiresAuth && auth.isAuthenticated && to.name === "login") {
    return { path: "/dashboard" };
  }

  // 3. Role check
  if (routeRoles && routeRoles.length > 0 && !auth.hasAnyRole(routeRoles)) {
    return { name: "403" };
  }

  // Vue Router v5: returning undefined / void = proceed
});

export default router;
