# Auth Specification

## Problem Statement

O app precisa de autenticacao segura antes de qualquer feature de negocio. Sem auth, nao ha como vincular empresa/clientes/invoices a um usuario. Precisa ser robusto contra ataques comuns (brute force, token theft, MITM) desde o v1 — dados financeiros e fiscais sao sensiveis.

## Goals

- [x]Registro e login seguros com email/senha
- [x]Sessao persistente com access + refresh token (httpOnly cookies)
- [x]Protecao de rotas no backend (guards) e frontend (route protection)
- [x]Recuperacao de senha via email
- [x]Verificacao de email no registro
- [x]Defesas contra brute force, token theft e acesso indevido

## Out of Scope

| Feature | Reason |
| --- | --- |
| OAuth / login social (Google, GitHub) | Complexidade desnecessaria no v1, usuarios sao poucos |
| 2FA / MFA | Milestone futuro — in-house com otplib (TOTP) e viavel |
| RBAC / roles | v1 e single-user por empresa (1:1), sem necessidade de roles |
| Session management UI (listar sessoes ativas) | Nice-to-have futuro |
| Account deletion | Futuro, requer logica de cascade complexa |

---

## User Stories

### P1: Registro com email e senha ⭐ MVP

**User Story**: As a contractor, I want to create an account with my email and password so that I can access the app securely.

**Why P1**: Sem registro, nenhuma outra feature funciona.

**Acceptance Criteria**:

1. WHEN user submits registration form with valid email and password THEN system SHALL create the account, send verification email, and redirect to "verify your email" page
2. WHEN user submits email that already exists THEN system SHALL reject with generic error "Unable to create account" (no user enumeration)
3. WHEN user submits password with zxcvbn score < 3 (out of 4) THEN frontend SHALL show strength meter with feedback and block submission
4. WHEN password has fewer than 8 characters THEN backend SHALL reject regardless of zxcvbn (server-side fallback)
4. WHEN user clicks verification link in email THEN system SHALL mark email as verified and redirect to login page with success message
5. WHEN verification link is expired (>24h) THEN system SHALL show error and offer to resend verification email
6. WHEN unverified user tries to login THEN system SHALL reject with "Please verify your email first" and offer resend option

**Independent Test**: Register with a new email, check for verification email, click link, verify redirect to login.

**Security**:
- Password hashed with bcrypt (cost factor 12)
- Password strength: zxcvbn on frontend (lazy loaded, ~400KB), min 8 chars on backend
- Verification token: cryptographically random, single-use, expires in 24h
- Email normalization (lowercase, trim)

---

### P1: Login e sessao persistente ⭐ MVP

**User Story**: As a registered user, I want to log in and stay logged in across browser sessions so that I don't have to re-authenticate constantly.

**Why P1**: Core auth flow — sem login, app e inacessivel.

**Acceptance Criteria**:

1. WHEN user submits valid email/password THEN system SHALL return access token (httpOnly cookie, 15min TTL) and refresh token (httpOnly cookie, 7d TTL, path=/api/auth/refresh)
2. WHEN user submits invalid credentials THEN system SHALL reject with generic "Invalid email or password" (no user enumeration)
3. WHEN access token expires and valid refresh token exists THEN system SHALL transparently issue new access + refresh token pair (rotation)
4. WHEN refresh token is used THEN system SHALL invalidate the old refresh token (one-time use)
5. WHEN an already-used refresh token is presented (replay attack) THEN system SHALL invalidate ALL refresh tokens for that user (token family revocation)
6. WHEN user has valid session and reopens browser THEN system SHALL restore session from cookies automatically

**Independent Test**: Login, wait 15min (or mock expiry), make API call, verify transparent refresh. Use old refresh token, verify all sessions revoked.

**Security**:
- Cookies: `httpOnly`, `Secure`, `SameSite=Strict`
- Access token: JWT signed with RS256 or HS256 (secret from env)
- Refresh token: opaque token stored hashed in DB, not JWT
- Refresh token rotation with family tracking for replay detection
- CSRF protection via SameSite=Strict cookies

---

### P1: Logout ⭐ MVP

**User Story**: As a logged-in user, I want to log out so that my session is terminated securely.

**Why P1**: Necessario para seguranca basica.

**Acceptance Criteria**:

1. WHEN user clicks logout THEN system SHALL invalidate refresh token in DB and clear auth cookies
2. WHEN user tries to access protected route after logout THEN system SHALL redirect to login page
3. WHEN logout request fails (network error) THEN frontend SHALL clear local state and redirect to login anyway

**Independent Test**: Login, logout, try accessing a protected endpoint — verify 401.

---

### P1: Protecao de rotas ⭐ MVP

**User Story**: As the system, I want to protect all authenticated routes so that unauthenticated users cannot access app data.

**Why P1**: Sem protecao, dados ficam expostos.

**Acceptance Criteria**:

1. WHEN unauthenticated request hits protected endpoint THEN system SHALL return 401 Unauthorized
2. WHEN request has expired access token and no refresh token THEN system SHALL return 401
3. WHEN authenticated request hits protected endpoint THEN system SHALL proceed normally with user context available
4. WHEN unauthenticated user navigates to protected frontend route THEN app SHALL redirect to login page preserving intended destination
5. WHEN user logs in after redirect THEN app SHALL navigate to originally intended destination

**Independent Test**: Access /api/health (public) — 200. Access /api/company (protected) without token — 401. Access with valid token — 200.

---

### P1: Recuperacao de senha ⭐ MVP

**User Story**: As a user who forgot my password, I want to reset it via email so that I can regain access to my account.

**Why P1**: Sem isso, usuario perde acesso permanentemente.

**Acceptance Criteria**:

1. WHEN user requests password reset with any email THEN system SHALL respond with generic success message (no user enumeration)
2. WHEN email exists in system THEN system SHALL send reset email with single-use token (expires in 1h)
3. WHEN user submits new password via valid reset link THEN system SHALL update password, invalidate ALL refresh tokens, and redirect to login
4. WHEN reset link is expired or already used THEN system SHALL show error and offer to request new reset
5. WHEN new password doesn't meet requirements (zxcvbn < 3 or < 8 chars) THEN system SHALL reject with validation errors

**Independent Test**: Request reset, click link, set new password, verify old sessions invalidated, login with new password.

**Security**:
- Reset token: cryptographically random, hashed in DB, single-use, 1h TTL
- Invalidate all existing sessions on password change
- Same generic response whether email exists or not

---

### P1: Rate limiting e protecao contra brute force ⭐ MVP

**User Story**: As the system, I want to prevent brute force attacks on authentication endpoints so that user accounts remain secure.

**Why P1**: Dados financeiros/fiscais — protecao desde o dia 1.

**Acceptance Criteria**:

1. WHEN IP exceeds 5 failed login attempts in 15 minutes THEN system SHALL block further attempts from that IP for 15 minutes
2. WHEN account receives 10 failed login attempts in 1 hour (any IP) THEN system SHALL temporarily lock account for 30 minutes
3. WHEN rate limit is hit THEN system SHALL return 429 Too Many Requests with Retry-After header
4. WHEN password reset is requested more than 3 times in 1 hour THEN system SHALL stop sending emails (silent, still returns 200)
5. WHEN registration is attempted more than 5 times from same IP in 1 hour THEN system SHALL return 429

**Independent Test**: Send 6 wrong passwords for same account — verify 429 on 6th attempt.

**Security**:
- Rate limiting in-memory (pode migrar para Redis depois se necessario)
- Timing-safe comparison para prevenir timing attacks
- Log failed attempts para auditoria

---

### P2: Seguranca adicional de headers e transporte

**User Story**: As the system, I want to enforce security best practices at the HTTP level so that the app is resilient against common web attacks.

**Why P2**: Importante mas nao bloqueia funcionalidade — pode ser adicionado logo apos MVP de auth.

**Acceptance Criteria**:

1. WHEN any response is sent THEN system SHALL include security headers (X-Content-Type-Options, X-Frame-Options, Strict-Transport-Security, Content-Security-Policy)
2. WHEN CORS request is received THEN system SHALL only allow configured origins (no wildcard in production)
3. WHEN request body exceeds 10KB on auth endpoints THEN system SHALL reject with 413

**Independent Test**: Inspect response headers on any endpoint — verify security headers present.

---

## Edge Cases

- WHEN user registers, never verifies, and tries to reset password THEN system SHALL send verification email instead of reset email
- WHEN multiple browser tabs are open and one logs out THEN other tabs SHALL detect on next API call (401) and redirect to login
- WHEN refresh token cookie is manually deleted but access token is still valid THEN session SHALL continue until access token expires, then end
- WHEN user changes password THEN all other sessions (other browsers/devices) SHALL be terminated
- WHEN database is unavailable THEN auth endpoints SHALL return 503 Service Unavailable (not leak error details)
- WHEN JWT secret is rotated THEN existing access tokens SHALL fail gracefully (401, not 500)

---

## Requirement Traceability

| Requirement ID | Story | Description | Status |
| --- | --- | --- | --- |
| AUTH-01 | P1: Registro | Create account with email/password | Verified |
| AUTH-02 | P1: Registro | Email verification flow | Verified |
| AUTH-03 | P1: Registro | Password strength validation | Verified |
| AUTH-04 | P1: Login | Access token (httpOnly, 15min) | Verified |
| AUTH-05 | P1: Login | Refresh token (httpOnly, 7d, rotation) | Verified |
| AUTH-06 | P1: Login | Replay attack detection (family revocation) | Verified |
| AUTH-07 | P1: Logout | Invalidate refresh token + clear cookies | Verified |
| AUTH-08 | P1: Rotas | Backend guard (JWT validation) | Verified |
| AUTH-09 | P1: Rotas | Frontend route protection + redirect | Verified |
| AUTH-10 | P1: Reset | Password reset via email token | Verified |
| AUTH-11 | P1: Reset | Invalidate all sessions on password change | Verified |
| AUTH-12 | P1: Rate limit | IP-based login throttling | Verified |
| AUTH-13 | P1: Rate limit | Account-based lockout | Verified |
| AUTH-14 | P1: Rate limit | Registration + reset throttling | Verified |
| AUTH-15 | P2: Headers | Security headers (helmet) | Verified |
| AUTH-16 | P2: Headers | CORS configuration | Verified |

**Coverage:** 16 total, 16 verified ✓

---

## Success Criteria

- [x]Usuario consegue registrar, verificar email, e fazer login
- [x]Sessao persiste ao fechar/reabrir browser (refresh token funciona)
- [x]Rotas protegidas retornam 401 sem token valido
- [x]Password reset funciona end-to-end
- [x]6 tentativas de login erradas resultam em 429
- [x]Nenhum endpoint de auth vaza se o email existe ou nao (no user enumeration)
- [x]Cookies sao httpOnly + Secure + SameSite=Strict
- [x]Refresh token rotation com deteccao de replay funciona
