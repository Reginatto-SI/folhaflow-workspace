# Análise 5 — Tela Piloto de Cadastro de Funcionários

## 1) Diagnóstico curto do estado anterior
- A tela `/funcionarios` usava um único modal longo, sem abas, com scroll global e botão de salvar no fim do conteúdo.
- O cadastro mostrava `Salário base` dentro do formulário de funcionário, misturando conceito cadastral (RH) com conceito mensal (folha).
- O campo apresentado como `Registro / Matrícula` não deixava claro o conceito correto de **empresa registrada**.
- A modelagem existente usava `companyId` e, na prática, o fluxo da UI já tratava esse vínculo como empresa principal do funcionário (sem suportar participação multiempresa de folha).
- Havia estrutura reaproveitável no projeto para o novo padrão (Dialog, Tabs, Select, validações, normalize/sanitize e context com Supabase).

## 2) Decisões de UX/UI adotadas
- Modal reestruturado como layout administrativo piloto com:
  - header fixo com título + subtítulo contextual
  - navegação por abas visíveis
  - corpo com scroll interno por aba
  - footer fixo com ações `Cancelar` e `Salvar`
- Organização por abas:
  1. Dados do funcionário
  2. Dados funcionais
  3. Dados bancários
  4. Observações
- Hierarquia visual reforçada com blocos por seção e instruções curtas de apoio.

## 3) Arquivos alterados
- `src/pages/Employees.tsx`
- `src/types/payroll.ts`
- `src/contexts/PayrollContext.tsx`
- `src/integrations/supabase/types.ts`
- `supabase/migrations/20260404195000_employee_registered_company_and_work_card.sql`

## 4) Estrutura final do modal
- **Header fixo:** título, subtítulo e fechamento nativo do Dialog.
- **Tabs:** quatro abas para reduzir altura percebida e fricção operacional.
- **Body por aba:** cada aba possui `overflow-y-auto`, evitando transformar o modal em página longa.
- **Footer fixo:** ações sempre visíveis para salvar sem scroll completo.

## 5) O que foi feito sobre salário base
- O campo `Salário base` foi removido da UI do cadastro/edição de funcionário.
- `baseSalary` foi mantido no modelo interno por compatibilidade com a Central de Folha (fluxos de geração/edição de folha existentes).
- O código recebeu comentário explícito indicando essa compatibilidade temporária.

## 6) O que foi feito sobre carteira de trabalho
- Foi adicionado o campo `workCardNumber` no modelo TypeScript do funcionário.
- O campo foi incluído no formulário (aba de dados do funcionário) com label clara “Carteira de trabalho”.
- O mapeamento Supabase (row/insert/update) foi atualizado para `work_card_number`.
- Foi criada migration para adicionar a coluna no banco e constraint de não-vazio quando informado.

## 7) Decisão adotada para empresa registrada
- Nesta fase, **`companyId` passa a ter semântica explícita de empresa registrada**.
- A UI foi alterada para exibir `Empresa registrada` (com Select de empresas) no cadastro.
- Foi adicionada documentação no código e comentário de coluna no banco para deixar claro que vínculo de folha multiempresa será tratado em estrutura futura.

## 8) Limitações atuais (cenário multiempresa da folha)
- Ainda não existe tabela/relacionamento específico para participação de um mesmo colaborador em múltiplas folhas de empresas do grupo.
- A folha continua operando com vínculo direto por empresa no fluxo atual.
- Esta entrega prepara nomenclatura e direção conceitual correta sem expandir arquitetura além do escopo solicitado.

## 9) Próximos passos recomendados
1. Criar estrutura de relacionamento `employee_payroll_companies` (ou equivalente) para participação multiempresa em folha.
2. Adaptar geração/consulta de folha para usar vínculo operacional separado da empresa registrada.
3. Migrar gradualmente quaisquer dependências legadas de `registration` para atributos com semântica explícita.
4. Reaplicar o padrão piloto (header fixo + tabs + footer fixo) em outros modais administrativos.
