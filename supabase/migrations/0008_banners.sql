-- ===========================================================================
-- Migração 0008 — Banners do topo da loja (editáveis no painel)
-- Leitura pública; escrita só ADMIN. Idempotente. Rode depois da 0007.
-- ===========================================================================

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
