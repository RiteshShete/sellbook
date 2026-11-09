/** Said next to every UPI QR (Settings and the bill screen): the app never confirms a payment. */
export const UPI_HONEST_NOTE =
  'Customers can usually edit the amount in their app. Payments are not verified; mark an order paid yourself after you see the money.'

export function UpiNote() {
  return <p className="text-xs text-muted">{UPI_HONEST_NOTE}</p>
}
