# Inline useMutation for Form Submission

## When inline is appropriate

- The mutation is used exactly once in one component.
- No shared cache invalidation or optimistic update logic is needed.
- The success/error handlers reference component-local state (`setServerError`, `navigate`).

## When to extract to a custom hook

- Multiple components call the same mutation.
- The mutation involves cache invalidation (`queryClient.invalidateQueries`).
- Complex retry or optimistic update logic exists.

## Error handling pattern for auth

- 401 -> generic "Invalid credentials" (never reveal whether email exists).
- 429 -> rate limit message.
- All other errors -> generic failure message.

This prevents information leakage (user enumeration) while still giving actionable feedback for rate limiting.

## External References

- https://tanstack.com/query/latest/docs/framework/react/guides/mutations
