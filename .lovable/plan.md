# Plano — Geração de Recibos de Pagamento

## Princípio
O recibo apenas **exibe** os valores que já estão calculados em memória pela mesma função `calculatePayroll` usada hoje pelo drawer e pela Central. Sem novo motor, sem recálculo paralelo, sem mudança de banco.

## Arquivos novos

1. **`src/lib/numberToWords.ts`**
   - Utilitário isolado `valorPorExtenso(valor: number): string` em pt-BR ("R$ 2.996,57" → "dois mil novecentos e noventa e seis reais e cinquenta e sete centavos").
   - Apenas para exibição no recibo. Não usado em cálculo.

2. **`src/components/payroll/Receipt.tsx`**
   - Componente único reutilizável que renderiza **um** recibo fiel ao modelo legado:
     - Cabeçalho com nome da empresa em caixa alta (bloco cinza).
     - Tabela superior com: NOME, EMPRESA, SETOR, FUNÇÃO, MÊS (ex: "ABRIL-26"), VALOR RECEBIDO, Valor por Extenso, Observação.
     - Bloco central "DISCRIMINAÇÃO DAS VERBAS" com bordas, listando todas as rubricas com valor ≠ 0 (proventos com `(+)`, descontos com `(-)`), salário base como "Salário Bruto", e linha final `(=) Líquido a receber` em destaque cinza.
     - Texto "Declaro ter recebido a importância discriminada neste recibo."
     - Linha de cidade/data + linha de assinatura + nome do funcionário.
   - Props: `{ entry, employee, company, department, jobRole, rubrics, competence }`. Recebe valores já calculados; não chama `calculatePayroll` (a página pai monta os valores via `getEntryManualValues` + `calculatePayroll`, igual ao drawer).
   - CSS dedicado em escopo `.receipt-sheet` (cores cinza claras `#dcdcdc`/`#eeeeee`, bordas pretas finas, fonte Arial/sans-serif compacta) — visual fiel ao legado, sem cards modernos / sombras / radius.
   - Quebra de página: classe `print:break-after-page` (Tailwind) + CSS `page-break-after: always` em cada recibo.

3. **`src/components/payroll/ReceiptPrintView.tsx`**
   - Página/visualização **fora do Drawer**: ocupa tela cheia (rota ou `Dialog` em modo full-screen sem chrome). Renderiza uma lista de `<Receipt />` (1 para individual, N para lote).
   - Botões topo (escondidos no print via `print:hidden`): "Imprimir / Salvar PDF" (chama `window.print()`) e "Fechar".
   - `@media print`: A4, margens 1cm, `body { background: white }`, oculta chrome do app.
   - Abertura: via estado controlado por `Index.tsx` (`receiptsOpen`, `receiptsData`).

4. **`src/lib/receiptData.ts`**
   - Função `buildReceiptData(entry, rubrics)` → retorna `{ baseSalary, lines: [{label, type:'+'|'-'|'=', value}], netSalary, valorExtenso }` usando `calculatePayroll(...)` sobre os valores manuais já persistidos. Compartilhada por individual e lote.

## Arquivos alterados

5. **`src/components/payroll/EmployeeDrawer.tsx`**
   - Reativar o botão "Gerar recibo" (hoje desabilitado com tooltip PRD-07).
   - Nova prop `onGenerateReceipt?: (entry: PayrollEntry) => void`. Ao clicar, fecha o drawer (opcional) e chama o handler com o `entry` atual já com a prévia aplicada (mesma fonte da `livePreviewEntry` usada hoje).
   - Comentário: drawer apenas dispara; render do recibo é fora.

6. **`src/components/payroll/PayrollHeader.tsx`**
   - Adicionar botão "Gerar recibos" ao lado do "Gerar relatório" (este último permanece desabilitado). Ícone `Printer`. Disparar callback `onGenerateBatchReceipts` (prop nova) ou consumir do contexto via prop drilling a partir de `Index.tsx`.

7. **`src/pages/Index.tsx`**
   - Novo estado `receiptsState: { open: boolean; entries: PayrollEntry[] } | null`.
   - `handleGenerateReceiptIndividual(entry)` → preenche com `[entry]` (usando `centralEntries` que já reflete prévia do drawer).
   - `handleGenerateBatchReceipts()` → usa `centralEntries` filtrados apenas por empresa+competência atual (ignora busca/setor/cargo? **Decisão default: respeita os filtros aplicados na tela**, pois o usuário pode querer recortar; comentário no código deixa explícito).
   - Renderiza `<ReceiptPrintView />` quando aberto.
   - Passa handlers para `PayrollHeader` e `EmployeeDrawer`.

## Dados usados (já existentes)
- Funcionário: `allEmployees` (nome, cpf).
- Empresa: `selectedCompany.name`.
- Setor: `allDepartments` via `employee.departmentId` (fallback `employee.department`).
- Função: `allJobRoles` via `employee.jobRoleId` (fallback `employee.role`).
- Competência: formato "MÊS-AA" derivado de `selectedMonth` (`"ABRIL-26"`).
- Valores das verbas: `entry.earnings`/`deductions` + `rubrics` ativos.
- Observação: padrão `"Saldo salário - <COMPETÊNCIA>"`, **substituível por `entry.notes`** se preenchido.
- Cidade na assinatura: hard-coded `"Sorriso - MT"` (igual ao modelo). **Pendência sinalizada no resumo final** — não há campo de cidade da empresa no schema.

## Impressão
- Apenas `window.print()` + CSS `@page { size: A4; margin: 1cm }`. Sem dependência nova (jspdf/html2pdf).
- Cada `<Receipt />` envolto em `<div class="receipt-sheet">` com `page-break-after: always` exceto o último.

## Restrições respeitadas
- Sem mudança em `payrollSpreadsheet.ts`, rubricas, banco, RLS, fórmulas, salvamento.
- Sem nova rota obrigatória (usa overlay full-screen) — se preferir rota dedicada `/recibos`, é trivial trocar depois.
- Mesmo componente `Receipt` serve individual e lote.

## Pendências a comunicar no resumo final
- Cidade "Sorriso - MT" fixa (não há cadastro de cidade da empresa).
- "Observação" usa `entry.notes` se houver; senão, padrão "Saldo salário - <COMPETÊNCIA>".
- Lote respeita filtros ativos da Central (busca/setor/cargo) — comportamento documentado.
