# HTTP Client Abstraction in Frontend Applications

## Why Abstract the HTTP Client

Direct usage of `axios` (or `fetch`, `ky`, etc.) throughout a codebase creates tight coupling:

- Changing HTTP libraries requires touching every file that imports it.
- Library-specific APIs leak into business logic (e.g., `axios.defaults`, `axios.CancelToken`).
- Testing requires mocking the specific library rather than a simple interface.

## Abstraction Levels

### Level 1: Re-export with Config (Minimal)

```typescript
// http.ts
export const http = axios.create({ baseURL: '/api' })
```

Still coupled to axios API surface. Consumers use `http.get()` which is axios-specific.

### Level 2: Facade Object (Current Implementation)

```typescript
export const httpClient = {
  get<T>(url, config?) { return client.get<T>(url, config) },
  post<T>(url, data?, config?) { return client.post<T>(url, data, config) },
  // ...
}
```

Consumers don't import axios. Swapping libraries changes only this file. However, return types still expose `AxiosResponse<T>`.

### Level 3: Full Abstraction (Future Improvement)

```typescript
interface HttpResponse<T> {
  data: T
  status: number
  headers: Record<string, string>
}

export const httpClient = {
  async get<T>(url: string): Promise<HttpResponse<T>> {
    const res = await client.get<T>(url)
    return { data: res.data, status: res.status, headers: res.headers }
  },
}
```

Fully vendor-agnostic. Consumers never see axios types. Trade-off: extra mapping layer, potential loss of vendor-specific features.

## Recommendation

Level 2 is the practical sweet spot for most projects. It provides meaningful decoupling without over-engineering. Move to Level 3 only if you anticipate actually swapping HTTP libraries or need to support multiple backends (e.g., REST + GraphQL).

## References

- [Axios Documentation](https://axios-http.com/docs/intro)
- [ky - HTTP client for browsers](https://github.com/sindresorhus/ky)
- [Dependency Inversion Principle](https://en.wikipedia.org/wiki/Dependency_inversion_principle)
