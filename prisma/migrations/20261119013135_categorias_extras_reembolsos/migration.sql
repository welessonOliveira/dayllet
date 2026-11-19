-- Categorias de receita novas pros usuários que já existem (usuário novo ganha pelo setupNewUser).
-- "Extras": Pix de amigo, favor, presente. "Reembolsos": estorno e devolução.
-- Quem já tem uma categoria com o mesmo nome fica como está.
INSERT INTO "Category" ("id", "userId", "name", "type", "color", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, u."id", c."name", 'INCOME'::"CategoryType", c."color", now(), now()
FROM "User" u
CROSS JOIN (VALUES ('Extras', '#65a30d'), ('Reembolsos', '#0891b2')) AS c("name", "color")
ON CONFLICT ("userId", "name") DO NOTHING;
