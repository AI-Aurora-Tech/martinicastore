-- ===========================================================================
-- Migração 0024 — Conserta `update_purchase_items`
-- Aditiva e idempotente. Rode depois da 0023 (substitui a função criada lá).
--
-- A versão da 0023 usava uma TABELA TEMPORÁRIA para guardar o que já tinha sido
-- recebido. Isso é frágil aqui por dois motivos:
--
--   1. A função é SECURITY DEFINER com `search_path = public`. Tabela temporária
--      vive em `pg_temp`, que não está nesse caminho — dependia de um
--      comportamento implícito do PostgreSQL para ser encontrada.
--   2. O Supabase usa pool de conexões. Uma temporária que sobrevivesse a um
--      erro no meio da chamada envenenaria a próxima requisição na mesma
--      conexão.
--
-- Esta versão guarda o já recebido num `jsonb` em memória — sem tabela
-- temporária, sem depender de search_path.
-- ===========================================================================

create or replace function public.update_purchase_items(p_purchase_id uuid, p_items jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status    text;
  v_recebido  jsonb;      -- {"produto|variação": quantidade_recebida}
  v_conflito  record;
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
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'a compra precisa de pelo menos um item';
  end if;

  -- O que já entrou, por produto+variação.
  select coalesce(jsonb_object_agg(chave, qtd), '{}'::jsonb)
    into v_recebido
    from (
      select product_id || '|' || coalesce(size, '') as chave,
             sum(least(received, quantity))          as qtd
        from public.purchase_items
       where purchase_id = p_purchase_id
         and received > 0
       group by 1
    ) t;

  -- Nenhuma linha já recebida pode sumir nem encolher abaixo do recebido.
  select *
    into v_conflito
    from (
      select split_part(k, '|', 1) as produto,
             v::int                as recebido,
             coalesce((
               select sum((e ->> 'quantity')::int)
                 from jsonb_array_elements(p_items) e
                where (e ->> 'product_id') || '|' || coalesce(nullif(e ->> 'size', ''), '') = k
             ), 0) as nova_qtd
        from jsonb_each_text(v_recebido) as x(k, v)
    ) r
   where r.nova_qtd < r.recebido
   limit 1;

  if found then
    raise exception 'o item % já teve % un. recebidas; não dá para deixar a quantidade em %',
      v_conflito.produto, v_conflito.recebido, v_conflito.nova_qtd;
  end if;

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
    least(
      coalesce((v_recebido ->> ((e ->> 'product_id') || '|' || coalesce(nullif(e ->> 'size', ''), '')))::int, 0),
      (e ->> 'quantity')::int
    )
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

revoke all on function public.update_purchase_items(uuid, jsonb) from public;
grant execute on function public.update_purchase_items(uuid, jsonb) to authenticated;

comment on function public.update_purchase_items(uuid, jsonb) is
  'Regrava os itens da compra preservando o já recebido. Não mexe em estoque.';
