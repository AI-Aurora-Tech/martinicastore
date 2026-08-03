-- ===========================================================================
-- Policies (RLS) — SEGURO DE RODAR VÁRIAS VEZES
-- Use este arquivo quando o RLS já está LIGADO mas o app não lê/escreve:
-- ele recria todas as policies (tabelas + storage). Rode no SQL Editor.
-- ===========================================================================

-- Garante RLS ligado (idempotente).
alter table public.categories  enable row level security;
alter table public.products    enable row level security;
alter table public.sales       enable row level security;
alter table public.sale_items  enable row level security;
alter table public.orders      enable row level security;
alter table public.order_items enable row level security;

-- ---- Catálogo: leitura pública ----
drop policy if exists "catalog_public_read_categories" on public.categories;
create policy "catalog_public_read_categories"
  on public.categories for select using (true);

drop policy if exists "catalog_public_read_products" on public.products;
create policy "catalog_public_read_products"
  on public.products for select using (true);

-- ---- Catálogo/estoque: escrita por autenticado (admin) ----
drop policy if exists "products_write_authenticated" on public.products;
create policy "products_write_authenticated"
  on public.products for all to authenticated
  using (true) with check (true);

drop policy if exists "categories_write_authenticated" on public.categories;
create policy "categories_write_authenticated"
  on public.categories for all to authenticated
  using (true) with check (true);

-- ---- PDV: vendas por operador autenticado ----
drop policy if exists "sales_insert_authenticated" on public.sales;
create policy "sales_insert_authenticated"
  on public.sales for insert to authenticated
  with check (operator_id = auth.uid());

drop policy if exists "sales_select_authenticated" on public.sales;
create policy "sales_select_authenticated"
  on public.sales for select to authenticated using (true);

drop policy if exists "sale_items_insert_authenticated" on public.sale_items;
create policy "sale_items_insert_authenticated"
  on public.sale_items for insert to authenticated with check (true);

drop policy if exists "sale_items_select_authenticated" on public.sale_items;
create policy "sale_items_select_authenticated"
  on public.sale_items for select to authenticated using (true);

-- ---- Loja: pedidos por qualquer visitante (anon) ----
drop policy if exists "orders_insert_anyone" on public.orders;
create policy "orders_insert_anyone"
  on public.orders for insert to anon, authenticated with check (true);

drop policy if exists "orders_select_authenticated" on public.orders;
create policy "orders_select_authenticated"
  on public.orders for select to authenticated using (true);

drop policy if exists "order_items_insert_anyone" on public.order_items;
create policy "order_items_insert_anyone"
  on public.order_items for insert to anon, authenticated with check (true);

drop policy if exists "order_items_select_authenticated" on public.order_items;
create policy "order_items_select_authenticated"
  on public.order_items for select to authenticated using (true);

-- ---- Storage: imagens de produtos ----
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

drop policy if exists "product_images_public_read" on storage.objects;
create policy "product_images_public_read"
  on storage.objects for select using (bucket_id = 'product-images');

drop policy if exists "product_images_auth_insert" on storage.objects;
create policy "product_images_auth_insert"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'product-images');

drop policy if exists "product_images_auth_update" on storage.objects;
create policy "product_images_auth_update"
  on storage.objects for update to authenticated
  using (bucket_id = 'product-images');

drop policy if exists "product_images_auth_delete" on storage.objects;
create policy "product_images_auth_delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'product-images');
