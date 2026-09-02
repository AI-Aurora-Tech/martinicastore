-- ===========================================================================
-- Migração 0006 — Segurança para produção
--  (5) Papel de ADMIN: separa a equipe (PDV/Admin) dos clientes.
--  (6) Preparação p/ criação de pedido no servidor: remove INSERT direto do
--      cliente em orders/order_items (passam a ser criados pela Edge Function
--      place-order com service role).
--  (7) Estoque baixa na APROVAÇÃO do pagamento: remove o trigger que abatia o
--      estoque na criação do pedido (o webhook passa a abater quando pago).
-- Aditiva e idempotente. Rode depois da 0005.
-- ===========================================================================

-- ---- (5) Admins ----------------------------------------------------------
create table if not exists public.admins (
  id         uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admins enable row level security;

-- Cada usuário pode verificar a PRÓPRIA associação de admin.
drop policy if exists "admins_self_read" on public.admins;
create policy "admins_self_read"
  on public.admins for select to authenticated using (id = auth.uid());

-- Função central: o usuário atual é admin?
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admins where id = auth.uid());
$$;
grant execute on function public.is_admin() to anon, authenticated;

-- >>> BOOTSTRAP: torne seu usuário admin (rode uma vez, trocando o e-mail):
--   insert into public.admins (id)
--   select id from auth.users where email = 'seuadmin@email.com'
--   on conflict do nothing;

-- ---- Catálogo: leitura pública, escrita só admin --------------------------
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

-- ---- PDV (vendas): só admin ----------------------------------------------
drop policy if exists "sales_insert_authenticated" on public.sales;
drop policy if exists "sales_select_authenticated" on public.sales;
drop policy if exists "sales_admin" on public.sales;
create policy "sales_admin"
  on public.sales for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "sale_items_insert_authenticated" on public.sale_items;
drop policy if exists "sale_items_select_authenticated" on public.sale_items;
drop policy if exists "sale_items_admin" on public.sale_items;
create policy "sale_items_admin"
  on public.sale_items for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---- Pedidos (loja): admin vê tudo; cliente vê os seus -------------------
-- INSERT deixa de ser permitido ao cliente (feito pela Edge Function).
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

-- ---- Clientes: dono + admin ----------------------------------------------
drop policy if exists "customers_select_admin" on public.customers;
create policy "customers_select_admin"
  on public.customers for select to authenticated using (public.is_admin());

-- ---- Fornecedores / Compras: só admin ------------------------------------
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

-- ---- Storage (imagens de produto): escrita só admin ----------------------
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

-- ---- (7) Estoque baixa na aprovação --------------------------------------
-- Remove o abatimento de estoque na criação do pedido da loja.
-- (O trigger das vendas do PDV permanece — PDV é pago na hora.)
drop trigger if exists trg_order_items_stock on public.order_items;

-- Abate o estoque de todos os itens de um pedido, de uma vez (agregando por
-- produto). Chamada pelo webhook quando o pagamento é aprovado; a idempotência
-- é garantida pelo webhook (só chama se orders.paid_at ainda estiver vazio).
create or replace function public.apply_order_stock(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.products p
     set stock = greatest(0, p.stock - agg.qty)
    from (
      select product_id, sum(quantity) as qty
        from public.order_items
       where order_id = p_order_id
       group by product_id
    ) agg
   where agg.product_id = p.id;
end;
$$;
grant execute on function public.apply_order_stock(uuid) to service_role;
