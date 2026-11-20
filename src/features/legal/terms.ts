/**
 * Terms wording, in ONE place: the Terms page and the bill PNG both read it.
 * Draft written from how Sellbook actually behaves (docs/PLAN.md business rules). It is not legal advice:
 * the owner should have a local advocate / CA confirm it (consumer, GST invoicing, data-protection rules).
 */

/** Short, customer-facing line printed at the foot of every bill. */
export const BILL_TERMS_LINE =
  'This bill lists the items and amount ordered. Payment is treated as received only when the shop confirms it. ' +
  'If the order changes, the shop issues a revised bill with the same number; the latest revision applies. ' +
  'Disputes: please contact the shop first.'

export interface TermsSection {
  title: string
  points: string[]
}

/** For customers: the shop's terms of sale, as summarised on the bill. */
export const SHOP_TERMS: TermsSection[] = [
  {
    title: 'Orders and prices',
    points: [
      'An order is confirmed when the shop accepts it. Item names and prices are fixed as shown on the bill at that time.',
      'Later changes to the shop’s price list do not change an existing order.',
      'If items, quantity or discount change, the shop issues a revised bill with the same bill number. Only the latest revision is valid.',
    ],
  },
  {
    title: 'Payment',
    points: [
      'The amount due is the bill total after any discount. The UPI QR on the bill is a convenience; check the amount in your payment app before paying.',
      'The shop marks an order paid by hand after it sees the money. A payment screenshot alone is not a confirmation.',
      'Pay only to the UPI ID printed on the bill. The shop is not responsible for money sent to any other account.',
    ],
  },
  {
    title: 'Delivery, cancellation and returns',
    points: [
      'Delivery or pick-up timing is as agreed with the shop; dates are an estimate unless the shop confirms otherwise.',
      'The shop may cancel an order it cannot fulfil, and refund anything already paid for it.',
      'Made-to-order, perishable or customised items are not returnable once prepared, except for a defect or an error by the shop. Report a problem promptly after delivery.',
    ],
  },
  {
    title: 'Your details',
    points: [
      'The shop keeps your name and phone number only to prepare, bill and follow up on your orders, and does not sell them.',
      'You can ask the shop to correct or remove your details, subject to records it must keep for accounts and tax.',
    ],
  },
]

/** For the owner: what the app does and does not do, and what stays the owner's responsibility. */
export const APP_TERMS: TermsSection[] = [
  {
    title: 'What Sellbook is',
    points: [
      'Sellbook is a private order and sales tracker for the shop owner. Customers never log in. It does not process, hold or verify payments.',
      'Payment status, delivery status and amounts are what you enter. You are responsible for checking them against money actually received.',
    ],
  },
  {
    title: 'Payments and the UPI QR',
    points: [
      'The QR opens the customer’s own UPI app. Customers can usually edit the amount, so always confirm the received amount before marking an order paid.',
      'Wrong UPI ID, payee name or amount in Settings sends money to the wrong place. Check them after every change.',
    ],
  },
  {
    title: 'Bills and tax',
    points: [
      'A bill is an order summary. It is not automatically a GST tax invoice: it carries no GSTIN, HSN or tax breakup. If you are GST-registered or must issue tax invoices, do that separately.',
      'You are responsible for the tax, consumer-law and record-keeping obligations of your business.',
    ],
  },
  {
    title: 'Your data and history',
    points: [
      'Data is stored in your own Supabase project on its free plan, with no guarantee of uptime or retention. Keep your own backup: use the CSV export in Analytics regularly.',
      'Nothing is permanently deleted from the app screens (Trash can restore it). To stay inside the free storage limit, old edit history and the activity log are trimmed automatically; the latest orders, bills and totals are not.',
      'Voice ordering uses your phone’s own speech service (Google on Android, Apple on iPhone), so what you say, including customer names and numbers, is sent to it. Speech can be mis-heard: always review the order before saving.',
      'Customer names and phone numbers are personal data. Share bills only with the customer they belong to, and protect the phone and login.',
    ],
  },
  {
    title: 'Limits',
    points: [
      'Sellbook is provided as is, without warranty. Reports and totals are only as accurate as the entries behind them.',
      'This text is a plain-language draft, not legal advice. Have it checked by a local advocate or chartered accountant before relying on it.',
    ],
  },
]
