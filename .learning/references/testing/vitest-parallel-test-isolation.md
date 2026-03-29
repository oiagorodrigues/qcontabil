# Vitest Parallel Test Isolation with Real Database

## The Problem

Running integration tests in parallel against a shared PostgreSQL database creates race conditions:

- Multiple workers calling `synchronize: true` simultaneously → `duplicate key` errors on TypeORM's auto-generated SQL (e.g., `CREATE TYPE` for enums)
- `TRUNCATE` between tests in parallel workers → one worker deletes another worker's data mid-test

## The Solution: Global Setup + Data Isolation

### 1. Schema created once in globalSetup

```ts
// test/helpers/global-setup.ts
export async function setup() {
  const ds = new DataSource({
    type: 'postgres',
    url: process.env.DATABASE_URL,
    entities: [User, RefreshToken, EmailToken],
    synchronize: true,  // Creates tables + types once
    dropSchema: true,    // Clean slate
  })
  await ds.initialize()
  await ds.destroy()
}
```

This runs BEFORE any test worker starts. Schema is ready when workers connect.

### 2. Workers use synchronize: false

```ts
// test/helpers/test-app.ts
TypeOrmModule.forRoot({
  // ...
  synchronize: false,  // Schema already exists
})
```

Workers just connect and use the existing schema. No DDL race conditions.

### 3. Data isolation via unique emails

Instead of `TRUNCATE` between tests (which conflicts across workers), each test uses `uniqueEmail()`:

```ts
function uniqueEmail(): string {
  return `test-${randomBytes(8).toString('hex')}@example.com`
}
```

Each test creates users with unique emails, so tests never collide on data.

## Why Not Per-Test Schemas?

Creating a schema per test (or per worker) would require separate databases or schemas. That's ~500ms per schema creation × N tests. Global setup amortizes it to one 500ms call total.

## Vitest Project Configuration

```ts
// vitest.config.ts
export default defineConfig({
  test: {
    projects: [
      { test: { name: 'unit', include: ['src/**/*.spec.ts'] } },
      {
        test: {
          name: 'integration',
          include: ['test/**/*.integration.ts'],
          globalSetup: ['test/helpers/global-setup.ts'],
          setupFiles: ['test/helpers/int-setup.ts'],
        },
      },
      {
        test: {
          name: 'e2e',
          include: ['test/**/*.e2e.ts'],
          globalSetup: ['test/helpers/global-setup.ts'],
          setupFiles: ['test/helpers/int-setup.ts'],
        },
      },
    ],
  },
})
```

## ThrottlerGuard Isolation

Rate limiting tests need the real `ThrottlerGuard`, but integration tests need it disabled (otherwise parallel tests hit rate limits). Solution:

- `TestAuthModule`: AuthModule without ThrottlerGuard → used by most integration tests
- `AuthModule` (original): used only by `rate-limiting.integration.ts`

This avoids `overrideProvider`/`overrideGuard` which don't work reliably with `APP_GUARD` multi-providers.

## External References

- [Vitest Workspace Configuration](https://vitest.dev/guide/workspace)
- [TypeORM DataSource](https://typeorm.io/data-source)
