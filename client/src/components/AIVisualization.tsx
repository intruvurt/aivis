import { motion } from 'framer-motion';
import React, { type FC, useEffect, useMemo, useState } from 'react';

type Node = {
  x: number;
  y: number;
  id: number;
  size: number;
  speed: number;
};

type Connection = {
  from: number;
  to: number;
  opacity: number;
};

type AIVisualizationProps = {
  nodeCount?: number;
  showConnections?: boolean;
  intensity?: number;
  colors?: {
    start: string;
    middle: string;
    end: string;
  };
  height?: string;
};

/**
 * Deterministic crypto-backed RNG.
 * - Uses SHA-256(seed || ":" || counter) as a keystream.
 * - Deterministic for a given seed across sessions.
 * - No Math.random.
 */
function createCryptoSeededRandom(seed: string) {
  let pool = new Uint8Array(0);
  let idx = 0;
  let counter = 0;

  const te = new TextEncoder();

  async function refill() {
    const input = te.encode(`${seed}:${counter++}`);
    const digest = await crypto.subtle.digest('SHA-256', input);
    pool = new Uint8Array(digest);
    idx = 0;
  }

  async function nextU8(): Promise<number> {
    if (idx >= pool.length) await refill();
    return pool[idx++];
  }

  // float in [0,1)
  async function nextFloat01(): Promise<number> {
    // Build a 32-bit uint from 4 bytes
    const b0 = await nextU8();
    const b1 = await nextU8();
    const b2 = await nextU8();
    const b3 = await nextU8();
    const u32 = ((b0 << 24) | (b1 << 16) | (b2 << 8) | b3) >>> 0;
    return u32 / 4294967296;
  }

  async function nextInt(min: number, max: number): Promise<number> {
    min = Math.ceil(min);
    max = Math.floor(max);
    if (max < min) [min, max] = [max, min];
    const range = max - min + 1;
    if (range <= 1) return min;

    // rejection sampling to avoid modulo bias
    while (true) {
      const b0 = await nextU8();
      const b1 = await nextU8();
      const b2 = await nextU8();
      const b3 = await nextU8();
      const x = ((b0 << 24) | (b1 << 16) | (b2 << 8) | b3) >>> 0;

      const limit = Math.floor(4294967296 / range) * range;
      if (x < limit) return min + (x % range);
    }
  }

  return { nextFloat01, nextInt };
}

const generateConnections = (nodes: Node[]): Connection[] => {
  const connections: Connection[] = [];
  const maxDistance = 20;

  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const dx = nodes[i].x - nodes[j].x;
      const dy = nodes[i].y - nodes[j].y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < maxDistance) {
        connections.push({
          from: i,
          to: j,
          opacity: 1 - distance / maxDistance,
        });
      }
    }
  }

  return connections;
};

type Particle = { x: number; y: number; duration: number; delay: number };

export const AIVisualization: FC<AIVisualizationProps> = ({
  nodeCount = 50,
  showConnections = true,
  intensity = 1,
  colors = {
    start: 'rgba(255,255,255,0.6)',
    middle: 'rgba(255,255,255,0.45)',
    end: 'rgba(255,255,255,0.3)',
  },
  height = 'h-96',
}) => {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [particles, setParticles] = useState<Particle[]>([]);

  // Generate nodes + particles deterministically via crypto hash stream
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const rng = createCryptoSeededRandom(`aivis:nodes:${nodeCount}`);

      const newNodes: Node[] = [];
      for (let i = 0; i < nodeCount; i++) {
        const x = (await rng.nextFloat01()) * 100;
        const y = (await rng.nextFloat01()) * 100;
        const size = 2 + (await rng.nextFloat01()) * 2; // 2-4
        const speed = 2 + (await rng.nextFloat01()) * 2; // 2-4s
        newNodes.push({ x, y, id: i, size, speed });
      }

      // Separate seed stream for particles so node changes don't reshuffle them
      const prng = createCryptoSeededRandom(`aivis:particles:20`);
      const newParticles: Particle[] = [];
      for (let i = 0; i < 20; i++) {
        newParticles.push({
          x: (await prng.nextFloat01()) * 100,
          y: (await prng.nextFloat01()) * 100,
          duration: 5 + (await prng.nextFloat01()) * 5,
          delay: i * 0.3,
        });
      }

      if (!cancelled) {
        setNodes(newNodes);
        setParticles(newParticles);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [nodeCount]);

  const connections = useMemo(() => {
    if (!showConnections || nodes.length === 0) return [];
    return generateConnections(nodes);
  }, [nodes, showConnections]);

  return (
    <div className={`relative w-full ${height} bg-charcoal rounded-3xl overflow-hidden`}>
      <div className="absolute inset-0 bg-gradient-to-br from-white/25/10 via-white/14 to-white/14/10" />

      <motion.div
        className="absolute inset-0 bg-gradient-to-r from-white/25/5 via-white/14 to-white/14/5"
        animate={{ opacity: [0.3, 0.6, 0.3] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
      />

      <svg className="w-full h-full" aria-hidden="true">
        <defs>
          <linearGradient id="nodeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={colors.start} />
            <stop offset="50%" stopColor={colors.middle} />
            <stop offset="100%" stopColor={colors.end} />
          </linearGradient>

          <linearGradient id="connectionGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={colors.start} stopOpacity="0.3" />
            <stop offset="50%" stopColor={colors.middle} stopOpacity="0.5" />
            <stop offset="100%" stopColor={colors.end} stopOpacity="0.3" />
          </linearGradient>

          <filter id="glow">
            <feGaussianBlur stdDeviation="2" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {showConnections && (
          <g className="connections">
            {connections.map((conn, i) => {
              const from = nodes[conn.from];
              const to = nodes[conn.to];
              if (!from || !to) return null;

              return (
                <motion.line
                  key={`conn-${i}`}
                  x1={`${from.x}%`}
                  y1={`${from.y}%`}
                  x2={`${to.x}%`}
                  y2={`${to.y}%`}
                  stroke="url(#connectionGradient)"
                  strokeWidth="1"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: [0, conn.opacity * 0.3 * intensity, 0] }}
                  transition={{
                    duration: 3,
                    repeat: Infinity,
                    delay: i * 0.02,
                    ease: 'easeInOut',
                  }}
                />
              );
            })}
          </g>
        )}

        <g className="nodes">
          {nodes.map((node, i) => (
            <motion.circle
              key={node.id}
              cx={`${node.x}%`}
              cy={`${node.y}%`}
              r={node.size}
              fill="url(#nodeGradient)"
              filter="url(#glow)"
              initial={{ opacity: 0, scale: 0 }}
              animate={{
                opacity: [0.3 * intensity, 0.8 * intensity, 0.3 * intensity],
                scale: [1, 1.2, 1],
              }}
              transition={{
                duration: node.speed,
                repeat: Infinity,
                delay: i * 0.05,
                ease: 'easeInOut',
              }}
            />
          ))}
        </g>

        <g className="particles">
          {particles.map((p, i) => (
            <motion.circle
              key={`particle-${i}`}
              cx={`${p.x}%`}
              cy={`${p.y}%`}
              r="1"
              fill={colors.middle}
              opacity="0.4"
              animate={{
                y: ['-10%', '110%'],
                opacity: [0, 0.6 * intensity, 0],
              }}
              transition={{
                duration: p.duration,
                repeat: Infinity,
                delay: p.delay,
                ease: 'linear',
              }}
            />
          ))}
        </g>
      </svg>

      <div className="absolute inset-0 bg-gradient-radial from-transparent via-transparent to-black/10 pointer-events-none" />
    </div>
  );
};

export const CompactAIVisualization: FC = () => (
  <AIVisualization nodeCount={30} height="h-64" showConnections={false} />
);

export const IntenseAIVisualization: FC = () => (
  <AIVisualization nodeCount={80} intensity={1.5} />
);

export const CustomColorAIVisualization: FC<{ colors: AIVisualizationProps['colors'] }> = ({ colors }) => (
  <AIVisualization colors={colors} />
);
