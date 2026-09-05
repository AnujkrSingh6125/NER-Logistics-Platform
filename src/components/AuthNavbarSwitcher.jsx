'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Truck, Shield } from 'lucide-react';

export default function AuthNavbarSwitcher() {
  const pathname = usePathname();
  const router = useRouter();
  const isNodal = pathname?.includes('nodal');

  return (
    <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-full text-xs font-mono select-none">
      {/* Driver Login Button */}
      <Link
        href="/login"
        onClick={(e) => {
          if (!isNodal) {
            e.preventDefault();
          }
        }}
        className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full transition-all cursor-pointer ${
          !isNodal
            ? 'bg-cyan-500 text-slate-950 font-bold shadow-md shadow-cyan-500/20'
            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800/60'
        }`}
      >
        <Truck className="w-3.5 h-3.5 shrink-0" />
        <span>Driver Login</span>
      </Link>

      {/* Nodal Portal Button */}
      <Link
        href="/nodal-login"
        onClick={(e) => {
          if (isNodal) {
            e.preventDefault();
          }
        }}
        className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full transition-all cursor-pointer ${
          isNodal
            ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20'
            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800/60'
        }`}
      >
        <Shield className="w-3.5 h-3.5 shrink-0" />
        <span>Nodal Portal</span>
      </Link>
    </div>
  );
}
