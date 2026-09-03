-- ===========================================================================
-- Migração 0015 — Cancelamento automático de pedidos não pagos (24h).
--   Pedidos da loja online com pagamento ONLINE iniciado (têm preferência do
--   Mercado Pago) que continuam 'pending' e sem pagamento por mais de 24h são
--   cancelados (status='canceled', payment_status='expired').
--
--   Só afeta pedidos com mp_preference_id preenchido — pedidos SEM pagamento
--   online (fluxo manual) NÃO são cancelados automaticamente.
--
--   Agenda a limpeza a cada 15 min via pg_cron (se disponível). Se o pg_cron
--   não estiver habilitado, a função continua existindo e pode ser chamada
--   manualmente ou por outro agendador (ver observação no fim).
-- Aditiva e idempotente. Rode depois da 0014.
-- ===========================================================================

create or replace function public.cancel_stale_orders()
returns integer
language sql
security definer
set search_path = public
as $$
  with upd as (
    update public.orders
       set status = 'canceled',
           payment_status = coalesce(nullif(payment_status, ''), 'expired')
     where status = 'pending'
       and paid_at is null
       and mp_preference_id is not null
       and created_at < now() - interval '24 hours'
    returning 1
  )
  select coalesce(count(*), 0)::int from upd;
$$;

grant execute on function public.cancel_stale_orders() to service_role;

-- Agendamento (a cada 15 min). Protegido: só agenda se o pg_cron existir.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    -- remove agendamento anterior com o mesmo nome (idempotência)
    perform cron.unschedule('cancel-stale-orders')
      where exists (select 1 from cron.job where jobname = 'cancel-stale-orders');
    perform cron.schedule('cancel-stale-orders', '*/15 * * * *',
      $cron$ select public.cancel_stale_orders(); $cron$);
  else
    raise notice 'pg_cron não está habilitado — habilite em Database → Extensions (pg_cron) e rode esta migração de novo para agendar o cancelamento automático.';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Observação: para habilitar o pg_cron no Supabase:
--   Dashboard → Database → Extensions → procure "pg_cron" → Enable.
--   Depois rode este arquivo novamente (o bloco acima cria o agendamento).
-- Alternativa sem pg_cron: chame `select public.cancel_stale_orders();` por um
--   Scheduled Function / cron externo apontando para uma Edge Function.
-- ---------------------------------------------------------------------------
