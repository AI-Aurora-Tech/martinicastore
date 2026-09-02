-- ===========================================================================
-- Migração 0012 — Despesas (contas da loja): avulsas e recorrentes.
--   As COMPRAS (tabela purchases) entram como conta a pagar/paga por si só —
--   esta tabela guarda as DEMAIS despesas (aluguel, luz, água, salários, etc.).
--   - recurring: despesa recorrente (modelo); recurrence: 'mensal' | 'semanal'.
--   - paid/paid_at: conta paga; due_date: vencimento.
-- Aditiva e idempotente. Rode depois da 0011. Só ADMIN escreve/lê.
-- ===========================================================================

create table if not exists public.expenses (
  id          uuid primary key default gen_random_uuid(),
  description text not null,
  category    text,
  amount      numeric(12,2) not null default 0,
  due_date    date,
  paid        boolean not null default false,
  paid_at     timestamptz,
  recurring   boolean not null default false,
  recurrence  text,                       -- 'mensal' | 'semanal'
  operator_email text,
  created_at  timestamptz not null default now()
);

create index if not exists idx_expenses_due  on public.expenses (due_date);
create index if not exists idx_expenses_paid on public.expenses (paid);

alter table public.expenses enable row level security;

drop policy if exists "expenses_admin" on public.expenses;
create policy "expenses_admin"
  on public.expenses for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
