import React from 'react';

// --- Crypto RNG helpers (browser / Web Crypto) ---
const cryptoObj: Crypto = globalThis.crypto;

// Uniform float in [0, 1)
function cryptoRandFloat01(): number {
  const buf = new Uint32Array(1);
  cryptoObj.getRandomValues(buf);
  // 2^32 = 4294967296
  return buf[0] / 4294967296;
}

// Uniform int in [min, max] (inclusive), unbiased via rejection sampling
function randInt(min: number, max: number): number {
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    throw new Error('randInt: min/max must be finite numbers');
  }
  min = Math.ceil(min);
  max = Math.floor(max);
  if (max < min) [min, max] = [max, min];

  const range = max - min + 1;
  if (range <= 0) return min;

  // Avoid modulo bias:
  // We only accept values < limit, where limit is the largest multiple of range <= 2^32 - 1
  const limit = Math.floor(4294967296 / range) * range; // 2^32
  const buf = new Uint32Array(1);

  while (true) {
    cryptoObj.getRandomValues(buf);
    const x = buf[0];
    if (x < limit) return min + (x % range);
  }
}

// Utility to generate a random gray color
function randGray() {
  const v = randInt(17, 238); // #111 to #eee
  return `rgb(${v},${v},${v})`;
}

// Generate random polygons and circles
function generateShapes(count: number, width: number, height: number) {
  const shapes: React.ReactNode[] = [];

  for (let i = 0; i < count; i++) {
    const type = cryptoRandFloat01() > 0.5 ? 'polygon' : 'circle';

    if (type === 'polygon') {
      const points = Array.from({ length: randInt(3, 7) }, () => {
        return `${randInt(0, width)},${randInt(0, height)}`;
      }).join(' ');

      shapes.push(
        <polygon
          key={`poly-${i}`}
          points={points}
          fill={randGray()}
          opacity={cryptoRandFloat01() * 0.5 + 0.2}
        />
      );
    } else {
      shapes.push(
        <circle
          key={`circle-${i}`}
          cx={randInt(0, width)}
          cy={randInt(0, height)}
          r={randInt(20, 120)}
          fill={randGray()}
          opacity={cryptoRandFloat01() * 0.5 + 0.2}
        />
      );
    }
  }

  return shapes;
}

const AbstractBackground: React.FC = () => {
  const width = 1920;
  const height = 1080;
  const shapes = generateShapes(18, width, height);

  return (
    <svg
      className="fixed inset-0 w-full h-full -z-10 pointer-events-none"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
      style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: -10 }}
    >
      {shapes}
    </svg>
  );
};

export default AbstractBackground;
