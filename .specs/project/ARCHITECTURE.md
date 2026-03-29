# Architecture

## Overview

Monorepo com 3 packages: API (NestJS), Web (React SPA), Shared (types + schemas).
Frontend e backend sao completamente desacoplados — comunicam via REST API com cookies httpOnly.

```
qcontabil/
├── packages/
│   ├── api/          # NestJS backend (REST API)
│   ├── web/          # React SPA (Vite)
│   └── shared/       # Zod schemas + types compartilhados
├── docker-compose.yml
└── package.json      # pnpm workspace root
```

---

## Backend (NestJS)

### Estrutura de modulos

```
packages/api/src/
├── main.ts                         # Bootstrap, cookie-parser, global guards
├── app.module.ts                   # Root module
├── common/                         # Cross-cutting concerns
│   ├── pipes/                      # ZodValidationPipe
│   ├── decorators/                 # @Public(), @CurrentUser()
│   └── filters/                    # Exception filters
├── auth/                           # Auth module
│   ├── auth.module.ts
│   ├── auth.controller.ts
│   ├── auth.service.ts
│   ├── token.service.ts
│   ├── strategies/
│   │   └── jwt.strategy.ts         # Passport JWT strategy
│   ├── guards/
│   │   └── jwt-auth.guard.ts       # Global auth guard
│   └── entities/
│       ├── user.entity.ts
│       ├── refresh-token.entity.ts
│       └── email-token.entity.ts
├── mail/                           # Mail module
│   ├── mail.module.ts
│   └── mail.service.ts
└── health/                         # Health check
    ├── health.module.ts
    └── health.controller.ts
```

### Padroes

| Pattern | Uso |
| --- | --- |
| **Module-based** | Cada dominio e um NestJS module autocontido |
| **Guard global** | JwtAuthGuard via APP_GUARD — tudo protegido, @Public() pra opt-out |
| **Zod validation** | ZodValidationPipe valida request body contra schemas do shared |
| **Repository pattern** | TypeORM repositories injetados via TypeOrmModule.forFeature() |
| **Config via env** | ConfigModule global — todas as configs via .env, nunca hardcoded |
| **Decorators** | @Public(), @CurrentUser() — limpos, declarativos |

### Convencoes

- Entidades: singular, PascalCase (`User`, `RefreshToken`)
- Tables: snake_case plural (`users`, `refresh_tokens`)
- Controllers: resource-based, prefixo `/api/` via global prefix
- Services: business logic pura, sem acesso a Request/Response (exceto TokenService pra cookies)
- Repositories: TypeORM repositories injetados via `TypeOrmModule.forFeature()` — encapsulam acesso ao DB
- DTOs: Zod schemas no shared, tipos inferidos com `z.infer`
- **Non-null assertion (`!`)**: Permitido em declaracao de campos de entities/classes inicializadas externamente (ex: TypeORM `id!: string`). Proibido em acesso a propriedades (ex: `user.address!.street`) — usar early returns, `||`, `?.`, ou type guards
- **`||` vs `??`**: Preferir `||` como default. Usar `??` apenas quando o valor pode legitimamente ser `0`, `""` ou `false` (ex: config numerica, boolean flags)

---

## Frontend (React SPA)

### Estrutura feature-based

```
packages/web/src/
├── main.tsx                        # Entry point
├── app/                            # App shell
│   ├── App.tsx                     # Root component
│   ├── Providers.tsx               # QueryClient, etc.
│   └── router.tsx                  # Route definitions (declarativo)
├── features/                       # Feature modules (colocation)
│   └── [feature]/
│       ├── pages/                  # Page components
│       ├── components/             # Feature-specific components
│       ├── api/                    # Service layer ([feature].api.ts)
│       └── stores/                 # Zustand stores (se necessario)
├── components/                     # Shared UI
│   ├── ui/                         # shadcn/ui components
│   └── [shared components]
├── lib/                            # Utilities
│   └── http-client.ts              # HTTP client agnostico (wrapper axios)
└── styles/                         # Global styles
```

### Padroes

| Pattern | Uso |
| --- | --- |
| **Feature-based colocation** | Cada feature agrupa pages/components/stores juntos |
| **Service pattern** | Camada `[feature].api.ts` encapsula chamadas HTTP — desacoplada do UI e do HTTP client |
| **HTTP client agnostico** | `lib/http-client.ts` — wrapper fino sobre axios, facil de trocar. Nao expoe axios diretamente |
| **Inline queries/mutations** | useMutation/useQuery direto no componente usando service como mutationFn |
| **Zustand pra sync state** | Estado global (auth user) — acesso sincrono sem prop drilling |
| **TanStack Query pra server state** | Cache, refetch, mutations — gerencia lifecycle do request |
| **TanStack Form + Zod** | Forms headless com validacao tipada (schemas do shared) |
| **shadcn/ui + Tailwind v4** | UI components copiados pro repo + utility CSS |

### Convencoes

- Pages: PascalCase, sufixo `Page` (`LoginPage`, `RegisterPage`)
- Components: PascalCase, sem sufixo (`PasswordStrengthMeter`)
- Stores: camelCase, sufixo `.store.ts` (`auth.store.ts`)
- API calls: via service layer (`[feature].api.ts`) usando `httpClient` de `lib/http-client.ts`
- Routing: React Router SPA mode (BrowserRouter, declarativo)
- Hooks dedicados: so quando ha reuso real em 2+ componentes ou side effects complexos

---

## Shared

### Estrutura

```
packages/shared/src/
├── index.ts                        # Re-exports
├── schemas/                        # Zod schemas (single source of truth)
│   └── auth.ts                     # loginSchema, registerSchema, etc.
└── types/                          # Types manuais (nao derivados de schema)
    ├── api.ts                      # ApiResponse, PaginatedResponse
    └── auth.ts                     # UserProfile, AuthResponse
```

### Padroes

- **Zod schemas**: Definidos aqui, consumidos no frontend (form validation) e backend (pipe validation)
- **Tipos inferidos**: `z.infer<typeof schema>` — nunca duplicar tipos manualmente
- **Tipos manuais**: So pra tipos que nao sao input de form (responses, entities parciais)
- **Naming**: Linguagem natural, sem prefixo T — `LoginInput`, `UserProfile`, nao `TLoginInput`

---

## Comunicacao Frontend ↔ Backend

- **Protocolo**: HTTPS em producao, HTTP em dev (via Vite proxy same-origin)
- **Auth**: Cookies httpOnly (access_token + refresh_token) — gerenciados pelo browser, Secure flag em prod
- **Proxy dev**: Vite proxy `/api/*` → `http://localhost:3000/*` (same-origin em dev)
- **Validacao**: Zod schemas compartilhados — mesma validacao no client e server
- **Error format**: `{ message: string, errors?: Record<string, string[]> }` — consistente
- **CORS**: Configurado pra origens especificas (sem wildcard em prod)

---

## Seguranca (cross-cutting)

| Aspecto | Implementacao |
| --- | --- |
| Auth cookies | httpOnly + Secure + SameSite=Strict |
| Password storage | bcrypt cost factor 12 |
| Token storage | Opaque refresh tokens hasheados (SHA-256) no DB |
| Rate limiting | @nestjs/throttler in-memory |
| Input validation | Zod schemas + ZodValidationPipe |
| Error responses | Nunca vazam detalhes internos |
| User enumeration | Respostas genericas em login/registro/reset |
| Security headers | Helmet (P2) |
| CORS | Origens especificas (P2) |

---

## Testing

### Piramide de Testes

```
        /\
       /E2E\        1-2 suites — fluxo critico happy path
      /------\
     /Integr. \     API endpoints — HTTP + guards + pipes + DB real
    /----------\
   / Unit Tests \   Services isolados — business logic com mocks
  /--------------\
```

### Quando usar cada nivel

| Nivel | Quando usar | Exemplo |
| --- | --- | --- |
| **Unit** | Logica de negocio com branching complexo, calculos, transformacoes | AuthService.login (lockout, replay detection, timing) |
| **Integration** | Wiring HTTP completo (controller → service → DB), cookies, status codes, guards | POST /auth/login retorna cookies httpOnly + 200 |
| **E2E** | Fluxo critico end-to-end, happy path unico | Register → verify → login → refresh → logout |

### Stack de testes

| Tool | Uso |
| --- | --- |
| Vitest | Test runner (unit + integration + E2E) |
| @nestjs/testing | Criar app NestJS pra integration/E2E |
| Supertest | HTTP assertions contra app NestJS |
| vi.fn() / vi.mock() | Mocks pra unit tests |

### Estrutura

```
packages/api/
├── vitest.config.ts
├── src/
│   └── auth/
│       └── __tests__/
│           ├── auth.service.spec.ts          # Unit
│           ├── token.service.spec.ts         # Unit
│           ├── jwt.strategy.spec.ts          # Unit
│           ├── jwt-auth.guard.spec.ts        # Unit
│           ├── zod-validation.pipe.spec.ts   # Unit
│           ├── register.int-spec.ts          # Integration
│           ├── login.int-spec.ts             # Integration
│           ├── refresh.int-spec.ts           # Integration
│           ├── logout.int-spec.ts            # Integration
│           ├── verify-email.int-spec.ts      # Integration
│           ├── password-reset.int-spec.ts    # Integration
│           ├── protected-routes.int-spec.ts  # Integration
│           ├── rate-limiting.int-spec.ts     # Integration
│           └── auth-flow.e2e-spec.ts         # E2E
```

### Convencoes

- **Naming**: `*.spec.ts` (unit), `*.int-spec.ts` (integration), `*.e2e-spec.ts` (E2E)
- **DB**: Integration/E2E usam `qcontabil_test` (PostgreSQL, porta 5434 via docker-compose)
- **Isolamento**: Truncate tables entre testes, `synchronize: true` no test DB
- **Helpers**: `createTestApp()`, `createVerifiedUser()`, `loginAndGetCookies()`
- **Scripts**: `test`, `test:unit`, `test:int`, `test:e2e`, `test:coverage`

---

## Tooling

| Tool | Versao | Uso |
| --- | --- | --- |
| pnpm | >=10.28 | Package manager (workspaces) |
| TypeScript | 5.9 | Strict mode em todos os packages |
| Vite | 8 | Frontend build + dev server |
| SWC | - | Backend compilation (via NestJS CLI) |
| ESLint | - | Linting |
| Prettier | - | Formatting (sem semicolons) |
| Docker Compose | - | PostgreSQL local (porta 5433) |
