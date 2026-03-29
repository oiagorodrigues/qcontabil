# Unique Test Data Generation for Parallel Integration Tests

## Problem

Integration tests running in parallel share the same database. Hardcoded test data (e.g., a fixed CNPJ `43378917000137`) causes unique constraint violations when multiple tests try to create records with the same value.

## Solution

Generate unique data per test, similar to the `uniqueEmail()` pattern for users:

```typescript
// For CNPJ: generate random valid CNPJs with correct check digits
export function randomCnpj(): string {
  const base = Array.from({ length: 12 }, () => Math.floor(Math.random() * 10))
  if (base.every(d => d === base[0])) base[11] = (base[0] + 1) % 10
  const d1 = calcDigit(base, WEIGHTS_FIRST)
  const d2 = calcDigit([...base, d1], WEIGHTS_SECOND)
  return [...base, d1, d2].join('')
}

// For assertions: don't check exact values of generated data
expect(res.body.cnpj).toMatch(/^\d{14}$/)  // ✅ Pattern match
expect(res.body.cnpj).toBe('43378917000137')  // ❌ Fragile
```

## Pattern

1. Factory function generates valid random data
2. Test helper provides defaults with random unique fields
3. Assertions check structure/patterns, not exact generated values
4. Fixed values only for intentional duplicate tests (e.g., CNPJ conflict)

## Reference

- Same principle as `uniqueEmail()` in `test-users.ts`
- Discovered during Company CRUD integration tests
