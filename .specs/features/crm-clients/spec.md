# CRM Clients Specification

## Problem Statement

O app precisa de um cadastro de clientes para vincular invoices futuros. Sem clientes, nao ha como gerar invoices nem rastrear historico de faturamento. Como os usuarios sao freelancers BR que faturam para empresas estrangeiras, o modelo precisa capturar dados da empresa cliente (nome fantasia, razao social, pais, moeda) e contatos associados.

## Goals

- [ ] CRUD completo de clientes (empresa + contatos)
- [ ] Listagem paginada com busca e filtros
- [ ] Detalhe do cliente com dados completos e secao preparada para invoices
- [ ] Cada usuario gerencia apenas seus proprios clientes (isolamento por usuario)

## Out of Scope

| Feature | Reason |
| --- | --- |
| Historico de invoices no detalhe | Depende de Invoices (M2) — UI preparada com secao vazia |
| Import/export de clientes (CSV) | Nice-to-have futuro |
| Merge de clientes duplicados | Complexidade desnecessaria no v1 |
| Multi-usuario por empresa (compartilhar clientes) | v1 e single-user, vem com RBAC futuro |
| Soft delete | Hard delete por enquanto — nota no milestone de Invoices pra reavaliar |

---

## Data Model

### Client (empresa)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| id | UUID | auto | PK |
| fantasyName | string(200) | yes | Nome fantasia da empresa |
| company | string(200) | yes | Razao social / nome legal |
| country | string(100) | yes | Nome do pais (string livre) |
| countryCode | string(2) | yes | ISO 3166-1 alpha-2 (US, BR, DE...) |
| email | string(255) | yes | Email principal da empresa |
| phone | string(50) | no | Telefone da empresa |
| website | string(255) | no | Website da empresa |
| address | text | no | Endereco completo (string livre) |
| notes | text | no | Observacoes livres |
| currency | enum | yes | USD, EUR, GBP, BRL, CAD, AUD, JPY, CHF |
| status | enum | yes | active, inactive, churned (default: active) |
| userId | UUID | yes | FK → users (dono do cliente) |
| createdAt | timestamp | auto | |
| updatedAt | timestamp | auto | |

### Contact (contato vinculado ao cliente)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| id | UUID | auto | PK |
| name | string(200) | yes | Nome completo do contato |
| email | string(255) | yes | Email do contato |
| phone | string(50) | no | Telefone do contato |
| role | string(100) | no | Cargo/funcao (ex: "CTO", "Accounts Payable") |
| isPrimary | boolean | yes | Contato principal (1 por cliente) |
| clientId | UUID | yes | FK → clients |
| createdAt | timestamp | auto | |
| updatedAt | timestamp | auto | |

### Constraints

- 1 primary contact por cliente (enforced por app logic — upsert no create/update)
- Client pertence a exatamente 1 usuario (userId FK)
- Contacts cascade delete com o client
- Email do contato nao precisa ser unico (mesmo contato pode aparecer em clientes diferentes)

---

## Requirements

### R01: Criar cliente

**User Story**: As a contractor, I want to register a new client company with their contact info so I can later create invoices for them.

**Acceptance Criteria**:

1. WHEN user submits client form with valid data THEN system SHALL create the client with status "active" and at least 1 primary contact
2. WHEN user submits without required fields (fantasyName, company, country, countryCode, email, currency) THEN system SHALL reject with field-level errors
3. WHEN user adds multiple contacts THEN exactly 1 must be marked as primary
4. WHEN client is created THEN system SHALL redirect to client detail page

**API**: `POST /api/clients`

### R02: Listar clientes

**User Story**: As a contractor, I want to see all my clients in a searchable, paginated list so I can quickly find who I need.

**Acceptance Criteria**:

1. WHEN user opens clients page THEN system SHALL show paginated list (10 per page) sorted by fantasyName ASC
2. WHEN user types in search bar THEN system SHALL filter by fantasyName OR company (case-insensitive, debounced)
3. WHEN user selects status filter THEN system SHALL filter by status (active, inactive, churned)
4. WHEN user selects country filter THEN system SHALL filter by country
5. WHEN user clicks a column header THEN system SHALL sort by that column (toggle asc/desc)
6. WHEN user changes page THEN system SHALL fetch next page
7. WHEN list is empty THEN system SHALL show empty state with CTA to create first client

**API**: `GET /api/clients?search=&status=&country=&sort=fantasyName:asc&page=1&limit=10`

### R03: Ver detalhe do cliente

**User Story**: As a contractor, I want to see all details of a client including their contacts so I can review or share their info.

**Acceptance Criteria**:

1. WHEN user clicks a client in the list THEN system SHALL show full client details + contacts list
2. WHEN client has no invoices yet THEN system SHALL show empty "Invoices" section with message "No invoices yet"
3. WHEN user clicks edit THEN system SHALL navigate to edit form pre-filled

**API**: `GET /api/clients/:id`

### R04: Editar cliente

**User Story**: As a contractor, I want to update client details and contacts when their info changes.

**Acceptance Criteria**:

1. WHEN user submits edit form with valid changes THEN system SHALL update the client and contacts
2. WHEN user changes primary contact THEN system SHALL unset previous primary and set new one
3. WHEN user adds/removes contacts THEN system SHALL sync contacts (add new, remove deleted, update existing)
4. WHEN user removes the last contact THEN system SHALL reject — at least 1 primary contact required
5. WHEN edit succeeds THEN system SHALL redirect to client detail page

**API**: `PUT /api/clients/:id`

### R05: Deletar cliente

**User Story**: As a contractor, I want to delete a client I no longer work with.

**Acceptance Criteria**:

1. WHEN user clicks delete THEN system SHALL show confirmation dialog
2. WHEN user confirms THEN system SHALL hard delete client + cascade contacts
3. WHEN delete succeeds THEN system SHALL redirect to clients list

**API**: `DELETE /api/clients/:id`

### R06: Isolamento por usuario

**Acceptance Criteria**:

1. WHEN user lists clients THEN system SHALL return only clients where userId matches authenticated user
2. WHEN user tries to access/edit/delete another user's client THEN system SHALL return 404 (not 403, to prevent enumeration)

---

## Security

- All endpoints protected by JwtAuthGuard (global, existing)
- userId injected from JWT token via @CurrentUser(), never from request body
- All inputs validated via Zod schemas (shared package)
- No user enumeration: 404 for other users' clients
- Rate limiting: default global (60/60s) — no custom throttle needed for CRUD

## Notes for Future Milestones

- **Invoices (M2)**: Reavaliar hard delete → soft delete quando invoices existirem. Cliente com invoices nao deve ser deletavel (ou deve virar inactive).
- **Invoices (M2)**: Detalhe do cliente tera historico de invoices real no lugar da secao vazia.
