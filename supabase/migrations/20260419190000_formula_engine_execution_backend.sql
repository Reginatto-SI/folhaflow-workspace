-- Motor de execução de fórmulas (PRD-01/PRD-02)
-- Objetivo: evoluir o recálculo oficial para executar rubricas calculadas por fórmula
-- sem hardcode por nome de rubrica e sem cálculo na UI.

-- Normaliza leitura numérica de qualquer valor JSONB.
-- Regra de segurança: valor presente porém inválido NÃO vira zero silenciosamente.
create or replace function public.payroll_parse_jsonb_numeric(p_value jsonb)
returns numeric
language plpgsql
immutable
as $$
declare
  v_text text;
begin
  if p_value is null then
    return 0;
  end if;

  if jsonb_typeof(p_value) = 'number' then
    return coalesce((p_value #>> '{}')::numeric, 0);
  end if;

  if jsonb_typeof(p_value) = 'string' then
    v_text := replace(trim(both from (p_value #>> '{}')), ',', '.');
    if v_text ~ '^-?\d+(\.\d+)?$' then
      return v_text::numeric;
    end if;
    raise exception 'Valor numérico inválido no payload: "%"', (p_value #>> '{}');
  end if;

  raise exception 'Tipo de valor inválido no payload para cálculo de folha: %', jsonb_typeof(p_value);
end;
$$;

-- Leitura compatível de valor da rubrica no payload: prioriza chave técnica por id
-- e usa código como fallback de transição. Não usa nome de rubrica.
create or replace function public.payroll_extract_payload_value(
  p_payload jsonb,
  p_rubrica_id uuid,
  p_rubrica_code text
)
returns numeric
language plpgsql
stable
as $$
declare
  v_pair record;
  v_id_key text := p_rubrica_id::text;
begin
  if p_payload is null then
    return 0;
  end if;

  if p_payload ? v_id_key then
    return public.payroll_parse_jsonb_numeric(p_payload -> v_id_key);
  end if;

  -- Compat legado mínimo: permite chave por código canônico (case-insensitive).
  for v_pair in
    select key, value
    from jsonb_each(p_payload)
  loop
    if lower(v_pair.key) = lower(p_rubrica_code) then
      return public.payroll_parse_jsonb_numeric(v_pair.value);
    end if;
  end loop;

  return 0;
end;
$$;

-- Avaliador seguro de expressão matemática com suporte a +, -, *, / e parênteses.
-- A expressão só aceita identificadores técnicos (tokens) e operadores permitidos.
create or replace function public.payroll_eval_formula_expression(
  p_expression text,
  p_values jsonb,
  p_context text
)
returns numeric
language plpgsql
stable
as $$
declare
  v_expression text;
  v_token record;
  v_value numeric;
  v_result numeric;
begin
  v_expression := trim(coalesce(p_expression, ''));
  if v_expression = '' then
    raise exception 'Fórmula vazia em %', coalesce(p_context, 'contexto desconhecido');
  end if;

  -- Segurança: bloqueia qualquer caractere fora do conjunto permitido.
  if v_expression ~ '[^A-Za-z0-9_+\-*/().,\s]' then
    raise exception 'Fórmula inválida em %: caractere não permitido', coalesce(p_context, 'contexto desconhecido');
  end if;

  v_expression := replace(v_expression, ',', '.');

  -- Resolve identificadores pela tabela de valores já carregada (operacionais + derivadas calculadas).
  for v_token in
    select distinct m[1] as token
    from regexp_matches(v_expression, '([A-Za-z_][A-Za-z0-9_]*)', 'g') as m
  loop
    if p_values ? v_token.token then
      v_value := (p_values ->> v_token.token)::numeric;
    else
      raise exception 'Fórmula inválida em %: referência inexistente "%"', coalesce(p_context, 'contexto desconhecido'), v_token.token;
    end if;

    v_expression := regexp_replace(
      v_expression,
      format('\\m%s\\M', v_token.token),
      to_char(v_value, 'FM999999999999990D999999'),
      'g'
    );
  end loop;

  -- Segurança final: após substituição, deve sobrar só matemática pura.
  if v_expression ~ '[^0-9+\-*/().\s]' then
    raise exception 'Fórmula inválida em %: expressão residual insegura', coalesce(p_context, 'contexto desconhecido');
  end if;

  execute format('select (%s)::numeric', v_expression) into v_result;
  return coalesce(round(v_result, 2), 0);
exception
  when division_by_zero then
    raise exception 'Fórmula inválida em %: divisão por zero', coalesce(p_context, 'contexto desconhecido');
  when others then
    raise exception 'Erro ao avaliar fórmula em %: %', coalesce(p_context, 'contexto desconhecido'), sqlerrm;
end;
$$;

create or replace function public.recalculate_payroll_batch(p_batch_id uuid)
returns setof public.payroll_entries
language plpgsql
security definer
set search_path = public
as $$
declare
  _can_operate boolean;
  _entry record;
  _rubric record;
  _formula record;
  _item record;
  _next_formula_id uuid;
  _total_formula_count integer;
  _processed_formula_count integer;
  _value numeric;
  _derived_value numeric;
  _expression text;
  _earnings jsonb;
  _deductions jsonb;
  _code_values jsonb;
  _earnings_total numeric;
  _deductions_total numeric;
  _inss_amount numeric;
  _net_salary_value numeric;
  _net_rubrica_id uuid;
  _net_rubrica_type text;
begin
  -- Backend-first: somente backend executa cálculo oficial da folha.
  if auth.uid() is not null then
    _can_operate := public.has_permission(auth.uid(), 'folha.operar');
  else
    _can_operate := true;
  end if;

  if not _can_operate then
    raise exception 'Usuário sem permissão folha.operar para recalcular folha';
  end if;

  -- Catálogo ativo de rubricas utilizado pelo motor.
  create temporary table if not exists _tmp_rubricas (
    id uuid primary key,
    code text not null,
    type text not null,
    nature public.rubric_nature,
    calculation_method public.rubric_method,
    classification public.rubric_classification,
    fixed_value numeric,
    percentage_value numeric,
    percentage_base_rubrica_id uuid
  ) on commit drop;
  truncate table _tmp_rubricas;

  insert into _tmp_rubricas (id, code, type, nature, calculation_method, classification, fixed_value, percentage_value, percentage_base_rubrica_id)
  select r.id, lower(r.code), r.type, r.nature, r.calculation_method, r.classification, r.fixed_value, r.percentage_value, r.percentage_base_rubrica_id
  from public.rubricas r
  where r.is_active = true;

  -- Mapeamento de token técnico estável por rubrica para avaliar fórmulas sem depender de nome.
  create temporary table if not exists _tmp_formula_tokens (
    rubrica_id uuid primary key,
    token text not null
  ) on commit drop;
  truncate table _tmp_formula_tokens;

  insert into _tmp_formula_tokens (rubrica_id, token)
  select r.id, ('r_' || replace(r.id::text, '-', '_'))
  from _tmp_rubricas r;

  -- Dependências entre rubricas de fórmula (grafo para ordenação topológica).
  create temporary table if not exists _tmp_formula_deps (
    formula_rubrica_id uuid not null,
    depends_on_formula_id uuid not null,
    primary key (formula_rubrica_id, depends_on_formula_id)
  ) on commit drop;
  truncate table _tmp_formula_deps;

  -- Falha explícita para referência inexistente no cadastro de fórmula.
  if exists (
    select 1
    from public.rubrica_formula_items fi
    join _tmp_rubricas fr on fr.id = fi.rubrica_id
    left join _tmp_rubricas src on src.id = fi.source_rubrica_id
    where fr.nature = 'calculada'
      and fr.calculation_method = 'formula'
      and src.id is null
  ) then
    raise exception 'Erro de fórmula: referência inexistente em rubrica_formula_items';
  end if;

  insert into _tmp_formula_deps (formula_rubrica_id, depends_on_formula_id)
  select distinct fi.rubrica_id, src.id
  from public.rubrica_formula_items fi
  join _tmp_rubricas fr on fr.id = fi.rubrica_id
  join _tmp_rubricas src on src.id = fi.source_rubrica_id
  where fr.nature = 'calculada'
    and fr.calculation_method = 'formula'
    and src.nature = 'calculada'
    and src.calculation_method = 'formula';

  create temporary table if not exists _tmp_formula_in_degree (
    rubrica_id uuid primary key,
    in_degree integer not null
  ) on commit drop;
  truncate table _tmp_formula_in_degree;

  insert into _tmp_formula_in_degree (rubrica_id, in_degree)
  select fr.id,
         coalesce((
           select count(*)
           from _tmp_formula_deps d
           where d.formula_rubrica_id = fr.id
         ), 0)::integer
  from _tmp_rubricas fr
  where fr.nature = 'calculada'
    and fr.calculation_method = 'formula';

  create temporary table if not exists _tmp_formula_order (
    order_position integer generated always as identity primary key,
    rubrica_id uuid not null unique
  ) on commit drop;
  truncate table _tmp_formula_order;

  create temporary table if not exists _tmp_formula_processed (
    rubrica_id uuid primary key
  ) on commit drop;
  truncate table _tmp_formula_processed;

  select count(*) into _total_formula_count from _tmp_formula_in_degree;
  _processed_formula_count := 0;

  -- Resolução de dependências (ordenação topológica).
  while _processed_formula_count < _total_formula_count loop
    select d.rubrica_id
      into _next_formula_id
    from _tmp_formula_in_degree d
    where d.in_degree = 0
      and not exists (
        select 1
        from _tmp_formula_processed p
        where p.rubrica_id = d.rubrica_id
      )
    order by d.rubrica_id
    limit 1;

    if _next_formula_id is null then
      raise exception 'Erro de fórmula: dependência circular detectada entre rubricas calculadas';
    end if;

    insert into _tmp_formula_processed (rubrica_id) values (_next_formula_id);
    insert into _tmp_formula_order (rubrica_id) values (_next_formula_id);

    update _tmp_formula_in_degree d
    set in_degree = d.in_degree - 1
    where d.rubrica_id in (
      select dep.formula_rubrica_id
      from _tmp_formula_deps dep
      where dep.depends_on_formula_id = _next_formula_id
    );

    _processed_formula_count := _processed_formula_count + 1;
  end loop;

  -- Processa cada lançamento da folha e materializa derivadas no payload do próprio entry.
  for _entry in
    select pe.*
    from public.payroll_entries pe
    where pe.payroll_batch_id = p_batch_id
    order by pe.created_at desc
  loop
    _earnings := coalesce(_entry.earnings, '{}'::jsonb);
    _deductions := coalesce(_entry.deductions, '{}'::jsonb);
    _code_values := '{}'::jsonb;

    -- Carrega valores operacionais por rubrica ativa sem inferência por nome.
    for _rubric in
      select *
      from _tmp_rubricas
    loop
      if _rubric.type = 'desconto' then
        _value := public.payroll_extract_payload_value(_deductions, _rubric.id, _rubric.code);
      else
        _value := public.payroll_extract_payload_value(_earnings, _rubric.id, _rubric.code);
      end if;

      -- Métodos simples derivados (não manuais) também são resolvidos no backend.
      if _rubric.nature = 'calculada' and _rubric.calculation_method = 'valor_fixo' then
        _value := coalesce(_rubric.fixed_value, 0);
      elsif _rubric.nature = 'calculada' and _rubric.calculation_method = 'percentual' then
        if _rubric.percentage_base_rubrica_id is null then
          raise exception 'Erro de fórmula: rubrica percentual sem base (%).', _rubric.code;
        end if;
        _value := coalesce((
          (_code_values ->> (select t.token from _tmp_formula_tokens t where t.rubrica_id = _rubric.percentage_base_rubrica_id))::numeric
        ), 0) * coalesce(_rubric.percentage_value, 0) / 100.0;
      end if;

      _code_values := jsonb_set(_code_values, array[_rubric.code], to_jsonb(round(coalesce(_value, 0), 2)), true);
      _code_values := jsonb_set(
        _code_values,
        array[(select t.token from _tmp_formula_tokens t where t.rubrica_id = _rubric.id)],
        to_jsonb(round(coalesce(_value, 0), 2)),
        true
      );

      -- Derivadas simples (valor_fixo/percentual) também precisam ficar no payload final
      -- para consumo da Central/recibos/relatórios, assim como as derivadas por fórmula.
      if _rubric.nature = 'calculada'
         and _rubric.calculation_method in ('valor_fixo', 'percentual') then
        if _rubric.type = 'desconto' then
          _deductions := jsonb_set(_deductions, array[_rubric.id::text], to_jsonb(round(coalesce(_value, 0), 2)), true);
        else
          _earnings := jsonb_set(_earnings, array[_rubric.id::text], to_jsonb(round(coalesce(_value, 0), 2)), true);
        end if;
      end if;
    end loop;

    -- Execução real das rubricas calculadas por fórmula conforme cadastro do usuário.
    -- Fonte real da fórmula nesta versão: rubrica_formula_items (itens estruturados add/subtract).
    -- Não há hardcode por nome; novas rubricas calculadas passam a funcionar sem novo deploy.
    for _formula in
      select r.id, r.code, r.type
      from _tmp_formula_order o
      join _tmp_rubricas r on r.id = o.rubrica_id
      order by o.order_position
    loop
      _expression := null;

      for _item in
        select fi.operation, src.id as source_id, src.code as source_code, ft.token, fi.item_order
        from public.rubrica_formula_items fi
        join _tmp_rubricas src on src.id = fi.source_rubrica_id
        join _tmp_formula_tokens ft on ft.rubrica_id = src.id
        where fi.rubrica_id = _formula.id
        order by fi.item_order
      loop
        if _expression is null then
          _expression := case when _item.operation = 'subtract' then '- ' else '' end || _item.token;
        else
          _expression := _expression || case when _item.operation = 'subtract' then ' - ' else ' + ' end || _item.token;
        end if;
      end loop;

      if _expression is null then
        raise exception 'Erro de fórmula: rubrica % sem itens cadastrados', _formula.code;
      end if;

      _derived_value := public.payroll_eval_formula_expression(
        _expression,
        _code_values,
        format('rubrica %s', _formula.code)
      );

      _code_values := jsonb_set(_code_values, array[_formula.code], to_jsonb(_derived_value), true);
      _code_values := jsonb_set(
        _code_values,
        array[(select t.token from _tmp_formula_tokens t where t.rubrica_id = _formula.id)],
        to_jsonb(_derived_value),
        true
      );

      if _formula.type = 'desconto' then
        _deductions := jsonb_set(_deductions, array[_formula.id::text], to_jsonb(_derived_value), true);
      else
        _earnings := jsonb_set(_earnings, array[_formula.id::text], to_jsonb(_derived_value), true);
      end if;
    end loop;

    -- Totais operacionais: somam SOMENTE rubricas-base (inputs operacionais).
    -- Rubricas derivadas ficam disponíveis no payload, mas não entram na soma para evitar dupla contagem.
    _earnings_total := 0;
    _deductions_total := 0;
    for _rubric in
      select *
      from _tmp_rubricas
      where nature = 'base'
      order by code
    loop
      if _rubric.type = 'desconto' then
        _value := public.payroll_extract_payload_value(_deductions, _rubric.id, _rubric.code);
        _deductions_total := _deductions_total + coalesce(_value, 0);
      else
        _value := public.payroll_extract_payload_value(_earnings, _rubric.id, _rubric.code);
        _earnings_total := _earnings_total + coalesce(_value, 0);
      end if;
    end loop;
    _earnings_total := round(_earnings_total, 2);
    _deductions_total := round(_deductions_total, 2);

    select coalesce(sum(public.payroll_parse_jsonb_numeric(d.value)), 0)::numeric(12,2)
      into _inss_amount
    from jsonb_each(_deductions) d
    where d.key in (
      select r.id::text
      from _tmp_rubricas r
      where r.classification = 'inss'
    );

    -- Critério técnico desta versão para net_salary derivado:
    -- usamos a rubrica calculada de código canônico `salario_liquido` quando ela existir.
    -- Motivo: no modelo atual não há classificação para derivadas; o código técnico da rubrica
    -- é o identificador estável já previsto pelos PRDs para este resultado.
    _net_salary_value := null;
    select r.id, r.type
      into _net_rubrica_id, _net_rubrica_type
    from _tmp_rubricas r
    where r.nature = 'calculada'
      and r.code = 'salario_liquido'
    order by r.id
    limit 1;

    if _net_rubrica_id is not null then
      if _net_rubrica_type = 'desconto' then
        if not (_deductions ? _net_rubrica_id::text) then
          raise exception 'Erro de cálculo: rubrica salario_liquido existe, mas não foi materializada no payload de descontos';
        end if;
        _net_salary_value := public.payroll_parse_jsonb_numeric(_deductions -> (_net_rubrica_id::text));
      else
        if not (_earnings ? _net_rubrica_id::text) then
          raise exception 'Erro de cálculo: rubrica salario_liquido existe, mas não foi materializada no payload de proventos';
        end if;
        _net_salary_value := public.payroll_parse_jsonb_numeric(_earnings -> (_net_rubrica_id::text));
      end if;
    else
      -- Fallback de segurança para cenários sem rubrica derivada oficial cadastrada.
      _net_salary_value := (_earnings_total - _deductions_total)::numeric(12,2);
    end if;

    update public.payroll_entries pe
    set
      earnings = _earnings,
      deductions = _deductions,
      earnings_total = _earnings_total,
      deductions_total = _deductions_total,
      inss_amount = _inss_amount,
      net_salary = _net_salary_value
    where pe.id = _entry.id;
  end loop;

  return query
  select *
  from public.payroll_entries pe
  where pe.payroll_batch_id = p_batch_id
  order by pe.created_at desc;
end;
$$;
