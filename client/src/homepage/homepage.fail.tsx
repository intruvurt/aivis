/**
 * HOMEPAGE FAIL — rendered when contract validation detects drift
 *
 * Only shown in development. Displays the specific contract violations
 * so the developer can fix them before the build would reject them.
 */

import type { ValidationError } from './homepage.validate';

interface HomepageFailProps {
  errors: ValidationError[];
}

export function HomepageFail({ errors }: HomepageFailProps) {
  return (
    <div style={{
      minHeight: '100vh',
      background: '#0b0f1a',
      color: '#e2e8f0',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'system-ui, sans-serif',
      padding: '2rem',
    }}>
      <div style={{ maxWidth: 640, width: '100%' }}>
        <h1 style={{ color: '#ef4444', fontSize: 24, marginBottom: 8 }}>
          Homepage Contract Violation
        </h1>
        <p style={{ color: '#94a3b8', marginBottom: 24, fontSize: 14 }}>
          The homepage cannot render because the contract validation detected drift.
          Fix the errors below — the build will also reject these.
        </p>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {errors.map((err) => (
            <li
              key={err.code}
              style={{
                padding: '12px 16px',
                marginBottom: 8,
                background: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                borderRadius: 8,
              }}
            >
              <code style={{ color: '#f87171', fontSize: 13 }}>{err.code}</code>
              <p style={{ color: '#cbd5e1', margin: '4px 0 0', fontSize: 14 }}>
                {err.message}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
