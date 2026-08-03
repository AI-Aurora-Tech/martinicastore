-- Apenas as categorias (taxonomia da loja), SEM produtos de exemplo.
-- Use este arquivo para começar com o catálogo VAZIO e cadastrar seus
-- próprios produtos pelo painel Admin. Rode depois de 0001_init.sql.
insert into public.categories (id, label, sort) values
  ('camisas', 'Camisas', 0),
  ('agasalhos', 'Agasalhos', 1),
  ('calcados', 'Calçados', 2),
  ('acessorios', 'Acessórios', 3),
  ('torcedor', 'Torcedor', 4),
  ('pet', 'Pet', 5)
on conflict (id) do update set label = excluded.label, sort = excluded.sort;
