-- ===========================================================================
-- Migração 0007 — Papéis da equipe (admin x operador)
--   admin    → Gestão (painel) + PDV
--   operator → SOMENTE o PDV (registrar vendas)
-- Aditiva e idempotente. Rode depois da 0006.
-- ===========================================================================

-- A tabela `admins` passa a ser a tabela da EQUIPE, com um papel por usuário.
alter table public.admins
  add column if not exists role text not null default 'admin';

-- Garante o CHECK do papel (idempotente).
alter table public.admins drop constraint if exists admins_role_chk;
alter table public.admins
  add constraint admins_role_chk check (role in ('admin', 'operator'));

-- is_admin(): agora exige papel = 'admin'.
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

-- ---- PDV (vendas): liberado para toda a EQUIPE (admin + operador) ----------
drop policy if exists "sales_admin" on public.sales;
drop policy if exists "sales_staff" on public.sales;
create policy "sales_staff"
  on public.sales for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

drop policy if exists "sale_items_admin" on public.sale_items;
drop policy if exists "sale_items_staff" on public.sale_items;
create policy "sale_items_staff"
  on public.sale_items for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- As demais tabelas (produtos/categorias/pedidos/clientes/compras/fornecedores
-- e imagens) permanecem restritas a ADMIN via public.is_admin(), definidas na
-- migração 0006. Operador NÃO gerencia catálogo, estoque nem pedidos online.
