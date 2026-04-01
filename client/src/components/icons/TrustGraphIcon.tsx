import React from "react";

type IconProps = {
  className?: string;
  size?: number;
};

export function TrustGraphIcon({ className = "", size = 24 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      <path d="M12 7.5v3.2M8 15h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="12" cy="6" r="2" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="7" cy="16.5" r="2" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="17" cy="16.5" r="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M10.4 7.1 8.3 14.9M13.6 7.1l2.1 7.8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M12 3.2 16.5 5v4.2c0 3.1-1.8 5.9-4.5 7.2-2.7-1.3-4.5-4.1-4.5-7.2V5L12 3.2Z" stroke="currentColor" strokeWidth="1.2" opacity="0.55" />
    </svg>
  );
}
