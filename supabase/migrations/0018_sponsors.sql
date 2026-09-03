-- ===========================================================================
-- Migração 0018 — Patrocinadores (logos com link na loja).
--   Leitura pública (loja); escrita só ADMIN. A gravação real é feita pela
--   Edge Function manage-sponsor (service role), como nos banners.
-- Aditiva e idempotente. Rode depois da 0017.
-- ===========================================================================

create table if not exists public.sponsors (
  id         uuid primary key default gen_random_uuid(),
  name       text,
  image_url  text not null,
  link       text,
  active     boolean not null default true,
  sort       int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.sponsors enable row level security;

drop policy if exists "sponsors_public_read" on public.sponsors;
create policy "sponsors_public_read"
  on public.sponsors for select using (true);

drop policy if exists "sponsors_admin" on public.sponsors;
create policy "sponsors_admin"
  on public.sponsors for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
