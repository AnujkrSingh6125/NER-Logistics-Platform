'use client';

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/context/AuthContext';
import { usePathname } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function AuthGuard({ children }) {
  const { user, nodalOfficer, loading: authLoading } = useAuth();
  const pathname = usePathname();
  const [isReady, setIsReady] = useState(false);
  const currentUserIdRef = useRef(null);

  useEffect(() => {
    let isMounted = true;

    // 1. Initial session check
    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      if (!isMounted) return;
      currentUserIdRef.current = initialSession?.user?.id || null;
      setIsReady(true);
    });

    // 2. Auth listener with ID diffing to prevent unnecessary renders & remounts
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      const newUserId = currentSession?.user?.id || null;
      if (currentUserIdRef.current !== newUserId) {
        currentUserIdRef.current = newUserId;
        if (isMounted) setIsReady(true);
      }
    });

    return () => {
      isMounted = false;
      subscription?.unsubscribe();
    };
  }, []);

  const isAuthRoute = pathname.startsWith('/login') || 
                      pathname.startsWith('/nodal-login') || 
                      pathname.startsWith('/auth');

  // If on public login / registration page, allow immediate render without blocking
  if (isAuthRoute) {
    return <>{children}</>;
  }

  // Smooth pass-through without layout unmounting
  return <>{children}</>;
}
