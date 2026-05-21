-- Folhas arquivadas ficam fora da operação: permitimos nova folha ativa
-- na mesma empresa+competência sem apagar histórico arquivado.

-- payroll_batches: remove unicidade global e aplica unicidade apenas para folhas ativas.
alter table public.payroll_batches
  drop constraint if exists payroll_batches_company_month_year_unique;

drop index if exists payroll_batches_company_month_year_unique;

drop index if exists payroll_batches_company_month_year_idx;

do $$
begin
  if exists (
    select 1
    from public.payroll_batches pb
    where pb.is_archived = false
    group by pb.company_id, pb.month, pb.year
    having count(*) > 1
  ) then
    raise exception 'Existem folhas ativas duplicadas por empresa+competência; corrigir dados antes desta migration.';
  end if;
end $$;


create unique index if not exists payroll_batches_company_month_year_active_unique
  on public.payroll_batches (company_id, month, year)
  where is_archived = false;

create index if not exists payroll_batches_company_month_year_idx
  on public.payroll_batches (company_id, month, year);

-- payroll_entries: evita conflito ao reprocessar competência após arquivamento,
-- mantendo 1 lançamento por funcionário dentro de cada folha (batch).
alter table public.payroll_entries
  drop constraint if exists payroll_entries_company_month_year_employee_unique;

drop index if exists payroll_entries_company_month_year_employee_unique;

create unique index if not exists payroll_entries_batch_employee_unique
  on public.payroll_entries (payroll_batch_id, employee_id)
  where payroll_batch_id is not null;
