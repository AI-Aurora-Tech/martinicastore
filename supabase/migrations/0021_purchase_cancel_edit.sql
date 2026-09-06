-- ===========================================================================
-- Migração 0021 — Editar e cancelar pedido de compra
-- Aditiva e idempotente. Seguro rodar várias vezes.
--
--   - cancel_purchase(): marca a compra como 'cancelado' e, se ela já estava
--     ENTREGUE, devolve ao estoque exatamente o que tinha entrado.
--   - Colunas que o app já usa mas que não estavam em nenhuma migração deste
--     repositório (status, payment_method, paid, paid_at, purchase_items.size)
--     são criadas aqui se faltarem, para um banco novo ficar igual ao atual.
--   - Remove o gatilho legado que somava estoque na CRIAÇÃO da compra. Leia a
--     nota no fim do arquivo antes de rodar.
-- ===========================================================================

-- --- Colunas que o app usa (defensivo: só cria se faltar) ------------------
alter table public.purchases add column if not exists status         text not null default 'pendente';
alter table public.purchases add column if not exists payment_method text;
alter table public.purchases add column if not exists paid           boolean not null default false;
alter table public.purchases add column if not exists paid_at        timestamptz;
alter table public.purchase_items add column if not exists size text;

-- --- Cancelamento ----------------------------------------------------------
-- Devolve o estoque só quando a compra já tinha dado entrada (status
-- 'entregue'). `apply_stock` (migração 0009) abate a quantidade informada e
-- respeita variações; é o mesmo caminho usado pela venda.
create or replace function public.cancel_purchase(p_purchase_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  it       record;
begin
  select status into v_status
    from public.purchases
   where id = p_purchase_id
   for update;

  if v_status is null then
    raise exception 'compra não encontrada';
  end if;

  -- Idempotente: cancelar de novo não mexe no estoque outra vez.
  if v_status = 'cancelado' then
    return;
  end if;

  if v_status = 'entregue' then
    for it in
      select product_id, size, quantity
        from public.purchase_items
       where purchase_id = p_purchase_id
    loop
      perform public.apply_stock(it.product_id, it.size, it.quantity);
    end loop;
  end if;

  update public.purchases
     set status = 'cancelado'
   where id = p_purchase_id;
end;
$$;

revoke all on function public.cancel_purchase(uuid) from public;
grant execute on function public.cancel_purchase(uuid) to authenticated;

-- --- Gatilho legado --------------------------------------------------------
-- A 0003 criava `trg_purchase_items_stock`, que somava ao estoque a cada item
-- INSERIDO. O app mudou: o estoque entra quando a compra é marcada como
-- ENTREGUE (receive_purchase). Com o gatilho no ar, cada compra somaria o
-- estoque duas vezes — e editar um pedido (que regrava os itens) somaria de
-- novo.
--
-- Se quiser conferir antes de rodar:
--   select tgname, tgrelid::regclass
--     from pg_trigger where tgname = 'trg_purchase_items_stock';
--
-- Se ele NÃO aparecer, já tinha sido removido e esta linha não faz nada.
drop trigger if exists trg_purchase_items_stock on public.purchase_items;

comment on function public.cancel_purchase(uuid) is
  'Cancela a compra; se estava entregue, devolve o estoque dos itens.';
