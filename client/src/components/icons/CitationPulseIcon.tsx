import React from "react";

type IconProps = {
  className?: string;
  size?: number;
};

export function CitationPulseIcon({ className = "", size = 24 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.8" />
      <path d="M7.5 9.3h2.1l-1 2.3h1V15H7.2v-3l1.2-2.7ZM12.8 9.3h2.1l-1 2.3h1V15h-2.4v-3l1.2-2.7Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M5 17.2h3l1.1-1.4 1.6 2.1 1.8-3 1.4 2h3.1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
