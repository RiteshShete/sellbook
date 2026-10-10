# UI audit — round 2

Method: read every screen/component in `src/` (routes: Home, Delivery, Analytics, Pending, Products + editor,
New/Edit/Detail order, History, More, Settings, Trash, Activity, Login) against WCAG 2.2 AA + WAI-ARIA practice
and Nielsen heuristics. Contrast is computed by `scripts/contrast.mjs` from the real tokens in `src/index.css`.
Automated axe results are in the last section.

Severity: **High** = blocks or misleads, or fails AA. **Medium** = friction/inconsistency. **Low** = polish.
"Fixed in" names the task or commit that resolves it; "Rec." = recommendation, not done.

## Findings

| # | Sev | Where | Issue | Resolution |
|---|---|---|---|---|
| 1 | High | New order → items | Product chips scroll sideways; products hide off-screen. | Task 1 (grid, no h-scroll) |
| 2 | High | Home | KPI "To make" and tab "To prepare" are one concept under two names; the KPI is a button that flips a tab, the others are links. | Task 4 |
| 3 | High | Badges | Ready and Due today are both ochre/yellow, indistinguishable. | Task 5 |
| 4 | High | Inputs, selects, switch track | Border `#e5e5e5` on `#fffaf0` is 1.21:1; WCAG 1.4.11 needs 3:1. | Token `--border-strong` (#858585, 3.55:1) on Input/Select/Textarea/Switch/steppers |
| 5 | High | `Modal` / `BottomSheet` | `aria-modal` dialog without a focus trap: Tab leaves the dialog into the page behind. | Trap added in `Modal` |
| 6 | Medium | Primary button disabled | Muted text on `#e5e5e5` is 4.29:1. | Token `--disabled-fg` (#5c5c5c, 5.31:1) |
| 7 | Medium | Home KPI | Chevrons imply navigation on all three cards. "Unpaid" counts only delivered + not-paid orders, so a Ready ₹700 order is correctly not in it, but the label does not say so. | Task 4 (label, no rule change) |
| 8 | Medium | Variant text | Same variant shown as "Retail · ₹150" in one place and "500 g ₹60" in another; five places format it by hand. | Task 3 (`variantLabel`) |
| 9 | Medium | Action buttons | "Mark ready", "Mark delivered", payment, back and cancel look alike (primary / ghost); no icons. | Task 5 |
| 10 | Medium | Order detail | Customer shown in a card while the h1 is "Order #15". | Task 6 |
| 11 | Medium | Order detail | "Back to new" and "Cancel order" sit side by side as ghost buttons; mis-tap risk. | Task 7 |
| 12 | Medium | `Select` | Error text not linked with `aria-describedby`. | Fixed |
| 13 | Medium | `SegmentedControl` | `overflow-x-auto`; five+ options scroll sideways. Uses `role=radio` for what are tabs/filters. | Wraps; semantics kept (single choice) |
| 14 | Medium | Motion | No `prefers-reduced-motion` handling. | Global rule in `index.css` |
| 15 | Medium | Devanagari | `truncate` + tight line-height can clip matras; font stack has no Devanagari fallback. | Line-height floor + system Devanagari families in the stack |
| 16 | Medium | App | No visible build/version, so a stale cached copy cannot be told from the new one. | Version shown in More |
| 17 | Low | Home | FAB and "Search all orders" both compete for the thumb zone; FAB on Delivery duplicates Home. | Task 7 |
| 18 | Low | Tiny text | 11–13 px labels (badges, tab count). Contrast passes; size is small. | Rec. |
| 19 | Low | Tab bar | `aria-label="3 waiting"` is on a span inside a link; fine for AT but the visible number is read twice. | Rec. |
| 20 | Low | Products | Product cards show chevrons and flat variant chips; no grouping. | Task 2 |

Verified OK (no change needed): back buttons have `aria-label`; the active bottom tab sets `aria-current="page"`;
dialogs have `role=dialog`, Escape, focus-in and focus-return; toasts use Sonner's live region; `Input` ties
labels and errors with `htmlFor` / `aria-describedby`; touch targets are `min-h-11`; one `h1` per screen from `Page`.

## Contrast (all pairs the UI uses)

Generated: `node scripts/contrast.mjs`. Fails if any pair is under its minimum
(text 4.5, icons/borders/focus 3).

| Where | Foreground | Background | Ratio | Needs | Result |
|---|---|---|---|---|---|
| Body text on page | text #0a0a0a | bg #fffaf0 | 19.03 | 4.5 | pass |
| Body text on cream card (surface-2) | text #0a0a0a | surface-2 #f5f0e0 | 17.37 | 4.5 | pass |
| Muted text on page | muted #6a6a6a | bg #fffaf0 | 5.20 | 4.5 | pass |
| Muted text on cream card | muted #6a6a6a | surface-2 #f5f0e0 | 4.75 | 4.5 | pass |
| Body (#3a3a3a) on page | body #3a3a3a | bg #fffaf0 | 10.93 | 4.5 | pass |
| Primary button | primary-fg #ffffff | primary #0a0a0a | 19.80 | 4.5 | pass |
| Primary button pressed | primary-fg #ffffff | primary-active #1f1f1f | 16.48 | 4.5 | pass |
| Primary button disabled | disabled-fg #5c5c5c | primary-disabled #e5e5e5 | 5.31 | 4.5 | pass |
| Secondary button | text #0a0a0a | surface #fffaf0 | 19.03 | 4.5 | pass |
| Danger button | on-solid #ffffff | danger #dc2626 | 4.83 | 4.5 | pass |
| Ready action button | on-solid #ffffff | info #1d4ed8 | 6.70 | 4.5 | pass |
| Delivered action button | on-solid #ffffff | success #15803d | 5.02 | 4.5 | pass |
| Paid action button | on-solid #ffffff | teal #1a3a3a | 12.28 | 4.5 | pass |
| Danger text on page | danger #dc2626 | bg #fffaf0 | 4.64 | 4.5 | pass |
| Success text on page | success #15803d | bg #fffaf0 | 4.82 | 4.5 | pass |
| Warning text on page | warning #b45309 | bg #fffaf0 | 4.83 | 4.5 | pass |
| Badge: neutral | text #0a0a0a | surface-2 #f5f0e0 | 17.37 | 4.5 | pass |
| Badge: Ready | info-ink #1e3a8a | info-soft #dbe7fb | 8.30 | 4.5 | pass |
| Badge: Delivered | success-ink #14532d | success-soft #d9f0dc | 7.57 | 4.5 | pass |
| Badge: Paid | on-solid #ffffff | teal #1a3a3a | 12.28 | 4.5 | pass |
| Badge: Not paid | danger-ink #991b1b | danger-soft #fde2e2 | 6.79 | 4.5 | pass |
| Badge: Due today | text #0a0a0a | ochre #e8b94a | 10.81 | 4.5 | pass |
| Badge: Overdue | on-solid #ffffff | danger-deep #991b1b | 8.31 | 4.5 | pass |
| KPI card label on lavender (ink 70%) | text @70% #0a0a0a | lavender #b8a4ed | 5.09 | 4.5 | pass |
| KPI card value on lavender | text #0a0a0a | lavender #b8a4ed | 9.02 | 4.5 | pass |
| KPI card label on mint (ink 70%) | text @70% #0a0a0a | mint #a4d4c5 | 5.96 | 4.5 | pass |
| KPI card label on peach (ink 70%) | text @70% #0a0a0a | peach #ffb084 | 5.71 | 4.5 | pass |
| Tab-bar count on coral | text #0a0a0a | coral #ff6b5a | 7.07 | 4.5 | pass |
| Input border on page | border-strong #858585 | bg #fffaf0 | 3.55 | 3 | pass |
| Input border on cream card | border-strong #858585 | surface-2 #f5f0e0 | 3.24 | 3 | pass |
| Focus ring (ink) on page | text #0a0a0a | bg #fffaf0 | 19.03 | 3 | pass |
| Muted icon on page | muted #6a6a6a | bg #fffaf0 | 5.20 | 3 | pass |
| Switch track (off) on page | border-strong #858585 | bg #fffaf0 | 3.55 | 3 | pass |
| Hairline divider (decorative, exempt) | border #e5e5e5 | bg #fffaf0 | 1.21 | n/a | pass |

### Design-file colours that had to change (flagged)

| Token | Spec value | Used | Why |
|---|---|---|---|
| border (inputs, switch) | hairline `#e5e5e5` (1.21:1) | `--border-strong` `#858585` (3.55:1) for form controls; hairline stays for decorative dividers/cards | WCAG 1.4.11 |
| disabled button text | muted `#6a6a6a` (4.29:1) | `--disabled-fg` `#5c5c5c` (5.31:1) | WCAG 1.4.3 |
| success / warning / error | `#22c55e` `#f59e0b` `#ef4444` | already darker steps (`#15803d` `#b45309` `#dc2626`) before this round | under 4.5:1 for text |

### New tokens (the design file has no blue, and no soft status fills)

`--info #1d4ed8`, `--info-soft #dbe7fb`, `--info-ink #1e3a8a`, `--success-soft #d9f0dc`, `--success-ink #14532d`,
`--danger-soft #fde2e2`, `--danger-ink #991b1b`, `--danger-deep #991b1b`. Same solid / soft / ink pattern as the
existing semantic steps; each pair is in the table above.

## Automated accessibility run (axe-core)

axe-core 4.x via @axe-core/playwright, tags wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa, Chrome at 360x800, production build under /sellbook/, mocked API with test data (Devanagari names). Run: see docs/ui-audit/README.md.

| Screen | axe violations | Sideways scroll (360 px / 200% text) |
|---|---|---|
| 01-home | 0 | 360px: ok; 200% text: ok |
| 02-home-to-prepare | 0 | 360px: ok; 200% text: ok |
| 03-delivery | 0 | 360px: ok; 200% text: ok |
| 04-products | 0 | 360px: ok; 200% text: ok |
| 05-products-categories | 0 | 360px: ok; 200% text: ok |
| 06-categories-manager | 0 | 360px: ok; 200% text: ok |
| 07-product-editor | 0 | 360px: ok; 200% text: ok |
| 08-new-order | 0 | 360px: ok; 200% text: ok |
| 09-new-order-variant-sheet | 0 | 360px: ok; 200% text: ok |
| 10-new-order-with-items | 0 | 360px: ok; 200% text: ok |
| 11-order-detail | 0 | 360px: ok; 200% text: ok |
| 12-order-detail-more-actions | 0 | 360px: ok; 200% text: ok |
| 13-more | 0 | 360px: ok; 200% text: ok |

axe cannot judge everything (focus order, reading order, real screen-reader output): the phone check in the PR checklist covers those.
