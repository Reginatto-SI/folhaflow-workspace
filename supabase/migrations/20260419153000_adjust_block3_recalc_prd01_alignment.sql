-- Ajuste cirúrgico do Bloco 3:
-- alinha recalculate_payroll_batch à ordem mínima do PRD-01 sem virar motor completo.
--
-- Mantém estrutura incremental já criada (blocos 1/2/3):
-- - payroll_batches + payroll_batch_id
-- - campos materializados existentes em payroll_entries
-- - função recalculate_payroll_batch (mesmo nome/contrato)

create or replace function public.recalculate_payroll_batch(p_batch_id uuid)
returns setof public.payroll_entries
language plpgsql
security definer
set search_path = public
as $$
declare
  _can_operate boolean;
begin
  -- Preserva regra de permissão do bloco 3/segurança:
  -- somente `folha.operar` recalcula em runtime (migration sem JWT continua permitida).
  if auth.uid() is not null then
    _can_operate := public.has_permission(auth.uid(), 'folha.operar');
  else
    _can_operate := true;
  end if;

  if not _can_operate then
    raise exception 'Usuário sem permissão folha.operar para recalcular folha';
  end if;

  -- Bloco 3 (ajuste PRD-01): separação explícita entre base fiscal e base gerencial.
  -- Não é motor completo: usa contrato transitório mínimo por chaves técnicas do JSONB:
  --   1) Base fiscal: salario_fiscal > salario_ctps > base_salary (fallback)
  --   2) Encargos: INSS calculado APENAS sobre base fiscal
  --   3) Base gerencial: soma de earnings (proventos operacionais)
  --   4) Descontos: soma de deductions
  --   5) Líquido: earnings_total - deductions_total - inss_amount
  with normalized as (
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
        case
          when coalesce(pe.earnings, '{}'::jsonb) ? 'salario_fiscal' then
            case
              when jsonb_typeof(pe.earnings->'salario_fiscal') = 'number' then (pe.earnings->>'salario_fiscal')::numeric
              when jsonb_typeof(pe.earnings->'salario_fiscal') = 'string' and (pe.earnings->>'salario_fiscal') ~ '^-?\d+(\.\d+)?$' then (pe.earnings->>'salario_fiscal')::numeric
              else null
            end
          when coalesce(pe.earnings, '{}'::jsonb) ? 'salario_ctps' then
            case
              when jsonb_typeof(pe.earnings->'salario_ctps') = 'number' then (pe.earnings->>'salario_ctps')::numeric
              when jsonb_typeof(pe.earnings->'salario_ctps') = 'string' and (pe.earnings->>'salario_ctps') ~ '^-?\d+(\.\d+)?$' then (pe.earnings->>'salario_ctps')::numeric
              else null
            end
          else null
        end,
        coalesce(pe.base_salary, 0)::numeric
      )::numeric(12,2) as fiscal_base
    from public.payroll_entries pe
    where pe.payroll_batch_id = p_batch_id
  )
  update public.payroll_entries pe
  set
    earnings_total = n.earnings_total,
    deductions_total = n.deductions_total,
    inss_amount = round(n.fiscal_base * 0.08, 2)::numeric(12,2),
    net_salary = (n.earnings_total - n.deductions_total - round(n.fiscal_base * 0.08, 2))::numeric(12,2)
  from normalized n
  where pe.id = n.id;

  return query
  select *
  from public.payroll_entries pe
  where pe.payroll_batch_id = p_batch_id
  order by pe.created_at desc;
end;
$$;

-- Reprocessa batches existentes com a nova ordem lógica mínima (PRD-01 transitório).
do $$
declare
  _batch record;
begin
  for _batch in select id from public.payroll_batches loop
    perform public.recalculate_payroll_batch(_batch.id);
  end loop;
end;
$$;
