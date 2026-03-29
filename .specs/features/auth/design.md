# Auth Design

**Spec**: `.specs/features/auth/spec.md`
**Status**: Draft

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React)                         │
│                                                                 │
│  ┌──────────┐  ┌──────────┐  ┌───────────┐  ┌───────────────┐  │
│  │ AuthPages│  │ AuthStore │  │ApiClient  │  │ ProtectedRoute│  │
│  │(TanStack │→ │ (zustand) │→ │ (axios)   │  │ (guard)       │  │
│  │  Form)   │  └──────────┘  └─────┬─────┘  └───────────────┘  │
│  └──────────┘                      │                            │
│                                    │                            │
└────────────────────────────────────┼────────────────────────────┘
                                     │ httpOnly cookies (automatic)
                                     │
┌────────────────────────────────────┼────────────────────────────┐
│                        BACKEND (NestJS)                         │
│                                     │                           │
│  ┌──────────┐  ┌──────────────┐  ┌─┴───────┐  ┌─────────────┐  │
│  │Throttler │→ │ AuthController│→ │AuthSvc  │→ │ TokenService│  │
│  │ (guard)  │  │ (endpoints)  │  │(logic)  │  │ (JWT+opaque)│  │
│  └──────────┘  └──────────────┘  └────┬────┘  └─────────────┘  │
│                                       │                         │
│  ┌──────────┐  ┌──────────────┐  ┌────┴────┐  ┌─────────────┐  │
│  │JwtGuard  │  │ MailService  │  │UserRepo │  │RefreshToken  │  │
│  │(passport)│  │ (resend)     │  │(TypeORM)│  │Repo (TypeORM)│  │
│  └──────────┘  └──────────────┘  └─────────┘  └─────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                                     │
                              ┌──────┴──────┐
                              │ PostgreSQL   │
                              │ users        │
                              │ refresh_tkns │
                              │ email_tokens │
                              └─────────────┘
```

**Flow resumido:**
1. Frontend faz requests via axios — cookies httpOnly sao enviados automaticamente pelo browser
2. Backend valida access token via JwtGuard (passport-jwt, extrai do cookie)
3. Se access token expirou, frontend intercepta 401 e chama `/api/auth/refresh`
4. Refresh endpoint valida opaque token (hash lookup no DB), emite novo par de tokens
5. Rate limiting via @nestjs/throttler no nivel de controller/rota

---

## Code Reuse Analysis

### Existing Components to Leverage

| Component | Location | How to Use |
| --- | --- | --- |
| ConfigModule (global) | `app.module.ts` | JWT secret, cookie config, mail config via env vars |
| TypeORM async config | `app.module.ts` | Mesmo pattern pra registrar entidades no AuthModule |
| ApiResponse | `@qcontabil/shared` | Respostas padronizadas nos endpoints de auth |
| QueryClient + BrowserRouter | `main.tsx` | Auth pages usam TanStack Query pra mutations |
| Vite proxy `/api/*` | `vite.config.ts` | Cookies funcionam same-origin via proxy em dev |

### Integration Points

| System | Integration Method |
| --- | --- |
| PostgreSQL | TypeORM entities (User, RefreshToken, EmailToken) |
| Email | Resend SDK — em dev, console.log do link |
| Frontend state | Zustand auth store com sync via TanStack Query |
| Validation | Zod schemas compartilhados (shared) → frontend (TanStack Form) + backend (NestJS pipe) |
| HTTP abstraction | Service pattern (authApi) → httpClient agnostico → TQ mutations inline |

---

## Components

### Backend

#### AuthModule

- **Purpose**: NestJS module que agrupa todos os providers de auth
- **Location**: `packages/api/src/auth/auth.module.ts`
- **Imports**: TypeOrmModule.forFeature([User, RefreshToken, EmailToken]), JwtModule, PassportModule, ThrottlerModule
- **Exports**: JwtAuthGuard (pra uso global)

#### AuthController

- **Purpose**: Endpoints REST de autenticacao
- **Location**: `packages/api/src/auth/auth.controller.ts`
- **Endpoints**:
  - `POST /api/auth/register` — registro (AUTH-01, AUTH-03)
  - `POST /api/auth/login` — login com email/senha (AUTH-04, AUTH-05)
  - `POST /api/auth/refresh` — refresh token rotation (AUTH-05, AUTH-06)
  - `POST /api/auth/logout` — logout (AUTH-07)
  - `POST /api/auth/verify-email` — verificar email com token (AUTH-02)
  - `POST /api/auth/resend-verification` — reenviar email de verificacao (AUTH-02)
  - `POST /api/auth/forgot-password` — solicitar reset (AUTH-10)
  - `POST /api/auth/reset-password` — executar reset com token (AUTH-10, AUTH-11)
  - `GET /api/auth/me` — retorna user autenticado (AUTH-08)
- **Rate limiting**: Throttle customizado por rota via @Throttle()

#### AuthService

- **Purpose**: Business logic de autenticacao (registro, login, verificacao, reset)
- **Location**: `packages/api/src/auth/auth.service.ts`
- **Interfaces**:
  - `register(dto: RegisterInput): Promise<{ message: string }>` — cria user + envia verification email
  - `login(dto: LoginInput): Promise<TokenPair>` — valida credenciais, retorna tokens
  - `refresh(hashedToken: string): Promise<TokenPair>` — rotacao de refresh token
  - `logout(userId: string, refreshToken: string): Promise<void>` — invalida refresh token
  - `verifyEmail(token: string): Promise<void>` — marca email como verificado
  - `forgotPassword(email: string): Promise<void>` — envia email de reset
  - `resetPassword(token: string, newPassword: string): Promise<void>` — reseta senha
  - `getProfile(userId: string): Promise<UserProfile>` — retorna dados do user
- **Dependencies**: UserRepository, RefreshTokenRepository, EmailTokenRepository, TokenService, MailService

#### TokenService

- **Purpose**: Geracao e validacao de tokens (JWT access + opaque refresh)
- **Location**: `packages/api/src/auth/token.service.ts`
- **Interfaces**:
  - `generateAccessToken(user: User): string` — JWT com sub, email, iat, exp
  - `generateRefreshToken(): string` — crypto.randomBytes(64).toString('hex')
  - `hashToken(token: string): string` — SHA-256 hash do opaque token
  - `setAuthCookies(res: Response, accessToken: string, refreshToken: string): void` — set httpOnly cookies
  - `clearAuthCookies(res: Response): void` — clear cookies on logout
- **Dependencies**: JwtService (@nestjs/jwt), ConfigService

#### JwtStrategy

- **Purpose**: Passport strategy pra extrair e validar JWT do cookie
- **Location**: `packages/api/src/auth/strategies/jwt.strategy.ts`
- **Config**:
  - `jwtFromRequest`: custom extractor que le do cookie `access_token`
  - `secretOrKey`: JWT_SECRET do env
  - `ignoreExpiration`: false
- **Dependencies**: ConfigService, UserRepository
- **Nota**: Uma Strategy e uma classe Passport que define COMO extrair e validar credenciais de um request. O Passport e o framework, a strategy implementa a logica especifica (neste caso: ler JWT do cookie, verificar assinatura HS256, retornar user).

#### JwtAuthGuard

- **Purpose**: Guard que protege rotas autenticadas
- **Location**: `packages/api/src/auth/guards/jwt-auth.guard.ts`
- **Usage**: Global via APP_GUARD — todas as rotas protegidas por default
- **Behavior**: Retorna 401 se token invalido/expirado. Rotas publicas usam @Public() pra skip.

#### MailService

- **Purpose**: Envio de emails (verificacao, reset)
- **Location**: `packages/api/src/mail/mail.service.ts`
- **Interfaces**:
  - `sendVerificationEmail(to: string, token: string): Promise<void>`
  - `sendPasswordResetEmail(to: string, token: string): Promise<void>`
- **Dependencies**: Resend SDK, ConfigService (RESEND_API_KEY)
- **Dev mode**: Console.log do link completo (sem envio real)

#### Public Decorator

- **Purpose**: Marca rotas como publicas (skip JwtAuthGuard)
- **Location**: `packages/api/src/auth/decorators/public.decorator.ts`
- **Usage**: `@Public()` em endpoints que nao precisam de auth (register, login, health)

#### CurrentUser Decorator

- **Purpose**: Extrai user do request em rotas autenticadas
- **Location**: `packages/api/src/auth/decorators/current-user.decorator.ts`
- **Usage**: `@CurrentUser() user: User` como param decorator

#### ZodValidationPipe

- **Purpose**: Pipe NestJS que valida request body contra Zod schema
- **Location**: `packages/api/src/common/pipes/zod-validation.pipe.ts`
- **Usage**: `@UsePipes(new ZodValidationPipe(loginSchema))` ou global

---

### Frontend

#### Arquitetura: Feature-based (colocation)

```
packages/web/src/
├── app/                    # App shell, providers, router
│   ├── App.tsx
│   ├── Providers.tsx       # QueryClient, etc.
│   └── router.tsx          # Route definitions
├── features/               # Feature modules (colocation)
│   └── auth/
│       ├── pages/          # LoginPage, RegisterPage, etc.
│       ├── components/     # PasswordStrengthMeter, etc.
│       └── stores/         # auth.store.ts
├── components/             # Shared UI components
│   ├── ui/                 # shadcn/ui components
│   └── ProtectedRoute.tsx
├── lib/                    # Utilities
│   └── api.ts              # Axios instance
└── main.tsx
```

#### AuthStore (Zustand)

- **Purpose**: Estado global de autenticacao
- **Location**: `packages/web/src/features/auth/stores/auth.store.ts`
- **State**:
  - `user: UserProfile | null` — dados do user logado
  - `isAuthenticated: boolean` — derivado de user !== null
  - `isLoading: boolean` — loading state inicial (checando sessao)
- **Actions**:
  - `setUser(user: UserProfile | null): void`
  - `clearAuth(): void` — limpa state + redirect pra login
- **Sync com TanStack Query**: O AuthProvider no App usa useQuery para GET /auth/me e sincroniza o resultado com o Zustand store via select callback. TQ gerencia cache/refetch, Zustand da acesso sincrono ao user em qualquer componente.

#### HTTP Client (agnostico)

- **Purpose**: Wrapper fino sobre axios — facil de trocar por fetch/ky no futuro
- **Location**: `packages/web/src/lib/http-client.ts`
- **Config**:
  - `baseURL: '/api'` (proxy do Vite em dev)
  - `withCredentials: true` (envia cookies automaticamente)
  - Response interceptor: se 401 e nao e refresh request → tenta refresh → se falha → clearAuth()
- **Comportamento do refresh**:
  - Queue de requests pendentes durante refresh
  - Se refresh falha, rejeita todos os requests na queue e faz logout
- **Interface exportada**: `httpClient.get()`, `httpClient.post()`, etc. — nao expoe axios diretamente

#### Auth API (Service Pattern)

- **Purpose**: Camada de servico que encapsula chamadas HTTP de auth — desacoplada do UI e do client HTTP
- **Location**: `packages/web/src/features/auth/api/auth.api.ts`
- **Interface**:
  - `authApi.login(data: LoginInput)` → POST /auth/login
  - `authApi.register(data: RegisterInput)` → POST /auth/register
  - `authApi.logout()` → POST /auth/logout
  - `authApi.refresh()` → POST /auth/refresh
  - `authApi.verifyEmail(data: VerifyEmailInput)` → POST /auth/verify-email
  - `authApi.resendVerification(email: string)` → POST /auth/resend-verification
  - `authApi.forgotPassword(data: ForgotPasswordInput)` → POST /auth/forgot-password
  - `authApi.resetPassword(data: ResetPasswordInput)` → POST /auth/reset-password
  - `authApi.me()` → GET /auth/me
- **Usage nos componentes**:
  ```tsx
  const { mutate: login, isPending } = useMutation({
    mutationFn: authApi.login,
    onSuccess: () => navigate(redirectTo ?? '/'),
  })
  ```

#### Auth Pages

- **Location**: `packages/web/src/features/auth/pages/`
- **Pages**:
  - `LoginPage.tsx` — form email/senha (TanStack Form + zod), link pra registro e forgot password
  - `RegisterPage.tsx` — form email/senha com strength meter (zxcvbn-ts), link pra login
  - `VerifyEmailPage.tsx` — processa token da URL, mostra sucesso/erro/resend
  - `ForgotPasswordPage.tsx` — form de email pra solicitar reset
  - `ResetPasswordPage.tsx` — form de nova senha com strength meter, processa token da URL
- **Forms**: TanStack Form com Zod adapter — schemas importados de `@qcontabil/shared`
- **Queries/Mutations**: Inline `useMutation`/`useQuery` direto nos componentes usando `authApi` como mutationFn. Hooks dedicados so quando ha reuso real ou side effects complexos.

#### ProtectedRoute

- **Purpose**: Wrapper de rota que redireciona pra login se nao autenticado
- **Location**: `packages/web/src/components/ProtectedRoute.tsx`
- **Behavior**:
  - Checa `isAuthenticated` do auth store
  - Se false e `isLoading` false → redirect pra `/login?redirect={currentPath}`
  - Se `isLoading` → mostra loading spinner
  - Se authenticated → renderiza children

#### PasswordStrengthMeter

- **Purpose**: Componente visual de forca de senha usando zxcvbn-ts
- **Location**: `packages/web/src/features/auth/components/PasswordStrengthMeter.tsx`
- **Props**: `password: string`, `onScoreChange: (score: number) => void`
- **Behavior**: Lazy load zxcvbn-ts, mostra barra colorida + feedback textual
- **Lib**: `@zxcvbn-ts/core` + `@zxcvbn-ts/language-common` + `@zxcvbn-ts/language-en`

---

### Shared

#### Zod Schemas + Types

- **Location**: `packages/shared/src/schemas/auth.ts`
- **Schemas** (Zod — single source of truth):
  - `loginSchema` — z.object({ email, password })
  - `registerSchema` — z.object({ email, password }) com min 8 chars
  - `forgotPasswordSchema` — z.object({ email })
  - `resetPasswordSchema` — z.object({ token, password })
  - `verifyEmailSchema` — z.object({ token })
- **Types** (inferidos do Zod com z.infer):
  - `LoginInput` — z.infer<typeof loginSchema>
  - `RegisterInput` — z.infer<typeof registerSchema>
  - `ForgotPasswordInput` — z.infer<typeof forgotPasswordSchema>
  - `ResetPasswordInput` — z.infer<typeof resetPasswordSchema>
  - `VerifyEmailInput` — z.infer<typeof verifyEmailSchema>
- **Types manuais** (nao sao input de form):
  - `UserProfile` — { id, email, emailVerified, createdAt }
  - `AuthResponse` — { user: UserProfile, message?: string }

---

## Data Models

### User

```typescript
@Entity('users')
class User {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ unique: true })
  email: string

  @Column()
  passwordHash: string

  @Column({ default: false })
  emailVerified: boolean

  @Column({ type: 'int', default: 0 })
  failedLoginAttempts: number

  @Column({ type: 'timestamp', nullable: true })
  lockedUntil: Date | null

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date

  @OneToMany(() => RefreshToken, refreshToken => refreshToken.user)
  refreshTokens: RefreshToken[]
}
```

### RefreshToken

```typescript
@Entity('refresh_tokens')
class RefreshToken {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column()
  tokenHash: string  // SHA-256 hash do opaque token

  @Column()
  family: string  // UUID pra agrupar tokens da mesma sessao

  @Column({ default: false })
  revoked: boolean

  @Column({ type: 'timestamp' })
  expiresAt: Date

  @CreateDateColumn()
  createdAt: Date

  @ManyToOne(() => User, user => user.refreshTokens, { onDelete: 'CASCADE' })
  user: User

  @Column()
  userId: string
}
```

**Relationships**: User 1:N RefreshToken (cascade delete)
**Family tracking**: Cada login cria uma nova family (UUID). Na rotacao, o novo token herda a family. Se um token revogado da mesma family e reutilizado → revoga TODOS os tokens daquela family.

### EmailToken

```typescript
@Entity('email_tokens')
class EmailToken {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column()
  tokenHash: string  // SHA-256 hash

  @Column({ type: 'enum', enum: ['verification', 'password_reset'] })
  type: 'verification' | 'password_reset'

  @Column({ default: false })
  used: boolean

  @Column({ type: 'timestamp' })
  expiresAt: Date

  @CreateDateColumn()
  createdAt: Date

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  user: User

  @Column()
  userId: string
}
```

---

## Error Handling Strategy

| Error Scenario | HTTP Status | Response | User Impact |
| --- | --- | --- | --- |
| Invalid credentials | 401 | "Invalid email or password" | Generic, no enumeration |
| Email already exists | 400 | "Unable to create account" | Generic, no enumeration |
| Email not verified | 403 | "Please verify your email first" | Shows resend option |
| Token expired/invalid | 400 | "Token is invalid or has expired" | Shows re-request option |
| Rate limited | 429 | "Too many attempts" + Retry-After | Shows wait time |
| Account locked | 423 | "Account temporarily locked" | Shows unlock time |
| Password too weak | 400 | Validation errors array | Shows specific requirements |
| Validation error (Zod) | 400 | Structured field errors | Shows per-field errors |
| Server error | 500 | "Internal server error" | No details leaked |
| DB unavailable | 503 | "Service temporarily unavailable" | Retry later |

---

## Tech Decisions

| Decision | Choice | Rationale |
| --- | --- | --- |
| JWT signing algorithm | HS256 | Simples, secret-based, suficiente pra single-service. RS256 necessario so com microservices |
| Refresh token storage | Opaque token, SHA-256 hash no DB | Revogavel instantaneamente, detecta replay. JWT como refresh nao traz vantagem (precisa de state pra rotacao) |
| Cookie extraction | Custom extractor no passport-jwt | passport-jwt nao tem built-in cookie extractor — extraimos do `req.cookies.access_token` |
| Password hashing | bcrypt, cost factor 12 | Padrao da industria, ~250ms per hash |
| Rate limiter | @nestjs/throttler (in-memory) | Built-in NestJS, zero setup. Migrar pra Redis em multi-instance |
| Email provider | Resend | TypeScript-first SDK, free tier 3k/mes, delivery confiavel, melhor DX que nodemailer |
| Email em dev | Console.log com link | Sem dependencia de email service em dev |
| zxcvbn variant | @zxcvbn-ts/core | Fork TypeScript-first, tree-shakeable, async API |
| Frontend auth state | Zustand (sync access) + TanStack Query (server state) | Complementares: TQ gerencia fetch/cache, Zustand da acesso sincrono ao user |
| JwtAuthGuard scope | Global (APP_GUARD) com @Public() | Default-secure: tudo protegido, opt-out explicito pra rotas publicas |
| Form library | TanStack Form + Zod adapter | Headless, type-safe, par natural do TanStack Query |
| Validation | Zod schemas em shared | Single source of truth — frontend (form validation) + backend (pipe validation) |
| UI components | Tailwind v4 + shadcn/ui | CSS-first config, componentes no repo (controle total), production-ready |
| React Router mode | SPA/declarativo (BrowserRouter) | Framework mode e SSR/Remix — overhead desnecessario pra SPA com API separada |
| Queries/Mutations | Inline nos componentes | Sem hooks wrapper — menos boilerplate, mesma type-safety. Hook dedicado so com reuso real |
| Frontend architecture | Feature-based (colocation) | Cada feature agrupa pages/components/stores. Shared UI em components/ui/ |

---

## Dependencies (novas)

### Backend (`packages/api`)

| Package | Purpose |
| --- | --- |
| `@nestjs/jwt` | JWT sign/verify |
| `@nestjs/passport` | Passport integration |
| `passport` | Auth middleware |
| `passport-jwt` + `@types/passport-jwt` | JWT strategy |
| `@nestjs/throttler` | Rate limiting |
| `bcrypt` + `@types/bcrypt` | Password hashing |
| `cookie-parser` + `@types/cookie-parser` | Parse cookies do request |
| `resend` | Email sending (Resend SDK) |

### Frontend (`packages/web`)

| Package | Purpose |
| --- | --- |
| `axios` | HTTP client com interceptors |
| `@tanstack/react-form` | Form management |
| `@tanstack/zod-form-adapter` | Zod integration pra TanStack Form |
| `@zxcvbn-ts/core` | Password strength engine |
| `@zxcvbn-ts/language-common` | Common password dictionaries |
| `@zxcvbn-ts/language-en` | English dictionaries |
| `tailwindcss` | Utility-first CSS (v4) |
| `shadcn/ui` (via CLI) | UI component library |

### Shared (`packages/shared`)

| Package | Purpose |
| --- | --- |
| `zod` | Schema validation (single source of truth) |
