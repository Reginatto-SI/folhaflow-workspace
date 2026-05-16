## Causa-raiz confirmada

Consultando o cadastro de rubricas calculadas no backend:

```
code | name                 | nature
-----+----------------------+-----------
14   | Salário Real         | calculada
15   | Salário G2 complem.  | calculada
16   | Salário Líquido      | calculada
```

A função única `resolveCanonicalDerivedRubricIds` em `src/lib/payrollSpreadsheet.ts` tenta resolver cada rubrica canônica por:

1. `code` exato (`salario_real`, `g2_complemento`, `salario_liquido`) — falha (códigos são `14/15/16`);
2. `code` legado (`salario_g2_complemento` p/ G2) — falha;
3. `name` legado normalizado contra aliases:
   - `salario real` → casa com "Salário Real" ✓
   - `salario liquido` → casa com "Salário Líquido" ✓
   - `g2 complemento` → **NÃO casa** com "Salário G2 complem." (normaliza para `salario g2 complem.`) ✗

Como `g2ComplementoId` fica `null`, `calculatePayroll` retorna `g2Complemento = 0`. Por isso:

- **Drawer** mostra o valor correto: ele itera **todas** as rubricas derivadas e lê `valuesByRubricId[rubric.id]` — o cálculo da fórmula (15.000) aparece independentemente do mapeamento canônico.
- **Tabela** e **TotalsBar** consomem `result.g2Complemento` (que depende do mapeamento canônico) → `R$ 0,00`.
- **Ordem do card Resultados no drawer** fica errada porque a G2 cai no bucket "nonCanonical" (vai pro fim), exibindo: Real → Líquido → G2.

## Correção mínima

Fonte única já existe (`resolveCanonicalDerivedRubricIds`). Não há cálculo paralelo a criar nem refator. A correção é ampliar o reconhecimento por nome dessa função única para que drawer, tabela e cards usem a mesma resolução.

### 1. `src/lib/payrollSpreadsheet.ts`

- Endurecer `normalizeRubricKey` para remover pontuação trivial (pontos, hífens), tratando "Salário G2 complem." e "Salário G2 complem" igualmente.
- Expandir `canonicalLegacyNameAliases.g2_complemento` para cobrir as variantes legadas reais cadastradas:
  - `"g2 complemento"`
  - `"salario g2 complemento"`
  - `"salario g2 complem"` (forma abreviada do cadastro atual)
  - `"salario g2"`
- Manter `salario_real` e `salario_liquido` como estão (já casam), apenas adicionando variantes equivalentes (`"salario real liquido"` não se aplica — manter o que existe).

Isso mantém:
- regra oficial PRD-12 (resolução por `code` canônico é prioritária);
- fallback legado explícito, rastreável e determinístico;
- warning em DEV quando cai em fallback legado, sinalizando que o cadastro deve ser corrigido.

### 2. `src/components/payroll/EmployeeDrawer.tsx` — ordem visual do card "Resultados"

Não há mudança de fórmula. `orderedDerivedRubrics` já posiciona canônicas na ordem `[salarioReal, g2Complemento, salarioLiquido]` quando todas resolvem. Com a correção #1, `g2ComplementoId` passa a resolver e a ordem visual passa a ser automaticamente:

1. Salário Real
2. Salário G2 complem.
3. Salário Líquido

Nenhuma alteração de código adicional no drawer é necessária para a ordem. (Caso o usuário queira forçar a ordem mesmo se algum canônico não resolver, podemos garantir a ordem fixa após a correção — verifico ao implementar.)

## Validação

1. `/central-de-folha` → empresa COND GRUPO → competência março/2026.
2. Drawer do funcionário Edimar Reginato:
   - Card Resultados na ordem: Salário Real → Salário G2 complem. → Salário Líquido.
   - Salário G2 complem. = R$ 15.000,00.
3. Coluna **G2 Complemento** da tabela: R$ 15.000,00 (mesma fonte).
4. Card superior **G2 Complemento**: R$ 15.000,00 (`TotalsBar` consome a mesma função).
5. Alterar um valor base no drawer e confirmar atualização imediata em tabela e cards (sem botão recalcular).
6. Salvar, recarregar a página e confirmar que os três pontos continuam consistentes.
7. Conferir no console (DEV) o warning de "resolved by legacy name" para `g2_complemento`, sinalizando que o cadastro deve ser corrigido para `code = g2_complemento` na origem.

## Restrições respeitadas

- Sem novo motor de cálculo.
- Sem botão de recalcular.
- Sem cálculo paralelo.
- Sem alteração em recibos, relatórios, autenticação ou cadastros.
- Alteração isolada em 1 arquivo (`payrollSpreadsheet.ts`); drawer só recebe ajuste se a ordem precisar de blindagem extra.
