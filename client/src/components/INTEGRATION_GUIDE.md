/\*\*

- Integration Guide: Live Pipeline Visualization
-
- This system transforms your UI from a "final-results viewer" into a
- "pipeline projection" — every UI element reflects an execution stage.
-
- CORE PRINCIPLE:
- Backend emits stage → Frontend projects emergence
-
- ============================================================
- SETUP
- ============================================================
-
- 1.  Install Supabase Realtime client (already done if using @supabase/supabase-js)
-
- 2.  Import components + hooks:
-
- import AnalysisViewer from '@/components/AnalysisViewer';
- import useAnalysis from '@/hooks/useAnalysis';
-
- 3.  Render within a page/modal with runId:
-
- <AnalysisViewer
-      runId={analysisRunId}
-      userTier={user.tier}
-      showTimeline={user.tier === 'alignment'}
-      autoReplay={user.tier === 'signal'}
- />
-
- ============================================================
- EXAMPLE: ANALYSIS RESULT PAGE
- ============================================================
  \*/

import React, { useEffect, useState } from 'react';
import AnalysisViewer from '../components/AnalysisViewer';

interface AnalysisPageProps {
runId: string;
}

export const AnalysisPage: React.FC<AnalysisPageProps> = ({ runId }) => {
const [userTier, setUserTier] = useState<'free' | 'starter' | 'alignment' | 'signal'>('starter');
const [isLoading, setIsLoading] = useState(true);

useEffect(() => {
// Fetch user tier from auth context or API
// setUserTier(currentUser?.tier || 'observer');
setIsLoading(false);
}, []);

if (isLoading) {
return <div>Loading analysis...</div>;
}

return (
<div style={{ padding: '2rem' }}>
<h1>Analysis Viewer</h1>

      {/* This is the new UI model: not a dashboard, a state machine renderer */}
      <AnalysisViewer
        runId={runId}
        userTier={userTier}
        showTimeline={userTier === 'alignment' || userTier === 'signal'}
        autoReplay={userTier === 'signal'}
      />
    </div>

);
};

export default AnalysisPage;

/\*\*

- ============================================================
- ADVANCED: CUSTOM STATE ACCESS
- ============================================================
-
- If you need fine-grained state access (e.g., custom rendering),
- use useAnalysis hook directly:
-
- import useAnalysis from '@/hooks/useAnalysis';
-
- export const CustomAnalysisView: React.FC<Props> = () => {
-      const {
-        state,           // full UIState
-        stages,          // { fetch, parse, entities, score, cache }
-        entities,        // entity array
-        citations,       // citation array
-        scores,          // { visibility, authority, ... }
-        isAnalyzing,
-        isComplete,
-        isError,
-      } = useAnalysis({
-        runId: 'your-run-id',
-        userTier: 'alignment',
-      });
-
-      return (
-        <div>
-          <h2>Entities: {entities.length}</h2>
-          {entities.map(e => (
-            <div key={e.id}>{e.value}</div>
-          ))}
-        </div>
-      );
- };
-
- ============================================================
- TIER BEHAVIOR
- ============================================================
-
- Free (observer)
- - Loads cached snapshot from analysis_cache only
- - No realtime subscription
- - UI shows static result
-
- Starter
- - Subscribes to pipeline realtime
- - Shows live stage progression
- - Shows emerging entities + scores
-
- Alignment
- - All of Starter +
- - Timeline replay enabled
- - Can scrub through historical runs
- - Diff visualization
-
- Signal
- - All of Alignment +
- - Auto-replay on complete
- - Triple-model reasoning chain visualization
- - Full citation graph
-
- ============================================================
- VISUAL ENCODING REFERENCE
- ============================================================
-
- Entity Opacity = Confidence
- 0.3 opacity = 30% confidence
- 0.9 opacity = 90% confidence
-
- Citation Thickness = Frequency
- 1px = single mention
- 5px = 5+ mentions (capped)
-
- Stage Colors:
- Gray = pending
- Blue = running
- Green = complete
- Red = failed
-
- Motion:
- Entities animate in: scale 0.8→1 over 400ms
- Citations slide left: translateX(-10px) → 0 over 300ms
- Scores stabilize: bar height animates to final value
-
- ============================================================
- BACKEND INTEGRATION CHECKLIST
- ============================================================
-
- [✓] auditWorker.ts imports broadcaster service
- [✓] auditWorker.ts calls broadcastStageUpdate() at each stage
- [✓] auditWorker.ts calls broadcastPartialResults() with scores
- [✓] auditWorker.ts calls broadcastAnalysisComplete() on finish
- [?] Edge functions: Does your DB send events to Realtime automatically?
-     → If using Postgres triggers: events are automatic
-     → If using manual inserts: call broadcaster functions (done)
- [?] ingestion_jobs table: Is it properly keyed by runId?
-     → Verify Realtime channel subscriptions filter on correct columns
-
- ============================================================
- TROUBLESHOOTING
- ============================================================
-
- "No events are streaming"
- → Check browser console for Realtime connection
- → Verify runId matches ingestion_jobs.id in database
- → Check user tier (free users don't subscribe)
- → Ensure auditWorker is calling broadcaster functions
-
- "Entities appear statically, not emerging"
- → Check getEntityEmergenceProgress() in useAnalysisState.ts
- → Verify appearedAt timestamps in state
- → Check EntityHighlight animation CSS
-
- "Timeline doesn't replay"
- → Requires user tier 'alignment' or higher
- → Verify timeline.events are being recorded
- → Check scrubToFrame() implementation
-
- ============================================================
- NEXT STEPS
- ============================================================
-
- 1.  Deploy the broadcaster service to your server
- 2.  Update auditWorker to include broadcaster calls (DONE)
- 3.  Deploy AnalysisViewer component to your React app
- 4.  Add AnalysisViewer to your analysis result page
- 5.  Test with a dev run: watch entities + citations emerge
- 6.  Tier-gate the timeline replay feature
- 7.  Monitor Realtime connection metrics
      \*/
