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

// ─── Route definitions ─────────────────────────────────────────────────────
const routes: RouteRecordRaw[] = [
  // Public routes
  {
    path: "/login",
    name: "login",
    component: () => import("@/views/auth/LoginView.vue"),
    meta: { title: "Iniciar Sesión", requiresAuth: false },
  },

  // Main app (requires auth)
  {
    path: "/",
    component: () => import("@/layouts/AppLayout.vue"),
    meta: { requiresAuth: true },
    children: [
      {
        path: "",
        redirect: "/dashboard",
      },
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
      // Admin-only
      {
        path: "usuarios",
        name: "usuarios",
        component: () => import("@/views/admin/UsuariosView.vue"),
        meta: {
          roles: ["ROLE_ADMIN"],
          title: "Gestión de Usuarios",
          breadcrumb: "Usuarios",
        },
      },
      {
        path: "bibliotecas",
        name: "bibliotecas",
        component: () => import("@/views/admin/BibliotecasView.vue"),
        meta: {
          roles: ["ROLE_ADMIN"],
          title: "Gestión de Bibliotecas",
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
      // Staff routes
      {
        path: "catalogo",
        name: "catalogo",
        component: () => import("@/views/bibliotecario/CatalogoView.vue"),
        meta: {
          roles: ["ROLE_ADMIN", "ROLE_BIBLIOTECARIO", "ROLE_ESTUDIANTE"],
          title: "Catálogo Bibliográfico",
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
          title: "Gestión de Préstamos",
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
      // Student routes
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
      // Shared
      {
        path: "certificados",
        name: "certificados",
        component: () => import("@/views/CertificadosView.vue"),
        meta: {
          roles: ["ROLE_ADMIN", "ROLE_BIBLIOTECARIO", "ROLE_ESTUDIANTE"],
          title: "Certificados de No Deuda",
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
      // Profile
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

  // Error pages
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
    meta: { title: "Página no encontrada" },
  },
];

// ─── Router instance ────────────────────────────────────────────────────────
const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior(_, __, savedPosition) {
    return savedPosition ?? { top: 0 };
  },
});

// ─── Guards ─────────────────────────────────────────────────────────────────
router.beforeEach(async (to, _from, next) => {
  // Lazy import to avoid circular deps
  const { useAuthStore } = await import("@/store/auth.store");
  const { useUiStore } = await import("@/store/ui.store");

  const authStore = useAuthStore();
  const uiStore = useUiStore();

  // Initialize session once (restore from token)
  if (!authStore.initialized) {
    await authStore.initSession();
  }

  // Update page title
  if (to.meta.title) {
    uiStore.setPageTitle(to.meta.title as string);
  }

  const requiresAuth = to.meta.requiresAuth !== false;
  const routeRoles = to.meta.roles as RoleKey[] | undefined;

  // 1. Route requires auth → redirect to login
  if (requiresAuth && !authStore.isAuthenticated) {
    return next({ name: "login", query: { redirect: to.fullPath } });
  }

  // 2. Logged in user trying to visit login → go home
  if (!requiresAuth && authStore.isAuthenticated && to.name === "login") {
    return next("/dashboard");
  }

  // 3. Role guard: if route has required roles, check user has at least one
  if (
    routeRoles &&
    routeRoles.length > 0 &&
    !authStore.hasAnyRole(routeRoles)
  ) {
    return next({ name: "403" });
  }

  next();
});

export default router;
