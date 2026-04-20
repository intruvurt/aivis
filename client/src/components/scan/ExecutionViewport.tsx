/**
 * ExecutionViewport.tsx
 *
 * The core system surface. Switches between phase views — no overlap, no mixing.
 * Each phase renders exactly one component. Nothing else.
 */

import { useScan } from '../../context/ScanContext';
import { ScanningView } from './ScanningView';
import { ResultView } from './ResultView';

export function ExecutionViewport() {
  const { state } = useScan();

  switch (state.phase) {
    case 'IDLE':
    case 'INPUT_FOCUSED':
      // Input state: the viewport is empty — TopInputBar is the surface
      return null;

    case 'SCANNING':
      return <ScanningView stage={state.stage} url={state.url} />;

    case 'RESULT':
      return <ResultView result={state.result} />;

    case 'ERROR':
      return (
        <div className="mt-4 p-4 rounded-xl border border-red-400/25 bg-red-500/10 text-red-300 text-sm max-w-md mx-auto text-center">
          {state.error}
        </div>
      );
  }
}
