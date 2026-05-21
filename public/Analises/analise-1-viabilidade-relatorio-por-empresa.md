# Análise de Viabilidade — Relatório por Empresa com colunas dinâmicas por rubricas

## 1) Diagnóstico da estrutura atual

A viabilidade é **alta** para implementar o relatório por empresa sem alterar o motor de cálculo.

O projeto já possui os pilares necessários:

- Cadastro global de rubricas com ordenação (`display_order`) e metadados técnicos (`code`, `nature`, `calculation_method`, `classification`).
- Lançamentos por funcionário em `payroll_entries` com valores em JSON (`earnings`, `deductions`) e totais persistidos.
- Estrutura formal de folha por empresa/competência em `payroll_batches`, com `status` operacional e `is_archived`.
- Contexto frontend (`PayrollContext`) que já consolida empresas, competências, rubricas e lançamentos para a Central.

Conclusão: o módulo de relatório pode ser construído como **camada de leitura/consolidação** sobre estruturas existentes, sem recalcular folha e sem hardcode de rubricas.

---

## 2) Mapeamento das tabelas/estruturas encontradas

## Banco (Supabase)

- `public.rubricas`
  - Cadastro técnico das rubricas do grupo.
  - Campos base: `id`, `name`, `code`, `type`, `display_order`, `is_active`, `entry_mode`, `allow_manual_override`.
  - Evolução canônica: `nature`, `calculation_method`, `classification`, `fixed_value`, `percentage_value`, `percentage_base_rubrica_id`.

- `public.rubrica_formula_items`
  - Itens estruturados de fórmula por rubrica calculada (`operation`, `source_rubrica_id`, `item_order`).

- `public.payroll_entries`
  - Valores da folha por funcionário, empresa e competência.
  - Campos-chave: `employee_id`, `company_id`, `month`, `year`, `earnings` (jsonb), `deductions` (jsonb), `base_salary`, `earnings_total`, `deductions_total`, `inss_amount`, `net_salary`, `payroll_batch_id`.

- `public.payroll_batches`
  - Cabeçalho da folha por empresa+competência.
  - Campos-chave: `company_id`, `month`, `year`, `status`, `is_archived`.

## Frontend

- `src/contexts/PayrollContext.tsx`
  - Carrega e normaliza `companies`, `employees`, `rubrics`, `payroll_entries`, `payroll_batches`.
  - Filtra competências ativas (`availableCompetences`) excluindo batch arquivado.
  - Filtra entradas por empresa/competência e por batch atual quando existe.

- `src/lib/payrollSpreadsheet.ts`
  - Motor frontend para cálculo e derivados canônicos.
  - Já resolve rubricas canônicas (`salario_real`, `g2_complemento`, `salario_liquido`), porém hoje mantém fallback legado por nome/code antigo.

- `src/lib/receiptData.ts`
  - Recibo atual usa agregações legadas e ainda depende de heurística textual em alguns pontos.

---

## 3) Como as rubricas funcionam hoje

- Rubricas são cadastradas em `rubricas` e podem ser:
  - `nature = base` (entrada operacional)
  - `nature = calculada` (derivada)

- Método de cálculo da rubrica (`calculation_method`):
  - `manual`, `valor_fixo`, `percentual`, `formula`.

- Fórmulas estruturadas ficam em `rubrica_formula_items` (sem texto livre).

- Ordenação para UI já existe em `display_order` (mapeado para `order` no frontend).

- Campo técnico estável para identidade é `code`.

Diagnóstico para relatório dinâmico: já existe base suficiente para colunas dinâmicas sem hardcode.

---

## 4) Como os valores da folha são armazenados/lidos

- Origem mensal por funcionário: `payroll_entries`.
- Valores por rubrica ficam em dois mapas JSON:
  - `earnings`
  - `deductions`
- Chaves dos mapas são compatíveis com id técnico de rubrica; há compatibilidade histórica para código/nome em parte do motor.
- Tabela também guarda totais persistidos (`earnings_total`, `deductions_total`, `net_salary`) para consumo direto.

Leitura atual na Central:
- Filtra por empresa selecionada + competência selecionada.
- Se existe `currentBatch`, usa vínculo por `payroll_batch_id`.
- Se não existe batch, cai no filtro legado por `company_id/month/year`.

---

## 5) Viabilidade de relatório dinâmico por rubricas

**Viável.**

Estratégia de viabilidade (sem implementação agora):

1. Selecionar empresa + competência (batch ativo, não arquivado).
2. Buscar rubricas ativas ordenadas por `display_order`.
3. Montar colunas fixas cadastrais (nome/setor/função/admissão/registro).
4. Montar colunas dinâmicas percorrendo rubricas configuradas.
5. Para cada funcionário, ler valor da rubrica diretamente de `payroll_entries.earnings/deductions` (sem cálculo).
6. Rodapé: somar coluna por coluna a partir dos valores lidos.

Atende PRD-08: leitura/consolidação visual, sem motor paralelo.

---

## 6) Proposta de arquitetura mínima

## Base única de dados para relatório
Criar (futuramente) um builder único de dataset, por exemplo:

- Entrada: `companyId`, `month`, `year` (ou `payrollBatchId`), `rubrics`, `employees`, `entries`.
- Saída:
  - metadados do relatório (empresa, competência)
  - `dynamicColumns` (rubricas)
  - `rows` (funcionários + valores por rubrica)
  - `totalsByRubric`

## Regra chave
- O builder **não chama** `calculatePayroll` / `calculatePayrollFromEntry`.
- Apenas extrai/normaliza números já persistidos em `payroll_entries`.

## Exportação
- Reutilizar o mesmo dataset para:
  - tabela em tela
  - PDF
  - Excel

Assim evita divergência entre formatos.

---

## 7) Sugestão de configuração de colunas (se necessária)

Status atual:
- Já existe `display_order` para ordem de coluna.
- Já existe `is_active` para controlar disponibilidade geral da rubrica.

Necessidade adicional provável:
- Falta um flag explícito para “aparece no relatório por empresa”.

Sugestão mínima futura (se usuário confirmar necessidade):
- `exibir_em_relatorio` (boolean, default true)
- **Sem** criar `grupo_relatorio` inicialmente.
- `ordem_relatorio` só se quiser separar ordem de cálculo/central da ordem de relatório; caso contrário, usar `display_order`.

Recomendação: começar sem novos campos e validar com `is_active + display_order`; adicionar `exibir_em_relatorio` apenas se surgir necessidade real de ocultar rubricas ativas da Central no relatório.

---

## 8) Riscos identificados

1. **Largura de PDF com muitas rubricas**
   - Estouro horizontal, fonte ilegível, quebra de página ruim.

2. **Payload legado misto por chave (id/code/name)**
   - Parte do ecossistema ainda tolera fallback legado.
   - Relatório deve priorizar leitura por `rubric.id` para previsibilidade.

3. **Rubricas canônicas com cadastro inconsistente**
   - O motor atual admite fallback por nome em compatibilidade.
   - Para relatório previsível, priorizar código canônico e expor ausência/ambiguidade como aviso de cadastro.

4. **Entradas sem batch em cenários de transição**
   - Contexto já tem fallback legado; relatório deve adotar a mesma lógica para não “sumir” dados antigos.

5. **Performance em competências grandes**
   - Muitos funcionários × muitas rubricas aumenta custo de render e export.

---

## 9) Perguntas pendentes para o usuário

1. O relatório deve exibir **todas** as rubricas ativas, ou apenas um subconjunto configurável?
2. Se houver subconjunto, preferem controle por:
   - flag simples `exibir_em_relatorio`, ou
   - seleção manual por relatório?
3. Em caso de muitas colunas no PDF, preferem:
   - paisagem + fonte reduzida,
   - quebra em blocos de colunas,
   - ou múltiplas páginas horizontais (“painel 1/2/3”)?
4. Exportação Excel deve sair com:
   - uma aba única,
   - ou abas separadas (dados + totais)?
5. Linhas de funcionários inativos devem aparecer se houver lançamento na competência?
6. Quando empresa estiver inativa, mas possuir folhas históricas, usuário com permissão deve consultar?

---

## 10) Plano recomendado de implementação em etapas (futuro)

1. **Etapa 1 — Dataset único de relatório (sem UI nova complexa)**
   - Construir função utilitária de montagem (somente leitura).
   - Garantir 0 recálculo.

2. **Etapa 2 — Tabela em tela com colunas dinâmicas**
   - Reusar padrões existentes de layout/filtro/tabela.
   - Filtros: empresa + competência (somente batches não arquivados).

3. **Etapa 3 — Exportadores sobre mesma base**
   - PDF e Excel consumindo exatamente o mesmo dataset.

4. **Etapa 4 — Tratamento de casos-limite visuais**
   - Estratégia de colunas extensas no PDF.

5. **Etapa 5 — Ajustes de configuração (somente se necessário)**
   - Introduzir `exibir_em_relatorio` após validação com usuário.

---

## 11) Arquivos que provavelmente seriam alterados em futura execução

Frontend:
- `src/contexts/PayrollContext.tsx` (reuso de filtros/seleção e possível método de consulta para relatório).
- `src/types/payroll.ts` (tipos do dataset de relatório, se necessário).
- Novo utilitário em `src/lib/` para montar dataset (ex.: `reportByCompanyData.ts`).
- Página de relatórios existente ou nova rota conforme PRD-08 e padrão atual de navegação.
- Componentes de exportação PDF/Excel (se já houver padrão, reaproveitar).

Banco (somente se aprovado depois):
- Migração para `exibir_em_relatorio` (opcional e mínima).

Observação: nesta etapa de análise, **não foi implementada nenhuma dessas mudanças**.

---

## 12) Checklist de testes manuais (pré-go-live futuro)

1. Filtro por empresa retorna apenas dados da empresa selecionada.
2. Filtro por competência considera apenas folha existente da empresa.
3. Folha arquivada não aparece e não entra nos totais.
4. Inclusão de nova rubrica ativa aparece como nova coluna automaticamente.
5. Ordem das colunas segue `display_order`.
6. Rubricas sem valor para funcionário exibem 0 (ou vazio padronizado), sem quebrar total.
7. Totais por coluna batem com soma das linhas.
8. Canônicas (`salario_real`, `g2_complemento`, `salario_liquido`) são lidas de rubricas existentes, sem cálculo paralelo.
9. PDF e Excel têm os mesmos valores da tabela em tela.
10. Cenário com muitas colunas mantém legibilidade mínima no PDF.
11. Usuário sem permissão de folha não acessa dados sensíveis (RLS/permissões atuais).
12. Cenários legados sem `payroll_batch_id` continuam exibindo dados corretamente quando aplicável.

---

## Respostas objetivas aos 19 pontos obrigatórios

1. Rubricas: tabela `rubricas`.
2. Campos atuais: `id, name, code, type, display_order, is_active, entry_mode, allow_manual_override` + canônicos (`nature`, `calculation_method`, `classification`, `fixed_value`, `percentage_value`, `percentage_base_rubrica_id`).
3. Ordem: existe `display_order`.
4. Manuais/calculadas: sim, disponíveis via cadastro único de rubricas + payload por entry.
5. Valores por funcionário/folha: `payroll_entries` (`earnings`, `deductions`, totais).
6. Central monta por filtros empresa+competência(+batch) no `PayrollContext`.
7. Recibos consomem via `buildReceiptData` com base em entry + rubricas.
8. Estrutura reutilizável: `PayrollContext` (carregamento e filtros) e utilitários de folha.
9. Não recalcular: relatório deve só ler JSON persistido/totais persistidos.
10. Canônicas: resolver por rubrica canônica existente (`code`), sem fórmulas paralelas no relatório.
11. Filtro por empresa: `company_id`/empresa selecionada.
12. Filtro por competência: `month/year` e batch correspondente.
13. Folha arquivada: excluir `payroll_batches.is_archived = true`.
14. Tabela dinâmica: linhas funcionários + colunas fixas cadastrais + colunas de rubricas ordenadas + rodapé de soma.
15. PDF/Excel: ambos a partir de um único dataset em memória.
16. Risco PDF: excesso de colunas/ilegibilidade/quebra.
17. Estratégia visual PDF: paisagem + escala + quebra por blocos quando exceder limite.
18. Arquivos prováveis: contexto/tipos/utilitários relatório/exportadores/página de relatórios.
19. Testes: checklist acima.
