

# FolhaFlow — Plataforma de Gestão de Folha de Pagamento

## Visão Geral
Workspace financeiro de alta performance para processar folhas de pagamento mensais de múltiplas empresas, com edição inline tipo Excel, navegação por teclado e automação mensal.

## Design System
- **Cores**: Azul profundo (#1E3A8A) primária, azul médio (#3B82F6) interação, fundo cinza claro (#F8FAFC), verde sucesso, vermelho erro
- **Tipografia**: Inter com números tabulares, hierarquia clara
- **Layout**: Grid 8pt, interface centrada em tabela, headers fixos, densidade otimizada
- **Motion**: Transições 200-250ms, destaque suave em edição

## Páginas e Funcionalidades

### 1. Login / Autenticação
- Login com email/senha
- Registro de conta
- (Google OAuth como fase futura via Lovable Cloud)

### 2. Central de Folha (Homepage / Dashboard)
- Seletor rápido de **empresa** e **mês/ano** no topo
- Barra de status com totais: salários brutos, descontos totais, líquido total
- Tabela principal de funcionários com colunas editáveis inline
- Navegação por teclado: TAB, SHIFT+TAB, ENTER, setas
- Expansão de linha ao clicar no funcionário (detalhamento, observações, rubricas adicionais — sem modal)
- Ações em massa: aplicar valor a múltiplos funcionários, copiar/colar entre linhas

### 3. Gestão de Empresas
- CRUD de empresas com dados básicos (nome, CNPJ, etc.)
- Troca rápida entre empresas no header
- Visão consolidada multi-empresa

### 4. Gestão de Funcionários
- Cadastro de funcionários por empresa
- Dados: nome, cargo, salário base, data de admissão, status

### 5. Sistema de Rubricas Dinâmicas
- Criar rubricas com: nome, tipo (provento/desconto), comportamento (manual, fixo, percentual)
- Configuração por empresa
- Marcar como frequente / auto-preencher do mês anterior

### 6. Ciclo Mensal Inteligente
- Criar nova folha replicando dados do mês anterior automaticamente
- Destacar alterações em relação ao mês anterior com indicadores visuais

### 7. Relatórios e Exportação
- Recibo individual por funcionário
- Resumo por empresa
- Folha consolidada
- Exportação em PDF

### 8. Configurações
- Perfil do usuário
- Preferências gerais

## Fases de Implementação

**Fase 1 — Fundação (esta implementação)**
- Design system (cores, tipografia, layout)
- Autenticação (email/senha)
- Estrutura de navegação e layout principal
- Central de Folha com tabela editável inline e navegação por teclado
- CRUD de empresas e funcionários (dados mock iniciais)
- Seletor de empresa/mês
- Barra de totais fixa
- Expansão de linha

**Fase 2 — Dados reais e rubricas**
- Integração com Lovable Cloud (banco de dados)
- Sistema de rubricas dinâmicas
- Ciclo mensal inteligente

**Fase 3 — Produtividade**
- Ações em massa
- Relatórios e exportação PDF
- Visão consolidada multi-empresa

**Fase 4 — IA e polish**
- Detecção de inconsistências
- Sugestões baseadas no mês anterior
- Google OAuth

