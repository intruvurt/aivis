import React from "react";

type IconProps = {
  className?: string;
  size?: number;
};

export function CompetitorRadarIcon({ className = "", size = 24 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      <path d="M12 4v8l5.8 3.3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="7.5" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="4.5" stroke="currentColor" strokeWidth="1.2" opacity="0.7" />
      <circle cx="18.4" cy="8" r="1.2" fill="currentColor" />
      <circle cx="16.9" cy="15.6" r="1" fill="currentColor" opacity="0.9" />
      <circle cx="8.2" cy="17.6" r="1" fill="currentColor" opacity="0.75" />
    </svg>
  );
}
