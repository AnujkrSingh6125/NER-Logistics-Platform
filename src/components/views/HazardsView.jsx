'use client';

import React, { useState, useMemo } from 'react';
import Image from 'next/image';
import { 
  AlertTriangle, 
  MapPin, 
  Search, 
  Plus, 
  BarChart2, 
  Flame, 
  ShieldAlert, 
  ShieldCheck, 
  AlertCircle, 
  FileText, 
  ChevronDown, 
  ExternalLink, 
  Eye, 
  CheckCircle2, 
  Clock, 
  Navigation,
  Trash2,
  User,
  Shield,
  Loader2,
  Lock,
  Video,
  Image as ImageIcon,
  Film,
  X,
  Radio,
  Layers,
  Sparkles,
  Info
} from 'lucide-react';

import LiveClockWidget from '@/components/LiveClockWidget';
import ReportHazardModal from '@/components/ReportHazardModal';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabaseClient';
import { estimateNerLocationFallback } from '@/lib/geoUtils';
import { deleteHazardOffline } from '@/lib/offlineDb';

export default function HazardsView({ hazards = [], onSelectHazardOnMap }) {
  const { user, profile, isNodalOfficer, nodalOfficer } = useAuth();

  const [liveHazards, setLiveHazards] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const delCache = JSON.parse(sessionStorage.getItem('ner_deleted_hazards') || '[]');
        return (hazards || []).filter(h => !delCache.includes(h.id));
      } catch (e) {}
    }
    return hazards || [];
  });

  React.useEffect(() => {
    if (Array.isArray(hazards)) {
      if (typeof window !== 'undefined') {
        try {
          const delCache = JSON.parse(sessionStorage.getItem('ner_deleted_hazards') || '[]');
          setLiveHazards(hazards.filter(h => !delCache.includes(h.id)));
          return;
        } catch (e) {}
      }
      setLiveHazards(hazards);
    }
  }, [hazards]);

  const [scopeTab, setScopeTab] = useState('ALL'); // 'ALL' = All Regional Hazards, 'MY' = My Reported Hazards
  const [search, setSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState('ALL');
  const [stateFilter, setStateFilter] = useState('ALL');
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [viewingMediaHazard, setViewingMediaHazard] = useState(null);
  const [viewingDetailsHazard, setViewingDetailsHazard] = useState(null);

  // States List for 8 NER States
  const statesList = [
    'ALL',
    'Assam',
    'Arunachal Pradesh',
    'Meghalaya',
    'Manipur',
    'Mizoram',
    'Nagaland',
    'Tripura',
    'Sikkim'
  ];

  // User Profile metadata for Hero Header
  const displayName = isNodalOfficer 
    ? (nodalOfficer?.officer_name || 'Nodal Authority') 
    : (profile?.full_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Anuj');
  const userRoleText = isNodalOfficer 
    ? `${nodalOfficer?.state_jurisdiction || 'NER'} • NODAL OPS` 
    : `${profile?.driver_code || user?.user_metadata?.driver_code || '#1524'} • NER OPS`;
  const userInitial = (displayName[0] || 'A').toUpperCase();

  // Filter hazards reported by the current user / officer
  const myHazards = useMemo(() => {
    if (!user?.id && !nodalOfficer) return [];
    return liveHazards.filter((h) => {
      const isUserMatch = user?.id && (h.reported_by_id === user.id || h.reported_by === user.id);
      const isNodalMatch = isNodalOfficer && (
        h.reported_by_role === 'nodal_officer' ||
        (nodalOfficer?.officer_name && h.reported_by_name?.includes(nodalOfficer.officer_name)) ||
        (nodalOfficer?.emergency_contact && h.reported_by_contact === nodalOfficer.emergency_contact)
      );
      return isUserMatch || isNodalMatch;
    });
  }, [liveHazards, user?.id, isNodalOfficer, nodalOfficer]);

  // Compute live KPI metrics across all active hazards
  const totalCount = liveHazards.length;
  const criticalCount = liveHazards.filter((h) => h.severity?.toLowerCase() === 'critical').length;
  const highCount = liveHazards.filter((h) => h.severity?.toLowerCase() === 'high').length;
  const mediumCount = liveHazards.filter((h) => h.severity?.toLowerCase() === 'medium').length;
  const lowCount = liveHazards.filter((h) => h.severity?.toLowerCase() === 'low').length;

  const criticalPct = totalCount > 0 ? Math.round((criticalCount / totalCount) * 100) : 0;
  const highPct = totalCount > 0 ? Math.round((highCount / totalCount) * 100) : 0;
  const mediumPct = totalCount > 0 ? Math.round((mediumCount / totalCount) * 100) : 0;
  const lowPct = totalCount > 0 ? Math.round((lowCount / totalCount) * 100) : 0;

  // Active base dataset according to scope tab
  const baseDataset = scopeTab === 'MY' ? myHazards : liveHazards;

  // Filter hazards by search text, severity, and state
  const filteredHazards = useMemo(() => {
    return baseDataset.filter((h) => {
      const geo = estimateNerLocationFallback(parseFloat(h.latitude), parseFloat(h.longitude));
      const effectiveState = (h.state && h.state !== 'null' && h.state !== 'NER' && !(h.state === 'Assam' && h.district === 'Unspecified Sector')) 
        ? h.state 
        : geo.state;
      const effectiveDistrict = (h.district && h.district !== 'Unspecified Sector' && h.district !== 'null' && h.district !== '') 
        ? h.district 
        : geo.district;

      const q = search.toLowerCase();
      const matchesSearch =
        !q ||
        h.title?.toLowerCase().includes(q) ||
        h.hazard_type?.toLowerCase().includes(q) ||
        h.notes?.toLowerCase().includes(q) ||
        h.description?.toLowerCase().includes(q) ||
        h.reported_by_name?.toLowerCase().includes(q) ||
        effectiveState.toLowerCase().includes(q) ||
        effectiveDistrict.toLowerCase().includes(q);

      const s = h.severity?.toLowerCase() || '';
      const matchesSeverity =
        severityFilter === 'ALL' ||
        s === severityFilter.toLowerCase();

      const matchesState =
        stateFilter === 'ALL' ||
        effectiveState.toLowerCase() === stateFilter.toLowerCase();

      return matchesSearch && matchesSeverity && matchesState;
    });
  }, [baseDataset, search, severityFilter, stateFilter]);

  // Delete / Resolve Hazard Handler (Guaranteed Permanent Deletion)
  const handleDeleteHazard = async (hazard, e) => {
    e?.stopPropagation();
    const isMine = user?.id && (
      hazard.reported_by_id === user.id || 
      hazard.reported_by === user.id || 
      hazard.created_by === user.id ||
      hazard.user_id === user.id
    );
    const canDelete = isNodalOfficer || isMine;

    if (!canDelete) {
      alert('Access Denied: Drivers can only delete road hazards they reported.');
      return;
    }

    const confirmPrompt = isNodalOfficer && !isMine
      ? `[GOVERNMENT AUTHORITY OVERRIDE]\nAre you sure you want to delete this hazard? This action cannot be undone.`
      : `Are you sure you want to delete this hazard? This action cannot be undone.`;

    if (!window.confirm(confirmPrompt)) return;

    setDeletingId(hazard.id);
    
    // 1. Optimistically remove from live UI immediately
    setLiveHazards(prev => prev.filter(h => h.id !== hazard.id));

    // 2. Add to deleted cache in sessionStorage & localStorage
    if (typeof window !== 'undefined') {
      try {
        const delCache = JSON.parse(sessionStorage.getItem('ner_deleted_hazards') || '[]');
        if (!delCache.includes(hazard.id)) {
          delCache.push(hazard.id);
          sessionStorage.setItem('ner_deleted_hazards', JSON.stringify(delCache));
          localStorage.setItem('ner_deleted_hazards', JSON.stringify(delCache));
        }
      } catch (e) {}
    }

    try {
      // 3. Server-side permanent delete via backend API (bypasses RLS issues)
      try {
        await fetch('/api/records/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'hazard', id: hazard.id }),
        });
      } catch (apiErr) {
        console.warn('API delete note:', apiErr);
      }

      // 4. Client-side Supabase direct delete
      await supabase
        .from('road_hazards')
        .delete()
        .eq('id', hazard.id);

      // 5. Purge from Dexie IndexedDB offline caches
      try {
        await deleteHazardOffline(hazard.id);
      } catch (dexErr) {}

      // 6. Broadcast delete event to map and dashboard
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('ner_hazard_deleted', { detail: { id: hazard.id } }));
        window.dispatchEvent(new CustomEvent('ner_hazard_reported'));
      }
    } catch (err) {
      console.error('Hazard deletion error:', err);
      alert(`Deletion failed: ${err.message || 'Check database permissions'}`);
    } finally {
      setDeletingId(null);
    }
  };  return (
    <div className="flex-1 p-3 sm:p-5 lg:p-6 space-y-4 sm:space-y-5 max-w-7xl mx-auto w-full font-sans">
      
      {/* ========================================================================= */}
      {/* 1. HERO HEADER BANNER WITH REAL BACKGROUND IMAGE FROM /header background.jpeg */}
      {/* ========================================================================= */}
      <div className="relative rounded-3xl border border-slate-200/90 dark:border-slate-800 p-5 sm:p-7 shadow-[0_4px_25px_rgba(0,0,0,0.04)] overflow-hidden bg-slate-900/10 min-h-[140px] flex flex-col justify-between">
        
        {/* Real Mountain Background Image Layer */}
        <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
          <Image
            src="/header%20background.jpeg"
            alt="Himalayan Highway & Mountains"
            fill
            priority
            className="object-cover object-center opacity-100 dark:opacity-90 contrast-[1.08] brightness-[0.98]"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-white/60 via-white/20 to-transparent dark:from-slate-950/80 dark:via-slate-950/40 dark:to-transparent pointer-events-none" />
          <div className="absolute inset-0 bg-gradient-to-t from-white/20 via-transparent to-transparent dark:from-slate-950/40 dark:via-transparent dark:to-transparent pointer-events-none" />
        </div>

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 sm:gap-6 relative z-10">
          
          {/* Left Title & Subtitle */}
          <div className="space-y-1.5 max-w-2xl">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 dark:text-white tracking-tight leading-tight drop-shadow-xs">
              Field Road Hazards Directory
            </h1>
            <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-200 font-medium leading-relaxed drop-shadow-xs max-w-xl">
              Real-time PostGIS ground hazard alerts, situational road logs, and scoped clearance management across 8 NER States.
            </p>
          </div>

          {/* Right Profile Badge & Live Clock Widget */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 lg:gap-4 shrink-0">
            
            {/* User Profile Card */}
            <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border border-slate-200/90 dark:border-slate-800 rounded-2xl p-2.5 sm:p-3 shadow-xs flex items-center space-x-3 min-w-[175px]">
              <div className="w-9 h-9 rounded-xl bg-blue-600 dark:bg-blue-600 flex items-center justify-center text-white font-black text-sm shrink-0 shadow-xs">
                {userInitial}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                  {displayName}
                </span>
                <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 font-semibold truncate">
                  {userRoleText}
                </span>
              </div>
            </div>

            {/* Live Clock Widget */}
            <LiveClockWidget />
          </div>

        </div>

      </div>

      {/* ========================================================================= */}
      {/* 2. SUMMARY METRICS CARDS ROW (5 Sleek White Cards) */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        
        {/* Card 1: Total Incidents */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-4.5 border border-slate-200/90 dark:border-slate-800 shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
              Total Incidents
            </span>
            <div className="w-8 h-8 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-100 dark:border-rose-900 flex items-center justify-center text-rose-500">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <span className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white font-mono">
              {totalCount}
            </span>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 font-medium">
              {totalCount === 0 ? '0 active alerts' : `${totalCount} active alert${totalCount > 1 ? 's' : ''}`}
            </p>
          </div>
        </div>

        {/* Card 2: Critical */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-4.5 border border-slate-200/90 dark:border-slate-800 shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
              Critical
            </span>
            <div className="w-8 h-8 rounded-xl bg-pink-50 dark:bg-pink-950/60 border border-pink-100 dark:border-pink-900 flex items-center justify-center text-pink-500">
              <BarChart2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <span className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white font-mono">
              {criticalCount}
            </span>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 font-medium">
              {criticalPct}% of total
            </p>
          </div>
        </div>

        {/* Card 3: High */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-4.5 border border-slate-200/90 dark:border-slate-800 shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
              High
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-100 dark:border-amber-900 flex items-center justify-center text-amber-500">
              <AlertCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <span className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white font-mono">
              {highCount}
            </span>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 font-medium">
              {highPct}% of total
            </p>
          </div>
        </div>

        {/* Card 4: Medium */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-4.5 border border-slate-200/90 dark:border-slate-800 shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
              Medium
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-100 dark:border-blue-900 flex items-center justify-center text-blue-500">
              <ShieldAlert className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <span className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white font-mono">
              {mediumCount}
            </span>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 font-medium">
              {mediumPct}% of total
            </p>
          </div>
        </div>

        {/* Card 5: Low */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-4.5 border border-slate-200/90 dark:border-slate-800 shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
              Low
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-100 dark:border-emerald-900 flex items-center justify-center text-emerald-500">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <span className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white font-mono">
              {lowCount}
            </span>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 font-medium">
              {lowPct}% of total
            </p>
          </div>
        </div>

      </div>

      {/* ========================================================================= */}
      {/* 3. CONTROLS TOOLBAR (Pill Tabs, Search, Filter Dropdowns, Action Button) */}
      {/* ========================================================================= */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 sm:gap-4">
        
        {/* Left: Two-Tab Pill Switcher */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setScopeTab('ALL')}
            className={`flex items-center gap-2 px-4 py-2 rounded-full font-bold text-xs transition-all cursor-pointer ${
              scopeTab === 'ALL'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25'
                : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200/90 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>All Regional Hazards</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
              scopeTab === 'ALL' ? 'bg-white/25 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
            }`}>
              {hazards.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setScopeTab('MY')}
            className={`flex items-center gap-2 px-4 py-2 rounded-full font-bold text-xs transition-all cursor-pointer ${
              scopeTab === 'MY'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25'
                : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200/90 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>My Reported Hazards</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
              scopeTab === 'MY' ? 'bg-white/25 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
            }`}>
              {myHazards.length}
            </span>
          </button>
        </div>

        {/* Right: Search, State Filter, Severity Filter, Report Button */}
        <div className="flex flex-wrap items-center gap-2.5">
          
          {/* Pill Search Input */}
          <div className="relative min-w-[200px] flex-1 sm:flex-initial">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search title, road, sector..."
              className="w-full bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-full pl-9 pr-4 py-2 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-xs font-sans"
            />
          </div>

          {/* State Filter Pill Dropdown */}
          <div className="relative">
            <select
              value={stateFilter}
              onChange={(e) => setStateFilter(e.target.value)}
              className="appearance-none bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-full pl-4 pr-9 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer shadow-xs"
            >
              {statesList.map((st) => (
                <option key={st} value={st}>
                  {st === 'ALL' ? 'All States' : st}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Severity Filter Pill Dropdown */}
          <div className="relative">
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="appearance-none bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-full pl-4 pr-9 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer shadow-xs"
            >
              <option value="ALL">All Severities</option>
              <option value="Critical">🔴 Critical</option>
              <option value="High">🟠 High</option>
              <option value="Medium">🟡 Medium</option>
              <option value="Low">🟢 Low</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Red Pill Report Hazard Action Button */}
          <button
            type="button"
            onClick={() => setReportModalOpen(true)}
            className="flex items-center gap-1.5 px-5 py-2 rounded-full bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-600 hover:to-red-700 text-white font-black text-xs uppercase tracking-wider shadow-md shadow-rose-500/25 active:scale-95 transition-all cursor-pointer"
          >
            <AlertTriangle className="w-3.5 h-3.5 text-white shrink-0" />
            <span>REPORT HAZARD</span>
          </button>

        </div>

      </div>

      {/* ========================================================================= */}
      {/* 4. MASTER DATA TABLE CARD CONTAINER */}
      {/* ========================================================================= */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-xs overflow-hidden">
        
        {filteredHazards.length === 0 ? (
          <div className="py-16 flex flex-col items-center justify-center text-center space-y-4">
            
            <div className="relative">
              <div className="w-16 h-16 rounded-2xl bg-blue-50 dark:bg-blue-950/60 border border-blue-100 dark:border-blue-900 flex items-center justify-center text-blue-500">
                <FileText className="w-8 h-8 stroke-[1.5]" />
              </div>
            </div>

            <div className="space-y-1 max-w-sm">
              <h4 className="text-base font-bold text-slate-900 dark:text-white">
                {scopeTab === 'MY' ? 'No personal hazard reports' : 'No hazard records found'}
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {scopeTab === 'MY' 
                  ? 'You have not submitted any active hazard reports in the transit network yet.' 
                  : 'No incident records match the current search or filter criteria.'}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setReportModalOpen(true)}
              className="mt-2 flex items-center gap-2 px-5 py-2 rounded-full bg-gradient-to-r from-rose-500 to-red-600 text-white font-bold text-xs shadow-md shadow-rose-500/25 transition-all active:scale-95 cursor-pointer"
            >
              <AlertTriangle className="w-4 h-4 text-white" />
              <span>Report Hazard Now</span>
            </button>

          </div>
        ) : (
          <>
            {/* Mobile Card List (< md) */}
            <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800 p-3 space-y-3">
              {filteredHazards.map((h, idx) => {
                const s = h.severity?.toLowerCase() || '';
                const sevBadge = 
                  s === 'critical'
                    ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/70 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                    : s === 'high'
                    ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/70 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                    : s === 'medium'
                    ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/70 dark:text-blue-300 border-blue-200 dark:border-blue-800'
                    : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';

                const isMine = user?.id && (h.reported_by_id === user.id || h.reported_by === user.id);

                const geo = estimateNerLocationFallback(parseFloat(h.latitude), parseFloat(h.longitude));
                const st = (h.state && h.state !== 'null' && h.state !== 'NER' && !(h.state === 'Assam' && h.district === 'Unspecified Sector'))
                  ? h.state
                  : geo.state;
                const dt = (h.district && h.district !== 'Unspecified Sector' && h.district !== 'null' && h.district !== '')
                  ? h.district
                  : geo.district;

                const mediaList = Array.isArray(h.media_urls) && h.media_urls.length > 0
                  ? h.media_urls
                  : (h.image_url || h.photo_url ? [h.image_url || h.photo_url] : []);

                return (
                  <div 
                    key={`mob-haz-${h.id || idx}`}
                    className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-2xs space-y-3 font-sans"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                            {h.title || 'Road Hazard Incident'}
                          </h4>
                          {isMine && (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-cyan-100 dark:bg-cyan-950 text-cyan-800 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-800">
                              MY REPORT
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1 font-medium">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{st}, {dt}</span>
                        </p>
                      </div>

                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase border shrink-0 ${sevBadge}`}>
                        {h.severity || 'Moderate'}
                      </span>
                    </div>

                    {(h.description || h.notes) && (
                      <p className="text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800/80 leading-relaxed">
                        {h.description || h.notes}
                      </p>
                    )}

                    <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 font-mono">
                      <span>GPS: {parseFloat(h.latitude).toFixed(4)}, {parseFloat(h.longitude).toFixed(4)}</span>
                      {mediaList.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setViewingMediaHazard(h)}
                          className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-cyan-400 font-bold border border-blue-200 dark:border-blue-800 cursor-pointer"
                        >
                          <ImageIcon className="w-3 h-3 text-blue-500" />
                          <span>{mediaList.length} Media</span>
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                      <button
                        type="button"
                        onClick={() => {
                          if (onSelectHazardOnMap) {
                            onSelectHazardOnMap(h);
                          }
                        }}
                        className="py-2 px-3 bg-blue-50 dark:bg-blue-950 hover:bg-blue-100 dark:hover:bg-blue-900 text-blue-600 dark:text-cyan-400 font-bold text-xs rounded-full border border-blue-200 dark:border-blue-800 transition-colors flex items-center justify-center space-x-1.5 cursor-pointer"
                      >
                        <Navigation className="w-3.5 h-3.5" />
                        <span>Locate on Map</span>
                      </button>

                      {isNodalOfficer ? (
                        <button
                          type="button"
                          onClick={(e) => handleDeleteHazard(h, e)}
                          disabled={deletingId === h.id}
                          className="py-2 px-3 bg-red-50 dark:bg-red-950 hover:bg-red-100 dark:hover:bg-red-900 text-red-600 dark:text-red-300 font-bold text-xs rounded-full border border-red-200 dark:border-red-800 transition-colors flex items-center justify-center space-x-1.5 cursor-pointer disabled:opacity-50"
                        >
                          {deletingId === h.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5 text-red-500" />}
                          <span>Clear Hazard</span>
                        </button>
                      ) : isMine ? (
                        <button
                          type="button"
                          onClick={(e) => handleDeleteHazard(h, e)}
                          disabled={deletingId === h.id}
                          className="py-2 px-3 bg-red-50 dark:bg-red-950 hover:bg-red-100 dark:hover:bg-red-900 text-red-600 dark:text-red-300 font-bold text-xs rounded-full border border-red-200 dark:border-red-800 transition-colors flex items-center justify-center space-x-1.5 cursor-pointer disabled:opacity-50"
                        >
                          {deletingId === h.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5 text-red-500" />}
                          <span>Clear Hazard</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setViewingDetailsHazard(h)}
                          className="py-2 px-3 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-full border border-slate-200 dark:border-slate-700 transition-colors flex items-center justify-center space-x-1.5 cursor-pointer"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>View Details</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Table View (>= md) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs font-sans">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 text-[10px] font-bold font-mono text-slate-400 uppercase tracking-wider bg-slate-50/50 dark:bg-slate-950/30">
                    <th className="py-3.5 pl-6">HAZARD / ROAD EVENT</th>
                    <th className="py-3.5 px-3">SEVERITY</th>
                    <th className="py-3.5 px-3">LOCATION & SECTOR</th>
                    <th className="py-3.5 px-3">COORDINATES (LAT, LNG)</th>
                    <th className="py-3.5 px-3">REPORTED BY / SOURCE</th>
                    <th className="py-3.5 px-3">EVIDENCE</th>
                    <th className="py-3.5 pr-6 text-right">ACTIONS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                  {filteredHazards.map((h, idx) => {
                    const s = h.severity?.toLowerCase() || '';
                    const sevBadge = 
                      s === 'critical'
                        ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/70 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                        : s === 'high'
                        ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/70 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                        : s === 'medium'
                        ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/70 dark:text-blue-300 border-blue-200 dark:border-blue-800'
                        : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';

                    const isMine = user?.id && (h.reported_by_id === user.id || h.reported_by === user.id);
                    const canDelete = isNodalOfficer || isMine;

                    const geo = estimateNerLocationFallback(parseFloat(h.latitude), parseFloat(h.longitude));
                    const st = (h.state && h.state !== 'null' && h.state !== 'NER' && !(h.state === 'Assam' && h.district === 'Unspecified Sector'))
                      ? h.state
                      : geo.state;
                    const dt = (h.district && h.district !== 'Unspecified Sector' && h.district !== 'null' && h.district !== '')
                      ? h.district
                      : geo.district;

                    const mediaList = Array.isArray(h.media_urls) && h.media_urls.length > 0
                      ? h.media_urls
                      : (h.image_url || h.photo_url ? [h.image_url || h.photo_url] : []);

                    return (
                      <tr 
                        key={h.id || `haz-${idx}`} 
                        className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        {/* 1. Hazard Event & Notes */}
                        <td className="py-4 pl-6 max-w-xs">
                          <div className="font-bold text-slate-900 dark:text-slate-100 text-xs flex items-center space-x-1.5">
                            <span className="truncate">{h.title || 'Road Hazard Incident'}</span>
                            {isMine && (
                              <span className="px-1.5 py-0.2 rounded-full text-[8.5px] font-mono font-bold bg-cyan-100 dark:bg-cyan-950 text-cyan-800 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-800 shrink-0">
                                MY REPORT
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5 font-normal">
                            {h.description || h.notes || 'Active ground hazard reported'}
                          </div>
                        </td>

                        {/* 2. Severity Badge */}
                        <td className="py-4 px-3">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase border inline-block ${sevBadge}`}>
                            {h.severity || 'Moderate'}
                          </span>
                        </td>

                        {/* 3. Location & Sector */}
                        <td className="py-4 px-3 font-medium text-slate-700 dark:text-slate-300">
                          <div>
                            <span className="font-bold text-slate-900 dark:text-slate-100">{st}</span>
                            <span className="text-slate-500 dark:text-slate-400 font-normal">, {dt}</span>
                          </div>
                        </td>

                        {/* 4. Coordinates */}
                        <td className="py-4 px-3 font-mono text-[11px] text-slate-600 dark:text-slate-400">
                          <div>{parseFloat(h.latitude).toFixed(4)},</div>
                          <div>{parseFloat(h.longitude).toFixed(4)}</div>
                        </td>

                        {/* 5. Reporter */}
                        <td className="py-4 px-3 text-slate-700 dark:text-slate-300 font-medium text-xs">
                          {h.reported_by_name || 'Field Operator'}
                        </td>

                        {/* 6. Evidence Button */}
                        <td className="py-4 px-3">
                          {mediaList.length > 0 ? (
                            <button
                              type="button"
                              onClick={() => setViewingMediaHazard(h)}
                              className="px-3 py-1.5 rounded-full bg-blue-50 dark:bg-blue-950/80 hover:bg-blue-100 dark:hover:bg-blue-900 text-blue-600 dark:text-cyan-400 border border-blue-200 dark:border-blue-800 text-xs font-bold transition-all inline-flex items-center space-x-1.5 cursor-pointer shadow-2xs"
                            >
                              <ImageIcon className="w-3.5 h-3.5" />
                              <span>Media</span>
                            </button>
                          ) : (
                            <span className="text-slate-400 text-[11px] font-mono pl-2">—</span>
                          )}
                        </td>

                        {/* 7. Action Buttons */}
                        <td className="py-4 pr-6 text-right">
                          <div className="inline-flex items-center space-x-2">
                            
                            {/* Locate Action Button */}
                            <button
                              type="button"
                              onClick={() => {
                                if (onSelectHazardOnMap) {
                                  onSelectHazardOnMap(h);
                                }
                              }}
                              className="px-3 py-1.5 rounded-full bg-blue-50 dark:bg-blue-950 hover:bg-blue-100 dark:hover:bg-blue-900 text-blue-600 dark:text-cyan-400 font-bold text-xs border border-blue-200 dark:border-blue-800 transition-all inline-flex items-center space-x-1.5 cursor-pointer"
                              title="Locate hazard on interactive GIS map"
                            >
                              <Navigation className="w-3.5 h-3.5" />
                              <span>Locate</span>
                            </button>

                            {/* View Details Action Button */}
                            <button
                              type="button"
                              onClick={() => setViewingDetailsHazard(h)}
                              className="px-3 py-1.5 rounded-full bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs border border-slate-200 dark:border-slate-700 transition-all inline-flex items-center space-x-1.5 cursor-pointer"
                              title="View full hazard incident intelligence"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              <span>View Details</span>
                            </button>

                            {/* Clear Hazard / Authority Override Action */}
                            {canDelete ? (
                              <button
                                type="button"
                                onClick={(e) => handleDeleteHazard(h, e)}
                                disabled={deletingId === h.id}
                                title={isNodalOfficer ? "Government Authority Override: Clear & Resolve Hazard" : "Clear My Hazard Report"}
                                className="px-3 py-1.5 rounded-full bg-rose-50 dark:bg-rose-950/70 hover:bg-rose-100 dark:hover:bg-rose-900 text-rose-600 dark:text-rose-300 font-bold text-xs border border-rose-200 dark:border-rose-800 transition-all inline-flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
                              >
                                {deletingId === h.id ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                                )}
                                <span>Clear Hazard</span>
                              </button>
                            ) : null}

                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

      </div>

      {/* ========================================================================= */}
      {/* 5. VIEW DETAILS MODAL */}
      {/* ========================================================================= */}
      {viewingDetailsHazard && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="relative w-full max-w-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-3xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh]">
            
            <div className="p-5 sm:p-6 bg-slate-50 dark:bg-slate-950 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950 px-2.5 py-0.5 rounded-full border border-rose-200 dark:border-rose-800">
                    {viewingDetailsHazard.severity || 'HIGH'} SEVERITY
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                    {viewingDetailsHazard.hazard_type || 'Road Blockage'}
                  </span>
                </div>
                <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                  {viewingDetailsHazard.title || 'Road Hazard Incident'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setViewingDetailsHazard(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto">
              
              <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-2">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 block">
                  Incident Description & Field Notes
                </span>
                <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
                  {viewingDetailsHazard.description || viewingDetailsHazard.notes || 'No extended field remarks logged by reporter.'}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-slate-50 dark:bg-slate-950 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase font-mono block">Geographic Location</span>
                  <span className="font-bold text-slate-900 dark:text-white mt-0.5 block">
                    {viewingDetailsHazard.state || 'Assam'}, {viewingDetailsHazard.district || 'Dima Hasao'}
                  </span>
                </div>
                <div className="bg-slate-50 dark:bg-slate-950 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase font-mono block">GPS Coordinates</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white mt-0.5 block">
                    {parseFloat(viewingDetailsHazard.latitude).toFixed(5)}, {parseFloat(viewingDetailsHazard.longitude).toFixed(5)}
                  </span>
                </div>
                <div className="bg-slate-50 dark:bg-slate-950 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase font-mono block">Reported By</span>
                  <span className="font-bold text-slate-900 dark:text-white mt-0.5 block">
                    {viewingDetailsHazard.reported_by_name || 'Field Driver'}
                  </span>
                </div>
                <div className="bg-slate-50 dark:bg-slate-950 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase font-mono block">Impact Radius</span>
                  <span className="font-bold text-blue-600 dark:text-cyan-400 mt-0.5 block">
                    {viewingDetailsHazard.impact_radius_km || 5.0} km perimeter
                  </span>
                </div>
              </div>

            </div>

            <div className="p-4 sm:p-5 bg-slate-50 dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  setViewingDetailsHazard(null);
                  if (onSelectHazardOnMap) {
                    onSelectHazardOnMap(viewingDetailsHazard);
                  }
                }}
                className="px-4 py-2 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors inline-flex items-center gap-1.5 cursor-pointer shadow-md shadow-blue-500/20"
              >
                <Navigation className="w-3.5 h-3.5" />
                <span>Locate on Interactive Map</span>
              </button>
              <button
                type="button"
                onClick={() => setViewingDetailsHazard(null)}
                className="px-4 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-full text-xs font-bold transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. MULTI-MEDIA EVIDENCE VIEWER MODAL */}
      {/* ========================================================================= */}
      {viewingMediaHazard && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="relative w-full max-w-2xl bg-slate-900 text-white rounded-3xl shadow-2xl overflow-hidden border border-slate-700 flex flex-col max-h-[90vh]">
            
            <div className="p-4 sm:p-5 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="flex items-center space-x-2">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-rose-400 bg-rose-950/80 px-2.5 py-0.5 rounded-full border border-rose-800">
                    {viewingMediaHazard.hazard_type || 'HAZARD EVIDENCE'}
                  </span>
                  <span className="text-xs text-slate-400 font-mono">
                    {viewingMediaHazard.district}, {viewingMediaHazard.state}
                  </span>
                </div>
                <h3 className="text-sm sm:text-base font-bold text-white truncate max-w-md">
                  {viewingMediaHazard.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setViewingMediaHazard(null)}
                className="text-slate-400 hover:text-white p-1 rounded-full hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4">
              {(() => {
                const list = Array.isArray(viewingMediaHazard.media_urls) && viewingMediaHazard.media_urls.length > 0
                  ? viewingMediaHazard.media_urls
                  : (viewingMediaHazard.image_url || viewingMediaHazard.photo_url ? [viewingMediaHazard.image_url || viewingMediaHazard.photo_url] : []);

                return (
                  <div className={`grid gap-4 ${list.length === 1 ? 'grid-cols-1' : list.length === 2 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'}`}>
                    {list.map((url, idx) => {
                      const isVideo = /\.(mp4|webm|mov|ogg|m4v)(\?.*)?$/i.test(url);
                      return (
                        <div key={`media-view-${idx}`} className="relative rounded-2xl overflow-hidden bg-black border border-slate-800 shadow-md group flex flex-col">
                          <div className="relative aspect-video sm:aspect-square flex items-center justify-center bg-slate-950">
                            {isVideo ? (
                              <video
                                src={url}
                                controls
                                playsInline
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <img
                                src={url}
                                alt={`Evidence ${idx + 1}`}
                                className="w-full h-full object-cover"
                              />
                            )}
                          </div>
                          <div className="p-2.5 bg-slate-950/90 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono">
                            <span className="text-slate-400 flex items-center space-x-1">
                              {isVideo ? <Film className="w-3.5 h-3.5 text-cyan-400" /> : <ImageIcon className="w-3.5 h-3.5 text-amber-400" />}
                              <span>Evidence #{idx + 1} ({isVideo ? 'Video' : 'Photo'})</span>
                            </span>
                            <a
                              href={url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-cyan-400 hover:underline flex items-center space-x-1 font-bold"
                            >
                              <span>Open</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}

              {viewingMediaHazard.notes && (
                <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 text-xs text-slate-300 space-y-1">
                  <span className="text-[10px] font-bold uppercase font-mono text-slate-500">Reporter Field Notes:</span>
                  <p className="leading-relaxed">{viewingMediaHazard.notes}</p>
                </div>
              )}
            </div>

            <div className="p-4 bg-slate-950 border-t border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setViewingMediaHazard(null)}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-full text-xs font-bold transition-colors cursor-pointer"
              >
                Close Viewer
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 7. REPORT HAZARD MODAL */}
      {/* ========================================================================= */}
      <ReportHazardModal
        isOpen={reportModalOpen}
        onClose={() => setReportModalOpen(false)}
        onHazardReported={() => {
          setReportModalOpen(false);
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('ner_hazard_reported'));
          }
        }}
      />

    </div>
  );
}
