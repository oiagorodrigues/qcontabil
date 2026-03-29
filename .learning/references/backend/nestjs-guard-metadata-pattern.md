# NestJS Guard + @Public() Metadata Pattern

## The Pattern

NestJS registers `JwtAuthGuard` as a global `APP_GUARD`, meaning **every route requires authentication by default**. Public routes opt out via the `@Public()` decorator.

```ts
// @Public() decorator — sets metadata
export const IS_PUBLIC_KEY = 'isPublic'
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true)

// JwtAuthGuard — checks metadata before authenticating
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(
      IS_PUBLIC_KEY,
      [context.getHandler(), context.getClass()],
    )
    if (isPublic) return true
    return super.canActivate(context)
  }
}
```

## Why "secure by default"

The alternative — requiring `@Auth()` on every protected route — is error-prone. Forgetting to add it exposes data. With `APP_GUARD` + `@Public()`:

- New routes are **automatically protected**
- Public routes are **explicit exceptions**, easy to audit
- `getAllAndOverride` checks both method and class level metadata, so `@Public()` works on controllers too

## Reflector: getAllAndOverride vs getAllAndMerge

- `getAllAndOverride`: returns the FIRST truthy value found (method → class). Use for boolean flags.
- `getAllAndMerge`: merges arrays from both levels. Use for roles/permissions lists.

## Registering as APP_GUARD

```ts
// auth.module.ts
providers: [
  { provide: APP_GUARD, useClass: JwtAuthGuard },
]
```

The `APP_GUARD` token is a multi-provider — multiple guards can be registered. They run in registration order.

## Custom Cookie Extractor

Passport's JWT strategy needs a custom extractor to read tokens from httpOnly cookies (not Authorization headers):

```ts
const extractJwtFromCookie = (req: Request): string | null => {
  const token = req.cookies?.access_token
  if (typeof token === 'string' && token.length > 0) return token
  return null
}
```

This is type-safe (validates string + non-empty) and returns `null` for Passport to handle as 401.

## External References

- [NestJS Guards](https://docs.nestjs.com/guards)
- [NestJS Custom Decorators](https://docs.nestjs.com/custom-decorators)
