import React from "react";

const generateStyles = () => {
  // Random placements, sizes, opacities for abstract images
  const count = 12; // number of images
  const styles = [];
  for (let i = 0; i < count; i++) {
    const size = Math.floor(Math.random() * 300) + 200;
    const top = Math.floor(Math.random() * 100);
    const left = Math.floor(Math.random() * 100);
    const opacity = (Math.random() * 0.12 + 0.06).toFixed(2); // 0.06–0.18 range
    const brightness = (Math.random() * 0.4 + 0.5).toFixed(2); // 0.5–0.9
    const blur = Math.floor(Math.random() * 6 + 3); // 3–8px
    styles.push({
      position: "absolute" as const,
      top: `${top}%`,
      left: `${left}%`,
      width: `${size}px`,
      height: "auto",
      opacity,
      filter: `brightness(${brightness}) blur(${blur}px)`,
      pointerEvents: "none" as const,
      userSelect: "none" as const,
      zIndex: 0
    });
  }
  return styles;
};

const bgStyles: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  width: "100vw",
  height: "100vh",
  overflow: "hidden",
  zIndex: 0,
  pointerEvents: "none"
};

// Warm accent palette — sanguine, olive-lime, coral, amber (no neon)
const ORBS = [
  (a: number) => `radial-gradient(circle, rgba(176,81,70,${a})  0%, transparent 70%)`,
  (a: number) => `radial-gradient(circle, rgba(130,175,40,${a}) 0%, transparent 70%)`,
  (a: number) => `radial-gradient(circle, rgba(225,110,85,${a}) 0%, transparent 70%)`,
  (a: number) => `radial-gradient(circle, rgba(204,155,42,${a}) 0%, transparent 70%)`,
];

const Background = () => {
  const styles = React.useMemo(() => generateStyles(), []);
  return (
    <div id="src_components_Background_gen0" style={bgStyles} aria-hidden="true">
      {styles.map((style, i) => (
        <div
          id={`src_components_Background_orb_${i}`}
          style={{
            ...style,
            background: ORBS[i % ORBS.length](Number(style.opacity)),
            borderRadius: '50%',
            width: style.width,
            height: style.width
          }}
          key={`cosmo-bg-${i}`}
        />
      ))}
    </div>
  );
};

export default Background;
