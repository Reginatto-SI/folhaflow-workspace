# Análise 4 — Fase 2.5 do cadastro de funcionários (endurecimento estrutural)

## 1) Diagnóstico curto do estado atual
- A base já tinha `companies` e `employees` com CRUD real e RLS habilitado, porém permissivo.
- `employees` já possuía `unique (company_id, cpf)`, mas sem checks estruturais de formato (ex.: CPF com 11 dígitos e sem sequências inválidas).
- A Fase 2 reforçou bastante o front/contexto, porém ainda havia dependência alta da UI para qualidade de dados.
- `registration` era opcional e sem regra estrutural para bloquear vazio disfarçado (`'   '`).
- Campos bancários tinham validação no front, mas sem reforço estrutural no banco para consistência tripla (banco/agência/conta).

## 2) Riscos identificados
- Inserções/updates fora da UI poderiam burlar validações de CPF e limpeza textual.
- Valores com espaços/strings vazias poderiam continuar chegando ao banco em alguns cenários.
- Registro/matrícula sem padronização estrutural mínima.
- RLS ainda permissivo por ausência de camada de tenant/auth madura para restrição por empresa.

## 3) O que foi implementado
- Nova migration de endurecimento estrutural com:
  1. **Trigger de normalização no banco** (`before insert/update`) para CPF e textos relevantes.
  2. **Check constraints NOT VALID** para reforçar novos writes sem quebrar legado imediatamente.
  3. **Índice de apoio** para `(company_id, registration)` sem impor unicidade rígida nesta fase.
- O contexto/front já existente segue compatível e alinhado com o endurecimento.

## 4) Migrations criadas/ajustadas
- Criada: `supabase/migrations/20260404183000_harden_employee_data_quality.sql`

## 5) Decisões sobre CPF
- **Armazenamento:** somente dígitos (normalizado no trigger de banco).
- **Formato estrutural:** check para 11 dígitos numéricos e bloqueio de sequência repetida (`000...`, `111...`, etc.).
- **Unicidade:** mantida no escopo de empresa (`unique(company_id, cpf)` já existente).

### Justificativa de unicidade
- Não foi aplicada unicidade global de CPF para evitar travar cenários multiempresa legítimos nesta etapa.
- A opção mais segura agora é preservar escopo por empresa e revisar globalidade quando houver regra de negócio consolidada.

## 6) Decisões sobre matrícula/registro
- `registration` segue **opcional** (sem burocracia rígida).
- Foi adicionada proteção estrutural para impedir valor vazio disfarçado (apenas espaços).
- Não foi aplicada unicidade de matrícula nesta fase para não quebrar legados/cenários com reaproveitamento operacional.
- Foi criado índice de apoio para facilitar consultas e futura evolução.

## 7) Decisões sobre RLS
- RLS **permanece permissivo** nesta fase, de forma proposital.
- Motivo: o projeto ainda não apresenta base madura de auth/tenant para endurecer por empresa sem risco de quebra funcional.
- Foi documentada a limitação e preservada compatibilidade operacional atual.

## 8) O que ficou propositalmente fora
- Endurecimento completo de RLS por tenant/empresa com claims de autenticação.
- Unicidade global de CPF.
- Unicidade obrigatória de matrícula por empresa.
- Qualquer refatoração de UX, folha oficial ou CRUD separado de setor/função.

## 9) Riscos remanescentes
- Constraints foram criadas como `NOT VALID` para não quebrar legado: protegem novos writes, mas dados antigos podem exigir saneamento posterior.
- RLS continua permissivo até existir estratégia de autenticação/tenant robusta.
- Matrícula continua sem unicidade por decisão conservadora de operação.

## 10) Próximos passos recomendados
1. Planejar saneamento de legado e depois `VALIDATE CONSTRAINT` gradualmente.
2. Definir regra de negócio oficial para matrícula (opcional x obrigatória, escopo de unicidade).
3. Evoluir auth/tenant e só então endurecer RLS por empresa com segurança.
4. Avaliar, com dados reais, se CPF deve ter restrição adicional além do escopo por empresa.
