# Product import from CSV ("Configure")

Route: `/catalog/configure` (Products screen > Configure, beside Categories). Code: `src/features/productImport/`.
The owner photographs a price list, gives the photo plus our CSV template/instructions to any AI tool, uploads
the CSV answer, reviews, and saves. Nothing is saved before the review is confirmed.

## One schema, many outputs

`importSchema.ts` is the only place that defines the columns. The guide on the page, the template and example
files, "Copy template text", the header matching (aliases), unit words, limits and the `AI_INSTRUCTIONS` text
all come from it; `importSchema.test.ts` fails if they drift apart.

| Column       | Required | Allowed                                                                 |
| ------------ | -------- | ----------------------------------------------------------------------- |
| product_name | yes      | text, up to 80 characters                                               |
| category     | no       | text, up to 60; blank = Uncategorised                                   |
| variant_name | no       | text, up to 80                                                          |
| size         | no       | number above 0, only with unit                                          |
| unit         | no       | g, kg, pcs, ml, l (synonyms mapped), only with size                     |
| price        | yes      | rupees, 0 to 1,000,000                                                  |
| cost_price   | no       | rupees, same rules                                                      |
| active       | no       | yes/no/true/false/1/0, blank = yes (blank = "no change" in update mode) |
| notes        | no       | not imported; any text shows "Flagged by AI, please check"              |

Aliases: `name`, `product` = product_name; `rate`, `selling_price` = price. Limits: 1 MB, 1,000 data rows.
Header matching ignores case and treats spaces and hyphens as underscores.

## Pipeline (each step is a pure, tested function)

1. `decodeUtf8` strict UTF-8 (else "Save as CSV UTF-8 and try again."), then `parseImportText` (PapaParse,
   delimiter auto-detected, BOM/CRLF/quotes handled) and `cleanRow` (trim, collapse spaces, NFC, control chars,
   Devanagari digits, rupee signs and commas, unit synonyms). Row numbers are the file's line numbers.
2. `planImport(catalog, rows, mode)` returns the plan: groups per product, statuses (new, exists, update, error),
   diffs, errors, warnings, skipped, counts and the exact RPC payload.
   - **Add new only** (default): creates products/variants/categories, never changes an existing price. Importing
     the same file twice creates nothing.
   - **Add and update prices**: also updates price, cost, active of variants matched by product + variant name +
     size + unit. Never deletes. No "replace everything" mode.
3. `apply_product_import(p)` (one transaction, all or nothing) writes it and records an `import_batches` row.
   Raises SQLSTATE `SB410` if the catalog changed since the plan; the review re-plans against a fresh fetch
   before saving and compares signatures first.
4. `undo_product_import(id)` soft-deletes what the batch created (Trash, restorable) and puts updated variants back
   to their previous values. Old orders keep their own snapshots (B8).

Duplicate keys: case-insensitive, NFC, trimmed, zero-width joiners removed IN THE KEY ONLY; stored names are never
altered.

## Database

Migration `20261110100000_product_import.sql` is additive: table `import_batches` (RLS, no delete), functions
`import_insert_variant`, `apply_product_import`, `undo_product_import`. pgTAP: `supabase/tests/database/product_import.sql`.

## Status chip contrast (WCAG AA, from `npm run contrast`)

| Chip           | Pair                        | Ratio |
| -------------- | --------------------------- | ----- |
| New            | success-ink on success-soft | 7.57  |
| Already exists | text on surface-2           | 17.37 |
| Will update    | info-ink on info-soft       | 8.30  |
| Error          | danger-ink on danger-soft   | 6.79  |
| Check          | text on ochre               | 10.81 |

Every chip has an icon and text.

## Manual phone test script

Use fixtures only (`tests/fixtures/product-import/`, or the in-app example file). Do not import over your real products
unless you want to; use a separate test account or undo afterwards.

1. **Android Chrome**: Products > Configure. Step 1: tap _Download template (CSV)_ and _Download example (CSV)_;
   open the example in Sheets/Files; Marathi names show correctly. Tap _Copy template text_, paste into Notes.
2. **iPhone Safari**: same downloads (Files app > Downloads). Copy buttons paste correctly.
3. Step 2: _Copy instructions for AI_, paste into Notes; it matches the text on the page.
4. **File flow**: Step 3 > Upload file > pick the example CSV. The review opens with focus on "Review before saving";
   a yellow "looks like the example file" note shows; 5 products / 6 variants. Pick a `.txt` copy too.
5. **Paste flow**: Paste CSV text with 3 rows, one with price `abc`. Review shows 1 error with its row number;
   the Import button is disabled until you tick "Skip the 1 row with errors".
6. Switch to _Add and update prices_ with an existing product: price changes show before > after.
7. **Import**: confirm. Success screen shows counts; _View products_ shows the new products grouped by category.
8. **Re-upload** the same file in _Add new only_: "Nothing to import".
9. **Undo import**: products go to Trash (More > Trash), updated prices go back. Check _Recent imports_.
10. **Offline**: turn on airplane mode after the review opens; the Import button is disabled with the reason.
11. Refresh on `/sellbook/catalog/configure` (GitHub Pages): the page loads.
12. A file saved from Excel as plain "CSV" (ANSI) with accented text shows "Save as CSV UTF-8 and try again."
