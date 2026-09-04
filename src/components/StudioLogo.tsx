import React from 'react';

interface StudioLogoProps {
  className?: string;
  size?: number;
}

export const StudioLogo: React.FC<StudioLogoProps> = ({
  className = 'w-7 h-7',
  size = 28,
}) => {
  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 ${className}`}
      style={{ width: size, height: size }}
      title="Data Studio by PJA"
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 28 28"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="drop-shadow-sm transition-transform duration-200 hover:scale-105"
      >
        <defs>
          <linearGradient id="pja-grad-1" x1="2" y1="2" x2="26" y2="26" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#3B82F6" />
            <stop offset="50%" stopColor="#6366F1" />
            <stop offset="100%" stopColor="#8B5CF6" />
          </linearGradient>
          <linearGradient id="pja-accent" x1="14" y1="4" x2="14" y2="24" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#60A5FA" />
            <stop offset="100%" stopColor="#A78BFA" />
          </linearGradient>
        </defs>

        {/* Outer Prism Facets */}
        <path
          d="M14 2L25 8.5V19.5L14 26L3 19.5V8.5L14 2Z"
          fill="url(#pja-grad-1)"
          opacity="0.95"
        />
        
        {/* Inner Isometric Cube / Analytical Diamond */}
        <path
          d="M14 2L25 8.5L14 15L3 8.5L14 2Z"
          fill="#FFFFFF"
          fillOpacity="0.25"
        />
        <path
          d="M14 15L25 8.5V19.5L14 26V15Z"
          fill="#000000"
          fillOpacity="0.15"
        />
        <path
          d="M14 15L3 8.5V19.5L14 26V15Z"
          fill="#FFFFFF"
          fillOpacity="0.1"
        />

        {/* Center Sparkle Pulse */}
        <circle cx="14" cy="14" r="3" fill="#FFFFFF" fillOpacity="0.9" />
        <circle cx="14" cy="14" r="1.5" fill="#3B82F6" />
      </svg>
    </div>
  );
};
