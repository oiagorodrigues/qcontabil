# Dashboard

**Milestone:** M3 — Automação + Dashboard
**Scope:** Medium
**Status:** SPECIFIED

---

## Overview

Dashboard financeiro com resumo do negócio: totais faturados/pendentes/recebidos, invoices recentes, métricas por cliente e por período. Filtro por mês, trimestre, ano, ou últimos 12 meses.

## Actors

- **Contractor** — visualiza métricas do seu negócio

## Preconditions

- Invoices com status e valores persistidos (M2)
- Clients com dados completos (M2)

---

## Requirements

### Summary Cards

| ID | Requirement | Priority |
|----|-------------|----------|
| DSH-01 | Card "Total Faturado" — soma de `total` de invoices com status `sent` + `paid` no período | P0 |
| DSH-02 | Card "Pendente" — soma de `total` de invoices com status `sent` no período | P0 |
| DSH-03 | Card "Recebido" — soma de `total` de invoices com status `paid` no período | P0 |
| DSH-04 | Card "Invoices" — contagem total de invoices no período (breakdown por status) | P0 |
| DSH-05 | Cada card mostra variação percentual vs período anterior (ex: +12% vs mês passado) | P1 |

### Period Filter

| ID | Requirement | Priority |
|----|-------------|----------|
| DSH-06 | Filtro de período: mês atual, trimestre atual, ano atual, últimos 12 meses | P0 |
| DSH-07 | Filtro de moeda: lista moedas usadas nos invoices do contractor, default = moeda mais frequente | P0 |
| DSH-08 | Default período: mês atual | P0 |
| DSH-09-a | Filtros persistem durante a sessão (não recarrega ao navegar) | P1 |

### Invoices Recentes

| ID | Requirement | Priority |
|----|-------------|----------|
| DSH-09 | Lista dos 5 invoices mais recentes com: número, cliente, status badge, valor, data | P0 |
| DSH-10 | Link para invoice detail ao clicar | P0 |
| DSH-11 | Link "Ver todos" para a listagem completa de invoices | P0 |

### Métricas

| ID | Requirement | Priority |
|----|-------------|----------|
| DSH-12 | Gráfico de barras: faturamento mensal (últimos 6 ou 12 meses dependendo do filtro) | P0 |
| DSH-13 | Tabela: top 5 clientes por faturamento no período (nome, total, % do total) | P0 |
| DSH-14 | Média mensal de faturamento no período | P1 |

### API

| ID | Requirement | Priority |
|----|-------------|----------|
| DSH-15 | Endpoint `GET /api/dashboard/summary?period=<month\|quarter\|year\|last12>` retorna summary cards | P0 |
| DSH-16 | Endpoint `GET /api/dashboard/revenue-chart?period=<...>` retorna dados do gráfico mensal | P0 |
| DSH-17 | Endpoint `GET /api/dashboard/top-clients?period=<...>` retorna ranking de clientes | P0 |
| DSH-18 | Todos os endpoints filtram por `userId` (multi-tenant by user) | P0 |

### Navigation

| ID | Requirement | Priority |
|----|-------------|----------|
| DSH-19 | Dashboard é a página inicial após login (rota `/`) | P0 |
| DSH-20 | Link "Dashboard" no sidebar/nav principal | P0 |

---

## Out of Scope

- Gráficos interativos (drill-down, zoom)
- Export de relatórios (CSV, PDF)
- Métricas de conversão (draft → sent → paid)
- Dashboard multi-moeda (agrega tudo na moeda do invoice, sem conversão)
- Invoices recorrentes / previsões
- Real-time updates (refresh manual ou refetch on focus)

## Design Notes

- Queries agregam direto no DB (SUM, COUNT, GROUP BY) — não carregam todos os invoices
- Multi-moeda: se invoices têm moedas diferentes, cada card/gráfico mostra por moeda separadamente OU agrupa assumindo single-currency (decisão de design)
- Chart library: recharts (já popular no ecossistema React + lightweight)

## Decision: Multi-moeda

Filtro de moeda no dashboard (opção B). Contractor seleciona USD, EUR, etc. e todos os cards/gráficos refletem apenas invoices nessa moeda. Default: moeda mais usada.
