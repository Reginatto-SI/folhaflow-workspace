# Análise 1 — Ajuste Resumo Completo

## Diagnóstico encontrado

- A coluna final estava nomeada e calculada como **SEM MOV.** (somatório de empresas sem movimento).
- O legado exige **SEM IMOB.**, que significa **TOTAL - IMOBILIÁRIA** em cada linha.
- As linhas `Rendimentos`, `Descontos` e `Custo médio por Func.` estavam no mesmo bloco da tabela principal.
- O PDF já usava paisagem e base compacta, mas ainda precisava aproximar o visual do legado com coluna final correta e bloco inferior separado.

## Arquivos alterados

- `src/lib/reportSummaryData.ts`
- `src/pages/ReportsSummary.tsx`
- `src/lib/reportSummaryPdf.ts`
- `public/Analises/analise-1-ajuste-resumo-completo.md`

## Como a IMOBILIÁRIA foi identificada

- Foi usada a coluna já existente de empresas do dataset.
- A identificação foi feita pelo `company.name` normalizado (remoção de acentos + uppercase), buscando `IMOBILIARIA`.
- Isso permite casar tanto `IMOBILIÁRIA` quanto `IMOBILIARIA` sem criar motor novo de dados.

## Como a coluna `SEM IMOB.` foi calculada

- Regra aplicada linha a linha no consolidado:
  - `semImob = total - valorDaEmpresaImobiliaria`.
- A regra foi aplicada também na linha `Custo médio por Func.` com base no helper atual:
  - `(salário_real_total - salário_real_imobiliária) / (headcount_total - headcount_imobiliária)`.
- Não houve recálculo paralelo de rubricas; somente consolidação de apresentação sobre os valores já existentes.

## Como o bloco inferior foi separado

- Na tela e no PDF, as linhas abaixo foram separadas do bloco principal:
  - `Rendimentos`
  - `Descontos`
  - `Custo médio por Func.`
- O bloco inferior mantém as mesmas colunas (empresas, `TOTAL`, `SEM IMOB.`) e destaque visual compatível com o legado.

## Validações manuais feitas

- Verificação de rótulo de coluna final: `SEM IMOB.`.
- Verificação de permanência da coluna `IMOBILIÁRIA` entre as empresas.
- Verificação de separação visual do bloco inferior na tabela da tela e no PDF.
- Verificação de destaque em `TOTAL` e `SEM IMOB.` e primeira coluna em cinza escuro no PDF.

## Riscos pendentes

- Se houver ambiente onde o nome da empresa IMOBILIÁRIA não esteja no `company.name` (ex.: apenas em outro campo), pode ser necessário ajustar a chave de identificação para um identificador canônico da empresa.
- A ordem exata das colunas segue a ordem de empresas fornecida pelo contexto atual; não foi feita refatoração ampla de ordenação.


## Refinamento posterior — correção do Custo médio por Func.

- No primeiro ajuste, a linha `Custo médio por Func.` estava baseada em **Salário Real**.
- Após validação com o legado, foi corrigida para usar **Salário G**.
- Motivo técnico/funcional: `Custo médio por Func.` é uma **média** e deve seguir:
  - por empresa: `Salário G / Total de Funcionários`;
  - coluna `TOTAL`: `Salário G total / Total de Funcionários total`;
  - coluna `SEM IMOB.`: `(Salário G total - Salário G IMOBILIÁRIA) / (Funcionários totais - Funcionários IMOBILIÁRIA)`.
- Portanto, para essa linha, `SEM IMOB.` **não** pode ser tratado como subtração simples entre médias (`TOTAL - IMOBILIÁRIA`).

### Validações realizadas neste refinamento

- Conferência de regra no código do consolidado: base da média alterada para a linha `Salário G` já existente no próprio resumo.
- Conferência de `SEM IMOB.` da média com fórmula de razão (numerador e denominador sem IMOBILIÁRIA).
- Correção de limpeza aplicada na identificação de IMOBILIÁRIA (remoção de condição duplicada).
- Build de produção executado para garantir integridade da alteração.
