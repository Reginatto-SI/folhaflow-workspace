-- PRD-09 + PRD-12: blindagem técnica da duplicação para impedir cópia de rubricas derivadas canônicas.
-- Esta função é a camada de proteção backend: mesmo com payload inválido/origem contaminada,
-- os códigos canônicos derivados nunca são persistidos na folha duplicada.

create or replace function public.duplicate_payroll_batch(
  p_source_batch_id uuid,
  p_target_company_id uuid,
  p_target_month integer,
  p_target_year integer
)
returns setof public.payroll_entries
language plpgsql
security definer
set search_path = public
as $$
declare
  _can_operate boolean;
  _source_batch public.payroll_batches%rowtype;
  _target_batch_id uuid;
  _derived_rubrica_ids text[];
begin
  -- Gate de permissão alinhado ao fluxo operacional da folha.
  _can_operate := true;
  if auth.uid() is not null then
    _can_operate := public.has_permission(auth.uid(), 'folha.operar');
  end if;

  if not _can_operate then
    raise exception 'Usuário sem permissão folha.operar para duplicar folha';
  end if;

  if p_target_month < 1 or p_target_month > 12 then
    raise exception 'Competência inválida para duplicação (mês fora de 1..12)';
  end if;

  select *
    into _source_batch
  from public.payroll_batches pb
  where pb.id = p_source_batch_id;

  if not found then
    raise exception 'Folha origem não encontrada para duplicação';
  end if;

  if exists (
    select 1
    from public.payroll_batches pb
    where pb.company_id = p_target_company_id
      and pb.month = p_target_month
      and pb.year = p_target_year
  ) then
    raise exception 'Já existe folha para a empresa/competência de destino';
  end if;

  insert into public.payroll_batches (company_id, month, year, status)
  values (p_target_company_id, p_target_month, p_target_year, 'draft')
  returning id into _target_batch_id;

  select coalesce(array_agg(r.id::text), array[]::text[])
    into _derived_rubrica_ids
  from public.rubricas r
  where r.nature = 'calculada'
    and lower(r.code) = any (array['salario_real', 'g2_complemento', 'salario_liquido']);

  -- Rubricas derivadas NÃO são duplicadas.
  -- Esses valores são sempre recalculados pelo motor.
  -- Regra definida nos PRD-09 e PRD-12.
  return query
  with source_entries as (
    select pe.*
    from public.payroll_entries pe
    where pe.payroll_batch_id = p_source_batch_id
  ),
  sanitized as (
    select
      se.employee_id,
      se.base_salary,
      se.notes,
      coalesce(se.earnings::jsonb, '{}'::jsonb) - _derived_rubrica_ids as earnings_sanitized,
      coalesce(se.deductions::jsonb, '{}'::jsonb) - _derived_rubrica_ids as deductions_sanitized
    from source_entries se
  )
  insert into public.payroll_entries (
    payroll_batch_id,
    employee_id,
    company_id,
    month,
    year,
    base_salary,
    earnings,
    deductions,
    earnings_total,
    deductions_total,
    inss_amount,
    net_salary,
    notes
  )
  select
    _target_batch_id,
    s.employee_id,
    p_target_company_id,
    p_target_month,
    p_target_year,
    s.base_salary,
    s.earnings_sanitized,
    s.deductions_sanitized,
    0,
    0,
    0,
    0,
    s.notes
  from sanitized s
  returning *;
end;
$$;

comment on function public.duplicate_payroll_batch(uuid, uuid, integer, integer)
is 'Duplica folha ignorando rubricas derivadas canônicas (salario_real, g2_complemento, salario_liquido). Valores devem ser recalculados pelo motor.';
