# Análise 3 — Fase 2 do cadastro de funcionários (UX e validações)

## 1) Diagnóstico curto do estado atual (antes da mudança)
- A tela `/funcionarios` já tinha CRUD real funcionando com Supabase e formulário em modal com seções básicas.
- O formulário já salvava os campos principais da Fase 1, mas com validação mínima (apenas nome, CPF e admissão obrigatórios).
- CPF era salvo como texto livre (sem máscara, sem limpeza para apenas dígitos e sem validação de dígito verificador).
- Campos bancários aceitavam qualquer string (incluindo espaços e lixo) e permitiam combinações incompletas.
- `registration`, `department`, `role` e `notes` eram enviados com pouca normalização (risco de dados inconsistentes).
- `department` e `role` já eram texto simples no modelo atual e não havia base de CRUD dedicado para estes domínios.

## 2) O que foi implementado

### UX e organização do formulário
- Refino visual no modal mantendo o padrão existente (sem reescrever página):
  - seções com borda/fundo suave e hierarquia visual clara;
  - reorganização em blocos: **Dados principais**, **Dados funcionais**, **Dados bancários**, **Status e observações**;
  - melhor aproveitamento horizontal com grid em desktop e comportamento responsivo em coluna no mobile.
- Labels ajustados para clareza operacional (ex.: “Banco (nome)”, “Registro / Matrícula”, “Observações”).
- Feedback visual de erro por campo com borda em destaque e mensagem textual curta.

### CPF
- Máscara no input (`000.000.000-00`) durante digitação.
- Validação básica/robusta de CPF com:
  - 11 dígitos;
  - bloqueio de sequências repetidas;
  - verificação dos dígitos validadores.
- Persistência normalizada com apenas dígitos (sem pontuação).
- Bloqueio de salvamento quando CPF inválido.

### Banco / agência / conta
- Normalização de espaços (`trim` + colapso de espaços internos).
- Regras mínimas de qualidade:
  - banco >= 2 caracteres;
  - agência >= 2 caracteres;
  - conta >= 3 caracteres.
- Regra de consistência: se preencher um dos três, precisa preencher os três.
- Persistência evita string inútil: campos vazios/inválidos viram vazio no formulário e `null` no banco via contexto.

### Registro / matrícula
- Campo mantido simples (sem regra complexa), com label clara e placeholder de identificador interno.
- Validação mínima opcional: se preenchido, exige ao menos 2 caracteres.

### Status e observações
- Status convertido para cartões/checks mais legíveis e clicáveis (Ativo, Afastado, Mensalista).
- Observações com `Textarea` mais confortável (`min-height`) e placeholder orientativo.

### Segurança/qualidade de dados (create/update)
- Camada de página normaliza os dados antes do envio (CPF, textos e banco).
- Camada de contexto adiciona defesa extra para create/update:
  - CPF sempre limpo para dígitos;
  - campos textuais opcionais normalizados para `null` quando vazios;
  - `name` normalizado com trim e espaços consistentes.

## 3) Arquivos alterados
- `src/pages/Employees.tsx`
- `src/contexts/PayrollContext.tsx`
- `analise-3-fase-2-cadastro-funcionarios-ux-validacoes.md`

## 4) Validações adicionadas
- Obrigatórias: nome, CPF válido, data de admissão.
- CPF: formato com máscara + validação de dígitos verificadores.
- Registro/Matrícula: se preenchido, mínimo 2 caracteres.
- Banco/Agência/Conta: validações mínimas de tamanho + preenchimento conjunto.
- Normalização: trim/colapso de espaços para textos relevantes.

## 5) Decisão sobre setor/função
### Decisão adotada nesta fase
**Manter `department` e `role` como texto simples**, com melhoria de UX via sugestões locais (`datalist`) baseadas nos valores já existentes.

### Justificativa prática
- Menor mudança segura e alinhada ao escopo (sem arquitetura prematura).
- Melhora imediata de velocidade operacional para RH (reuso de termos já cadastrados).
- Mantém evolução futura aberta para normalização/CRUD sem quebrar o fluxo atual.

## 6) O que ficou fora desta fase
- Endurecimento completo de RLS/multi-tenant por empresa.
- CRUD dedicado para setor/função.
- Cálculo/processamento de folha oficial.
- Múltiplas contas bancárias por funcionário.

## 7) Riscos remanescentes
- Sem restrição forte de unicidade para `registration` por empresa (ainda pode haver duplicidade operacional).
- CPF validado no front e normalizado no contexto, mas sem constraint adicional no banco nesta fase.
- Sugestões de setor/função são locais ao conjunto já carregado; ainda não há governança central desses domínios.

## 8) Próximos passos recomendados
1. Adicionar constraints/checks no banco para reforçar qualidade (quando escopo permitir).
2. Endurecer políticas RLS por empresa/tenant.
3. Avaliar evolução de `department`/`role` para domínio controlado (lista central ou CRUD leve), conforme volume de uso real.
4. Definir estratégia de unicidade de matrícula por empresa, caso necessário ao RH.
