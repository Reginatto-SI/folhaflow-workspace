-- Bloco 3 da fase 1 da Central de Folha:
-- recálculo backend mínimo e determinístico, sem motor completo de rubricas.
--
-- Objetivo: tirar da UI a responsabilidade do cálculo final e preparar evolução futura.
-- Limites intencionais: sem fórmula dinâmica, sem dependência entre rubricas,
-- sem classificação de rubricas no cálculo e sem alteração estrutural complexa.

-- Campos mínimos de saída calculada (simples) no modelo atual.
-- Mantidos no próprio payroll_entries para evitar estrutura nova complexa nesta fase.
alter table public.payroll_entries
  add column if not exists earnings_total numeric(12,2) not null default 0,
  add column if not exists deductions_total numeric(12,2) not null default 0,
  add column if not exists inss_amount numeric(12,2) not null default 0,
  add column if not exists net_salary numeric(12,2) not null default 0;

-- Função de recálculo mínimo por batch formal.
-- Esta função NÃO é o motor completo (PRD-01); é um passo incremental e previsível.
create or replace function public.recalculate_payroll_batch(p_batch_id uuid)
returns setof public.payroll_entries
language plpgsql
security definer
set search_path = public
as $$
declare
  _can_operate boolean;
begin
  -- Quando executada por migration (sem JWT), auth.uid() é null e o script deve conseguir
  -- recalcular o legado no backfill inicial.
  if auth.uid() is not null then
    _can_operate := public.has_permission(auth.uid(), 'folha.operar');
  else
    _can_operate := true;
  end if;

  if not _can_operate then
    raise exception 'Usuário sem permissão folha.operar para recalcular folha';
  end if;

  -- Cálculo determinístico mínimo com base no modelo JSONB atual:
  -- earnings_total = soma dos valores numéricos em earnings
  -- deductions_total = soma dos valores numéricos em deductions
  -- inss_amount = 8% de base_salary (regra simplificada desta fase)
  -- net_salary = earnings_total - deductions_total - inss_amount
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
      round(coalesce(pe.base_salary, 0)::numeric * 0.08, 2)::numeric(12,2) as inss_amount
    from public.payroll_entries pe
    where pe.payroll_batch_id = p_batch_id
  )
  update public.payroll_entries pe
  set
    earnings_total = n.earnings_total,
    deductions_total = n.deductions_total,
    inss_amount = n.inss_amount,
    net_salary = (n.earnings_total - n.deductions_total - n.inss_amount)::numeric(12,2)
  from normalized n
  where pe.id = n.id;

  return query
  select *
  from public.payroll_entries pe
  where pe.payroll_batch_id = p_batch_id
  order by pe.created_at desc;
end;
$$;

-- Backfill inicial conservador para batches já existentes.
-- Mantém previsibilidade sem depender da UI para materializar os campos calculados.
do $$
declare
  _batch record;
begin
  for _batch in
    select id from public.payroll_batches
  loop
    perform public.recalculate_payroll_batch(_batch.id);
  end loop;
end;
$$;
