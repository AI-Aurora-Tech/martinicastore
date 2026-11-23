-- ===========================================================================
-- Migração 0026 — Backfill da MOVIMENTAÇÃO DE ESTOQUE (histórico)
--   A 0025 só registra movimentos NOVOS (por gatilho). Esta migração preenche
--   o histórico a partir do que já existe: vendas (PDV), pedidos (loja) e
--   compras recebidas.
--
--   Idempotente e sem duplicar: só insere eventos ANTERIORES ao primeiro
--   movimento já registrado pelos gatilhos (cutoff = menor created_at da
--   tabela, ou agora() se ainda estiver vazia). Rodar de novo não duplica.
--
--   Movimentos cancelados (venda/pedido/compra) somam zero e são omitidos no
--   histórico — daqui pra frente os gatilhos registram inclusive os estornos.
--   Rode depois da 0025.
-- ===========================================================================

do $$
declare
  cutoff timestamptz;
begin
  select coalesce(min(created_at), now()) into cutoff from public.stock_movements;

  -- Vendas (PDV) — saída. Ignora vendas canceladas (estoque foi devolvido).
  insert into public.stock_movements (product_id, size, delta, kind, ref, created_at)
  select si.product_id, nullif(si.size, ''), -si.quantity, 'venda', s.number::text, s.created_at
    from public.sale_items si
    join public.sales s on s.id = si.sale_id
   where s.created_at < cutoff
     and coalesce(s.status, 'paid') <> 'canceled';

  -- Pedidos (loja) — saída (reserva). Só os que ainda seguram estoque
  -- (não cancelados e com estoque aplicado).
  insert into public.stock_movements (product_id, size, delta, kind, ref, created_at)
  select oi.product_id, nullif(oi.size, ''), -oi.quantity, 'pedido', o.number::text, o.created_at
    from public.order_items oi
    join public.orders o on o.id = oi.order_id
   where o.created_at < cutoff
     and coalesce(o.status, '') <> 'canceled'
     and coalesce(o.stock_applied, false);

  -- Compras — entrada do que foi RECEBIDO. Ignora compras canceladas.
  insert into public.stock_movements (product_id, size, delta, kind, ref, created_at)
  select pi.product_id, nullif(pi.size, ''), least(pi.received, pi.quantity), 'compra', p.number::text, p.created_at
    from public.purchase_items pi
    join public.purchases p on p.id = pi.purchase_id
   where p.created_at < cutoff
     and pi.received > 0
     and coalesce(p.status, '') <> 'cancelado';
end $$;
