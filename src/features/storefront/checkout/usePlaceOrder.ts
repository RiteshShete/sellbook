import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { uuid } from '../../../lib/id'
import { normalizePhone } from '../../../lib/phone'
import { queryKeys } from '../../../lib/queryKeys'
import { useAuth } from '../../auth/useAuth'
import { placeOrder, saveAddress, StoreError } from '../api/storefrontApi'
import { cartSignature } from '../cart/cartStore'
import { useCart } from '../cart/useCart'
import { storefrontPath } from '../paths'
import { buildPlaceOrder } from './buildRequest'
import { clearOrderKey, orderKeyFor } from './idempotency'
import type { CheckoutInput } from './validate'

function session(): Storage | null {
  try {
    return window.sessionStorage
  } catch {
    return null
  }
}

/**
 * Place the order. The key is made from the CART, so a double tap, a slow network and a retry all send the same key and
 * the server returns the one order. On success the cart and the key are cleared and the customer sees the order page.
 * When the server says some items are gone (SB422), the catalogue is reloaded so the cart shows which ones.
 */
export function usePlaceOrder(slug: string) {
  const { client } = useAuth()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { cart, clear } = useCart(slug)

  return useMutation({
    mutationFn: async (v: { input: CheckoutInput; remember: boolean }) => {
      const a = v.input.address
      const phone = normalizePhone(a.phone)
      if (v.remember && v.input.fulfilment === 'delivery' && v.input.addressId === null && phone) {
        await saveAddress(client, { name: a.name.trim(), phone, line1: a.line1.trim(), city: a.city.trim(), pincode: a.pincode.trim() })
      }
      const key = orderKeyFor(session(), slug, cartSignature(cart), uuid)
      return placeOrder(client, buildPlaceOrder(slug, cart, v.input, key))
    },
    onSuccess: async (order) => {
      clearOrderKey(session(), slug)
      clear()
      await queryClient.invalidateQueries({ queryKey: queryKeys.store.orders(slug) })
      void navigate(`${storefrontPath(slug, 'orders')}/${order.order_id}`, { replace: true })
    },
    onError: (e) => {
      if (e instanceof StoreError && e.code === 'SB422') {
        void queryClient.invalidateQueries({ queryKey: queryKeys.store.catalog(slug) })
      }
    },
  })
}
