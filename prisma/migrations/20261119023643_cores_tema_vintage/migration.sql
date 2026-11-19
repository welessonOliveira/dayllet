-- Tema Vintage Paper: o roxo padrão (#7c3aed) de categorias e metas vira caramelo.
-- Só muda quem ainda está com a cor padrão; cor escolhida pelo usuário fica como está.
UPDATE "Category" SET "color" = '#a67c52', "updatedAt" = now() WHERE lower("color") = '#7c3aed';
UPDATE "Goal" SET "color" = '#a67c52' WHERE lower("color") = '#7c3aed';
