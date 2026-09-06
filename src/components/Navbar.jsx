'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { 
  Bell, 
  ChevronDown, 
  User, 
  LogOut, 
  Shield, 
  AlertTriangle,
  Radio,
  CheckCircle2,
  X,
  Menu,
  Clock,
  MapPin,
  ChevronRight,
  ShieldAlert
} from 'lucide-react';

import MountainLogo from '@/components/MountainLogo';
import ThemeToggle from '@/components/ThemeToggle';
import AuthNavbarSwitcher from '@/components/AuthNavbarSwitcher';
import AccountMenu from '@/components/AccountMenu';
import { useNav } from '@/context/NavContext';
import { supabase } from '@/lib/supabaseClient';

function formatTimeAgo(dateString) {
  if (!dateString) return 'Just now';
  const now = new Date();
  const date = new Date(dateString);
  const diffSec = Math.floor((now - date) / 1000);
  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

function getSeverityBadge(severity) {
  const s = severity?.toLowerCase() || 'high';
  switch (s) {
    case 'critical':
      return {
        pill: 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-200 dark:border-red-900/60',
        card: 'bg-red-50/60 dark:bg-red-950/30 border-red-100 dark:border-red-900/40',
        iconColor: 'text-red-600 dark:text-red-400',
        label: 'CRITICAL',
      };
    case 'high':
      return {
        pill: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-900/60',
        card: 'bg-rose-50/60 dark:bg-rose-950/30 border-rose-100 dark:border-rose-900/40',
        iconColor: 'text-rose-600 dark:text-rose-400',
        label: 'HIGH',
      };
    case 'medium':
      return {
        pill: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-900/60',
        card: 'bg-amber-50/60 dark:bg-amber-950/30 border-amber-100 dark:border-amber-900/40',
        iconColor: 'text-amber-600 dark:text-amber-400',
        label: 'MEDIUM',
      };
    case 'low':
      return {
        pill: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/60',
        card: 'bg-emerald-50/60 dark:bg-emerald-950/30 border-emerald-100 dark:border-emerald-900/40',
        iconColor: 'text-emerald-600 dark:text-emerald-400',
        label: 'LOW',
      };
    default:
      return {
        pill: 'bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800',
        card: 'bg-slate-50/60 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800',
        iconColor: 'text-slate-500 dark:text-slate-400',
        label: s.toUpperCase(),
      };
  }
}

function formatHazardTitle(hazard) {
  if (hazard.title) return hazard.title;
  const type = hazard.hazard_type ? hazard.hazard_type.replace(/_/g, ' ') : 'Hazard';
  return `${type.charAt(0).toUpperCase() + type.slice(1)} Incident`;
}

export default function Navbar() {
  const { user, isNodalOfficer, loading: authLoading } = useAuth();
  const { currentView, setCurrentView, toggleSidebar, sidebarOpen } = useNav();
  const pathname = usePathname();
  const router = useRouter();

  const [notificationsOpen, setNotificationsOpen] = useState(false);

  // Realtime Hazard Notifications state
  const [recentHazards, setRecentHazards] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const notificationsRef = useRef(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (notificationsRef.current && !notificationsRef.current.contains(event.target)) {
        setNotificationsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch initial recent hazards & subscribe to realtime INSERT events
  useEffect(() => {
    let isMounted = true;

    async function fetchRecentHazards() {
      try {
        const { data, error } = await supabase
          .from('road_hazards')
          .select('*')
          .neq('status', 'resolved')
          .order('created_at', { ascending: false })
          .limit(6);

        if (!error && data && isMounted) {
          setRecentHazards(data);
        }
      } catch (err) {
        console.warn('Recent hazards notification fetch notice:', err);
      }
    }

    fetchRecentHazards();

    // Realtime subscription for road hazards (INSERT, DELETE, UPDATE)
    const channel = supabase
      .channel('navbar_hazard_bell_alerts')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'road_hazards' },
        (payload) => {
          if (!isMounted) return;

          if (payload.eventType === 'DELETE') {
            const deletedId = payload.old?.id;
            if (deletedId) {
              setRecentHazards((prev) => prev.filter((h) => h.id !== deletedId));
              setUnreadCount((prev) => Math.max(0, prev - 1));
            }
          } else if (payload.eventType === 'INSERT') {
            if (payload.new && payload.new.status !== 'resolved') {
              setRecentHazards((prev) => [payload.new, ...prev.filter((h) => h.id !== payload.new.id)].slice(0, 10));
              setUnreadCount((prev) => prev + 1);
            }
          } else if (payload.eventType === 'UPDATE') {
            if (payload.new?.status === 'resolved') {
              setRecentHazards((prev) => prev.filter((h) => h.id !== payload.new.id));
              setUnreadCount((prev) => Math.max(0, prev - 1));
            } else if (payload.new) {
              setRecentHazards((prev) => [payload.new, ...prev.filter((h) => h.id !== payload.new.id)].slice(0, 10));
            }
          }
        }
      )
      .subscribe();

    // Listen for local custom events across components in the same window
    const handleLocalHazardReported = (e) => {
      if (e?.detail && isMounted) {
        setRecentHazards((prev) => [e.detail, ...prev.filter((h) => h.id !== e.detail.id)].slice(0, 10));
        setUnreadCount((prev) => prev + 1);
      }
    };

    const handleLocalHazardDeleted = (e) => {
      const deletedId = e?.detail?.id;
      if (deletedId && isMounted) {
        setRecentHazards((prev) => prev.filter((h) => h.id !== deletedId));
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('ner_hazard_reported', handleLocalHazardReported);
      window.addEventListener('ner_hazard_deleted', handleLocalHazardDeleted);
    }

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
      if (typeof window !== 'undefined') {
        window.removeEventListener('ner_hazard_reported', handleLocalHazardReported);
        window.removeEventListener('ner_hazard_deleted', handleLocalHazardDeleted);
      }
    };
  }, []);

  const toggleNotifications = () => {
    if (!notificationsOpen) {
      setUnreadCount(0);
      setNotificationsOpen(true);
    } else {
      setNotificationsOpen(false);
    }
  };

  const handleAlertClick = (hazard) => {
    setNotificationsOpen(false);
    setCurrentView('hazards');
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ner_global_search', { detail: hazard.title || hazard.state || '' }));
    }
  };

  return (
    <header className="sticky top-0 z-[1100] bg-white/95 dark:bg-slate-950/95 backdrop-blur-md border-b border-slate-200/90 dark:border-slate-800/90 h-16 transition-colors shadow-2xs select-none">
      <div className="h-full px-4 sm:px-6 flex items-center justify-between gap-4">
        
        {/* Left: Hamburger Button + Mountain Brand Identity */}
        <div className="flex items-center space-x-2 sm:space-x-3 shrink-0">
          
          {/* 3-Line Hamburger Menu Toggle Button */}
          <button
            type="button"
            onClick={toggleSidebar}
            title={sidebarOpen ? 'Close Navigation' : 'Open Navigation Menu'}
            className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-cyan-400 hover:bg-slate-100 dark:hover:bg-slate-900 border border-transparent hover:border-slate-200 dark:hover:border-slate-800 transition-all cursor-pointer flex items-center justify-center"
          >
            <Menu className="w-5 h-5" />
          </button>

          <Link href="/" className="flex items-center space-x-2.5 group">
            <MountainLogo className="w-9 h-9 transition-transform group-hover:scale-105" />
            <div className="flex flex-col">
              <span className="text-base font-black tracking-tight text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-cyan-400 transition-colors font-sans">
                AshtaMarg
              </span>
              <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 leading-none">
                Tactical Logistics • 8 NER States
              </span>
            </div>
          </Link>
        </div>

        {/* Right: Controls & Notifications */}
        <div className="flex items-center space-x-3 shrink-0">
          
          {/* Theme Toggle Pill */}
          <div className="flex items-center">
            <ThemeToggle />
          </div>

          {/* Notifications Bell with Real-Time Badge */}
          <div className="relative" ref={notificationsRef}>
            <button
              type="button"
              onClick={toggleNotifications}
              className="w-9 h-9 rounded-full bg-slate-100/80 dark:bg-slate-900 hover:bg-slate-200/70 dark:hover:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 transition-colors relative cursor-pointer"
              title="Hazard Alerts & Notifications"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 min-w-4 h-4 px-1 rounded-full bg-rose-500 text-white text-[9px] font-mono font-bold flex items-center justify-center ring-2 ring-white dark:ring-slate-950 animate-pulse">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {/* Notification Dropdown */}
            {notificationsOpen && (
              <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-3 z-50 animate-in fade-in zoom-in-95 duration-150 font-sans">
                <div className="flex items-center justify-between pb-2.5 px-1 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center space-x-1.5">
                    <ShieldAlert className="w-4 h-4 text-rose-500" />
                    <span className="text-xs font-bold text-slate-900 dark:text-white">Active Hazard Alerts</span>
                  </div>
                  <span className="text-[10px] font-mono font-bold bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 px-2 py-0.5 rounded-full border border-rose-200 dark:border-rose-800">
                    {recentHazards.length} Active
                  </span>
                </div>

                {/* List of Hazards */}
                <div className="py-2 space-y-2 max-h-80 overflow-y-auto pr-0.5">
                  {recentHazards.length === 0 ? (
                    <div className="py-6 px-3 text-center space-y-2">
                      <div className="w-8 h-8 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-500 flex items-center justify-center mx-auto">
                        <CheckCircle2 className="w-4 h-4" />
                      </div>
                      <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                        No active road hazards
                      </p>
                      <p className="text-[10px] text-slate-400">
                        All transit corridors across 8 NER states are clear.
                      </p>
                    </div>
                  ) : (
                    recentHazards.map((hazard) => {
                      const badge = getSeverityBadge(hazard.severity);
                      const title = formatHazardTitle(hazard);
                      const location = [hazard.district, hazard.state].filter(Boolean).join(', ') || 'NER Corridor';
                      const timeAgo = formatTimeAgo(hazard.created_at);

                      return (
                        <div
                          key={hazard.id || Math.random()}
                          onClick={() => handleAlertClick(hazard)}
                          className={`p-2.5 rounded-xl border text-xs cursor-pointer transition-all hover:scale-[1.01] ${badge.card}`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center space-x-1.5 font-bold text-[11px] truncate text-slate-900 dark:text-slate-100">
                              <AlertTriangle className={`w-3.5 h-3.5 shrink-0 ${badge.iconColor}`} />
                              <span className="truncate">{title}</span>
                            </div>
                            <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border shrink-0 ${badge.pill}`}>
                              {badge.label}
                            </span>
                          </div>

                          <div className="flex items-center justify-between mt-1.5 text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                            <span className="flex items-center space-x-1 truncate max-w-[180px]">
                              <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                              <span className="truncate">{location}</span>
                            </span>
                            <span className="flex items-center space-x-1 shrink-0">
                              <Clock className="w-3 h-3" />
                              <span>{timeAgo}</span>
                            </span>
                          </div>

                          {hazard.notes && (
                            <p className="text-[10px] text-slate-600 dark:text-slate-400 mt-1 line-clamp-2 leading-relaxed font-sans">
                              {hazard.notes}
                            </p>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>

                {/* View All Hazards Button */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      setNotificationsOpen(false);
                      setCurrentView('hazards');
                    }}
                    className="w-full py-1.5 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-mono font-bold transition-colors flex items-center justify-center space-x-1.5 cursor-pointer"
                  >
                    <span>View All Live Hazards</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* If Authenticated: Show Profile & Account Menu */}
          {!authLoading && (user || isNodalOfficer) && pathname !== '/login' && pathname !== '/nodal-login' && (
            <AccountMenu />
          )}

          {/* Auth Switcher (On login pages or when unauthenticated) */}
          {(pathname === '/login' || pathname === '/nodal-login' || (!authLoading && !user && !isNodalOfficer)) && (
            <AuthNavbarSwitcher />
          )}

        </div>

      </div>
    </header>
  );
}

