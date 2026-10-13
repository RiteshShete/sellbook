-- Bill images are capped at 500 KB (the app shrinks the PNG to fit: src/features/billing/render/fitBill.ts,
-- MAX_BILL_BYTES = 500 * 1024 = 512000). The bucket enforces the same limit, so an oversized file can
-- never be stored. Replaces the 3 MB limit set in 20261008100300_storage_realtime.sql.
update storage.buckets
   set file_size_limit = 512000
 where id = 'bills';
