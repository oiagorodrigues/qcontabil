# TanStack Form with Standard Schema (Zod) -- No Adapter Required

## How it works

TanStack Form v1.x implements the [Standard Schema](https://github.com/standard-schema/standard-schema) spec. Zod v3.23+ exposes a `~standard` property on every schema, so schemas can be passed directly to `validators.onChange` without any adapter package.

TanStack Form detects this interface at runtime using `isStandardSchemaValidator()` and routes validation through `standardSchemaValidators.validate()`. The form-level schema validates the entire form data object and automatically distributes per-field errors to each `field.state.meta.errors` array.

## Key typing gotcha -- StandardSchemaV1Issue errors

When using Standard Schema validators, `field.state.meta.errors` contains `StandardSchemaV1Issue` objects, not plain strings:

```ts
interface StandardSchemaV1Issue {
  readonly message: string
  readonly path?: ReadonlyArray<PropertyKey | { key: PropertyKey }>
}
```

You cannot render `errors[0]` directly as a React node -- extract `.message`:

```tsx
// Will NOT compile with Standard Schema validators
<p>{field.state.meta.errors[0]}</p>

// Correct approach
<p>{getErrorMessage(field.state.meta.errors[0])}</p>
```

A defensive helper handles both Standard Schema issues and plain string errors:

```ts
function getErrorMessage(error: unknown): string {
  if (!error) return ''
  if (typeof error === 'string') return error
  if (typeof error === 'object' && 'message' in error)
    return (error as { message: string }).message
  return String(error)
}
```

## Form-level vs field-level validators

- `validators.onChange` at the form level validates ALL fields on every change, distributing errors by path.
- Field-level validators (on `<form.Field validators={...}>`) validate only that field.
- Both can coexist; errors are merged.

## External References

- https://tanstack.com/form/latest/docs/framework/react/guides/validation#adapter-based-validation-zod-yup-valibot
- https://github.com/standard-schema/standard-schema
