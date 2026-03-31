# Roadmap

**Current Milestone:** M1 — Foundation
**Status:** In Progress

---

## M1 — Foundation

**Goal:** App funcional com auth, cadastro de empresa e estrutura base do projeto
**Target:** Projeto rodando local com auth e empresa configurada

### Features

**Project Scaffolding** - COMPLETE

- Monorepo setup (NestJS + React/Vite)
- PostgreSQL local (Docker Compose, porta 5433)
- Configuracao base (ESLint, Prettier, TypeScript strict)
- CI basico (lint + typecheck)

**Auth** - COMPLETE

- Registro com email/senha
- Login / Logout
- Sessao persistente (JWT ou session)
- Protecao de rotas (frontend + backend)

**Cadastro da Empresa** - COMPLETE

- CRUD dados da empresa (razao social, CNPJ, regime: MEI/EI/ME/SLU/LTDA)
- Dados bancarios (beneficiario, banco, tipo conta, IBAN, SWIFT)
- Vinculo empresa <-> usuario (1:1 no v1)
- Validacao CNPJ com algoritmo de digitos verificadores
- Zod schemas compartilhados (frontend + backend)

---

## M2 — CRM + Invoicing

**Goal:** Gerenciar clientes e gerar invoices completos
**Target:** Fluxo completo: criar cliente -> gerar invoice -> PDF

### Features

**CRM Basico** - IN PROGRESS

- CRUD de clientes (empresa + contatos, status, moeda, pais)
- Listagem paginada com busca/filtro (10/page)
- Detalhe do cliente com secao invoices vazia (preparada para M2)

**Geracao de Invoices** - PLANNED

- Criar invoice vinculado a cliente
- Servico principal (descricao, horas, rate, total)
- Campos de rendas extras (bonus, reembolsos, etc.)
- Numeracao sequencial automatica
- Geracao de PDF
- Status do invoice (draft, sent, paid)
- **Nota**: Reavaliar hard delete de clientes → soft delete (cliente com invoices nao pode ser deletado)
- **Nota**: Detalhe do cliente tera historico de invoices real (substituir secao vazia)

---

## M3 — Automacao + Dashboard

**Goal:** Automatizar envio de invoices e ter visao geral do negocio
**Target:** Invoice enviado automaticamente + dashboard funcional

### Features

**Automacao de Envio** - PLANNED

- Integracao com provedor de pagamento (API TBD)
- Envio automatico do invoice no dia configurado
- Rastreamento de status (enviado, recebido, pago)
- Notificacoes (email ou in-app)

**Dashboard** - PLANNED

- Resumo financeiro (total faturado, pendente, recebido)
- Invoices recentes com status
- Proximos invoices a gerar
- Metricas basicas (media mensal, por cliente)

---

## M4 — Deploy + Polish

**Goal:** App em producao na AWS
**Target:** App acessivel publicamente, pronto para uso real

### Features

**Infra AWS** - PLANNED

- Deploy backend (ECS ou EC2)
- Deploy frontend (S3 + CloudFront)
- RDS PostgreSQL
- CI/CD pipeline

**Polish** - PLANNED

- Error handling robusto
- Loading states e UX refinada
- Validacoes de formulario
- Responsividade basica

---

## Future Considerations

- Multi-idioma (EN para clientes verem o invoice)
- Relatorios fiscais (DAS, DASN-SIMEI)
- Integracao com contabilidade (Omie, Conta Azul)
- Multi-moeda com conversao automatica
- App mobile (React Native)
- Landing page publica
- Multi-empresa por usuario
