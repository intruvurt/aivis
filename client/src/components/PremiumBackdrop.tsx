import React from 'react';

export default function PremiumBackdrop() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden="true">
      <div className="absolute inset-0 opacity-[0.45] dark:opacity-[0.38]">
        <div className="absolute -top-16 -left-24 w-[42rem] h-[18rem] rotate-[-12deg] rounded-[3rem] bg-gradient-to-r from-white/[0.14] via-white/[0.07] to-transparent" />
        <div className="absolute top-[18%] -right-32 w-[38rem] h-[14rem] rotate-[-14deg] rounded-[3rem] bg-gradient-to-l from-white/[0.12] via-white/[0.06] to-transparent" />
        <div className="absolute bottom-[-7rem] left-[12%] w-[44rem] h-[16rem] rotate-[-10deg] rounded-[3rem] bg-gradient-to-r from-white/[0.10] via-white/[0.05] to-transparent" />
      </div>

      <svg
        className="absolute inset-0 h-full w-full opacity-[0.14] dark:opacity-[0.08]"
        viewBox="0 0 1600 1000"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="gridStroke" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="rgba(255,255,255,0.35)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0.08)" />
          </linearGradient>
        </defs>
        {Array.from({ length: 18 }).map((_, i) => (
          <line
            key={`v-${i}`}
            x1={i * 100}
            y1="0"
            x2={i * 60 + 280}
            y2="1000"
            stroke="url(#gridStroke)"
            strokeWidth="0.7"
          />
        ))}
        {Array.from({ length: 10 }).map((_, i) => (
          <line
            key={`h-${i}`}
            x1="0"
            y1={i * 120}
            x2="1600"
            y2={i * 120 + 65}
            stroke="url(#gridStroke)"
            strokeWidth="0.6"
          />
        ))}
      </svg>
    </div>
  );
}
