'use client';

import React, { Suspense } from 'react';
import LoginPage from '@/app/login/page';
import { Loader2 } from 'lucide-react';

export default function NodalLoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#070d18] flex items-center justify-center text-amber-400"><Loader2 className="w-8 h-8 animate-spin" /></div>}>
      <LoginPage defaultPortal="nodal" />
    </Suspense>
  );
}
