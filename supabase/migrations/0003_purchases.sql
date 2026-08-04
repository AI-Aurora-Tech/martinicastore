-- ===========================================================================
-- Migração 0003 — Compras / entrada de estoque (reposição)
-- Aditiva e idempotente. Rode depois da 0001/0002. Seguro rodar várias vezes.
-- ===========================================================================

create table if not exists public.purchases (
  id             uuid primary key default gen_random_uuid(),
  number         bigint generated always as identity,
  supplier       text,
  operator_email text,
  total          numeric(10, 2) not null default 0,
  created_at     timestamptz not null default now()
);

create table if not exists public.purchase_items (
  id          uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references public.purchases (id) on delete cascade,
  product_id  text not null,
  name        text not null,
  quantity    int not null check (quantity > 0),
  unit_cost   numeric(10, 2) not null default 0,
  line_total  numeric(10, 2) not null default 0
);

create index if not exists purchase_items_purchase_idx on public.purchase_items (purchase_id);

alter table public.purchases      enable row level security;
alter table public.purchase_items enable row level security;

-- Compras: apenas usuários autenticados (admin) leem e criam.
drop policy if exists "purchases_all_authenticated" on public.purchases;
create policy "purchases_all_authenticated"
  on public.purchases for all to authenticated using (true) with check (true);

drop policy if exists "purchase_items_all_authenticated" on public.purchase_items;
create policy "purchase_items_all_authenticated"
  on public.purchase_items for all to authenticated using (true) with check (true);

-- Entrada de estoque: cada item de compra SOMA ao estoque do produto.
create or replace function public.increment_stock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.products
     set stock = stock + new.quantity
   where id = new.product_id;
  return new;
end;
$$;

drop trigger if exists trg_purchase_items_stock on public.purchase_items;
create trigger trg_purchase_items_stock
  after insert on public.purchase_items
  for each row execute function public.increment_stock();
