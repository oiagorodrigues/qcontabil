# TanStack Query v5: Side Effects Without Callbacks

## The Breaking Change

TanStack Query v5 removed `onSuccess`, `onError`, and `onSettled` from `useQuery` options. These callbacks were the primary way to run side effects (update external stores, show toasts, trigger navigation) in response to query results.

## Why They Were Removed

### 1. Duplicate Execution

`onSuccess` fired on **every component that observed the query**, not just the one that triggered the fetch. If 3 components used the same query key, `onSuccess` ran 3 times per fetch.

### 2. Cache Read vs Network Fetch Confusion

Callbacks also fired when data was served from cache (e.g., on mount with stale data), making it impossible to distinguish "fresh network data" from "cached data."

### 3. Concurrent Rendering Incompatibility

React 18's concurrent features can interrupt and restart renders. Callbacks tied to render cycles could fire at unpredictable times.

## The Replacement: useEffect

```tsx
const { data, error, isSuccess, isError } = useQuery({
  queryKey: ['user', 'me'],
  queryFn: fetchUser,
})

// Runs once per successful state transition
useEffect(() => {
  if (isSuccess && data) {
    externalStore.setUser(data)
  }
}, [isSuccess, data])

// Runs once per error state transition
useEffect(() => {
  if (isError) {
    externalStore.clearUser()
  }
}, [isError, error])
```

### Why useEffect Works Here

- React guarantees `useEffect` runs after commit, so the UI is consistent.
- It fires once per state change (not per observer).
- It plays well with Strict Mode (runs cleanup + re-run in dev, but that's idempotent for store updates).

## Mutations Still Have Callbacks

`useMutation` retains `onSuccess`, `onError`, and `onSettled` because mutations are imperative (user-triggered), not declarative (cache-observed). There's no cache-read ambiguity.

```tsx
const mutation = useMutation({
  mutationFn: loginUser,
  onSuccess: (data) => {
    authStore.setUser(data.user)
    navigate('/dashboard')
  },
  onError: () => {
    toast.error('Login failed')
  },
})
```

## Global Callbacks via QueryClient

For cross-cutting concerns (error logging, global toasts), use `QueryClient` defaults:

```tsx
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // No per-query callbacks -- use useEffect
    },
    mutations: {
      onError: (error) => {
        Sentry.captureException(error)
      },
    },
  },
})
```

Or the `QueryCache` / `MutationCache` callbacks:

```tsx
const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      // Global error handler -- fires once per query, not per observer
      if (query.meta?.showErrorToast) {
        toast.error(error.message)
      }
    },
  }),
})
```

## References

- [TanStack Query v5 Migration Guide](https://tanstack.com/query/latest/docs/framework/react/guides/migrating-to-v5)
- [Breaking React Query's API on Purpose (TkDodo)](https://tkdodo.eu/blog/breaking-react-querys-api-on-purpose)
