'use client';

import React from 'react';

export default function MountainLogo({ className = 'w-8 h-8' }) {
  return (
    <svg
      viewBox="0 0 100 80"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id="nerMountainGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#0284c7" />
          <stop offset="100%" stopColor="#2563eb" />
        </linearGradient>
        <linearGradient id="nerMountainGrad2" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="100%" stopColor="#0284c7" />
        </linearGradient>
      </defs>

      {/* Main Left Peak */}
      <path
        d="M10 70 L38 18 L58 52 L48 68 L10 70 Z"
        fill="url(#nerMountainGrad1)"
      />
      {/* Main Center/Right High Peak */}
      <path
        d="M38 18 L68 6 L90 70 L58 52 L38 18 Z"
        fill="url(#nerMountainGrad2)"
      />
      {/* Front Accent Ridge */}
      <path
        d="M24 70 L48 34 L64 60 L78 70 Z"
        fill="#0369a1"
        opacity="0.85"
      />
      {/* Inner Valley Cut */}
      <polygon
        points="48,34 58,52 38,52"
        fill="#ffffff"
        opacity="0.2"
      />
    </svg>
  );
}
