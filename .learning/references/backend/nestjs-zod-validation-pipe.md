# Zod Validation Pipe in NestJS

## Why Zod over class-validator

NestJS's default validation uses `class-validator` + `class-transformer` with decorator-based DTOs. The qcontabil project uses Zod instead because:

1. **Shared schemas**: Same Zod schema validates on frontend (TanStack Form) and backend (pipe). No duplication.
2. **Runtime safety**: Zod validates at runtime with full type inference. `class-validator` relies on TypeScript decorators which don't exist at runtime without `reflect-metadata`.
3. **Functional API**: Zod schemas are composable functions, not classes with decorators.

## The Pipe

```ts
@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private schema: ZodSchema) {}

  transform(value: unknown) {
    const result = this.schema.safeParse(value)
    if (!result.success) {
      const errors: Record<string, string[]> = {}
      for (const issue of result.error.issues) {
        const path = issue.path.join('.') || '_root'
        errors[path] ??= []
        errors[path].push(issue.message)
      }
      throw new BadRequestException({ message: 'Validation failed', errors })
    }
    return result.data  // Returns parsed + transformed data
  }
}
```

### Key details

- **`safeParse` not `parse`**: Returns `{ success, data }` or `{ success, error }` instead of throwing. The pipe controls the error format.
- **Path flattening**: Zod paths are arrays (`['address', 'street']`). Joining with `.` gives `address.street` — flat enough for frontend consumption.
- **Returns `result.data`**: This is the PARSED value, meaning Zod transforms (`.trim()`, `.toLowerCase()`, `.default()`) are applied. The controller receives clean data.

## Usage in Controllers

```ts
@Post('register')
@Public()
@UsePipes(new ZodValidationPipe(registerSchema))
async register(@Body() data: RegisterInput) {
  // data is already validated and transformed
}
```

## Structured Error Response

```json
{
  "message": "Validation failed",
  "errors": {
    "email": ["Invalid email format"],
    "password": ["Must be at least 8 characters"]
  }
}
```

Frontend can map `errors[fieldName]` directly to field-level error displays.

## External References

- [Zod Documentation](https://zod.dev/)
- [NestJS Pipes](https://docs.nestjs.com/pipes)
