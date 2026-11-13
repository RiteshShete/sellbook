# History slimming (keeping the database small)

Migration `20261113100000_history_slimming.sql`. Goal: the Supabase free plan allows 500 MB for the whole
project (all users share it), so the per-order history must stay small.

## What changed

1. **Delta versions.** `record_order_version()` stores only the changed fields for `status`, `payment`,
   `delete` and `restore` versions (the row's `snapshot` has `"_delta": true`). `create`, `edit` and `rollback`
   still store a full snapshot.
2. **Slim full snapshots.** `order_version_snapshot()` drops ids, timestamps, null item keys and derived
   line totals. `order_snapshot()` is unchanged: bills still use it.
3. **Rebuilding.** `order_version_state(order, version)` = nearest earlier full snapshot + the deltas up to the
   version. `rollback_order()` and the history screen (`list_order_versions()`) use it. Old full-format rows are
   valid starting points, so nothing is migrated.
4. **Pruning** (`prune_order_history(keep_last := 10, days := 120)`): per order keeps the first version, the last
   10 and everything from the last 120 days. A kept delta whose predecessor is dropped is first turned into a
   full snapshot, so every kept version still rebuilds and rolls back exactly.
5. **Audit.** `audit_row_change()` logs only changed fields (before/after) for product, variant and settings
   updates. `prune_audit_log(months := 12)` deletes older audit rows.

`prune_*` are not callable by app users (history stays append-only for them). The migration schedules both weekly
(Sunday 03:00 IST) with pg_cron when it is available. Check with
`select jobname, schedule from cron.job;`. If the job is missing, enable pg_cron in the Supabase dashboard
(Database > Extensions) and run:

```sql
select cron.schedule('sellbook-prune-history', '30 21 * * 0',
  'select public.prune_order_history(); select public.prune_audit_log();');
```

Run once by hand to see what it removes: `select public.prune_order_history(); select public.prune_audit_log();`
(they return the number of rows deleted). Deleted rows free space for reuse; the database size shown in the
dashboard drops only after Postgres reclaims it, so do not expect the number to fall at once.

## Measured

One typical order (2 items: create, ready, delivered, paid) in a rolled-back transaction: about 1.6 KB of
version rows now, against about 7.9 KB in the old format (old size estimated from `order_snapshot()` size plus
row overhead). Roughly 80% less for the status and payment history.

## Tests

`supabase/tests/database/history_slimming.sql` (31 assertions): deltas, slim snapshots, rebuilt states, rollback
through deltas, old-format rows, pruning with materialising (every kept version identical before and after),
slim audit rows, audit expiry, and that app users cannot prune.
