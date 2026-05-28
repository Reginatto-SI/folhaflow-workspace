-- PRD-01/03/12: corrige a origem declarativa da canônica salario_liquido.
-- Escopo intencionalmente restrito: só ajusta a fórmula quando o cadastro legado está
-- exatamente como no bug observado (salario_liquido = salario_fiscal). Não altera
-- payroll_entries/net_salary existentes; ao salvar novamente pelo drawer, o frontend
-- persiste o líquido recalculado pela mesma canônica usada na Central/recibos/relatórios.
do $$
declare
  _salario_liquido_id uuid;
  _salario_fiscal_id uuid;
  _current_item_count integer;
  _current_formula_is_only_fiscal boolean;
  _next_order integer := 1;
  _source record;
begin
  select r.id
    into _salario_liquido_id
  from public.rubricas r
  where r.is_active = true
    and r.nature = 'calculada'
    and lower(r.code) = 'salario_liquido'
  order by r.id
  limit 1;

  if _salario_liquido_id is null then
    return;
  end if;

  -- Identificação por código técnico normalizado, nunca por nome/label visual.
  select r.id
    into _salario_fiscal_id
  from public.rubricas r
  where r.is_active = true
    and r.nature = 'base'
    and r.type = 'provento'
    and regexp_replace(lower(r.code), '[.\-_/]+', ' ', 'g') in ('salario fiscal', 'sal fiscal')
  order by r.display_order, r.id
  limit 1;

  if _salario_fiscal_id is null then
    return;
  end if;

  select count(*),
         bool_and(fi.operation = 'add' and fi.source_rubrica_id = _salario_fiscal_id)
    into _current_item_count, _current_formula_is_only_fiscal
  from public.rubrica_formula_items fi
  where fi.rubrica_id = _salario_liquido_id;

  -- Segurança: não sobrescreve fórmulas já customizadas/corrigidas pelo usuário.
  if _current_item_count <> 1 or coalesce(_current_formula_is_only_fiscal, false) = false then
    return;
  end if;

  delete from public.rubrica_formula_items
  where rubrica_id = _salario_liquido_id;

  insert into public.rubrica_formula_items (rubrica_id, operation, source_rubrica_id, item_order)
  values (_salario_liquido_id, 'add', _salario_fiscal_id, _next_order);
  _next_order := _next_order + 1;

  for _source in
    select r.id,
           r.type,
           r.display_order
    from public.rubricas r
    where r.is_active = true
      and r.nature = 'base'
      and r.id <> _salario_fiscal_id
      and (
        (
          r.type = 'provento'
          and r.classification in ('outros_rendimentos', 'horas_extras', 'salario_familia', 'ferias_terco', 'insalubridade')
        )
        or (
          r.type = 'desconto'
          and r.classification in ('inss', 'emprestimos', 'adiantamentos', 'vales', 'faltas')
        )
      )
    order by case when r.type = 'provento' then 0 else 1 end,
             r.display_order,
             r.id
  loop
    insert into public.rubrica_formula_items (rubrica_id, operation, source_rubrica_id, item_order)
    values (
      _salario_liquido_id,
      case when _source.type = 'desconto' then 'subtract' else 'add' end,
      _source.id,
      _next_order
    );
    _next_order := _next_order + 1;
  end loop;
end $$;
