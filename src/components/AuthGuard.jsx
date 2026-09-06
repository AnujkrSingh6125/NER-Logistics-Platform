'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { usePathname, useRouter } from 'next/navigation';
import { Loader2, Shield } from 'lucide-react';
import MountainLogo from '@/components/MountainLogo';

export default function AuthGuard({ children }) {
  const { user, nodalOfficer, profile, loading: authLoading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isAuthRoute = pathname.startsWith('/login') || 
                      pathname.startsWith('/nodal-login') || 
                      pathname.startsWith('/auth');

  const isAuthenticated = Boolean((user && profile) || nodalOfficer);

  useEffect(() => {
    if (mounted && !authLoading) {
      if (!isAuthenticated && !isAuthRoute) {
        router.replace('/login');
      }
    }
  }, [mounted, authLoading, isAuthenticated, isAuthRoute, router]);

  // If on login / registration pages, render immediately without obstruction
  if (isAuthRoute) {
    return <>{children}</>;
  }

  // If resolving session or unauthenticated on protected features, block view & show security checkpoint
  if (!mounted || authLoading || !isAuthenticated) {
    return (
      <div className="fixed inset-0 z-[99999] bg-[#060b14] text-white flex flex-col items-center justify-center p-6 select-none font-sans">
        <div className="flex flex-col items-center space-y-6 max-w-sm text-center animate-in fade-in zoom-in-95 duration-200">
          <div className="w-16 h-16 rounded-3xl bg-slate-900 border border-slate-800 p-2.5 flex items-center justify-center shadow-2xl shadow-cyan-500/10">
            <MountainLogo className="w-12 h-12 drop-shadow-md" />
          </div>

          <div className="space-y-1.5">
            <h2 className="text-xl font-black tracking-tight text-white font-sans">
              AshtaMarg
            </h2>
            <p className="text-xs text-slate-400 font-mono">
              TACTICAL LOGISTICS & DISASTER COMMAND
            </p>
          </div>

          <div className="w-full bg-slate-900/80 border border-slate-800/80 rounded-2xl p-4 space-y-2.5 backdrop-blur-md">
            <div className="flex items-center justify-center space-x-2 text-cyan-400 text-xs font-mono font-bold">
              <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
              <span>Verifying Security Clearance...</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed font-sans">
              Mandatory authentication required to access live corridor radar, road hazard telemetry, and convoy transit ops.
            </p>
          </div>

          <div className="flex items-center space-x-1.5 text-[10px] font-mono text-slate-500">
            <Shield className="w-3 h-3 text-cyan-500/70" />
            <span>AES-256 RLS Hardened Platform</span>
          </div>
        </div>
      </div>
    );
  }

  // Authenticated: Render full platform features
  return <>{children}</>;
}
