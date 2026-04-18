

## Plano: Cadastro de Empresas — aderência ao PRD-05 + PRD-10

### Diagnóstico

**Banco (`companies`)**
- Não tem coluna `is_active` → impossível inativar/reativar.
- RLS **totalmente aberta** (`USING true` em SELECT/INSERT/UPDATE/DELETE para `public`) — qualquer um, autenticado ou não, pode CRUD. Viola PRD-10.

**Frontend (`Companies.tsx`)**
- `address` não obrigatório.
- Sem validação real de formato/duplicidade de CNPJ (só checa não-vazio).
- Botão "Excluir" faz DELETE físico via `deleteCompany`.
- Filtro de status existe mas é meramente decorativo (KPIs sempre mostram 0 inativas, status sempre "Ativa" hardcoded).
- Estados de loading/vazio/erro parcialmente implementados (sem retry).
- Usa importar/exportar (fora do PRD — manter porque já existe, mas não é foco).

**Permissões já aplicadas**
- Rota `/empresas` já protegida por `empresas.view` em `App.tsx`. ✅
- Menu lateral já filtra por permissão. ✅
- Falta enforcement no backend (RLS).

---

### Mudanças

#### 1. Migração SQL
```sql
-- Adicionar status
alter table public.companies 
  add column is_active boolean not null default true;

-- Unicidade de CNPJ (validação no banco)
-- Normalizar antes de criar índice
update public.companies set cnpj = regexp_replace(cnpj, '\D', '', 'g');
create unique index companies_cnpj_unique on public.companies (cnpj);

-- Endereço obrigatório
update public.companies set address = '—' where address is null or trim(address) = '';
alter table public.companies alter column address set not null;

-- RLS: substituir policies abertas por permissão real
drop policy companies_select_all on public.companies;
drop policy companies_insert_all on public.companies;
drop policy companies_update_all on public.companies;
drop policy companies_delete_all on public.companies;

create policy "empresas view" on public.companies for select 
  to authenticated using (public.has_permission(auth.uid(), 'empresas.view'));

-- Apenas admin pode criar/editar/inativar empresas (PRD-10: área administrativa)
create policy "empresas insert admin" on public.companies for insert 
  to authenticated with check (public.is_admin(auth.uid()));
create policy "empresas update admin" on public.companies for update 
  to authenticated using (public.is_admin(auth.uid())) 
  with check (public.is_admin(auth.uid()));
-- DELETE: bloqueado totalmente (PRD-05 §5.5 — sem exclusão física). 
-- Sem policy de DELETE = ninguém deleta.
```

#### 2. Tipo `Company` (`src/types/payroll.ts`)
Adicionar `isActive: boolean` e tornar `address: string` (não opcional).

#### 3. `PayrollContext.tsx`
- `mapCompanyRowToModel`: incluir `isActive`.
- `addCompany` / `updateCompany`: incluir `is_active`, normalizar CNPJ (só dígitos), tratar erro `23505` (unique violation) → `throw new Error("CNPJ já cadastrado")`.
- **Substituir `deleteCompany`** por `setCompanyActive(id, isActive)` (UPDATE em `is_active`). Manter assinatura `deleteCompany` quebraria o contrato — vamos renomear na interface e ajustar consumidores (apenas `Companies.tsx`).
- `selectedCompany` default → primeira **ativa**, não primeira qualquer.
- Filtros operacionais (Funcionários, Central de Folha, JobRoles, Departments) que usam `companies` para seleção → mostrar apenas `isActive` (PRD-05 §5.4).

#### 4. `src/pages/Companies.tsx`
- **Validação CNPJ**: helper `isValidCNPJ()` com algoritmo dos dígitos verificadores + máscara visual `00.000.000/0000-00`.
- **Endereço obrigatório**: validação no submit + asterisco no label.
- **Status**: badge dinâmica (verde "Ativa" / cinza "Inativa") usando `company.isActive`.
- **Filtros**: 
  - Listar todas (ativas + inativas) por padrão? → PRD diz "inativas não aparecem em **novos lançamentos**", mas na própria tela de Empresas faz sentido mostrar todas com filtro. Default do filtro: "Ativas". Usuário pode trocar para "Inativas" / "Todas".
  - KPIs corretos: total / ativas / inativas reais.
- **Ações no menu "..."**:
  - Editar (sempre)
  - Inativar (se ativa) → confirmação
  - Reativar (se inativa)
  - **Remover ação "Excluir"** completamente.
- **Estados**:
  - Loading: spinner já existe — manter.
  - Vazio (zero empresas): card centralizado "Nenhuma empresa cadastrada" + CTA "Nova empresa".
  - Erro: capturar erro de carregamento (novo estado em `PayrollContext` ou local) → mensagem + botão "Tentar novamente" (chama `loadData`).
- Form: campos exatamente Nome / CNPJ (mascarado) / Endereço / Status (toggle apenas na edição — criação sempre = ativa).

#### 5. Manter intacto
- Importar/exportar (não está no PRD, mas já existe — não remover).
- AppLayout, rota, permissão da rota.

---

### Arquivos alterados

| Arquivo | Mudança |
|---|---|
| `supabase/migrations/<nova>.sql` | `is_active`, unique CNPJ, address NOT NULL, RLS por permissão |
| `src/types/payroll.ts` | `Company.isActive`, `address` obrigatório |
| `src/contexts/PayrollContext.tsx` | mapeamento + `setCompanyActive`, normalização CNPJ, tratamento 23505, filtros operacionais por ativa |
| `src/pages/Companies.tsx` | validação CNPJ, máscara, endereço obrigatório, inativar/reativar, KPIs reais, estado vazio/erro |

---

### Resultado
- PRD-05 atendido: status, sem exclusão física, endereço obrigatório, CNPJ único, filtros corretos, estados completos.
- PRD-10 atendido: RLS bloqueia operações sem permissão; somente admin cria/edita/inativa; `empresas.view` necessário para listar.
- Empresas inativas não aparecem em Funcionários/Central de Folha por padrão.
- DELETE físico **impossível** (sem policy + frontend sem botão).

### Fora de escopo (anotado)
- Quebra de endereço em campos estruturados (PRD §13).
- Importar/exportar permanece como está (não-PRD, mas funcional).

