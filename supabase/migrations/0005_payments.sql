-- ===========================================================================
-- Migração 0005 — Pagamento online (Mercado Pago)
-- Aditiva e idempotente. Rode depois da 0004. Seguro rodar várias vezes.
-- ===========================================================================

alter table public.orders add column if not exists payment_status    text;   -- pending/approved/rejected...
alter table public.orders add column if not exists mp_payment_id     text;
alter table public.orders add column if not exists mp_preference_id  text;
alter table public.orders add column if not exists paid_at           timestamptz;
