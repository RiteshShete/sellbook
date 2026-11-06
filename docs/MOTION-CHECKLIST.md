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
