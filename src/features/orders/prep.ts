import { z } from 'zod'
import { measureTotalsShape } from '../../lib/measure'

const count = z.number().int().nonnegative()

const PrepVariantSchema = z.object({
  key: z.string(),
  name: z.string(),
  quantity: count,
  orders: count,
  ...measureTotalsShape,
})

const PrepProductSchema = z.object({
  key: z.string(),
  name: z.string(),
  quantity: count,
  orders: count,
  ...measureTotalsShape,
  variants: z.array(PrepVariantSchema),
})

/** prep_list(): items of all "new" orders, summed per product and variant, in catalog order. */
export const PrepListSchema = z.object({
  orders: count,
  products: z.array(PrepProductSchema),
})
export type PrepList = z.infer<typeof PrepListSchema>
export type PrepProduct = z.infer<typeof PrepProductSchema>
