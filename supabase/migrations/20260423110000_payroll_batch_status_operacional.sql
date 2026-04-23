-- Ajuste mínimo: status operacional explícito da folha na Central.
-- Estados válidos: em_edicao, em_revisao e finalizado.

do $$
declare
  _constraint record;
begin
  -- Comentário: remove qualquer CHECK legado relacionado à coluna status
  -- para garantir recriação única da regra final.
  for _constraint in
    select c.conname
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'payroll_batches'
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) ilike '%status%'
  loop
    execute format('alter table public.payroll_batches drop constraint if exists %I', _constraint.conname);
  end loop;
end
$$;

update public.payroll_batches
set status = 'em_edicao'
where status = 'draft';

alter table public.payroll_batches
  alter column status set default 'em_edicao';

alter table public.payroll_batches
  add constraint payroll_batches_status_check
  check (status in ('em_edicao', 'em_revisao', 'finalizado'));
