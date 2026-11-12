-- ===========================================================================
-- Migração 0025 — Registro de MOVIMENTAÇÃO DE ESTOQUE (entrada/saída)
--   Grava todo movimento de estoque num log (stock_movements) para ver a
--   história por produto: venda (PDV), pedido (loja), compra (recebimento),
--   estorno (cancelamentos) e ajuste manual.
--
--   Abordagem SEGURA e ADITIVA: não altera nenhuma função existente de estoque.
--   Apenas adiciona a tabela + gatilhos nas tabelas de itens/status. Cada
--   gatilho é "à prova de erro" (exception when others -> ignora), então um
--   problema no log NUNCA quebra a venda/pedido/compra.
--
--   Ajuste manual (setStock no admin) é gravado pelo front-end (kind='ajuste').
--   Idempotente. Rode depois da 0024.
-- ===========================================================================

create table if not exists public.stock_movements (
  id          uuid primary key default gen_random_uuid(),
  product_id  text not null,
  size        text,                         -- variação (null = sem variação)
  delta       int  not null,                -- + entrada / - saída
  kind        text not null,                -- venda|pedido|compra|estorno|ajuste
  ref         text,                         -- nº do documento (venda/pedido/compra)
  created_at  timestamptz not null default now()
);

create index if not exists stock_movements_product_idx
  on public.stock_movements (product_id, created_at desc);

alter table public.stock_movements enable row level security;

drop policy if exists "stock_movements_select_authenticated" on public.stock_movements;
create policy "stock_movements_select_authenticated"
  on public.stock_movements for select to authenticated using (true);

drop policy if exists "stock_movements_insert_authenticated" on public.stock_movements;
create policy "stock_movements_insert_authenticated"
  on public.stock_movements for insert to authenticated with check (true);

-- Helper: grava um movimento. SECURITY DEFINER para funcionar também quando o
-- gatilho dispara em contexto anônimo (checkout do cliente). Nunca propaga erro.
create or replace function public.log_stock_mov(
  p_product_id text, p_size text, p_delta int, p_kind text, p_ref text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_delta is null or p_delta = 0 then
    return;
  end if;
  insert into public.stock_movements (product_id, size, delta, kind, ref)
  values (p_product_id, nullif(p_size, ''), p_delta, p_kind, nullif(p_ref, ''));
exception when others then
  null; -- o log nunca quebra a operação de estoque
end;
$$;

-- --- Venda (PDV): saída a cada item vendido ---------------------------------
create or replace function public.mov_sale_item()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_num text;
begin
  begin
    select number::text into v_num from public.sales where id = new.sale_id;
    perform public.log_stock_mov(new.product_id, new.size, -new.quantity, 'venda', v_num);
  exception when others then null;
  end;
  return new;
end;
$$;
drop trigger if exists trg_mov_sale_item on public.sale_items;
create trigger trg_mov_sale_item
  after insert on public.sale_items
  for each row execute function public.mov_sale_item();

-- --- Pedido (loja): saída (reserva) a cada item do pedido -------------------
create or replace function public.mov_order_item()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_num text;
begin
  begin
    select number::text into v_num from public.orders where id = new.order_id;
    perform public.log_stock_mov(new.product_id, new.size, -new.quantity, 'pedido', v_num);
  exception when others then null;
  end;
  return new;
end;
$$;
drop trigger if exists trg_mov_order_item on public.order_items;
create trigger trg_mov_order_item
  after insert on public.order_items
  for each row execute function public.mov_order_item();

-- --- Compra: entrada quando o `received` aumenta (recebimento) --------------
create or replace function public.mov_purchase_received()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_num text; v_delta int;
begin
  begin
    v_delta := coalesce(new.received, 0) - coalesce(old.received, 0);
    if v_delta <> 0 then
      select number::text into v_num from public.purchases where id = new.purchase_id;
      perform public.log_stock_mov(
        new.product_id, new.size, v_delta,
        case when v_delta > 0 then 'compra' else 'estorno' end, v_num);
    end if;
  exception when others then null;
  end;
  return new;
end;
$$;
drop trigger if exists trg_mov_purchase_received on public.purchase_items;
create trigger trg_mov_purchase_received
  after update of received on public.purchase_items
  for each row execute function public.mov_purchase_received();

-- --- Estorno: pedido (loja) cancelado devolve o estoque reservado -----------
create or replace function public.mov_order_cancel()
returns trigger language plpgsql security definer set search_path = public as $$
declare it record;
begin
  begin
    if new.status = 'canceled' and old.status is distinct from 'canceled'
       and coalesce(old.stock_applied, false) then
      for it in
        select product_id, size, quantity from public.order_items where order_id = new.id
      loop
        perform public.log_stock_mov(it.product_id, it.size, it.quantity, 'estorno', new.number::text);
      end loop;
    end if;
  exception when others then null;
  end;
  return new;
end;
$$;
drop trigger if exists trg_mov_order_cancel on public.orders;
create trigger trg_mov_order_cancel
  after update of status on public.orders
  for each row execute function public.mov_order_cancel();

-- --- Estorno: venda (PDV) cancelada devolve o estoque -----------------------
create or replace function public.mov_sale_cancel()
returns trigger language plpgsql security definer set search_path = public as $$
declare it record;
begin
  begin
    if new.status = 'canceled' and old.status is distinct from 'canceled' then
      for it in
        select product_id, size, quantity from public.sale_items where sale_id = new.id
      loop
        perform public.log_stock_mov(it.product_id, it.size, it.quantity, 'estorno', new.number::text);
      end loop;
    end if;
  exception when others then null;
  end;
  return new;
end;
$$;
drop trigger if exists trg_mov_sale_cancel on public.sales;
create trigger trg_mov_sale_cancel
  after update of status on public.sales
  for each row execute function public.mov_sale_cancel();

-- --- Estorno: compra cancelada retira o que havia entrado -------------------
create or replace function public.mov_purchase_cancel()
returns trigger language plpgsql security definer set search_path = public as $$
declare it record;
begin
  begin
    if new.status = 'cancelado' and old.status is distinct from 'cancelado' then
      for it in
        select product_id, size, least(received, quantity) as qty
          from public.purchase_items
         where purchase_id = new.id and received > 0
      loop
        perform public.log_stock_mov(it.product_id, it.size, -it.qty, 'estorno', new.number::text);
      end loop;
    end if;
  exception when others then null;
  end;
  return new;
end;
$$;
drop trigger if exists trg_mov_purchase_cancel on public.purchases;
create trigger trg_mov_purchase_cancel
  after update of status on public.purchases
  for each row execute function public.mov_purchase_cancel();
