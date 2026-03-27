import type { ApiResponse } from '@qcontabil/shared';

// Compile-time check: shared types are importable
type _check = ApiResponse<unknown>;

export function App() {
  return (
    <div>
      <h1>Qcontabil</h1>
    </div>
  );
}
