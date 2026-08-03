-- ===========================================================================
-- Martinica Store — schema inicial
-- Rode no Supabase: SQL Editor → cole este arquivo → Run
-- (ou via CLI: supabase db push)
-- ===========================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Catálogo
-- ---------------------------------------------------------------------------
create table if not exists public.categories (
  id    text primary key,
  label text not null,
  sort  int  not null default 0
);

create table if not exists public.products (
  id           text primary key,
  name         text not null,
  category_id  text not null references public.categories (id),
  kind         text not null,
  price        numeric(10, 2) not null check (price >= 0),
  old_price    numeric(10, 2) check (old_price >= 0),
  cost         numeric(10, 2) not null default 0 check (cost >= 0),
  color_main   text not null default '#ff6a00',
  color_accent text not null default '#111111',
  badge        text,
  description  text not null default '',
  sizes        text[],
  rating       numeric(2, 1) not null default 5 check (rating >= 0 and rating <= 5),
  reviews      int  not null default 0,
  stock        int  not null default 0 check (stock >= 0),
  active       boolean not null default true,
  image_url    text,
  sort         int  not null default 0,
  created_at   timestamptz not null default now()
);

create index if not exists products_category_idx on public.products (category_id);
create index if not exists products_active_idx on public.products (active);

-- ---------------------------------------------------------------------------
-- Vendas do PDV (caixa)
-- ---------------------------------------------------------------------------
create table if not exists public.sales (
  id             uuid primary key default gen_random_uuid(),
  number         bigint generated always as identity,
  operator_id    uuid references auth.users (id),
  operator_email text,
  subtotal       numeric(10, 2) not null,
  discount       numeric(10, 2) not null default 0,
  total          numeric(10, 2) not null,
  payment_method text not null check (payment_method in ('dinheiro', 'cartao', 'pix')),
  received       numeric(10, 2) not null default 0,
  change         numeric(10, 2) not null default 0,
  installments   int not null default 1,
  created_at     timestamptz not null default now()
);

create table if not exists public.sale_items (
  id         uuid primary key default gen_random_uuid(),
  sale_id    uuid not null references public.sales (id) on delete cascade,
  product_id text not null,
  name       text not null,
  unit_price numeric(10, 2) not null,
  unit_cost  numeric(10, 2) not null default 0,
  quantity   int not null check (quantity > 0),
  line_total numeric(10, 2) not null
);

create index if not exists sale_items_sale_idx on public.sale_items (sale_id);

-- ---------------------------------------------------------------------------
-- Pedidos da loja (checkout da sacola)
-- ---------------------------------------------------------------------------
create table if not exists public.orders (
  id             uuid primary key default gen_random_uuid(),
  number         bigint generated always as identity,
  customer_name  text,
  customer_email text,
  subtotal       numeric(10, 2) not null,
  discount       numeric(10, 2) not null default 0,
  shipping       numeric(10, 2) not null default 0,
  total          numeric(10, 2) not null,
  payment_method text not null default 'pix',
  status         text not null default 'pending'
                   check (status in ('pending', 'paid', 'shipped', 'delivered', 'canceled')),
  created_at     timestamptz not null default now()
);

create table if not exists public.order_items (
  id         uuid primary key default gen_random_uuid(),
  order_id   uuid not null references public.orders (id) on delete cascade,
  product_id text not null,
  name       text not null,
  size       text,
  unit_price numeric(10, 2) not null,
  unit_cost  numeric(10, 2) not null default 0,
  quantity   int not null check (quantity > 0),
  line_total numeric(10, 2) not null
);

create index if not exists order_items_order_idx on public.order_items (order_id);

-- ===========================================================================
-- Row Level Security (RLS)
-- ===========================================================================
alter table public.categories  enable row level security;
alter table public.products    enable row level security;
alter table public.sales       enable row level security;
alter table public.sale_items  enable row level security;
alter table public.orders      enable row level security;
alter table public.order_items enable row level security;

-- Catálogo: leitura pública (loja é aberta).
create policy "catalog_public_read_categories"
  on public.categories for select using (true);
create policy "catalog_public_read_products"
  on public.products for select using (true);

-- Catálogo/estoque: escrita (admin) por qualquer usuário autenticado.
-- Em produção, restrinja a um papel de admin (ex.: coluna role em profiles
-- ou verificação de auth.jwt() ->> 'role').
create policy "products_write_authenticated"
  on public.products for all to authenticated
  using (true) with check (true);
create policy "categories_write_authenticated"
  on public.categories for all to authenticated
  using (true) with check (true);

-- PDV: apenas operadores autenticados registram/veem vendas.
create policy "sales_insert_authenticated"
  on public.sales for insert to authenticated
  with check (operator_id = auth.uid());
create policy "sales_select_authenticated"
  on public.sales for select to authenticated using (true);

create policy "sale_items_insert_authenticated"
  on public.sale_items for insert to authenticated with check (true);
create policy "sale_items_select_authenticated"
  on public.sale_items for select to authenticated using (true);

-- Loja: qualquer visitante (anon) pode criar pedido; leitura só autenticada.
create policy "orders_insert_anyone"
  on public.orders for insert to anon, authenticated with check (true);
create policy "orders_select_authenticated"
  on public.orders for select to authenticated using (true);

create policy "order_items_insert_anyone"
  on public.order_items for insert to anon, authenticated with check (true);
create policy "order_items_select_authenticated"
  on public.order_items for select to authenticated using (true);

-- Nota: para produção, considere trocar as inserções diretas de pedidos por
-- uma função SECURITY DEFINER (RPC) que valide itens/preços no servidor.

-- ===========================================================================
-- Baixa automática de estoque
-- Cada item de venda (PDV) ou de pedido (loja) reduz o estoque do produto.
-- Roda como SECURITY DEFINER para poder atualizar products sob RLS.
-- O estoque nunca fica negativo (piso em 0).
-- ===========================================================================
create or replace function public.decrement_stock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.products
     set stock = greatest(0, stock - new.quantity)
   where id = new.product_id;
  return new;
end;
$$;

drop trigger if exists trg_sale_items_stock on public.sale_items;
create trigger trg_sale_items_stock
  after insert on public.sale_items
  for each row execute function public.decrement_stock();

drop trigger if exists trg_order_items_stock on public.order_items;
create trigger trg_order_items_stock
  after insert on public.order_items
  for each row execute function public.decrement_stock();

-- ===========================================================================
-- Storage: imagens de produtos (bucket público)
-- Usado pelo painel Admin ao cadastrar/editar um produto com foto (JPG/PNG).
-- ===========================================================================
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

-- Leitura pública das imagens.
create policy "product_images_public_read"
  on storage.objects for select
  using (bucket_id = 'product-images');

-- Upload/atualização/remoção por usuários autenticados (admin).
create policy "product_images_auth_insert"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'product-images');
create policy "product_images_auth_update"
  on storage.objects for update to authenticated
  using (bucket_id = 'product-images');
create policy "product_images_auth_delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'product-images');
