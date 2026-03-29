# Timing-Safe Authentication & Token Family Replay Detection

## Timing-Safe Login

When a user attempts login with a non-existent email, the service still runs `bcrypt.hash()` against a dummy value. This ensures the response time is indistinguishable from a failed password check on a real account.

### Why timing matters

Attackers measure response times to enumerate valid emails:
- Without protection: "email not found" returns in ~1ms, "wrong password" returns in ~200ms (bcrypt cost)
- With timing-safe comparison: both paths take ~200ms

```ts
// auth.service.ts — simplified
async login(email: string, password: string) {
  const user = await this.userRepo.findOne({ where: { email } })
  if (!user) {
    // Still run bcrypt to match timing of a real comparison
    await bcrypt.hash(password, 12)
    throw new UnauthorizedException('Invalid email or password')
  }
  const valid = await bcrypt.compare(password, user.passwordHash)
  // ...
}
```

### Key: generic error messages

Both "email not found" and "wrong password" return the same `401 Invalid email or password`. Combined with timing protection, this makes user enumeration infeasible.

## Token Family Replay Detection

Each refresh token belongs to a "family" (a UUID assigned at login). When a refresh token is used:

1. Current token is marked `revoked: true`
2. New token is created with the **same family**
3. If a revoked token is presented again → **entire family is revoked** (all tokens from that login session)

### Why families exist

Without families, revoking one token doesn't protect against a stolen token that was already used to generate a new pair. Family-based revocation ensures that if an attacker replays a stolen token, the legitimate user's next refresh also fails — alerting them to compromise.

```
Login → token A (family: abc)
Refresh A → token B (family: abc), A revoked
Attacker replays A → family abc revoked (B also invalidated)
Legitimate user tries B → rejected, must re-login
```

## Account Lockout

Progressive lockout protects against brute force without permanently blocking accounts:

- `failedLoginAttempts` counter increments on each failed login
- After 10 failures → `lockedUntil` set to 30 minutes in the future
- Successful login resets both `failedLoginAttempts` and `lockedUntil`

### Trade-off

Account lockout can be used for denial-of-service (lock someone out on purpose). Mitigation: the lockout is temporary (30min) and IP-based rate limiting catches automated attacks before account lockout triggers.

## External References

- [OWASP Authentication Cheatsheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [Token Best Practices — Auth0](https://auth0.com/blog/refresh-tokens-what-are-they-and-when-to-use-them/)
