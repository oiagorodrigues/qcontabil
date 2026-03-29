# Layout Routes and Outlet in React Router 7

## Core Concept

A layout route is a `<Route>` that renders shared UI (navigation, guards, providers) and uses `<Outlet />` to render its matched child route. It does not need a `path` -- it can be a pathless wrapper.

## Guard Pattern with Layout Routes

```tsx
function ProtectedRoute() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const isLoading = useAuthStore((s) => s.isLoading)
  const location = useLocation()

  if (isLoading) return <Loading />
  if (!isAuthenticated) {
    return <Navigate to={`/login?redirect=${encodeURIComponent(location.pathname)}`} replace />
  }
  return <Outlet />
}
```

```tsx
<Routes>
  {/* Public routes */}
  <Route path="/login" element={<LoginPage />} />

  {/* Protected routes -- ProtectedRoute acts as layout */}
  <Route element={<ProtectedRoute />}>
    <Route path="/" element={<Dashboard />} />
    <Route path="/settings" element={<Settings />} />
  </Route>
</Routes>
```

## How Outlet Works

`<Outlet />` renders the element of the **first matching child route**. It's analogous to `{children}` but controlled by the router's matching algorithm.

```
URL: /settings

Route tree match:
  <Route element={<ProtectedRoute />}>        ← renders ProtectedRoute
    <Route path="/settings" element={<Settings />} />  ← Outlet renders this
  </Route>
```

### Outlet with Context

`<Outlet>` supports a `context` prop for passing data to child routes without prop drilling:

```tsx
function DashboardLayout() {
  const user = useUser()
  return (
    <div>
      <Sidebar user={user} />
      <Outlet context={{ user }} />
    </div>
  )
}

// In child route:
function ProfilePage() {
  const { user } = useOutletContext<{ user: User }>()
  return <h1>{user.name}</h1>
}
```

## Stacking Layout Routes

Layout routes compose naturally:

```tsx
<Routes>
  <Route element={<AuthGuard />}>
    <Route element={<DashboardLayout />}>
      <Route element={<SidebarLayout />}>
        <Route path="/projects" element={<Projects />} />
      </Route>
    </Route>
  </Route>
</Routes>
```

Match for `/projects`:
1. `AuthGuard` checks auth -> renders `<Outlet />`
2. `DashboardLayout` renders header + `<Outlet />`
3. `SidebarLayout` renders sidebar + `<Outlet />`
4. `Projects` renders in the innermost `<Outlet />`

## Advantages Over HOC/Wrapper Patterns

| Approach | Pros | Cons |
|----------|------|------|
| Layout routes | Declarative, visible in route tree, composable | Requires Outlet understanding |
| HOC (`withAuth(Page)`) | Familiar pattern | Hides guard logic, harder to compose |
| Wrapper component | Explicit | Nests deeply, prop drilling |

## Navigate with replace

When redirecting unauthenticated users, always use `replace`:

```tsx
<Navigate to="/login" replace />
```

Without `replace`, pressing "Back" after login would go to the protected URL, triggering another redirect -- creating a redirect loop in the history stack.

## Redirect Preservation

Encode the original path in the redirect URL so the login page can send users back:

```tsx
const redirect = encodeURIComponent(location.pathname + location.search)
<Navigate to={`/login?redirect=${redirect}`} replace />
```

On login success:
```tsx
const params = new URLSearchParams(location.search)
const redirect = params.get('redirect') || '/'
navigate(redirect, { replace: true })
```

## References

- [React Router v7 docs: Outlet](https://reactrouter.com/en/main/components/outlet)
- [React Router v7 docs: Layout Routes](https://reactrouter.com/en/main/route/route#layout-routes)
