import { createBrowserRouter, Navigate, type RouteObject } from 'react-router-dom'
import { RequireAuth } from '../features/auth/RequireAuth'
import { AppLayout } from './AppLayout'
import { NotFoundPage } from './NotFoundPage'
import { RouteError } from './RouteError'

/** Lazy-loads a named page export from a feature module. */
function lazyPage<K extends string>(load: () => Promise<Record<K, React.ComponentType>>, name: K) {
  return async () => ({ Component: (await load())[name] })
}

const routes: RouteObject[] = [
  {
    path: '/',
    element: (
      <RequireAuth>
        <AppLayout />
      </RequireAuth>
    ),
    errorElement: <RouteError />,
    children: [
      { index: true, element: <Navigate to="/orders" replace /> },
      {
        path: 'orders',
        lazy: lazyPage(() => import('../features/orders/OrdersPage'), 'OrdersPage'),
      },
      {
        path: 'orders/new',
        lazy: lazyPage(() => import('../features/orders/OrderPages'), 'OrderNewPage'),
      },
      {
        path: 'orders/:id',
        lazy: lazyPage(() => import('../features/orders/OrderPages'), 'OrderDetailPage'),
      },
      {
        path: 'orders/:id/edit',
        lazy: lazyPage(() => import('../features/orders/OrderPages'), 'OrderEditPage'),
      },
      {
        path: 'delivery',
        lazy: lazyPage(() => import('../features/delivery/DeliveryPage'), 'DeliveryPage'),
      },
      {
        path: 'analytics',
        lazy: lazyPage(() => import('../features/analytics/AnalyticsPage'), 'AnalyticsPage'),
      },
      {
        path: 'catalog',
        lazy: lazyPage(() => import('../features/catalog/CatalogPage'), 'CatalogPage'),
      },
      {
        path: 'catalog/new',
        lazy: lazyPage(() => import('../features/catalog/ProductEditorPage'), 'ProductEditorPage'),
      },
      {
        path: 'catalog/:productId',
        lazy: lazyPage(() => import('../features/catalog/ProductEditorPage'), 'ProductEditorPage'),
      },
      { path: 'more', lazy: lazyPage(() => import('../features/settings/MorePage'), 'MorePage') },
      {
        path: 'settings',
        lazy: lazyPage(() => import('../features/settings/SettingsPage'), 'SettingsPage'),
      },
      { path: 'trash', lazy: lazyPage(() => import('../features/trash/TrashPage'), 'TrashPage') },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
  {
    path: '/login',
    lazy: lazyPage(() => import('../features/auth/LoginPage'), 'LoginPage'),
    errorElement: <RouteError />,
  },
]

export const router = createBrowserRouter(routes)
