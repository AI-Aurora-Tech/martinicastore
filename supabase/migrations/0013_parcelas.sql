-- ===========================================================================
-- Migração 0013 — Compras parceladas: datas de vencimento por parcela.
--   - purchases.installments jsonb: [{ n, amount, dueDate, paid, paidAt }].
--     À vista => installments null e paid=true. Não à vista => uma linha por
--     parcela (paid individual). A compra fica paid=true quando TODAS pagam.
--   - pay_purchase_installment(): marca UMA parcela como paga (e a compra
--     inteira quando não restar parcela em aberto).
-- Aditiva e idempotente. Rode depois da 0012. Só admin.
-- ===========================================================================

alter table public.purchases add column if not exists installments jsonb;

create or replace function public.pay_purchase_installment(p_purchase_id uuid, p_n int)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare open_left int;
begin
  if not public.is_admin() then
    raise exception 'Apenas administradores podem baixar parcelas.';
  end if;

  update public.purchases
     set installments = (
       select jsonb_agg(
         case when (e->>'n')::int = p_n
           then jsonb_set(jsonb_set(e, '{paid}', 'true'::jsonb), '{paidAt}', to_jsonb(now()))
           else e end)
       from jsonb_array_elements(installments) e)
   where id = p_purchase_id;

  select count(*) into open_left
    from public.purchases,
         lateral jsonb_array_elements(coalesce(installments, '[]'::jsonb)) e
   where id = p_purchase_id and coalesce((e->>'paid')::boolean, false) = false;

  update public.purchases
     set paid = (open_left = 0),
         paid_at = case when open_left = 0 then coalesce(paid_at, now()) else null end
   where id = p_purchase_id;
end;
$$;
grant execute on function public.pay_purchase_installment(uuid, int) to authenticated;
