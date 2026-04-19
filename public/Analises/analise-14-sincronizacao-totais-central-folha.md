# Análise 14 — Sincronização dos totais da Central de Folha com o drawer

## Diagnóstico da causa-raiz

### Sintoma observado
- O drawer do funcionário exibia valores calculados de **Salário Real**, **G2 Complemento** e **Salário Líquido**.
- A linha da tabela e os totais da tela principal podiam ficar zerados para esses mesmos campos.

### Investigação objetiva
- A Central já usa cálculo único (`computeSpreadsheetEntry`) para drawer, tabela e totais.
- A divergência não era na engine de cálculo, e sim na **identificação da rubrica derivada canônica**:
  - drawer exibe as rubricas derivadas carregadas da lista de resultados;
  - tabela/totais resolviam os IDs canônicos somente por `rubric.code` estrito (`salario_real`, `g2_complemento`, `salario_liquido`).
- Em cenário com cadastro legado (nome correto exibido no drawer, mas código fora do padrão canônico estrito), os IDs canônicos ficavam `null` em tabela/totais e a UI principal zerava.

### Causa-raiz
- **Resolução de rubricas canônicas duplicada e rígida em componentes diferentes**.
- A tabela e a barra de totais dependiam de match estrito por código, enquanto o drawer continuava exibindo derivados existentes.

---

## Arquivos alterados

1. `src/lib/payrollSpreadsheet.ts`
2. `src/components/payroll/PayrollTable.tsx`
3. `src/components/payroll/TotalsBar.tsx`
4. `public/Analises/analise-14-sincronizacao-totais-central-folha.md`

---

## Resumo da correção aplicada

- Foi criado um resolvedor único `resolveCanonicalDerivedRubricIds(...)` em `payrollSpreadsheet.ts`.
- Esse resolvedor:
  1. prioriza identificação por `code` canônico (fonte principal);
  2. aplica fallback controlado por `name` legado (`salario real`, `g2 complemento`, `salario liquido`) para manter consistência visual com o drawer.
- `PayrollTable` e `TotalsBar` passaram a consumir **exatamente o mesmo resolvedor**, eliminando cálculo paralelo de identificação de campos.

Resultado funcional:
- drawer continua correto;
- linha da tabela passa a buscar os mesmos derivados de forma robusta;
- cards/totais superiores passam a somar os mesmos valores derivados, evitando divergência visual.

---

## O que foi preservado sem alteração

- Não houve mudança no layout/AppLayout.
- Não houve alteração de fluxo de salvar/editar no drawer.
- Não houve nova arquitetura de cálculo.
- `computeSpreadsheetEntry(...)` permanece como função única do cálculo operacional da Central.
- Escopo restrito à sincronização entre componentes da Central de Folha.

---

## Riscos remanescentes

- Se o cadastro possuir nomes de rubrica derivados fora dos aliases previstos e também sem código canônico, a identificação ainda pode falhar.
- O caminho recomendado continua sendo manter códigos canônicos corretos no cadastro de rubricas.
