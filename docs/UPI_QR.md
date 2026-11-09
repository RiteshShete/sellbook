# Dynamic UPI QR

Bills carry a **per-order UPI QR** built from the UPI ID and payee name saved in Settings. The
customer scans it and their UPI app opens with payee, amount and note filled in. The app never
verifies a payment: the owner marks the order paid by hand after seeing the money (B2).

## The link

One pure function, `buildUpiUri` in `src/lib/upi.ts`:

```
upi://pay?pa=<vpa>&pn=<name>&am=<amount>&cu=INR&tn=<note>
```

- Every value is percent-encoded (`encodeURIComponent`, plus `! ' ( ) *`); spaces are `%20`, never `+`.
- `am` is exact two-decimal text built from integer paise (`700.00`, `1250.50`, `0.30`), never floats.
- `cu` is always `INR`. No `tr` or `mc` (those are for registered merchants).
- `tn` is `Bill INV-0012`: ASCII, at most 40 characters (`upiNote`).
- `pn` is the Settings payee name as typed (Devanagari is sent as UTF-8, percent-encoded).
- The UPI ID must match `/^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/` (`isValidVpa`).

## Which QR does a bill get? (`qrMode`, `upiLinkForBill`)

| Settings | Bill shows |
| --- | --- |
| "Use dynamic QR" on + valid UPI ID + payee name | **dynamic QR**, caption "Scan to pay ₹700", UPI ID beneath |
| otherwise, an uploaded QR image exists | the uploaded image (fallback) |
| otherwise | no QR, "Amount due ₹700" |

The amount is the order total at the time the bill is made. If the order is **paid**, or the amount
is 0, the bill shows no QR: paid orders show **PAID** instead. Editing an order's total changes its
content hash (B7), so the bill becomes "outdated" and Regenerate makes the next revision with a new QR.

The QR is drawn by the `qrcode` package (`src/lib/qrImage.ts`): error correction M, margin 2, 360 px,
black on white, returned as a data URL so it is embedded in the bill image and never taints the canvas.

## Screens

- **Settings:** UPI ID, Payee name, a mode badge (Dynamic QR on / Using uploaded QR / No QR), the
  "Use dynamic QR" switch, a live Rs 1.00 test QR ("Scan with your own UPI app to test") and the honest note.
- **Bill screen:** the same note and a secondary **Copy UPI payment link** (hidden for outdated bills,
  paid orders and non-dynamic mode). "Send payment message" carries the same link.
- **Order form:** a non-blocking warning when the total is above Rs 1,00,000 (apps and banks often
  decline a single UPI payment that large).

Honest note shown next to the QR: *Customers can usually edit the amount in their app. Payments are
not verified; mark an order paid yourself after you see the money.*

## Database

Migration `20261109100000_dynamic_upi_qr.sql` adds `settings.payee_name` (text, max 50) and
`settings.use_dynamic_qr` (boolean, default true). pgTAP: `supabase/tests/database/dynamic_qr.sql`.
Apply the migration (`supabase db push`) **before** using the new Settings fields; until then the app
reads the old rows fine (the new fields default) but saving them fails.

## Phone test (do this on a real phone, Rs 1 only, never real customer data)

1. Apply the migration, deploy/preview the branch, open **More > Settings**.
2. Enter your own UPI ID and payee name, save. The test QR for ₹1 appears.
3. Scan it from a second device's screen with **Google Pay**, then **PhonePe** (and BHIM / an iPhone
   UPI app if you have one). For each app note: does it open to a pay screen, are payee name, ₹1.00 and
   the note filled in, is the amount editable, and is there any warning ("unverified", "limit", ...).
4. Repeat with a Devanagari payee name. If an app fails to open or shows garbled text, tell Claude:
   the plan is an ASCII payee name **in the link only** (the bill text keeps the Devanagari).
5. Make a bill for a ₹1 order and scan the **bill image**, not just the Settings preview.
6. Do not complete real payments to anyone else; pay yourself the ₹1 or cancel at the PIN screen.
