/**
 * Terms wording, in ONE place: the Terms page and the bill PNG both read it.
 * Draft written from how Sellbook actually behaves (docs/PLAN.md business rules). It is not legal advice:
 * the operator should have a local advocate / CA confirm it (consumer, GST invoicing, DPDP data-protection
 * rules, the refund wording). Sellbook is now a public paid service: APP_TERMS and PRIVACY cover that.
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

/**
 * Which wording a new account agreed to; stored with the account at sign-up. Change it whenever
 * APP_TERMS or PRIVACY change in a way that matters to a shop.
 */
export const TERMS_VERSION = '2026-11-23'

/** For the shop owner: the terms of using Sellbook as a paid service. */
export const APP_TERMS: TermsSection[] = [
  {
    title: 'What Sellbook is',
    points: [
      'Sellbook is an order and sales tracker for small shops, run by the Sellbook operator ("we"). Your customers never log in.',
      'It does not collect, hold or verify payments from your customers. Payment status, delivery status and amounts are what you enter; check them against money actually received.',
    ],
  },
  {
    title: 'Your account',
    points: [
      'One account is for one shop. Keep your password to yourself and use an email you can read: we use it for sign-in and password resets.',
      'We may suspend an account used to harm the service or other shops, or to break the law.',
    ],
  },
  {
    title: 'Plans and paying for them',
    points: [
      'A new account gets a free trial. The length, the limits on orders and products, and what each paid plan includes and costs are shown on the "Your plan" page; that page is part of these terms.',
      'A paid plan runs for 30 days from when it is switched on. It does not renew by itself: nothing is ever charged automatically.',
      'You pay by UPI to the UPI ID shown on the plan page, with your reference in the note, and then tell us in the app. We check payments by hand, usually within a day; the plan starts when we approve it, not when you pay.',
      'Pay only to the UPI ID shown inside the app. We are not responsible for money sent anywhere else.',
      'Prices and limits can change for future periods. A period you have already paid for is not changed.',
    ],
  },
  {
    title: 'Refunds',
    points: [
      'Once a plan is switched on, its fee is not refunded for the unused days.',
      'If you paid and the plan was not switched on, or you paid twice or the wrong amount, write to the support email on the plan page with your reference and UTR. We will switch the plan on or return the money.',
    ],
  },
  {
    title: 'When a trial or plan ends',
    points: [
      'The shop becomes read-only for 60 days: you can see your orders and products but cannot add or change them. After that it is locked until you pay for a plan.',
      'Your data is kept while your account exists. Paying for a plan opens the shop again with everything in place.',
    ],
  },
  {
    title: 'Payments from your customers and the UPI QR',
    points: [
      'The QR on a bill opens your customer’s own UPI app. Customers can usually edit the amount, so always confirm the received amount before marking an order paid.',
      'A wrong UPI ID, payee name or amount in Settings sends money to the wrong place. Check them after every change.',
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
    title: 'Your data',
    points: [
      'Your shop’s data is stored on our cloud database, separate from every other shop’s. Other shops cannot see it. How we handle it is in the Privacy policy.',
      'Keep your own backup of what matters to you. Nothing is permanently deleted from the app screens (Trash can restore it), but to save space old edit history and the activity log are trimmed, and old bill images may be removed; a bill can always be made again from its order.',
      'Voice ordering uses your phone’s own speech service (Google on Android, Apple on iPhone), so what you say, including customer names and numbers, is sent to it. Speech can be mis-heard: always review the order before saving.',
    ],
  },
  {
    title: 'Limits',
    points: [
      'Sellbook is provided as is, without a promise of uninterrupted service. Reports and totals are only as accurate as the entries behind them.',
      'If we are ever liable to you, it is limited to the plan fees you paid in the three months before the problem.',
      'We may update these terms; the app will show the new version, and continuing to use Sellbook means you accept it.',
      'This text is a plain-language draft, not legal advice.',
    ],
  },
]

/** How the operator handles personal data (the shop owner’s and the shop’s customers’). */
export const PRIVACY: TermsSection[] = [
  {
    title: 'What we keep',
    points: [
      'About you: your sign-in email, the shop details you type in Settings, which plan you are on, and the payment reference (and UTR, if you give it) of each plan payment.',
      'About your customers: only what you enter for an order, which is a name, an optional phone number and what they ordered. You decide what goes in.',
      'If you open an online shop: customers who sign up there give a name, a mobile number and/or email, a password (kept only in scrambled form) and delivery addresses. We show a customer only their own orders, and show you only the name, phone and address that belong to orders placed at your shop. A customer who orders from several shops has a separate record at each.',
      'Phone alerts: if you switch them on, we keep your phone browser’s alert address (a random web address and keys, no name) so we can tell you about a new order. The alert goes through your phone maker’s push service (Google, Apple or Mozilla) and shows only the order number, the customer’s first name or name, and ‘check your bank’. Switch it off in Settings and the address is deleted.',
      'Payment claims: a customer can enter the 12-digit UTR of a UPI payment. It is a note for you to check in your own bank app. Sellbook never verifies or moves money.',
      'We do not keep your password in readable form, and we do not use advertising or tracking tools.',
    ],
  },
  {
    title: 'Why',
    points: [
      'To run your shop’s order book, show you your reports, bill you for a plan and answer you when you ask for help. Nothing else.',
      'We do not sell personal data, and we do not contact your customers.',
    ],
  },
  {
    title: 'Your customers’ data is yours',
    points: [
      'You choose to record your customers’ names and numbers, so you are responsible for having a fair reason to, and for answering them if they ask about it. We only store it for you.',
      'Share a bill only with the customer it belongs to, and protect your phone and login.',
    ],
  },
  {
    title: 'Who else handles it',
    points: [
      'Our cloud database and sign-in provider (Supabase) stores the data. Our email provider sends sign-in, reset and payment emails.',
      'If you use voice ordering, your phone’s speech service (Google or Apple) hears what you say.',
      'We look inside a shop’s data only when needed to fix a problem or when the law requires it.',
    ],
  },
  {
    title: 'How long',
    points: [
      'While your account exists, including while a plan has ended. Old edit history, the activity log and old bill images are trimmed to save space.',
    ],
  },
  {
    title: 'Your choices',
    points: [
      'You can see and correct your data in the app at any time. To get a copy, or to have your account and its data deleted, write to the support email on the plan page from your sign-in email.',
      'Questions or complaints about your data go to the same address; we answer as soon as we can.',
    ],
  },
]
