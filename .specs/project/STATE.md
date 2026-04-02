# State

## Decisions

- **Stack:** React+Vite (SPA) / NestJS / PostgreSQL / AWS
- **ORM:** TypeORM
- **State management:** Zustand
- **Provedor de pagamento:** Tipalti v1. Alternativas pesquisadas: Wise Business (melhor custo, ~1-1.5%), Deel (gestão completa), Payoneer (marketplaces), Remessa Online/Husky (BR-focused, sem API pública). Escopo: qcontabil gera invoice e envia pra plataforma — sem orquestração de pagamento
- **PDF generation:** PDFKit server-side (leve, sem browser headless)
- **Invoice numbers:** Prefixo customizável via Company.invoicePrefix (default "INV"), format `{PREFIX}-{0001}`
- **Invoice computed fields:** Híbrido — getters pra line items, persistido pra invoice totals
- **Client delete protection:** Block delete + oferecer inativar (sem soft delete)
- **Dashboard multi-moeda:** Filtro de moeda (não agrega moedas diferentes). Default = moeda mais frequente

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
- [x] Pesquisar provedores de pagamento com API acessivel (M3)

### Vitest + NestJS parallel integration tests: schema race condition

Múltiplos workers rodando `synchronize: true` em paralelo no mesmo DB causam `duplicate key` no `CREATE TYPE` (enum). Solução: `globalSetup` cria o schema uma vez, `TestAppModule` usa `synchronize: false`. Para isolamento de dados em paralelo, usar emails únicos (`randomBytes`) em vez de `TRUNCATE` entre testes.

### NestJS ThrottlerGuard em testes: não dá pra override via APP_GUARD

`overrideProvider(ThrottlerGuard)` e `overrideGuard(ThrottlerGuard)` não funcionam quando o guard é registrado como `APP_GUARD` via token multi-provider no module. Solução: criar `TestAuthModule` sem o APP_GUARD do ThrottlerGuard, e testar rate limiting em suite separada com o AuthModule original.

### TypeORM table names: verificar @Entity() antes de raw SQL

`@Entity('email_tokens')` gera tabela `email_tokens` (plural), não `email_token`. Sempre verificar o nome real da tabela no decorator antes de escrever SQL raw (TRUNCATE, UPDATE, etc.).

### Zod 4: validadores de formato são top-level

`z.string().email()` está depreciado no Zod 4. Usar `z.email()` (subclasse de `ZodString`). Custom error via `{ error: '...' }`. Mesma regra pra `z.uuid()`, `z.url()`, etc.

### @UsePipes vs @Body(pipe): scoping de ValidationPipe no NestJS

`@UsePipes(new ZodValidationPipe(schema))` aplica o pipe a TODOS os parametros do handler (incluindo `@CurrentUser()`, `@Param()`, etc.), causando validacao errada. **Usar pipe no nivel do parametro:** `@Body(new ZodValidationPipe(schema))` para validar apenas o body.

### Zod .default() e TanStack Form: incompatibilidade de tipos

`z.string().default('Brazil')` faz o input type ser `string | undefined` mas o output ser `string`. TanStack Form valida contra o input type, causando TypeScript error. **Remover `.default()` do schema e setar o default no `defaultValues` do form.**

### Worktrees e .env: arquivos gitignored nao sao compartilhados

Git worktrees nao copiam arquivos gitignored (`.env`). **Criar symlink do `.env` do repo principal para o worktree:** `ln -s /path/to/repo/.env /path/to/worktree/.env`.

### Zod .refine() + TanStack Form: separar base schema do refined

`z.object({...}).refine()` retorna `ZodEffects` — tipo diferente de `ZodObject`. TanStack Form espera `StandardSchemaV1` compativel com `defaultValues`. **Exportar `clientObjectSchema` (base) pra frontend form e `createClientSchema` (com refine) pro backend pipe.**

### TanStack Form v1.28: FormApi generico demais pra props

`FormApi<TFormData>` precisa de 11+ type args na v1.28. Quando sub-componentes recebem `form` como prop, usar `form: any` com eslint-disable e tipar callbacks explicitamente (`field: any`, `_: any, index: number`).

### Integration tests: dados devem ser unicos por teste

Testes de integracao rodam em paralelo. Dados fixos (ex: CNPJ hardcoded) causam conflitos entre testes. **Gerar dados unicos por teste** (mesma abordagem do `uniqueEmail()` para users).

## Deferred Ideas

- **Upgrade @zxcvbn-ts/core pra v4**: Atualmente em v3 (set/2023). A v4 beta.3 (mar/2026) muda a API pra `ZxcvbnFactory` mas tem problemas de exports no runtime (beta). Monitorar releases estáveis e migrar quando v4 stable sair. PasswordStrengthMeter precisa ser reescrito pra nova API.
- **Invoices recorrentes**: Criação automática de invoice todo mês baseado em config do client. Adiado para após M3.
- **Templates customizados**: Editor visual (WYSIWYG/drag-drop) para criar templates do zero. Adiado para futuro.

## Preferences

- **TypeORM entities:** sempre adicionar `comment` nos `@Column()` (exceto `id`) para documentar o propósito de cada campo no banco.
