# Análise — Duplicação de Folha de Pagamento

## O que foi investigado

- PRDs obrigatórios:
  - `PRD-00 — Visão Geral do Produto`: backend apenas salva/carrega dados e não há múltiplas fontes de verdade.
  - `PRD-00B — Modelo Operacional Simplificado`: cálculo automático no frontend, sem botão ou fluxo de recálculo.
  - `PRD-01 — Motor de Cálculo e Central de Folha`: campos manuais são editáveis e campos derivados são calculados automaticamente.
  - `PRD-03 — Central de Folha`: competência visível vem de folhas formais existentes em `payroll_batches`; ações principais incluem “Criar nova folha”.
  - `PRD-09 — Duplicação de Folha`: duplicação deve copiar estrutura/valores básicos manuais e nascer em `em_edicao`.
  - `PRD-12 — Rubricas Canônicas do Sistema`: `salario_real`, `g2_complemento` e `salario_liquido` são derivados do cálculo frontend.
- Estrutura atual da Central:
  - `src/pages/Index.tsx` concentra o fluxo da Central e já usa `PayrollHeader`, `PayrollTable`, `EmployeeDrawer`, `TotalsBar` e dialogs do projeto.
  - `src/components/payroll/PayrollHeader.tsx` concentra seletores de empresa/competência e ações principais.
  - `src/contexts/PayrollContext.tsx` é a fonte atual para empresas, folhas, lançamentos, rubricas e persistência via Supabase.
  - `src/lib/payrollSpreadsheet.ts` contém o cálculo único frontend consumido por Central, Drawer, Totais e Recibos.
  - `src/lib/payrollDuplicationGuard.ts` já existia como proteção para remover rubricas derivadas de payloads duplicados.
- Estrutura de banco/migrações:
  - `payroll_batches` representa a folha formal por empresa + mês + ano.
  - `payroll_entries` representa os lançamentos por funcionário, vinculados opcionalmente a `payroll_batch_id` e mantendo `company_id/month/year` por compatibilidade transitória.
  - Há unicidade em `payroll_batches(company_id, month, year)` e em `payroll_entries(company_id, month, year, employee_id)`.

## Estrutura encontrada

- Folha/competência:
  - Identificada por `PayrollBatch` (`companyId`, `month`, `year`, `status`).
  - A competência exibida na Central é derivada de `payroll_batches`, não de meses vazios.
- Empresa ativa:
  - `activeCompanies` filtra `companies` por `isActive` no `PayrollContext`.
  - A Central usa `selectedCompany` e `setSelectedCompany`.
- Funcionários na folha:
  - São os registros em `payroll_entries` vinculados à folha atual por `payrollBatchId` ou por compatibilidade `companyId/month/year`.
- Rubricas:
  - Rubricas ativas vêm de `rubricas`.
  - Rubricas manuais copiáveis foram tratadas como `isActive && nature === "base" && calculationMethod === "manual"`.
  - Rubricas calculadas são `nature === "calculada"` e não são persistidas como valor fixo na nova folha.
- Competência:
  - Representada como `{ month, year }` (`PayrollMonth`).
  - No modal, folha base vem apenas de batches existentes; nova competência é informada por input mensal.
- Lógica parcial de duplicação:
  - Existia `stripDerivedRubricsFromPayload` para remover rubricas derivadas do payload, mas não existia fluxo completo de UI/persistência para criar folha nova.

## Arquivos alterados

- `src/contexts/PayrollContext.tsx`
  - Expôs `allPayrollBatches` para montagem do seletor de folhas existentes.
  - Adicionou `duplicatePayroll`, com modo individual e modo todas as empresas.
  - Reutilizou `stripDerivedRubricsFromPayload` para impedir cópia de rubricas calculadas.
- `src/components/payroll/PayrollDuplicationDialog.tsx`
  - Novo dialog compacto, criado porque não havia componente equivalente de duplicação.
  - Reutiliza componentes existentes (`Dialog`, `Select`, `RadioGroup`, `Checkbox`, `Button`, `Input`, `Separator`) e `sonner`.
- `src/components/payroll/PayrollHeader.tsx`
  - Adicionou ação “Criar nova folha” no conjunto de ações da Central.
- `src/pages/Index.tsx`
  - Controla abertura/fechamento do dialog de duplicação.

## Como funciona a duplicação

### Modo individual

1. Usuário abre “Criar nova folha”.
2. Seleciona empresa ativa.
3. Seleciona folha base existente daquela empresa.
4. Informa nova competência.
5. Marca/desmarca rubricas manuais.
6. Ao confirmar, o contexto valida:
   - empresa selecionada;
   - folha base existente;
   - nova competência preenchida e diferente da base;
   - inexistência de `payroll_batch` na nova competência;
   - existência de lançamentos na folha base.
7. O sistema cria um novo `payroll_batch` com status `em_edicao`.
8. O sistema cria novos `payroll_entries` para os funcionários da folha base.
9. São copiados apenas os valores de rubricas manuais selecionadas.
10. Rubricas desmarcadas ficam ausentes/zeradas no payload.
11. Rubricas calculadas não são copiadas como valor fixo.
12. Após sucesso, a Central seleciona a empresa e a nova competência criada.
13. O dialog troca para um feedback central de sucesso.

## Como funciona o modo lote

- O modo “Todas as empresas” não usa uma empresa única como origem.
- Para cada empresa ativa:
  1. Localiza a folha daquela empresa na competência base.
  2. Valida se a nova competência já existe para aquela empresa.
  3. Valida se a folha base possui lançamentos.
  4. Cria a folha da nova competência em `em_edicao`.
  5. Copia os lançamentos e somente os valores manuais selecionados.
- Erros/impedimentos de uma empresa não bloqueiam as demais.
- O resultado central mostra contadores de criadas, ignoradas por duplicidade, ignoradas por ausência de base, ignoradas por base vazia e erros críticos.

## Validações implementadas

- Competência nova diferente da base.
- Empresa obrigatória no modo individual.
- Existência de empresas ativas no modo lote.
- Folha base existente.
- Bloqueio de folha duplicada na nova competência.
- Existência de lançamentos na folha base.
- Cópia limitada às rubricas ativas, base e manuais.
- Remoção defensiva de rubricas derivadas do payload antes da cópia.

## Limitações encontradas

- Não foi criada transação SQL/RPC dedicada; a implementação segue o padrão frontend atual, usando Supabase diretamente pelo `PayrollContext`.
- Em caso de falha após criação do batch e antes da inserção dos lançamentos, o código tenta remover o batch recém-criado para evitar folha vazia acidental.
- O modo lote processa sequencialmente para manter previsibilidade e permitir resumo parcial claro.
- Não foi alterado recibo, relatório, cadastro de rubricas ou motor de cálculo.

## Pontos para teste manual

- Abrir a Central de Folha e clicar em “Criar nova folha”.
- Modo individual:
  - selecionar empresa;
  - selecionar folha base existente;
  - informar competência nova;
  - marcar/desmarcar rubricas;
  - confirmar criação;
  - validar feedback central;
  - validar que a Central carrega a nova competência;
  - abrir funcionários e conferir rubricas copiadas/zeradas;
  - conferir que Salário Real, G2 Complemento e Salário Líquido continuam automáticos.
- Modo todas as empresas:
  - selecionar competência base comum;
  - informar competência nova;
  - confirmar criação;
  - conferir resumo central;
  - validar que empresas sem base ou com folha já criada são ignoradas sem quebrar o processamento.
- Testar tentativa de duplicar para competência já existente.
- Testar folha base sem lançamentos.
- Verificar que recibos e relatórios não tiveram comportamento alterado.

## Riscos futuros identificados

- Se o projeto evoluir para transações/RPCs de folha, a duplicação pode migrar para uma operação transacional no backend sem alterar a regra de cálculo.
- Se rubricas de método `valor_fixo`, `percentual` ou `formula` passarem a ser consideradas “copiáveis” por regra de negócio, será necessário explicitar isso no PRD antes de alterar o filtro atual.
- Se `base_salary` ainda for usado por integrações externas legadas, pode ser necessário revisar se ele deve continuar zerado na duplicação ou ser sincronizado após edição normal no Drawer.

## Revisão pós-PR — riscos validados

### `base_salary`

Foi confirmado que `base_salary` ainda aparece como campo persistido de `payroll_entries`, é atualizado pelo Drawer a partir de `spreadsheetPreview.baseSalary` e ainda aparece como fallback em pontos legados, especialmente no recibo quando não há rubrica de salário fiscal/CTPS disponível.

Decisão aplicada: `base_salary` **não deve ser zerado fixamente** na duplicação. A nova folha passa a gravar `base_salary` a partir dos valores manuais efetivamente copiados, usando o mesmo cálculo frontend da Central (`calculatePayroll`). Assim:

- se o usuário copiar rubricas manuais de salário/proventos, `base_salary` nasce coerente com essas rubricas;
- se o usuário desmarcar essas rubricas, `base_salary` nasce zero junto com os valores manuais desmarcados;
- não foi criado cálculo novo nem recálculo backend.

### Filtro de rubricas copiáveis

O filtro `isActive && nature === "base" && calculationMethod === "manual"` foi mantido.

Evidências:

- o contrato de rubricas separa rubricas-base (input operacional) de rubricas calculadas (saída readonly);
- o cadastro inicial cria rubricas como `nature: "base"` e `calculationMethod: "manual"`;
- a regra específica do INSS exige `nature = base` e `calculation_method = manual` nas migrations;
- rubricas `valor_fixo`, `percentual` e `formula` existem no cadastro, mas não são “valores manuais selecionados pelo usuário” para esta duplicação.

Conclusão: para o escopo PRD-09, o filtro está correto. Se futuramente a operação quiser copiar rubricas base de outros métodos, isso deve ser definido em PRD/tarefa própria.

### Segurança do modo “Todas as empresas”

O lote continua processando empresa por empresa. A duplicação não usa uma empresa única como base; para cada empresa ativa, localiza a folha da competência base daquela própria empresa.

Risco revisado: criação parcial de batch sem lançamentos. Mitigação atual:

- se a folha base não existe, já possui destino ou está sem lançamentos, nada é criado para aquela empresa;
- se o batch novo é criado e a inserção dos lançamentos falha, o código tenta excluir o batch recém-criado;
- se essa limpeza também falhar por alguma condição externa, não há transação SQL dedicada nesta versão. Essa limitação permanece documentada porque criar RPC/transação seria mudança estrutural maior que o refinamento solicitado.

Conclusão: o modo lote está seguro para o padrão frontend/Supabase atual e não bloqueia empresas seguintes; a única limitação restante é ausência de transação atômica backend.

### Testes falhados

Foram investigados os testes apontados:

- `src/lib/payrollSpreadsheet.test.ts`;
- `src/components/payroll/EmployeeDrawer.test.tsx`.

Comparação executada contra o commit anterior (`HEAD^`, antes da duplicação): os mesmos arquivos já falhavam com as mesmas 6 falhas principais de resolução canônica/alerta. Portanto, as falhas são débito antigo/preexistente e **não foram introduzidas pela duplicação de folha**.
