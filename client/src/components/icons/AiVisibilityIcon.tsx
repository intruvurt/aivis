import React from "react";

type IconProps = {
  className?: string;
  size?: number;
};

export function AiVisibilityIcon({ className = "", size = 24 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      <rect x="4" y="5" width="16" height="14" rx="3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 12c2.1-3.1 5.1-4.7 9-4.7s6.9 1.6 9 4.7c-2.1 3.1-5.1 4.7-9 4.7S5.1 15.1 3 12Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="2" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="8" cy="9" r="0.8" fill="currentColor" />
      <circle cx="16" cy="15" r="0.8" fill="currentColor" />
    </svg>
  );
}
