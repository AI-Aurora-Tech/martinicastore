-- ===========================================================================
-- Migração 0002 — Cadastro de comprador + entrega (Correios)
-- Aditiva e idempotente (add column if not exists / drop policy if exists).
-- Rode depois da 0001. Seguro rodar várias vezes.
-- ===========================================================================

-- Peso do produto (gramas) para cálculo de frete.
alter table public.products add column if not exists weight int not null default 300;

-- ---------------------------------------------------------------------------
-- Clientes (perfil + endereço), 1:1 com auth.users
-- ---------------------------------------------------------------------------
create table if not exists public.customers (
  id           uuid primary key references auth.users (id) on delete cascade,
  name         text not null default '',
  email        text,
  phone        text,
  cep          text,
  street       text,
  number       text,
  complement   text,
  neighborhood text,
  city         text,
  uf           text,
  created_at   timestamptz not null default now()
);

alter table public.customers enable row level security;

-- Cada cliente só enxerga/edita o próprio cadastro.
drop policy if exists "customers_select_own" on public.customers;
create policy "customers_select_own"
  on public.customers for select to authenticated using (id = auth.uid());

drop policy if exists "customers_insert_own" on public.customers;
create policy "customers_insert_own"
  on public.customers for insert to authenticated with check (id = auth.uid());

drop policy if exists "customers_update_own" on public.customers;
create policy "customers_update_own"
  on public.customers for update to authenticated using (id = auth.uid());

-- ---------------------------------------------------------------------------
-- Pedidos: dados do comprador e da entrega
-- ---------------------------------------------------------------------------
alter table public.orders add column if not exists customer_id      uuid;
alter table public.orders add column if not exists shipping_service text;
alter table public.orders add column if not exists shipping_days    int;
alter table public.orders add column if not exists ship_cep          text;
alter table public.orders add column if not exists ship_street       text;
alter table public.orders add column if not exists ship_number       text;
alter table public.orders add column if not exists ship_complement   text;
alter table public.orders add column if not exists ship_neighborhood text;
alter table public.orders add column if not exists ship_city         text;
alter table public.orders add column if not exists ship_uf           text;
