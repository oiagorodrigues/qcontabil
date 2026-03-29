# Cadastro da Empresa - Design

**Spec**: `.specs/features/company-crud/spec.md`
**Status**: Draft

---

## Architecture Overview

Fluxo CRUD padrao: SPA faz chamadas REST via `httpClient`, backend valida com Zod (shared schemas), persiste no PostgreSQL via TypeORM. Auth ja funciona — endpoints protegidos pelo JwtAuthGuard global, usuario identificado via `@CurrentUser()`.

```
Frontend (React)                    Backend (NestJS)                    Database (PostgreSQL)
┌───────────────────┐              ┌──────────────────────┐            ┌──────────────────┐
│ /empresa (route)  │              │ CompanyController     │            │ companies        │
│                   │  httpClient  │   @CurrentUser()      │  TypeORM   │                  │
│ CompanyPage       │ ──────────>  │ CompanyService        │ ────────>  │ FK: user_id      │
│ CompanyForm       │              │   ZodValidationPipe   │            │ UQ: cnpj         │
│ CompanyView       │              │   companySchema (Zod) │            │ UQ: user_id      │
│                   │              │ Company (entity)      │            │                  │
│ company.api.ts    │              └──────────────────────┘            └──────────────────┘
│ TanStack Form+Zod │
└───────────────────┘
```

---

## Code Reuse Analysis

### Existing Components to Leverage

| Component | Location | How to Use |
| --- | --- | --- |
| ApiResponse<T> | `packages/shared/src/index.ts` | Wrapper para responses |
| ZodValidationPipe | `packages/api/src/common/pipes/zod-validation.pipe.ts` | Validar body com schema Zod |
| @CurrentUser() | `packages/api/src/auth/decorators/current-user.decorator.ts` | Extrair userId do request |
| JwtAuthGuard (global) | `packages/api/src/auth/guards/jwt-auth.guard.ts` | Endpoints ja protegidos |
| User entity | `packages/api/src/auth/entities/user.entity.ts` | FK para company.userId |
| httpClient | `packages/web/src/lib/http-client.ts` | Chamadas HTTP no frontend |
| ProtectedRoute | `packages/web/src/components/ProtectedRoute.tsx` | Rota /empresa ja protegida |
| shadcn/ui (Button, Card, Input, Label) | `packages/web/src/components/ui/` | Componentes de form |
| AppRoutes | `packages/web/src/app/router.tsx` | Adicionar rota /empresa |
| Zod schemas pattern | `packages/shared/src/schemas/auth.ts` | Seguir mesmo pattern pra company |
| Test helpers | `packages/api/test/helpers/` | createTestApp, test factories |

### New Dependencies

Nenhuma. Tudo que precisa ja esta instalado (Zod, TypeORM, TanStack Query, TanStack Form, shadcn/ui, Vitest).

### Integration Points

| System | Integration |
| --- | --- |
| Auth | `@CurrentUser()` injeta `{ id, email }` — CompanyService recebe userId |
| User entity | `company.userId` referencia `users.id` via FK |
| Invoice (M2) | Invoice vai referenciar `companies.id` — dados bancarios vem da company |

---

## Components

### Shared

#### Zod Schemas

- **Purpose**: Schemas de validacao compartilhados entre frontend (TanStack Form) e backend (ZodValidationPipe)
- **Location**: `packages/shared/src/schemas/company.ts`
- **Exports**:
  - `createCompanySchema` — schema de criacao com todos os campos
  - `updateCompanySchema` — mesmo schema (todos os campos na edicao)
  - `CreateCompanyInput`, `UpdateCompanyInput` — tipos inferidos
- **Re-export**: `packages/shared/src/index.ts`

#### Types

- **Purpose**: Tipos de response (nao derivados de form input)
- **Location**: `packages/shared/src/types/company.ts`
- **Exports**:
  - `CompanyResponse` — dados da empresa retornados pela API
  - `TaxRegime`, `AccountType`, `BrazilianState` — enums
- **Re-export**: `packages/shared/src/index.ts`

### Backend

#### CompanyModule

- **Purpose**: Modulo NestJS que agrupa controller, service e entity
- **Location**: `packages/api/src/company/company.module.ts`
- **Imports**: `TypeOrmModule.forFeature([Company])`
- **Pattern**: Mesmo que AuthModule — module autocontido

#### Company Entity

- **Purpose**: Entidade TypeORM mapeando tabela `companies`
- **Location**: `packages/api/src/company/company.entity.ts`
- **Pattern**: Segue User entity — `!` non-null assertion, `comment` em todos os columns, snake_case no DB
- **Relationships**: `@ManyToOne(() => User)` com `@JoinColumn({ name: 'user_id' })`

#### CompanyService

- **Purpose**: Logica de negocio — CRUD + regras (1:1, CNPJ unico)
- **Location**: `packages/api/src/company/company.service.ts`
- **Interfaces**:
  - `create(userId: string, data: CreateCompanyInput): Promise<Company>`
  - `findByUser(userId: string): Promise<Company | null>`
  - `update(userId: string, data: UpdateCompanyInput): Promise<Company>`
- **Dependencies**: `Repository<Company>` via `@InjectRepository(Company)`
- **Errors**:
  - `ConflictException` — user ja tem empresa ou CNPJ duplicado
  - `NotFoundException` — empresa nao encontrada no update/get

#### CompanyController

- **Purpose**: Endpoints REST
- **Location**: `packages/api/src/company/company.controller.ts`
- **Endpoints**:
  - `POST /companies` — criar empresa (body validado com `createCompanySchema`)
  - `GET /companies/me` — buscar empresa do user logado
  - `PUT /companies/me` — atualizar empresa do user logado (body validado com `updateCompanySchema`)
- **Pattern**: `@CurrentUser()` para userId, `@UsePipes(new ZodValidationPipe(schema))` no body
- **Auth**: Protegido pelo JwtAuthGuard global — sem `@Public()`

#### CNPJ Validator

- **Purpose**: Funcao de validacao de digitos verificadores do CNPJ, usada como `.refine()` no Zod schema
- **Location**: `packages/shared/src/validators/cnpj.ts` (no shared, pois frontend tambem usa)
- **Interface**: `isValidCnpj(cnpj: string): boolean` — recebe 14 digitos, retorna boolean
- **Re-export**: `packages/shared/src/index.ts`

#### Migration

- **Purpose**: Criar tabela `companies` no PostgreSQL
- **Location**: `packages/api/src/migrations/`
- **Campos**: Todos definidos na entity, com FK para `users.id`

### Frontend

#### CompanyPage

- **Purpose**: Pagina principal — orquestra estados (loading, empty, view, edit, create)
- **Location**: `packages/web/src/features/company/pages/CompanyPage.tsx`
- **States**:
  1. **Loading**: `<Loading />` enquanto query carrega
  2. **Empty**: Empresa nao cadastrada — CTA "Cadastrar empresa"
  3. **View**: `<CompanyView />` com dados formatados
  4. **Create**: `<CompanyForm />` para criacao
  5. **Edit**: `<CompanyForm initialData={company} />` para edicao
- **Pattern**: `lazy()` import + rota protegida no router

#### CompanyForm

- **Purpose**: Formulario reutilizavel para criacao e edicao
- **Location**: `packages/web/src/features/company/components/CompanyForm.tsx`
- **Props**: `initialData?: CompanyResponse`, `onSubmit: (data: CreateCompanyInput) => void`, `isSubmitting: boolean`
- **Pattern**: TanStack Form + Zod schema (mesmo pattern do auth forms)
- **Secoes**:
  1. Dados gerais (razao social, CNPJ com mascara, regime, email, telefone)
  2. Endereco (rua, numero, complemento, CEP com mascara, cidade, estado, pais)
  3. Dados bancarios (beneficiario, banco, tipo conta, IBAN, SWIFT) — secao colapsavel ou separada
- **UI**: shadcn/ui components (Input, Label, Button, Card, Select)

#### CompanyView

- **Purpose**: Visualizacao dos dados em modo leitura
- **Location**: `packages/web/src/features/company/components/CompanyView.tsx`
- **Props**: `company: CompanyResponse`, `onEdit: () => void`
- **Format**: CNPJ formatado (XX.XXX.XXX/XXXX-XX), CEP formatado (XXXXX-XXX), endereco completo

#### API Service

- **Purpose**: Camada de comunicacao HTTP
- **Location**: `packages/web/src/features/company/api/company.api.ts`
- **Pattern**: Segue `auth.api.ts` — funcoes exportadas usando `httpClient`
- **Functions**:
  - `getMyCompany(): Promise<CompanyResponse>`
  - `createCompany(data: CreateCompanyInput): Promise<CompanyResponse>`
  - `updateCompany(data: UpdateCompanyInput): Promise<CompanyResponse>`

---

## Data Models

### Enums (shared)

```typescript
// packages/shared/src/types/company.ts
enum TaxRegime {
  MEI = 'MEI',
  EI = 'EI',
  ME = 'ME',
  SLU = 'SLU',
  LTDA = 'LTDA',
}

enum AccountType {
  CORRENTE = 'CORRENTE',
  POUPANCA = 'POUPANCA',
  COMPANY = 'COMPANY',
}

enum BrazilianState {
  AC = 'AC', AL = 'AL', AP = 'AP', AM = 'AM', BA = 'BA',
  CE = 'CE', DF = 'DF', ES = 'ES', GO = 'GO', MA = 'MA',
  MT = 'MT', MS = 'MS', MG = 'MG', PA = 'PA', PB = 'PB',
  PR = 'PR', PE = 'PE', PI = 'PI', RJ = 'RJ', RN = 'RN',
  RS = 'RS', RO = 'RO', RR = 'RR', SC = 'SC', SP = 'SP',
  SE = 'SE', TO = 'TO',
}
```

### Zod Schema (shared)

```typescript
// packages/shared/src/schemas/company.ts
const createCompanySchema = z.object({
  // Dados gerais
  legalName: z.string().min(1).max(200),
  cnpj: z.string().length(14).refine(isValidCnpj, { message: 'CNPJ invalido' }),
  taxRegime: z.nativeEnum(TaxRegime),
  email: z.email({ error: 'Email invalido' }),
  phone: z.string().min(10).max(20),

  // Endereco
  street: z.string().min(1).max(200),
  streetNumber: z.string().min(1).max(20),
  complement: z.string().max(100).optional(),
  zipCode: z.string().length(8),
  city: z.string().min(1).max(100),
  state: z.nativeEnum(BrazilianState),
  country: z.string().min(1).max(100).default('Brazil'),

  // Dados bancarios (opcionais)
  bankBeneficiaryName: z.string().max(200).optional(),
  bankName: z.string().max(100).optional(),
  bankAccountType: z.nativeEnum(AccountType).optional(),
  bankAccountNumber: z.string().max(50).optional(),
  bankSwiftCode: z.string().max(11).optional(),
})
```

### TypeORM Entity

```typescript
// packages/api/src/company/company.entity.ts
@Entity('companies')
@Unique(['cnpj'])
@Unique(['userId'])
class Company {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ name: 'user_id', type: 'uuid', comment: 'Owner user FK — 1:1 relationship' })
  userId!: string

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user!: User

  // Dados gerais
  @Column({ name: 'legal_name', type: 'varchar', length: 200, comment: 'Razao social da empresa' })
  legalName!: string

  @Column({ type: 'varchar', length: 14, comment: 'CNPJ sem mascara (14 digitos)' })
  cnpj!: string

  @Column({ name: 'tax_regime', type: 'enum', enum: TaxRegime, comment: 'Regime tributario: MEI, EI, ME, SLU, LTDA' })
  taxRegime!: TaxRegime

  @Column({ type: 'varchar', comment: 'Email de contato da empresa' })
  email!: string

  @Column({ type: 'varchar', length: 20, comment: 'Telefone com DDD' })
  phone!: string

  // Endereco
  @Column({ type: 'varchar', length: 200, comment: 'Logradouro' })
  street!: string

  @Column({ name: 'street_number', type: 'varchar', length: 20, comment: 'Numero do endereco' })
  streetNumber!: string

  @Column({ type: 'varchar', length: 100, nullable: true, comment: 'Complemento (andar, sala, etc)' })
  complement!: string | null

  @Column({ name: 'zip_code', type: 'varchar', length: 8, comment: 'CEP sem mascara (8 digitos)' })
  zipCode!: string

  @Column({ type: 'varchar', length: 100, comment: 'Cidade' })
  city!: string

  @Column({ type: 'enum', enum: BrazilianState, comment: 'UF do estado' })
  state!: BrazilianState

  @Column({ type: 'varchar', length: 100, default: 'Brazil', comment: 'Pais (default Brazil)' })
  country!: string

  // Dados bancarios (todos nullable)
  @Column({ name: 'bank_beneficiary_name', type: 'varchar', length: 200, nullable: true, comment: 'Nome do titular da conta bancaria' })
  bankBeneficiaryName!: string | null

  @Column({ name: 'bank_name', type: 'varchar', length: 100, nullable: true, comment: 'Nome do banco' })
  bankName!: string | null

  @Column({ name: 'bank_account_type', type: 'enum', enum: AccountType, nullable: true, comment: 'Tipo da conta: corrente, poupanca, company' })
  bankAccountType!: AccountType | null

  @Column({ name: 'bank_account_number', type: 'varchar', length: 50, nullable: true, comment: 'Numero da conta (formato IBAN)' })
  bankAccountNumber!: string | null

  @Column({ name: 'bank_swift_code', type: 'varchar', length: 11, nullable: true, comment: 'Codigo SWIFT/BIC do banco' })
  bankSwiftCode!: string | null

  @CreateDateColumn({ name: 'created_at', comment: 'Data de criacao do registro' })
  createdAt!: Date

  @UpdateDateColumn({ name: 'updated_at', comment: 'Data da ultima atualizacao' })
  updatedAt!: Date
}
```

### CompanyResponse (shared type)

```typescript
// packages/shared/src/types/company.ts
interface CompanyResponse {
  id: string
  legalName: string
  cnpj: string
  taxRegime: TaxRegime
  email: string
  phone: string
  street: string
  streetNumber: string
  complement: string | null
  zipCode: string
  city: string
  state: BrazilianState
  country: string
  bankBeneficiaryName: string | null
  bankName: string | null
  bankAccountType: AccountType | null
  bankAccountNumber: string | null
  bankSwiftCode: string | null
  createdAt: string
  updatedAt: string
}
```

---

## Error Handling Strategy

| Error Scenario | HTTP Status | Backend | Frontend |
| --- | --- | --- | --- |
| Campos obrigatorios faltando | 400 | ZodValidationPipe retorna `{ message, errors }` | TanStack Form exibe erros inline |
| CNPJ invalido (digitos) | 400 | Zod `.refine(isValidCnpj)` | Validacao inline no form (mesmo schema) |
| CNPJ ja cadastrado | 409 | ConflictException | Mensagem "CNPJ ja cadastrado" |
| User ja tem empresa | 409 | ConflictException | Mensagem "Voce ja possui uma empresa" |
| Empresa nao encontrada (GET/PUT /me) | 404 | NotFoundException | Frontend trata como estado vazio |
| Erro de rede/servidor | 5xx | Error generico | Mensagem "Erro ao salvar. Tente novamente." |

---

## Tech Decisions

| Decision | Choice | Rationale |
| --- | --- | --- |
| Validacao | Zod schemas no shared | Consistente com auth — mesma validacao client/server |
| Forms | TanStack Form + Zod | Consistente com auth forms |
| class-validator | Nao usar | Projeto usa Zod, nao class-validator |
| CNPJ validator | Funcao pura no shared | Frontend e backend precisam — single source of truth |
| Endpoints /me | GET/PUT /companies/me | 1:1 — nao precisa de :id, mais seguro |
| Flat entity | Tudo em `companies` table | Endereco e dados bancarios nao precisam de tabela separada no v1 |
| User relation | @ManyToOne(() => User) | FK real com cascade — mesmo que 1:1 no v1, ManyToOne e mais simples |
| CNPJ/CEP storage | Sem mascara no DB | Facilita validacao e comparacao; formata no frontend |
| Form state | TanStack Form | Headless, tipado, integra com Zod — melhor que useState pra forms com muitos campos |

---

## Testing Strategy

Seguindo a piramide do ARCHITECTURE.md:

| Nivel | O que testar | Arquivos |
| --- | --- | --- |
| Unit | `isValidCnpj()` — edge cases (validos, invalidos, todos zeros) | `packages/shared/src/validators/cnpj.spec.ts` |
| Unit | CompanyService — logica 1:1, CNPJ duplicado, create/update | `packages/api/src/company/company.service.spec.ts` |
| Integration | POST /companies — validacao, criacao, conflitos | `packages/api/test/company/create.integration.ts` |
| Integration | GET /companies/me — com/sem empresa | `packages/api/test/company/get.integration.ts` |
| Integration | PUT /companies/me — update, validacao | `packages/api/test/company/update.integration.ts` |
