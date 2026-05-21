# Análise 4 — Auditoria final do Relatório por Empresa

## 1) Divergências encontradas entre diagnóstico anterior e código real

- Havia risco histórico de divergência entre o texto do diagnóstico e o diff mostrado na conversa anterior.
- Na auditoria final do código real, confirmou-se que o builder já estava em modo refinado (leitura por `id` + `code` + campos persistidos oficiais) e não mais na versão antiga restrita a `rubricId`.
- Na exportação CSV, havia apenas ajuste de nomenclatura/clareza pendente no toast para ficar exatamente alinhado ao contrato desta tarefa.

## 2) Correções aplicadas

- Ajuste de nomenclatura de exportação no frontend:
  - função renomeada para `exportCsv` (clareza)
  - toast padronizado para `Exportação CSV concluída.`
- Mantido botão como `Exportar CSV (Excel)` e extensão `.csv` com MIME `text/csv;charset=utf-8;`.

## 3) Código final confirmado para leitura de rubricas

A leitura está implementada nesta ordem, sem recálculo:
1. `entry.earnings[rubric.id]`
2. `entry.deductions[rubric.id]`
3. `entry.earnings[rubric.code]`
4. `entry.deductions[rubric.code]`
5. fallback por campo persistido oficial quando aplicável.

## 4) Tratamento final das rubricas canônicas

- `salario_liquido`:
  - prioriza payload por `id`/`code`;
  - fallback para `entry.netSalary` quando não materializado no payload.
- `salario_real` e `g2_complemento`:
  - leitura por payload (`id`/`code`);
  - sem fallback de cálculo paralelo.
- Se não houver valor persistido oficial disponível, o relatório mantém `0` (sem recalcular).

## 5) Tratamento final do INSS

- INSS tenta leitura por payload (`id` e `code`) como as demais rubricas.
- Em cenário legado, fallback para `entry.inssAmount` quando a rubrica possui classificação técnica `inss`.
- Sem recálculo.

## 6) Situação da exportação CSV/Excel

- Não há biblioteca `.xlsx` instalada/operacional específica para esse relatório no projeto.
- Exportação final é CSV UTF-8 compatível com Excel:
  - MIME `text/csv;charset=utf-8;`
  - extensão `.csv`
  - botão `Exportar CSV (Excel)`
  - toast `Exportação CSV concluída.`

## 7) Situação do PDF

- Mantido padrão atual via `window.print` (sem dependência nova).
- Confirmado no template de impressão:
  - `@page { size: A4 landscape; }`
  - título com empresa/competência
  - `thead { display: table-header-group; }`
  - linha de totais
  - rodapé obrigatório `Gerado por Reginatto SI — www.reginattosistemas.com.br — Contato: (65) 99210-2030`.

## 8) Situação da permissão `relatorios.view`

- Confirmada em todos os pontos críticos:
  - `AppPermission` no frontend
  - `PermissionRoute` na rota `/relatorios/por-empresa`
  - menu lateral com a mesma permissão
  - enum/seed no banco (`app_permission` + `role_permissions`) com `admin`, `operacional` e `consulta`.

## 9) Situação de folhas arquivadas

- Não aparecem no filtro de competência (`!batch.isArchived`).
- Não entram no dataset (`validBatchIds` somente de batches não arquivados).
- Não entram em totais, PDF ou CSV porque tudo deriva do mesmo dataset filtrado.
- Em entries legadas sem `payrollBatchId`, o relatório só inclui quando existe batch selecionado não arquivado na competência.

## 10) Testes executados

- `npm run build` ✅
- `npm run test` ❌ (falhas pré-existentes em suítes de `payrollSpreadsheet` e `EmployeeDrawer`, sem relação com este relatório)
- `npm run lint` ❌ (erros/warnings pré-existentes globais fora do escopo do relatório)

## 11) Riscos remanescentes

- Se rubrica calculada não for persistida nem em payload (`id/code`) nem em campo oficial de `payroll_entries`, o relatório exibirá `0` por desenho (sem recálculo).
- PDF por `window.print` depende do engine do navegador para paginação final em alguns ambientes.
