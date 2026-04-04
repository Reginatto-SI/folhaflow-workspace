-- Fase 5: alinhar cadastro-base de funcionário com conceito de grupo empresarial.
-- Decisão: company_id continua tecnicamente no schema para menor mudança,
-- mas passa a representar explicitamente a EMPRESA REGISTRADA do colaborador.

alter table public.employees
  add column if not exists work_card_number text;

comment on column public.employees.company_id is
  'Empresa registrada do colaborador. Participação em folhas de outras empresas do grupo será modelada em estrutura própria futura.';

comment on column public.employees.work_card_number is
  'Número da carteira de trabalho (cadastro-base de RH).';

alter table public.employees
  add constraint employees_work_card_not_blank_chk
  check (work_card_number is null or btrim(work_card_number) <> '') not valid;
