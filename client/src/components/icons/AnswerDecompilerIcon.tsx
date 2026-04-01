import React from "react";

type IconProps = {
  className?: string;
  size?: number;
};

export function AnswerDecompilerIcon({ className = "", size = 24 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      <rect x="4" y="5" width="8" height="14" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <rect x="14" y="5" width="6" height="4" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
      <rect x="14" y="10.5" width="6" height="3.5" rx="1.2" stroke="currentColor" strokeWidth="1.8" />
      <rect x="14" y="15.5" width="6" height="3.5" rx="1.2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M7 8.2h2.8M7 11.2h2.8M7 14.2h2.8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M12 12h2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
