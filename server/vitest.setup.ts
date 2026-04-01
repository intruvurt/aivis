// Server test bootstrap
// Ensures required env vars are present before any module-level guards fire.
// The vitest.config.ts env block handles JWT_SECRET, but this file is available
// for any additional shared setup (e.g., global mocks, db stubs).

import { afterEach } from 'vitest';

afterEach(() => {
  // Reset any env overrides individual tests may have applied.
});
