'use client';

import React, { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useNav } from '@/context/NavContext';
import { useAuth } from '@/context/AuthContext';
import { 
  Compass, 
  AlertTriangle, 
  Warehouse, 
  Truck, 
  Plus,
  ShieldAlert,
  Radio
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';

export default function MobileBottomNav({ onOpenReportHazard }) {
  const { currentView, setCurrentView } = useNav();
  const { user, nodalOfficer, profile } = useAuth();
  const pathname = usePathname();
  const [activeHazardCount, setActiveHazardCount] = useState(0);

  const isAuthPage = pathname.startsWith('/login') || pathname.startsWith('/nodal-login');
  const isAuthenticated = Boolean(user || nodalOfficer || profile);

  // Fetch active hazard count for real-time badge
  useEffect(() => {
    let mounted = true;
    async function fetchHazardsCount() {
      try {
        const { count, error } = await supabase
          .from('road_hazards')
          .select('*', { count: 'exact', head: true })
          .neq('status', 'resolved');

        if (!error && count != null && mounted) {
          setActiveHazardCount(count);
        }
      } catch (e) {}
    }

    fetchHazardsCount();

    const channel = supabase
      .channel('mobile_bottom_nav_hazards')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'road_hazards' },
        () => {
          fetchHazardsCount();
        }
      )
      .subscribe();

    const handleLocalUpdate = () => fetchHazardsCount();
    if (typeof window !== 'undefined') {
      window.addEventListener('ner_hazard_reported', handleLocalUpdate);
      window.addEventListener('ner_hazard_deleted', handleLocalUpdate);
    }

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
      if (typeof window !== 'undefined') {
        window.removeEventListener('ner_hazard_reported', handleLocalUpdate);
        window.removeEventListener('ner_hazard_deleted', handleLocalUpdate);
      }
    };
  }, []);

  if (isAuthPage || !isAuthenticated) return null;

  const navTabs = [
    { id: 'command', label: 'Radar Map', icon: Compass },
    { id: 'hazards', label: 'Hazards', icon: AlertTriangle, badge: activeHazardCount },
    { id: 'report', label: 'Report', isAction: true },
    { id: 'hubs', label: 'Hubs', icon: Warehouse },
    { id: 'shipments', label: 'Convoys', icon: Truck },
  ];

  return (
    <nav 
      className="md:hidden fixed bottom-0 inset-x-0 z-[1000] bg-white/95 dark:bg-slate-950/95 backdrop-blur-xl border-t border-slate-200/90 dark:border-slate-800/90 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1.5 shadow-[0_-4px_25px_rgba(0,0,0,0.12)] select-none font-mono"
      aria-label="Mobile Bottom Navigation"
    >
      <div className="flex items-center justify-around max-w-md mx-auto relative">
        {navTabs.map((tab) => {
          if (tab.isAction) {
            return (
              <div key={tab.id} className="relative -top-5 flex flex-col items-center">
                <button
                  type="button"
                  onClick={() => {
                    if (onOpenReportHazard) {
                      onOpenReportHazard();
                    } else if (typeof window !== 'undefined') {
                      window.dispatchEvent(new CustomEvent('ner_open_hazard_modal'));
                    }
                  }}
                  className="w-13 h-13 rounded-full bg-gradient-to-tr from-rose-600 via-red-600 to-amber-500 text-white flex items-center justify-center shadow-lg shadow-rose-600/40 ring-4 ring-white dark:ring-slate-950 active:scale-95 transition-transform cursor-pointer"
                  title="Report Road Hazard"
                >
                  <Plus className="w-7 h-7 stroke-[2.5]" />
                </button>
                <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 mt-1 uppercase tracking-tight">
                  Report
                </span>
              </div>
            );
          }

          const Icon = tab.icon;
          const isActive = currentView === tab.id;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setCurrentView(tab.id)}
              className={`flex-1 flex flex-col items-center justify-center py-1 px-1 min-h-[48px] rounded-2xl transition-all cursor-pointer relative ${
                isActive 
                  ? 'text-blue-600 dark:text-cyan-400 font-bold' 
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 active:bg-slate-100 dark:active:bg-slate-900/60'
              }`}
            >
              <div className="relative flex items-center justify-center">
                <Icon className={`w-5 h-5 transition-transform ${isActive ? 'scale-110 stroke-[2.5]' : 'stroke-2'}`} />
                {tab.badge > 0 && (
                  <span className="absolute -top-1.5 -right-2 min-w-4 h-4 px-1 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center ring-2 ring-white dark:ring-slate-950 animate-pulse">
                    {tab.badge > 9 ? '9+' : tab.badge}
                  </span>
                )}
              </div>
              <span className={`text-[10px] mt-1 leading-none tracking-tight ${isActive ? 'font-black' : 'font-medium'}`}>
                {tab.label}
              </span>
              {isActive && (
                <span className="w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-cyan-400 mt-0.5" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
