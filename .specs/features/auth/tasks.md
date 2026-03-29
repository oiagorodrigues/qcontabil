# Auth Tasks

**Design**: `.specs/features/auth/design.md`
**Status**: Complete

---

## Execution Plan

### Phase 1: Foundation (Sequential)

Dependencias de infra, schemas compartilhados, entidades, e pipes que todas as outras tasks precisam.

```
T1 → T2 → T3 → T4 → T5
```

### Phase 2: Backend Core (Parallel OK)

Servicos e logica de auth que podem ser implementados em paralelo apos a foundation.

```
       ┌→ T6  (TokenService) ─┐
T5 ────┼→ T7  (MailService)   ┼──→ T10
       └→ T8  (JwtStrategy)  ─┘
          T9  (Rate limiting) ──→
```

### Phase 3: Backend Auth Logic (Sequential)

AuthService e AuthController dependem dos servicos da Phase 2.

```
T10 → T11 → T12
```

### Phase 4: Frontend Foundation (Sequential)

HTTP client, service layer, auth store — base pra as pages.

```
T13 → T14 → T15 → T16
```

### Phase 5: Frontend Pages (Parallel OK)

Pages de auth podem ser implementadas em paralelo apos a foundation do frontend.

```
        ┌→ T17 (LoginPage)          ─┐
T16 ────┼→ T18 (RegisterPage)       ┼──→ T22
        ├→ T19 (VerifyEmailPage)    │
        ├→ T20 (ForgotPasswordPage) │
        └→ T21 (ResetPasswordPage)  ─┘
```

### Phase 6: Integration (Sequential)

Router, protected routes, e integracao final.

```
T22 → T23 → T24
```

---

## Task Breakdown

### Phase 1: Foundation

---

### T1: Instalar dependencias do backend

**What**: Instalar todos os pacotes necessarios pra auth no backend
**Where**: `packages/api/package.json`
**Depends on**: None
**Requirement**: All

**Done when**:
- [x]`@nestjs/jwt`, `@nestjs/passport`, `passport`, `passport-jwt`, `@types/passport-jwt` instalados
- [x]`@nestjs/throttler` instalado
- [x]`bcrypt`, `@types/bcrypt` instalados
- [x]`cookie-parser`, `@types/cookie-parser` instalados
- [x]`resend` instalado
- [x]`pnpm install` sem erros

**Verify:**
```bash
pnpm ls --filter api @nestjs/jwt @nestjs/passport bcrypt cookie-parser resend @nestjs/throttler
```

**Commit**: `build(api): add auth dependencies`

---

### T2: Instalar dependencias do frontend

**What**: Instalar pacotes necessarios pra auth no frontend
**Where**: `packages/web/package.json`
**Depends on**: None
**Requirement**: All

**Done when**:
- [x]`axios` instalado
- [x]`@tanstack/react-form`, `@tanstack/zod-form-adapter` instalados
- [x]`@zxcvbn-ts/core`, `@zxcvbn-ts/language-common`, `@zxcvbn-ts/language-en` instalados
- [x]`pnpm install` sem erros

**Verify:**
```bash
pnpm ls --filter web axios @tanstack/react-form @zxcvbn-ts/core
```

**Commit**: `build(web): add auth dependencies`

---

### T3: Instalar zod no shared e criar schemas de auth

**What**: Adicionar zod ao shared e criar todos os schemas de validacao de auth com tipos inferidos
**Where**: `packages/shared/src/schemas/auth.ts`, `packages/shared/src/types/auth.ts`, `packages/shared/src/index.ts`
**Depends on**: None
**Requirement**: AUTH-01, AUTH-03, AUTH-10

**Done when**:
- [x]`zod` instalado no shared
- [x]`loginSchema`, `registerSchema`, `forgotPasswordSchema`, `resetPasswordSchema`, `verifyEmailSchema` definidos
- [x]`registerSchema` com min 8 chars na password
- [x]Tipos inferidos exportados: `LoginInput`, `RegisterInput`, `ForgotPasswordInput`, `ResetPasswordInput`, `VerifyEmailInput`
- [x]`UserProfile` e `AuthResponse` tipos manuais exportados
- [x]Re-exports no `index.ts`
- [x]Typecheck passa

**Verify:**
```bash
tsc -p packages/shared/tsconfig.json --noEmit
```

**Commit**: `feat(shared): add zod auth schemas and types`

---

### T4: Criar entidades TypeORM (User, RefreshToken, EmailToken)

**What**: Criar as 3 entidades de auth com decorators TypeORM conforme design
**Where**: `packages/api/src/auth/entities/user.entity.ts`, `refresh-token.entity.ts`, `email-token.entity.ts`
**Depends on**: T1
**Requirement**: AUTH-01, AUTH-05, AUTH-02, AUTH-10

**Done when**:
- [x]`User` entity com campos: id (uuid), email (unique), passwordHash, emailVerified, failedLoginAttempts, lockedUntil, createdAt, updatedAt
- [x]`RefreshToken` entity com campos: id (uuid), tokenHash, family, revoked, expiresAt, createdAt, user (ManyToOne CASCADE), userId
- [x]`EmailToken` entity com campos: id (uuid), tokenHash, type (enum), used, expiresAt, createdAt, user (ManyToOne CASCADE), userId
- [x]Relationships corretas (User 1:N RefreshToken, User 1:N EmailToken)
- [x]Typecheck passa

**Verify:**
```bash
tsc -p packages/api/tsconfig.json --noEmit
```

**Commit**: `feat(api): add User, RefreshToken, EmailToken entities`

---

### T5: Criar ZodValidationPipe e decorators (@Public, @CurrentUser)

**What**: Criar o pipe de validacao Zod e os decorators customizados
**Where**: `packages/api/src/common/pipes/zod-validation.pipe.ts`, `packages/api/src/auth/decorators/public.decorator.ts`, `packages/api/src/auth/decorators/current-user.decorator.ts`
**Depends on**: T3 (zod no shared)
**Requirement**: AUTH-08

**Done when**:
- [x]`ZodValidationPipe` aceita um Zod schema e valida o body, retornando 400 com errors estruturados se invalido
- [x]`@Public()` decorator seta metadata `isPublic: true` na rota
- [x]`@CurrentUser()` param decorator extrai `req.user` do request
- [x]Typecheck passa

**Verify:**
```bash
tsc -p packages/api/tsconfig.json --noEmit
```

**Commit**: `feat(api): add ZodValidationPipe, @Public, @CurrentUser decorators`

---

### Phase 2: Backend Core

---

### T6: Criar TokenService (JWT access + opaque refresh + cookies)

**What**: Servico que gera/valida access tokens (JWT) e refresh tokens (opaque), e gerencia cookies httpOnly
**Where**: `packages/api/src/auth/token.service.ts`
**Depends on**: T4 (User entity), T1 (@nestjs/jwt)
**Requirement**: AUTH-04, AUTH-05, AUTH-07

**Done when**:
- [x]`generateAccessToken(user)` retorna JWT HS256 com sub, email, iat, exp (15min)
- [x]`generateRefreshToken()` retorna crypto.randomBytes(64).toString('hex')
- [x]`hashToken(token)` retorna SHA-256 hex digest
- [x]`setAuthCookies(res, accessToken, refreshToken)` seta cookies httpOnly + Secure + SameSite=Strict. Refresh token com path=/api/auth/refresh
- [x]`clearAuthCookies(res)` limpa ambos os cookies
- [x]JWT secret vem do ConfigService (JWT_SECRET env)
- [x]Typecheck passa

**Verify:**
```bash
tsc -p packages/api/tsconfig.json --noEmit
```

**Commit**: `feat(api): add TokenService for JWT and refresh token management`

---

### T7: Criar MailService (Resend + dev fallback)

**What**: Servico de envio de emails com Resend SDK, com fallback pra console.log em dev
**Where**: `packages/api/src/mail/mail.module.ts`, `packages/api/src/mail/mail.service.ts`
**Depends on**: T1 (resend package)
**Requirement**: AUTH-02, AUTH-10

**Done when**:
- [x]`MailModule` com `MailService` como provider exportado
- [x]`sendVerificationEmail(to, token)` envia email com link de verificacao
- [x]`sendPasswordResetEmail(to, token)` envia email com link de reset
- [x]Em dev (NODE_ENV !== production ou sem RESEND_API_KEY), faz console.log do link completo
- [x]Em prod, usa Resend SDK
- [x]URLs dos links vem do ConfigService (APP_URL env)
- [x]Typecheck passa

**Verify:**
```bash
tsc -p packages/api/tsconfig.json --noEmit
```

**Commit**: `feat(api): add MailService with Resend SDK and dev console fallback`

---

### T8: Criar JwtStrategy e JwtAuthGuard

**What**: Passport strategy que extrai JWT do cookie + guard global
**Where**: `packages/api/src/auth/strategies/jwt.strategy.ts`, `packages/api/src/auth/guards/jwt-auth.guard.ts`
**Depends on**: T4 (User entity), T5 (@Public decorator), T1 (passport packages)
**Requirement**: AUTH-08

**Done when**:
- [x]`JwtStrategy` extrai token do cookie `access_token` via custom extractor
- [x]`JwtStrategy` valida payload e retorna user do DB (rejeita se user nao existe)
- [x]`JwtAuthGuard` extends AuthGuard('jwt')
- [x]`JwtAuthGuard` checa metadata `isPublic` — se true, permite acesso sem token
- [x]Secret vem do ConfigService (JWT_SECRET)
- [x]Typecheck passa

**Verify:**
```bash
tsc -p packages/api/tsconfig.json --noEmit
```

**Commit**: `feat(api): add JwtStrategy and global JwtAuthGuard`

---

### T9: Configurar rate limiting (@nestjs/throttler)

**What**: Configurar ThrottlerModule global com multiplas regras pra endpoints de auth
**Where**: `packages/api/src/app.module.ts` (import ThrottlerModule)
**Depends on**: T1 (@nestjs/throttler)
**Requirement**: AUTH-12, AUTH-13, AUTH-14

**Done when**:
- [x]`ThrottlerModule.forRoot()` configurado no AppModule com regras default
- [x]ThrottlerGuard registrado como APP_GUARD
- [x]Typecheck passa

**Verify:**
```bash
tsc -p packages/api/tsconfig.json --noEmit
```

**Commit**: `feat(api): configure global rate limiting with @nestjs/throttler`

---

### Phase 3: Backend Auth Logic

---

### T10: Criar AuthService (business logic completa)

**What**: Toda a logica de auth: registro, login, refresh, logout, verificacao de email, reset de senha
**Where**: `packages/api/src/auth/auth.service.ts`
**Depends on**: T4 (entities), T5 (pipe), T6 (TokenService), T7 (MailService)
**Requirement**: AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, AUTH-06, AUTH-07, AUTH-10, AUTH-11, AUTH-13

**Done when**:
- [x]`register()`: cria user com bcrypt hash (cost 12), email normalizado (lowercase, trim), envia verification email. Retorna mensagem generica (no user enumeration)
- [x]`login()`: valida credenciais, checa emailVerified, checa lockedUntil, incrementa failedLoginAttempts, gera token pair com nova family. Timing-safe comparison
- [x]`refresh()`: busca refresh token por hash, checa expirado/revogado, replay detection (se revogado → revoga toda a family), gera novo par (mesma family)
- [x]`logout()`: revoga refresh token no DB
- [x]`verifyEmail()`: valida token hash, checa expirado/usado, marca emailVerified
- [x]`resendVerification()`: gera novo token, envia email (se user existe e nao verificado)
- [x]`forgotPassword()`: gera reset token, envia email (resposta generica sempre)
- [x]`resetPassword()`: valida token, atualiza password hash, revoga TODOS refresh tokens do user
- [x]`getProfile()`: retorna UserProfile
- [x]Validacao de password no backend: min 8 chars
- [x]Typecheck passa

**Verify:**
```bash
tsc -p packages/api/tsconfig.json --noEmit
```

**Commit**: `feat(api): implement AuthService with full auth business logic`

---

### T11: Criar AuthController (endpoints REST)

**What**: Controller com todos os endpoints de auth, rate limiting por rota, validacao Zod
**Where**: `packages/api/src/auth/auth.controller.ts`
**Depends on**: T10 (AuthService), T5 (decorators, pipe), T3 (schemas)
**Requirement**: AUTH-01, AUTH-02, AUTH-04, AUTH-05, AUTH-07, AUTH-08, AUTH-10

**Done when**:
- [x]`POST /auth/register` — @Public, ZodValidationPipe(registerSchema), @Throttle (5/1h por IP)
- [x]`POST /auth/login` — @Public, ZodValidationPipe(loginSchema), @Throttle (5/15min por IP), seta cookies via res
- [x]`POST /auth/refresh` — @Public, le refresh token do cookie, seta novos cookies via res
- [x]`POST /auth/logout` — le refresh token do cookie, limpa cookies
- [x]`POST /auth/verify-email` — @Public, ZodValidationPipe(verifyEmailSchema)
- [x]`POST /auth/resend-verification` — @Public, @Throttle
- [x]`POST /auth/forgot-password` — @Public, ZodValidationPipe(forgotPasswordSchema), @Throttle (3/1h)
- [x]`POST /auth/reset-password` — @Public, ZodValidationPipe(resetPasswordSchema)
- [x]`GET /auth/me` — autenticado, @CurrentUser, retorna UserProfile
- [x]Typecheck passa

**Verify:**
```bash
tsc -p packages/api/tsconfig.json --noEmit
```

**Commit**: `feat(api): add AuthController with all auth endpoints`

---

### T12: Criar AuthModule e registrar no AppModule

**What**: NestJS module que agrupa auth providers, registra JwtAuthGuard como global, configura cookie-parser no bootstrap
**Where**: `packages/api/src/auth/auth.module.ts`, `packages/api/src/app.module.ts`, `packages/api/src/main.ts`
**Depends on**: T11 (AuthController), T8 (JwtAuthGuard), T9 (ThrottlerModule)
**Requirement**: AUTH-08

**Done when**:
- [x]`AuthModule` importa TypeOrmModule.forFeature, JwtModule.registerAsync, PassportModule
- [x]`AuthModule` providers: AuthService, TokenService, JwtStrategy
- [x]`AuthModule` controllers: AuthController
- [x]`AuthModule` exports: JwtAuthGuard
- [x]`AppModule` importa AuthModule e MailModule
- [x]JwtAuthGuard registrado como APP_GUARD no AuthModule
- [x]`main.ts`: cookie-parser middleware adicionado
- [x]`main.ts`: global prefix `/api` configurado (se nao existir)
- [x]Health endpoint marcado com @Public()
- [x]`.env.example` atualizado com variaveis: JWT_SECRET, RESEND_API_KEY, APP_URL
- [x]Typecheck passa

**Verify:**
```bash
tsc -p packages/api/tsconfig.json --noEmit
```

**Commit**: `feat(api): create AuthModule and wire up global auth guard`

---

### Phase 4: Frontend Foundation

---

### T13: Configurar Tailwind v4 + shadcn/ui

**What**: Instalar e configurar Tailwind CSS v4 e inicializar shadcn/ui
**Where**: `packages/web/`
**Depends on**: T2
**Requirement**: AUTH-09 (precisa de UI pra pages)

**Done when**:
- [x]Tailwind v4 instalado e configurado (CSS-first, sem tailwind.config.js)
- [x]shadcn/ui inicializado com componentes base necessarios (Button, Input, Label, Card)
- [x]Estilos aplicados corretamente (verificar visualmente)
- [x]Build passa sem erros

**Verify:**
```bash
pnpm --filter web build
```

**Commit**: `build(web): configure Tailwind v4 and shadcn/ui`

---

### T14: Criar HTTP client agnostico

**What**: Wrapper fino sobre axios com interceptor de refresh transparente
**Where**: `packages/web/src/lib/http-client.ts`
**Depends on**: T2 (axios)
**Requirement**: AUTH-04, AUTH-05

**Done when**:
- [x]`httpClient` exporta metodos `get`, `post`, `put`, `delete`, `patch`
- [x]`baseURL: '/api'`, `withCredentials: true`
- [x]Response interceptor: 401 (nao refresh) → tenta POST /auth/refresh → retry original → se falha → chama `onAuthError` callback
- [x]Queue de requests pendentes durante refresh (evita multiplos refresh simultaneos)
- [x]Nao expoe axios diretamente — interface propria
- [x]Typecheck passa

**Verify:**
```bash
tsc -p packages/web/tsconfig.json --noEmit
```

**Commit**: `feat(web): create vendor-agnostic HTTP client with refresh interceptor`

---

### T15: Criar AuthStore (Zustand) e AuthProvider

**What**: Store global de auth + provider que sincroniza com TanStack Query
**Where**: `packages/web/src/features/auth/stores/auth.store.ts`, `packages/web/src/features/auth/components/AuthProvider.tsx`
**Depends on**: T14 (httpClient), T3 (UserProfile type)
**Requirement**: AUTH-09

**Done when**:
- [x]`useAuthStore` com state: user, isAuthenticated (derivado), isLoading
- [x]Actions: setUser, clearAuth (limpa state)
- [x]`AuthProvider` usa useQuery GET /auth/me pra checar sessao no mount
- [x]Sincroniza resultado com Zustand store
- [x]`httpClient.onAuthError` → clearAuth + redirect pra /login
- [x]Typecheck passa

**Verify:**
```bash
tsc -p packages/web/tsconfig.json --noEmit
```

**Commit**: `feat(web): create Zustand auth store and AuthProvider`

---

### T16: Criar Auth API service layer

**What**: Service layer que encapsula todas as chamadas HTTP de auth
**Where**: `packages/web/src/features/auth/api/auth.api.ts`
**Depends on**: T14 (httpClient), T3 (schemas/types)
**Requirement**: AUTH-01, AUTH-02, AUTH-04, AUTH-07, AUTH-10

**Done when**:
- [x]`authApi.login(data)` → POST /auth/login
- [x]`authApi.register(data)` → POST /auth/register
- [x]`authApi.logout()` → POST /auth/logout
- [x]`authApi.refresh()` → POST /auth/refresh
- [x]`authApi.verifyEmail(data)` → POST /auth/verify-email
- [x]`authApi.resendVerification(email)` → POST /auth/resend-verification
- [x]`authApi.forgotPassword(data)` → POST /auth/forgot-password
- [x]`authApi.resetPassword(data)` → POST /auth/reset-password
- [x]`authApi.me()` → GET /auth/me
- [x]Usa `httpClient` internamente (nao axios diretamente)
- [x]Tipos de input/output tipados com schemas do shared
- [x]Typecheck passa

**Verify:**
```bash
tsc -p packages/web/tsconfig.json --noEmit
```

**Commit**: `feat(web): create auth API service layer`

---

### Phase 5: Frontend Pages

---

### T17: Criar LoginPage

**What**: Pagina de login com form email/senha, links pra registro e forgot password
**Where**: `packages/web/src/features/auth/pages/LoginPage.tsx`
**Depends on**: T13 (shadcn/ui), T16 (authApi), T15 (auth store)
**Requirement**: AUTH-04, AUTH-09

**Done when**:
- [x]Form com TanStack Form + Zod adapter (loginSchema)
- [x]useMutation inline com `authApi.login`
- [x]On success: invalida query 'auth/me', navega pra redirectTo ou /
- [x]Mostra erro generico em 401
- [x]Mostra mensagem de rate limit em 429
- [x]Links pra /register e /forgot-password
- [x]Loading state no botao durante submit
- [x]Typecheck passa

**Verify:**
```bash
tsc -p packages/web/tsconfig.json --noEmit
```

**Commit**: `feat(web): create LoginPage with auth form`

---

### T18: Criar RegisterPage com PasswordStrengthMeter

**What**: Pagina de registro com form, strength meter (zxcvbn-ts), e componente PasswordStrengthMeter
**Where**: `packages/web/src/features/auth/pages/RegisterPage.tsx`, `packages/web/src/features/auth/components/PasswordStrengthMeter.tsx`
**Depends on**: T13 (shadcn/ui), T16 (authApi), T2 (zxcvbn-ts)
**Requirement**: AUTH-01, AUTH-03, AUTH-09

**Done when**:
- [x]`PasswordStrengthMeter` lazy loads zxcvbn-ts, mostra barra colorida (0-4) + feedback textual
- [x]`PasswordStrengthMeter` props: password, onScoreChange
- [x]Form com TanStack Form + Zod adapter (registerSchema)
- [x]Submit bloqueado se zxcvbn score < 3
- [x]useMutation inline com `authApi.register`
- [x]On success: redireciona pra pagina de "verifique seu email"
- [x]Mostra erro generico em 400
- [x]Link pra /login
- [x]Typecheck passa

**Verify:**
```bash
tsc -p packages/web/tsconfig.json --noEmit
```

**Commit**: `feat(web): create RegisterPage with password strength meter`

---

### T19: Criar VerifyEmailPage

**What**: Pagina que processa token de verificacao da URL
**Where**: `packages/web/src/features/auth/pages/VerifyEmailPage.tsx`
**Depends on**: T13 (shadcn/ui), T16 (authApi)
**Requirement**: AUTH-02, AUTH-09

**Done when**:
- [x]Extrai token dos query params da URL
- [x]useMutation com `authApi.verifyEmail` disparado no mount (com token)
- [x]Estado de sucesso: mostra mensagem + link pra /login
- [x]Estado de erro: mostra mensagem + botao pra resend (pede email)
- [x]Estado de loading: spinner
- [x]Typecheck passa

**Verify:**
```bash
tsc -p packages/web/tsconfig.json --noEmit
```

**Commit**: `feat(web): create VerifyEmailPage`

---

### T20: Criar ForgotPasswordPage

**What**: Pagina com form de email pra solicitar reset de senha
**Where**: `packages/web/src/features/auth/pages/ForgotPasswordPage.tsx`
**Depends on**: T13 (shadcn/ui), T16 (authApi)
**Requirement**: AUTH-10, AUTH-09

**Done when**:
- [x]Form com TanStack Form + Zod adapter (forgotPasswordSchema)
- [x]useMutation inline com `authApi.forgotPassword`
- [x]On success: mostra mensagem generica "Se o email existir, enviaremos um link"
- [x]Link pra /login
- [x]Typecheck passa

**Verify:**
```bash
tsc -p packages/web/tsconfig.json --noEmit
```

**Commit**: `feat(web): create ForgotPasswordPage`

---

### T21: Criar ResetPasswordPage

**What**: Pagina com form de nova senha + strength meter, processa token da URL
**Where**: `packages/web/src/features/auth/pages/ResetPasswordPage.tsx`
**Depends on**: T13 (shadcn/ui), T16 (authApi), T18 (PasswordStrengthMeter)
**Requirement**: AUTH-10, AUTH-09

**Done when**:
- [x]Extrai token dos query params da URL
- [x]Form com TanStack Form + Zod adapter (resetPasswordSchema)
- [x]Inclui PasswordStrengthMeter, submit bloqueado se score < 3
- [x]useMutation inline com `authApi.resetPassword`
- [x]On success: redireciona pra /login com mensagem de sucesso
- [x]On error (token invalido/expirado): mostra erro + link pra /forgot-password
- [x]Typecheck passa

**Verify:**
```bash
tsc -p packages/web/tsconfig.json --noEmit
```

**Commit**: `feat(web): create ResetPasswordPage with strength meter`

---

### Phase 6: Integration

---

### T22: Criar ProtectedRoute e configurar router

**What**: Componente wrapper de protecao de rotas + configuracao do React Router declarativo
**Where**: `packages/web/src/components/ProtectedRoute.tsx`, `packages/web/src/app/router.tsx`, `packages/web/src/app/App.tsx`
**Depends on**: T15 (AuthStore), T17-T21 (pages)
**Requirement**: AUTH-09

**Done when**:
- [x]`ProtectedRoute`: checa isAuthenticated, redirect pra `/login?redirect={currentPath}` se nao autenticado, loading spinner se isLoading
- [x]`router.tsx`: define todas as rotas — auth pages como publicas, restante dentro de ProtectedRoute
- [x]`App.tsx`: usa AuthProvider como wrapper, renderiza Routes
- [x]Login redireciona pra URL preservada apos autenticacao
- [x]Typecheck passa

**Verify:**
```bash
tsc -p packages/web/tsconfig.json --noEmit
```

**Commit**: `feat(web): add ProtectedRoute and configure router`

---

### T23: Configurar env vars e testar fluxo end-to-end

**What**: Configurar .env com todas as variaveis, rodar migrations, e testar fluxo completo
**Where**: `.env`, `.env.example`, `packages/api/`
**Depends on**: T12 (backend completo), T22 (frontend completo)
**Requirement**: All

**Done when**:
- [x]`.env.example` com todas as variaveis documentadas: DATABASE_URL, JWT_SECRET, RESEND_API_KEY, APP_URL, NODE_ENV
- [x]TypeORM synchronize=true pra dev (ou migration manual)
- [x]App inicia sem erros (`pnpm dev`)
- [x]Health check funciona: GET /api/health → 200
- [x]Endpoint protegido sem token: → 401

**Verify:**
```bash
pnpm dev
# Em outro terminal:
curl http://localhost:3000/api/health
curl http://localhost:3000/api/auth/me  # deve retornar 401
```

**Commit**: `chore: configure env vars and verify auth integration`

---

### T24: Testar fluxos de seguranca

**What**: Verificar que todas as protecoes de seguranca funcionam corretamente
**Where**: Testes manuais via curl/browser
**Depends on**: T23
**Requirement**: AUTH-06, AUTH-12, AUTH-13, AUTH-14

**Done when**:
- [x]Registro com email duplicado retorna mensagem generica (no user enumeration)
- [x]Login com credenciais erradas retorna mensagem generica
- [x]Rate limiting funciona (6a tentativa retorna 429)
- [x]Cookies sao httpOnly + SameSite=Strict (verificar no browser)
- [x]Refresh token rotation funciona (token antigo invalido)
- [x]Logout limpa cookies e invalida refresh token
- [x]Rotas protegidas retornam 401 sem token

**Verify:**
```bash
# Rate limit test
for i in {1..6}; do curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/api/auth/login -H "Content-Type: application/json" -d '{"email":"test@test.com","password":"wrong"}'; done
# 6th request should return 429
```

**Commit**: `test: verify auth security measures`

---

### Phase 7: Test Infrastructure + Automated Tests

Substitui T23/T24 (verificacao manual) por testes automatizados seguindo a piramide de testes.

---

### T25: Instalar dependencias de teste e configurar Vitest

**What**: Instalar vitest, @nestjs/testing, supertest, unplugin-swc. Configurar vitest.config.ts, test scripts, e DB de teste no docker-compose
**Where**: `packages/api/package.json`, `packages/api/vitest.config.ts`, `docker-compose.yml`, `package.json` (root)
**Depends on**: T12 (backend completo)
**Requirement**: All (infra de teste)

**Done when**:
- [x]`vitest`, `@nestjs/testing`, `supertest`, `@types/supertest`, `unplugin-swc` instalados como devDependencies no api
- [x]`vitest.config.ts` criado com `unplugin-swc` plugin (necessario pra decorator metadata)
- [x]`docker-compose.yml` com servico `db-test` (PostgreSQL porta 5434, DB `qcontabil_test`)
- [x]Scripts: `test`, `test:watch`, `test:unit`, `test:int`, `test:e2e`, `test:coverage` no api
- [x]Scripts: `test`, `test:unit`, `test:int`, `test:e2e` no root
- [x]`pnpm --filter api test:unit` roda sem erros (0 tests found OK)

**Verify:**
```bash
pnpm ls --filter api vitest @nestjs/testing supertest unplugin-swc
pnpm --filter api test:unit
```

**Commit**: `build(api): add test infrastructure (vitest, nestjs/testing, supertest, test DB)`

---

### T26: Criar test helpers

**What**: Factory functions reutilizaveis: createTestApp, createVerifiedUser, loginAndGetCookies, truncateAllTables
**Where**: `packages/api/src/auth/__tests__/helpers/test-app.ts`, `packages/api/src/auth/__tests__/helpers/test-users.ts`
**Depends on**: T25
**Requirement**: All (suporte a testes)

**Done when**:
- [x]`createTestApp()` cria app NestJS com cookie-parser e prefix `/api`
- [x]`createVerifiedUser(app, email, password)` registra e marca emailVerified=true via DB direto
- [x]`loginAndGetCookies(app, email, password)` faz login e retorna cookies
- [x]`truncateAllTables(app)` limpa user, refresh_token, email_token
- [x]Typecheck passa

**Verify:**
```bash
tsc -p packages/api/tsconfig.json --noEmit
```

**Commit**: `test(api): add test helpers (createTestApp, user factories, truncate)`

---

### T27: Unit tests — ZodValidationPipe + TokenService + JwtAuthGuard

**What**: Testes unitarios para componentes isolados com mocks
**Where**: `packages/api/src/common/pipes/__tests__/zod-validation.pipe.spec.ts`, `packages/api/src/auth/__tests__/token.service.spec.ts`, `packages/api/src/auth/__tests__/jwt-auth.guard.spec.ts`
**Depends on**: T25
**Requirement**: AUTH-04, AUTH-05, AUTH-08

**Done when**:
- [x]ZodValidationPipe: valid input, invalid input (structured errors), strips unknown, applies transforms
- [x]TokenService: generateAccessToken (JWT payload), generateRefreshToken (128 hex), hashToken (SHA-256 deterministic), getRefreshTokenExpiresAt (~7d), setAuthCookies (httpOnly+SameSite+path), clearAuthCookies
- [x]JwtAuthGuard: permite com @Public, delega ao parent sem @Public
- [x]Todos passam: `pnpm --filter api test:unit`

**Verify:**
```bash
pnpm --filter api test:unit
```

**Commit**: `test(api): add unit tests for ZodValidationPipe, TokenService, JwtAuthGuard`

---

### T28: Unit tests — AuthService

**What**: Testes unitarios para toda a business logic do AuthService com repos e services mockados
**Where**: `packages/api/src/auth/__tests__/auth.service.spec.ts`
**Depends on**: T25
**Requirement**: AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, AUTH-06, AUTH-07, AUTH-10, AUTH-11, AUTH-13

**Done when**:
- [x]register: cria user com hash, envia email, retorna mensagem generica pra duplicado (no enumeration)
- [x]login: sucesso com token pair, timing-safe hash pra email inexistente, incrementa failedLoginAttempts, lock apos 10 tentativas, ForbiddenException pra email nao verificado, reset attempts no sucesso
- [x]refresh: revoga token atual + novo par (mesma family), UnauthorizedException pra token invalido, revoga family inteira no replay, rejeita expirado
- [x]verifyEmail: marca verified + token usado, rejeita usado, rejeita expirado
- [x]resetPassword: atualiza hash + revoga todos refresh tokens, rejeita senha < 8 chars
- [x]forgotPassword: envia reset pra verificado, envia verification pra nao verificado, mensagem generica pra inexistente
- [x]getProfile: retorna UserProfile, UnauthorizedException pra inexistente
- [x]Todos passam: `pnpm --filter api test:unit`

**Verify:**
```bash
pnpm --filter api test:unit
```

**Commit**: `test(api): add AuthService unit tests (register, login, refresh, reset, verify)`

---

### T29: Integration tests — Endpoints de auth

**What**: Testes de integracao contra DB real via supertest. Testam HTTP layer completo: status codes, cookies, validation, guards
**Where**: `packages/api/src/auth/__tests__/register.int-spec.ts`, `login.int-spec.ts`, `refresh.int-spec.ts`, `logout.int-spec.ts`, `verify-email.int-spec.ts`, `password-reset.int-spec.ts`, `protected-routes.int-spec.ts`
**Depends on**: T26 (helpers)
**Requirement**: AUTH-01, AUTH-02, AUTH-04, AUTH-05, AUTH-06, AUTH-07, AUTH-08, AUTH-10, AUTH-11, AUTH-13

**Done when**:
- [x]register: sucesso 200, duplicado 200 (no enumeration), email invalido 400, senha curta 400, normaliza email
- [x]login: cookies httpOnly 200, user no body, wrong password 401 generico, email inexistente 401 generico, unverified 403, lockout apos 10 falhas
- [x]refresh: rotation (novo par), replay detection (revoga family), sem cookie 200 generico
- [x]logout: limpa cookies 200, refresh apos logout 401
- [x]verify-email: token invalido 400, vazio 400, missing 400
- [x]password-reset: forgot generico 200 (existe e nao existe), reset com token invalido 400, senha curta 400
- [x]protected-routes: /health publico 200, /auth/me sem token 401, /auth/me com cookie 200
- [x]Todos passam: `DATABASE_URL=...test pnpm --filter api test:int`

**Verify:**
```bash
docker compose up db-test -d
DATABASE_URL=postgresql://qcontabil:qcontabil@localhost:5434/qcontabil_test pnpm --filter api test:int
```

**Commit**: `test(api): add auth integration tests (register, login, refresh, logout, verify, reset, routes)`

---

### T30: Integration test — Rate limiting

**What**: Testes de throttling nos endpoints de auth
**Where**: `packages/api/src/auth/__tests__/rate-limiting.int-spec.ts`
**Depends on**: T26 (helpers)
**Requirement**: AUTH-12, AUTH-14

**Done when**:
- [x]login throttled apos 5 tentativas → 429
- [x]register throttled apos 5 tentativas → 429
- [x]forgot-password throttled apos 3 tentativas → 429
- [x]Todos passam: `DATABASE_URL=...test pnpm --filter api test:int`

**Verify:**
```bash
DATABASE_URL=postgresql://qcontabil:qcontabil@localhost:5434/qcontabil_test pnpm --filter api test:int -- --include 'rate-limiting'
```

**Commit**: `test(api): add rate limiting integration tests`

---

### T31: E2E test — Fluxo critico completo

**What**: Um unico teste sequencial que valida o happy path: register → verify → login → me → refresh → logout → denied
**Where**: `packages/api/src/auth/__tests__/auth-flow.e2e-spec.ts`
**Depends on**: T26 (helpers)
**Requirement**: AUTH-01, AUTH-02, AUTH-04, AUTH-05, AUTH-07, AUTH-08

**Done when**:
- [x]Spy no MailService pra capturar raw verification token
- [x]Fluxo sequencial completo: register → login falha (unverified) → verify email → login sucesso (cookies) → GET /me (200) → refresh (novo par) → logout → refresh com token antigo (401)
- [x]Passa: `DATABASE_URL=...test pnpm --filter api test:e2e`

**Verify:**
```bash
DATABASE_URL=postgresql://qcontabil:qcontabil@localhost:5434/qcontabil_test pnpm --filter api test:e2e
```

**Commit**: `test(api): add full auth lifecycle E2E test`

---

## Parallel Execution Map

```
Phase 1 (Sequential — Foundation):
  T1 ──→ T2 ──→ T3 ──→ T4 ──→ T5

Phase 2 (Parallel — Backend Core):
  T5 done, then:
    ├── T6 [P] (TokenService)
    ├── T7 [P] (MailService)
    ├── T8 [P] (JwtStrategy)
    └── T9 [P] (Throttler)

Phase 3 (Sequential — Backend Auth Logic):
  T6,T7,T8 done, then:
    T10 ──→ T11 ──→ T12

Phase 4 (Sequential — Frontend Foundation):
  T13 ──→ T14 ──→ T15 ──→ T16

Phase 5 (Parallel — Frontend Pages):
  T16 done, then:
    ├── T17 [P] (LoginPage)
    ├── T18 [P] (RegisterPage)
    ├── T19 [P] (VerifyEmailPage)
    ├── T20 [P] (ForgotPasswordPage)
    └── T21 [P] (ResetPasswordPage)

Phase 6 (Sequential — Integration):
  T17-T21 done, then:
    T22 ──→ T23 ──→ T24

Phase 7 (Test Infrastructure + Automated Tests):
  T12 done, then:
    T25 ──→ T26
    T25 done, then (parallel):
      ├── T27 [P] (Unit: pipe, token, guard)
      └── T28 [P] (Unit: AuthService)
    T26 done, then (parallel):
      ├── T29 [P] (Integration: endpoints)
      ├── T30 [P] (Integration: rate limiting)
      └── T31 [P] (E2E: full flow)
```

---

## Task Granularity Check

| Task | Scope | Status |
| --- | --- | --- |
| T1: Instalar deps backend | 1 package.json | Granular |
| T2: Instalar deps frontend | 1 package.json | Granular |
| T3: Schemas Zod + types | 3 files (schema, types, index) | OK — cohesive |
| T4: Entidades TypeORM | 3 files (1 per entity) | OK — cohesive |
| T5: Pipe + decorators | 3 files (1 per concern) | OK — cohesive |
| T6: TokenService | 1 service | Granular |
| T7: MailService | 1 module + 1 service | OK — cohesive |
| T8: JwtStrategy + Guard | 2 files (strategy + guard) | OK — tightly coupled |
| T9: Throttler config | 1 module config | Granular |
| T10: AuthService | 1 service (complex) | OK — single responsibility |
| T11: AuthController | 1 controller | Granular |
| T12: AuthModule + wiring | 3 files (module, app.module, main) | OK — wiring |
| T13: Tailwind + shadcn | Config + CLI init | Granular |
| T14: HTTP client | 1 file | Granular |
| T15: AuthStore + Provider | 2 files (store + provider) | OK — tightly coupled |
| T16: Auth API service | 1 file | Granular |
| T17-T21: Pages | 1 page each | Granular |
| T22: Router + ProtectedRoute | 3 files (route, component, app) | OK — wiring |
| T23: Env + E2E test | Config + verification | Granular |
| T24: Security tests | Verification only | Granular |
| T25: Test infra + vitest | Config + docker + scripts | OK — cohesive |
| T26: Test helpers | 2 files (app factory + user helpers) | OK — tightly coupled |
| T27: Unit (pipe, token, guard) | 3 test files | OK — cohesive (simple units) |
| T28: Unit (AuthService) | 1 test file (complex) | Granular |
| T29: Integration (endpoints) | 7 test files | OK — one per endpoint group |
| T30: Integration (rate limit) | 1 test file | Granular |
| T31: E2E (full flow) | 1 test file | Granular |

---

## Requirement Coverage

| Requirement | Task(s) |
| --- | --- |
| AUTH-01 (Register) | T3, T4, T10, T11, T18 |
| AUTH-02 (Email verification) | T4, T7, T10, T11, T19 |
| AUTH-03 (Password strength) | T3, T10, T18 |
| AUTH-04 (Access token) | T6, T10, T11, T14, T17 |
| AUTH-05 (Refresh token) | T4, T6, T10, T11, T14 |
| AUTH-06 (Replay detection) | T10, T24, T28, T29, T31 |
| AUTH-07 (Logout) | T6, T10, T11, T16 |
| AUTH-08 (Backend guard) | T5, T8, T12 |
| AUTH-09 (Frontend protection) | T15, T17-T22 |
| AUTH-10 (Password reset) | T3, T4, T7, T10, T11, T20, T21 |
| AUTH-11 (Invalidate sessions) | T10 |
| AUTH-12 (IP throttling) | T9, T11, T24, T30 |
| AUTH-13 (Account lockout) | T10, T24, T28, T29 |
| AUTH-14 (Reg/reset throttling) | T9, T11, T24, T30 |
| AUTH-15 (Security headers) | — (P2, future) |
| AUTH-16 (CORS) | — (P2, future) |

**Coverage**: 14/14 P1 requirements mapped (code + tests), 2 P2 deferred
