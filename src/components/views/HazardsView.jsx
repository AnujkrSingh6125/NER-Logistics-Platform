'use client';

import React, { useState, useMemo } from 'react';
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
  X
} from 'lucide-react';

import LiveClockWidget from '@/components/LiveClockWidget';
import ReportHazardModal from '@/components/ReportHazardModal';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabaseClient';
import { estimateNerLocationFallback } from '@/lib/geoUtils';

export default function HazardsView({ hazards = [], onSelectHazardOnMap }) {
  const { user, isNodalOfficer, nodalOfficer } = useAuth();

  const [scopeTab, setScopeTab] = useState('ALL'); // 'ALL' = All Regional Hazards, 'MY' = My Reported Hazards
  const [search, setSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState('ALL');
  const [stateFilter, setStateFilter] = useState('ALL');
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [viewingMediaHazard, setViewingMediaHazard] = useState(null);

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

  // Filter hazards reported by the current user / officer
  const myHazards = useMemo(() => {
    if (!user?.id && !nodalOfficer) return [];
    return hazards.filter((h) => {
      const isUserMatch = user?.id && (h.reported_by_id === user.id || h.reported_by === user.id);
      const isNodalMatch = isNodalOfficer && (
        h.reported_by_role === 'nodal_officer' ||
        (nodalOfficer?.officer_name && h.reported_by_name?.includes(nodalOfficer.officer_name)) ||
        (nodalOfficer?.emergency_contact && h.reported_by_contact === nodalOfficer.emergency_contact)
      );
      return isUserMatch || isNodalMatch;
    });
  }, [hazards, user?.id, isNodalOfficer, nodalOfficer]);

  // Compute live KPI metrics across all active hazards
  const totalCount = hazards.length;
  const criticalCount = hazards.filter((h) => h.severity?.toLowerCase() === 'critical').length;
  const highCount = hazards.filter((h) => h.severity?.toLowerCase() === 'high').length;
  const mediumCount = hazards.filter((h) => h.severity?.toLowerCase() === 'medium').length;
  const lowCount = hazards.filter((h) => h.severity?.toLowerCase() === 'low').length;

  const criticalPct = totalCount > 0 ? Math.round((criticalCount / totalCount) * 100) : 0;
  const highPct = totalCount > 0 ? Math.round((highCount / totalCount) * 100) : 0;
  const mediumPct = totalCount > 0 ? Math.round((mediumCount / totalCount) * 100) : 0;
  const lowPct = totalCount > 0 ? Math.round((lowCount / totalCount) * 100) : 0;

  // Active base dataset according to scope tab
  const baseDataset = scopeTab === 'MY' ? myHazards : hazards;

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

  // Delete Hazard Handler
  const handleDeleteHazard = async (hazard, e) => {
    e?.stopPropagation();
    const isMine = user?.id && (hazard.reported_by_id === user.id || hazard.reported_by === user.id);
    const canDelete = isNodalOfficer || isMine;

    if (!canDelete) {
      alert('Access Denied: Drivers can only delete hazards they reported.');
      return;
    }

    const confirmPrompt = isNodalOfficer && !isMine
      ? `[GOVERNMENT AUTHORITY OVERRIDE]\nAre you sure you want to resolve and permanently delete "${hazard.title}" across the 8 NER states?`
      : `Are you sure you want to clear and delete your hazard report for "${hazard.title}"?`;

    if (!window.confirm(confirmPrompt)) return;

    setDeletingId(hazard.id);
    try {
      const { error } = await supabase
        .from('road_hazards')
        .delete()
        .eq('id', hazard.id);

      if (error) throw error;

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
  };

  return (
    <div className="flex-1 p-5 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto w-full font-sans">
      
      {/* 1. HERO HEADER SECTION with Mountain Theme & Live Clock */}
      <div className="relative rounded-3xl bg-gradient-to-r from-blue-50/70 via-slate-50/60 to-white/90 dark:from-slate-900/80 dark:via-slate-900/60 dark:to-slate-950/80 border border-slate-200/90 dark:border-slate-800/90 p-6 sm:p-7 shadow-xs overflow-hidden">
        
        {/* Soft mountain art backdrop */}
        <div className="absolute right-0 top-0 bottom-0 w-1/3 pointer-events-none opacity-15 dark:opacity-10 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-400 via-sky-300 to-transparent" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          
          {/* Left Title & Subtitle */}
          <div className="space-y-1.5 max-w-2xl">
            <div className="flex items-center space-x-2">
              <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-blue-600 dark:text-cyan-400 bg-blue-100/70 dark:bg-blue-950/80 px-2 py-0.5 rounded-md border border-blue-200/60 dark:border-blue-800/60">
                # HAZARD MONITORING & DELETION
              </span>
              {isNodalOfficer && (
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 bg-amber-100/70 dark:bg-amber-950/80 px-2 py-0.5 rounded-md border border-amber-200/60 dark:border-amber-800/60 flex items-center gap-1">
                  <Shield className="w-3 h-3 text-amber-500" />
                  <span>AUTHORITY OVERRIDE ENABLED</span>
                </span>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              Field Road Hazards Directory
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
              Real-time PostGIS ground hazard alerts, situational road logs, and scoped clearance management across 8 NER States.
            </p>
          </div>

          {/* Right Slogan & Live Clock Widget */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 lg:gap-6 shrink-0">
            <div className="text-right hidden sm:block">
              <span className="text-xs font-serif italic text-slate-700 dark:text-slate-300 font-medium block">
                &ldquo;Better Intelligence, Safer Communities&rdquo;
              </span>
              <div className="w-12 h-0.5 bg-blue-500 rounded-full ml-auto mt-1" />
            </div>

            <LiveClockWidget />
          </div>

        </div>

      </div>

      {/* 2. SUMMARY METRICS ROW (5 Cards) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        
        {/* Card 1: Total Incidents */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200/90 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
              Total Incidents
            </span>
            <div className="w-8 h-8 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-100 dark:border-rose-900 flex items-center justify-center text-rose-500">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-slate-900 dark:text-white font-mono">
              {totalCount}
            </span>
            <p className="text-[10px] text-slate-400 mt-0.5">
              {totalCount === 0 ? 'No active records' : `${totalCount} active alert${totalCount > 1 ? 's' : ''}`}
            </p>
          </div>
        </div>

        {/* Card 2: Critical */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200/90 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
              Critical
            </span>
            <div className="w-8 h-8 rounded-xl bg-pink-50 dark:bg-pink-950/60 border border-pink-100 dark:border-pink-900 flex items-center justify-center text-pink-500">
              <BarChart2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-slate-900 dark:text-white font-mono">
              {criticalCount}
            </span>
            <p className="text-[10px] text-slate-400 mt-0.5">
              {criticalPct}% of total
            </p>
          </div>
        </div>

        {/* Card 3: High */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200/90 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
              High
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-100 dark:border-amber-900 flex items-center justify-center text-amber-500">
              <AlertCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-slate-900 dark:text-white font-mono">
              {highCount}
            </span>
            <p className="text-[10px] text-slate-400 mt-0.5">
              {highPct}% of total
            </p>
          </div>
        </div>

        {/* Card 4: Medium */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200/90 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
              Medium
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-100 dark:border-blue-900 flex items-center justify-center text-blue-500">
              <ShieldAlert className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-slate-900 dark:text-white font-mono">
              {mediumCount}
            </span>
            <p className="text-[10px] text-slate-400 mt-0.5">
              {mediumPct}% of total
            </p>
          </div>
        </div>

        {/* Card 5: Low */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200/90 dark:border-slate-800 shadow-xs flex flex-col justify-between col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
              Low
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-100 dark:border-emerald-900 flex items-center justify-center text-emerald-500">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-slate-900 dark:text-white font-mono">
              {lowCount}
            </span>
            <p className="text-[10px] text-slate-400 mt-0.5">
              {lowPct}% of total
            </p>
          </div>
        </div>

      </div>

      {/* 3. MAIN HAZARD RECORDS CONTAINER CARD WITH TWO-TAB SCOPE SWITCHER */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-xs p-5 sm:p-6 space-y-5">
        
        {/* Container Header Bar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
          
          {/* Two-Tab Scope Switcher: [ All Regional Hazards ] vs [ My Reported Hazards ] */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl font-mono text-xs select-none">
            <button
              type="button"
              onClick={() => setScopeTab('ALL')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl font-bold transition-all cursor-pointer ${
                scopeTab === 'ALL'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-slate-900/60'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>All Regional Hazards</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                scopeTab === 'ALL' ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
              }`}>
                {hazards.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setScopeTab('MY')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl font-bold transition-all cursor-pointer ${
                scopeTab === 'MY'
                  ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-slate-900/60'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>My Reported Hazards</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                scopeTab === 'MY' ? 'bg-slate-950/20 text-slate-950 font-bold' : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
              }`}>
                {myHazards.length}
              </span>
            </button>
          </div>

          {/* Right Filters & Action Button */}
          <div className="flex flex-wrap items-center gap-2.5">
            
            {/* Inline Search Input */}
            <div className="relative min-w-[180px] flex-1 sm:flex-initial">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search title, road, sector..."
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 font-sans"
              />
            </div>

            {/* State Filter Dropdown */}
            <div className="relative">
              <select
                value={stateFilter}
                onChange={(e) => setStateFilter(e.target.value)}
                className="appearance-none bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl pl-3 pr-8 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
              >
                {statesList.map((st) => (
                  <option key={st} value={st}>
                    {st === 'ALL' ? 'All States' : st}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* Severity Filter Dropdown */}
            <div className="relative">
              <select
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value)}
                className="appearance-none bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl pl-3 pr-8 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
              >
                <option value="ALL">All Severities</option>
                <option value="Critical">🔴 Critical</option>
                <option value="High">🟠 High</option>
                <option value="Medium">🟡 Medium</option>
                <option value="Low">🟢 Low</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* Eye-Catching Emergency Report Hazard Button */}
            <button
              type="button"
              onClick={() => setReportModalOpen(true)}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-gradient-to-r from-rose-500 via-red-500 to-orange-500 hover:from-rose-400 hover:to-orange-400 text-white font-bold text-xs shadow-lg shadow-rose-500/25 border border-rose-400/30 active:scale-95 transition-all duration-150 cursor-pointer"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-white shrink-0" />
              <span className="tracking-wide uppercase">+ Report Hazard</span>
            </button>

          </div>

        </div>

        {/* 4. CONTENT: RESPONSIVE MOBILE CARDS (< md) + DESKTOP TABLE (md+) */}
        {filteredHazards.length === 0 ? (
          <div className="py-16 flex flex-col items-center justify-center text-center space-y-4">
            
            {/* Empty state illustration */}
            <div className="relative">
              <div className="w-20 h-20 rounded-3xl bg-blue-50/60 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/60 flex items-center justify-center text-blue-500">
                <FileText className="w-9 h-9 stroke-[1.5]" />
              </div>
              <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-[11px] font-black shadow-sm">
                ⚡
              </div>
            </div>

            <div className="space-y-1 max-w-sm">
              <h4 className="text-base font-bold text-slate-900 dark:text-white">
                {scopeTab === 'MY' ? 'No personal hazard reports' : 'No incident records found'}
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {scopeTab === 'MY' 
                  ? 'You have not submitted any active hazard reports in the transit network yet.' 
                  : 'No incident records match the current filter criteria across the 8 NER states.'}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setReportModalOpen(true)}
              className="mt-3 flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-rose-500 via-red-500 to-orange-500 hover:from-rose-400 hover:to-orange-400 text-white font-bold text-xs shadow-lg shadow-rose-500/25 border border-rose-400/30 transition-all active:scale-95 cursor-pointer"
            >
              <AlertTriangle className="w-4 h-4 text-white" />
              <span>+ Report Hazard</span>
            </button>

          </div>
        ) : (
          <>
            {/* Mobile Card List (< md) */}
            <div className="md:hidden space-y-3">
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
                const hasVideo = mediaList.some(m => /\.(mp4|webm|mov|ogg|m4v)(\?.*)?$/i.test(m));

                return (
                  <div 
                    key={`mob-haz-${h.id || idx}`}
                    className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs space-y-3 font-sans"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                            {h.title || 'Road Hazard Incident'}
                          </h4>
                          {isMine && (
                            <span className="px-1.5 py-0.2 rounded text-[8.5px] font-mono font-bold bg-cyan-100 dark:bg-cyan-950/80 text-cyan-800 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-800">
                              MY REPORT
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1 font-medium">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{st}, {dt}</span>
                        </p>
                      </div>

                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border shrink-0 ${sevBadge}`}>
                        {h.severity || 'Moderate'}
                      </span>
                    </div>

                    {(h.description || h.notes) && (
                      <p className="text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-950/60 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800/80 leading-relaxed">
                        {h.description || h.notes}
                      </p>
                    )}

                    <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 font-mono">
                      <span>GPS: {parseFloat(h.latitude).toFixed(4)}, {parseFloat(h.longitude).toFixed(4)}</span>
                      {mediaList.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setViewingMediaHazard(h)}
                          className="inline-flex items-center space-x-1 px-2 py-1 rounded-lg bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-cyan-300 font-bold border border-blue-200 dark:border-blue-800 cursor-pointer"
                        >
                          {hasVideo ? <Film className="w-3 h-3 text-cyan-500" /> : <ImageIcon className="w-3 h-3 text-blue-500" />}
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
                        className="py-2.5 px-3 bg-blue-50 dark:bg-blue-950 hover:bg-blue-100 dark:hover:bg-blue-900 text-blue-600 dark:text-cyan-400 font-bold text-xs rounded-xl border border-blue-200 dark:border-blue-800 transition-colors flex items-center justify-center space-x-1.5 cursor-pointer min-h-[44px] active:scale-98"
                      >
                        <Navigation className="w-3.5 h-3.5" />
                        <span>Locate on Map</span>
                      </button>

                      {isNodalOfficer ? (
                        <button
                          type="button"
                          onClick={(e) => handleDeleteHazard(h, e)}
                          disabled={deletingId === h.id}
                          className="py-2.5 px-3 bg-red-50 dark:bg-red-950/60 hover:bg-red-100 dark:hover:bg-red-900/80 text-red-700 dark:text-red-300 font-bold text-xs rounded-xl border border-red-200 dark:border-red-800 transition-colors flex items-center justify-center space-x-1.5 cursor-pointer disabled:opacity-50 min-h-[44px] active:scale-98"
                        >
                          {deletingId === h.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <ShieldAlert className="w-3.5 h-3.5 text-red-500" />
                          )}
                          <span>Override Delete</span>
                        </button>
                      ) : isMine ? (
                        <button
                          type="button"
                          onClick={(e) => handleDeleteHazard(h, e)}
                          disabled={deletingId === h.id}
                          className="py-2.5 px-3 bg-red-50 dark:bg-red-950/60 hover:bg-red-100 dark:hover:bg-red-900/80 text-red-700 dark:text-red-300 font-bold text-xs rounded-xl border border-red-200 dark:border-red-800 transition-colors flex items-center justify-center space-x-1.5 cursor-pointer disabled:opacity-50 min-h-[44px] active:scale-98"
                        >
                          {deletingId === h.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="w-3.5 h-3.5 text-red-500" />
                          )}
                          <span>Clear Hazard</span>
                        </button>
                      ) : (
                        <div className="py-2.5 px-3 bg-slate-100 dark:bg-slate-800/60 text-slate-400 rounded-xl text-xs font-mono flex items-center justify-center space-x-1 border border-slate-200 dark:border-slate-800 select-none min-h-[44px]">
                          <Lock className="w-3 h-3" />
                          <span>Read-Only</span>
                        </div>
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
                  <tr className="border-b border-slate-100 dark:border-slate-800 text-[10px] font-bold font-mono text-slate-400 uppercase tracking-wider">
                    <th className="pb-3 pl-2">#</th>
                    <th className="pb-3">Hazard / Road Event</th>
                    <th className="pb-3">Severity</th>
                    <th className="pb-3">Location & Sector</th>
                    <th className="pb-3">Coordinates (Lat, Lng)</th>
                    <th className="pb-3">Reporter / Source</th>
                    <th className="pb-3">Evidence</th>
                    <th className="pb-3 pr-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
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

                    return (
                      <tr key={h.id || `haz-${idx}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="py-3 pl-2 font-mono text-slate-400 font-bold">
                          {idx + 1}
                        </td>
                        <td className="py-3">
                          <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center space-x-1.5">
                            <span>{h.title || 'Road Hazard Incident'}</span>
                            {isMine && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-cyan-100 dark:bg-cyan-950/80 text-cyan-800 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-800">
                                MY REPORT
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">
                            {h.description || h.notes || 'Field alert logged'}
                          </div>
                        </td>
                        <td className="py-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${sevBadge}`}>
                            {h.severity || 'Moderate'}
                          </span>
                        </td>
                        <td className="py-3 font-medium text-slate-700 dark:text-slate-300">
                          {(() => {
                            const geo = estimateNerLocationFallback(parseFloat(h.latitude), parseFloat(h.longitude));
                            const st = (h.state && h.state !== 'null' && h.state !== 'NER' && !(h.state === 'Assam' && h.district === 'Unspecified Sector'))
                              ? h.state
                              : geo.state;
                            const dt = (h.district && h.district !== 'Unspecified Sector' && h.district !== 'null' && h.district !== '')
                              ? h.district
                              : geo.district;
                            return (
                              <div>
                                <span className="font-bold text-slate-900 dark:text-slate-100">{st}</span>
                                <span className="text-slate-500 dark:text-slate-400 font-normal">, {dt}</span>
                              </div>
                            );
                          })()}
                        </td>
                        <td className="py-3 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                          {parseFloat(h.latitude).toFixed(4)}, {parseFloat(h.longitude).toFixed(4)}
                        </td>
                        <td className="py-3 text-slate-600 dark:text-slate-400">
                          {h.reported_by_name || 'Field Driver'}
                        </td>
                        <td className="py-3">
                          {(() => {
                            const mediaList = Array.isArray(h.media_urls) && h.media_urls.length > 0
                              ? h.media_urls
                              : (h.image_url || h.photo_url ? [h.image_url || h.photo_url] : []);
                            
                            if (mediaList.length === 0) {
                              return <span className="text-slate-400 text-[10px] font-mono">None</span>;
                            }

                            const hasVideo = mediaList.some(m => /\.(mp4|webm|mov|ogg|m4v)(\?.*)?$/i.test(m));

                            return (
                              <button
                                type="button"
                                onClick={() => setViewingMediaHazard(h)}
                                className="inline-flex items-center space-x-1.5 px-2 py-0.5 rounded-lg bg-blue-50 dark:bg-blue-950/80 hover:bg-blue-100 dark:hover:bg-blue-900/80 text-blue-700 dark:text-cyan-300 border border-blue-200 dark:border-blue-800 text-[11px] font-bold transition-all cursor-pointer shadow-2xs"
                                title="View uploaded evidence photos and videos"
                              >
                                {hasVideo ? <Film className="w-3 h-3 text-cyan-500" /> : <ImageIcon className="w-3 h-3 text-blue-500" />}
                                <span>{mediaList.length} Media{mediaList.length > 1 ? 's' : ''}</span>
                              </button>
                            );
                          })()}
                        </td>
                        <td className="py-3 pr-2 text-right">
                          <div className="inline-flex items-center space-x-1.5">
                            
                            {/* Locate on map button */}
                            <button
                              type="button"
                              onClick={() => {
                                if (onSelectHazardOnMap) {
                                  onSelectHazardOnMap(h);
                                }
                              }}
                              className="px-2.5 py-1 bg-blue-50 dark:bg-blue-950 hover:bg-blue-100 dark:hover:bg-blue-900 text-blue-600 dark:text-cyan-400 font-bold text-[11px] rounded-lg border border-blue-200 dark:border-blue-800 transition-colors inline-flex items-center space-x-1 cursor-pointer"
                              title="Locate hazard on interactive GIS map"
                            >
                              <Navigation className="w-3 h-3" />
                              <span>Locate</span>
                            </button>

                            {/* Scoped Delete / Authority Override Action */}
                            {isNodalOfficer ? (
                              <button
                                type="button"
                                onClick={(e) => handleDeleteHazard(h, e)}
                                disabled={deletingId === h.id}
                                title="Government Nodal Authority Override: Resolve & Delete Record"
                                className="px-2.5 py-1 bg-red-50 dark:bg-red-950/60 hover:bg-red-100 dark:hover:bg-red-900/80 text-red-700 dark:text-red-300 font-bold text-[11px] rounded-lg border border-red-200 dark:border-red-800 transition-colors inline-flex items-center space-x-1 cursor-pointer disabled:opacity-50"
                              >
                                {deletingId === h.id ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <ShieldAlert className="w-3 h-3 text-red-500" />
                                )}
                                <span>Override: Delete</span>
                              </button>
                            ) : isMine ? (
                              <button
                                type="button"
                                onClick={(e) => handleDeleteHazard(h, e)}
                                disabled={deletingId === h.id}
                                title="Clear & Delete My Hazard Report"
                                className="px-2.5 py-1 bg-red-50 dark:bg-red-950/60 hover:bg-red-100 dark:hover:bg-red-900/80 text-red-700 dark:text-red-300 font-bold text-[11px] rounded-lg border border-red-200 dark:border-red-800 transition-colors inline-flex items-center space-x-1 cursor-pointer disabled:opacity-50"
                              >
                                {deletingId === h.id ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <Trash2 className="w-3 h-3 text-red-500" />
                                )}
                                <span>Clear Hazard</span>
                              </button>
                            ) : (
                              <span 
                                title="Read-only: Only the reporting driver or state authority can resolve this hazard"
                                className="px-2 py-1 bg-slate-100 dark:bg-slate-800/60 text-slate-400 rounded-lg text-[10px] font-mono inline-flex items-center space-x-1 border border-slate-200 dark:border-slate-800 select-none cursor-default"
                              >
                                <Lock className="w-2.5 h-2.5" />
                                <span>Read-Only</span>
                              </span>
                            )}

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

      {/* Multi-Media Evidence Viewer Modal */}
      {viewingMediaHazard && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="relative w-full max-w-2xl bg-slate-900 text-white rounded-3xl shadow-2xl overflow-hidden border border-slate-700 flex flex-col max-h-[90vh]">
            
            {/* Header */}
            <div className="p-4 sm:p-5 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="flex items-center space-x-2">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-rose-400 bg-rose-950/80 px-2 py-0.5 rounded border border-rose-800">
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
                className="text-slate-400 hover:text-white p-1 rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Media Gallery Grid */}
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

            {/* Footer */}
            <div className="p-4 bg-slate-950 border-t border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setViewingMediaHazard(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Close Viewer
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Report Hazard Modal */}
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
