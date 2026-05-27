# Análise — criação de folha zerada para empresa sem folha base

## Diagnóstico do problema

1. **Ação na Central**
   - A ação **Criar nova folha** da `/central-de-folha` abre o componente `PayrollDuplicationDialog`.
2. **Modal responsável pelo fluxo**
   - O modal de criação estava orientado apenas para duplicação (descrição, validação e campos).
3. **Regra que bloqueava empresa sem base**
   - A validação exigia `baseCompetence` sempre.
   - O botão de confirmar também era bloqueado quando não havia opções de base (`baseOptions.length === 0`).
4. **Função que cria no banco**
   - `duplicatePayroll` no `PayrollContext` faz `insert` em `payroll_batches` e depois `insert` em `payroll_entries`.
5. **Como funcionários são carregados para compor folha**
   - Antes: para duplicação, os funcionários eram os lançamentos da folha base (`sourceEntries`).
   - Não existia caminho para criar por funcionários ativos quando não houvesse base.
6. **Rubricas manuais e calculadas**
   - Duplicação copia apenas rubricas manuais selecionadas.
   - Rubricas calculadas são removidas do payload e continuam derivadas no frontend.
7. **Reuso para lançamentos zerados**
   - Não havia função dedicada pronta; foi reaproveitada a mesma função `duplicatePayroll` com um novo caminho de criação zerada.
8. **Status inicial da folha**
   - Já havia regra consistente: nova folha nasce em `em_edicao`.

## Regra aplicada na correção

Foi mantida a mesma modal e a mesma função de criação, separando o comportamento em dois caminhos explícitos:

- `creationType = "duplicate"`
  - exige folha base;
  - mantém cópia de rubricas manuais selecionadas;
  - mantém exclusão de rubricas calculadas do valor persistido.

- `creationType = "zeroed"`
  - não exige folha base;
  - cria `payroll_batch` novo em `em_edicao`;
  - cria `payroll_entries` para funcionários ativos da empresa com `earnings = {}` e `deductions = {}`.

## Arquivos alterados

- `src/components/payroll/PayrollDuplicationDialog.tsx`
  - inclusão do seletor de modo da folha (zerada vs duplicação) para empresa específica;
  - ocultação de `Folha base` e rubricas quando modo for zerado;
  - fallback automático para modo zerado quando empresa não possui folha base;
  - atualização de subtítulo e regras de validação/submit.

- `src/contexts/PayrollContext.tsx`
  - expansão do input com `creationType`;
  - separação da lógica de negócio entre duplicação e criação zerada;
  - reaproveitamento do mesmo pipeline transacional para criar batch e lançamentos;
  - criação de lançamentos zerados para funcionários ativos sem cálculo backend.

## Cenários testados

### Cobertura por validação de código

1. **Empresa sem folha base**
   - modal agora muda para modo zerado quando não há base;
   - não exige folha base para confirmar.

2. **Empresa com folha base**
   - modal permite escolher entre duplicar e zerada;
   - fluxo de duplicação continua exigindo folha base.

3. **Competência já existente**
   - regra de bloqueio por `targetBatch` existente foi preservada para ambos os modos.

4. **Empresa sem funcionários ativos**
   - folha é criada; lista de `entriesPayload` pode ficar vazia (sem travar fluxo).

5. **Rubricas calculadas**
   - continuam não sendo copiadas como valor fixo no fluxo de duplicação;
   - no modo zerado não há cópia de valores manuais/calculados.

## Riscos restantes

- O resumo de sucesso foi originalmente pensado para “lançamentos copiados”; no modo zerado a contagem continua válida, mas o texto pode soar genérico.
- Não foi adicionada mensagem específica de “sem funcionários ativos” (o fluxo permanece não bloqueante, conforme regra atual).

## Confirmação sobre fluxo antigo

✅ O fluxo antigo de duplicação foi preservado, com o mesmo contrato principal:
- exige folha base;
- bloqueia competência já existente;
- cria folha em `em_edicao`;
- copia apenas rubricas manuais selecionadas, sem materializar rubricas calculadas.

## Refinamento pós-revisão

- **Correção do modal de sucesso:**
  - `SuccessConfirmationState` passou a guardar `creationType` e `baseCompetence` opcional.
  - No sucesso de **duplicação**, a mensagem continua mencionando competência base.
  - No sucesso de **folha zerada**, a mensagem não menciona base e usa texto específico da criação zerada.
  - Foi removida dependência de `baseCompetence!` no caminho zerado.

- **Correção da alternância entre Empresa específica e Todas as empresas:**
  - Ao trocar para `mode = "all"`, o estado força `creationType = "duplicate"`.
  - No submit, `effectiveCreationType` também força duplicação para o modo em massa.
  - Confirmação: não ficou implícita criação zerada em massa.

- **Tratamento de empresa sem funcionários ativos:**
  - No caminho `zeroed`, o batch é criado normalmente.
  - Quando não há funcionários ativos, o fluxo não chama `insert([])` em `payroll_entries`.
  - O resultado retorna `entries: 0` e a confirmação mostra mensagem clara sobre ausência de lançamentos.

- **Preservação do fluxo legado de duplicação:**
  - Mantidas validações de folha base, competência destino e cópia apenas de rubricas manuais selecionadas.
  - Rubricas calculadas continuam sem materialização fixa no banco.
