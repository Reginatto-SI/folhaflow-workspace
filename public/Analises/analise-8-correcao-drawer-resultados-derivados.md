# Análise 8 — Correção do bloco de resultados do drawer (rubricas derivadas)

## Resumo do problema
Após o refinamento visual do drawer, o bloco **Resultados** passou a exibir valores com atalhos de UI (ex.: `baseSalary` e diferença de totais), em vez de ler as rubricas derivadas reais configuradas no cadastro.

## Causa raiz
No `EmployeeDrawer`, os três cards de resultado estavam vinculados a campos agregados de conveniência da prévia (`baseSalary`, `earningsTotal - baseSalary`, `netSalary`), o que cria uma regra paralela na camada de UI.

## Como o bloco passou a ler os derivados reais
- O drawer agora localiza as rubricas derivadas ativas pelos códigos canônicos:
  - `salario_real`
  - `g2_complemento`
  - `salario_liquido`
- Após localizar cada rubrica, a leitura é feita por `rubric.id` dentro de `spreadsheetPreview.valuesByRubricId`.
- Dessa forma, a UI apenas exibe o valor já calculado no mesmo fluxo da tela, sem fórmula hardcoded.

## Fallback adotado
Se alguma rubrica derivada canônica não existir no cadastro ativo, o bloco exibe `0` para aquele card.

## Arquivos alterados
- `src/components/payroll/EmployeeDrawer.tsx`
- `public/Analises/analise-8-correcao-drawer-resultados-derivados.md`

## Como validar manualmente
1. Abrir `/central-de-folha` e entrar no drawer de um funcionário.
2. Conferir se o bloco **Resultados** mostra os valores de `salario_real`, `g2_complemento` e `salario_liquido` definidos como rubricas derivadas.
3. Alterar rubricas-base/manuais e verificar se os três cards acompanham os derivados reais calculados.
4. Desativar/remover uma das rubricas canônicas no cadastro ativo e confirmar fallback para `0` sem cálculo alternativo na UI.
