-- PRD-01/03: a Central de Folha precisa ler rubricas ativas para calcular no frontend.
-- Mantém gerenciamento restrito a rubricas.manage; folha.operar recebe apenas leitura operacional.
drop policy if exists "rubricas view" on public.rubricas;
create policy "rubricas view" on public.rubricas for select to authenticated
  using (
    public.has_permission(auth.uid(), 'rubricas.manage')
    or (
      public.has_permission(auth.uid(), 'folha.operar')
      and is_active = true
    )
  );

-- Itens de fórmula são necessários para a Central calcular rubricas derivadas ativas no frontend.
drop policy if exists "rubrica items view" on public.rubrica_formula_items;
create policy "rubrica items view" on public.rubrica_formula_items for select to authenticated
  using (
    public.has_permission(auth.uid(), 'rubricas.manage')
    or (
      public.has_permission(auth.uid(), 'folha.operar')
      and exists (
        select 1
        from public.rubricas r
        where r.id = rubrica_formula_items.rubrica_id
          and r.is_active = true
      )
    )
  );
