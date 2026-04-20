/**
 * AgentLaneView.tsx — parallel cognition visualization
 *
 * Each agent is a live "lane" showing decision bursts as colored bars.
 * Bar width = relative burst activity. Color = confidence tier.
 */

import React from 'react';
import { useDebugStore } from '../../stores/debugStore';
import type { AgentBurst } from '../../stores/debugStore';

const AGENT_COLORS: Record<string, string> = {
  CitationVoter: '#f59e0b',
  EntityAgent: '#60a5fa',
  InterpretAgent: '#fb7185',
  'Reducer:crawl': '#4ade80',
  'Reducer:semantic': '#34d399',
  'Reducer:authority': '#22d3ee',
  Finaliser: '#818cf8',
  Orchestrator: '#94a3b8',
};

function laneColor(agent: string): string {
  return AGENT_COLORS[agent] ?? '#64748b';
}

function confClass(conf: number): string {
  const tier = Math.floor(conf * 10);
  if (tier >= 9) return 'bar--hi';
  if (tier >= 6) return 'bar--mid';
  return 'bar--lo';
}

function LaneBars({ bursts, color }: { bursts: AgentBurst[]; color: string }) {
  const maxDur = Math.max(...bursts.map((b) => b.durationMs), 1);

  return (
    <div className="lane-bars">
      {bursts.map((burst, i) => (
        <span
          key={i}
          className={`lane-bar ${confClass(burst.confidence)}`}
          style={{
            background: color,
            opacity: 0.4 + burst.confidence * 0.6,
            width: Math.max(6, (burst.durationMs / maxDur) * 40),
          }}
          title={`${burst.eventType} — conf ${(burst.confidence * 100).toFixed(0)}% — ${burst.durationMs.toFixed(1)}ms`}
        />
      ))}
    </div>
  );
}

export default function AgentLaneView() {
  const agentLanes = useDebugStore((s) => s.agentLanes);
  const replayIndex = useDebugStore((s) => s.replayIndex);
  const events = useDebugStore((s) => s.events);

  // In replay mode, trim lanes to only events before replayIndex
  const visibleNodeIds =
    replayIndex !== null ? new Set(events.slice(0, replayIndex + 1).map((e) => e.id)) : null;

  const lanes = Object.entries(agentLanes).map(([agent, allBursts]) => {
    const bursts = visibleNodeIds
      ? allBursts.filter((b) => visibleNodeIds.has(b.nodeId))
      : allBursts;
    return { agent, bursts };
  });

  return (
    <div className="dbg-panel dbg-panel--lanes">
      <div className="dbg-panel__header">
        <span className="dbg-panel__title">Agent Activity Map</span>
        <span className="dbg-panel__sub">{lanes.length} active lanes</span>
      </div>

      {lanes.length === 0 ? (
        <div className="dbg-empty">No agent activity captured yet.</div>
      ) : (
        <div className="lanes-list">
          {lanes.map(({ agent, bursts }) => {
            const color = laneColor(agent);
            const totalBursts = bursts.length;
            const avgConf =
              totalBursts > 0 ? bursts.reduce((s, b) => s + b.confidence, 0) / totalBursts : 0;

            return (
              <div key={agent} className="lane-row">
                <div className="lane-label" style={{ color }}>
                  <span className="lane-name">{agent}</span>
                  <span className="lane-stats">
                    {totalBursts} events · {(avgConf * 100).toFixed(0)}% avg conf
                  </span>
                </div>
                <LaneBars bursts={bursts} color={color} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
