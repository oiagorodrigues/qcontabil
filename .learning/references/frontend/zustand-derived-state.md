# Zustand Derived State Patterns

## Overview

Zustand v5 provides multiple ways to compute derived values from store state. Each has different trade-offs for reactivity, performance, and API ergonomics.

## Pattern 1: External Selector (Recommended)

```typescript
// Store
const useStore = create<State>()((set) => ({
  user: null,
  setUser: (user) => set({ user }),
}))

// Selector (defined outside store)
const selectIsAuthenticated = (s: State) => s.user !== null

// Usage
const isAuthenticated = useStore(selectIsAuthenticated)
```

**Pros:** Idiomatic Zustand, composable, memoizable with `useShallow`.
**Cons:** Selector lives outside the store definition.

## Pattern 2: Getter in Store Creator

```typescript
const useStore = create<State>()((set, get) => ({
  user: null,
  get isAuthenticated() {
    return get().user !== null
  },
}))

// Usage
const isAuthenticated = useStore((s) => s.isAuthenticated)
```

**Pros:** Co-located with state definition, feels like a property.
**Cons:** `get()` call on every access; getter is recreated each time the store updates. Not truly reactive on its own -- reactivity comes from the selector wrapper.

## Pattern 3: Zustand Middleware (`subscribeWithSelector`)

```typescript
import { subscribeWithSelector } from 'zustand/middleware'

const useStore = create<State>()(
  subscribeWithSelector((set) => ({
    user: null,
    setUser: (user) => set({ user }),
  }))
)

// Subscribe to derived value outside React
useStore.subscribe(
  (s) => s.user !== null,
  (isAuthenticated) => {
    console.log('Auth changed:', isAuthenticated)
  }
)
```

**Pros:** Fine-grained subscriptions outside React.
**Cons:** Additional middleware, more complex setup.

## When to Use Each

| Pattern | Best For |
|---------|----------|
| External selector | Most cases, simple derived values |
| Getter in store | Co-location preference, small stores |
| `subscribeWithSelector` | Non-React subscriptions, side effects |

## References

- [Zustand GitHub - Deriving State](https://github.com/pmndrs/zustand#deriving-state)
- [Zustand v5 Migration Guide](https://zustand.docs.pmnd.rs/migrations/migrating-to-v5)
