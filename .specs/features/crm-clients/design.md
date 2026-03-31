# CRM Clients Design

**Spec**: `.specs/features/crm-clients/spec.md`
**Status**: Draft

---

## Architecture Overview

Segue o mesmo padrao modular do auth: NestJS module autocontido no backend, feature folder no frontend, schemas compartilhados no shared.

```
                    ┌─────────────┐
                    │   Browser   │
                    └──────┬──────┘
                           │
              ┌────────────┴────────────┐
              │    React SPA (Vite)     │
              │  features/clients/      │
              │  ├── pages/             │
              │  ├── components/        │
              │  └── api/               │
              └────────────┬────────────┘
                           │ HTTP (Vite proxy)
              ┌────────────┴────────────┐
              │   NestJS API            │
              │   clients/              │
              │   ├── controller        │
              │   ├── service           │
              │   └── entities          │
              └────────────┬────────────┘
                           │ TypeORM
              ┌────────────┴────────────┐
              │      PostgreSQL         │
              │  clients + contacts     │
              └─────────────────────────┘
```

---

## Code Reuse Analysis

### Existing Components to Leverage

| Component | Location | How to Use |
| --- | --- | --- |
| JwtAuthGuard (global) | `api/src/auth/guards/` | Todas as rotas ja protegidas — nao precisa fazer nada |
| @CurrentUser() | `api/src/auth/decorators/` | Extrair userId do JWT no controller |
| ZodValidationPipe | `api/src/common/pipes/` | Validar request body nos endpoints |
| httpClient | `web/src/lib/http-client.ts` | Chamadas API com refresh automatico |
| ProtectedRoute | `web/src/components/ProtectedRoute.tsx` | Rotas de clientes ja protegidas |
| Loading | `web/src/components/Loading.tsx` | Fallback de Suspense |
| shadcn/ui (card, button, input, label) | `web/src/components/ui/` | Componentes base do form e listagem |
| PaginatedResponse\<T\> | `shared/src/index.ts` | Tipo de resposta paginada ja existe |
| ApiResponse\<T\> | `shared/src/index.ts` | Tipo de resposta padrao ja existe |

### Integration Points

| System | Integration Method |
| --- | --- |
| Auth (User entity) | Client.userId FK → User.id, injetado via @CurrentUser() |
| TypeORM | autoLoadEntities — registrar entities no module e elas aparecem |
| Router | Adicionar rotas dentro do ProtectedRoute existente |

### New shadcn/ui Components Needed

| Component | Purpose |
| --- | --- |
| table | Base pra DataTable generico |
| dialog | Confirmacao de delete |
| select | Filtros (status, country) e selects do form (currency, status) |
| badge | Status badges (active/inactive/churned) |
| textarea | Campo notes |
| separator | Divisores visuais no detalhe |
| dropdown-menu | Acoes no client row (edit, delete) |
| alert-dialog | Confirmacao destrutiva (delete) |

### New Dependencies

| Package | Purpose |
| --- | --- |
| `@tanstack/react-table` | Headless table engine (sorting, pagination, filtering) |

---

## Components

### Backend

#### ClientsModule

- **Purpose**: NestJS module que encapsula CRUD de clientes
- **Location**: `packages/api/src/clients/`
- **Structure**:
  ```
  clients/
  ├── clients.module.ts
  ├── clients.controller.ts
  ├── clients.service.ts
  └── entities/
      ├── client.entity.ts
      └── contact.entity.ts
  ```
- **Dependencies**: TypeOrmModule, AuthModule (indiretamente via global guard)
- **Registration**: Importar no AppModule

#### ClientsController

- **Purpose**: Endpoints REST para CRUD de clientes
- **Location**: `packages/api/src/clients/clients.controller.ts`
- **Endpoints**:
  - `POST /api/clients` — criar cliente + contatos
  - `GET /api/clients` — listar com paginacao/busca/filtro
  - `GET /api/clients/:id` — detalhe com contatos
  - `PUT /api/clients/:id` — atualizar cliente + sync contatos
  - `DELETE /api/clients/:id` — deletar cliente + cascade contatos
- **Reuses**: @CurrentUser(), ZodValidationPipe, @UsePipes()

#### ClientsService

- **Purpose**: Business logic de clientes — CRUD, filtros, isolamento por usuario
- **Location**: `packages/api/src/clients/clients.service.ts`
- **Interfaces**:
  - `create(userId: string, dto: CreateClientInput): Promise<Client>` — cria client + contacts em transacao
  - `findAll(userId: string, query: ListClientsQuery): Promise<PaginatedResponse<ClientSummary>>` — lista paginada com filtros
  - `findOne(userId: string, clientId: string): Promise<Client>` — detalhe com contacts (404 se nao pertence ao user)
  - `update(userId: string, clientId: string, dto: UpdateClientInput): Promise<Client>` — atualiza client + sync contacts em transacao
  - `remove(userId: string, clientId: string): Promise<void>` — deleta client (cascade contacts)
- **Dependencies**: Repository\<Client\>, Repository\<Contact\>, DataSource (pra transactions)

### Shared

#### Schemas (`packages/shared/src/schemas/clients.ts`)

- **Purpose**: Zod schemas para validacao client+server
- **Schemas**:
  - `contactSchema` — name, email, phone?, role?, isPrimary
  - `createClientSchema` — todos os campos required + contacts array (min 1, exactly 1 primary)
  - `updateClientSchema` — mesmo que create (PUT full replace)
  - `listClientsQuerySchema` — search?, status?, country?, sort? (field:asc|desc), page, limit
- **Enums**: `clientStatusEnum` (active, inactive, churned), `currencyEnum` (USD, EUR, GBP, BRL, CAD, AUD, JPY, CHF)

#### Types (`packages/shared/src/types/clients.ts`)

- **Purpose**: Types manuais para responses (nao sao input de form)
- **Types**:
  - `ClientSummary` — id, fantasyName, company, country, countryCode, currency, status, primaryContactName, primaryContactEmail, createdAt
  - `ClientDetail` — full client + contacts array
  - `ContactResponse` — id, name, email, phone, role, isPrimary

### Shared UI Components

#### DataTable (generic, reusable)

- **Purpose**: Componente generico de tabela com sorting, pagination server-side, e slots pra toolbar/actions. Reutilizavel em clientes, invoices, dashboard, etc.
- **Location**: `packages/web/src/components/data-table/`
- **Structure**:
  ```
  components/data-table/
  ├── DataTable.tsx              # Componente principal — wires TanStack Table + shadcn table
  ├── DataTablePagination.tsx    # Controles de paginacao (prev/next, page info, page size)
  ├── DataTableColumnHeader.tsx  # Header clicavel com sorting indicator (asc/desc/none)
  └── DataTableToolbar.tsx       # Toolbar container (search, filters, actions) via render prop
  ```
- **Library**: `@tanstack/react-table` (headless) + shadcn/ui `table`
- **API**:
  ```tsx
  interface DataTableProps<TData> {
    columns: ColumnDef<TData, any>[]
    data: TData[]
    total: number                              // total server-side count
    pagination: { pageIndex: number; pageSize: number }
    onPaginationChange: OnChangeFn<PaginationState>
    sorting?: SortingState
    onSortingChange?: OnChangeFn<SortingState>
    onRowClick?: (row: TData) => void
    toolbar?: ReactNode                        // slot pra search/filters custom
    emptyState?: ReactNode                     // slot pra empty state custom
    isLoading?: boolean
  }
  ```
- **Design decisions**:
  - **Server-side pagination**: `manualPagination: true` — o backend controla total/offset, o componente so renderiza
  - **Server-side sorting**: `manualSorting: true` — sorting vai como query param pro backend
  - **Sem filtering built-in**: Filtros sao custom por feature (toolbar slot) — nao precisa de `getFilteredRowModel`
  - **Sem row selection**: Nao necessario no v1 — pode ser adicionado depois via prop opcional
  - **Loading state**: Skeleton ou overlay enquanto `isLoading` (TanStack Query `isFetching`)
- **Reuses**: shadcn/ui `table` (Table, TableHeader, TableBody, TableRow, TableHead, TableCell)

#### DataTablePagination

- **Purpose**: Controles de paginacao reutilizaveis
- **Props**: `table: Table<TData>`, `pageSizeOptions?: number[]` (default [10, 20, 50])
- **UI**: "Page X of Y" + prev/next buttons + page size select
- **Reuses**: shadcn/ui `button`, `select`

#### DataTableColumnHeader

- **Purpose**: Header de coluna com sorting toggle
- **Props**: `column: Column<TData, unknown>`, `title: string`, `className?: string`
- **UI**: Titulo + icon (asc ↑ / desc ↓ / unsorted) — clicavel pra toggle
- **Reuses**: shadcn/ui `button`, lucide icons

### Frontend

#### Feature Structure

```
packages/web/src/features/clients/
├── api/
│   └── clients.api.ts          # Service layer (httpClient calls)
├── components/
│   ├── ClientForm.tsx           # Form reutilizado pra create/edit
│   ├── ContactsFieldArray.tsx   # Sub-form de contatos (add/remove/primary toggle)
│   ├── ClientStatusBadge.tsx    # Badge colorido por status
│   └── DeleteClientDialog.tsx   # Confirmacao de delete
└── pages/
    ├── ClientsListPage.tsx      # Listagem paginada + busca + filtros
    ├── ClientDetailPage.tsx     # Detalhe completo + secao invoices vazia
    ├── CreateClientPage.tsx     # Form de criacao
    └── EditClientPage.tsx       # Form de edicao (pre-filled)
```

#### ClientForm

- **Purpose**: Form compartilhado entre create e edit, com sub-form de contatos
- **Library**: TanStack Form + Zod (mesmo padrao do auth)
- **Props**: `defaultValues?`, `onSubmit`, `isSubmitting`
- **Sections**: Dados da empresa, Contatos (dynamic array)
- **Reuses**: shadcn/ui (input, select, textarea, button, label)

#### ContactsFieldArray

- **Purpose**: Gerenciar lista de contatos no form (add/remove rows, toggle primary)
- **Constraints**: Min 1 contato, exactly 1 primary
- **UX**: Botao "Add contact", star icon pra primary, X pra remover

#### ClientsListPage

- **Purpose**: Listagem paginada com busca e filtros
- **Data fetching**: TanStack Query (useQuery com query params synced com URL search params)
- **Table**: Usa `DataTable<ClientSummary>` com column defs customizadas
- **Columns**: fantasyName, company, country, currency, status (badge), primaryContact, actions (dropdown: edit/delete)
- **Toolbar**: Search input (debounced 300ms) + status select filter + country select filter + "New client" button
- **Sorting**: Server-side via query param `sort=field:asc|desc` (default: `fantasyName:asc`)
- **Empty state**: CTA "Add your first client"
- **Reuses**: DataTable, DataTableColumnHeader, ClientStatusBadge, DeleteClientDialog

#### ClientDetailPage

- **Purpose**: Visualizar todos os dados do cliente + contatos
- **Sections**: Company info, Contacts, Invoices (empty state)
- **Actions**: Edit button, Delete button (com dialog)

#### Routes

Adicionar dentro do `<Route element={<ProtectedRoute />}>` existente:

```tsx
<Route path="/clients" element={<ClientsListPage />} />
<Route path="/clients/new" element={<CreateClientPage />} />
<Route path="/clients/:id" element={<ClientDetailPage />} />
<Route path="/clients/:id/edit" element={<EditClientPage />} />
```

---

## Data Models

### Client Entity

```typescript
@Entity('clients')
export class Client {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ length: 200, comment: 'Trade name / fantasy name of the client company' })
  fantasyName!: string

  @Column({ length: 200, comment: 'Legal / registered company name' })
  company!: string

  @Column({ length: 100, comment: 'Country name (free text)' })
  country!: string

  @Column({ length: 2, comment: 'ISO 3166-1 alpha-2 country code' })
  countryCode!: string

  @Column({ length: 255, comment: 'Primary email of the client company' })
  email!: string

  @Column({ length: 50, nullable: true, comment: 'Company phone number' })
  phone!: string | null

  @Column({ length: 255, nullable: true, comment: 'Company website URL' })
  website!: string | null

  @Column({ type: 'text', nullable: true, comment: 'Full address (free text)' })
  address!: string | null

  @Column({ type: 'text', nullable: true, comment: 'Free-form notes about the client' })
  notes!: string | null

  @Column({
    type: 'enum',
    enum: ['USD', 'EUR', 'GBP', 'BRL', 'CAD', 'AUD', 'JPY', 'CHF'],
    comment: 'Preferred billing currency',
  })
  currency!: string

  @Column({
    type: 'enum',
    enum: ['active', 'inactive', 'churned'],
    default: 'active',
    comment: 'Client relationship status',
  })
  status!: string

  @Column({ comment: 'Owner user ID' })
  userId!: string

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User

  @OneToMany(() => Contact, (contact) => contact.client, { cascade: true })
  contacts!: Contact[]

  @CreateDateColumn()
  createdAt!: Date

  @UpdateDateColumn()
  updatedAt!: Date
}
```

### Contact Entity

```typescript
@Entity('contacts')
export class Contact {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ length: 200, comment: 'Full name of the contact person' })
  name!: string

  @Column({ length: 255, comment: 'Contact email address' })
  email!: string

  @Column({ length: 50, nullable: true, comment: 'Contact phone number' })
  phone!: string | null

  @Column({ length: 100, nullable: true, comment: 'Job title or role (e.g. CTO, Accounts Payable)' })
  role!: string | null

  @Column({ default: false, comment: 'Whether this is the primary contact for the client' })
  isPrimary!: boolean

  @Column({ comment: 'Parent client ID' })
  clientId!: string

  @ManyToOne(() => Client, (client) => client.contacts, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'clientId' })
  client!: Client

  @CreateDateColumn()
  createdAt!: Date

  @UpdateDateColumn()
  updatedAt!: Date
}
```

**Relationships**:
- User 1→N Client (userId FK, CASCADE delete)
- Client 1→N Contact (clientId FK, CASCADE delete)

---

## Error Handling Strategy

| Error Scenario | HTTP Status | User Impact |
| --- | --- | --- |
| Validation failed (missing/invalid fields) | 400 | Field-level errors no form |
| Client not found (or belongs to another user) | 404 | "Client not found" message |
| No primary contact in contacts array | 400 | "Exactly one contact must be primary" |
| Empty contacts array | 400 | "At least one contact is required" |
| Server error | 500 | Generic "Something went wrong" |

---

## Tech Decisions

| Decision | Choice | Rationale |
| --- | --- | --- |
| Contacts sync strategy | Delete all + re-insert on update | Simples, sem tracking de IDs de contatos individuais no frontend. Contacts sao poucos (<10) e nao tem FK de outros entities |
| Transaction | DataSource.transaction() no create/update | Client + contacts devem ser atomicos |
| Search implementation | ILIKE no PostgreSQL | Simples, sem dependencia externa. Suficiente para volume baixo (<1000 clientes/usuario) |
| Country filter | Distinct countries do usuario | Sem tabela de paises — filtro mostra apenas paises que o usuario ja cadastrou |
| PUT vs PATCH | PUT (full replace) | Form sempre envia todos os campos. Simplifica validacao |
| DataTable | Generic component (TanStack Table + shadcn) | Reutilizavel em invoices/dashboard. Headless = controle total do UI. Server-side pagination/sorting pra escalar |
| Sorting format | `sort=field:asc\|desc` query param | Simples, parseavel, extensivel pra multi-sort futuro |
