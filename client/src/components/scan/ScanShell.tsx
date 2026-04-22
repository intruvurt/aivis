/**
 * ScanShell.tsx
 *
 * The static execution frame. Houses the three-layer scan surface:
 *   TopInputBar (entry, IDLE/INPUT_FOCUSED only)
 *   ExecutionViewport (phase-switched core)
 *   ToolRail (secondary escape, hidden during SCANNING)
 *
 * Wraps its own ScanProvider so the machine is self-contained.
 * onResult callback lets Landing (or any parent) read the result
 * for downstream UI (e.g. the pricing conversion trigger).
 */

import { useEffect, useRef } from 'react';
import { ScanProvider, useScan } from '../../context/ScanContext';
import { TopInputBar } from './TopInputBar';
import { ExecutionViewport } from './ExecutionViewport';
import { ToolRail } from './ToolRail';
import type { ScanResult } from '../../machines/scanMachine';

// ── Inner shell (inside context) ──────────────────────────────────────────────

interface InnerProps {
  onResult?: (result: ScanResult) => void;
  onPhaseChange?: (phase: string) => void;
  resultRef?: React.RefObject<HTMLDivElement>;
}

function ScanShellInner({ onResult, onPhaseChange, resultRef }: InnerProps) {
  const { state } = useScan();
  const prevPhaseRef = useRef(state.phase);

  // Fire onResult callback once when phase flips to RESULT
  useEffect(() => {
    if (prevPhaseRef.current !== 'RESULT' && state.phase === 'RESULT') {
      onResult?.(state.result);
      // Scroll to result
      setTimeout(() => {
        resultRef?.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 200);
    }
    prevPhaseRef.current = state.phase;
    onPhaseChange?.(state.phase);
  }, [state.phase, onResult, onPhaseChange, resultRef]);

  return (
    <div className="scan-shell w-full text-center">
      <TopInputBar />
      <div ref={state.phase === 'RESULT' ? resultRef : undefined}>
        <ExecutionViewport />
      </div>
      <ToolRail />
    </div>
  );
}

// ── Public export (provides own context) ─────────────────────────────────────

interface ScanShellProps {
  onResult?: (result: ScanResult) => void;
  onPhaseChange?: (phase: string) => void;
  resultRef?: React.RefObject<HTMLDivElement>;
}

export function ScanShell({ onResult, onPhaseChange, resultRef }: ScanShellProps) {
  return (
    <ScanProvider>
      <ScanShellInner onResult={onResult} onPhaseChange={onPhaseChange} resultRef={resultRef} />
    </ScanProvider>
  );
}
