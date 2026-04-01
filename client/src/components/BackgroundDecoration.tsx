import React from "react";

/**
 * BackgroundDecoration — crisp abstract geometric shapes: circles, compass roses,
 * search/find motifs, diagonal grids, and digital-web patterns scattered across
 * the viewport. Randomized positions, sizes, and rotations create a unique
 * structural-integrity aesthetic. Uses charcoal/silver/white at low opacity.
 */
const BackgroundDecoration = () => (
  <div
    id="src_components_BackgroundDecoration_bg01"
    className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
    aria-hidden="true"
  >
    {/* ── CIRCULAR & RING ELEMENTS ─────────────────────────── */}

    {/* Large hollow circle — top left */}
    <svg className="absolute" style={{ top: "1%", left: "2%", opacity: 0.14 }}
      width="200" height="200" viewBox="0 0 200 200">
      <circle cx="100" cy="100" r="90" fill="none" stroke="rgba(80,90,110,0.7)" strokeWidth="3" />
      <circle cx="100" cy="100" r="70" fill="none" stroke="rgba(80,90,110,0.4)" strokeWidth="1" strokeDasharray="6 4" />
    </svg>

    {/* Small solid circle — top right cluster */}
    <svg className="absolute" style={{ top: "4%", right: "8%", opacity: 0.16 }}
      width="28" height="28" viewBox="0 0 28 28">
      <circle cx="14" cy="14" r="14" fill="rgba(60,70,90,0.5)" />
    </svg>

    {/* Double ring — right side upper */}
    <svg className="absolute" style={{ top: "12%", right: "3%", opacity: 0.14 }}
      width="120" height="120" viewBox="0 0 120 120">
      <circle cx="60" cy="60" r="54" fill="none" stroke="rgba(70,85,110,0.6)" strokeWidth="2" />
      <circle cx="60" cy="60" r="38" fill="none" stroke="rgba(70,85,110,0.35)" strokeWidth="1.5" />
    </svg>

    {/* Tiny dot cluster — scattered top-center */}
    <svg className="absolute" style={{ top: "6%", left: "38%", opacity: 0.20 }}
      width="60" height="60" viewBox="0 0 60 60">
      <circle cx="8" cy="8" r="3" fill="rgba(50,60,80,0.6)" />
      <circle cx="30" cy="12" r="2.5" fill="rgba(50,60,80,0.4)" />
      <circle cx="52" cy="6" r="3.5" fill="rgba(50,60,80,0.5)" />
      <circle cx="18" cy="38" r="2" fill="rgba(50,60,80,0.35)" />
      <circle cx="44" cy="42" r="3" fill="rgba(50,60,80,0.45)" />
      <circle cx="8" cy="54" r="2.5" fill="rgba(50,60,80,0.3)" />
      <circle cx="52" cy="52" r="2" fill="rgba(50,60,80,0.4)" />
    </svg>

    {/* ── COMPASS / SEARCH MOTIFS ──────────────────────────── */}

    {/* Compass rose — upper-left */}
    <svg className="absolute" style={{ top: "16%", left: "6%", opacity: 0.14, transform: "rotate(15deg)" }}
      width="100" height="100" viewBox="0 0 100 100">
      <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(70,85,110,0.5)" strokeWidth="1.5" />
      <line x1="50" y1="4" x2="50" y2="96" stroke="rgba(60,70,90,0.3)" strokeWidth="1" />
      <line x1="4" y1="50" x2="96" y2="50" stroke="rgba(60,70,90,0.3)" strokeWidth="1" />
      <line x1="15" y1="15" x2="85" y2="85" stroke="rgba(60,70,90,0.2)" strokeWidth="0.8" />
      <line x1="85" y1="15" x2="15" y2="85" stroke="rgba(60,70,90,0.2)" strokeWidth="0.8" />
      <circle cx="50" cy="50" r="6" fill="rgba(60,70,90,0.25)" />
      <polygon points="50,10 53,44 50,48 47,44" fill="rgba(70,85,110,0.5)" />
    </svg>

    {/* Search/magnifier — center-right */}
    <svg className="absolute" style={{ top: "28%", right: "6%", opacity: 0.13, transform: "rotate(-20deg)" }}
      width="90" height="90" viewBox="0 0 90 90">
      <circle cx="38" cy="38" r="28" fill="none" stroke="rgba(80,95,120,0.6)" strokeWidth="3" />
      <line x1="58" y1="58" x2="82" y2="82" stroke="rgba(80,95,120,0.6)" strokeWidth="4" strokeLinecap="round" />
      <circle cx="38" cy="38" r="16" fill="none" stroke="rgba(80,95,120,0.25)" strokeWidth="1" strokeDasharray="4 3" />
    </svg>

    {/* Crosshair/target — mid-left */}
    <svg className="absolute" style={{ top: "40%", left: "3%", opacity: 0.13 }}
      width="80" height="80" viewBox="0 0 80 80">
      <circle cx="40" cy="40" r="32" fill="none" stroke="rgba(65,80,105,0.5)" strokeWidth="1.5" />
      <circle cx="40" cy="40" r="20" fill="none" stroke="rgba(65,80,105,0.35)" strokeWidth="1" />
      <circle cx="40" cy="40" r="8" fill="none" stroke="rgba(65,80,105,0.5)" strokeWidth="1.5" />
      <line x1="40" y1="2" x2="40" y2="78" stroke="rgba(60,70,90,0.15)" strokeWidth="0.8" />
      <line x1="2" y1="40" x2="78" y2="40" stroke="rgba(60,70,90,0.15)" strokeWidth="0.8" />
    </svg>

    {/* Small compass — bottom-right */}
    <svg className="absolute" style={{ top: "72%", right: "5%", opacity: 0.13, transform: "rotate(30deg)" }}
      width="70" height="70" viewBox="0 0 70 70">
      <circle cx="35" cy="35" r="30" fill="none" stroke="rgba(70,85,110,0.5)" strokeWidth="1.5" />
      <line x1="35" y1="3" x2="35" y2="67" stroke="rgba(60,70,90,0.25)" strokeWidth="0.8" />
      <line x1="3" y1="35" x2="67" y2="35" stroke="rgba(60,70,90,0.25)" strokeWidth="0.8" />
      <polygon points="35,7 37,30 35,33 33,30" fill="rgba(70,85,110,0.45)" />
      <circle cx="35" cy="35" r="4" fill="rgba(60,70,90,0.2)" />
    </svg>

    {/* ── GEOMETRIC SHAPES ─────────────────────────────────── */}

    {/* Hexagon — upper-right area */}
    <svg className="absolute" style={{ top: "8%", right: "22%", opacity: 0.12 }}
      width="80" height="70" viewBox="0 0 80 70">
      <polygon points="40,2 76,19 76,53 40,70 4,53 4,19" fill="none" stroke="rgba(75,90,115,0.6)" strokeWidth="2" />
    </svg>

    {/* Diamond — left side mid */}
    <svg className="absolute" style={{ top: "32%", left: "14%", opacity: 0.13, transform: "rotate(45deg)" }}
      width="55" height="55" viewBox="0 0 55 55">
      <rect x="4" y="4" width="47" height="47" rx="4" fill="none" stroke="rgba(75,90,115,0.5)" strokeWidth="2" />
    </svg>

    {/* Triangle —  center area */}
    <svg className="absolute" style={{ top: "48%", left: "52%", opacity: 0.11, transform: "rotate(-8deg)" }}
      width="90" height="78" viewBox="0 0 90 78">
      <polygon points="45,4 86,74 4,74" fill="none" stroke="rgba(70,85,110,0.5)" strokeWidth="2" />
    </svg>

    {/* Rounded rectangle — right mid */}
    <svg className="absolute" style={{ top: "55%", right: "10%", opacity: 0.11, transform: "rotate(8deg)" }}
      width="120" height="50" viewBox="0 0 120 50">
      <rect x="2" y="2" width="116" height="46" rx="14" fill="none" stroke="rgba(75,90,115,0.45)" strokeWidth="2" />
    </svg>

    {/* Pentagon — bottom-left */}
    <svg className="absolute" style={{ top: "78%", left: "8%", opacity: 0.12 }}
      width="70" height="66" viewBox="0 0 70 66">
      <polygon points="35,2 68,24 56,62 14,62 2,24" fill="none" stroke="rgba(70,85,110,0.5)" strokeWidth="1.5" />
    </svg>

    {/* ── GRID / DIGITAL WEB PATTERNS ──────────────────────── */}

    {/* Dot grid pattern — upper mid */}
    <svg className="absolute" style={{ top: "22%", left: "30%", opacity: 0.12 }}
      width="140" height="100" viewBox="0 0 140 100">
      {[0,1,2,3,4,5,6].map(col =>
        [0,1,2,3,4].map(row => (
          <circle key={`${col}-${row}`} cx={10 + col * 20} cy={10 + row * 20} r="1.5" fill="rgba(50,60,80,0.45)" />
        ))
      )}
    </svg>

    {/* Diagonal grid mesh — center */}
    <svg className="absolute" style={{ top: "44%", left: "24%", opacity: 0.08, transform: "rotate(12deg)" }}
      width="160" height="120" viewBox="0 0 160 120">
      {[0,1,2,3,4,5,6,7].map(i => (
        <line key={`d1-${i}`} x1={i*20} y1="0" x2={i*20+60} y2="120" stroke="rgba(65,80,105,0.4)" strokeWidth="0.6" />
      ))}
      {[0,1,2,3,4,5].map(i => (
        <line key={`d2-${i}`} x1="0" y1={i*20} x2="160" y2={i*20} stroke="rgba(65,80,105,0.3)" strokeWidth="0.5" />
      ))}
    </svg>

    {/* Concentric circles — bottom center */}
    <svg className="absolute" style={{ top: "82%", left: "40%", opacity: 0.10 }}
      width="140" height="140" viewBox="0 0 140 140">
      <circle cx="70" cy="70" r="65" fill="none" stroke="rgba(65,80,105,0.4)" strokeWidth="1" />
      <circle cx="70" cy="70" r="48" fill="none" stroke="rgba(65,80,105,0.3)" strokeWidth="1" />
      <circle cx="70" cy="70" r="32" fill="none" stroke="rgba(65,80,105,0.25)" strokeWidth="1" />
      <circle cx="70" cy="70" r="16" fill="none" stroke="rgba(65,80,105,0.2)" strokeWidth="1" />
      <circle cx="70" cy="70" r="4" fill="rgba(75,90,110,0.3)" />
    </svg>

    {/* Network web/nodes — lower-left */}
    <svg className="absolute" style={{ top: "62%", left: "4%", opacity: 0.11 }}
      width="120" height="100" viewBox="0 0 120 100">
      <line x1="20" y1="20" x2="60" y2="10" stroke="rgba(65,80,105,0.4)" strokeWidth="0.8" />
      <line x1="60" y1="10" x2="100" y2="30" stroke="rgba(65,80,105,0.4)" strokeWidth="0.8" />
      <line x1="100" y1="30" x2="80" y2="70" stroke="rgba(65,80,105,0.35)" strokeWidth="0.8" />
      <line x1="80" y1="70" x2="40" y2="80" stroke="rgba(65,80,105,0.35)" strokeWidth="0.8" />
      <line x1="40" y1="80" x2="20" y2="20" stroke="rgba(65,80,105,0.3)" strokeWidth="0.8" />
      <line x1="60" y1="10" x2="40" y2="80" stroke="rgba(65,80,105,0.2)" strokeWidth="0.6" />
      <line x1="20" y1="20" x2="100" y2="30" stroke="rgba(65,80,105,0.2)" strokeWidth="0.6" />
      <circle cx="20" cy="20" r="4" fill="rgba(75,90,110,0.4)" />
      <circle cx="60" cy="10" r="3.5" fill="rgba(75,90,110,0.35)" />
      <circle cx="100" cy="30" r="4" fill="rgba(75,90,110,0.4)" />
      <circle cx="80" cy="70" r="3.5" fill="rgba(75,90,110,0.35)" />
      <circle cx="40" cy="80" r="4" fill="rgba(75,90,110,0.4)" />
    </svg>

    {/* ── SUBTLE GLOW ORBS ─────────────────────────────────── */}

    {/* Soft glow — top area */}
    <div className="absolute rounded-full" style={{
      top: "2%", left: "58%", width: "460px", height: "460px",
      background: "radial-gradient(circle, rgba(40,50,70,0.16) 0%, transparent 72%)",
    }} />

    {/* Soft glow — mid area */}
    <div className="absolute rounded-full" style={{
      top: "30%", right: "12%", width: "390px", height: "390px",
      background: "radial-gradient(circle, rgba(45,55,75,0.14) 0%, transparent 72%)",
    }} />

    {/* Soft glow — bottom area */}
    <div className="absolute rounded-full" style={{
      top: "66%", left: "12%", width: "420px", height: "420px",
      background: "radial-gradient(circle, rgba(35,45,65,0.13) 0%, transparent 72%)",
    }} />

    {/* Brand color splash — cyan */}
    <div className="absolute rounded-full" style={{
      top: "8%", left: "10%", width: "520px", height: "520px",
      background: "radial-gradient(circle, rgba(6,182,212,0.20) 0%, rgba(6,182,212,0.10) 35%, transparent 72%)",
      filter: "blur(1px)",
    }} />

    {/* Brand color splash — violet */}
    <div className="absolute rounded-full" style={{
      top: "22%", right: "4%", width: "560px", height: "560px",
      background: "radial-gradient(circle, rgba(124,58,237,0.20) 0%, rgba(124,58,237,0.10) 34%, transparent 72%)",
      filter: "blur(1px)",
    }} />

    {/* Brand color splash — amber */}
    <div className="absolute rounded-full" style={{
      bottom: "-8%", left: "34%", width: "540px", height: "540px",
      background: "radial-gradient(circle, rgba(233,166,52,0.18) 0%, rgba(233,166,52,0.09) 36%, transparent 72%)",
      filter: "blur(1px)",
    }} />

    {/* ── SCATTERED SMALL SHAPES ───────────────────────────── */}

    {/* Tiny circle — left mid */}
    <svg className="absolute" style={{ top: "52%", left: "18%", opacity: 0.18 }}
      width="18" height="18" viewBox="0 0 18 18">
      <circle cx="9" cy="9" r="9" fill="rgba(50,60,80,0.4)" />
    </svg>

    {/* Ring — upper center */}
    <svg className="absolute" style={{ top: "15%", left: "48%", opacity: 0.14 }}
      width="40" height="40" viewBox="0 0 40 40">
      <circle cx="20" cy="20" r="16" fill="none" stroke="rgba(75,90,115,0.6)" strokeWidth="2.5" />
    </svg>

    {/* Plus/cross — right mid */}
    <svg className="absolute" style={{ top: "38%", right: "18%", opacity: 0.13, transform: "rotate(12deg)" }}
      width="40" height="40" viewBox="0 0 40 40">
      <rect x="16" y="2" width="8" height="36" rx="3" fill="rgba(75,90,115,0.5)" />
      <rect x="2" y="16" width="36" height="8" rx="3" fill="rgba(75,90,115,0.5)" />
    </svg>

    {/* Small hexagon — bottom right */}
    <svg className="absolute" style={{ top: "88%", right: "15%", opacity: 0.13 }}
      width="44" height="38" viewBox="0 0 44 38">
      <polygon points="22,2 42,11 42,29 22,38 2,29 2,11" fill="none" stroke="rgba(75,90,115,0.5)" strokeWidth="1.5" />
    </svg>

    {/* Semicircle arc — bottom center-left */}
    <svg className="absolute" style={{ top: "92%", left: "25%", opacity: 0.11 }}
      width="80" height="44" viewBox="0 0 80 44">
      <path d="M 4 40 A 36 36 0 0 1 76 40" fill="none" stroke="rgba(70,85,110,0.5)" strokeWidth="2" />
    </svg>
  </div>
);

export default BackgroundDecoration;
