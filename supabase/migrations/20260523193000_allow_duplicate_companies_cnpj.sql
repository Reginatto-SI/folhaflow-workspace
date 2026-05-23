-- Permite CPF/CNPJ repetido para empresas/estruturas gerenciais distintas no Folha App.
-- Mantemos apenas remoção de unicidade; sem alterar obrigatoriedade nem formato do campo.
-- Segurança extra: remove tanto constraint unique quanto índices únicos legados no campo cnpj.
alter table public.companies drop constraint if exists companies_cnpj_key;
drop index if exists public.companies_cnpj_key;
drop index if exists public.companies_cnpj_unique;
