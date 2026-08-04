-- ===========================================================================
-- Migração 0004 — Fornecedores + WhatsApp (telefones)
-- Aditiva e idempotente. Rode depois da 0003. Seguro rodar várias vezes.
-- ===========================================================================

create table if not exists public.suppliers (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  phone      text,          -- WhatsApp (só dígitos, com DDI+DDD)
  cnpj       text,
  email      text,
  contact    text,
  notes      text,
  created_at timestamptz not null default now()
);

alter table public.suppliers enable row level security;

drop policy if exists "suppliers_all_authenticated" on public.suppliers;
create policy "suppliers_all_authenticated"
  on public.suppliers for all to authenticated using (true) with check (true);

-- Vínculo do fornecedor na compra (mantém também nome/telefone desnormalizados).
alter table public.purchases add column if not exists supplier_id    uuid;
alter table public.purchases add column if not exists supplier_phone text;

-- Telefone do comprador (para notificação por WhatsApp).
alter table public.orders add column if not exists customer_phone text;
