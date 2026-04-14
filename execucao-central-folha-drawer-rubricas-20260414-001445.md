# Execução — Central de Folha Drawer orientado por rúbricas

## O que foi alterado
- Reestruturado o `EmployeeDrawer` para renderizar **somente** rubricas cadastradas (ativas), ordenadas por `display_order` (`rubric.order` no front).
- Removidos campos fixos do drawer (não há mais `Salário Base` hardcoded).
- Separação visual em blocos operacionais:
  - Rubricas-base (heurística transitória)
  - Proventos
  - Descontos
  - Resumo derivado
  - Observação (`notes`)
- Header do drawer com nome, CPF, empresa e competência.
- Inclusão de campo de observação no drawer e salvamento junto com os valores.
- Ajustes em `Index.tsx` para passar rubricas/empresa/competência ao drawer.
- Correção de inconsistências no `PayrollContext.tsx` (duplicidade de `addPayrollEntry`) para estabilizar build.

## Arquivos alterados
- `src/components/payroll/EmployeeDrawer.tsx`
- `src/pages/Index.tsx`
- `src/contexts/PayrollContext.tsx`

## Critério usado para separar os blocos
- Base: rubricas ativas cuja combinação `code + name + category` contenha tokens de salário/base (`salario|salário|base|ctps|fiscal|g2`).
- Proventos: rubricas ativas `type = provento` que não entraram no bloco base.
- Descontos: rubricas ativas `type = desconto` que não entraram no bloco base.

> Observação: esse critério foi documentado no código como compatibilidade transitória, pois não existe metadado dedicado de “rubrica-base” no schema atual.

## Como ficou a leitura dos valores
- Leitura por rubrica ativa com prioridade de chave:
  1. `rubric.id`
  2. `rubric.code`
  3. `rubric.name`
  4. comparação case-insensitive por code/name
- Para base: se a primeira rubrica-base não tiver valor legado e `base_salary > 0`, usa `base_salary` como fallback.

## Como ficou a escrita dos valores
- Persistência transicional sem migration:
  - `earnings` gravado por `rubric.id` para rubricas de provento **não-base**;
  - `deductions` gravado por `rubric.id` para rubricas de desconto;
  - `base_salary` recebe soma das rubricas-base;
  - `notes` salvo junto.

## Limitações que permanecem
- Ainda não existe itemização relacional por `rubrica_id` em tabela própria.
- Ainda não existe escopo completo de rubricas por empresa no banco.
- Heurística de rubrica-base depende de nomenclatura até existir metadado explícito.

## Próximos passos recomendados
1. Definir metadado explícito de classificação de rubrica-base para eliminar heurística.
2. Planejar itemização relacional (`payroll_entry_items`) em fase separada.
3. Planejar escopo de rubricas por empresa (sem quebrar legado).
