-- Permite cadastro manual de funcionário sem CPF e sem data de admissão.
alter table public.employees
  alter column cpf drop not null,
  alter column admission_date drop not null;

alter table public.employees
  drop constraint if exists employees_cpf_format_chk,
  add constraint employees_cpf_format_chk
    check (
      cpf is null
      or (
        cpf ~ '^[0-9]{11}$'
        and cpf !~ '^(\d)\1{10}$'
      )
    ) not valid;

alter table public.employees
  drop constraint if exists employees_contratado_admission_date_chk;

create or replace function public.normalize_employee_fields()
returns trigger
language plpgsql
as $$
begin
  -- Comentário: CPF vazio vira null; CPF preenchido permanece somente com dígitos.
  new.cpf := nullif(regexp_replace(coalesce(new.cpf, ''), '\D', '', 'g'), '');

  -- Comentário: normalização textual mínima (trim + colapso de espaços) para reduzir lixo operacional.
  new.name := regexp_replace(trim(new.name), '\s+', ' ', 'g');
  new.registration := nullif(regexp_replace(trim(coalesce(new.registration, '')), '\s+', ' ', 'g'), '');
  new.notes := nullif(regexp_replace(trim(coalesce(new.notes, '')), '\s+', ' ', 'g'), '');
  new.department := nullif(regexp_replace(trim(coalesce(new.department, '')), '\s+', ' ', 'g'), '');
  new.role := nullif(regexp_replace(trim(coalesce(new.role, '')), '\s+', ' ', 'g'), '');
  new.bank_name := nullif(regexp_replace(trim(coalesce(new.bank_name, '')), '\s+', ' ', 'g'), '');
  new.bank_branch := nullif(regexp_replace(trim(coalesce(new.bank_branch, '')), '\s+', ' ', 'g'), '');
  new.bank_account := nullif(regexp_replace(trim(coalesce(new.bank_account, '')), '\s+', ' ', 'g'), '');
  new.bank_pix_key := nullif(regexp_replace(trim(coalesce(new.bank_pix_key, '')), '\s+', ' ', 'g'), '');

  return new;
end;
$$;
