# 1. Resumo executivo

A base para cadastro de empresa e funcionário **existe**, porém em estado **parcial e focado em MVP front-end**. O projeto atual já tem telas de CRUD para empresas e funcionários e vínculo básico por `companyId`, mas não há banco/migrations, não há integração ativa com Supabase para essas entidades, não há RLS/policies implementadas, e não há modelagem específica para setor/função e dados bancários do funcionário.

Conclusão objetiva: o cenário atual **atende parcialmente** a necessidade da tela antiga. Ele cobre estrutura mínima de cadastro, porém **não cobre** os campos cadastrais e bancários exigidos no print de referência.

# 2. Evidências encontradas no projeto

## Rotas e páginas
- Rotas principais incluem `/empresas` e `/funcionarios`, ambas dentro de `AppLayout`.
- Página de empresas com criação/edição via modal.
- Página de funcionários com criação/edição via modal.

Arquivos-chave:
- `src/App.tsx`
- `src/pages/Companies.tsx`
- `src/pages/Employees.tsx`
- `src/components/layout/AppLayout.tsx`

## Tipos e “modelo” atual (front-end)
- Interface `Company`: `id`, `name`, `cnpj`, `address?`.
- Interface `Employee`: `id`, `companyId`, `name`, `position`, `baseSalary`, `admissionDate`, `status`.
- Interface `PayrollEntry` referencia `employeeId` e `companyId`.

Arquivo-chave:
- `src/types/payroll.ts`

## Fonte de dados atual
- Empresas e funcionários vêm de `mockCompanies` e `mockEmployees`.
- Contexto mantém estado em memória (`useState`) e filtra funcionários pela empresa selecionada.
- Não há persistência em banco para essas operações.

Arquivos-chave:
- `src/data/mock.ts`
- `src/contexts/PayrollContext.tsx`

## Supabase / banco / políticas
- Existe cliente Supabase configurado.
- Tipagem de banco (`Database`) está vazia (sem tabelas).
- Não existem migrations no diretório `supabase/` (apenas `config.toml`).

Arquivos-chave:
- `src/integrations/supabase/client.ts`
- `src/integrations/supabase/types.ts`
- `supabase/config.toml`

# 3. Cadastro de empresa

## O que existe hoje
- CRUD de empresas na tela `/empresas`.
- Campos atuais no formulário: `Nome`, `CNPJ`, `Endereço`.
- Ações de criar, editar e excluir atuam no estado do contexto (`addCompany`, `updateCompany`, `deleteCompany`).

## Multiempresa / multifilial
- Existe seleção global de empresa no header (`AppLayout`) com `Select`.
- Funcionários são filtrados pela empresa selecionada (`employees = allEmployees.filter(...)`).
- Isso caracteriza um contexto multiempresa básico em memória.

## O que não existe
- Não há entidade explícita de filial separada da empresa.
- Não há relacionamento persistido em banco (somente arrays mock + estado local).
- Não há políticas de segurança por empresa (RLS/policies).

# 4. Cadastro de funcionário

## O que existe hoje
- Tela `/funcionarios` com listagem em tabela.
- Modal de criação e modal de edição (mesmo componente `Dialog`).
- Exclusão de funcionário na própria listagem.

## Campos implementados no funcionário
- `name` (Nome)
- `position` (Cargo)
- `baseSalary` (Salário Base)
- `admissionDate` (Data de Admissão)
- `status` (`active`/`inactive`)
- `companyId` (vínculo com empresa)

## Validações implementadas
- Verifica obrigatoriedade de `name`, `position`, `baseSalary` no `handleSave`.
- Não há validação de formato para CPF/CNPJ de funcionário, agência/conta etc. (esses campos não existem).

## Status existentes
- Apenas dois status: `active` e `inactive`.
- Não existe estado específico de “afastado” separado.
- Não existe flag específica de “mensalista”.

## Vínculo com folha
- `PayrollEntry` relaciona `employeeId` e usa dados do funcionário para exibição na Central de Folha.
- A geração de folha (`generatePayrollEntries`) inclui somente funcionários ativos.

# 5. Setor e função

## Resultado da inspeção
- **Função/cargo** hoje está representada apenas por `position` (campo texto livre no funcionário).
- **Setor** não aparece no tipo `Employee`, no formulário, nem nos mocks.
- Não foram encontradas tabelas, tipos, serviços ou páginas CRUD específicas para setor.
- Não foram encontradas tabelas, tipos, serviços ou páginas CRUD específicas para função/cargo administrável.

## Conclusão
- Não existe estrutura separada e administrável para setor e função.
- Atualmente cargo/função é um campo simples livre (`Input`) no cadastro de funcionário.

# 6. Dados bancários do funcionário

## Resultado da inspeção
Não foram encontrados no modelo de `Employee`, no formulário de funcionário, nem em tipos auxiliares campos para:
- banco
- agência
- conta
- tipo de conta
- chave PIX
- observações bancárias

Também não há tela alternativa para manter dados bancários fora da página de funcionários.

## Conclusão
- A estrutura de dados bancários do funcionário **não existe hoje** no projeto analisado.

# 7. Comparação com a necessidade do sistema antigo

## Campos do print de referência vs. cobertura atual
- empresa/filial → **parcial** (empresa existe; filial não existe)
- nome completo → **existe parcialmente** (`name`)
- CPF → **não existe**
- setor → **não existe**
- função → **parcial** (`position` livre, sem cadastro dedicado)
- admissão → **existe** (`admissionDate`)
- registro → **não existe**
- banco → **não existe**
- agência → **não existe**
- conta → **não existe**
- observação → **não existe** no cadastro de funcionário (existe `notes` apenas em `PayrollEntry`)
- mensalista → **não existe**
- afastado → **não existe** (apenas `inactive` genérico)
- ativo → **existe** via `status` (`active`/`inactive`)

## Veredito de compatibilidade
O sistema atual **não atende integralmente** a tela antiga; ele **atende parcialmente** por já ter base de empresa/funcionário, vínculo empresa-funcionário e fluxo de CRUD básico em modal.

# 8. Gaps reais

1. Ausência de persistência real para empresas e funcionários (sem tabela/migration/CRUD backend).
2. Ausência de RLS/policies para isolamento por empresa.
3. Ausência de filial/multi-filial explícita.
4. Ausência de CPF, registro e observação no funcionário.
5. Ausência de estrutura de setor (campo e/ou entidade dedicada).
6. Ausência de estrutura administrável de função/cargo (hoje texto livre).
7. Ausência total de dados bancários do funcionário.
8. Ausência de flags de negócio específicas como `mensalista` e `afastado`.

# 9. Menor caminho seguro para implementação

Sequência mínima sugerida, baseada no que já existe:

1. **Persistência primeiro**
   - Criar estrutura de banco para `companies` e `employees` compatível com tipos atuais + novos campos cadastrais essenciais.
   - Manter os nomes e fluxos próximos do contexto atual para minimizar impacto.

2. **Isolamento por empresa**
   - Definir política de acesso por empresa (RLS) antes de expandir formulário, para evitar retrabalho de segurança.

3. **Expandir funcionário sem quebrar UI existente**
   - Evoluir o formulário modal já existente em `/funcionarios` (mesmo padrão visual), adicionando campos faltantes prioritários: CPF, setor, função, registro, observação, banco/agência/conta, mensalista/afastado/ativo.

4. **Setor/função em etapas**
   - Etapa 1: liberar como campo controlado simples (se necessário para acelerar).
   - Etapa 2: migrar para cadastros administráveis (CRUD) se confirmado pelo negócio.

5. **Somente depois integrar folha aos novos campos**
   - Manter separação entre cadastro e lançamento de folha, como solicitado.

# 10. Dúvidas que precisam ser validadas

1. Filial será uma entidade própria (empresa x filial) ou apenas um atributo da empresa?
2. Setor e função devem nascer já como cadastros administráveis obrigatórios, ou podem iniciar como texto/lista simples?
3. “Afastado” deve coexistir com `ativo/inativo` como estado separado (ex.: enum com 3+ estados) ou como flag booleana independente?
4. “Mensalista” será apenas booleano ou implicará regras futuras na folha?
5. Dados bancários devem suportar múltiplas contas por funcionário ou somente uma conta principal?
6. Campo “registro” corresponde a matrícula interna, número em livro/ficha, ou outro identificador?
7. Observação de funcionário é livre e única, ou deve ter histórico/auditoria?
