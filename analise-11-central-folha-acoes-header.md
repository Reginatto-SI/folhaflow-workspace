# Análise 11 — Central de Folha — Ações no Header do Drawer

## Componente ajustado
- `src/components/payroll/EmployeeDrawer.tsx`

## Mudança aplicada
- Reorganizado o cabeçalho do drawer para agrupar:
  - à esquerda: nome, CPF, empresa e competência
  - à direita: ações `Salvar` (primária) e `Gerar recibo` (secundária)
- Removidas as ações do `SheetFooter` para eliminar corte visual no rodapé e evitar duplicidade de CTA.
- Mantida a mesma lógica funcional dos botões (`handleSave` e estado de disable), alterando apenas posicionamento e classes visuais.
- Ajustada responsividade com `flex-wrap` no header para, em telas menores, quebrar metadados e ações em linhas sem sobreposição/corte.

## Motivo da mudança
- Os botões no rodapé estavam sendo parcialmente cortados no painel lateral, exigindo rolagem e prejudicando o fluxo operacional da Central de Folha.
- O posicionamento no topo melhora previsibilidade e velocidade de uso sem alterar comportamento de negócio.

## Impacto visual
- CTAs visíveis imediatamente na abertura do drawer.
- Botões com aparência mais compacta e reta (`size="sm"`, `h-8`, `rounded-md`, `px-4`), alinhados ao padrão operacional da interface.
- Header permanece limpo, com baixo ruído visual.

## Validações feitas
- Conferido no código que `Salvar` continua chamando `handleSave` com a mesma estrutura de payload.
- Conferido no código que `Gerar recibo` permanece secundário (`variant="outline"`) e desabilitado como já estava.
- Conferido que não houve alteração de cálculos (totais/rubricas), persistência ou regras de negócio da folha.
- Conferido que a mudança ficou restrita ao drawer da Central de Folha.
