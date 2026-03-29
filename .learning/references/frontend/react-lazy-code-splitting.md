# React.lazy + Suspense for Route-Based Code Splitting

## How It Works

`React.lazy` accepts a function that returns a dynamic `import()`. Vite (or any bundler) sees this as a split point and creates a separate chunk.

```tsx
const LoginPage = lazy(() => import('./features/auth/pages/LoginPage'))
```

At build time, `LoginPage` and its dependencies become a separate `.js` file. At runtime, the chunk is fetched only when `LoginPage` is first rendered.

## Suspense Boundary Placement

```
<Suspense fallback={<Loading />}>    ← catches ALL lazy children
  <Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route path="/register" element={<RegisterPage />} />
  </Routes>
</Suspense>
```

### Trade-offs of Boundary Placement

| Strategy | Behavior | Use When |
|----------|----------|----------|
| Single boundary around Routes | Any route transition shows one fallback | Simple apps, consistent loading UX |
| Per-route boundaries | Each route has its own fallback | Different loading states per section |
| Nested boundaries | Outer for shell, inner for content | Dashboard with sidebar + main content |

## Default Export Requirement

`React.lazy` expects the dynamic import to resolve to a module with a `default` export:

```tsx
// LoginPage.tsx -- must use default export
export default function LoginPage() { ... }
```

If you need named exports, wrap them:

```tsx
const LoginPage = lazy(() =>
  import('./LoginPage').then((mod) => ({ default: mod.LoginPage }))
)
```

## Error Handling

If the chunk fails to load (network error, deploy invalidation), React throws. Without an error boundary, the entire app crashes.

```tsx
import { ErrorBoundary } from 'react-error-boundary'

<ErrorBoundary fallback={<ChunkLoadError />}>
  <Suspense fallback={<Loading />}>
    <Routes>...</Routes>
  </Suspense>
</ErrorBoundary>
```

### Retry on Chunk Load Failure

A common pattern for SPAs with rolling deploys:

```tsx
function lazyWithRetry(importFn: () => Promise<{ default: ComponentType }>) {
  return lazy(() =>
    importFn().catch(() => {
      // Chunk hash changed after deploy -- reload to get new manifest
      window.location.reload()
      return { default: () => null } // never renders
    })
  )
}
```

## Prefetching Strategies

### 1. Preload on Hover

```tsx
const loginImport = () => import('./features/auth/pages/LoginPage')
const LoginPage = lazy(loginImport)

// In navigation component
<Link to="/login" onMouseEnter={() => loginImport()}>Login</Link>
```

### 2. Vite modulepreload

Vite automatically injects `<link rel="modulepreload">` for entry chunks. For lazy chunks, you can use the `vite-plugin-preload` plugin.

### 3. Intersection Observer

Preload chunks when a link enters the viewport:

```tsx
function PrefetchLink({ to, importFn, children }) {
  const ref = useRef(null)
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) importFn()
    })
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [importFn])

  return <Link to={to} ref={ref}>{children}</Link>
}
```

## Bundle Analysis

Verify code splitting is working:

```bash
pnpm vite build --mode production
# Check dist/assets/ for separate chunks per lazy route
```

Or use `rollup-plugin-visualizer`:

```bash
pnpm add -D rollup-plugin-visualizer
```

## References

- [React docs: lazy](https://react.dev/reference/react/lazy)
- [Vite Code Splitting](https://vite.dev/guide/build#code-splitting)
