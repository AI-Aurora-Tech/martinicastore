-- ===========================================================================
-- Migração 0014 — CPF do cliente (obrigatório no cadastro da loja online).
--   Guardado em customers.cpf (somente dígitos). A obrigatoriedade é validada
--   no formulário; a coluna aceita nulo para não quebrar cadastros já existentes.
-- Aditiva e idempotente. Rode depois da 0013.
-- ===========================================================================

alter table public.customers add column if not exists cpf text;
