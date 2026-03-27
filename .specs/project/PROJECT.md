# Qcontabil

**Vision:** App de contabilidade para freelancers, contractors e ICs brasileiros (MEI, EI, ME) que prestam serviços para empresas estrangeiras, com foco em gestao de clientes, invoicing e automacao de envio.

**For:** Solo prestadores de servicos brasileiros que faturam para empresas de fora (principalmente EUA)

**Solves:** Gestao manual e fragmentada de clientes, invoices e envio para provedores de pagamento — sem ferramentas especificas para esse nicho.

## Goals

- Centralizar gestao de clientes internacionais e geracao de invoices em um unico app
- Automatizar o ciclo de invoicing (gerar, enviar para provedor, rastrear status)
- Simplificar a gestao da empresa (dados cadastrais, regime tributario)

## Tech Stack

**Core:**

- Frontend: React + Vite (SPA)
- Backend: NestJS (Node.js)
- Database: PostgreSQL
- Deploy: AWS

**Key dependencies:**

- TypeORM (ORM)
- React Router (routing SPA)
- TanStack Query (data fetching)
- Zustand (state management)

## Scope

**v1 includes:**

- Auth (login/registro)
- Cadastro da empresa (MEI/EI/ME, CNPJ, dados bancarios)
- CRM basico (CRUD de clientes: empresa, pais, contato, moeda)
- Geracao de invoices (servico principal + campos de rendas extras)
- Envio automatizado para provedor de pagamento (integracao TBD — Tipalti como target)
- Dashboard simples (invoices recentes, status, totais)

**Explicitly out of scope:**

- Multi-idioma (app em PT-BR)
- Relatorios fiscais / DAS / DASN-SIMEI
- Integracao com sistemas contabeis (Omie, Conta Azul)
- Multi-moeda complexa (USD padrao, BRL secundario)
- App mobile
- Landing page publica

## Constraints

- Timeline: sem deadline — side hustle, ritmo proprio
- Resources: solo dev
- Technical: AWS como deploy target (objetivo de aprendizado)
- Integracao provedor: sem acesso a API Tipalti por enquanto — provedor a ser definido pos-MVP
