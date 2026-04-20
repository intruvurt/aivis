/**
 * ToolRail.tsx
 *
 * Secondary system escape. Hidden during SCANNING.
 * Never visually dominant. Never competes with execution viewport.
 */

import { Link } from 'react-router-dom';
import { useScan } from '../../context/ScanContext';

const TOOLS: Array<{ label: string; href: string }> = [
  { label: 'History', href: '/app/audits' },
  { label: 'Registry', href: '/app/cite-ledger' },
  { label: 'Fixes', href: '/app/reverse-engineer' },
  { label: 'Pricing', href: '#pricing' },
];

export function ToolRail() {
  const { state } = useScan();

  // Rule: hidden during active scan
  if (state.phase === 'SCANNING') return null;

  return (
    <div className="flex flex-wrap justify-center gap-x-5 gap-y-1 mt-3">
      {TOOLS.map((t) =>
        t.href.startsWith('#') ? (
          <a
            key={t.label}
            href={t.href}
            className="text-xs text-white/25 hover:text-white/55 transition-colors"
          >
            {t.label}
          </a>
        ) : (
          <Link
            key={t.label}
            to={t.href}
            className="text-xs text-white/25 hover:text-white/55 transition-colors"
          >
            {t.label}
          </Link>
        )
      )}
    </div>
  );
}
