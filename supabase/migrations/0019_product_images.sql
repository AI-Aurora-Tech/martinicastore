-- ===========================================================================
-- Migração 0019 — Múltiplas fotos por produto.
--   products.images jsonb: lista de URLs das fotos (a 1ª é a principal).
--   A coluna image_url continua sendo a foto principal (compatibilidade).
-- Aditiva e idempotente. Rode depois da 0018.
-- ===========================================================================

alter table public.products add column if not exists images jsonb;
