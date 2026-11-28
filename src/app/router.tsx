import { createBrowserRouter, Navigate, Outlet, type RouteObject } from 'react-router-dom'
import { RequireAuth } from '../features/auth/RequireAuth'
import { ProGate } from '../features/plan/components/ProGate'
import { WriteGate } from '../features/plan/components/WriteGate'
import { STOREFRONT_ENABLED, storefrontRoutes } from '../features/storefront/routes'
import { NotFoundPage } from './NotFoundPage'
import { RouteError } from './RouteError'

/** Lazy-loads a named page export from a feature module. */
function lazyPage<K extends string>(load: () => Promise<Record<K, React.ComponentType>>, name: K) {
  return async () => ({ Component: (await load())[name] })
}

/**
 * Like lazyPage, for a Pro-only page: other plans see an upgrade message (the server enforces it too).
 * `writes`: the page also adds or changes data, so a read-only (ended) plan sees a message instead.
 */
function proPage<K extends string>(
  load: () => Promise<Record<K, React.ComponentType>>,
  name: K,
  feature: string,
  writes = false,
) {
  return async () => {
    const Inner: React.ComponentType = (await load())[name]
    return {
      Component: () => (
        <ProGate feature={feature} page>
          {writes ? (
            <WriteGate title={feature}>
              <Inner />
            </WriteGate>
          ) : (
            <Inner />
          )}
        </ProGate>
      ),
    }
  }
}

/** Like lazyPage, for a page that adds or changes data: a read-only (ended) plan sees a message instead. */
function writePage<K extends string>(
  load: () => Promise<Record<K, React.ComponentType>>,
  name: K,
  title: string,
) {
  return async () => {
    const Inner: React.ComponentType = (await load())[name]
    return {
      Component: () => (
        <WriteGate title={title}>
          <Inner />
        </WriteGate>
      ),
    }
  }
}

const routes: RouteObject[] = [
  {
    path: '/',
    // The owner frame loads on demand: shop visitors never download it.
    lazy: lazyPage(() => import('./OwnerShell'), 'OwnerShell'),
    errorElement: <RouteError />,
    children: [
      { index: true, lazy: lazyPage(() => import('../features/orders/HomePage'), 'HomePage') },
      {
        path: 'orders',
        lazy: lazyPage(() => import('../features/orders/AllOrdersPage'), 'AllOrdersPage'),
      },
      {
        path: 'orders/new',
        lazy: writePage(() => import('../features/orders/OrderPages'), 'OrderNewPage', 'New order'),
      },
      {
        path: 'orders/:id',
        lazy: lazyPage(() => import('../features/orders/OrderPages'), 'OrderDetailPage'),
      },
      {
        path: 'orders/:id/history',
        lazy: proPage(
          () => import('../features/orders/OrderHistoryPage'),
          'OrderHistoryPage',
          'Order history',
        ),
      },
      {
        path: 'activity',
        lazy: proPage(() => import('../features/activity/ActivityPage'), 'ActivityPage', 'Activity'),
      },
      {
        path: 'activity/:kind/:id',
        lazy: proPage(() => import('../features/activity/EntityLogPage'), 'EntityLogPage', 'Activity'),
      },
      {
        path: 'orders/:id/edit',
        lazy: writePage(() => import('../features/orders/OrderPages'), 'OrderEditPage', 'Edit order'),
      },
      {
        path: 'delivery',
        lazy: lazyPage(() => import('../features/delivery/DeliveryPage'), 'DeliveryPage'),
      },
      {
        path: 'analytics',
        lazy: lazyPage(() => import('../features/analytics/MoneyPage'), 'MoneyPage'),
      },
      // Old address of the pending list: the Money screen opens on it.
      { path: 'pending', element: <Navigate to="/analytics" replace /> },
      {
        path: 'catalog',
        lazy: lazyPage(() => import('../features/catalog/CatalogPage'), 'CatalogPage'),
      },
      {
        path: 'catalog/categories',
        lazy: lazyPage(() => import('../features/catalog/CategoriesPage'), 'CategoriesPage'),
      },
      {
        path: 'catalog/configure',
        lazy: proPage(
          () => import('../features/productImport/ConfigurePage'),
          'ConfigurePage',
          'Product import',
          true,
        ),
      },
      {
        path: 'catalog/new',
        lazy: writePage(() => import('../features/catalog/ProductEditorPage'), 'ProductEditorPage', 'Product'),
      },
      {
        path: 'catalog/:productId',
        lazy: writePage(() => import('../features/catalog/ProductEditorPage'), 'ProductEditorPage', 'Product'),
      },
      { path: 'more', lazy: lazyPage(() => import('../features/settings/MorePage'), 'MorePage') },
      {
        path: 'settings',
        lazy: lazyPage(() => import('../features/settings/SettingsPage'), 'SettingsPage'),
      },
      { path: 'admin', lazy: lazyPage(() => import('../features/admin/AdminPage'), 'AdminPage') },
      { path: 'plan', lazy: lazyPage(() => import('../features/plan/PlanPage'), 'PlanPage') },
      { path: 'account', lazy: lazyPage(() => import('../features/auth/OwnerAccountPage'), 'OwnerAccountPage') },
      {
        path: 'pricing',
        lazy: writePage(() => import('../features/shop/PricingOffersPage'), 'PricingOffersPage', 'Prices & offers'),
      },
      {
        path: 'more/shop',
        lazy: writePage(() => import('../features/shop/ShopProfilePage'), 'ShopProfilePage', 'Online shop'),
      },
      {
        path: 'more/shop/poster',
        lazy: lazyPage(() => import('../features/shop/ShopPosterPage'), 'ShopPosterPage'),
      },
      { path: 'trash', lazy: lazyPage(() => import('../features/trash/TrashPage'), 'TrashPage') },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
  // Public: readable before signing in (sign-up links to the terms; emailed links land on reset-password).
  {
    errorElement: <RouteError />,
    children: [
      { path: '/terms', lazy: lazyPage(() => import('../features/legal/TermsPage'), 'TermsPage') },
      { path: '/privacy', lazy: lazyPage(() => import('../features/legal/TermsPage'), 'PrivacyPage') },
      { path: '/signup', lazy: lazyPage(() => import('../features/auth/AccountPages'), 'SignupPage') },
      {
        path: '/forgot',
        lazy: lazyPage(() => import('../features/auth/AccountPages'), 'ForgotPasswordPage'),
      },
      {
        path: '/reset-password',
        lazy: lazyPage(() => import('../features/auth/AccountPages'), 'ResetPasswordPage'),
      },
    ],
  },
  {
    // Signed in but no shop yet (sign-up just finished, or an invite code arrived later). Not behind RequireOwner.
    path: '/create-shop',
    element: (
      <RequireAuth>
        <Outlet />
      </RequireAuth>
    ),
    errorElement: <RouteError />,
    children: [
      { index: true, lazy: lazyPage(() => import('../features/auth/CreateShopPage'), 'CreateShopPage') },
    ],
  },
  {
    path: '/login',
    lazy: lazyPage(() => import('../features/auth/LoginPage'), 'LoginPage'),
    errorElement: <RouteError />,
  },
  // Customer pages (/<shop>/login ...). Only when the build variable VITE_STOREFRONT_ENABLED is "true".
  ...(STOREFRONT_ENABLED ? storefrontRoutes : []),
]

/** Vite's base ("/sellbook/" on GitHub Pages, "/" locally) without the trailing slash. */
const basename = import.meta.env.BASE_URL.replace(/\/+$/, '') || '/'

export const router = createBrowserRouter(routes, { basename })
