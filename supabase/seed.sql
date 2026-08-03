-- Seed gerado automaticamente a partir de src/data/products.ts
-- (npm run gen:seed). Não editar à mão.

insert into public.categories (id, label, sort) values
  ('camisas', 'Camisas', 0),
  ('agasalhos', 'Agasalhos', 1),
  ('calcados', 'Calçados', 2),
  ('acessorios', 'Acessórios', 3),
  ('torcedor', 'Torcedor', 4),
  ('pet', 'Pet', 5)
on conflict (id) do update set label = excluded.label, sort = excluded.sort;

insert into public.products (id, name, category_id, kind, price, old_price, cost, color_main, color_accent, badge, description, sizes, rating, reviews, stock, image_url, sort) values
  ('cam-01', 'Camisa Oficial I 2026 — Torcedor', 'camisas', 'jersey', 349.9, 399.9, 157.45, '#ff6a00', '#111111', 'Lançamento', 'A nova camisa titular do Martinica FC para a temporada 2026. Tecido leve com tecnologia de secagem rápida e escudo bordado.', array['P','M','G','GG','XGG'], 4.9, 512, 24, null, 0),
  ('cam-02', 'Camisa Oficial II 2026 — Torcedor', 'camisas', 'jersey', 349.9, 399.9, 157.45, '#f4f4f4', '#ff6a00', 'Lançamento', 'O manto branco do Timão da Martinica. Design clássico com detalhes em laranja e gola em ribana.', array['P','M','G','GG','XGG'], 4.8, 341, 8, null, 1),
  ('cam-03', 'Camisa Oficial III 2026 — Edição Ouro', 'camisas', 'jersey', 379.9, null, 170.95, '#111111', '#f5b301', 'Edição limitada', 'Terceiro uniforme em preto e dourado, homenagem ao centenário do clube. Produção limitada.', array['P','M','G','GG','XGG'], 5, 188, 15, null, 2),
  ('cam-04', 'Camisa Retrô 1990 — Campeão', 'camisas', 'jersey', 299.9, null, 134.95, '#ff6a00', '#f4f4f4', null, 'Reviva a glória do título de 1990 com esta camisa retrô em algodão premium e escudo da época.', array['P','M','G','GG','XGG'], 4.7, 96, 40, null, 3),
  ('cam-05', 'Camisa Goleiro 2026', 'camisas', 'jersey', 329.9, null, 148.45, '#1f8f4e', '#111111', null, 'Uniforme oficial de goleiro em verde, com proteção UV e recortes ergonômicos para o mergulho perfeito.', array['P','M','G','GG','XGG'], 4.6, 54, 3, null, 4),
  ('cam-06', 'Camisa Feminina Oficial I 2026', 'camisas', 'jersey', 339.9, 389.9, 152.95, '#ff6a00', '#111111', 'Baby look', 'Modelagem baby look feminina da camisa titular, com caimento ajustado e o mesmo tecido de alta performance.', array['P','M','G','GG','XGG'], 4.9, 203, 60, null, 5),
  ('aga-01', 'Jaqueta Corta-Vento Comissão Técnica', 'agasalhos', 'jacket', 429.9, 499.9, 193.45, '#111111', '#ff6a00', 'Mais vendido', 'A mesma jaqueta usada pela comissão técnica à beira do campo. Impermeável, com capuz e bolsos com zíper.', array['P','M','G','GG','XGG'], 4.8, 267, 12, null, 6),
  ('aga-02', 'Moletom Canguru Escudo Bordado', 'agasalhos', 'jacket', 279.9, null, 125.95, '#2b2b2b', '#ff6a00', null, 'Moletom flanelado com bolso canguru e escudo bordado no peito. Conforto para torcer em qualquer clima.', array['P','M','G','GG','XGG'], 4.7, 158, 33, null, 7),
  ('aga-03', 'Calça de Treino Oficial 2026', 'agasalhos', 'shorts', 249.9, null, 112.45, '#111111', '#f5b301', null, 'Calça de treino em tecido dry com punho ajustável e listras laterais nas cores do clube.', array['P','M','G','GG','XGG'], 4.6, 74, 5, null, 8),
  ('cal-01', 'Chuteira Society Martinica Pro', 'calcados', 'shoe', 459.9, 549.9, 206.95, '#ff6a00', '#111111', 'Oferta', 'Chuteira society com solado de borracha antiderrapante e cabedal leve. Aderência total no gramado sintético.', array['38','39','40','41','42','43','44'], 4.8, 132, 27, null, 9),
  ('cal-02', 'Tênis Casual Torcedor', 'calcados', 'shoe', 389.9, null, 175.45, '#111111', '#ff6a00', null, 'Tênis casual com solado confortável e detalhes nas cores do Martinica. Perfeito para o dia a dia.', array['38','39','40','41','42','43','44'], 4.5, 88, 9, null, 10),
  ('cal-03', 'Chinelo Slide Escudo', 'calcados', 'shoe', 119.9, 149.9, 53.96, '#ff6a00', '#f4f4f4', null, 'Chinelo slide com escudo em alto-relevo e palmilha macia. O queridinho da torcida para o verão.', array['38','39','40','41','42','43','44'], 4.7, 245, 48, null, 11),
  ('ace-01', 'Boné Aba Curva Oficial', 'acessorios', 'cap', 129.9, null, 58.46, '#ff6a00', '#111111', 'Mais vendido', 'Boné de aba curva com escudo bordado e ajuste traseiro. Um clássico para levar o clube em qualquer lugar.', null, 4.8, 312, 18, null, 12),
  ('ace-02', 'Cachecol Torcida Fanático', 'acessorios', 'scarf', 89.9, null, 40.46, '#ff6a00', '#111111', null, 'Cachecol de tricô com o nome do clube e escudo. Feito para cantar nas arquibancadas nos dias frios.', null, 4.9, 176, 0, null, 13),
  ('ace-03', 'Mochila Esportiva Martinica', 'acessorios', 'backpack', 219.9, 259.9, 98.95, '#111111', '#ff6a00', null, 'Mochila com compartimento para notebook, bolso térmico e alças acolchoadas. Resistente e cheia de estilo.', null, 4.6, 91, 21, null, 14),
  ('ace-04', 'Bola Oficial de Campo 2026', 'acessorios', 'ball', 199.9, null, 89.95, '#f4f4f4', '#ff6a00', 'Oficial', 'Bola oficial de campo, costurada, tamanho 5 e certificada. A mesma usada nos jogos em casa.', null, 4.9, 148, 14, null, 15),
  ('tor-01', 'Caneca Escudo 350ml', 'torcedor', 'mug', 59.9, null, 26.95, '#ff6a00', '#f4f4f4', null, 'Caneca de cerâmica com escudo do Martinica FC. Comece o dia com a energia da torcida.', null, 4.8, 421, 52, null, 16),
  ('tor-02', 'Garrafa Térmica 500ml', 'torcedor', 'mug', 99.9, 129.9, 44.96, '#111111', '#f5b301', 'Oferta', 'Garrafa térmica em inox que mantém a temperatura por até 12h. Leve o Martinica para todos os lugares.', null, 4.7, 133, 7, null, 17),
  ('tor-03', 'Bandeira Oficial 1,40m', 'torcedor', 'scarf', 79.9, null, 35.96, '#ff6a00', '#111111', null, 'Bandeira grande em tecido resistente para pendurar em casa ou levar ao estádio. Cores vivas e escudo central.', null, 4.9, 210, 30, null, 18),
  ('pet-01', 'Camisa Pet do Torcedor', 'pet', 'pet', 79.9, null, 35.96, '#ff6a00', '#111111', 'Fofura', 'Camisa para cães e gatos com o escudo do clube. Seu melhor amigo também é da Martinica!', array['PP','P','M','G'], 4.9, 187, 4, null, 19),
  ('pet-02', 'Bandana Pet Escudo', 'pet', 'pet', 44.9, 59.9, 20.2, '#111111', '#ff6a00', null, 'Bandana ajustável com o escudo do Martinica. Estilo e conforto para o pet mais torcedor da vizinhança.', array['P','M','G'], 4.8, 64, 6, null, 20)
on conflict (id) do update set
  name = excluded.name, category_id = excluded.category_id, kind = excluded.kind,
  price = excluded.price, old_price = excluded.old_price, cost = excluded.cost,
  color_main = excluded.color_main,
  color_accent = excluded.color_accent, badge = excluded.badge, description = excluded.description,
  sizes = excluded.sizes, rating = excluded.rating, reviews = excluded.reviews,
  stock = excluded.stock, sort = excluded.sort;

