# Análise 8 — Drawer da `/central-de-folha`: integração front-back e divergência de valores

## 1. Escopo analisado

### Rota principal
- `src/pages/Index.tsx`
  - Abre o drawer via `handleRowClick`.
  - Persiste via `handleSave` chamando `updatePayrollEntry`.
  - Após salvar, dispara `recalculatePayrollBatch` automaticamente.

### Componente do drawer
- `src/components/payroll/EmployeeDrawer.tsx`
  - Carregamento do estado local (`rubricValues`, `notes`) a partir do `entry`.
  - Inputs numéricos por rubrica (`NumericRubricInput`).
  - Montagem do payload (`baseSalary`, `earnings`, `deductions`, `notes`).
  - Exibe duas áreas distintas: **Prévia (em edição)** e **Valores calculados (backend)**.

### Inputs monetários / parse / format
- `NumericRubricInput` no próprio `EmployeeDrawer.tsx`.
- `parseCurrency` no próprio `EmployeeDrawer.tsx`.
- Formatação monetária com `toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })`.

### Hooks / queries / mutations
- `src/contexts/PayrollContext.tsx`
  - `loadData`: carrega `payroll_entries` e demais catálogos.
  - `updatePayrollEntry`: `update` direto em `payroll_entries` + retorno `.select(...).single()`.
  - `recalculatePayrollBatch`: RPC `recalculate_payroll_batch` e sobrescrita do estado local com retorno da RPC.

### Backend (persistência e recálculo)
- `supabase/migrations/20260419153000_adjust_block3_recalc_prd01_alignment.sql`
  - Função `public.recalculate_payroll_batch(p_batch_id uuid)`.
  - Soma `earnings` e `deductions` como JSONB para totais.
  - Calcula INSS com base em `earnings['salario_fiscal']`, fallback `earnings['salario_ctps']`, fallback final `base_salary`.
- `supabase/migrations/20260413110000_create_payroll_entries.sql`
  - Estrutura de `payroll_entries` (`base_salary`, `earnings`, `deductions`).

### PRDs usados como fonte de verdade
- `public/PRD/PRD-00 — Visão Geral do Produto.txt`
- `public/PRD/PRD-01 — Motor de Cálculo e Central de Folha.txt`
- `public/PRD/PRD-02 — Cadastro de Rubricas.txt`
- `public/PRD/PRD-03 — Central de Folha.txt`
- `public/PRD/PRD-07 — Recibos de Pagamento.txt`
- `public/PRD/PRD-10 — Usuários e Controle de Acesso.txt`

---

## 2. Fluxo real encontrado (do input até reexibição)

1. Usuário abre drawer na `/central-de-folha` (rota `Index`).
2. `EmployeeDrawer` executa `useEffect` ao abrir e inicializa `rubricValues`:
   - Para cada rubrica ativa, tenta ler valor do `entry` usando `getLegacyValue`.
   - Fonte usada por rubrica:
     - tipo `desconto` → `entry.deductions`
     - demais tipos (`provento`, inclusive base) → `entry.earnings`
   - Se primeira rubrica-base estiver zerada e `entry.baseSalary > 0`, injeta `baseSalary` **somente na primeira rubrica-base**.
3. Usuário digita no input:
   - Estado textual local fica em `text`.
   - Conversão para número ocorre **no `onBlur`**, via `parseCurrency`.
4. Clique em “Salvar” no drawer:
   - Monta `earningsPayload` e `deductionsPayload` por `rubric.id`.
   - **Rubricas-base NÃO entram em `earningsPayload`;** apenas `baseSalary = soma das bases` é enviado.
   - Chama `onSave(entry.id, { baseSalary, earnings, deductions, notes })`.
5. No `Index`, `handleSave`:
   - chama `updatePayrollEntry` (persistência em `payroll_entries`),
   - em seguida chama `recalculatePayrollBatch` (RPC backend).
6. No backend (RPC):
   - recalcula `earnings_total`, `deductions_total`, `inss_amount`, `net_salary`.
7. No front:
   - `recalculatePayrollBatch` substitui no estado os `payrollEntries` retornados pela RPC.
   - tabela e totais passam a exibir campos calculados backend (`earningsTotal`, `deductionsTotal`, `netSalary`).
8. Reabrindo drawer:
   - ele reidrata de `entry.earnings`/`entry.deductions` + regra de fallback da primeira base.
   - aqui ocorre a principal oportunidade de divergência visual do que foi digitado.

---

## 3. Pontos corretos (alinhados com PRDs)

1. **Persistência é backend-first**, sem mock/localStorage para save do drawer.
2. **Recalculo pós-save é backend**, não cálculo financeiro completo na UI (a UI apenas soma prévia local para feedback).
3. **Separação visual explícita** entre “Prévia (em edição)” e “Valores calculados (backend)”.
4. **RLS/políticas por permissão** para `folha.operar` aplicadas em `payroll_entries` e `payroll_batches` (aderente a PRD-10).
5. **Rubricas derivadas (`nature = calculada`) filtradas dos inputs** do drawer (aderente a PRD-02).

---

## 4. Problemas encontrados

### Problema 1 — Perda de granularidade das rubricas-base no save/reload
- **Descrição objetiva**:
  - No save, todas as rubricas-base são agregadas em `baseSalary`.
  - No reload, valores de rubrica-base são lidos de `entry.earnings` (onde não foram salvos) e depois há fallback para jogar `baseSalary` apenas na primeira rubrica-base.
  - Resultado: valor digitado por rubrica-base pode reaparecer em campo diferente, zerado ou redistribuído incorretamente.
- **Arquivos/funções**:
  - `src/components/payroll/EmployeeDrawer.tsx`
  - `handleSave`, `useEffect` de hidratação, `groupedRubrics`, fallback `firstBaseRubric`.
- **Impacto real**:
  - Usuário vê valor diferente após salvar/reabrir.
  - Risco de interpretação errada de salário por rubrica.
- **Severidade**: Alta.
- **PRD/regra violada**:
  - PRD-01 (rastreabilidade de origem de cada valor).
  - PRD-02 (rubricas operacionais como input estruturado).

### Problema 2 — `baseSalary` não compõe `earnings_total` no backend, mas UI chama prévia de “Total Proventos” com base+proventos
- **Descrição objetiva**:
  - Prévia local usa `gross = baseTotal + earningsTotal`.
  - Backend calcula `earnings_total` somando somente JSON `earnings`.
  - Como base vai para `base_salary` e não para `earnings`, números de “proventos” divergem por definição entre blocos da mesma tela.
- **Arquivos/funções**:
  - Front: `src/components/payroll/EmployeeDrawer.tsx` (cálculo de `totals` e labels da prévia).
  - Backend: `supabase/migrations/20260419153000_adjust_block3_recalc_prd01_alignment.sql` (`earnings_total`).
- **Impacto real**:
  - Percepção de “mudou o valor ao salvar”, mesmo sem erro de persistência, por diferença semântica de campos exibidos.
- **Severidade**: Média/Alta.
- **PRD/regra violada**:
  - PRD-03 (experiência previsível da Central).
  - PRD-07 (necessidade de consistência folha/recibo depende de semântica consistente dos campos).

### Problema 3 — Função de recálculo usa chaves textuais (`salario_fiscal`, `salario_ctps`) no JSON, enquanto front grava por `rubric.id`
- **Descrição objetiva**:
  - Drawer persiste `earnings` e `deductions` por chave `rubric.id`.
  - RPC procura chaves literais `'salario_fiscal'` e `'salario_ctps'` para base fiscal.
  - Em regime novo (chave por id), esse lookup tende a falhar e cair no fallback `base_salary`.
- **Arquivos/funções**:
  - Front: `src/components/payroll/EmployeeDrawer.tsx` (`earningsPayload[rubric.id]`).
  - Backend: `supabase/migrations/20260419153000_adjust_block3_recalc_prd01_alignment.sql` (trecho `pe.earnings ? 'salario_fiscal'`).
- **Impacto real**:
  - Mismatch estrutural entre contrato front e recálculo backend.
  - Pode não quebrar sempre (fallback), mas quebra rastreabilidade e prepara divergência futura.
- **Severidade**: Alta (estrutural).
- **PRD/regra violada**:
  - PRD-01 e PRD-02 (evitar heurística por nome/chave textual para regra de cálculo).

### Problema 4 — Risco de parse monetário para valores com múltiplos separadores de milhar
- **Descrição objetiva**:
  - `parseCurrency` remove apenas a primeira ocorrência de `.` (`replace('.', '')`).
  - Valores como `1.234.567,89` podem virar string inválida e resultar em `0`.
- **Arquivos/funções**:
  - `src/components/payroll/EmployeeDrawer.tsx` (`parseCurrency`).
- **Impacto real**:
  - Perda silenciosa de valor digitado em entradas altas.
- **Severidade**: Média.
- **PRD/regra violada**:
  - PRD-00/PRD-03 (comportamento previsível e redução de erro manual).

---

## 5. Causa raiz provável

### Causa raiz principal (com evidência direta)
Há **inconsistência de contrato de dados** entre:
1. modelo de edição no drawer (rubricas individuais),
2. payload persistido (bases colapsadas em `baseSalary` + demais por `rubric.id`),
3. reidratação do drawer (tentando reconstruir bases a partir de `earnings` + fallback para primeira base),
4. regra de recálculo backend (parte ainda orientada a chaves textuais legadas).

Não é um único bug pontual: existe um conjunto de incompatibilidades pequenas que somadas geram o sintoma “digitei X, salvou/mostrou Y”.

---

## 6. Risco operacional

### Impacto na folha
- Possível divergência visual e/ou semântica entre entrada operacional e resultado exibido.
- Aumenta chance de retrabalho manual e decisões com base em valores interpretados de forma errada.

### Impacto no recibo
- PRD-07 exige reflexo exato da folha. Se o modelo de origem já nasce ambíguo, o recibo pode herdar inconsistências de agregação/mapeamento.

### Impacto na confiança do usuário
- Alto: quando o valor reaparece diferente após salvar, o usuário perde confiança no sistema mesmo quando parte da divergência é “semântica” e não perda física do dado.

---

## 7. Correção mínima recomendada (sem implementar ainda)

1. **Unificar contrato de base no fluxo drawer ↔ persistência ↔ reidratação**:
   - definir explicitamente onde cada rubrica-base vive no payload persistido;
   - eliminar fallback implícito da “primeira base” para reexibição.
2. **Alinhar recálculo backend ao mesmo contrato de chave**:
   - backend não depender de chave textual legada quando front grava por `rubric.id`;
   - manter fallback apenas como compatibilidade controlada e auditável.
3. **Ajustar parse monetário para pt-BR robusto**:
   - remover todos separadores de milhar antes de normalizar decimal.
4. **Padronizar semântica de blocos visuais**:
   - deixar inequívoco para usuário quando um número é “entrada operacional”, “agregado backend”, ou “prévia local”.

> Escopo mínimo e reversível: ajustes pontuais de mapeamento e normalização, sem refatorar arquitetura.

---

## 8. Dúvidas restantes

1. No cadastro real de rubricas da base atual, quantas rubricas com `nature = base` existem por empresa/competência? (se houver mais de uma, o problema 1 se manifesta com alta frequência).
2. O contrato canônico desejado para base fiscal/gerencial no payload final deve usar `rubric.id` puro ou classificação técnica?
3. O texto/labels da UI para “Total Proventos” deve representar conceito contábil único (backend) ou prévia operacional (frontend)?

---

## 9. Checklist final

- [x] Front mapeado
- [x] Backend mapeado
- [x] Payload mapeado
- [x] Persistência mapeada
- [x] Recálculo mapeado
- [x] Render pós-save mapeado
- [x] Aderência aos PRDs validada

---

## Respostas objetivas às 12 perguntas solicitadas

1. **O drawer salva direto no backend?**
   - Sim. Chama `updatePayrollEntry` (Supabase `update` em `payroll_entries`) e atualiza estado.

2. **Salvar persiste apenas ou também recalcula?**
   - Também recalcula: após persistir, `Index.handleSave` chama `recalculatePayrollBatch`.

3. **Existe refresh automático após salvar?**
   - Sim. A RPC retorna linhas recalculadas e o contexto substitui entradas no estado (`setAllPayrollEntries`).

4. **Conversão string monetária ↔ número está correta?**
   - Parcialmente. Funciona em casos comuns (`2.500,00`), mas tem risco em formatos com múltiplos separadores.

5. **Risco de parse por máscara/localização pt-BR?**
   - Sim, principalmente em valores grandes com mais de um separador de milhar.

6. **Campo exibido pós-save é o mesmo persistido ou derivado?**
   - Misto: inputs reidratam de `earnings/deductions/baseSalary`; cards/tabela mostram campos calculados backend (`earnings_total`, `net_salary`).

7. **Drawer edita rubrica operacional ou derivada disfarçada?**
   - Edita operacionais; derivadas (`nature=calculada`) são filtradas e não renderizadas como input.

8. **Há sobrescrita por resposta do backend?**
   - Sim, após RPC de recálculo o estado é sobrescrito com linhas retornadas.

9. **Há mismatch de nomes de campos front/back?**
   - Sim, estrutural: front grava por `rubric.id`; recálculo backend ainda consulta chaves textuais (`salario_fiscal`, `salario_ctps`).

10. **UI usa fallback, mock, cache antigo ou recomputação local?**
   - Não há mock no save. Há fallback de hidratação legada e prévia local (recomputação local só para preview).

11. **Prévia em edição separada de valores calculados backend?**
   - Visualmente sim; semanticamente há mistura percebida porque conceitos de “proventos” divergem entre preview e backend.

12. **Problema estrutural, pontual ou ambos?**
   - Ambos: estrutural (contrato e mapeamento) + pontuais (fallback da primeira base e parse monetário frágil).
