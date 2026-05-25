# Análise — Refinamento de status visual e exportação na tela global de Funcionários

## 1. Diagnóstico do refinamento

A listagem global já estava correta, porém havia duas inconsistências pontuais:

1) O filtro `Ativo` podia incluir afastados, pois validava apenas `isActive`.
2) O badge da tabela mostrava apenas `Ativo/Inativo`, sem refletir `Afastado`.

Também foi aplicado refinamento de nome de arquivo na exportação para indicar o contexto atual (global ou empresa filtrada).

## 2. Inconsistência encontrada no status

- Regra anterior de filtro:
  - `active` => `isActive === true` (sem excluir `isOnLeave === true`)
- Consequência:
  - Funcionário afastado podia aparecer dentro de “Ativo”.

## 3. Ajuste aplicado no filtro de status

- `Ativo` agora exige:
  - `isActive === true` **e** `isOnLeave === false`.
- `Afastado` segue:
  - `isOnLeave === true`.
- Foi adicionada opção `Inativo` no filtro:
  - `isActive === false`.

## 4. Ajuste aplicado no badge da tabela

A prioridade visual do badge agora é:

1. `isOnLeave === true` -> `Afastado`
2. senão, `isActive === true` -> `Ativo`
3. senão -> `Inativo`

Sem criar componente novo; apenas ajuste local no mesmo `Badge` existente.

## 5. Validação dos cards

Os cards já estavam corretos e foram mantidos:

- Total: total da coleção filtrada atual.
- Ativos: `isActive && !isOnLeave`.
- Afastados: `isOnLeave`.
- Mensalistas: `isMonthly`.

## 6. Validação da exportação

A exportação continua usando a visão filtrada atual (`filteredEmployees`).

Refinamento aplicado no nome do arquivo:

- Global: `funcionarios-todas-empresas-YYYY-MM-DD.xlsx`
- Empresa filtrada: `funcionarios-{nome-empresa-slug}-YYYY-MM-DD.xlsx`

## 7. Checklist de testes

- [ ] Abrir `/funcionarios` em modo global.
- [ ] Confirmar que funcionários ativos aparecem corretamente.
- [ ] Confirmar que funcionários afastados aparecem como `Afastado`, não como `Ativo`.
- [ ] Confirmar que funcionários inativos aparecem como `Inativo`.
- [ ] Filtrar por `Ativo`.
- [ ] Filtrar por `Afastado`.
- [ ] Filtrar por `Inativo`.
- [ ] Filtrar por empresa e repetir validação de status.
- [ ] Conferir cards superiores.
- [ ] Exportar visão global.
- [ ] Exportar visão filtrada por empresa.
- [ ] Confirmar que a Central de Folha não foi alterada.
