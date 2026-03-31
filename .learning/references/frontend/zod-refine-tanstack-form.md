# Zod .refine() and TanStack Form Incompatibility

## Context

When using `z.object({...}).refine()` as a TanStack Form validator, TypeScript rejects it because `.refine()` wraps the schema in `ZodEffects`, which has different input/output types. TanStack Form uses StandardSchemaV1 and compares `defaultValues` type against the schema's input type. If the schema has `.transform()` or `.default()`, the input type diverges from the output type.

## Problem

```typescript
// This causes TS error in TanStack Form:
const createClientSchema = z.object({
  status: clientStatusSchema,
  countryCode: z.string().transform(c => c.toUpperCase()),
  // ...
}).refine(data => /* validation */, { message: '...' })

// Error: ZodEffects input type ≠ defaultValues type
useForm({
  validators: { onChange: createClientSchema }, // TS error
})
```

## Solution

Export the base `z.object()` separately for frontend form validation, and the full schema with `.refine()` for backend pipe validation:

```typescript
// shared/schemas/clients.ts
export const clientObjectSchema = z.object({ /* fields */ })        // for frontend
export const createClientSchema = clientObjectSchema.refine(/* */)  // for backend

// ClientForm.tsx
useForm({ validators: { onSubmit: clientObjectSchema } })  // works

// clients.controller.ts
@Body(new ZodValidationPipe(createClientSchema))  // full validation
```

## Key Takeaway

Zod schemas with `.refine()` or `.superRefine()` wrap the type in `ZodEffects`. TanStack Form needs the raw `ZodObject` for type compatibility. Split schemas at the export boundary.
