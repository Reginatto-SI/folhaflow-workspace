# Análise — Empresas com CPF/CNPJ duplicado

## 1) Diagnóstico do bloqueio encontrado

O bloqueio ocorria em dois pontos combinados:

- **Banco de dados**: existiam índices únicos no campo `companies.cnpj` (`companies_cnpj_key` e `companies_cnpj_unique`), impedindo persistência de CPF/CNPJ repetido.
- **Camada de contexto (frontend/data access)**: em `addCompany` e `updateCompany`, o código convertia erro SQL `23505` em mensagem amigável **"CPF/CNPJ já cadastrado."**, reproduzindo o bloqueio funcional para o usuário.

## 2) Arquivos alterados

- `src/contexts/PayrollContext.tsx`
- `supabase/migrations/20260523193000_allow_duplicate_companies_cnpj.sql`

## 3) Se havia validação frontend

Sim, existe validação de **formato/obrigatoriedade** de CPF/CNPJ no fluxo de empresas (`isValidCpfOrCnpj` + checagens de campo obrigatório), o que foi mantido.

Não foi encontrada validação frontend de **unicidade local** (por lista/cache) no modal de empresas.

## 4) Se havia constraint/índice único no banco

Sim. Havia unicidade no `cnpj` da tabela `companies` via índices únicos:

- `companies_cnpj_key`
- `companies_cnpj_unique`

## 5) Correção aplicada

- Removido mapeamento explícito de erro `23505` para mensagem "CPF/CNPJ já cadastrado." em `addCompany` e `updateCompany`.
- Mantidas validações de obrigatoriedade e formato (CPF/CNPJ válido), sem tornar campo opcional.
- Adicionados comentários curtos no código indicando que CPF/CNPJ pode se repetir para estruturas gerenciais distintas.
- Criada migração mínima para remover somente a unicidade do campo `companies.cnpj`, sem mexer em outros índices/relacionamentos.

## 6) Checklist de teste

- [ ] Criar empresa A com um CNPJ.
- [ ] Criar empresa B com o mesmo CNPJ.
- [ ] Editar empresa B mantendo o mesmo CNPJ.
- [ ] Confirmar que não aparece toast de CPF/CNPJ já cadastrado.
- [ ] Confirmar que a listagem mostra as duas empresas.
- [ ] Confirmar que funcionários/setores/funções continuam vinculados por `empresa_id`.
- [ ] Confirmar que nenhuma tela da folha foi alterada indevidamente.


## 7) Validação da migração

- **`companies_cnpj_key` era constraint ou índice?** Pelas migrations existentes no repositório, foi criado como **índice único manual** (`create unique index`) e não como `constraint ... unique` declarada na definição da tabela.
- **Comando final que removeu a unicidade:** a migração foi reforçada para remover os dois cenários com segurança: `alter table ... drop constraint if exists companies_cnpj_key` e `drop index if exists` para `companies_cnpj_key` e `companies_cnpj_unique`.
- **Ficou índice normal (não único) para consulta em `companies.cnpj`?** Não há migration neste ajuste criando índice não único; a mudança remove apenas a unicidade que bloqueava duplicidade.
- **Resultado do teste de criação/edição com CPF/CNPJ duplicado:** em nível de código e schema versionado, o bloqueio de unicidade foi removido (tratamento `23505` + índices/constraint de unicidade). A validação funcional final depende da execução da migração no banco alvo e teste manual do checklist (criar A/B com mesmo documento e editar B mantendo documento).
