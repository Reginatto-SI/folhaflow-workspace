-- Controle operacional simples de conferência por funcionário na Central de Folha.
-- Campo visual/operacional: NÃO participa de cálculo, recibos ou relatórios.
alter table public.payroll_entries
  add column if not exists conferido boolean not null default false;
