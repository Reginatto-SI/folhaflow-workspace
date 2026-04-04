-- Fase 2.5: endurecimento cadastral com mudanças pequenas e seguras.
-- Objetivo: reforçar integridade estrutural sem refatorar arquitetura/autenticação.

-- 1) Normalização defensiva no banco para reduzir dependência exclusiva do front-end.
create or replace function public.normalize_employee_fields()
returns trigger
language plpgsql
as $$
begin
  -- Comentário: CPF é armazenado apenas com dígitos para alinhar com validação da UI e unicidade por empresa.
  new.cpf := regexp_replace(coalesce(new.cpf, ''), '\D', '', 'g');

  -- Comentário: normalização textual mínima (trim + colapso de espaços) para reduzir lixo operacional.
  new.name := regexp_replace(trim(new.name), '\s+', ' ', 'g');
  new.registration := nullif(regexp_replace(trim(coalesce(new.registration, '')), '\s+', ' ', 'g'), '');
  new.notes := nullif(regexp_replace(trim(coalesce(new.notes, '')), '\s+', ' ', 'g'), '');
  new.department := nullif(regexp_replace(trim(coalesce(new.department, '')), '\s+', ' ', 'g'), '');
  new.role := nullif(regexp_replace(trim(coalesce(new.role, '')), '\s+', ' ', 'g'), '');
  new.bank_name := nullif(regexp_replace(trim(coalesce(new.bank_name, '')), '\s+', ' ', 'g'), '');
  new.bank_branch := nullif(regexp_replace(trim(coalesce(new.bank_branch, '')), '\s+', ' ', 'g'), '');
  new.bank_account := nullif(regexp_replace(trim(coalesce(new.bank_account, '')), '\s+', ' ', 'g'), '');

  return new;
end;
$$;

drop trigger if exists normalize_employees_fields on public.employees;
create trigger normalize_employees_fields
before insert or update on public.employees
for each row execute function public.normalize_employee_fields();

-- 2) Constraints NOT VALID: protegem novos writes sem travar migração por legado.
-- Decisão CPF: manter unicidade no escopo da empresa (já existe unique(company_id, cpf)),
-- sem impor unicidade global para evitar bloquear cenários operacionais legítimos multiempresa.
alter table public.employees
  add constraint employees_cpf_format_chk
  check (
    cpf ~ '^[0-9]{11}$'
    and cpf !~ '^(\d)\1{10}$'
  ) not valid;

alter table public.employees
  add constraint employees_name_not_blank_chk
  check (btrim(name) <> '') not valid;

-- Decisão matrícula: opcional nesta fase, porém sem aceitar valor vazio disfarçado.
alter table public.employees
  add constraint employees_registration_not_blank_chk
  check (registration is null or btrim(registration) <> '') not valid;

-- Consistência de conta bancária: ou todos os dados bancários são nulos, ou os três são informados.
alter table public.employees
  add constraint employees_bank_triplet_chk
  check (
    (bank_name is null and bank_branch is null and bank_account is null)
    or
    (bank_name is not null and bank_branch is not null and bank_account is not null)
  ) not valid;

-- Regras leves de tamanho para evitar lixo textual em campos bancários.
alter table public.employees
  add constraint employees_bank_lengths_chk
  check (
    (bank_name is null or char_length(bank_name) >= 2)
    and (bank_branch is null or char_length(bank_branch) >= 2)
    and (bank_account is null or char_length(bank_account) >= 3)
  ) not valid;

-- 3) Índice de apoio para evolução/consulta por matrícula no contexto da empresa.
-- Sem unicidade nesta fase para não impor rigidez indevida em operações legadas.
create index if not exists employees_company_registration_idx
  on public.employees (company_id, registration)
  where registration is not null;

-- 4) RLS: mantido permissivo por ausência de base de auth/tenant confiável no app atual.
-- Decisão proposital para evitar endurecimento artificial que quebraria fluxo existente.
