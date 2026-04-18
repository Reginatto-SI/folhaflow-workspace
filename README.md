# 📊 Folha App

Sistema interno de gestão de folha de pagamento para grupo empresarial.

---

## 🎯 Objetivo

O Folha App é uma evolução de planilhas operacionais, com foco em:

- processamento rápido e repetível da folha
- redução de erro manual
- rastreabilidade e auditoria
- padronização entre empresas

> O sistema NÃO é um ERP completo — é uma “planilha estruturada com regras”.

---

## 🧠 Princípios do Sistema (REGRA DE OURO)

- Cálculo é **determinístico** (mesma entrada = mesmo resultado)
- **UI NÃO calcula**
- Toda lógica vem do **motor de cálculo**
- Rubricas são a **única fonte de valores**
- Classificação é a **única fonte de agrupamento**
- Não usar heurística (ex: nome de rubrica)

---

## 🧱 Arquitetura (visão simples)

### 1. Dados
- Empresas
- Funcionários
- Rubricas
- Folhas

### 2. Core (Motor)
- cálculo da folha
- execução das regras
- reprocessamento

### 3. Interface (UI)
- exibição
- edição
- ações (salvar, recalcular, gerar)

> ⚠️ A interface nunca deve conter lógica de negócio.

---

## 📦 Módulos do Sistema

- Empresas → base cadastral simples :contentReference[oaicite:1]{index=1}  
- Funcionários → dados cadastrais (sem salário) :contentReference[oaicite:2]{index=2}  
- Setores / Cargos → organização por empresa :contentReference[oaicite:3]{index=3}  
- Rubricas → base de cálculo :contentReference[oaicite:4]{index=4}  
- Central de Folha → operação principal :contentReference[oaicite:5]{index=5}  
- Motor de Cálculo → core do sistema :contentReference[oaicite:6]{index=6}  
- Recibos → saída operacional :contentReference[oaicite:7]{index=7}  
- Relatórios → consolidação de dados :contentReference[oaicite:8]{index=8}  
- Usuários → controle de acesso :contentReference[oaicite:9]{index=9}  

---

## 🔁 Fluxo Principal

1. Selecionar empresa
2. Selecionar competência
3. Criar ou duplicar folha
4. Revisar valores
5. Recalcular
6. Salvar
7. Gerar recibos/relatórios

---

## ⚙️ Regras Críticas (NÃO QUEBRAR)

- ❌ Não calcular no frontend  
- ❌ Não usar nome de rubrica como regra  
- ❌ Não duplicar lógica fora do motor  
- ❌ Não tratar duplicação como cálculo final  
- ❌ Não criar lógica paralela em relatórios  

- ✅ Motor é a única fonte de verdade  
- ✅ Classificação organiza exibição  
- ✅ Sistema deve ser previsível  

---

## 🧩 Duplicação de Folha

- Nova folha sempre nasce em `rascunho`
- Não copia resultado final cegamente
- Serve como base operacional
- Sempre exige revisão e recálculo :contentReference[oaicite:10]{index=10}  

---

## 🔐 Controle de Acesso

- Baseado em permissões por tela
- Validação obrigatória no backend
- UI não garante segurança :contentReference[oaicite:11]{index=11}  

---

## 🚀 Diretriz para uso com IA (Codex / Lovable)

Antes de qualquer implementação:

1. Ler PRDs em `/public/PRD/`
2. Respeitar princípios do sistema
3. NÃO criar novos padrões sem necessidade
4. Reutilizar componentes existentes
5. Aplicar sempre a menor mudança possível

---

## 📁 Estrutura do Projeto

- `/public/PRD/` → fonte oficial de regras
- `/public/Analises/` → análises do Codex
- `/src` → código da aplicação

---

## 📌 Observação Final

Este sistema foi projetado para ser:

> simples, previsível e operacional

Evite complexidade desnecessária.
Se tiver dúvida: o PRD é a fonte da verdade.
