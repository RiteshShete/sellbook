import type { ComponentType } from 'react'
import type { RouteObject } from 'react-router-dom'
import { StorefrontLayout } from './StorefrontLayout'

/** The storefront is built into the app only when the build variable is "true" (the kill switch, STOREFRONT_PLAN 14.3). */
export const STOREFRONT_ENABLED = import.meta.env.VITE_STOREFRONT_ENABLED === 'true'

function lazyStore<K extends string>(load: () => Promise<Record<K, ComponentType>>, name: K) {
  return async () => ({ Component: (await load())[name] })
}

/** Public customer routes: /<shop>/login, /signup, /forgot, /account (catalogue, cart and orders arrive in S4). */
export const storefrontRoutes: RouteObject[] = [
  {
    path: '/:slug',
    element: <StorefrontLayout />,
    children: [
      { path: 'products', lazy: lazyStore(() => import('./StoreHomePage'), 'StoreHomePage') },
      { path: 'login', lazy: lazyStore(() => import('./auth/StoreLoginPage'), 'StoreLoginPage') },
      { path: 'signup', lazy: lazyStore(() => import('./auth/StoreSignupPage'), 'StoreSignupPage') },
      { path: 'forgot', lazy: lazyStore(() => import('./auth/StoreForgotPage'), 'StoreForgotPage') },
      { path: 'account', lazy: lazyStore(() => import('./auth/StoreAccountPage'), 'StoreAccountPage') },
    ],
  },
]
