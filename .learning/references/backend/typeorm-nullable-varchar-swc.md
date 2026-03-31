# TypeORM Nullable Varchar Columns with SWC

## Context

SWC (used by NestJS CLI for fast compilation) does not emit TypeScript metadata the same way `tsc` does. When a column has a union type (`string | null`), SWC sees the reflected type as `Object` instead of `String`, causing TypeORM to generate incorrect column types.

## Problem

```typescript
// SWC sees reflected type as Object, not String
@Column({ length: 50, nullable: true })
phone!: string | null  // TypeORM gets confused → generates wrong column type
```

## Solution

Explicitly specify `type: 'varchar'` for nullable string columns:

```typescript
@Column({ type: 'varchar', length: 50, nullable: true, comment: 'Contact phone number' })
phone!: string | null  // TypeORM knows it's varchar regardless of SWC metadata
```

## When This Applies

- All `string | null` columns in TypeORM entities
- Only when using SWC as the compiler (NestJS default with `nest start -b swc`)
- Not needed for non-nullable string columns (SWC correctly reflects `String`)
- Not needed for `text` type columns (already explicitly typed)

## Key Takeaway

When using TypeORM + SWC, always add explicit `type` annotation to nullable columns. The SWC compiler doesn't emit decorator metadata for union types correctly.
