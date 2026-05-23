# Análise de viabilidade — Importação/Exportação de Funcionários

## Escopo analisado
- Tela `/funcionarios` implementada em `src/pages/Employees.tsx`.
- Fluxo de dados centralizado em `usePayroll` (`src/contexts/PayrollContext.tsx`).
- PRD consultado: `public/PRD/PRD-04 — Cadastro de Funcionários.txt`.

## Diagnóstico inicial
1. **Botões já existiam**, mas em modo simulação:
   - Exportar mostrava toast sem gerar arquivo.
   - Importar validava somente extensão/MIME e exibia toast.
2. **Campos reais do cadastro manual** identificados no formulário:
   - Nome, CPF, empresa registrada, data de admissão, setor/função por ID e texto legado, status (ativo/inativo/afastado via flags), além de campos acessórios.
3. **Vínculo empresa/setor/função**:
   - Empresa por `companyId`.
   - Setor por `departmentId` + `companyId`.
   - Função por `jobRoleId` + `companyId`.
4. **Biblioteca Excel**:
   - Não havia `xlsx`/`exceljs` instalada diretamente para leitura/escrita `.xlsx` no módulo.
5. **Padrão de UI existente reutilizável**:
   - Dialog de importação já pronto na tela, com seleção de arquivo, drag-and-drop e toast.
6. **Padrão de importação em outras telas**:
   - Companies/Departments/JobRoles também em simulação, sem parser real.

## Viabilidade
Viável com **mudança mínima e segura** no próprio `src/pages/Employees.tsx`, reutilizando:
- o dialog atual de importação,
- `addEmployee` do contexto para persistência,
- filtros/listagem já existentes para exportação da visão atual.

## Estratégia aplicada
- Ativar exportação real para Excel com os funcionários filtrados/listados.
- Gerar planilha modelo com abas auxiliares (Empresas, Setores, Funções).
- Ler planilha de importação e validar linha a linha antes de inserir.
- Bloquear criação automática de empresa/setor/função.
- Bloquear duplicidade de CPF na mesma empresa.
- Exibir resumo no modal com totais e erros por linha.
