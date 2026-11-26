import type { z } from 'zod'
import type {
  CustomerOrderSchema,
  CustomerOrderSummary,
  StorefrontCatalogSchema,
  StorefrontProductSchema,
  StorefrontShopSchema,
  StorefrontVariantSchema,
} from './contract'

/** What a visitor sees (all money already in integer paise, from the contract's dbMoney). */
export type StoreShop = z.infer<typeof StorefrontShopSchema>
export type StoreCatalog = z.infer<typeof StorefrontCatalogSchema>
export type StoreProduct = z.infer<typeof StorefrontProductSchema>
export type StoreVariant = z.infer<typeof StorefrontVariantSchema>
export type CustomerOrder = z.infer<typeof CustomerOrderSchema>
export type OrderSummary = z.infer<typeof CustomerOrderSummary>
