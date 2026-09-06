'use client';

import React from 'react';
import Image from 'next/image';

export default function MountainLogo({ className = 'w-8 h-8', alt = 'AshtaMarg Logo' }) {
  return (
    <div className={`relative flex items-center justify-center shrink-0 ${className}`}>
      <Image
        src="/logo.png"
        alt={alt}
        fill
        sizes="(max-width: 768px) 48px, 64px"
        className="object-contain drop-shadow-xs"
        priority
      />
    </div>
  );
}
