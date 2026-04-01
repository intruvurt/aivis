import React from "react";

type IconProps = {
  className?: string;
  size?: number;
};

export function ScoreFixIcon({ className = "", size = 24 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      <path d="M12 3.3 18 5.7v5.6c0 4.1-2.4 7.8-6 9.5-3.6-1.7-6-5.4-6-9.5V5.7L12 3.3Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M8 12.4h3.1l1.1-2.4h3.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="8" cy="12.4" r="1" fill="currentColor" />
      <circle cx="12.2" cy="10" r="1" fill="currentColor" />
      <circle cx="16" cy="10" r="1" fill="currentColor" />
      <path d="M9.2 15.5h5.6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}
