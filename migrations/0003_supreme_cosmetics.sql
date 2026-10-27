-- Ratopolis: coleção de 16 cosméticos SUPREMO.
-- Idempotente: pode ser reaplicada sem duplicar os códigos.
INSERT INTO ratopolis_item_registry (code,name,category,item_type,source,description,active,updated_at) VALUES
('skinCaramelSupremo','Pelagem Caramelo Suprema','Skins','Skin','Loja','Pelagem caramelo especial da linha Supremo.',1,datetime('now')),
('skinMidnightSupremo','Pelagem Meia-Noite Suprema','Skins','Skin','Loja','Pelagem escura com identidade Supremo.',1,datetime('now')),
('skinSnowSupremo','Pelagem Neve Suprema','Skins','Skin','Loja','Pelagem clara e rara da linha Supremo.',1,datetime('now')),
('skinAuroraSupremo','Pelagem Aurora Suprema','Skins','Skin','Loja','Visual colorido inspirado na aurora.',1,datetime('now')),
('supremeJacket','Jaqueta Suprema','Roupas','Roupa','Loja','Jaqueta cosmética exclusiva da linha Supremo.',1,datetime('now')),
('supremeScarf','Cachecol Supremo','Roupas','Roupa','Loja','Cachecol especial com acabamento Supremo.',1,datetime('now')),
('supremeCape','Capa Suprema','Roupas','Roupa','Loja','Capa visual de raridade Supremo.',1,datetime('now')),
('supremeBackpack','Mochila Suprema','Mochilas','Mochila','Loja','Mochila cosmética de raridade Supremo.',1,datetime('now')),
('supremeHelmet','Capacete Supremo','Chapéus','Chapéu','Loja','Capacete visual da linha Supremo.',1,datetime('now')),
('supremeCrown','Coroa Suprema','Chapéus','Chapéu','Loja','Coroa brilhante de raridade Supremo.',1,datetime('now')),
('supremeWizard','Chapéu Arcano Supremo','Chapéus','Chapéu','Loja','Chapéu mágico com identidade Supremo.',1,datetime('now')),
('supremeHorns','Chifres Supremos','Chapéus','Chapéu','Loja','Chifres cosméticos exclusivos.',1,datetime('now')),
('supremeHalo','Halo Supremo','Cosméticos','Aura','Loja','Halo luminoso da coleção Supremo.',1,datetime('now')),
('supremeWings','Asas Supremas','Cosméticos','Asas','Loja','Asas visuais raras da linha Supremo.',1,datetime('now')),
('supremeAura','Aura Suprema','Cosméticos','Aura','Loja','Aura energética para destacar o personagem.',1,datetime('now')),
('supremeFlame','Chamas Supremas','Cosméticos','Efeito','Loja','Efeito visual de chamas da coleção Supremo.',1,datetime('now'))
ON CONFLICT(code) DO UPDATE SET name=excluded.name,category=excluded.category,item_type=excluded.item_type,source=excluded.source,description=excluded.description,active=1,updated_at=datetime('now');

INSERT INTO ratopolis_store_catalog (code,name,description,category,price_coins,item_payload,active,sort_order,updated_at) VALUES
('skinCaramelSupremo','Pelagem Caramelo Suprema','Pelagem caramelo especial da linha Supremo.','cosmetic',180,'{"type":"hat","hatId":"skinCaramelSupremo","icon":"🐹","wardrobeCategory":"Skins","rarity":"Supremo","skinColor":"#c88b52"}',1,200,datetime('now')),
('skinMidnightSupremo','Pelagem Meia-Noite Suprema','Pelagem escura com identidade Supremo.','cosmetic',190,'{"type":"hat","hatId":"skinMidnightSupremo","icon":"🌑","wardrobeCategory":"Skins","rarity":"Supremo","skinColor":"#55506f"}',1,201,datetime('now')),
('skinSnowSupremo','Pelagem Neve Suprema','Pelagem clara e rara da linha Supremo.','cosmetic',190,'{"type":"hat","hatId":"skinSnowSupremo","icon":"❄️","wardrobeCategory":"Skins","rarity":"Supremo","skinColor":"#f0eee5"}',1,202,datetime('now')),
('skinAuroraSupremo','Pelagem Aurora Suprema','Visual colorido inspirado na aurora.','cosmetic',220,'{"type":"hat","hatId":"skinAuroraSupremo","icon":"🌌","wardrobeCategory":"Skins","rarity":"Supremo","skinColor":"#cf8acb"}',1,203,datetime('now')),
('supremeJacket','Jaqueta Suprema','Jaqueta cosmética exclusiva da linha Supremo.','cosmetic',160,'{"type":"hat","hatId":"supremeJacket","icon":"🧥","wardrobeCategory":"Roupas","rarity":"Supremo"}',1,204,datetime('now')),
('supremeScarf','Cachecol Supremo','Cachecol especial com acabamento Supremo.','cosmetic',145,'{"type":"hat","hatId":"supremeScarf","icon":"🧣","wardrobeCategory":"Roupas","rarity":"Supremo"}',1,205,datetime('now')),
('supremeCape','Capa Suprema','Capa visual de raridade Supremo.','cosmetic',240,'{"type":"hat","hatId":"supremeCape","icon":"🦸","wardrobeCategory":"Roupas","rarity":"Supremo"}',1,206,datetime('now')),
('supremeBackpack','Mochila Suprema','Mochila cosmética de raridade Supremo.','cosmetic',175,'{"type":"hat","hatId":"supremeBackpack","icon":"🎒","wardrobeCategory":"Mochilas","rarity":"Supremo"}',1,207,datetime('now')),
('supremeHelmet','Capacete Supremo','Capacete visual da linha Supremo.','cosmetic',155,'{"type":"hat","hatId":"supremeHelmet","icon":"🪖","wardrobeCategory":"Chapéus","rarity":"Supremo"}',1,208,datetime('now')),
('supremeCrown','Coroa Suprema','Coroa brilhante de raridade Supremo.','cosmetic',280,'{"type":"hat","hatId":"supremeCrown","icon":"👑","wardrobeCategory":"Chapéus","rarity":"Supremo"}',1,209,datetime('now')),
('supremeWizard','Chapéu Arcano Supremo','Chapéu mágico com identidade Supremo.','cosmetic',230,'{"type":"hat","hatId":"supremeWizard","icon":"🧙","wardrobeCategory":"Chapéus","rarity":"Supremo"}',1,210,datetime('now')),
('supremeHorns','Chifres Supremos','Chifres cosméticos exclusivos.','cosmetic',210,'{"type":"hat","hatId":"supremeHorns","icon":"😈","wardrobeCategory":"Chapéus","rarity":"Supremo"}',1,211,datetime('now')),
('supremeHalo','Halo Supremo','Halo luminoso da coleção Supremo.','cosmetic',260,'{"type":"hat","hatId":"supremeHalo","icon":"🌟","wardrobeCategory":"Acessórios","rarity":"Supremo"}',1,212,datetime('now')),
('supremeWings','Asas Supremas','Asas visuais raras da linha Supremo.','cosmetic',320,'{"type":"hat","hatId":"supremeWings","icon":"🪽","wardrobeCategory":"Acessórios","rarity":"Supremo"}',1,213,datetime('now')),
('supremeAura','Aura Suprema','Aura energética para destacar o personagem.','cosmetic',300,'{"type":"hat","hatId":"supremeAura","icon":"💎","wardrobeCategory":"Acessórios","rarity":"Supremo"}',1,214,datetime('now')),
('supremeFlame','Chamas Supremas','Efeito visual de chamas da coleção Supremo.','cosmetic',340,'{"type":"hat","hatId":"supremeFlame","icon":"🔥","wardrobeCategory":"Acessórios","rarity":"Supremo"}',1,215,datetime('now'))
ON CONFLICT(code) DO UPDATE SET name=excluded.name,description=excluded.description,category=excluded.category,price_coins=excluded.price_coins,item_payload=excluded.item_payload,active=1,sort_order=excluded.sort_order,updated_at=datetime('now');
