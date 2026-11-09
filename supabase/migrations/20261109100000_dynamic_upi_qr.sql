-- Dynamic UPI QR (docs/UPI_QR.md): bills build a per-order upi://pay QR from the owner's UPI ID.
--   payee_name       the name the customer's UPI app shows (required for the dynamic QR)
--   use_dynamic_qr   the "Use dynamic QR" switch; on by default, the uploaded qr_path stays as fallback
-- No new table, so no new RLS policy: the existing owner-only policies on public.settings apply.
-- init_settings() returns the whole row, so it needs no change.
alter table public.settings
  add column payee_name text null
    constraint settings_payee_name_len check (payee_name is null or char_length(payee_name) <= 50),
  add column use_dynamic_qr boolean not null default true;
