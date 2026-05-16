# Análise 1 — Auditoria das rubricas e integração com Central de Folha

Data da auditoria: 2026-05-16

## 1. Diagnóstico geral

A auditoria confirmou que o frontend já segue parte importante do modelo operacional dos PRDs: o usuário digita valores no drawer, a prévia é calculada imediatamente no frontend e a Central usa a função compartilhada de cálculo para tabela, drawer e barra de totais.

Entretanto, o sistema ainda não está totalmente seguro para avançar para Recibos e Relatórios sem correções pontuais. Há três achados principais:

1. **Alerta de rubricas canônicas não é necessariamente falso positivo.** Ele aparece quando qualquer uma das três rubricas canônicas obrigatórias (`salario_real`, `g2_complemento`, `salario_liquido`) não é resolvida por `code` em uma rubrica ativa e calculada. Isso inclui rubrica ausente, duplicada por código, duplicada por nome legado ou resolvida apenas por nome legado.
2. **Há divergência de fonte de cálculo entre frontend e backend.** O PRD determina frontend como cálculo operacional e backend como persistência. Hoje existe uma função backend `recalculate_payroll_batch` que recalcula/materializa rubricas derivadas e totais após salvar/abrir, ainda que sem botão manual. Isso cria risco de Central, recibo e relatório consumirem fontes diferentes.
3. **Há diferença de regra entre totalização frontend e backend.** O frontend soma todas as rubricas ativas por tipo, inclusive calculadas; o backend documenta e implementa totais operacionais somando somente rubricas-base. Esse ponto pode gerar divergência em `earnings_total`, `deductions_total`, `net_salary` e futuros documentos, principalmente se rubricas derivadas forem salvas/materializadas no payload.

Conclusão objetiva: **o fluxo manual simples está próximo do modelo planilha, mas a integração canônica/derivada ainda precisa de ajuste antes de avançar para Recibos e Relatórios.**

## 2. Arquivos analisados

### PRDs obrigatórios

- `public/PRD/PRD-00 — Visão Geral do Produto.txt`
- `public/PRD/PRD-00B — Modelo Operacional Simplificado.txt`
- `public/PRD/PRD-01 — Motor de Cálculo e Central de Folha.txt`
- `public/PRD/PRD-02 — Cadastro de Rubricas.txt`
- `public/PRD/PRD-03 — Central de Folha.txt`
- `public/PRD/PRD-07 — Recibos de Pagamento.txt`
- `public/PRD/PRD-08 — Módulo de Relatórios (Folha App).txt`
- `public/PRD/PRD-12 — Rubricas Canônicas do Sistema.txt`

### Frontend / tipos / testes

- `src/types/payroll.ts`
- `src/lib/payrollSpreadsheet.ts`
- `src/lib/payrollSpreadsheet.test.ts`
- `src/components/payroll/EmployeeDrawer.tsx`
- `src/components/payroll/EmployeeDrawer.test.tsx`
- `src/components/payroll/PayrollTable.tsx`
- `src/components/payroll/TotalsBar.tsx`
- `src/components/payroll/PayrollHeader.tsx`
- `src/pages/Index.tsx`
- `src/pages/Rubrics.tsx`
- `src/contexts/PayrollContext.tsx`
- `src/App.tsx`

### Backend / persistência / migrations

- `supabase/migrations/20260405001000_create_rubricas_module.sql`
- `supabase/migrations/20260418183949_4e3aa22b-85f5-46cc-a5f2-f3db7efbddc8.sql`
- `supabase/migrations/20260419110000_block1_central_payroll_rls.sql`
- `supabase/migrations/20260419123000_block2_payroll_batches_and_entries_link.sql`
- `supabase/migrations/20260419140000_block3_backend_recalculation_minimal.sql`
- `supabase/migrations/20260419153000_adjust_block3_recalc_prd01_alignment.sql`
- `supabase/migrations/20260419170000_fix_inss_manual_rule.sql`
- `supabase/migrations/20260419190000_formula_engine_execution_backend.sql`
- `supabase/migrations/20260419203000_guard_duplicate_derived_rubrics.sql`
- `supabase/migrations/20260423110000_payroll_batch_status_operacional.sql`

## 3. Fluxo atual das rubricas

### Cadastro (`/rubricas`)

- A tela usa o contexto `usePayroll()` e grava via `addRubric`, `updateRubric` e `deleteRubric`.
- Rubricas possuem contrato com `code`, `name`, `type`, `nature`, `calculationMethod`, `classification`, `order`, `isActive`, campos condicionais e `formulaItems`.
- Nova rubrica nasce como:
  - `type = provento`;
  - `nature = base`;
  - `calculationMethod = manual`;
  - `classification = null`;
  - `isActive = true`.
- A validação exige classificação para rubrica **base ativa** e bloqueia classificação/override manual para rubrica **calculada**.
- A tela permite criar rubrica calculada (`nature = calculada`) e escolher método `manual`, `valor_fixo`, `percentual` ou `formula`. Apesar de o PRD simplificado falar em rubrica calculada como derivada, o formulário ainda expõe mais métodos que apenas soma/subtração.
- Rubricas calculadas aparecem na listagem de `/rubricas`; a ação mostra “Visualizar” no menu, mas o modal ainda mantém campos e botão “Salvar”, com alguns bloqueios parciais como natureza desabilitada em edição.

### Carregamento global

- `PayrollContext` busca todas as rubricas de `public.rubricas` com os itens de fórmula (`rubrica_formula_items`) e mantém em estado global `rubrics`.
- Rubricas são globais, não por empresa. A Central recebe a mesma lista via contexto.

### Uso na Central

- `/central-de-folha` (`Index.tsx`) repassa `rubrics` para `PayrollTable` e `EmployeeDrawer`.
- O drawer filtra somente rubricas ativas.
- Rubricas `nature !== calculada` aparecem como inputs editáveis; rubricas `nature === calculada` aparecem no bloco de Resultados como somente leitura.
- Proventos/descontos são agrupados por `type`, não por nome.

## 4. Fluxo atual do cálculo

### Frontend

O cálculo operacional principal está em `src/lib/payrollSpreadsheet.ts`:

1. Filtra rubricas ativas.
2. Inicializa valores manuais apenas para rubricas não calculadas.
3. Resolve rubricas calculadas em passes simples.
4. Para método `formula`, soma/subtrai `formulaItems` por `sourceRubricId`.
5. Para `valor_fixo` e `percentual`, calcula valores diretamente.
6. Calcula totais, INSS, base e líquido.
7. Resolve os três resultados canônicos por rubricas calculadas ativas e `code` canônico, com fallback legado por nome.

Isso atende parcialmente ao modelo “frontend calcula imediatamente”, pois o drawer usa `useMemo` para recalcular a cada alteração de estado local. Porém, há ressalvas:

- O frontend aceita métodos além de soma/subtração (`valor_fixo` e `percentual`).
- A totalização frontend soma rubricas calculadas junto com base, o que pode gerar dupla contagem quando derivadas de provento/desconto entram em `earningsTotal`/`deductionsTotal`.
- Existe fallback por nome legado para rubricas canônicas, explicitamente transitório, mas ainda é heurística por nome em um ponto sensível.

### Backend

O backend possui RPC `recalculate_payroll_batch` que:

- Carrega rubricas ativas.
- Recalcula rubricas derivadas (`formula`, `valor_fixo`, `percentual`).
- Materializa derivadas dentro de `earnings`/`deductions` do `payroll_entries`.
- Atualiza `earnings_total`, `deductions_total`, `inss_amount` e `net_salary`.

Esse comportamento conflita com a diretriz dos PRDs obrigatórios de que backend apenas salva/carrega dados. Ainda que automático e sem botão de recálculo, continua sendo uma segunda fonte de cálculo.

## 5. Origem do alerta de inconsistência

Mensagem investigada:

> “Há inconsistências no cadastro das rubricas canônicas. Revise o cadastro.”

### Validação que dispara

A origem é `EmployeeDrawer.tsx`, que chama:

- `diagnoseCanonicalDerivedRubrics(activeRubricsOrdered)`;
- `hasCanonicalRubricInconsistency(canonicalDiagnosis)`;
- depois monta `canonicalDiagnosticMessage` conforme os status encontrados.

A função `diagnoseCanonicalDerivedRubrics` considera apenas rubricas:

- `isActive === true`;
- `nature === calculada`.

Para cada código canônico ela procura, primeiro, `rubric.code` normalizado igual a:

- `salario_real`;
- `g2_complemento`;
- `salario_liquido`.

Os status possíveis são:

- `resolved_by_code` — único status considerado totalmente consistente;
- `resolved_by_legacy_name` — achou por nome legado, mas não por código;
- `missing` — não encontrou;
- `ambiguous_code` — mais de uma rubrica calculada ativa com o mesmo código canônico;
- `ambiguous_name` — mais de uma rubrica calculada ativa com nome legado compatível.

`hasCanonicalRubricInconsistency` retorna `true` para qualquer status diferente de `resolved_by_code`.

### O alerta está correto?

Depende do cadastro real:

- **Correto** se qualquer canônica estiver ausente, inativa, com `nature` diferente de `calculada`, com `code` não canônico, duplicada ou resolvida só por nome legado.
- **Falso positivo operacional** se a decisão de produto for que canônicas não devem depender de cadastro em `/rubricas`, mas sim de cálculo interno fixo da Central. Nesse caso, exigir três rubricas calculadas cadastradas se torna uma validação desalinhada com o modelo simplificado.

### Problema no cadastro ou na lógica?

Pelo código, a lógica é determinística e rastreável. O problema provável é um dos dois:

1. **Cadastro desalinhado ao PRD-12:** as três rubricas existem, mas com `code` diferente, inativas ou não calculadas; ou alguma não existe.
2. **Decisão de modelagem ainda ambígua:** PRD-12 define rubricas canônicas como resultados finais consistentes, mas não deixa explícito se devem ser cadastráveis em `/rubricas`. O código escolheu tratá-las como rubricas calculadas cadastradas, o que aumenta o atrito operacional.

### Deve aparecer para usuário final?

Recomendação: **não com essa redação para usuário final comum.**

- Para administrador/técnico de folha: pode aparecer como diagnóstico de configuração, idealmente com detalhe objetivo de qual canônica está ausente/ambígua.
- Para operador final no drawer: a mensagem atual expõe uma inconsistência técnica que ele provavelmente não consegue corrigir ali. O ideal é reduzir a exposição no drawer ou condicionar a perfis técnicos/ambiente de desenvolvimento, sem remover a validação.

## 6. Validação das rubricas canônicas

Rubricas canônicas esperadas pelo PRD-12:

- `salario_real`
- `g2_complemento`
- `salario_liquido`

### Como são tratadas hoje

- São tratadas como **rubricas calculadas ativas cadastradas** em `rubricas`.
- A resolução canônica só é considerada íntegra quando `nature = calculada`, `isActive = true` e `code` é exatamente o código canônico normalizado.
- No drawer, aparecem no bloco “Resultados”, como readonly, quando resolvidas.
- Na tabela e barra de totais, são usadas como colunas/cards finais via `calculatePayrollFromEntry` e `calculatePayrollTotals`.

### Estão sendo tratadas como resultado final?

Sim, na Central elas são exibidas como resultados finais. Mas tecnicamente ainda são registros editáveis/cadastráveis no módulo `/rubricas`, o que mistura “configuração estrutural do sistema” com cadastro operacional do usuário.

### Estão sendo tratadas indevidamente como rubricas comuns?

Parcialmente sim:

- Não aparecem como inputs no drawer, então não são rubricas manuais comuns na Central.
- Mas aparecem na tela `/rubricas` junto das demais, podem ser abertas pelo mesmo fluxo, podem ser inativadas pelo menu e ainda têm botão Salvar no modal. Isso cria risco operacional.

### Faz sentido permitir edição dessas rubricas?

Recomendação: **não para usuário operacional.**

Faz sentido permitir apenas uma visualização/configuração técnica controlada, porque as canônicas são contrato do sistema e devem garantir consistência entre Central, Recibos e Relatórios.

### Cadastro atual alinhado ao PRD-12?

Parcialmente:

- Alinhado: usa códigos canônicos e evita lógica paralela na UI quando tudo está cadastrado corretamente.
- Não totalmente alinhado: há fallback por nome legado e há dependência de cadastro editável para campos que o PRD descreve como rubricas finais padrão do sistema.

### Risco de duplicidade

Sim. Há risco de duplicidade entre:

- campo canônico calculado (`salarioReal`, `g2Complemento`, `salarioLiquido` no resultado da função);
- rubrica derivada materializada em `earnings`/`deductions` pelo backend;
- totais persistidos em colunas (`earnings_total`, `deductions_total`, `net_salary`).

Esse risco aumenta se Recibos/Relatórios consumirem colunas persistidas enquanto a Central recalcula pelo frontend, ou se consumirem payload com derivadas materializadas junto de rubricas-base.

## 7. Validação de rubricas manuais novas

Simulação: usuário cria uma rubrica manual em `/rubricas`.

### Ela aparece automaticamente no drawer?

Sim, desde que:

- esteja ativa (`isActive = true`);
- esteja carregada no contexto `rubrics` após salvar;
- tenha `nature !== calculada`.

O drawer filtra rubricas ativas e separa as não calculadas em inputs.

### Respeita tipo `provento` ou `desconto`?

Sim. O agrupamento do drawer usa `rubric.type`:

- `provento` vai para seção Proventos;
- `desconto` vai para seção Descontos.

### Salva valor por funcionário/competência?

Sim. O valor digitado é salvo no `payroll_entries` daquele lançamento, que possui:

- `employee_id`;
- `company_id`;
- `month`;
- `year`;
- vínculo opcional/atual com `payroll_batch_id`.

Os valores de rubricas são gravados em JSONB:

- `earnings` para proventos;
- `deductions` para descontos;
- chave principal: `rubric.id`.

### Entra no cálculo imediatamente?

Sim. Ao alterar o valor no drawer, o estado local `rubricValues` muda e `calculatePayroll` recalcula a prévia via `useMemo`, sem salvar.

### Aparece nos dados de recibo/relatório futuro?

Potencialmente sim, porque fica persistida em `payroll_entries.earnings`/`deductions` por `rubric.id`. Mas Recibos/Relatórios ainda não estão implementados. Para garantir consistência, eles devem consumir o mesmo payload e o mesmo catálogo de rubricas, sem recalcular.

### Existe filtro que impede aparecer?

Sim:

- rubrica inativa não aparece;
- rubrica `nature = calculada` não aparece como input, só como resultado;
- permissões/RLS podem impedir carregar rubricas para usuário sem permissão adequada.

### Existe dependência de código, nome ou ordem fixa?

Para rubricas manuais comuns, não há dependência de nome/código fixo para aparecer no drawer. A ordem de exibição depende de `order`. O código/nome são usados para label, e o `id` é usado para persistência/cálculo.

## 8. Validação de rubricas derivadas novas

### O usuário pode criar derivadas?

Sim. A tela `/rubricas` permite escolher `nature = calculada` e `calculationMethod`.

### Como a fórmula é armazenada?

Fórmulas são armazenadas em linhas estruturadas em `rubrica_formula_items`:

- `rubrica_id`;
- `operation` (`add` ou `subtract`);
- `source_rubrica_id`;
- `item_order`.

Não é armazenada como texto livre no frontend.

### Como a fórmula é interpretada?

Frontend:

- ordena `formulaItems` por `order`;
- busca fonte por `sourceRubricId`;
- soma ou subtrai o valor da rubrica fonte.

Backend:

- também lê `rubrica_formula_items`;
- cria tokens por ID;
- avalia expressão estruturada;
- materializa derivadas no payload.

### O cálculo aceita apenas soma e subtração?

Para método `formula`, sim: apenas `add` e `subtract`.

Mas o cadastro e o cálculo também aceitam `valor_fixo` e `percentual`, que extrapolam a formulação mínima dos PRDs obrigatórios desta tarefa. Isso deve ser decidido: manter como legado controlado ou simplificar para aderência estrita ao PRD.

### Existe parser complexo ou heurística por nome?

- Frontend: não há parser textual; fórmula é por itens estruturados. Há fallback por nome apenas na resolução das canônicas.
- Backend: há função de avaliação de expressão em SQL para os tokens gerados a partir dos itens. Mesmo não sendo texto livre do usuário, é mais complexo que o modelo “somar/subtrair lista de IDs”.

### Alguma fórmula depende de nome da rubrica?

As fórmulas não dependem de nome; dependem de `sourceRubricId`. A exceção é a resolução canônica que aceita fallback por nome legado para encontrar os três resultados finais.

### Rubricas derivadas aparecem como somente leitura?

Na Central, sim: aparecem no bloco Resultados e não como inputs. Em `/rubricas`, aparecem na listagem e podem ser abertas em modal com ação “Visualizar”; porém a UI ainda permite interação com campos e mantém botão Salvar, então a proteção é incompleta do ponto de vista operacional.

### Risco de derivada que o sistema não sabe exibir/calcular

Sim:

- derivada inativa não aparece;
- derivada ativa sem itens de fórmula não deve salvar, mas dados legados podem existir;
- derivada com método `manual` e `nature = calculada` pode existir via UI, mas no cálculo vira 0 por fallback;
- derivada percentual pode depender da ordem de processamento do backend/frontend;
- derivada não canônica aparece no drawer em Resultados, mas tabela/totais principais só destacam as três canônicas.

## 9. Riscos encontrados

1. **Validação canônica exposta ao operador.** O alerta é técnico e pode aparecer para quem não tem ação possível no drawer.
2. **Dependência de cadastro editável para campos canônicos.** As canônicas são contrato do sistema; se forem inativadas/editadas, a Central perde resultados.
3. **Fallback por nome legado.** Ajuda compatibilidade, mas viola a preferência dos PRDs por identificador estável e sem heurística por nome.
4. **Backend recalcula.** A RPC `recalculate_payroll_batch` cria uma segunda fonte de cálculo, contrária aos PRDs lidos.
5. **Divergência de totais frontend/backend.** Frontend soma rubricas calculadas por tipo; backend soma somente rubricas-base.
6. **Persistência de derivadas em payload.** Backend pode inserir derivadas em `earnings`/`deductions`; o drawer salva apenas manuais, mas o próximo carregamento pode trazer payload misto.
7. **Recibos/Relatórios ainda sem implementação.** Não há garantia prática de que consumirão exatamente a mesma fonte da Central.
8. **Métodos além de soma/subtração.** `valor_fixo` e `percentual` adicionam complexidade além do PRD simplificado obrigatório.
9. **RLS de rubricas pode impactar Central.** A policy de rubricas exige `rubricas.manage` para select; se operador de folha não tiver essa permissão, a Central pode não carregar rubricas e consequentemente não exibir/calcular corretamente.
10. **Status de duplicação inconsistente em migration futura.** `duplicate_payroll_batch` usa status `'draft'`, enquanto PRD-03/status atual usa `em_edicao`, `em_revisao`, `finalizado`. Fora do fluxo principal desta auditoria, mas é risco para PRD-09/futuro.

## 10. Recomendações objetivas

1. **Antes de avançar para Recibos/Relatórios, corrigir a fonte única de cálculo.** Escolher explicitamente: se PRDs obrigatórios prevalecem, o backend não deve recalcular valores operacionais; deve persistir o que a Central calculou/salvou ou apenas armazenar valores manuais e deixar documentos lerem a mesma saída persistida pela Central.
2. **Ajustar a totalização frontend para não haver dupla contagem.** A regra deve ser única entre `payrollSpreadsheet.ts` e qualquer persistência: totais operacionais devem somar somente rubricas-base, enquanto canônicas são resultados finais.
3. **Tratar canônicas como configuração interna/protegida.** Não deveriam ser editáveis como rubricas comuns. Se permanecerem em `/rubricas`, exibir como “sistema/readonly” com bloqueio real de edição/inativação para usuário comum.
4. **Melhorar o alerta canônico.** Manter a validação, mas ajustar exposição:
   - usuário final: ocultar ou mostrar mensagem operacional genérica apenas se impedir resultado;
   - admin/técnico: mostrar diagnóstico por código (`missing`, `ambiguous_code`, `resolved_by_legacy_name`).
5. **Remover dependência final de fallback por nome.** Manter temporariamente apenas como migração/compatibilidade, mas considerar inconsistência bloqueante para ambiente produtivo.
6. **Revisar RLS de rubricas para a Central.** Usuário com `folha.operar` precisa conseguir ler rubricas ativas necessárias ao cálculo, mesmo sem permissão de gerenciar cadastro.
7. **Simplificar cadastro conforme PRD atual.** Se o escopo obrigatório é soma/subtração, esconder ou congelar `valor_fixo`/`percentual` até haver PRD específico, ou registrar formalmente que são legado suportado.
8. **Definir contrato de Recibos/Relatórios agora.** Eles devem ler os mesmos valores exibidos pela Central, sem chamar RPC de recálculo e sem recompor fórmulas.

## 11. Perguntas pendentes

1. As rubricas canônicas devem continuar existindo como registros em `rubricas`, ou devem virar configuração interna protegida do sistema?
2. Operadores de folha terão permissão `rubricas.manage`? Se não, qual permissão deve liberar leitura do catálogo de rubricas para cálculo da Central?
3. Os métodos `valor_fixo` e `percentual` são requisito atual ou legado a ser ocultado para aderir ao PRD simplificado?
4. Recibos/Relatórios devem consumir valores derivados persistidos em JSONB ou uma estrutura consolidada gerada pela Central no momento de salvar?
5. O backend RPC de recálculo deve ser removido/desativado para aderência estrita aos PRDs, ou será mantido como rotina técnica de saneamento? Se mantido, precisa de PRD explícito porque hoje conflita com a regra principal.

## 12. Checklist final — podemos avançar?

- [x] Usuário digita valores manuais no drawer.
- [x] Frontend recalcula imediatamente a prévia do drawer.
- [x] Rubricas manuais novas tendem a aparecer automaticamente na Central se ativas e não calculadas.
- [x] Valores manuais são persistidos por lançamento vinculado a funcionário, empresa e competência/folha.
- [x] Fórmulas por itens usam identificadores estáveis (`sourceRubricId`) e operações de soma/subtração.
- [ ] Backend atua apenas como persistência — **não atendido hoje**, pois há RPC de recálculo/materialização.
- [ ] Não existe múltipla fonte de verdade — **não atendido integralmente**, pois há cálculo frontend, cálculo backend, payload JSONB e colunas de totais.
- [ ] Central, Recibos e Relatórios mostram os mesmos valores — **ainda não comprovado**, pois Recibos/Relatórios não estão implementados e há risco de fontes diferentes.
- [ ] Canônicas estão protegidas contra edição indevida — **não atendido totalmente**, pois aparecem no cadastro de rubricas e podem ser manipuladas/inativadas.
- [ ] Alerta da Central é adequado ao usuário final — **não recomendado no formato atual**.

### Decisão recomendada

**Não avançar diretamente para Recibos e Relatórios antes de corrigir os pontos de fonte única e canônicas.**

Pode avançar com desenvolvimento pontual da Central apenas se as próximas tarefas forem:

1. alinhar `payrollSpreadsheet.ts` e persistência para uma única regra de totais;
2. definir/proteger o tratamento das três canônicas;
3. ajustar a mensagem de inconsistência para perfil técnico ou diagnóstico admin;
4. garantir que leitura de rubricas necessária à Central não dependa de permissão de gerenciamento;
5. documentar/remover o recálculo backend conforme a regra principal do Folha App.

## Alinhamento com a regra principal do Folha App

| Regra principal | Estado atual | Observação |
| --- | --- | --- |
| Usuário digita | Alinhado | Drawer opera por inputs manuais de rubricas-base. |
| Frontend calcula imediatamente | Parcialmente alinhado | Prévia/tabela/totais usam função frontend compartilhada. |
| Backend apenas persiste | Não alinhado | RPC backend recalcula/materializa após salvar/abrir. |
| Central, Recibos e Relatórios mostram os mesmos valores | Não comprovado | Recibos/Relatórios estão futuros e há risco de fonte divergente. |
| Não existe recálculo manual | Alinhado na UI | Não há botão de recálculo; existe recálculo automático backend. |
| Não existe múltipla fonte de verdade | Não alinhado integralmente | Cálculo frontend + backend + colunas persistidas + JSONB misto. |
