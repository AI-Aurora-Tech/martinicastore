-- ===========================================================================
-- Migração 0023 — Recebimento PARCIAL de um pedido de compra
-- Aditiva e idempotente. Rode depois da 0022.
--
-- Regras do ciclo de vida:
--   pendente  → nada recebido            → pode editar e receber
--   parcial   → parte recebida           → pode editar e receber o restante
--   entregue  → 100% recebido            → FECHADO: não edita nem recebe mais
--   cancelado → devolve o que foi recebido
--
-- O estoque passa a refletir o que foi RECEBIDO, não o que foi pedido. Por isso
-- esta migração também redefine `cancel_purchase` (devolve `received`, não
-- `quantity`) e `update_purchase_items` (a edição não mexe mais em estoque).
--
-- Sobre `apply_stock` (migração 0009): ela SUBTRAI a quantidade informada.
-- Receber SOMA estoque, então passa quantidade negativa; devolver passa
-- positiva.
-- ===========================================================================

alter table public.purchase_items
  add column if not exists received int not null default 0;

comment on column public.purchase_items.received is
  'Quantidade já recebida deste item (0 = nada, = quantity quando completo).';

-- Compras que já estavam marcadas como entregues contam como 100% recebidas.
update public.purchase_items pi
   set received = pi.quantity
  from public.purchases p
 where p.id = pi.purchase_id
   and p.status = 'entregue'
   and pi.received = 0;

-- --- Recalcula o status a partir do que foi recebido ------------------------
create or replace function public.purchase_sync_status(p_purchase_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total    int;
  v_recebido int;
  v_faltando int;
  v_status   text;
begin
  select coalesce(sum(quantity), 0), coalesce(sum(least(received, quantity)), 0),
         count(*) filter (where received < quantity)
    into v_total, v_recebido, v_faltando
    from public.purchase_items
   where purchase_id = p_purchase_id;

  v_status := case
    when v_total = 0 or v_recebido = 0 then 'pendente'
    when v_faltando = 0                then 'entregue'
    else                                    'parcial'
  end;

  update public.purchases set status = v_status where id = p_purchase_id;
  return v_status;
end;
$$;

-- --- Receber (parcial ou total) --------------------------------------------
-- p_items: [{"item_id": "<uuid>", "quantity": 3}, ...]
create or replace function public.receive_purchase_items(p_purchase_id uuid, p_items jsonb)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  e        jsonb;
  v_item   record;
  v_qty    int;
begin
  select status into v_status
    from public.purchases
   where id = p_purchase_id
   for update;

  if v_status is null then
    raise exception 'compra não encontrada';
  end if;
  if v_status = 'cancelado' then
    raise exception 'compra cancelada não recebe itens';
  end if;
  if v_status = 'entregue' then
    raise exception 'compra já recebida por completo';
  end if;

  for e in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb))
  loop
    v_qty := (e ->> 'quantity')::int;
    continue when v_qty is null or v_qty <= 0;

    select id, product_id, size, quantity, received
      into v_item
      from public.purchase_items
     where id = (e ->> 'item_id')::uuid
       and purchase_id = p_purchase_id
     for update;

    if v_item.id is null then
      raise exception 'item % não pertence a esta compra', e ->> 'item_id';
    end if;
    if v_item.received + v_qty > v_item.quantity then
      raise exception 'recebimento maior que o pedido no item % (pedido %, já recebido %)',
        v_item.product_id, v_item.quantity, v_item.received;
    end if;

    update public.purchase_items
       set received = received + v_qty
     where id = v_item.id;

    -- negativo = soma ao estoque
    perform public.apply_stock(v_item.product_id, v_item.size, -v_qty);
  end loop;

  return public.purchase_sync_status(p_purchase_id);
end;
$$;

-- --- Cancelamento: devolve o que foi RECEBIDO ------------------------------
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
  if v_status = 'cancelado' then
    return;                        -- idempotente
  end if;

  -- Sai do estoque só o que realmente entrou.
  for it in
    select product_id, size, least(received, quantity) as qty
      from public.purchase_items
     where purchase_id = p_purchase_id
       and received > 0
  loop
    perform public.apply_stock(it.product_id, it.size, it.qty);
  end loop;

  update public.purchases set status = 'cancelado' where id = p_purchase_id;
end;
$$;

-- --- Edição: só antes de fechar, e sem mexer em estoque ---------------------
-- O estoque reflete o recebido, e editar não recebe nada — então nada de
-- estoque aqui. O `received` de cada linha é preservado casando product_id +
-- size (a tela não deixa repetir a mesma combinação no mesmo pedido).
create or replace function public.update_purchase_items(p_purchase_id uuid, p_items jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_orfao  record;
begin
  select status into v_status
    from public.purchases
   where id = p_purchase_id
   for update;

  if v_status is null then
    raise exception 'compra não encontrada';
  end if;
  if v_status = 'cancelado' then
    raise exception 'compra cancelada não pode ser editada';
  end if;
  if v_status = 'entregue' then
    raise exception 'compra 100%% recebida não pode mais ser alterada';
  end if;
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'a compra precisa de pelo menos um item';
  end if;

  -- O que já foi recebido, por produto+variação.
  create temporary table if not exists _recebido_tmp (
    product_id text, size text, received int
  ) on commit drop;
  delete from _recebido_tmp;
  insert into _recebido_tmp
  select product_id, coalesce(size, ''), sum(received)
    from public.purchase_items
   where purchase_id = p_purchase_id and received > 0
   group by product_id, coalesce(size, '');

  -- Nenhuma linha já recebida pode sumir nem encolher abaixo do recebido.
  for v_orfao in
    select r.product_id, r.size, r.received,
           coalesce((
             select sum((e ->> 'quantity')::int)
               from jsonb_array_elements(p_items) e
              where e ->> 'product_id' = r.product_id
                and coalesce(nullif(e ->> 'size', ''), '') = r.size
           ), 0) as nova_qtd
      from _recebido_tmp r
  loop
    if v_orfao.nova_qtd < v_orfao.received then
      raise exception 'o item % já teve % un. recebidas; não dá para deixar a quantidade em %',
        v_orfao.product_id, v_orfao.received, v_orfao.nova_qtd;
    end if;
  end loop;

  delete from public.purchase_items where purchase_id = p_purchase_id;

  insert into public.purchase_items
    (purchase_id, product_id, name, size, quantity, unit_cost, line_total, received)
  select
    p_purchase_id,
    e ->> 'product_id',
    e ->> 'name',
    nullif(e ->> 'size', ''),
    (e ->> 'quantity')::int,
    (e ->> 'unit_cost')::numeric,
    (e ->> 'quantity')::int * (e ->> 'unit_cost')::numeric,
    coalesce((
      select r.received from _recebido_tmp r
       where r.product_id = e ->> 'product_id'
         and r.size = coalesce(nullif(e ->> 'size', ''), '')
    ), 0)
  from jsonb_array_elements(p_items) e;

  update public.purchases
     set total = (
       select coalesce(sum(line_total), 0)
         from public.purchase_items
        where purchase_id = p_purchase_id
     )
   where id = p_purchase_id;

  perform public.purchase_sync_status(p_purchase_id);
end;
$$;

revoke all on function public.purchase_sync_status(uuid)            from public;
revoke all on function public.receive_purchase_items(uuid, jsonb)   from public;
grant execute on function public.purchase_sync_status(uuid)          to authenticated;
grant execute on function public.receive_purchase_items(uuid, jsonb) to authenticated;

comment on function public.receive_purchase_items(uuid, jsonb) is
  'Recebe quantidades por item (parcial ou total), soma ao estoque e atualiza o status da compra.';
