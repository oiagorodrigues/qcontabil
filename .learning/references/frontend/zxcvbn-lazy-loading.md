# Lazy-Loading zxcvbn-ts for Password Strength Evaluation

## Overview

`zxcvbn-ts` is a TypeScript port of Dropbox's password strength estimator. The core library plus dictionaries weigh ~800KB uncompressed, making lazy loading essential for pages where password input is optional or deferred.

## Architecture

```
@zxcvbn-ts/core          ~50KB  - scoring engine + async evaluation
@zxcvbn-ts/language-common ~400KB - common passwords, keyboard patterns
@zxcvbn-ts/language-en    ~350KB - English dictionary, l33t mappings
```

## Lazy Loading Pattern

```ts
// Load all three in parallel on first need
const [{ zxcvbnAsync, zxcvbnOptions }, common, en] = await Promise.all([
  import('@zxcvbn-ts/core'),
  import('@zxcvbn-ts/language-common'),
  import('@zxcvbn-ts/language-en'),
])

// Configure with dictionaries
zxcvbnOptions.setOptions({
  graphs: common.default.adjacencyGraphs,
  dictionary: {
    ...common.default.dictionary,
    ...en.default.dictionary,
  },
  translations: en.default.translations,
})

// Evaluate (non-blocking)
const result = await zxcvbnAsync(password)
```

## Score Interpretation

| Score | Label      | Guesses (log10) | Guidance                  |
|-------|------------|-----------------|---------------------------|
| 0     | Very weak  | < 3             | Trivially guessable       |
| 1     | Weak       | < 6             | Easily guessable          |
| 2     | Fair       | < 8             | Somewhat guessable        |
| 3     | Strong     | < 10            | Safely unguessable        |
| 4     | Very strong| >= 10           | Very safely unguessable   |

## zxcvbnAsync vs zxcvbn

- `zxcvbn()` is synchronous and blocks the main thread for 50-200ms on complex passwords.
- `zxcvbnAsync()` uses `requestIdleCallback` (or `setTimeout` fallback) to yield between scoring steps.
- Always prefer `zxcvbnAsync` in UI contexts.

## Cleanup Pattern for React

```ts
useEffect(() => {
  let cancelled = false

  async function evaluate() {
    // ... dynamic import + evaluate
    if (cancelled) return
    setScore(result.score)
  }

  evaluate()
  return () => { cancelled = true }
}, [password])
```

The `cancelled` flag prevents stale state updates when:
- The component unmounts before evaluation completes.
- The password changes rapidly (only the last evaluation's result is applied).

## Preloading Strategy

For forms where password input is expected, preload chunks on mount:

```ts
useEffect(() => {
  // Fire and forget -- warms the module cache
  import('@zxcvbn-ts/core')
  import('@zxcvbn-ts/language-common')
  import('@zxcvbn-ts/language-en')
}, [])
```

## References

- https://zxcvbn-ts.github.io/zxcvbn/
- https://github.com/zxcvbn-ts/zxcvbn
- https://dropbox.tech/security/zxcvbn-realistic-password-strength-estimation
