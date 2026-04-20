import React from 'react';

// Cloudflare brand: #F38020 orange + #FBAD41 lighter accent

type CloudflareBadgeProps = {
  className?: string;
  /** "sidebar" = compact horizontal, "footer" = small inline, "card" = full-width block */
  variant?: 'sidebar' | 'footer' | 'card';
};

export function CloudflareBadge({ className = '', variant = 'sidebar' }: CloudflareBadgeProps) {
  if (variant === 'footer') {
    return (
      <a
        href="https://www.cloudflare.com"
        target="_blank"
        rel="noopener noreferrer"
        className={`inline-flex items-center gap-1.5 opacity-50 hover:opacity-80 transition-opacity ${className}`}
        aria-label="Protected by Cloudflare"
      >
        <CloudflareIcon size={14} />
        <span className="text-[10px] text-metal-dim tracking-wide font-mono">
          Protected by Cloudflare
        </span>
      </a>
    );
  }

  if (variant === 'card') {
    return (
      <div
        className={`flex items-center gap-3 rounded-xl border border-border bg-surface-base px-4 py-3 ${className}`}
      >
        <CloudflareIcon size={22} />
        <div className="flex flex-col">
          <span className="text-xs font-semibold text-metal-silver leading-tight">
            Protected by Cloudflare
          </span>
          <span className="text-[10px] text-metal-dim leading-tight">
            DDoS mitigation · CDN · Zero Trust
          </span>
        </div>
      </div>
    );
  }

  // sidebar (default) — matches CodeTrendy badge slot
  return (
    <a
      href="https://www.cloudflare.com"
      target="_blank"
      rel="noopener noreferrer"
      className={`
        group flex items-center gap-2
        w-full rounded-lg px-3 py-2
        border border-transparent
        hover:border-border hover:bg-surface-raised
        transition-all duration-200
        opacity-50 hover:opacity-100
        ${className}
      `}
      aria-label="Protected by Cloudflare"
    >
      <CloudflareIcon size={18} />
      <div className="flex flex-col leading-none">
        <span className="text-[9px] uppercase tracking-widest text-metal-dim font-mono">
          Protected by
        </span>
        <span className="text-[11px] font-semibold text-metal-silver tracking-wide">
          Cloudflare
        </span>
      </div>
    </a>
  );
}

// ── Inline SVG — Cloudflare logo mark (the cloud + ray icon) ─────────────────

function CloudflareIcon({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Cloud body */}
      <path
        d="M43.6 26.4c-.3-4.7-4.2-8.4-9-8.4-3.2 0-6 1.7-7.6 4.2-.7-.4-1.5-.6-2.4-.6-2.6 0-4.7 2.1-4.7 4.7v.1c-2.9.5-5.1 3-5.1 6.1 0 3.4 2.8 6.2 6.2 6.2h21.3c3.1 0 5.6-2.5 5.6-5.6 0-2.9-2.1-5.2-4.8-5.7H43.6z"
        fill="#F38020"
      />
      {/* Lighter top accent */}
      <path
        d="M40.4 24.3c-.1-.4-.1-.7-.1-1.1 0-4.7-3.8-8.5-8.5-8.5-3.7 0-6.8 2.3-8 5.6-.5-.1-1-.2-1.6-.2-3.5 0-6.3 2.8-6.3 6.3 0 .3 0 .6.1.9.1-.1 0-.1 0-.1 0-2.6 2.1-4.7 4.7-4.7.9 0 1.7.2 2.4.6 1.6-2.5 4.4-4.2 7.6-4.2 4.8 0 8.7 3.7 9 8.4h.1c2.7.4 4.8 2.8 4.8 5.7 0 .3 0 .6-.1.9 1.5-1 2.5-2.7 2.5-4.7 0-2.6-1.8-4.8-4.3-5.5l-.3-.4z"
        fill="#FBAD41"
        opacity="0.8"
      />
      {/* Ray / speed mark */}
      <path d="M34 36.7l-2 5.3H26l4-5.3H34z" fill="#F38020" opacity="0.6" />
      <path d="M38 36.7l-2.5 5.3h-3.8l2.3-5.3H38z" fill="#F38020" opacity="0.4" />
    </svg>
  );
}
