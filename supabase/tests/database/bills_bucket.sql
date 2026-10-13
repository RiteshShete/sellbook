-- The bills bucket limit matches the app's MAX_BILL_BYTES (500 KB) and stays private.
begin;
create extension if not exists pgtap with schema extensions;
select plan(3);

select is(
  (select file_size_limit from storage.buckets where id = 'bills'),
  512000::bigint,
  'bills bucket is limited to 500 KB (512000 bytes)'
);
select is(
  (select public from storage.buckets where id = 'bills'),
  false,
  'bills bucket is private'
);
select is(
  (select file_size_limit from storage.buckets where id = 'assets'),
  2097152::bigint,
  'assets bucket keeps its 2 MB limit'
);

select * from finish();
rollback;
