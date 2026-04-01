import React from "react";

type IconProps = {
  className?: string;
  size?: number;
};

export function ContentBlueprintIcon({ className = "", size = 24 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      <rect x="4" y="4" width="16" height="16" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 8h8M8 11h5M8 14h8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M7 18V6M17 18V6" stroke="currentColor" strokeWidth="1.1" opacity="0.65" />
      <circle cx="8" cy="16.5" r="0.9" fill="currentColor" />
      <circle cx="16" cy="16.5" r="0.9" fill="currentColor" />
      <path d="M8.9 16.5h6.2" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}
