-- ===========================================================================
-- Policies (RLS) — SEGURO DE RODAR VÁRIAS VEZES
-- Estado FINAL (produção): leitura pública do catálogo, escrita e leitura de
-- dados sensíveis apenas para ADMIN. Pedidos são criados pela Edge Function
-- `place-order` (service role), então o cliente NÃO insere direto.
-- Rode no SQL Editor sempre que o RLS estiver ligado mas o app não ler/escrever.
-- ===========================================================================

-- Garante RLS ligado (idempotente).
alter table public.categories     enable row level security;
alter table public.products       enable row level security;
alter table public.sales          enable row level security;
alter table public.sale_items     enable row level security;
alter table public.orders         enable row level security;
alter table public.order_items    enable row level security;
alter table if exists public.customers      enable row level security;
alter table if exists public.suppliers      enable row level security;
alter table if exists public.purchases      enable row level security;
alter table if exists public.purchase_items enable row level security;

-- ---- (5) Admins ----------------------------------------------------------
create table if not exists public.admins (
  id         uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admins enable row level security;

-- A tabela `admins` é a tabela da EQUIPE, com um papel por usuário:
--   admin    → Gestão (painel) + PDV
--   operator → SOMENTE o PDV
alter table public.admins
  add column if not exists role text not null default 'admin';
alter table public.admins drop constraint if exists admins_role_chk;
alter table public.admins
  add constraint admins_role_chk check (role in ('admin', 'operator'));

drop policy if exists "admins_self_read" on public.admins;
create policy "admins_self_read"
  on public.admins for select to authenticated using (id = auth.uid());

-- is_admin(): exige papel = 'admin'.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admins where id = auth.uid() and role = 'admin'
  );
$$;
grant execute on function public.is_admin() to anon, authenticated;

-- is_staff(): faz parte da equipe (admin OU operador).
create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admins where id = auth.uid());
$$;
grant execute on function public.is_staff() to anon, authenticated;

-- staff_role(): papel do usuário atual ('admin' | 'operator' | null).
create or replace function public.staff_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.admins where id = auth.uid();
$$;
grant execute on function public.staff_role() to anon, authenticated;

-- >>> BOOTSTRAP de papéis (rode trocando os e-mails):
--   -- Admin (Gestão + PDV):
--   insert into public.admins (id, role)
--   select id, 'admin' from auth.users where email = 'admin@suaempresa.com'
--   on conflict (id) do update set role = 'admin';
--   -- Operador de caixa (só PDV):
--   insert into public.admins (id, role)
--   select id, 'operator' from auth.users where email = 'caixa@suaempresa.com'
--   on conflict (id) do update set role = 'operator';

-- ---- Catálogo: leitura pública ----
drop policy if exists "catalog_public_read_categories" on public.categories;
create policy "catalog_public_read_categories"
  on public.categories for select using (true);

drop policy if exists "catalog_public_read_products" on public.products;
create policy "catalog_public_read_products"
  on public.products for select using (true);

-- ---- Catálogo/estoque: escrita só ADMIN ----
drop policy if exists "products_write_authenticated" on public.products;
drop policy if exists "products_write_admin" on public.products;
create policy "products_write_admin"
  on public.products for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "categories_write_authenticated" on public.categories;
drop policy if exists "categories_write_admin" on public.categories;
create policy "categories_write_admin"
  on public.categories for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---- PDV (vendas): toda a EQUIPE (admin + operador) ----
drop policy if exists "sales_insert_authenticated" on public.sales;
drop policy if exists "sales_select_authenticated" on public.sales;
drop policy if exists "sales_admin" on public.sales;
drop policy if exists "sales_staff" on public.sales;
create policy "sales_staff"
  on public.sales for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

drop policy if exists "sale_items_insert_authenticated" on public.sale_items;
drop policy if exists "sale_items_select_authenticated" on public.sale_items;
drop policy if exists "sale_items_admin" on public.sale_items;
drop policy if exists "sale_items_staff" on public.sale_items;
create policy "sale_items_staff"
  on public.sale_items for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- ---- Pedidos (loja): admin vê tudo; cliente vê os seus ----
-- INSERT NÃO é permitido ao cliente (feito pela Edge Function place-order).
drop policy if exists "orders_insert_anyone" on public.orders;
drop policy if exists "orders_select_authenticated" on public.orders;
drop policy if exists "orders_select_admin" on public.orders;
drop policy if exists "orders_select_own" on public.orders;
drop policy if exists "orders_update_admin" on public.orders;
create policy "orders_select_admin"
  on public.orders for select to authenticated using (public.is_admin());
create policy "orders_select_own"
  on public.orders for select to authenticated using (customer_id = auth.uid());
create policy "orders_update_admin"
  on public.orders for update to authenticated using (public.is_admin());

drop policy if exists "order_items_insert_anyone" on public.order_items;
drop policy if exists "order_items_select_authenticated" on public.order_items;
drop policy if exists "order_items_select_admin" on public.order_items;
drop policy if exists "order_items_select_own" on public.order_items;
create policy "order_items_select_admin"
  on public.order_items for select to authenticated using (public.is_admin());
create policy "order_items_select_own"
  on public.order_items for select to authenticated
  using (exists (
    select 1 from public.orders o
    where o.id = order_items.order_id and o.customer_id = auth.uid()
  ));

-- ---- Clientes: dono + admin ----
drop policy if exists "customers_select_admin" on public.customers;
create policy "customers_select_admin"
  on public.customers for select to authenticated using (public.is_admin());

-- ---- Fornecedores / Compras: só ADMIN ----
drop policy if exists "suppliers_all_authenticated" on public.suppliers;
drop policy if exists "suppliers_admin" on public.suppliers;
create policy "suppliers_admin"
  on public.suppliers for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "purchases_all_authenticated" on public.purchases;
drop policy if exists "purchases_admin" on public.purchases;
create policy "purchases_admin"
  on public.purchases for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "purchase_items_all_authenticated" on public.purchase_items;
drop policy if exists "purchase_items_admin" on public.purchase_items;
create policy "purchase_items_admin"
  on public.purchase_items for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---- Banners do topo da loja: leitura pública, escrita só admin ----
create table if not exists public.banners (
  id         uuid primary key default gen_random_uuid(),
  image_url  text not null,
  headline   text,
  subtext    text,
  cta_label  text,
  link       text,
  active     boolean not null default true,
  sort       int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.banners enable row level security;

drop policy if exists "banners_public_read" on public.banners;
create policy "banners_public_read"
  on public.banners for select using (true);

drop policy if exists "banners_admin" on public.banners;
create policy "banners_admin"
  on public.banners for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---- Storage: imagens de produtos ----
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

drop policy if exists "product_images_public_read" on storage.objects;
create policy "product_images_public_read"
  on storage.objects for select using (bucket_id = 'product-images');

drop policy if exists "product_images_auth_insert" on storage.objects;
drop policy if exists "product_images_auth_update" on storage.objects;
drop policy if exists "product_images_auth_delete" on storage.objects;
drop policy if exists "product_images_admin_insert" on storage.objects;
drop policy if exists "product_images_admin_update" on storage.objects;
drop policy if exists "product_images_admin_delete" on storage.objects;
create policy "product_images_admin_insert"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'product-images' and public.is_admin());
create policy "product_images_admin_update"
  on storage.objects for update to authenticated
  using (bucket_id = 'product-images' and public.is_admin());
create policy "product_images_admin_delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'product-images' and public.is_admin());

-- ---- Estoque por variação (tamanho/cor/etc.) ----
alter table public.products   add column if not exists variants jsonb not null default '[]'::jsonb;
alter table public.sale_items add column if not exists size text;

create or replace function public.apply_stock(p_id text, p_label text, p_qty int)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_label is not null and p_label <> '' then
    update public.products p
       set variants = coalesce((
         select jsonb_agg(
           case when (elem->>'label') = p_label
             then jsonb_set(elem, '{stock}',
                    to_jsonb(greatest(0, coalesce((elem->>'stock')::int, 0) - p_qty)))
             else elem end)
         from jsonb_array_elements(p.variants) elem
       ), p.variants)
     where p.id = p_id;
  end if;
  update public.products p
     set stock = case
       when jsonb_typeof(p.variants) = 'array' and jsonb_array_length(p.variants) > 0
         then (select coalesce(sum((e->>'stock')::int), 0)
                 from jsonb_array_elements(p.variants) e)
       else greatest(0, p.stock - p_qty)
     end
   where p.id = p_id;
end;
$$;
grant execute on function public.apply_stock(text, text, int) to service_role;

-- ---- (7) Estoque abatido na aprovação do pagamento (por produto+variação) ----
drop trigger if exists trg_order_items_stock on public.order_items;

create or replace function public.apply_order_stock(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare r record;
begin
  for r in
    select product_id, coalesce(size, '') as size, sum(quantity)::int as qty
      from public.order_items
     where order_id = p_order_id
     group by product_id, coalesce(size, '')
  loop
    perform public.apply_stock(r.product_id, r.size, r.qty);
  end loop;
end;
$$;
grant execute on function public.apply_order_stock(uuid) to service_role;

-- ---- Trigger do PDV: abate a variação vendida ----
create or replace function public.decrement_stock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.apply_stock(new.product_id, new.size, new.quantity);
  return new;
end;
$$;
drop trigger if exists trg_sale_items_stock on public.sale_items;
create trigger trg_sale_items_stock
  after insert on public.sale_items
  for each row execute function public.decrement_stock();
