-- Correção mínima da regra INSS manual (PRD-01 / PRD-02):
-- 1) recálculo NÃO calcula INSS automaticamente
-- 2) `inss_amount` permanece apenas como espelho do valor manual persistido em descontos
-- 3) líquido passa a usar somente descontos operacionais consolidados

create or replace function public.recalculate_payroll_batch(p_batch_id uuid)
returns setof public.payroll_entries
language plpgsql
security definer
set search_path = public
as $$
declare
  _can_operate boolean;
begin
  -- Preserva gate de permissão existente do fluxo operacional de folha.
  if auth.uid() is not null then
    _can_operate := public.has_permission(auth.uid(), 'folha.operar');
  else
    _can_operate := true;
  end if;

  if not _can_operate then
    raise exception 'Usuário sem permissão folha.operar para recalcular folha';
  end if;

  with inss_keys as (
    -- Compatibilidade: identifica rubricas classificadas como INSS por id técnico.
    select coalesce(array_agg(r.id::text), '{}'::text[]) as rubric_ids
    from public.rubricas r
    where r.classification = 'inss'
  ),
  normalized as (
    select
      pe.id,
      coalesce(
        (
          select sum(
            case
              when jsonb_typeof(e.value) = 'number' then (e.value #>> '{}')::numeric
              when jsonb_typeof(e.value) = 'string' and (e.value #>> '{}') ~ '^-?\d+(\.\d+)?$' then (e.value #>> '{}')::numeric
              else 0
            end
          )
          from jsonb_each(coalesce(pe.earnings, '{}'::jsonb)) as e
        ),
        0
      )::numeric(12,2) as earnings_total,
      coalesce(
        (
          select sum(
            case
              when jsonb_typeof(d.value) = 'number' then (d.value #>> '{}')::numeric
              when jsonb_typeof(d.value) = 'string' and (d.value #>> '{}') ~ '^-?\d+(\.\d+)?$' then (d.value #>> '{}')::numeric
              else 0
            end
          )
          from jsonb_each(coalesce(pe.deductions, '{}'::jsonb)) as d
        ),
        0
      )::numeric(12,2) as deductions_total,
      coalesce(
        (
          select sum(
            case
              when (d.key = any(ik.rubric_ids) or lower(d.key) = 'inss')
                and jsonb_typeof(d.value) = 'number'
                then (d.value #>> '{}')::numeric
              when (d.key = any(ik.rubric_ids) or lower(d.key) = 'inss')
                and jsonb_typeof(d.value) = 'string'
                and (d.value #>> '{}') ~ '^-?\d+(\.\d+)?$'
                then (d.value #>> '{}')::numeric
              else 0
            end
          )
          from jsonb_each(coalesce(pe.deductions, '{}'::jsonb)) as d
        ),
        0
      )::numeric(12,2) as inss_amount
    from public.payroll_entries pe
    cross join inss_keys ik
    where pe.payroll_batch_id = p_batch_id
  )
  update public.payroll_entries pe
  set
    earnings_total = n.earnings_total,
    deductions_total = n.deductions_total,
    inss_amount = n.inss_amount,
    net_salary = (n.earnings_total - n.deductions_total)::numeric(12,2)
  from normalized n
  where pe.id = n.id;

  return query
  select *
  from public.payroll_entries pe
  where pe.payroll_batch_id = p_batch_id
  order by pe.created_at desc;
end;
$$;

-- Defesa em profundidade no cadastro: `classification = inss` exige contrato manual operacional.
alter table public.rubricas
  drop constraint if exists rubricas_inss_manual_rule;

alter table public.rubricas
  add constraint rubricas_inss_manual_rule
  check (
    classification is distinct from 'inss'
    or (
      type = 'desconto'
      and nature = 'base'
      and calculation_method = 'manual'
    )
  ) not valid;

-- Reprocessa batches com a nova regra para remover cálculo automático legado de INSS.
do $$
declare
  _batch record;
begin
  for _batch in select id from public.payroll_batches loop
    perform public.recalculate_payroll_batch(_batch.id);
  end loop;
end;
$$;
