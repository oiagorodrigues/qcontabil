# NestJS @Body() Pipe Scoping vs @UsePipes()

## Problem

`@UsePipes(new ZodValidationPipe(schema))` on a handler method applies the pipe to ALL parameter decorators — including `@CurrentUser()`, `@Param()`, `@Query()`. This causes validation errors because the user object or params don't match the Zod schema.

## Solution

Apply the pipe directly on `@Body()`:

```typescript
// ❌ Validates ALL params (including @CurrentUser)
@Post()
@UsePipes(new ZodValidationPipe(createCompanySchema))
async create(@CurrentUser() user: User, @Body() dto: CreateCompanyInput) { ... }

// ✅ Validates only the body
@Post()
async create(
  @CurrentUser() user: User,
  @Body(new ZodValidationPipe(createCompanySchema)) dto: CreateCompanyInput,
) { ... }
```

## When This Matters

Any handler that combines `@Body()` with other parameter decorators (`@CurrentUser()`, `@Param()`, `@Query()`, `@Headers()`). Handlers with only `@Body()` work fine with either approach.

## Reference

- NestJS docs: Pipes > Binding pipes at parameter level
- Discovered while building Company CRUD endpoints
