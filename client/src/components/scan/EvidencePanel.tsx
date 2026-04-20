/**
 * EvidencePanel.tsx
 *
 * Collapsed truth graph. Each row is deterministic: source · key · status.
 * No expansion by default. No secondary blocks unless user explicitly expands.
 */

import { useState } from 'react';
import type { CiteEntry } from '../../../../shared/types';

interface Props {
  cites: CiteEntry[];
}

function CitationRow({ cite }: { cite: CiteEntry }) {
  return (
    <div className="citation-row flex items-start gap-3 py-2.5 border-b border-white/5 last:border-0">
      <span className="font-mono text-[10px] text-white/25 shrink-0 pt-0.5 min-w-[5rem] truncate">
        {cite.evidence_key}
      </span>
      <span className="text-sm text-white/60 flex-1 truncate">{cite.raw_evidence}</span>
      <span className="text-xs text-white/30 shrink-0 font-mono">
        {cite.extracted_signal.split('—')[1]?.trim() ?? ''}
      </span>
    </div>
  );
}

export function EvidencePanel({ cites }: Props) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? cites : cites.slice(0, 4);
  const hasMore = cites.length > 4;

  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.02] overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/8">
        <span className="text-[10px] font-bold uppercase tracking-widest text-white/35">
          Cite Ledger
        </span>
        <span className="text-[10px] text-white/25 font-mono">{cites.length} ids</span>
      </div>

      <div className="px-4">
        {visible.map((c) => (
          <CitationRow key={c.id} cite={c} />
        ))}
      </div>

      {hasMore && (
        <button
          type="button"
          onClick={() => setExpanded((x) => !x)}
          className="w-full py-2.5 text-xs text-white/30 hover:text-white/60 transition-colors border-t border-white/5"
        >
          {expanded ? '↑ Collapse' : `↓ ${cites.length - 4} more cites locked`}
        </button>
      )}
    </div>
  );
}
