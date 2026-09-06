-- ===========================================================================
-- Migração 0020 — Grupo de WhatsApp do fornecedor
-- Aditiva e idempotente. Seguro rodar várias vezes.
--
-- Guarda o ID do grupo de WhatsApp do fornecedor (ex.: 120363XXXXXXXXXXXX@g.us).
-- O pedido de compra é enviado para esse grupo pela Edge Function
-- `notify-purchase` (Evolution API). Sem o grupo, a compra segue normalmente —
-- o envio é opcional.
-- ===========================================================================

alter table public.suppliers
  add column if not exists whatsapp_group text;

comment on column public.suppliers.whatsapp_group is
  'ID do grupo de WhatsApp do fornecedor (120363...@g.us). Destino do pedido de compra.';
