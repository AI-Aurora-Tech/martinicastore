-- ===========================================================================
-- Migração 0009 — Estoque individual por variação (tamanho/cor/etc.)
--   products.variants: jsonb [{ "label": "P", "stock": 10 }, ...]
--   sale_items.size:   registra a variação vendida no PDV
--   Baixa de estoque passa a abater a VARIAÇÃO certa (e o total = soma).
-- Aditiva e idempotente. Rode depois da 0008.
-- ===========================================================================

alter table public.products   add column if not exists variants jsonb not null default '[]'::jsonb;
alter table public.sale_items add column if not exists size text;

-- Abate `qty` do estoque de um produto. Se `p_label` for uma variação
-- existente, abate a variação; o total (products.stock) sempre reflete a soma
-- das variações quando houver, senão abate direto.
create or replace function public.apply_stock(p_id text, p_label text, p_qty int)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_label is not null and p_label <> '' then
    update public.products p
       set variants = coalesce((
         select jsonb_agg(
           case when (elem->>'label') = p_label
             then jsonb_set(elem, '{stock}',
                    to_jsonb(greatest(0, coalesce((elem->>'stock')::int, 0) - p_qty)))
             else elem end)
         from jsonb_array_elements(p.variants) elem
       ), p.variants)
     where p.id = p_id;
  end if;

  update public.products p
     set stock = case
       when jsonb_typeof(p.variants) = 'array' and jsonb_array_length(p.variants) > 0
         then (select coalesce(sum((e->>'stock')::int), 0)
                 from jsonb_array_elements(p.variants) e)
       else greatest(0, p.stock - p_qty)
     end
   where p.id = p_id;
end;
$$;
grant execute on function public.apply_stock(text, text, int) to service_role;

-- Baixa de estoque de um pedido inteiro (chamado pelo webhook na aprovação),
-- agora por (produto, variação).
create or replace function public.apply_order_stock(p_order_id uuid)
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
    perform public.apply_stock(r.product_id, r.size, r.qty);
  end loop;
end;
$$;
grant execute on function public.apply_order_stock(uuid) to service_role;

-- Trigger do PDV: abate o estoque (da variação, se informada) a cada item
-- vendido no PDV.
create or replace function public.decrement_stock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.apply_stock(new.product_id, new.size, new.quantity);
  return new;
end;
$$;

drop trigger if exists trg_sale_items_stock on public.sale_items;
create trigger trg_sale_items_stock
  after insert on public.sale_items
  for each row execute function public.decrement_stock();
