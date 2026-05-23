# Análise — Correção do Relatório por Empresa (rubricas canônicas)

## Diagnóstico encontrado

- Sintoma: no PDF de `/relatorios/por-empresa`, as colunas finais de `salario_real`, `g2_complemento` e `salario_liquido` estavam aparecendo como `0,00` em cenários onde a Central de Folha mostrava valores não zero.
- Evidência no código:
  - A Central renderiza esses três campos por `calculatePayrollFromEntry({ entry, rubrics })` na linha da tabela (`PayrollTable`).
  - O relatório por empresa montava `rubricValues` lendo somente payload persistido (`earnings`/`deductions` por id/code) e fallback pontual para `net_salary` (somente `salario_liquido`).
- Resultado: quando os derivados canônicos não estavam materializados no payload da entrada, o relatório lia `0`, enquanto a Central calculava/mostrava corretamente.

## Arquivos alterados

- `src/lib/reportByCompanyData.ts`
- `public/Analises/analise-correcao-relatorio-por-empresa-rubricas-canonicas.md`

## Causa raiz

- Divergência de fonte para rubricas canônicas finais:
  - Central: usa resolução já consolidada por `calculatePayrollFromEntry`.
  - Relatório/PDF: tentava ler somente campos persistidos do payload para `salario_real` e `g2_complemento` (e parcialmente `salario_liquido`), o que gerava zeros quando tais rubricas não estavam materializadas no JSON.

## Correção aplicada

- Ajuste mínimo na montagem do dataset do relatório:
  1. Para cada `PayrollEntry`, o relatório passa a obter `canonicalComputed` via `calculatePayrollFromEntry({ entry, rubrics })` (mesma lógica da Central).
  2. No resolvedor `readRubricValueFromEntry`, quando `rubric.code` é canônico:
     - `salario_real` → `canonicalComputed.salarioReal`
     - `g2_complemento` → `canonicalComputed.g2Complemento`
     - `salario_liquido` → `canonicalComputed.salarioLiquido`
  3. Mantidos os mesmos fallbacks já existentes para demais rubricas/legados, sem criar motor novo nem layout novo.
- Foi incluído comentário no ponto da correção explicando o motivo para prevenir regressão.

## Como foi validado

- Validação técnica local:
  - revisão do fluxo de dados do relatório (`buildReportByCompanyData`) e da Central (`PayrollTable`).
  - confirmação de que totais do PDF/CSV dependem do mesmo `dataset.rows` e `totalsByRubricId`, portanto corrigidos ao alinhar a fonte da linha.
- Checks executados no repositório:
  - `npm run test -- src/lib/payrollSpreadsheet.test.ts` (falhou por testes preexistentes não relacionados ao patch).
  - `npm run lint` (falhou por erros preexistentes globais no projeto, não introduzidos por esta correção).

## Pontos de atenção para evitar regressão

1. As rubricas canônicas (`salario_real`, `g2_complemento`, `salario_liquido`) devem sempre reutilizar a mesma resolução da Central.
2. Relatórios devem continuar sem fluxo/calculadora paralelos — apenas consumir a mesma resolução funcional já adotada no frontend.
3. Em futuras mudanças no motor/frontend, validar paridade entre:
   - Central de Folha
   - Relatório por empresa (tela + PDF/CSV)
   - Totalizadores


## Refinamento — prioridade de resolução canônica (ajuste posterior)

- Foi refinada a ordem em `readRubricValueFromEntry` para priorizar as rubricas canônicas por `canonicalComputed` **antes** de ler payload persistido.
- Ordem final para canônicas (`salario_real`, `g2_complemento`, `salario_liquido`):
  1. usar `canonicalComputed` (mesma resolução da Central);
  2. somente para não canônicas, manter leitura por payload (`id`/`code`) e campos legados quando aplicável.
- Motivo técnico: impedir que valores legados/materializados como `0` no payload sobrescrevam os valores corretos já resolvidos pela Central de Folha.

## Refinamento — identificação real das rubricas canônicas no relatório

### Códigos/campos inspecionados no fluxo

- A inspeção do fluxo de montagem do relatório confirma que cada coluna dinâmica leva:
  - `column.rubricId = rubric.id`
  - `column.rubricCode = rubric.code`
  - `column.rubricName = rubric.name`
- No resolvedor da Central (`resolveCanonicalDerivedRubricIds`), a identificação canônica não depende só do code canônico estrito; ela também cobre códigos legados e nome legado controlado, resolvendo para um `rubric.id` canônico final.

### Resultado da investigação

- O risco de divergência por `rubric.code` não canônico (ex.: legado/numérico) era real quando o relatório testava somente `rubric.code === salario_real|g2_complemento|salario_liquido`.
- Para eliminar esse risco sem nova heurística local, o relatório passou a usar o **mesmo critério de resolução da Central**:
  1. resolve IDs canônicos com `resolveCanonicalDerivedRubricIds(rubrics)`;
  2. identifica coluna canônica por `rubric.id` comparando com esses IDs resolvidos;
  3. para as três canônicas, prioriza `canonicalComputed` antes do payload.

### Critério final de identificação adotado

- `salario_real` → `rubric.id === canonicalIds.salarioRealId`
- `g2_complemento` → `rubric.id === canonicalIds.g2ComplementoId`
- `salario_liquido` → `rubric.id === canonicalIds.salarioLiquidoId`

Esse critério reaproveita a resolução canônica oficial já usada pela Central e evita duplicação de lógica.

### Validação (PDF)

- Por código, PDF/CSV/tabela continuam consumindo o mesmo `dataset` do relatório.
- Assim, ao corrigir a identificação canônica na construção do `dataset`, os valores e totalizadores passam a ficar coerentes entre tela e exportações.
