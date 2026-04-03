# Roadmap

**Current Milestone:** M2 — CRM + Invoicing
**Status:** Complete

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

**CRM Basico** - COMPLETE

- CRUD de clientes (empresa + contatos, status, moeda, pais)
- Listagem paginada com busca/filtro (10/page)
- Detalhe do cliente com secao invoices vazia (preparada para M2)

**Geracao de Invoices** - COMPLETE

- Criar invoice vinculado a cliente
- Servico principal (descricao, horas, rate, total)
- Campos de rendas extras (bonus, reembolsos, etc.)
- Numeracao sequencial com prefixo customizavel ({PREFIX}-0001)
- Geracao de PDF (PDFKit server-side)
- Status do invoice (draft, sent, paid, cancelled)
- Block delete de clientes com invoices (oferecer inativar)
- Detalhe do cliente com historico de invoices real
- Duplicar invoice (P2)

---

## M3 — Automacao + Dashboard

**Goal:** Automatizar envio de invoices e ter visao geral do negocio
**Target:** Invoice enviado automaticamente + dashboard funcional

### Features

**Payment Integration** - SPECIFIED

- Camada de abstração PaymentProvider + implementação Tipalti v1
- Envio manual (botão) e automático (dia do mês configurável por client)
- Rastreamento de status via webhooks (sent, paid)
- Configuração de credenciais em Settings
- Notificações (email quando paid, in-app P2)

**Invoice Templates** - COMPLETE

- 3 templates pré-definidos: classic, modern, minimal
- Seleção de template no create/edit invoice
- Preview do PDF com template antes de salvar
- Template padrão configurável por company

**Dashboard** - COMPLETE

- Summary cards (faturado, pendente, recebido, contagem)
- Filtro por período (mês, trimestre, ano, últimos 12 meses)
- Gráfico de faturamento mensal
- Top 5 clientes por faturamento
- Invoices recentes (últimos 5)
- Dashboard como página inicial após login

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
