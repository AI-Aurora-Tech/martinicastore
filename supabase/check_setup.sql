-- ===========================================================================
-- Diagnóstico rápido do setup. Rode no SQL Editor e confira os resultados.
-- ===========================================================================

-- 1) As tabelas existem?
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in ('categories','products','sales','sale_items','orders','order_items')
order by table_name;
-- Esperado: 6 linhas.

-- 2) Existem policies nas tabelas do catálogo? (RLS ligado SEM policy = tudo bloqueado)
select tablename, policyname, cmd, roles
from pg_policies
where schemaname = 'public'
  and tablename in ('products','categories')
order by tablename, policyname;
-- Esperado: read público + write autenticado em products e categories.

-- 3) Há categorias cadastradas? (products.category_id referencia categories)
select count(*) as categorias from public.categories;
-- Esperado: >= 1 (rode seed_categories.sql se for 0).

-- 4) Há produtos?
select count(*) as produtos from public.products;

-- 5) Existe algum usuário para logar no Admin/PDV?
select count(*) as usuarios_auth from auth.users;
-- Esperado: >= 1 (crie em Authentication -> Users, com "Auto Confirm").
