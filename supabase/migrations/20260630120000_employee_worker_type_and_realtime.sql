-- Modalidade operacional simples do funcionário, sem afetar cálculo de folha.
alter table public.employees
  add column if not exists worker_type text not null default 'contratado';

-- Comentário: ao adicionar uma coluna NOT NULL com default, bases existentes recebem 'contratado'.
-- Por isso a normalização precisa considerar is_monthly=true antes da constraint de sincronia.
update public.employees
set worker_type = case
  when worker_type = 'diarista' then 'diarista'
  when is_monthly then 'mensalista'
  when worker_type = 'mensalista' then 'mensalista'
  else 'contratado'
end
where worker_type is null
   or worker_type not in ('contratado', 'diarista', 'mensalista')
   or is_monthly <> (worker_type = 'mensalista');

update public.employees
set is_monthly = (worker_type = 'mensalista')
where is_monthly <> (worker_type = 'mensalista');

alter table public.employees
  alter column admission_date drop not null;

alter table public.employees
  drop constraint if exists employees_worker_type_chk,
  add constraint employees_worker_type_chk
    check (worker_type in ('contratado', 'diarista', 'mensalista'));

alter table public.employees
  drop constraint if exists employees_contratado_admission_date_chk,
  add constraint employees_contratado_admission_date_chk
    check (worker_type <> 'contratado' or admission_date is not null);

alter table public.employees
  drop constraint if exists employees_worker_type_is_monthly_sync_chk,
  add constraint employees_worker_type_is_monthly_sync_chk
    check (is_monthly = (worker_type = 'mensalista'));

comment on column public.employees.worker_type is
  'Modalidade operacional cadastral: contratado, diarista ou mensalista. Não define cálculo nem valores de folha.';

create or replace function public.sync_employee_legacy_is_monthly()
returns trigger
language plpgsql
as $$
begin
  -- Comentário: worker_type é a fonte; is_monthly permanece apenas como compatibilidade legada.
  new.is_monthly := new.worker_type = 'mensalista';
  return new;
end;
$$;

drop trigger if exists sync_employee_legacy_is_monthly on public.employees;
create trigger sync_employee_legacy_is_monthly
before insert or update on public.employees
for each row execute function public.sync_employee_legacy_is_monthly();

-- Garante eventos realtime somente nas tabelas de cadastro/folha já protegidas por RLS nas leituras.
do $$
declare
  realtime_table text;
begin
  foreach realtime_table in array array['companies', 'employees', 'departments', 'job_roles', 'rubricas'] loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = realtime_table
    ) then
      execute format('alter publication supabase_realtime add table public.%I', realtime_table);
    end if;
  end loop;
end $$;
