import React from "react";

type IconProps = {
  className?: string;
  size?: number;
};

export function AuditEngineIcon({ className = "", size = 24 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      <rect x="5" y="5" width="14" height="14" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 8.5h8M8 12h5M8 15.5h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M19 7.5h2M19 12h2M19 16.5h2M3 7.5h2M3 12h2M3 16.5h2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity="0.85" />
      <circle cx="15.8" cy="15.5" r="1" fill="currentColor" />
    </svg>
  );
}
