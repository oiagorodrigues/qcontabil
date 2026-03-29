# State

## Decisions

- **Stack:** React+Vite (SPA) / NestJS / PostgreSQL / AWS
- **ORM:** TypeORM
- **State management:** Zustand
- **Provedor de pagamento:** Tipalti como target, pesquisar alternativas no M3

## Blockers

_(none)_

## Lessons

### zxcvbn-ts: v3 usa API classica, v4+ usa ZxcvbnFactory

A v3 (`@zxcvbn-ts/core@3.x`) usa `zxcvbn()` + `zxcvbnOptions.setOptions()`. A v4+ usa `new ZxcvbnFactory(options)` com `.check()/.checkAsync()`. Context7 pode retornar docs da v4 quando a v3 esta instalada. **Sempre verificar a versao instalada antes de usar a API.**

### HTTP interceptor: excluir endpoints de bootstrap do refresh cycle

O interceptor de 401 → refresh token deve excluir endpoints que falham legitimamente sem auth (como GET /auth/me no boot e POST /auth/login). Sem isso, o interceptor tenta refresh → falha → chama onAuthError → redirect pra /login, causando loop em rotas publicas.

**Regra:** adicionar `/auth/me`, `/auth/login`, `/auth/refresh` na lista de exclusao do interceptor.

### Zustand: getters nao sao reactive com selectors

`get isAuthenticated() { return get().user !== null }` no store Zustand nao funciona como reactive selector. O `useAuthStore((s) => s.isAuthenticated)` nao re-renderiza quando `user` muda. **Derivar estado inline no selector:** `useAuthStore((s) => s.user !== null)`.

### Query params: alinhar nomes entre producer e consumer

ProtectedRoute gera `?redirect=`, LoginPage lia `?redirectTo=`. **Sempre definir o nome do param em um unico lugar (constante ou tipo) e importar em ambos os lados.**

### Shared package em monorepo: dual exports pra ESM e CJS

Vite (ESM) precisa do source `.ts` direto. NestJS SWC (CJS) precisa do build `dist/`. Configurar `exports` no package.json com conditions:
```json
{
  "exports": {
    ".": {
      "import": "./src/index.ts",
      "require": "./dist/index.js"
    }
  }
}
```

### TypeORM: circular imports com SWC

User ↔ RefreshToken cria circular import. O `tsc` resolve, mas SWC (CJS output) nao. **Usar `import type` no lado que pode ser lazy e string-based relations no decorator:** `@OneToMany('RefreshToken', 'user')`.

### ConfigModule: envFilePath em monorepo

`ConfigModule.forRoot()` le `.env` do cwd do processo. Em monorepo com pnpm, o cwd e o package dir (`packages/api/`), nao o root. **Configurar envFilePath explicitamente:** `[resolve(process.cwd(), '../../.env'), '.env']`.

## Todos

- [x] Definir ORM — TypeORM
- [x] Definir state management — Zustand
- [ ] Pesquisar provedores de pagamento com API acessivel (M3)

## Deferred Ideas

- **Upgrade @zxcvbn-ts/core pra v4**: Atualmente em v3 (set/2023). A v4 beta.3 (mar/2026) muda a API pra `ZxcvbnFactory` mas tem problemas de exports no runtime (beta). Monitorar releases estáveis e migrar quando v4 stable sair. PasswordStrengthMeter precisa ser reescrito pra nova API.

## Preferences

_(none)_
