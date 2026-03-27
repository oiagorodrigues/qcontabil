# Project Scaffolding Tasks

**Spec**: `.specs/features/project-scaffolding/spec.md`
**Status**: Approved

---

## Execution Plan

### Phase 1: Foundation (Sequential)

```
T1 → T2 → T3
```

### Phase 2: Packages (Parallel OK)

```
     ┌→ T4 (api) ──┐
T3 ──┤              ├──→ T7
     └→ T5 (web) ──┘
     T6 (shared) ───┘
```

### Phase 3: Integration (Sequential)

```
T7 → T8
```

---

## Task Breakdown

### T1: Initialize monorepo root with pnpm workspaces

**What**: Create root package.json with pnpm workspace config and base tooling configs
**Where**: `package.json`, `pnpm-workspace.yaml`, `.gitignore`, `.npmrc`
**Depends on**: None
**Requirement**: SCAF-01

**Done when**:

- [ ] `package.json` has `"private": true` and workspace scripts
- [ ] `pnpm-workspace.yaml` lists `packages/*`
- [ ] `.gitignore` covers node_modules, dist, .env, IDE files
- [ ] `.npmrc` configured

**Verify**: `pnpm install` runs without errors (no packages yet, but config valid)

---

### T2: Add base TypeScript and tooling configs

**What**: Root tsconfig.base.json, ESLint flat config, Prettier config
**Where**: `tsconfig.base.json`, `eslint.config.mjs`, `.prettierrc`, `.prettierignore`
**Depends on**: T1
**Requirement**: SCAF-04, SCAF-05

**Done when**:

- [ ] `tsconfig.base.json` with `strict: true` and shared compiler options
- [ ] ESLint flat config with TypeScript rules
- [ ] Prettier config
- [ ] Root scripts: `pnpm lint`, `pnpm format`

**Verify**: `pnpm lint` and `pnpm format` run (no files to check yet, but no config errors)

---

### T3: Add Docker Compose for PostgreSQL

**What**: Docker Compose file with PostgreSQL service and .env.example
**Where**: `docker-compose.yml`, `.env.example`
**Depends on**: T1
**Requirement**: SCAF-02

**Done when**:

- [ ] `docker compose up -d` starts PostgreSQL on port 5432
- [ ] `.env.example` has DATABASE_URL template
- [ ] Volume for data persistence

**Verify**: `docker compose up -d && docker compose exec db psql -U postgres -c 'SELECT 1'` returns 1

---

### T4: Scaffold NestJS API package

**What**: Create `packages/api` with NestJS boilerplate, TypeORM config, health endpoint
**Where**: `packages/api/`
**Depends on**: T2, T3
**Requirement**: SCAF-01, SCAF-02

**Done when**:

- [ ] NestJS app bootstraps and connects to PostgreSQL via TypeORM
- [ ] `GET /health` returns 200
- [ ] Hot reload works with `pnpm --filter api dev`
- [ ] tsconfig extends root `tsconfig.base.json`

**Verify**: `docker compose up -d && pnpm --filter api dev` → server starts, `curl localhost:3000/health` → 200

---

### T5: Scaffold React + Vite web package

**What**: Create `packages/web` with Vite + React + TypeScript, Zustand, TanStack Query, React Router
**Where**: `packages/web/`
**Depends on**: T2
**Requirement**: SCAF-01

**Done when**:

- [ ] Vite dev server starts on port 5173 with HMR
- [ ] React Router, Zustand, TanStack Query installed and configured
- [ ] tsconfig extends root `tsconfig.base.json`
- [ ] Basic App component renders

**Verify**: `pnpm --filter web dev` → browser loads app at localhost:5173

---

### T6: Create shared types package

**What**: Create `packages/shared` with TypeScript-only package for shared types/interfaces
**Where**: `packages/shared/`
**Depends on**: T2
**Requirement**: SCAF-03

**Done when**:

- [ ] Package exports types (placeholder `index.ts` with example type)
- [ ] Importable from both api and web via `@qcontabil/shared`
- [ ] tsconfig extends root `tsconfig.base.json`

**Verify**: TypeScript compiles when importing from `@qcontabil/shared` in api and web

---

### T7: Wire concurrent dev script and cross-package imports

**What**: Root `pnpm dev` runs api + web concurrently; verify shared imports work end-to-end
**Where**: root `package.json` (scripts)
**Depends on**: T4, T5, T6

**Done when**:

- [ ] `pnpm dev` starts both api and web concurrently
- [ ] Shared types imported in both api and web without errors
- [ ] All packages compile cleanly

**Verify**: `pnpm dev` → both servers running, `pnpm lint` → 0 errors, `pnpm tsc --noEmit` → 0 errors

---

### T8: Final integration verification and spec cleanup

**What**: Run all success criteria from spec, update spec traceability, commit spec updates
**Where**: `.specs/features/project-scaffolding/spec.md`
**Depends on**: T7

**Done when**:

- [ ] All spec success criteria pass
- [ ] Requirement traceability updated to Verified
- [ ] ROADMAP.md updated (Project Scaffolding → COMPLETE)

**Verify**: Manual walkthrough of all spec acceptance criteria

---

## Parallel Execution Map

```
Phase 1 (Sequential):
  T1 ──→ T2 ──→ T3

Phase 2 (Parallel):
  T3 complete, then:
    ├── T4 (api)    [P]
    ├── T5 (web)    [P]  } Can run simultaneously
    └── T6 (shared) [P]

Phase 3 (Sequential):
  T4, T5, T6 complete, then:
    T7 ──→ T8
```

## Task Granularity Check

| Task | Scope | Status |
|------|-------|--------|
| T1: Root monorepo | 4 config files | OK — cohesive setup |
| T2: Base tooling | 4 config files | OK — all tooling |
| T3: Docker Compose | 2 files | Granular |
| T4: NestJS package | 1 package scaffold | OK — single unit |
| T5: Vite+React package | 1 package scaffold | OK — single unit |
| T6: Shared types | 1 package scaffold | Granular |
| T7: Wire dev script | 1 file + verify | Granular |
| T8: Verification | spec updates only | Granular |
