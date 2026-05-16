# Análise 5 — Alerta canônico indevido na Central de Folha

## 1. Diagnóstico do alerta

O alerta exibido no card **Resultados** do drawer da Central de Folha era disparado por diagnóstico técnico das rubricas canônicas, não pelo valor calculado.

A investigação confirmou que o cálculo dos resultados canônicos continua centralizado no frontend, conforme PRD-00, PRD-00B, PRD-01, PRD-03 e PRD-12. Não houve alteração nas fórmulas de `salario_real`, `salario_liquido` ou `g2_complemento`, nem criação de lógica paralela no backend.

O falso positivo ocorria porque a função que decide se há inconsistência visual considerava qualquer resolução diferente de `resolved_by_code` como problema, inclusive `resolved_by_legacy_name`. Esse status ainda identifica uma rubrica calculada única e permite que a Central exiba os três resultados corretamente; portanto não deve, por si só, gerar alerta operacional para o usuário comum.

## 2. Arquivo/função responsável pelo alerta

Arquivos responsáveis:

- `src/components/payroll/EmployeeDrawer.tsx`
  - `canonicalDiagnosticMessage`: monta o texto exibido no card **Resultados**.
  - O alerta é renderizado quando `canonicalDiagnosticMessage` retorna uma string.
- `src/lib/payrollSpreadsheet.ts`
  - `diagnoseCanonicalDerivedRubrics`: diagnostica as rubricas canônicas.
  - `hasCanonicalRubricInconsistency`: informa ao drawer se o diagnóstico deve virar alerta visual.
  - `resolveCanonicalDerivedRubricIds`: resolve os IDs usados para cálculo/exibição dos canônicos.

## 3. Condição atual que disparava o alerta

Antes da correção, `hasCanonicalRubricInconsistency` chamava `isCanonicalResolutionConsistent`, que só considerava consistente o status:

- `resolved_by_code`

Assim, os status abaixo eram tratados como inconsistência visual:

- `resolved_by_legacy_name`
- `missing`
- `ambiguous_code`
- `ambiguous_name`

O problema estava no primeiro caso: `resolved_by_legacy_name` é uma resolução transitória/legada, mas ainda é uma resolução unívoca e suficiente para a Central identificar e exibir o resultado.

## 4. Motivo de aparecer mesmo com cálculo correto

O alerta não verificava se `g2_complemento` era negativo, se os descontos eram altos, nem se os valores finais batiam com o legado.

Ele aparecia porque a validação era cadastral/técnica: se alguma rubrica canônica fosse resolvida por nome legado em vez de `code` canônico, o status era classificado como inconsistência visual, mesmo quando:

- `salario_real` estava calculado;
- `salario_liquido` estava calculado;
- `g2_complemento` estava calculado;
- os IDs resolvidos existiam;
- a Central conseguia renderizar os três resultados corretamente.

## 5. Falso positivo ou inconsistência real?

Foi tratado como **falso positivo de UI** quando a situação é `resolved_by_legacy_name` unívoca.

Continua sendo inconsistência real quando há:

- ausência de rubrica canônica essencial (`missing`);
- duplicidade/ambiguidade por código (`ambiguous_code`);
- duplicidade/ambiguidade por nome legado (`ambiguous_name`).

Esses casos ainda podem impedir o sistema de identificar com segurança os resultados canônicos e, portanto, continuam gerando alerta.

## 6. Correção aplicada

Correção mínima aplicada em `src/lib/payrollSpreadsheet.ts`:

- `resolved_by_code` continua consistente;
- `resolved_by_legacy_name` passou a ser consistente para fins de alerta visual;
- `missing`, `ambiguous_code` e `ambiguous_name` continuam inconsistentes;
- os avisos técnicos de fallback legado continuam existindo via `console.warn` em ambiente de desenvolvimento, sem incomodar a operação comum no card **Resultados**.

Nenhuma fórmula foi alterada.
Nenhum recálculo backend foi chamado.
Nenhuma lógica paralela foi criada.
Nenhum arquivo de Recibos/Relatórios foi alterado.

## 7. Arquivos alterados

- `src/lib/payrollSpreadsheet.ts`
  - Ajuste mínimo da condição que decide inconsistência canônica visual.
- `src/lib/payrollSpreadsheet.test.ts`
  - Cobertura para fallback legado unívoco sem inconsistência visual.
  - Cobertura para ausência canônica essencial ainda gerar inconsistência.
  - Cobertura para `g2_complemento` negativo não ser tratado como erro.
- `src/components/payroll/EmployeeDrawer.test.tsx`
  - Atualização da expectativa do fallback legado: resultados continuam aparecendo sem alerta visual.
  - Cenário com os valores reais validados, garantindo que o card **Resultados** não exiba alerta quando os três resultados canônicos foram calculados, incluindo `g2_complemento` negativo.
- `public/Analises/analise-5-alerta-canonico-central-folha.md`
  - Registro desta análise.

## 8. Testes executados

- `npm test -- --run src/lib/payrollSpreadsheet.test.ts src/components/payroll/EmployeeDrawer.test.tsx`
- `npm test`
- `npm run build`
- `npm run lint`

Resultado:

- Teste direcionado: 2 arquivos passaram; 22 testes passaram.
- Suíte completa: 5 arquivos passaram; 26 testes passaram.
- Build de produção passou.
- Lint falhou por débitos já existentes fora do escopo (`src/components/ui/command.tsx`, `src/components/ui/textarea.tsx`, `src/contexts/PayrollContext.tsx`, `tailwind.config.ts`), sem erros novos nos arquivos alterados.

Cenários validados:

1. Com os valores reais informados, o card **Resultados** não exibe alerta quando os três resultados canônicos estão calculados:
   - Salário CTPS: 3000
   - Salário G: 7000
   - Salário Fiscal: 3284.07
   - INSS: 446.78
   - Empréstimo: 878.32
   - Vales: 4160
   - Salário Real: 6553.22
   - Salário Líquido: 1514.90
   - G2 Complemento: -1769.17
2. `g2_complemento` negativo não é tratado como inconsistência.
3. Ausência de configuração canônica essencial continua sendo inconsistência.
4. Fallback legado unívoco deixa de gerar alerta visual, mas permanece rastreável tecnicamente em desenvolvimento.

## 9. Checklist final

- [x] Consultei os PRDs obrigatórios antes de alterar arquivos.
- [x] Não alterei fórmula de `salario_real`.
- [x] Não alterei fórmula de `salario_liquido`.
- [x] Não alterei fórmula de `g2_complemento`.
- [x] Não recriei motor de cálculo.
- [x] Não chamei `recalculate_payroll_batch`.
- [x] Não criei lógica paralela no backend.
- [x] Não alterei `/rubricas` sem necessidade.
- [x] Não alterei Recibos/Relatórios.
- [x] Não refatorei arquitetura.
- [x] Apliquei correção mínima e localizada.
- [x] Mantive alerta para inconsistência real de ausência/ambiguidade.
- [x] Removi falso positivo visual quando a Central consegue identificar e exibir os três resultados canônicos.

## Respostas às perguntas obrigatórias

1. **Qual função, componente ou hook dispara esse alerta?**
   - O componente é `EmployeeDrawer`, por meio do `useMemo` `canonicalDiagnosticMessage`. Ele depende de `hasCanonicalRubricInconsistency` em `src/lib/payrollSpreadsheet.ts`.

2. **Quais condições fazem o alerta aparecer?**
   - Após a correção, apenas `missing`, `ambiguous_code` ou `ambiguous_name` em qualquer uma das três rubricas canônicas.

3. **O alerta depende das rubricas canônicas `salario_real`, `g2_complemento` e `salario_liquido`?**
   - Sim. O diagnóstico avalia exatamente essas três rubricas canônicas derivadas.

4. **O alerta está validando código, nome, natureza, tipo, fórmula ou status da rubrica?**
   - Ele valida resolução canônica a partir de rubricas ativas e calculadas (`isActive` e `nature === "calculada"`), priorizando `code` canônico e usando fallback por `name` legado. Não valida valor, fórmula, tipo financeiro, resultado positivo/negativo ou classificação.

5. **Existe alguma rubrica canônica cadastrada de forma diferente do esperado?**
   - Pelo código, a situação que gerava falso positivo compatível com cálculo correto é rubrica resolvida por nome legado (`resolved_by_legacy_name`) em vez de `code` canônico. Isso é uma divergência cadastral técnica, mas não impede a identificação unívoca nem o cálculo/exibição no drawer.

6. **O alerta aparece porque o resultado é negativo no G2 Complemento?**
   - Não. O diagnóstico não consulta valor calculado. Teste adicionado confirmou `g2_complemento` negativo sem inconsistência.

7. **O sistema está tratando valor negativo como inconsistência indevidamente?**
   - Não no diagnóstico canônico. O falso positivo vinha do status de resolução da rubrica, não do sinal do valor.

8. **O alerta aparece mesmo quando os três resultados canônicos são calculados corretamente?**
   - Antes, podia aparecer em caso de fallback legado unívoco, mesmo com os três resultados calculados/exibidos. Após a correção, não aparece nessa condição.

9. **Esse alerta deveria aparecer para operador comum ou apenas para administrador/técnico?**
   - O alerta visual deve aparecer para o operador apenas quando houver inconsistência real que possa impedir identificação segura dos resultados. O fallback legado unívoco deve ficar como rastreio técnico/desenvolvimento, não como alerta operacional no card.

10. **Qual é a menor correção segura?**
    - Considerar `resolved_by_legacy_name` como consistente para fins de alerta visual, mantendo `missing` e ambiguidades como inconsistência real. Essa alteração é local, não altera fórmulas e preserva o cálculo único do frontend.
