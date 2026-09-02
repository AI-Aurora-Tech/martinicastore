-- ===========================================================================
-- Migração 0010 — Formas de pagamento do PDV (Pix, Crédito, Débito, Fiado)
--   sales.payment_method passa a aceitar credito/debito/fiado (mantém cartao/
--   dinheiro/pix por compatibilidade).
--   Fiado: grava nome/telefone do comprador e status 'pending' (pendente de
--   recebimento). Demais vendas ficam 'paid'.
-- Aditiva e idempotente. Rode depois da 0009.
-- ===========================================================================

alter table public.sales add column if not exists status         text not null default 'paid';
alter table public.sales add column if not exists customer_name  text;
alter table public.sales add column if not exists customer_phone text;

alter table public.sales drop constraint if exists sales_payment_method_check;
alter table public.sales add constraint sales_payment_method_check
  check (payment_method in ('dinheiro', 'pix', 'credito', 'debito', 'fiado', 'cartao'));
