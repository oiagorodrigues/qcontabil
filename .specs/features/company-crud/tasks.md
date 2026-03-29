# Cadastro da Empresa - Tasks

**Design**: `.specs/features/company-crud/design.md`
**Status**: Draft

---

## Execution Plan

### Phase 1: Shared Foundation (Sequential)

Tipos, enums, validador e schemas compartilhados — tudo depende disso.

```
T1 → T2 → T3
```

### Phase 2: Backend (Sequential)

Entity, service, controller, migration — cada um depende do anterior.

```
T3 → T4 → T5 → T6 → T7
```

### Phase 3: Backend Tests (Parallel OK)

Unit e integration tests rodam independentes.

```
      ┌→ T8  (unit: cnpj validator)  ─┐
T7 ──→┼→ T9  (unit: company service)  ┼──→ T13
      ├→ T10 (int: create company)     │
      ├→ T11 (int: get company)        │
      └→ T12 (int: update company)    ─┘
```

### Phase 4: Frontend (Sequential)

API service, form, view, page, router — cada um compoe o proximo.

```
T13 → T14 → T15 → T16 → T17 → T18
```

---

## Task Breakdown

### T1: Criar enums e types no shared

**What**: Definir enums `TaxRegime`, `AccountType`, `BrazilianState` e interface `CompanyResponse`
**Where**: `packages/shared/src/types/company.ts`
**Depends on**: None
**Reuses**: Pattern de `packages/shared/src/types/auth.ts`
**Requirement**: COMP-04, COMP-08

**Done when**:
- [ ] Enums TaxRegime (MEI, EI, ME, SLU, LTDA), AccountType (CORRENTE, POUPANCA, COMPANY), BrazilianState (27 UFs) exportados
- [ ] Interface CompanyResponse com todos os campos do design exportada
- [ ] Re-export em `packages/shared/src/index.ts`
- [ ] No TypeScript errors: `rtk pnpm --filter @qcontabil/shared run build`

---

### T2: Criar validador de CNPJ no shared

**What**: Funcao `isValidCnpj(cnpj: string): boolean` com algoritmo de digitos verificadores
**Where**: `packages/shared/src/validators/cnpj.ts`
**Depends on**: None (pode rodar em paralelo com T1, mas T3 depende de ambos)
**Reuses**: Nenhum — logica nova
**Requirement**: COMP-02

**Done when**:
- [ ] Funcao valida CNPJs reais corretamente
- [ ] Rejeita CNPJs com digitos verificadores errados
- [ ] Rejeita CNPJs com todos os digitos iguais (00.000.000/0000-00, 11.111.111/1111-11, etc.)
- [ ] Aceita input com 14 digitos (sem mascara)
- [ ] Re-export em `packages/shared/src/index.ts`
- [ ] No TypeScript errors

---

### T3: Criar Zod schemas de company no shared

**What**: Schemas `createCompanySchema` e `updateCompanySchema` com validacao Zod + CNPJ refine
**Where**: `packages/shared/src/schemas/company.ts`
**Depends on**: T1 (enums), T2 (isValidCnpj)
**Reuses**: Pattern de `packages/shared/src/schemas/auth.ts`
**Requirement**: COMP-01, COMP-02, COMP-03, COMP-04, COMP-05

**Done when**:
- [ ] `createCompanySchema` com todos os campos do design (obrigatorios + opcionais)
- [ ] CNPJ validado via `.refine(isValidCnpj)`
- [ ] Tipos `CreateCompanyInput` e `UpdateCompanyInput` inferidos e exportados
- [ ] Re-export em `packages/shared/src/index.ts`
- [ ] No TypeScript errors: `rtk pnpm --filter @qcontabil/shared run build`

---

### T4: Criar Company entity (TypeORM)

**What**: Entity TypeORM `Company` mapeando tabela `companies` com todos os campos e relationship com User
**Where**: `packages/api/src/company/company.entity.ts`
**Depends on**: T1 (enums)
**Reuses**: Pattern de `packages/api/src/auth/entities/user.entity.ts`
**Requirement**: COMP-01, COMP-05, COMP-09, COMP-10

**Done when**:
- [ ] Entity com todos os campos do design (dados gerais, endereco, bancarios)
- [ ] `comment` em todos os `@Column()` (exceto id)
- [ ] `@Unique(['cnpj'])` e `@Unique(['userId'])`
- [ ] `@ManyToOne(() => User)` com `@JoinColumn({ name: 'user_id' })`
- [ ] Campos bancarios nullable, demais required
- [ ] snake_case nos nomes de colunas
- [ ] No TypeScript errors: `rtk pnpm --filter @qcontabil/api run build`

---

### T5: Criar CompanyService

**What**: Service com logica de negocio: create, findByUser, update — com regras 1:1 e CNPJ unico
**Where**: `packages/api/src/company/company.service.ts`
**Depends on**: T4 (entity)
**Reuses**: Pattern de `packages/api/src/auth/auth.service.ts` (repository injection)
**Requirement**: COMP-01, COMP-05, COMP-06, COMP-07, COMP-08, COMP-09, COMP-10

**Done when**:
- [ ] `create(userId, data)` — cria empresa, throw ConflictException se user ja tem empresa ou CNPJ duplicado
- [ ] `findByUser(userId)` — retorna empresa ou null
- [ ] `update(userId, data)` — atualiza empresa, throw NotFoundException se nao existe, ConflictException se CNPJ duplicado
- [ ] Strip `userId` do response (nao expor)
- [ ] No TypeScript errors

---

### T6: Criar CompanyController + CompanyModule

**What**: Controller com endpoints POST /companies, GET /companies/me, PUT /companies/me + module wiring
**Where**: `packages/api/src/company/company.controller.ts`, `packages/api/src/company/company.module.ts`
**Depends on**: T3 (schemas), T5 (service)
**Reuses**: ZodValidationPipe, @CurrentUser(), pattern de AuthController
**Requirement**: COMP-01, COMP-06, COMP-08

**Done when**:
- [ ] `POST /companies` — body validado com `createCompanySchema` via ZodValidationPipe, retorna `ApiResponse<CompanyResponse>`
- [ ] `GET /companies/me` — retorna empresa do user ou 404
- [ ] `PUT /companies/me` — body validado com `updateCompanySchema`, retorna empresa atualizada
- [ ] CompanyModule importa TypeOrmModule.forFeature([Company])
- [ ] CompanyModule registrado no AppModule
- [ ] No TypeScript errors: `rtk pnpm --filter @qcontabil/api run build`

---

### T7: Criar migration da tabela companies

**What**: Migration TypeORM criando tabela `companies` com todas as colunas, constraints e FK
**Where**: `packages/api/src/migrations/`
**Depends on**: T4 (entity), T6 (module registrado — pra poder testar)
**Requirement**: COMP-01

**Done when**:
- [ ] Migration cria tabela `companies` com todos os campos
- [ ] FK `user_id` referenciando `users.id`
- [ ] Unique constraints em `cnpj` e `user_id`
- [ ] Enum types criados no PostgreSQL (tax_regime, account_type, brazilian_state)
- [ ] Migration roda sem erros: `rtk pnpm --filter @qcontabil/api run migration:run`
- [ ] Migration reverte sem erros: `rtk pnpm --filter @qcontabil/api run migration:revert`

**Verify**:
```bash
# Subir DB e rodar migration
docker compose up -d
rtk pnpm --filter @qcontabil/api run migration:run
# Verificar tabela criada
docker compose exec postgres psql -U qcontabil -c "\d companies"
```

---

### T8: Testes unitarios — CNPJ validator [P]

**What**: Testes para `isValidCnpj` cobrindo edge cases
**Where**: `packages/shared/src/validators/cnpj.spec.ts`
**Depends on**: T2 (validator)
**Requirement**: COMP-02

**Done when**:
- [ ] Testa CNPJs validos conhecidos (pelo menos 3)
- [ ] Testa CNPJs com digito errado
- [ ] Testa CNPJs com todos digitos iguais (00000000000000, 11111111111111, etc.)
- [ ] Testa input com tamanho errado
- [ ] Testa input vazio
- [ ] Todos passam: `rtk pnpm --filter @qcontabil/shared run test`

---

### T9: Testes unitarios — CompanyService [P]

**What**: Testes unitarios para logica de negocio do service com mocks de repository
**Where**: `packages/api/src/company/company.service.spec.ts`
**Depends on**: T5 (service)
**Reuses**: Pattern de `packages/api/src/auth/auth.service.spec.ts`
**Requirement**: COMP-01, COMP-06, COMP-09, COMP-10

**Done when**:
- [ ] Testa criacao com sucesso
- [ ] Testa ConflictException quando user ja tem empresa
- [ ] Testa ConflictException quando CNPJ duplicado
- [ ] Testa findByUser retorna empresa
- [ ] Testa findByUser retorna null quando nao existe
- [ ] Testa update com sucesso
- [ ] Testa NotFoundException no update
- [ ] Todos passam: `rtk pnpm --filter @qcontabil/api run test:unit`

---

### T10: Testes integration — POST /companies [P]

**What**: Testes de integracao para criacao de empresa via HTTP
**Where**: `packages/api/test/company/create.integration.ts`
**Depends on**: T7 (migration rodando)
**Reuses**: `createTestApp()`, `createVerifiedUser()`, `loginAndGetCookies()` de test helpers
**Requirement**: COMP-01, COMP-02, COMP-09, COMP-10

**Done when**:
- [ ] Testa criacao com dados validos — 201 + body correto
- [ ] Testa validacao — CNPJ invalido retorna 400
- [ ] Testa validacao — campos obrigatorios faltando retorna 400
- [ ] Testa conflito — user ja tem empresa retorna 409
- [ ] Testa conflito — CNPJ duplicado retorna 409
- [ ] Testa sem auth — retorna 401
- [ ] Todos passam: `rtk pnpm --filter @qcontabil/api run test:integration`

---

### T11: Testes integration — GET /companies/me [P]

**What**: Testes de integracao para busca de empresa do user logado
**Where**: `packages/api/test/company/get.integration.ts`
**Depends on**: T7 (migration rodando)
**Reuses**: Test helpers
**Requirement**: COMP-08

**Done when**:
- [ ] Testa retorno com empresa cadastrada — 200 + body correto
- [ ] Testa retorno sem empresa — 404
- [ ] Testa sem auth — 401
- [ ] Todos passam: `rtk pnpm --filter @qcontabil/api run test:integration`

---

### T12: Testes integration — PUT /companies/me [P]

**What**: Testes de integracao para atualizacao de empresa
**Where**: `packages/api/test/company/update.integration.ts`
**Depends on**: T7 (migration rodando)
**Reuses**: Test helpers
**Requirement**: COMP-06, COMP-07

**Done when**:
- [ ] Testa update com dados validos — 200 + body atualizado
- [ ] Testa validacao — CNPJ invalido retorna 400
- [ ] Testa sem empresa — 404
- [ ] Testa sem auth — 401
- [ ] Todos passam: `rtk pnpm --filter @qcontabil/api run test:integration`

---

### T13: Criar API service no frontend

**What**: Camada HTTP com funcoes `getMyCompany`, `createCompany`, `updateCompany`
**Where**: `packages/web/src/features/company/api/company.api.ts`
**Depends on**: T1 (types), T6 (endpoints existindo)
**Reuses**: Pattern de `packages/web/src/features/auth/api/auth.api.ts`, `httpClient`
**Requirement**: COMP-01, COMP-06, COMP-08

**Done when**:
- [ ] `getMyCompany()` — GET /companies/me, retorna `CompanyResponse`
- [ ] `createCompany(data)` — POST /companies, retorna `CompanyResponse`
- [ ] `updateCompany(data)` — PUT /companies/me, retorna `CompanyResponse`
- [ ] Usa `httpClient` de `lib/http-client.ts`
- [ ] Types corretos (sem any)
- [ ] No TypeScript errors

---

### T14: Criar CompanyForm

**What**: Formulario com TanStack Form + Zod para criacao e edicao, com 3 secoes (dados gerais, endereco, bancario)
**Where**: `packages/web/src/features/company/components/CompanyForm.tsx`
**Depends on**: T3 (schemas), T13 (api service)
**Reuses**: TanStack Form + Zod pattern (auth forms), shadcn/ui (Input, Label, Button, Card)
**Requirement**: COMP-01, COMP-02, COMP-03, COMP-05, COMP-06

**Done when**:
- [ ] Form com todos os campos do schema organizado em 3 secoes
- [ ] CNPJ com mascara de input (XX.XXX.XXX/XXXX-XX) — envia sem mascara
- [ ] CEP com mascara de input (XXXXX-XXX) — envia sem mascara
- [ ] Selects para regime tributario, estado (UF), tipo de conta
- [ ] Validacao inline por campo (Zod schema)
- [ ] Props: `initialData?`, `onSubmit`, `isSubmitting`
- [ ] Secao bancaria com campos opcionais
- [ ] Usa shadcn/ui components
- [ ] No TypeScript errors

---

### T15: Criar CompanyView

**What**: Componente de visualizacao em modo leitura com dados formatados
**Where**: `packages/web/src/features/company/components/CompanyView.tsx`
**Depends on**: T1 (types)
**Reuses**: shadcn/ui (Card)
**Requirement**: COMP-08

**Done when**:
- [ ] Exibe todos os campos da empresa em modo leitura
- [ ] CNPJ formatado (XX.XXX.XXX/XXXX-XX)
- [ ] CEP formatado (XXXXX-XXX)
- [ ] Endereco completo em uma linha
- [ ] Secao bancaria mostra "Nao cadastrado" se vazia
- [ ] Botao "Editar" chama `onEdit()`
- [ ] No TypeScript errors

---

### T16: Criar CompanyPage

**What**: Pagina que orquestra estados: loading, empty, view, create, edit
**Where**: `packages/web/src/features/company/pages/CompanyPage.tsx`
**Depends on**: T13 (api), T14 (form), T15 (view)
**Reuses**: TanStack Query (useQuery, useMutation), pattern inline mutations
**Requirement**: COMP-01, COMP-06, COMP-08

**Done when**:
- [ ] Loading state com `<Loading />`
- [ ] Empty state com CTA "Cadastrar empresa"
- [ ] View state renderiza `<CompanyView />`
- [ ] Create state renderiza `<CompanyForm />`
- [ ] Edit state renderiza `<CompanyForm initialData={company} />`
- [ ] Mutations com useMutation inline (create, update)
- [ ] Invalidate query apos mutation sucesso
- [ ] Error handling (toast ou mensagem inline)
- [ ] No TypeScript errors

---

### T17: Adicionar rota /empresa no router

**What**: Lazy import de CompanyPage + rota protegida no router
**Where**: `packages/web/src/app/router.tsx`
**Depends on**: T16 (page)
**Reuses**: Pattern de lazy() + ProtectedRoute ja existente
**Requirement**: COMP-01

**Done when**:
- [ ] `const CompanyPage = lazy(() => import(...))`
- [ ] Rota `/empresa` dentro de `<ProtectedRoute />`
- [ ] No TypeScript errors

---

### T18: Smoke test manual end-to-end

**What**: Verificar fluxo completo: login → navegar pra /empresa → cadastrar → visualizar → editar
**Depends on**: T17 (rota configurada)
**Requirement**: Todos

**Done when**:
- [ ] App roda sem erros: `pnpm dev`
- [ ] Login funciona
- [ ] /empresa mostra estado vazio
- [ ] Cadastrar empresa com dados validos — salva e mostra dados
- [ ] Editar empresa — altera dados e salva
- [ ] Refresh da pagina mantem dados
- [ ] CNPJ invalido mostra erro no form

---

## Parallel Execution Map

```
Phase 1 — Shared (Sequential):
  T1 ──→ T2 ──→ T3

Phase 2 — Backend (Sequential):
  T3 ──→ T4 ──→ T5 ──→ T6 ──→ T7

Phase 3 — Tests (Parallel):
  T7 complete, then:
    ├── T8  [P] (unit: cnpj)
    ├── T9  [P] (unit: service)
    ├── T10 [P] (int: create)
    ├── T11 [P] (int: get)
    └── T12 [P] (int: update)

Phase 4 — Frontend (Sequential):
  T13 ──→ T14 ──→ T15 ──→ T16 ──→ T17 ──→ T18
  (T13 pode iniciar apos T6, em paralelo com T7-T12)
```

---

## Task Granularity Check

| Task | Scope | Status |
| --- | --- | --- |
| T1: Enums + types | 1 file | ✅ Granular |
| T2: CNPJ validator | 1 funcao | ✅ Granular |
| T3: Zod schemas | 1 file | ✅ Granular |
| T4: Company entity | 1 file | ✅ Granular |
| T5: CompanyService | 1 file | ✅ Granular |
| T6: Controller + Module | 2 files coesos | ⚠️ OK — controller nao faz sentido sem module |
| T7: Migration | 1 file | ✅ Granular |
| T8-T12: Tests | 1 file cada | ✅ Granular |
| T13: API service | 1 file | ✅ Granular |
| T14: CompanyForm | 1 componente | ✅ Granular |
| T15: CompanyView | 1 componente | ✅ Granular |
| T16: CompanyPage | 1 componente | ✅ Granular |
| T17: Router update | 1 file modify | ✅ Granular |
| T18: Smoke test | Verificacao | ✅ Granular |

---

## Requirement Traceability

| Requirement ID | Tasks | Status |
| --- | --- | --- |
| COMP-01 | T1, T3, T4, T5, T6, T7, T10, T13, T14, T16, T17 | Pending |
| COMP-02 | T2, T3, T8, T10, T14 | Pending |
| COMP-03 | T3, T14 | Pending |
| COMP-04 | T1, T3 | Pending |
| COMP-05 | T1, T3, T4, T5, T14 | Pending |
| COMP-06 | T5, T6, T9, T12, T13, T14, T16 | Pending |
| COMP-07 | T5, T12 | Pending |
| COMP-08 | T1, T5, T6, T11, T13, T15, T16 | Pending |
| COMP-09 | T4, T5, T9, T10 | Pending |
| COMP-10 | T4, T5, T9, T10 | Pending |

**Coverage:** 10/10 requirements mapped ✅
