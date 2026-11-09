# Motion polish: test checklist

Branch `motion-polish` (from `next-task`). Baseline tag: `baseline-before-motion`.
Dev server: `npm run dev`, open the Network URL on the phone. Tick each line after checking.

## 1. Rolling numbers (Home KPI cards)

- [ ] Open Home: the three cards (To prepare / To deliver / Unpaid) show their value at once, no count-up from 0.
- [ ] Mark a New order Ready: "To prepare" rolls down by 1 and "To deliver" rolls up by 1 (about half a second).
- [ ] Mark a delivered order paid: "Unpaid" rolls to the lower rupee amount; it always shows whole rupees (no flicker of decimals).
- [ ] A failed load still shows a dash, and loading still shows the skeleton.
- [ ] OS "reduce motion" on: values jump with no rolling.

## 2. Rows ease in (Home and Delivery lists)

- [ ] Open Home: order rows rise and fade in, the first three slightly staggered.
- [ ] Add a new order: its row eases in; rows already on screen do not replay.
- [ ] Delivery list does the same. Nothing overlaps or shifts after it lands.
- [ ] OS "reduce motion" on: rows just appear.

## 2b. Cards leave smoothly (Home and Delivery)

- [ ] Home: tap Mark ready on a New order. The card fades, then its row collapses and the rows below slide up (about half a second). It does not blink away.
- [ ] Tap Undo in the toast: the order comes back as a normal row at once.
- [ ] Delivery: tap Delivered (and finish the payment sheet). The card fades and collapses the same way.
- [ ] While it is leaving you cannot tap anything in it; the group count already shows the new number.
- [ ] The last card in the list still disappears straight into the empty state (no collapse; known limit).
- [ ] OS "reduce motion" on: the card just disappears.

## 3. Empty-state picture

- [ ] Home with no New orders: a small card slides onto a stack, rests, slides back (loops slowly), above "No new orders".
- [ ] Delivery with nothing ready: the same picture above "Nothing to deliver".
- [ ] Looks right at 360 px width, no horizontal scroll; screen readers skip it (decorative).

## 4. Nothing else changed

- [ ] Login, bottom bar, logo/PWA icon, bills, payments behave as before.

## Roll back

- One piece: `git revert <commit>` (each feature is its own commit, see `git log --oneline motion-polish`).
- Everything from this round: `git checkout next-task` (or `git reset --hard baseline-before-motion` on this branch).
- Never merge to `main` until the owner has ticked this list.

## 5. Button animations (Mark ready, Delivered)

- [ ] Home: tap **Mark ready**. The label fades, the icon slides to the centre, a white crate is packed on the same blue, then the order moves to Ready (Undo toast works).
- [ ] Delivery, an already-paid order: tap **Delivered**. The label fades, the icon centres, a courier on a scooter rides across the green button, then the order is delivered.
- [ ] Delivery, an unpaid order: same animation, then the payment sheet opens (Paid cash / Paid online / Not paid yet).
- [ ] A second tap while it plays does nothing. If an action fails (toast), the button comes back.
- [ ] OS "reduce motion" on: no animation; the action happens at once.
- [ ] The animation art is "Free delivery Animation by Canon" (LottieFiles Simple License); keep it in mind if the licence matters to you.
