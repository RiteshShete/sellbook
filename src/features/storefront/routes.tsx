import type { ComponentType } from 'react'
import { Navigate, type RouteObject } from 'react-router-dom'
import { ShopNotFound } from './components/ShopNotFound'
import { StorefrontLayout } from './StorefrontLayout'

/** The storefront is built into the app only when the build variable is "true" (the kill switch, STOREFRONT_PLAN 14.3). */
export const STOREFRONT_ENABLED = import.meta.env.VITE_STOREFRONT_ENABLED === 'true'

function lazyStore<K extends string>(load: () => Promise<Record<K, ComponentType>>, name: K) {
  return async () => ({ Component: (await load())[name] })
}

/**
 * Public customer routes under /<shop>. Every page is its own lazy chunk, so a visitor downloads only what they open.
 * Owner routes are declared with fixed first segments (reserved shop addresses), so they never reach this tree.
 */
export const storefrontRoutes: RouteObject[] = [
  {
    path: '/:slug',
    element: <StorefrontLayout />,
    children: [
      { index: true, element: <Navigate to="products" replace /> },
      { path: 'products', lazy: lazyStore(() => import('./browse/StoreCatalogPage'), 'StoreCatalogPage') },
      { path: 'products/:productId', lazy: lazyStore(() => import('./product/StoreProductPage'), 'StoreProductPage') },
      { path: 'cart', lazy: lazyStore(() => import('./cart/CartPage'), 'CartPage') },
      { path: 'checkout', lazy: lazyStore(() => import('./checkout/CheckoutPage'), 'CheckoutPage') },
      { path: 'orders', lazy: lazyStore(() => import('./track/OrdersPage'), 'OrdersPage') },
      { path: 'orders/:orderId', lazy: lazyStore(() => import('./track/OrderPage'), 'OrderPage') },
      { path: 'login', lazy: lazyStore(() => import('./auth/StoreLoginPage'), 'StoreLoginPage') },
      { path: 'signup', lazy: lazyStore(() => import('./auth/StoreSignupPage'), 'StoreSignupPage') },
      { path: 'forgot', lazy: lazyStore(() => import('./auth/StoreForgotPage'), 'StoreForgotPage') },
      { path: 'account', lazy: lazyStore(() => import('./auth/StoreAccountPage'), 'StoreAccountPage') },
      { path: '*', element: <ShopNotFound /> },
    ],
  },
]
