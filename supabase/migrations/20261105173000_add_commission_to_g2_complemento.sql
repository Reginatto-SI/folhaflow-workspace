-- PRD-01/02/08/12: acrescenta somente Comissão (code técnico 18) ao G2.
-- Sem backfill: fórmulas globais também afetam relatórios históricos regenerados.
do $$
declare
  _g2_id uuid;
  _commission_id uuid;
  _count integer;
  _items integer;
  _adds integer;
  _next_order integer;
begin
  -- Serializa a validação + append, inclusive contra alterações no cadastro.
  -- Mantém RLS, permissões e constraints existentes; executar via papel de migration.
  lock table public.rubricas, public.rubrica_formula_items in share row exclusive mode;

  select count(*) into _count from public.rubricas
  where lower(btrim(code)) in ('g2_complemento', 'salario_g2_complemento', '16');
  if _count <> 1 then
    raise exception 'G2: esperado um único code g2_complemento, salario_g2_complemento ou 16; encontrados %', _count;
  end if;
  select id into _g2_id from public.rubricas
  where lower(btrim(code)) in ('g2_complemento', 'salario_g2_complemento', '16')
    and is_active and nature = 'calculada' and calculation_method = 'formula'
    -- O code 16 só é aceito junto ao nome legado normalizado confirmado.
    -- normalize é nativo do PostgreSQL: não depende da extensão unaccent.
    and (btrim(code) <> '16' or
      btrim(regexp_replace(regexp_replace(regexp_replace(
        normalize(lower(name), NFD), U&'[\0300-\036f]', '', 'g'),
        '[.\-_/]+', ' ', 'g'), '\s+', ' ', 'g'))
      in ('salario g2 complem', 'salario g2 complemento'));
  if _g2_id is null then
    raise exception 'G2: rubrica deve estar ativa, calculada e com método formula; code 16 exige nome legado Salário G2 complem./complemento';
  end if;

  -- 18 é o code da Comissão no cadastro suportado, não display_order nem nome.
  select count(*) into _count from public.rubricas where btrim(code) = '18';
  if _count <> 1 then
    raise exception 'Comissão: esperado um único code técnico 18; encontrados %', _count;
  end if;
  select id into _commission_id from public.rubricas
  where btrim(code) = '18' and is_active and type = 'provento'
    and nature = 'base' and calculation_method = 'manual';
  if _commission_id is null then
    raise exception 'Comissão (18): rubrica deve estar ativa, ser provento base e manual';
  end if;

  if not exists (select 1 from public.rubrica_formula_items where rubrica_id = _g2_id) then
    raise exception 'G2: fórmula existente vazia; não é seguro acrescentar somente Comissão';
  end if;

  select count(*), count(*) filter (where operation = 'add') into _items, _adds
  from public.rubrica_formula_items
  where rubrica_id = _g2_id and source_rubrica_id = _commission_id;
  if _items = 1 and _adds = 1 then
    return; -- Já corrigida: preserva inclusive id, ordem e timestamps.
  elsif _items <> 0 then
    raise exception 'G2: referência à Comissão já existe com operação ou multiplicidade inesperada';
  end if;

  select max(item_order) + 1 into _next_order
  from public.rubrica_formula_items where rubrica_id = _g2_id;
  insert into public.rubrica_formula_items (rubrica_id, operation, source_rubrica_id, item_order)
  values (_g2_id, 'add', _commission_id, _next_order);
end $$;
