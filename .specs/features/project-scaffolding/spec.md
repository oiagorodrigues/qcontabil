# Project Scaffolding Specification

## Problem Statement

O projeto precisa de uma estrutura base funcional antes de qualquer feature. Sem scaffolding, cada feature vai gastar tempo configurando tooling, build, e integracao entre frontend e backend.

## Goals

- [ ] Monorepo funcional com backend (NestJS) e frontend (React+Vite) rodando localmente
- [ ] PostgreSQL local via Docker Compose
- [ ] Tipos compartilhados entre packages
- [ ] Linting e formatting unificados
- [ ] Dev experience fluida (hot reload, scripts simples)

## Out of Scope

| Feature | Reason |
|---------|--------|
| CI/CD pipeline | M4 — deploy vem depois |
| Auth | Feature separada no M1 |
| Deploy config (Dockerfile prod) | M4 |
| Testes E2E | Será configurado por feature |

---

## User Stories

### P1: Monorepo com pnpm workspaces ⭐ MVP

**User Story**: As a developer, I want a monorepo with api and web packages so that I can develop both from a single repo with shared dependencies.

**Why P1**: Sem isso nada mais funciona.

**Acceptance Criteria**:

1. WHEN developer runs `pnpm install` at root THEN system SHALL install dependencies for all packages
2. WHEN developer runs `pnpm --filter api dev` THEN NestJS server SHALL start on port 3000 with hot reload
3. WHEN developer runs `pnpm --filter web dev` THEN Vite dev server SHALL start on port 5173 with HMR
4. WHEN developer runs `pnpm dev` at root THEN both api and web SHALL start concurrently

**Independent Test**: Run `pnpm dev` and verify both servers respond (api: `GET /` → 200, web: browser loads app)

---

### P1: PostgreSQL com Docker Compose ⭐ MVP

**User Story**: As a developer, I want a local PostgreSQL instance via Docker Compose so that I can develop against a real database without installing Postgres locally.

**Why P1**: Backend precisa de DB desde o primeiro endpoint.

**Acceptance Criteria**:

1. WHEN developer runs `docker compose up -d` THEN PostgreSQL SHALL start on port 5432
2. WHEN NestJS server starts THEN it SHALL connect to the local PostgreSQL instance via TypeORM
3. WHEN database is not running THEN api SHALL fail with a clear connection error message

**Independent Test**: `docker compose up -d && pnpm --filter api dev` → server logs "Database connected"

---

### P1: Package de tipos compartilhados ⭐ MVP

**User Story**: As a developer, I want a shared types package so that API and frontend use the same type definitions.

**Why P1**: Evita drift de tipos entre front e back desde o inicio.

**Acceptance Criteria**:

1. WHEN a type is defined in `packages/shared` THEN it SHALL be importable from both `api` and `web`
2. WHEN a shared type changes THEN TypeScript SHALL flag incompatibilities in both packages

**Independent Test**: Create a type in shared, import in api and web, verify TypeScript compiles

---

### P1: Linting e Formatting ⭐ MVP

**User Story**: As a developer, I want unified ESLint and Prettier config so that code style is consistent across all packages.

**Why P1**: Debito tecnico de estilo acumula rapido sem isso.

**Acceptance Criteria**:

1. WHEN developer runs `pnpm lint` at root THEN ESLint SHALL check all packages
2. WHEN developer runs `pnpm format` at root THEN Prettier SHALL format all packages
3. WHEN code has lint errors THEN ESLint SHALL report them with file and line number

**Independent Test**: Introduce a lint error, run `pnpm lint`, verify it's caught

---

### P2: TypeScript strict mode

**User Story**: As a developer, I want strict TypeScript config so that type safety catches bugs early.

**Why P2**: Important but not blocking — can tighten later.

**Acceptance Criteria**:

1. WHEN tsconfig is loaded THEN `strict: true` SHALL be enabled in all packages
2. WHEN packages extend the base config THEN they SHALL inherit strict settings from root `tsconfig.base.json`

**Independent Test**: Write code with implicit `any`, verify TypeScript errors

---

## Edge Cases

- WHEN `node_modules` is deleted and `pnpm install` runs THEN all packages SHALL resolve correctly
- WHEN Docker is not installed THEN `docker compose up` SHALL fail with a clear error (not a silent hang)
- WHEN ports 3000 or 5173 are in use THEN dev servers SHALL report the port conflict clearly

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
|----------------|-------|-------|--------|
| SCAF-01 | P1: Monorepo pnpm workspaces | Execute | Verified |
| SCAF-02 | P1: PostgreSQL Docker Compose | Execute | Verified |
| SCAF-03 | P1: Shared types package | Execute | Verified |
| SCAF-04 | P1: Linting e Formatting | Execute | Verified |
| SCAF-05 | P2: TypeScript strict mode | Execute | Verified |

**Coverage:** 5 total, 0 mapped to tasks, 5 unmapped

---

## Success Criteria

- [x] `pnpm dev` starts both api and web with hot reload
- [x] `docker compose up -d` provides a working PostgreSQL (port 5433)
- [x] Shared types importable from both packages
- [x] `pnpm lint` and `pnpm format` work across all packages
- [x] Zero TypeScript errors with strict mode
