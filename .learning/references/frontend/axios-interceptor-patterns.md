# Axios Interceptor Patterns for Token Refresh

## The Problem

In SPAs using short-lived access tokens with refresh tokens, multiple API calls can fail simultaneously with 401. Naively retrying each triggers parallel refresh requests, causing:

1. **Race conditions** -- multiple refresh calls invalidate each other's tokens.
2. **Wasted network** -- N identical refresh requests instead of 1.
3. **User-facing errors** -- some retries fail because refresh already consumed the old token.

## The Queue Pattern

```
Request A -> 401 -> starts refresh -> queues B, C
Request B -> 401 -> sees isRefreshing=true -> queued
Request C -> 401 -> sees isRefreshing=true -> queued
           ... refresh completes ...
Request A -> retried with new token
Request B -> retried with new token
Request C -> retried with new token
```

### Implementation Anatomy

```typescript
// State
let isRefreshing = false
let queue: Array<{ resolve, reject, config }> = []

// Interceptor
interceptors.response.use(null, async (error) => {
  // Guard: not 401, or is the refresh call itself
  if (error.response?.status !== 401 || isRefreshUrl(error.config)) {
    return Promise.reject(error)
  }

  // Already refreshing? Queue this request.
  if (isRefreshing) {
    return new Promise((resolve, reject) => {
      queue.push({ resolve, reject, config: error.config })
    })
  }

  // First 401: start refresh
  isRefreshing = true
  try {
    await axios.post('/auth/refresh')
    isRefreshing = false
    retryQueue()              // resolve all queued promises
    return axios.request(error.config)  // retry original
  } catch (refreshError) {
    isRefreshing = false
    rejectQueue(refreshError) // reject all queued promises
    return Promise.reject(refreshError)
  }
})
```

### Edge Cases to Handle

| Scenario | Solution |
|----------|----------|
| Refresh endpoint itself returns 401 | Exclude refresh URL from interceptor |
| Refresh fails (invalid/expired refresh token) | Call `onAuthError` to redirect to login |
| Request sent during refresh gets 401 | Queue it, retry after refresh |
| Component unmounts during pending request | Axios cancellation tokens (separate concern) |

## Alternative: Axios-Auth-Refresh Library

The `axios-auth-refresh` package provides this pattern out of the box, but adds a dependency for ~50 lines of code. For most projects, the manual implementation is preferred for full control.

## References

- [Axios Interceptors Documentation](https://axios-http.com/docs/interceptors)
- [MDN: HTTP 401 Unauthorized](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/401)
