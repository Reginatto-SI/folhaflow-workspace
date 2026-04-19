# Análise 1 — Auditoria técnica do motor de fórmulas da folha

## 1. Resumo executivo

Estado atual (com evidência de código):

- O sistema **já persiste o cadastro estrutural de rubricas** (natureza, método de cálculo, classificação e itens de fórmula) em `rubricas` + `rubrica_formula_items`, com validações de consistência e checagens de ciclo no cadastro.
- Porém, o recálculo da folha em produção (`public.recalculate_payroll_batch`) **não executa essas fórmulas cadastradas**. Ele apenas:
  - soma JSON de `earnings` e `deductions`;
  - espelha INSS manual por classificação/chave;
  - calcula líquido como `earnings_total - deductions_total`.
- Na prática, a fórmula cadastrada em rubricas com `natureza = calculada` e `metodo_calculo = formula` **não comanda o resultado final da folha**.
- Existe base parcial reaproveitável (persistência de dependências por itens e validação de circularidade no cadastro), mas **não existe executor de fórmulas no backend**.

Diagnóstico central:

> O principal gap não é de cadastro de rubrica; é de **execução**. O backend materializa totais agregados, mas não roda um motor de fórmulas por rubrica, com resolução de dependências entre rubricas e escrita determinística dos resultados derivados.

---

## 2. Como o sistema funciona hoje

### 2.1 Fluxo de persistência da fórmula (criar/salvar/validar/atualizar/carregar)

#### Criação e validação no frontend/contexto

- O formulário de rubricas permite método `formula`, `percentual`, `valor_fixo`, `manual` e exige itens para método `formula`.
- A validação bloqueia:
  - fórmula sem itens;
  - auto-referência;
  - ciclos (DFS em grafo de dependências), tanto para fórmula quanto percentual.
- A UI também aplica regra de INSS operacional manual (`desconto + base + manual`).

#### Persistência no banco

- A rubrica é gravada em `public.rubricas` com campos canônicos:
  - `nature`, `calculation_method`, `classification`, `fixed_value`, `percentage_value`, `percentage_base_rubrica_id`.
- Para `calculation_method = formula`, os itens são gravados em `public.rubrica_formula_items` (`operation`, `source_rubrica_id`, `item_order`).

#### Atualização

- Ao atualizar rubrica:
  - a linha de `rubricas` é atualizada;
  - itens de fórmula antigos podem ser removidos e reinseridos conforme payload;
  - validação de ciclo é reexecutada antes de persistir.

#### Reload

- O carregamento usa `RUBRICA_SELECT_WITH_ITEMS`, incluindo join explícito de `rubrica_formula_items`.
- O mapeamento para modelo front ordena os itens por `item_order`.

#### Conclusão da persistência

- **Sim, a fórmula está sendo persistida estruturalmente** (como composição por itens, não como expressão textual livre).
- A persistência é consistente com o contrato atual do código.

---

### 2.2 Fluxo de execução do cálculo atual

#### Onde o cálculo é disparado

- O recálculo é disparado pela UI via `recalculatePayrollBatch()` no contexto.
- Esse método chama RPC backend `public.recalculate_payroll_batch(p_batch_id)`.

#### O que o backend calcula hoje

A função atual (última migração) calcula por `payroll_batch_id`:

1. `earnings_total` = soma numérica de todos os valores de `earnings` (JSONB).
2. `deductions_total` = soma numérica de todos os valores de `deductions` (JSONB).
3. `inss_amount` = soma de descontos cujas chaves correspondem a rubricas classificadas como `inss` (com fallback legado por chave textual `inss`).
4. `net_salary` = `earnings_total - deductions_total`.

#### Onde ocorre cálculo (front/back)

- **Backend:** cálculo final oficial da tabela/totais (`earnings_total`, `deductions_total`, `inss_amount`, `net_salary`).
- **Frontend:** existe apenas prévia local no drawer (`gross - deductionTotal`) explicitamente rotulada como prévia sem encargos; não alimenta o cálculo oficial.

#### Campos pedidos no escopo (salario_real, g2_complemento, salario_liquido)

- Não há cálculo explícito por esses códigos no executor atual.
- O backend não busca rubricas calculadas por `nature/calculation_method`, nem resolve dependências para gerar esses resultados.
- `salario_liquido` existe apenas como `net_salary` agregado de entry, e não como rubrica calculada via fórmula cadastrada.

#### Conclusão do fluxo de execução

- O sistema atual usa **soma genérica hardcoded** de JSON para totais.
- Existe ignorância prática de `metodo_calculo = formula` no momento do recálculo da folha.

---

### 2.3 Parser/executor de fórmula atual

#### Existe parser?

- **Não** há parser de expressão textual matemática (ex.: `A - B + C`) no backend atual.
- O modelo adotado é de itens estruturados (`add/subtract` + referência de rubrica), mas apenas para cadastro/persistência.

#### Existe avaliação de expressão?

- **Não** na execução da folha.

#### Existe substituição de variáveis por códigos de rubrica?

- **Não** no executor atual.
- Existe apenas leitura de chaves de JSON em fallback legado (`inss` textual).

#### Existe resolução de dependências/ordenação topológica/circularidade?

- Circularidade: **sim, parcialmente**, no cadastro de rubricas (frontend/contexto), para impedir salvar ciclos.
- Ordenação topológica para execução real de rubricas na folha: **não existe** no recálculo backend.

#### Existe fallback indevido para cálculo fixo?

- Sim, o recálculo é um fallback agregado fixo por soma de JSON, sem respeitar fórmulas de rubricas calculadas.

---

### 2.4 Dependência entre rubricas

#### O que existe

- Dependência declarativa no cadastro de fórmula (`rubrica_formula_items`).
- Detecção de ciclo no cadastro.

#### O que quebra / é ignorado

- Rubrica calculada depender de rubrica operacional: persistência existe, execução não.
- Rubrica calculada depender de outra calculada: UI de cadastro atualmente **filtra referências para excluir rubricas calculadas**, então esse encadeamento já nasce bloqueado no cadastro padrão.
- Múltiplas referências e cascata: podem ser cadastradas parcialmente por itens, mas não são executadas no backend.

---

### 2.5 Impacto atual em Central, Recibos e Relatórios

#### Central de Folha (`/central-de-folha`)

- Consome campos consolidados do backend (`earningsTotal`, `deductionsTotal`, `netSalary`, `inssAmount`).
- Não executa motor de fórmulas na UI.
- Risco: como o backend não executa fórmulas de rubricas calculadas, a Central exibirá totais potencialmente divergentes do legado quando dependam dessas fórmulas.

#### Recibos e Relatórios

- No estado atual do front, ações de “Gerar recibo” e “Gerar relatório” estão desabilitadas com tooltip de sprint futura.
- Portanto, impacto imediato é preparatório: quando forem habilitados, se consumirem os totais atuais sem motor de fórmula, herdarão divergências.

---

## 3. Onde o sistema diverge do PRD

### 3.1 Violações objetivas

1. **Motor deve ser executor de fórmulas**
   - Divergência: executor atual não percorre rubricas `calculada/formula`; apenas soma JSON.

2. **Não pode haver lógica hardcoded para rubricas derivadas**
   - Divergência: cálculo é fixo por agregação (`earnings_total`, `deductions_total`, `net_salary`) sem usar regras configuradas por rubrica.

3. **Rubrica calculada deve ser executada pelo motor**
   - Divergência: rubrica calculada é cadastrável/persistível, mas não executada no recálculo.

4. **Novas rubricas calculadas devem funcionar sem desenvolvimento adicional**
   - Divergência: hoje novas rubricas calculadas não alteram resultado final automaticamente, porque não há executor baseado no cadastro.

5. **UI não pode calcular**
   - Parcialmente aderente: cálculo oficial está no backend.
   - Observação: existe prévia local no drawer (rotulada como prévia), mas não é fonte de verdade.

6. **Classificação não interfere no cálculo do motor**
   - Divergência parcial: recálculo usa classificação/chave apenas para espelhar `inss_amount`; isso é regra especial de totalização, não execução de rubrica.

7. **Sem heurística por nome**
   - Divergência residual: função de recálculo mantém fallback legado textual `lower(d.key) = 'inss'`.

---

## 4. Onde a fórmula quebra

Ponto exato de quebra do fluxo fim a fim:

1. Admin cadastra rubrica calculada com método `formula` e itens de dependência.
2. Dados são persistidos corretamente em `rubricas` + `rubrica_formula_items`.
3. Usuário salva/edita folha e dispara recálculo.
4. RPC `recalculate_payroll_batch` **não consulta `rubricas` por método/natureza para executar fórmulas**.
5. RPC apenas soma valores já presentes em `earnings`/`deductions` e grava totais agregados.

Resultado:

- A fórmula cadastrada fica “decorativa” do ponto de vista de execução de folha.
- O resultado final não é derivado da definição da rubrica calculada, mas de agregação fixa dos valores lançados.

---

## 5. Lacunas técnicas identificadas

### 5.1 Backend executor ausente/incompleto

- Ausência de pipeline de execução por rubrica:
  - seleção de rubricas calculadas ativas;
  - montagem de grafo de dependências;
  - ordenação topológica;
  - avaliação e materialização de cada rubrica calculada.

### 5.2 Parsing/avaliação incompletos

- Não há parser textual.
- O formato atual por itens (`add/subtract`) já cobre composições lineares, mas não existe executor que percorra e aplique itens.

### 5.3 Contrato de armazenamento dos resultados derivados

- `payroll_entries` hoje materializa apenas totais (`earnings_total`, `deductions_total`, `inss_amount`, `net_salary`) e mapas JSON de entradas.
- Falta estratégia explícita para gravar/identificar valores de rubricas calculadas individualmente e rastrear origem por rubrica.

### 5.4 Dependências entre calculadas bloqueadas na UI

- A lista de rubricas referenciáveis para fórmula/percentual filtra `nature = calculada`, impedindo cadeias entre derivadas no cadastro padrão.

### 5.5 Resquícios legados

- Fallback por chave textual (`inss`) no backend mantém heurística nominal para compatibilidade.

---

## 6. Impactos colaterais esperados

Quando o executor real for introduzido (sem detalhar implementação):

1. **Central de Folha**
   - Deve continuar apenas consumindo campos consolidados do backend.
   - Risco de divergência temporária durante migração se parte dos cálculos continuar em agregação antiga.

2. **Recibos**
   - Devem consumir resultado final do motor e agregação por classificação, sem recalcular.
   - Risco: se usarem atalho por totais antigos, pode haver recibo divergente do cálculo por rubrica.

3. **Relatórios**
   - Devem refletir o valor final do motor + agrupamento por classificação.
   - Risco: reintrodução de lógica paralela de soma no módulo de relatório.

4. **Duplicação de folha**
   - Se duplicar valores materializados de saída sem reprocessamento correto por fórmula, pode propagar erros entre competências.

---

## 7. Proposta de plano técnico mínimo

Sem implementação, apenas rota mínima segura:

1. **Manter modelo atual de cadastro/persistência de fórmulas**
   - Reaproveitar `rubrica_formula_items` e validações existentes.

2. **Evoluir `recalculate_payroll_batch` para executor por rubrica**
   - Ler rubricas ativas do escopo;
   - separar inputs operacionais de calculadas;
   - construir grafo de dependências das calculadas;
   - ordenar e avaliar rubrica por rubrica;
   - materializar valores calculados antes dos totais finais.

3. **Remover fallback nominal progressivamente**
   - Eliminar dependência de chave textual (`inss`) após saneamento de legado.

4. **Garantir saída única para Central/Recibos/Relatórios**
   - Todos os módulos devem consumir valores já processados pelo backend.

5. **Homologar contra cenário real do legado**
   - Validar resultado final com as fórmulas operacionais já utilizadas no sistema legado (sem hardcode no código).

---

## 8. Riscos da implementação

1. **Ordem de cálculo incorreta**
   - Pode gerar resultados inconsistentes em cascata entre rubricas derivadas.

2. **Circularidade não tratada no executor**
   - Mesmo com validação de cadastro, dados históricos podem conter cenários críticos.

3. **Quebra de compatibilidade de dados legados**
   - Remover fallback textual cedo demais pode zerar componentes em bases antigas.

4. **Divergência de módulos consumidores**
   - Se Central/Recibos/Relatórios misturarem lógica própria, haverá inconsistência visual/operacional.

5. **Sobrescrita de inputs manuais**
   - Executor mal desenhado pode violar regra de não sobrescrever rubricas operacionais.

---

## 9. Arquivos e trechos relevantes

### PRDs analisados (fonte de verdade)

- `public/PRD/PRD-00 — Visão Geral do Produto.txt`
- `public/PRD/PRD-01 — Motor de Cálculo e Central de Folha.txt`
- `public/PRD/PRD-02 — Cadastro de Rubricas.txt`
- `public/PRD/PRD-03 — Central de Folha.txt`
- `public/PRD/PRD-07 — Recibos de Pagamento.txt`
- `public/PRD/PRD-08 — Módulo de Relatórios (Folha App).txt`

### Cadastro/persistência de rubricas e fórmula

- `src/pages/Rubrics.tsx`
- `src/contexts/PayrollContext.tsx`
- `src/types/payroll.ts`
- `supabase/migrations/20260405001000_create_rubricas_module.sql`
- `supabase/migrations/20260418183949_4e3aa22b-85f5-46cc-a5f2-f3db7efbddc8.sql`
- `supabase/migrations/20260418191541_f6706af7-59e0-4845-b458-9d3c9f98c75e.sql`
- `supabase/migrations/20260418193942_62913b72-2911-4f11-be6f-6c5fb594ac50.sql`
- `supabase/migrations/20260419170000_fix_inss_manual_rule.sql`

### Execução de cálculo atual

- `src/contexts/PayrollContext.tsx` (chamada RPC)
- `supabase/migrations/20260419170000_fix_inss_manual_rule.sql` (função vigente)
- `supabase/migrations/20260419153000_adjust_block3_recalc_prd01_alignment.sql` (etapa intermediária)
- `supabase/migrations/20260419140000_block3_backend_recalculation_minimal.sql` (etapa inicial)
- `src/pages/Index.tsx`, `src/components/payroll/PayrollHeader.tsx`, `src/components/payroll/PayrollTable.tsx`, `src/components/payroll/TotalsBar.tsx`, `src/components/payroll/EmployeeDrawer.tsx`

### Classificação dos problemas encontrados

| Problema | Classificação |
|---|---|
| Fórmulas cadastradas não executadas no recálculo | problema de backend ausente/incompleto; problema de parsing/executor; divergência com PRD |
| Recálculo baseado apenas em soma agregada fixa | bug de implementação (frente ao PRD); lacuna de arquitetura |
| Dependência entre rubricas calculadas bloqueada no cadastro padrão | bug de implementação; divergência com PRD |
| Fallback textual por chave `inss` no executor | bug de implementação; divergência com PRD |
| Persistência de fórmula existe sem consumo no motor | lacuna de arquitetura |
| Risco de módulos consumidores herdarem totais sem motor por rubrica | problema de UI consumindo dado errado (potencial, quando módulos forem habilitados) |

---

## Observações de incerteza (explicitadas)

- Não foi identificado, no escopo analisado, módulo ativo de geração de recibos/relatórios em runtime para validar comportamento real fim a fim; a conclusão aqui é baseada no estado atual do código (botões desabilitados + PRDs).
- O cenário operacional legado citado (fórmulas explícitas de Salário Real, G2 Complemento e Salário Líquido) foi usado como referência de alvo funcional; porém o código atual não possui executor para comprovar aderência automática dessas fórmulas cadastradas.
