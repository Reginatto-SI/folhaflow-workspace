# Diagnóstico e correção — Salário Fiscal na aba Financeiro

## 1. Causa raiz encontrada (confirmada no banco)

A rubrica **Salário Fiscal** está cadastrada com o código técnico **`3`** (código legado numérico), e não com um código canônico.

Evidência (consulta em `rubricas`):

```text
id: cb3556c7-936f-4fef-b12a-065ff4b874da
name: Salário Fiscal
code: 3
is_active: true
nature: base   | calculation_method: manual | classification: salario_ctps
```

Nenhuma rubrica no banco possui código contendo "fiscal" (`select count(*) from rubricas where code ilike '%fiscal%'` → 0).

O exportador resolve a coluna financeira assim (`src/lib/reportByCompanyData.ts`):

```text
SALARIO_FISCAL_CODES = { "salario_fiscal", "sal_fiscal" }
salarioFiscalId = rubrics.find(r => r.isActive && SALARIO_FISCAL_CODES.has(code))?.id ?? null
```

Como o código real é `3`, **`financialRubricIds.salarioFiscalId` é sempre `null`**, em todas as empresas e todas as competências. A aba `Financeiro` lê a célula por esse id → sempre vazia.

Já a aba `Relatório Geral` não depende dessa resolução: ela percorre **todas as rubricas ativas** como colunas dinâmicas (por `rubricId`), então o Salário Fiscal aparece normalmente.

**Ponto exato de divergência:** Geral usa `dataset.dynamicColumns[rubricId]`; Financeiro usa `dataset.financialRubricIds.salarioFiscalId`, que nunca resolve.

- ID usado no Relatório Geral: `cb3556c7-936f-4fef-b12a-065ff4b874da`
- ID resolvido para a aba Financeiro: `null`

Isso não é específico de nenhuma competência — as tentativas anteriores falharam porque atacavam serialização/formatos, não a resolução do id.

## 2. Achado secundário — lacuna de dados em Agosto/2026

Contagem de lançamentos com Salário Fiscal preenchido por competência:

```text
04/2026: 152 / 153
06/2026: 149 / 149
07/2026: 148 / 149
08/2026:  12 / 150   <-- 138 lançamentos sem Salário Fiscal
```

Em 08/2026 o payload `earnings` de 138 lançamentos contém apenas Salário CTPS e Salário G. É ausência real de dado (provável duplicação/criação da folha antes do preenchimento), **não** um problema de relatório. Nenhum dado será alterado sem sua autorização.

## 3. Correção proposta (mínima)

**Saneamento de cadastro, uma única linha, idempotente:** atualizar o `code` da rubrica `cb3556c7-...` de `3` para `salario_fiscal`, que é exatamente o contrato já esperado pelo código.

```sql
update public.rubricas
set code = 'salario_fiscal'
where id = 'cb3556c7-936f-4fef-b12a-065ff4b874da'
  and code = '3'
  and name = 'Salário Fiscal';
```

- Idempotente (condição no `where`), não apaga nada, não toca outras rubricas, competências ou empresas.
- Os payloads de folha são chaveados por **UUID**, não por code, então nenhum valor histórico muda.
- Nada mais no código depende do literal `3`.

Depois disso, `salarioFiscalId` resolve para o mesmo id usado pela aba Geral, garantindo `Financeiro == Geral`.

**Blindagem adicional em código (sem heurística por nome):** em `resolveReportFinancialRubricIds`, se a resolução por código falhar, o dataset passa a emitir um aviso rastreável em vez de silenciosamente exportar coluna vazia — a inconsistência fica visível, não mascarada. Nenhum fallback por nome, nenhum recálculo, nenhuma segunda estratégia de identificação.

## 4. Testes

Em `src/lib/reportByCompanyExcel.test.ts` / `reportByCompanyData.test.ts`:

1. Rubrica com o code canônico → `salarioFiscalId` resolvido; Geral e Financeiro com o mesmo valor.
2. Rubrica com code legado `3` → resolução falha e o aviso é emitido (reproduz a causa raiz).
3. Fluxo real: dataset construído a partir de rubricas/entries simulados (sem injetar `financialRubricIds` prontos).
4. Valor positivo, valor zero e funcionário sem lançamento de fiscal.
5. Batch ativo x batch arquivado.
6. Workbook serializado e reaberto, colunas localizadas pelo cabeçalho, igualdade célula a célula entre `Relatório Geral` e `Financeiro`.
7. Regressão: G2 e Líquido continuam inalterados.

## 5. Fora de escopo

PDF, layout, ordem de colunas, colunas PIX/Cheque, RLS, fórmulas e a lacuna de dados de 08/2026 permanecem intocados.

## Decisão necessária

Quer que eu inclua, no mesmo trabalho, um relatório detalhado dos 138 lançamentos de 08/2026 sem Salário Fiscal (somente leitura, sem alterar dados)?
