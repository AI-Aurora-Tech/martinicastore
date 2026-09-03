-- ===========================================================================
-- Migração 0017 — Fornecedor padrão do produto (para compra).
--   products.supplier_id referencia suppliers(id). Usado no cadastro do produto
--   e para agilizar o pedido de compra. Opcional (nulo permitido); ON DELETE
--   SET NULL para não travar a exclusão de um fornecedor.
-- Aditiva e idempotente. Rode depois da 0016.
-- ===========================================================================

alter table public.products
  add column if not exists supplier_id uuid references public.suppliers (id) on delete set null;

create index if not exists products_supplier_idx on public.products (supplier_id);
