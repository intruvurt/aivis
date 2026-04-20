/**
 * EntityGraph.tsx — Raw WebGL2 force-directed graph renderer.
 *
 * Architecture:
 *   Physics  → CPU Verlet (O(n²) repulsion + spring edges). Fast to ~2k nodes.
 *   Render   → WebGL2: gl.LINES (edges) + gl.POINTS (nodes, SDF circle + glow).
 *   Tooltip  → Single DOM <div>, positioned from canvas-to-CSS coords on hover.
 *   Lookup   → O(1) edge spring via simMap (avoids per-frame sim.find()).
 *
 * No third-party graph library. The graph engine is ONLY a renderer —
 * all state is owned by the caller (CognitionOverlay) and the replayStore.
 *
 * Streaming updates: callers swap `nodes`/`edges` props; sync effects
 * preserve existing Verlet momentum so in-flight nodes keep moving.
 *
 * Visual semantics (strict):
 *   green  #22c55e → confirmed
 *   yellow #eab308 → uncertain
 *   red    #ef4444 → conflict (oscillates)
 *   cyan   #06b6d4 → category
 *   violet #8b5cf6 → keyword
 *   gray   #94a3b8 → claim / pending
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import type { CognitionNode, CognitionEdge, SimNode } from './types';

// ── Pre-allocated GPU buffer limits ──────────────────────────────────────────
const MAX_NODES = 4096;
const MAX_EDGES = 16_384;

// ── Color tables (RGB 0-1 floats) ─────────────────────────────────────────────
const NODE_RGB: Record<string, readonly [number, number, number]> = {
  entity: [0.133, 0.773, 0.369],
  category: [0.024, 0.714, 0.831],
  issue: [0.937, 0.267, 0.267],
  keyword: [0.545, 0.361, 0.973],
  claim: [0.58, 0.635, 0.722],
  // answer-presence phase
  query: [0.976, 0.788, 0.118], // amber — test query
  gap: [0.996, 0.388, 0.388], // red   — detected gap
};
const STATUS_RGB: Partial<Record<string, readonly [number, number, number]>> = {
  confirmed: [0.133, 0.773, 0.369],
  conflict: [0.937, 0.267, 0.267],
  uncertain: [0.918, 0.702, 0.031],
  pending: [0.216, 0.255, 0.318],
};
function getRgb(n: CognitionNode): readonly [number, number, number] {
  return STATUS_RGB[n.status] ?? NODE_RGB[n.type] ?? [0.58, 0.635, 0.722];
}

// ── GLSL –– edge pass ─────────────────────────────────────────────────────────
const EDGE_VERT = `#version 300 es
precision highp float;
in vec2 a_pos;
uniform vec2 u_res;
void main(){
  vec2 c=vec2(a_pos.x/u_res.x*2.0-1.0,-(a_pos.y/u_res.y*2.0-1.0));
  gl_Position=vec4(c,0.0,1.0);
}`;
const EDGE_FRAG = `#version 300 es
precision mediump float;
out vec4 col;
void main(){ col=vec4(1.0,1.0,1.0,0.065); }`;

// ── GLSL –– node pass (POINTS + SDF circle + glow) ───────────────────────────
const NODE_VERT = `#version 300 es
precision highp float;
in vec2 a_pos;
in vec3 a_col;
in float a_size;
uniform vec2 u_res;
out vec3 v_col;
void main(){
  vec2 c=vec2(a_pos.x/u_res.x*2.0-1.0,-(a_pos.y/u_res.y*2.0-1.0));
  gl_Position=vec4(c,0.0,1.0);
  gl_PointSize=a_size;
  v_col=a_col;
}`;
const NODE_FRAG = `#version 300 es
precision highp float;
in vec3 v_col;
out vec4 col;
void main(){
  vec2 pc=gl_PointCoord-0.5;
  float d=length(pc)*2.0;
  if(d>1.0) discard;
  float circle=1.0-smoothstep(0.55,0.92,d);
  float glow=exp(-d*d*2.2)*0.38;
  float alpha=clamp(circle+glow,0.0,1.0);
  col=vec4(v_col*(circle+glow*0.55),alpha);
}`;

// ── Shader helpers ────────────────────────────────────────────────────────────
function compileShader(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
  const s = gl.createShader(type)!;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(s);
    gl.deleteShader(s);
    throw new Error(`Shader: ${log}`);
  }
  return s;
}
function makeProgram(gl: WebGL2RenderingContext, vs: string, fs: string): WebGLProgram {
  const p = gl.createProgram()!;
  gl.attachShader(p, compileShader(gl, gl.VERTEX_SHADER, vs));
  gl.attachShader(p, compileShader(gl, gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(p);
    gl.deleteProgram(p);
    throw new Error(`Link: ${log}`);
  }
  return p;
}

// ── Component ─────────────────────────────────────────────────────────────────
interface Props {
  nodes: CognitionNode[];
  edges: CognitionEdge[];
  selectedNodeId: string | null;
  onNodeHover: (id: string | null) => void;
  onNodeClick: (id: string) => void;
}

export function EntityGraph({ nodes, edges, selectedNodeId, onNodeHover, onNodeClick }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Physics state (mutable refs — never trigger re-renders)
  const simRef = useRef<SimNode[]>([]);
  const simMapRef = useRef(new Map<string, SimNode>());
  const edgesRef = useRef<CognitionEdge[]>([]);

  const hoveredIdRef = useRef<string | null>(null);
  const selectedRef = useRef<string | null>(null);
  const sizeRef = useRef({ w: 1, h: 1 });
  const dprRef = useRef(1);
  const rafRef = useRef(0);
  const frameRef = useRef(0);

  // WebGL handles
  const glRef = useRef<WebGL2RenderingContext | null>(null);
  const edgeProgRef = useRef<WebGLProgram | null>(null);
  const nodeProgRef = useRef<WebGLProgram | null>(null);
  const edgeVaoRef = useRef<WebGLVertexArrayObject | null>(null);
  const edgeBufRef = useRef<WebGLBuffer | null>(null);
  const edgeResLocRef = useRef<WebGLUniformLocation | null>(null);
  const nodeVaoRef = useRef<WebGLVertexArrayObject | null>(null);
  const nodePosBufRef = useRef<WebGLBuffer | null>(null);
  const nodeColBufRef = useRef<WebGLBuffer | null>(null);
  const nodeSizeBufRef = useRef<WebGLBuffer | null>(null);
  const nodeResLocRef = useRef<WebGLUniformLocation | null>(null);

  // Pre-allocated typed arrays — reused every frame, never reallocated
  const edgeArr = useRef(new Float32Array(MAX_EDGES * 4));
  const nodePosArr = useRef(new Float32Array(MAX_NODES * 2));
  const nodeColArr = useRef(new Float32Array(MAX_NODES * 3));
  const nodeSizeArr = useRef(new Float32Array(MAX_NODES));

  // Tooltip (single DOM node)
  const [tooltip, setTooltip] = useState<{ x: number; y: number; node: SimNode } | null>(null);

  // ── Ref syncs (avoid re-running animation effect) ─────────────────────────
  useEffect(() => {
    selectedRef.current = selectedNodeId;
  }, [selectedNodeId]);
  useEffect(() => {
    edgesRef.current = edges;
  }, [edges]);

  // ── Node sync: preserve Verlet state for existing nodes ───────────────────
  useEffect(() => {
    const existing = simMapRef.current;
    const nextIds = new Set(nodes.map((n) => n.id));

    const next = nodes.map((n) => {
      const ex = existing.get(n.id);
      if (ex) {
        ex.label = n.label;
        ex.type = n.type;
        ex.confidence = n.confidence;
        ex.status = n.status;
        ex.sources = n.sources;
        ex.radius = n.radius;
        return ex;
      }
      const angle = Math.random() * Math.PI * 2;
      const spread = 40 + Math.random() * 60;
      const sn: SimNode = {
        ...n,
        x: Math.cos(angle) * spread,
        y: Math.sin(angle) * spread,
        vx: (Math.random() - 0.5) * 2,
        vy: (Math.random() - 0.5) * 2,
      };
      return sn;
    });

    for (const id of existing.keys()) if (!nextIds.has(id)) existing.delete(id);
    for (const sn of next) existing.set(sn.id, sn);
    simRef.current = next;
  }, [nodes]);

  // ── Canvas resize ─────────────────────────────────────────────────────────
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      dprRef.current = dpr;
      const { width, height } = container.getBoundingClientRect();
      const pw = Math.round(width * dpr),
        ph = Math.round(height * dpr);
      if (canvas.width === pw && canvas.height === ph) return;
      canvas.width = pw;
      canvas.height = ph;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      sizeRef.current = { w: pw, h: ph };
      glRef.current?.viewport(0, 0, pw, ph);
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  // ── Hit testing ───────────────────────────────────────────────────────────
  const findNodeAt = useCallback((cx: number, cy: number): SimNode | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const dpr = dprRef.current;
    const mx = (cx - rect.left) * dpr;
    const my = (cy - rect.top) * dpr;
    const { w, h } = sizeRef.current;
    const ox = w / 2,
      oy = h / 2;
    for (const node of simRef.current) {
      const dx = mx - (ox + node.x * dpr);
      const dy = my - (oy + node.y * dpr);
      const hit = (node.radius + 6) * dpr;
      if (dx * dx + dy * dy < hit * hit) return node;
    }
    return null;
  }, []);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const hit = findNodeAt(e.clientX, e.clientY);
      const id = hit?.id ?? null;
      if (id !== hoveredIdRef.current) {
        hoveredIdRef.current = id;
        onNodeHover(id);
      }
      if (hit) {
        const rect = canvasRef.current!.getBoundingClientRect();
        setTooltip({ x: e.clientX - rect.left, y: e.clientY - rect.top, node: hit });
      } else {
        setTooltip(null);
      }
    },
    [findNodeAt, onNodeHover]
  );

  const handleMouseLeave = useCallback(() => {
    hoveredIdRef.current = null;
    onNodeHover(null);
    setTooltip(null);
  }, [onNodeHover]);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      const hit = findNodeAt(e.clientX, e.clientY);
      if (hit) onNodeClick(hit.id);
    },
    [findNodeAt, onNodeClick]
  );

  // ── WebGL init + rAF loop (runs once, reads state via refs) ──────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext('webgl2', {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: 'high-performance',
    }) as WebGL2RenderingContext | null;

    if (!gl) {
      // Graceful degradation
      const ctx = canvas.getContext('2d');
      ctx?.fillRect(0, 0, canvas.width, canvas.height);
      return;
    }
    glRef.current = gl;

    let edgeProg: WebGLProgram, nodeProg: WebGLProgram;
    try {
      edgeProg = makeProgram(gl, EDGE_VERT, EDGE_FRAG);
      nodeProg = makeProgram(gl, NODE_VERT, NODE_FRAG);
    } catch (err) {
      console.error('[EntityGraph] WebGL compile failed', err);
      return;
    }
    edgeProgRef.current = edgeProg;
    nodeProgRef.current = nodeProg;

    // Edge VAO
    const edgeVao = gl.createVertexArray()!;
    const edgeBuf = gl.createBuffer()!;
    gl.bindVertexArray(edgeVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, edgeBuf);
    gl.bufferData(gl.ARRAY_BUFFER, edgeArr.current.byteLength, gl.DYNAMIC_DRAW);
    const ePosLoc = gl.getAttribLocation(edgeProg, 'a_pos');
    gl.enableVertexAttribArray(ePosLoc);
    gl.vertexAttribPointer(ePosLoc, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
    edgeVaoRef.current = edgeVao;
    edgeBufRef.current = edgeBuf;
    edgeResLocRef.current = gl.getUniformLocation(edgeProg, 'u_res');

    // Node VAO — 3 separate attribute buffers
    const nodeVao = gl.createVertexArray()!;
    const nPosBuf = gl.createBuffer()!;
    const nColBuf = gl.createBuffer()!;
    const nSizeBuf = gl.createBuffer()!;
    gl.bindVertexArray(nodeVao);

    gl.bindBuffer(gl.ARRAY_BUFFER, nPosBuf);
    gl.bufferData(gl.ARRAY_BUFFER, nodePosArr.current.byteLength, gl.DYNAMIC_DRAW);
    const nPosLoc = gl.getAttribLocation(nodeProg, 'a_pos');
    gl.enableVertexAttribArray(nPosLoc);
    gl.vertexAttribPointer(nPosLoc, 2, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, nColBuf);
    gl.bufferData(gl.ARRAY_BUFFER, nodeColArr.current.byteLength, gl.DYNAMIC_DRAW);
    const nColLoc = gl.getAttribLocation(nodeProg, 'a_col');
    gl.enableVertexAttribArray(nColLoc);
    gl.vertexAttribPointer(nColLoc, 3, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, nSizeBuf);
    gl.bufferData(gl.ARRAY_BUFFER, nodeSizeArr.current.byteLength, gl.DYNAMIC_DRAW);
    const nSizeLoc = gl.getAttribLocation(nodeProg, 'a_size');
    gl.enableVertexAttribArray(nSizeLoc);
    gl.vertexAttribPointer(nSizeLoc, 1, gl.FLOAT, false, 0, 0);

    gl.bindVertexArray(null);
    nodeVaoRef.current = nodeVao;
    nodePosBufRef.current = nPosBuf;
    nodeColBufRef.current = nColBuf;
    nodeSizeBufRef.current = nSizeBuf;
    nodeResLocRef.current = gl.getUniformLocation(nodeProg, 'u_res');

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.disable(gl.DEPTH_TEST);
    const { w: iw, h: ih } = sizeRef.current;
    gl.viewport(0, 0, iw, ih);

    // Physics constants
    const K_REPULSE = 7000;
    const K_SPRING = 110;
    const DAMPING = 0.87;
    const CENTER_PULL = 0.0015;

    function tick() {
      const sim = simRef.current;
      const edgs = edgesRef.current;
      const { w, h } = sizeRef.current;
      const dpr = dprRef.current;
      const fc = frameRef.current;

      // ── Physics ──────────────────────────────────────────────────────────
      if (fc < 300 || fc % 2 === 0) {
        const len = sim.length;
        // Coulomb repulsion O(n²)
        for (let i = 0; i < len; i++) {
          for (let j = i + 1; j < len; j++) {
            const dx = sim[j].x - sim[i].x,
              dy = sim[j].y - sim[i].y;
            const d2 = dx * dx + dy * dy + 1;
            const d = Math.sqrt(d2);
            const f = K_REPULSE / d2;
            const fx = (dx / d) * f,
              fy = (dy / d) * f;
            sim[i].vx -= fx;
            sim[i].vy -= fy;
            sim[j].vx += fx;
            sim[j].vy += fy;
          }
        }
        // Hooke springs — O(1) lookup via simMap
        const smap = simMapRef.current;
        for (const e of edgs) {
          const s = smap.get(e.source),
            t = smap.get(e.target);
          if (!s || !t) continue;
          const dx = t.x - s.x,
            dy = t.y - s.y;
          const d = Math.sqrt(dx * dx + dy * dy) || 1;
          const f = (d - K_SPRING) * e.strength * 0.06;
          const fx = (dx / d) * f,
            fy = (dy / d) * f;
          s.vx += fx;
          s.vy += fy;
          t.vx -= fx;
          t.vy -= fy;
        }
        // Integrate + center gravity + radial boundary
        const maxR = Math.min(w, h) / dpr / 2 - 50;
        for (const node of sim) {
          node.vx = (node.vx - node.x * CENTER_PULL) * DAMPING;
          node.vy = (node.vy - node.y * CENTER_PULL) * DAMPING;
          node.x += node.vx;
          node.y += node.vy;
          const dist = Math.sqrt(node.x * node.x + node.y * node.y);
          if (dist > maxR) {
            node.x = (node.x / dist) * maxR;
            node.y = (node.y / dist) * maxR;
            node.vx *= -0.2;
            node.vy *= -0.2;
          }
        }
      }

      // ── Pack GPU buffers ─────────────────────────────────────────────────
      const cx = w / 2,
        cy = h / 2;
      const t = fc * 0.03;
      const n = Math.min(sim.length, MAX_NODES);
      const ep = edgeArr.current;
      const np = nodePosArr.current;
      const nc = nodeColArr.current;
      const ns = nodeSizeArr.current;

      // Edges
      let ei = 0;
      const smap = simMapRef.current;
      for (const e of edgs) {
        if (ei + 4 > ep.length) break;
        const s = smap.get(e.source);
        const tg = smap.get(e.target);
        if (!s || !tg) continue;
        ep[ei++] = cx + s.x * dpr;
        ep[ei++] = cy + s.y * dpr;
        ep[ei++] = cx + tg.x * dpr;
        ep[ei++] = cy + tg.y * dpr;
      }

      // Nodes
      const hov = hoveredIdRef.current;
      const sel = selectedRef.current;
      for (let i = 0; i < n; i++) {
        const node = sim[i];
        np[i * 2] = cx + node.x * dpr;
        np[i * 2 + 1] = cy + node.y * dpr;
        const [r, g, b] = getRgb(node);
        const isHov = node.id === hov,
          isSel = node.id === sel;
        const alpha = isHov || isSel ? 1.0 : node.status === 'pending' ? 0.28 : 0.82;
        nc[i * 3] = r * alpha;
        nc[i * 3 + 1] = g * alpha;
        nc[i * 3 + 2] = b * alpha;
        const pulse =
          node.status === 'conflict'
            ? 1 + Math.sin(t * 2.5) * 0.22
            : node.status === 'uncertain'
              ? 1 + Math.sin(t * 1.4 + node.x * 0.05) * 0.07
              : 1;
        const base = isHov || isSel ? node.radius * 1.45 : node.radius;
        ns[i] = base * dpr * pulse * 2; // radius → diameter for gl.PointSize
      }

      // ── Draw ──────────────────────────────────────────────────────────────
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);

      if (ei > 0) {
        gl.useProgram(edgeProg);
        gl.uniform2f(edgeResLocRef.current!, w, h);
        gl.bindVertexArray(edgeVaoRef.current!);
        gl.bindBuffer(gl.ARRAY_BUFFER, edgeBufRef.current!);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, ep.subarray(0, ei));
        gl.drawArrays(gl.LINES, 0, ei / 2);
        gl.bindVertexArray(null);
      }

      if (n > 0) {
        gl.useProgram(nodeProg);
        gl.uniform2f(nodeResLocRef.current!, w, h);
        gl.bindVertexArray(nodeVaoRef.current!);

        gl.bindBuffer(gl.ARRAY_BUFFER, nodePosBufRef.current!);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, np.subarray(0, n * 2));
        gl.bindBuffer(gl.ARRAY_BUFFER, nodeColBufRef.current!);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, nc.subarray(0, n * 3));
        gl.bindBuffer(gl.ARRAY_BUFFER, nodeSizeBufRef.current!);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, ns.subarray(0, n));

        gl.drawArrays(gl.POINTS, 0, n);
        gl.bindVertexArray(null);
      }

      frameRef.current++;
      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafRef.current);
      gl.deleteProgram(edgeProg);
      gl.deleteProgram(nodeProg);
      gl.deleteVertexArray(edgeVaoRef.current);
      gl.deleteVertexArray(nodeVaoRef.current);
      gl.deleteBuffer(edgeBufRef.current);
      gl.deleteBuffer(nodePosBufRef.current);
      gl.deleteBuffer(nodeColBufRef.current);
      gl.deleteBuffer(nodeSizeBufRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // state via refs only — intentionally no deps

  // ── JSX ──────────────────────────────────────────────────────────────────
  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden bg-black"
      style={{ cursor: tooltip ? 'pointer' : 'crosshair' }}
    >
      <canvas
        ref={canvasRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
        style={{ display: 'block', width: '100%', height: '100%' }}
      />

      {/* Single DOM tooltip — repositioned on hover, never re-mounted */}
      {tooltip && (
        <div
          className="pointer-events-none absolute font-mono text-[10px] leading-relaxed z-10"
          style={{
            left: tooltip.x + 16,
            top: tooltip.y - 10,
            background: 'rgba(0,0,0,0.88)',
            border: '1px solid rgba(255,255,255,0.1)',
            padding: '6px 10px',
            color: 'rgba(255,255,255,0.8)',
            whiteSpace: 'nowrap',
          }}
        >
          <div style={{ color: 'rgba(255,255,255,0.35)', marginBottom: 2 }}>
            {tooltip.node.type}
          </div>
          <div style={{ color: '#fff', fontWeight: 600 }}>{tooltip.node.label}</div>
          <div style={{ marginTop: 4, color: 'rgba(255,255,255,0.35)' }}>
            confidence:{' '}
            <span
              style={{
                color:
                  tooltip.node.confidence >= 0.65
                    ? '#22c55e'
                    : tooltip.node.confidence >= 0.4
                      ? '#eab308'
                      : '#ef4444',
              }}
            >
              {tooltip.node.confidence.toFixed(2)}
            </span>
          </div>
          {tooltip.node.sources != null && (
            <div style={{ color: 'rgba(255,255,255,0.35)' }}>sources: {tooltip.node.sources}</div>
          )}
          <div style={{ marginTop: 2, color: 'rgba(255,255,255,0.25)' }}>
            status:{' '}
            <span
              style={{
                color:
                  tooltip.node.status === 'confirmed'
                    ? '#22c55e'
                    : tooltip.node.status === 'conflict'
                      ? '#ef4444'
                      : tooltip.node.status === 'uncertain'
                        ? '#eab308'
                        : 'rgba(255,255,255,0.3)',
              }}
            >
              {tooltip.node.status}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
