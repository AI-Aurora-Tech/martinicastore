-- ===========================================================================
-- Migração 0016 — Estoque: baixa ao FAZER o pedido e restaura ao CANCELAR.
--
--   Loja online:
--     - Volta a baixar o estoque na CRIAÇÃO do pedido (reserva), por variação
--       (o trigger tinha sido removido na 0006, que baixava só na aprovação).
--       ⚠️ Com isto, o webhook do Mercado Pago NÃO deve mais baixar estoque —
--       atualize a função mercadopago-webhook (removendo apply_order_stock).
--     - Ao CANCELAR o pedido (manual ou automático em 24h), o estoque é
--       restaurado (por variação).
--   PDV:
--     - Continua baixando na venda (trigger existente).
--     - Ao CANCELAR a venda, o estoque é restaurado.
--
--   Idempotência: orders.stock_applied evita restaurar duas vezes.
-- Aditiva e idempotente. Rode depois da 0015.
-- ===========================================================================

alter table public.orders add column if not exists stock_applied boolean not null default false;

-- Marca como já reservado os pedidos ativos existentes (não cancelados), para
-- que um cancelamento futuro restaure o estoque corretamente.
update public.orders
   set stock_applied = true
 where stock_applied = false and status <> 'canceled';

-- --------- Reserva de estoque na criação do pedido (por item) ---------------
create or replace function public.order_item_reserve_stock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.apply_stock(new.product_id, coalesce(new.size, ''), new.quantity);
  update public.orders set stock_applied = true where id = new.order_id;
  return new;
end;
$$;

drop trigger if exists trg_order_items_stock on public.order_items;
create trigger trg_order_items_stock
  after insert on public.order_items
  for each row execute function public.order_item_reserve_stock();

-- --------- Restaura o estoque de um pedido (por variação) -------------------
create or replace function public.restore_order_stock(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare r record;
begin
  for r in
    select product_id, coalesce(size, '') as size, sum(quantity)::int as qty
      from public.order_items
     where order_id = p_order_id
     group by product_id, coalesce(size, '')
  loop
    perform public.add_stock(r.product_id, r.size, r.qty);
  end loop;
end;
$$;

-- --------- Cancelou o pedido -> devolve ao estoque --------------------------
create or replace function public.order_cancel_restock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'canceled'
     and old.status is distinct from 'canceled'
     and coalesce(old.stock_applied, false) then
    perform public.restore_order_stock(new.id);
    new.stock_applied := false;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_orders_cancel_restock on public.orders;
create trigger trg_orders_cancel_restock
  before update on public.orders
  for each row execute function public.order_cancel_restock();

-- --------- PDV: cancelou a venda -> devolve ao estoque ----------------------
create or replace function public.sale_cancel_restock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare r record;
begin
  if new.status = 'canceled' and old.status is distinct from 'canceled' then
    for r in
      select product_id, coalesce(size, '') as size, sum(quantity)::int as qty
        from public.sale_items
       where sale_id = new.id
       group by product_id, coalesce(size, '')
    loop
      perform public.add_stock(r.product_id, r.size, r.qty);
    end loop;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sales_cancel_restock on public.sales;
create trigger trg_sales_cancel_restock
  before update on public.sales
  for each row execute function public.sale_cancel_restock();
