-- ===========================================================================
-- Corrige "schema drift": adiciona colunas que podem estar faltando se as
-- tabelas foram criadas por uma versão ANTERIOR da migração.
-- Seguro de rodar várias vezes (add column if not exists).
-- Sintoma que isto resolve: "Supabase configurado, mas a leitura falhou"
-- com erro do tipo: column products.cost does not exist (código 42703).
-- ===========================================================================

-- products
alter table public.products add column if not exists cost         numeric(10, 2) not null default 0;
alter table public.products add column if not exists old_price    numeric(10, 2);
alter table public.products add column if not exists color_main   text not null default '#ff6a00';
alter table public.products add column if not exists color_accent text not null default '#111111';
alter table public.products add column if not exists badge        text;
alter table public.products add column if not exists description  text not null default '';
alter table public.products add column if not exists sizes        text[];
alter table public.products add column if not exists rating       numeric(2, 1) not null default 5;
alter table public.products add column if not exists reviews      int  not null default 0;
alter table public.products add column if not exists stock        int  not null default 0;
alter table public.products add column if not exists active       boolean not null default true;
alter table public.products add column if not exists image_url    text;
alter table public.products add column if not exists sort         int  not null default 0;

-- sales / itens
alter table public.sales       add column if not exists operator_email text;
alter table public.sale_items  add column if not exists unit_cost numeric(10, 2) not null default 0;

-- orders / itens
alter table public.order_items add column if not exists unit_cost numeric(10, 2) not null default 0;
alter table public.order_items add column if not exists size      text;

-- Confirme que as colunas de products existem agora:
select column_name
from information_schema.columns
where table_schema = 'public' and table_name = 'products'
order by ordinal_position;
