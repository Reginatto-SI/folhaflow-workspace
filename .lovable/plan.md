

# Plano: Refatorar Central de Folha

## Situação atual

A tela `/` (Index.tsx) usa `PayrollTable` com edição inline célula a célula (estilo planilha) e `TotalsBar` com KPIs. Os dados de folha são gerados por `generatePayrollEntries` (mock em memória com valores aleatórios). Não há filtros, seletores de empresa/mês na tela, nem drawer lateral.

## O que muda

Refatorar `Index.tsx` para ser a tela operacional principal, com:

1. **Header da folha** - selects de empresa e competência (mês/ano) + status + botões de ação
2. **KPIs** - manter TotalsBar existente (já funciona)
3. **Filtros** - busca por nome, select de setor, select de função
4. **Tabela simplificada** - colunas: Funcionário, Setor, Função, Salário Base, Proventos, Descontos, Líquido (sem edição inline na tabela principal)
5. **Drawer lateral** - ao clicar numa linha, abre Sheet (componente já existe) com dados do funcionário, proventos/descontos editáveis, totais automáticos e botões de ação

## Arquivos

### Novos
| Arquivo | Descrição |
|---|---|
| `src/components/payroll/PayrollHeader.tsx` | Header com selects de empresa, mês e botões de ação |
| `src/components/payroll/PayrollFilters.tsx` | Linha de filtros (busca, setor, função) |
| `src/components/payroll/EmployeeDrawer.tsx` | Sheet lateral com detalhes e edição do funcionário |

### Modificados
| Arquivo | Mudança |
|---|---|
| `src/pages/Index.tsx` | Reescrito para compor os novos componentes |
| `src/components/payroll/PayrollTable.tsx` | Simplificado: tabela de leitura com clique na linha para abrir drawer |

### Mantidos sem alteração
- `TotalsBar.tsx` - já funciona bem
- `EditableCell.tsx` - preservado para uso futuro, não usado na tabela principal por agora
- `EmployeeRowExpansion.tsx` - preservado, substituído pelo drawer
- `PayrollContext.tsx` - sem mudanças

## Detalhes de implementação

### PayrollHeader
- Select de empresa (lista de `companies` do contexto, muda `selectedCompany`)
- Select de mês/ano (muda `selectedMonth`)
- Badge "Em edição" como status
- Botões "Novo lançamento" e "Gerar relatório" (desabilitados/placeholder por agora)

### PayrollFilters
- Input de busca por nome
- Select de setor (filtrado pela empresa selecionada)
- Select de função (filtrado pela empresa selecionada)
- Botão limpar filtros

### PayrollTable (refatorado)
- Colunas: Funcionário (nome + CPF), Setor, Função, Salário Base, Proventos, Descontos, Líquido
- Clique na linha abre o drawer com os dados daquele funcionário
- Sem edição inline na tabela (edição vai para o drawer)
- Dados vêm de `payrollEntries` + lookup em `allEmployees`, `allDepartments`, `allJobRoles`

### EmployeeDrawer (Sheet)
- Usa `Sheet` do shadcn (já existe no projeto)
- Seção 1: dados do funcionário (somente leitura)
- Seção 2: inputs de proventos e descontos (editáveis, com formatação de moeda)
- Seção 3: totais calculados automaticamente
- Footer: botões Salvar, Gerar recibo (placeholder), Fechar
- Salvar chama `updatePayrollEntry` e fecha o drawer com toast de sucesso

### Index.tsx
Composição:
```text
PayrollHeader
TotalsBar
PayrollFilters
PayrollTable + EmployeeDrawer
```

## Observações
- Dados continuam vindo do mock em memória (folha ainda não persistida no banco) -- isso é consistente com o estado atual do projeto
- Nenhuma alteração de banco de dados necessária
- Reutiliza componentes existentes: Sheet, Select, Input, Badge, Button, toast
- Filtros aplicados localmente sobre `payrollEntries`
- O drawer recebe o `PayrollEntry` selecionado e permite edição dos valores

