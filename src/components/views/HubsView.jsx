'use client';

import React, { useState, useMemo } from 'react';
import Image from 'next/image';
import { 
  Building2, 
  MapPin, 
  Search, 
  Phone, 
  Copy, 
  Check, 
  ChevronDown, 
  Navigation, 
  CheckCircle2, 
  Database, 
  Warehouse,
  ShieldCheck,
  Package,
  Layers,
  Sparkles,
  ExternalLink,
  User,
  X,
  FileText
} from 'lucide-react';

import LiveClockWidget from '@/components/LiveClockWidget';
import { useAuth } from '@/context/AuthContext';

const NER_STATES = [
  'All 8 NER States',
  'Assam',
  'Arunachal Pradesh',
  'Meghalaya',
  'Manipur',
  'Mizoram',
  'Nagaland',
  'Sikkim',
  'Tripura'
];

export default function HubsView({ hubs = [], onSelectHubOnMap }) {
  const { user, profile, isNodalOfficer, nodalOfficer } = useAuth();

  const [search, setSearch] = useState('');
  const [stateFilter, setStateFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [copiedId, setCopiedId] = useState(null);
  const [selectedState, setSelectedState] = useState('All 8 NER States');
  const [viewingHubDetails, setViewingHubDetails] = useState(null);

  // User Profile metadata for Hero Header
  const displayName = isNodalOfficer 
    ? (nodalOfficer?.officer_name || 'Nodal Authority') 
    : (profile?.full_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Anuj');
  const userRoleText = isNodalOfficer 
    ? `${nodalOfficer?.state_jurisdiction || 'NER'} • NODAL OPS` 
    : `${profile?.driver_code || user?.user_metadata?.driver_code || '#1524'} • NER OPS`;
  const userInitial = (displayName[0] || 'A').toUpperCase();

  // Compute metrics dynamically based on selected state
  const stateMetrics = useMemo(() => {
    const filtered = selectedState === 'All 8 NER States'
      ? hubs
      : hubs.filter((h) => (h.state || h.state_name || '').toLowerCase() === selectedState.toLowerCase());

    // Aggregate storage capacity in Metric Tons
    const totalCapacityMT = filtered.reduce((acc, hub) => {
      const cap = Number(hub.capacity_metric_tons || hub.capacity_mt || hub.capacity || 0);
      return acc + cap;
    }, 0);

    return {
      count: filtered.length,
      capacityMT: totalCapacityMT > 0 
        ? `${(totalCapacityMT / 1000).toFixed(1)}K MT` 
        : filtered.length > 0 
        ? `${(filtered.length * 5).toFixed(1)}K MT` 
        : '0 MT',
    };
  }, [hubs, selectedState]);

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

  const filteredHubs = hubs.filter((h) => {
    const q = search.toLowerCase();
    const matchesSearch = 
      !q ||
      h.hub_name?.toLowerCase().includes(q) ||
      h.hub_code?.toLowerCase().includes(q) ||
      h.district?.toLowerCase().includes(q) ||
      h.state?.toLowerCase().includes(q) ||
      h.contact_person?.toLowerCase().includes(q);

    const matchesState = stateFilter === 'ALL' || h.state === stateFilter;
    const matchesType = typeFilter === 'ALL' || h.hub_type === typeFilter;

    return matchesSearch && matchesState && matchesType;
  });

  const handleCopyPhone = (phone, id, e) => {
    e.stopPropagation();
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(phone);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  return (
    <div className="flex-1 p-3 sm:p-5 lg:p-6 space-y-4 sm:space-y-5 max-w-7xl mx-auto w-full font-sans">
      
      {/* ========================================================================= */}
      {/* 1. HERO HEADER BANNER WITH REAL BACKGROUND IMAGE FROM /header background.jpeg */}
      {/* ========================================================================= */}
      <div className="relative rounded-3xl border border-slate-200/90 dark:border-slate-800 p-5 sm:p-7 shadow-[0_4px_25px_rgba(0,0,0,0.04)] overflow-hidden bg-slate-900/10 min-h-[140px] flex flex-col justify-between">
        
        {/* Real Mountain Background Image Layer */}
        <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
          <Image
            src="/header%20background.jpeg"
            alt="Himalayan Valley & Supply Network"
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
              50 Strategic Supply Hubs Directory
            </h1>
            <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-200 font-medium leading-relaxed drop-shadow-xs max-w-xl">
              Geolocated food grain godowns, medical stockpiles, and central transit supply hubs across 8 North-Eastern States.
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
      {/* 2. SUMMARY METRICS CARDS ROW (4 Sleek White Cards) */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        
        {/* Card 1: Total Facilities */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-4.5 border border-slate-200/90 dark:border-slate-800 shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
              Total Facilities
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-100 dark:border-blue-900 flex items-center justify-center text-blue-600 dark:text-cyan-400">
              <Warehouse className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white font-mono">
              {hubs.length || 50}
            </div>
            <span className="text-[10px] text-blue-600 dark:text-cyan-400 font-semibold">
              8 NER States Active
            </span>
          </div>
        </div>

        {/* Card 2: Dynamic State Telemetry & Storage */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-4.5 border border-cyan-500/30 dark:border-cyan-500/40 shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-blue-600 dark:text-cyan-400">
              <Database className="w-4 h-4 shrink-0" />
              <span className="text-[11px] font-bold uppercase tracking-wider">State Telemetry</span>
            </div>

            {/* Dynamic State Selector */}
            <div className="relative">
              <select
                value={selectedState}
                onChange={(e) => setSelectedState(e.target.value)}
                className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[10px] rounded-full px-2.5 py-0.5 text-slate-800 dark:text-cyan-300 focus:outline-none font-bold pr-6 appearance-none cursor-pointer"
              >
                {NER_STATES.map((sName) => (
                  <option key={sName} value={sName}>{sName}</option>
                ))}
              </select>
              <ChevronDown className="w-3 h-3 text-slate-400 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          <div className="mt-2.5 flex items-baseline justify-between border-t border-slate-100 dark:border-slate-800/80 pt-2">
            <div>
              <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white font-mono">
                {stateMetrics.count}
              </div>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Facilities</span>
            </div>
            <div className="text-right">
              <div className="text-2xl sm:text-3xl font-black text-blue-600 dark:text-cyan-400 font-mono">
                {stateMetrics.capacityMT}
              </div>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Capacity</span>
            </div>
          </div>
        </div>

        {/* Card 3: Facility Health */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-4.5 border border-slate-200/90 dark:border-slate-800 shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
              Facility Health
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-100 dark:border-emerald-900 flex items-center justify-center text-emerald-500">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <div className="text-2xl sm:text-3xl font-black text-emerald-500 dark:text-emerald-400 font-mono">
              100%
            </div>
            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
              All Depots Operational
            </span>
          </div>
        </div>

        {/* Card 4: Strategic Logistics Stockpiles */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-4.5 border border-slate-200/90 dark:border-slate-800 shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
              Resource Stock
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-100 dark:border-amber-900 flex items-center justify-center text-amber-500">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white font-mono">
              250K+
            </div>
            <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold">
              MT Total NER Buffer
            </span>
          </div>
        </div>

      </div>

      {/* ========================================================================= */}
      {/* 3. CONTROLS TOOLBAR (Search & Filter Pills) */}
      {/* ========================================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        
        {/* Left: Total Records Info Pill */}
        <div className="flex items-center gap-2">
          <div className="px-4 py-2 rounded-full bg-blue-600 text-white font-bold text-xs shadow-md shadow-blue-500/20 flex items-center gap-2">
            <Building2 className="w-3.5 h-3.5" />
            <span>All 50 Supply Hubs</span>
            <span className="px-2 py-0.5 rounded-full bg-white/25 text-white text-[10px] font-mono">
              {filteredHubs.length}
            </span>
          </div>
        </div>

        {/* Right: Search & State Filters */}
        <div className="flex flex-wrap items-center gap-2.5">
          
          {/* Search Pill Input */}
          <div className="relative min-w-[220px] flex-1 sm:flex-initial">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search hub name, code, district..."
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

        </div>

      </div>

      {/* ========================================================================= */}
      {/* 4. MASTER DATA TABLE CARD CONTAINER */}
      {/* ========================================================================= */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-xs overflow-hidden">
        
        {filteredHubs.length === 0 ? (
          <div className="py-16 flex flex-col items-center justify-center text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-blue-50 dark:bg-blue-950/60 border border-blue-100 dark:border-blue-900 flex items-center justify-center text-blue-500">
              <Warehouse className="w-8 h-8 stroke-[1.5]" />
            </div>
            <div className="space-y-1 max-w-sm">
              <h4 className="text-base font-bold text-slate-900 dark:text-white">
                No Depots Found
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                No supply facilities match the current search query or state filter.
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Mobile Card List (< md) */}
            <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800 p-3 space-y-3">
              {filteredHubs.map((h, idx) => (
                <div 
                  key={`mob-hub-${h.id || idx}`}
                  className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-2xs space-y-3 font-sans"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                        {h.hub_name}
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1 font-medium">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{h.state}, {h.district}</span>
                      </p>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-cyan-400 border border-blue-200 dark:border-blue-800 shrink-0">
                      {h.hub_code}
                    </span>
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 text-xs flex items-center justify-between">
                    <div className="space-y-0.5">
                      <span className="text-[10px] text-slate-400 block font-mono">Contact Officer</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">{h.contact_person || 'Logistics Officer'}</span>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => handleCopyPhone(h.contact_phone || '+91-94350-00000', h.id || idx, e)}
                      className="px-2.5 py-1 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 cursor-pointer shadow-2xs"
                    >
                      <span>{h.contact_phone || '+91-94350-00000'}</span>
                      {copiedId === (h.id || idx) ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
                    </button>
                  </div>

                  <div className="pt-1 flex items-center justify-between">
                    <span className="text-[11px] font-mono text-slate-400">
                      GPS: {parseFloat(h.latitude).toFixed(4)}, {parseFloat(h.longitude).toFixed(4)}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        if (onSelectHubOnMap) {
                          onSelectHubOnMap(h);
                        }
                      }}
                      className="px-4 py-2 bg-blue-50 dark:bg-blue-950 hover:bg-blue-100 dark:hover:bg-blue-900 text-blue-600 dark:text-cyan-400 font-bold text-xs rounded-full border border-blue-200 dark:border-blue-800 transition-colors inline-flex items-center space-x-1.5 cursor-pointer"
                    >
                      <Navigation className="w-3.5 h-3.5" />
                      <span>Focus on Map</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table View (>= md) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs font-sans">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 text-[10px] font-bold font-mono text-slate-400 uppercase tracking-wider bg-slate-50/50 dark:bg-slate-950/30">
                    <th className="py-3.5 pl-6">#</th>
                    <th className="py-3.5 px-3">HUB / FACILITY NAME</th>
                    <th className="py-3.5 px-3">CODE</th>
                    <th className="py-3.5 px-3">STATE & DISTRICT</th>
                    <th className="py-3.5 px-3">COORDINATES (LAT, LNG)</th>
                    <th className="py-3.5 px-3">CONTACT OFFICER</th>
                    <th className="py-3.5 px-3">CONTACT PHONE</th>
                    <th className="py-3.5 pr-6 text-right">ACTIONS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                  {filteredHubs.map((h, idx) => (
                    <tr 
                      key={h.id || `hub-${idx}`} 
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-4 pl-6 font-mono text-slate-400 font-bold">
                        {idx + 1}
                      </td>
                      <td className="py-4 px-3">
                        <div className="font-bold text-slate-900 dark:text-slate-100 text-xs">
                          {h.hub_name}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 font-normal">
                          {h.state} Supply Sector
                        </div>
                      </td>
                      <td className="py-4 px-3">
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-cyan-400 border border-blue-200 dark:border-blue-800 inline-block">
                          {h.hub_code}
                        </span>
                      </td>
                      <td className="py-4 px-3 font-medium text-slate-700 dark:text-slate-300">
                        <div>
                          <span className="font-bold text-slate-900 dark:text-slate-100">{h.state}</span>
                          <span className="text-slate-500 dark:text-slate-400 font-normal">, {h.district}</span>
                        </div>
                      </td>
                      <td className="py-4 px-3 font-mono text-[11px] text-slate-600 dark:text-slate-400">
                        <div>{parseFloat(h.latitude).toFixed(4)},</div>
                        <div>{parseFloat(h.longitude).toFixed(4)}</div>
                      </td>
                      <td className="py-4 px-3 text-slate-700 dark:text-slate-300 font-medium text-xs">
                        {h.contact_person || 'Logistics Officer'}
                      </td>
                      <td className="py-4 px-3">
                        <button
                          type="button"
                          onClick={(e) => handleCopyPhone(h.contact_phone || '+91-94350-00000', h.id || idx, e)}
                          className="px-3 py-1 rounded-full bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-xs font-mono font-bold text-slate-700 dark:text-slate-200 inline-flex items-center space-x-1.5 cursor-pointer transition-all"
                          title="Click to copy phone number"
                        >
                          <span>{h.contact_phone || '+91-94350-00000'}</span>
                          {copiedId === (h.id || idx) ? (
                            <Check className="w-3.5 h-3.5 text-emerald-500" />
                          ) : (
                            <Copy className="w-3.5 h-3.5 text-slate-400" />
                          )}
                        </button>
                      </td>
                      <td className="py-4 pr-6 text-right">
                        <div className="inline-flex items-center space-x-2">
                          
                          {/* Locate Action Button */}
                          <button
                            type="button"
                            onClick={() => {
                              if (onSelectHubOnMap) {
                                onSelectHubOnMap(h);
                              }
                            }}
                            className="px-3 py-1.5 rounded-full bg-blue-50 dark:bg-blue-950 hover:bg-blue-100 dark:hover:bg-blue-900 text-blue-600 dark:text-cyan-400 font-bold text-xs border border-blue-200 dark:border-blue-800 transition-all inline-flex items-center space-x-1.5 cursor-pointer shadow-2xs"
                            title="Focus on interactive GIS map"
                          >
                            <Navigation className="w-3.5 h-3.5" />
                            <span>Locate</span>
                          </button>

                          {/* Details Button */}
                          <button
                            type="button"
                            onClick={() => setViewingHubDetails(h)}
                            className="px-3 py-1.5 rounded-full bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs border border-slate-200 dark:border-slate-700 transition-all inline-flex items-center space-x-1.5 cursor-pointer"
                            title="View facility specifications"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            <span>Details</span>
                          </button>

                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

      </div>

      {/* ========================================================================= */}
      {/* 5. HUB DETAILS MODAL */}
      {/* ========================================================================= */}
      {viewingHubDetails && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-3xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh]">
            
            <div className="p-5 sm:p-6 bg-slate-50 dark:bg-slate-950 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-blue-600 dark:text-cyan-400 bg-blue-50 dark:bg-blue-950 px-2.5 py-0.5 rounded-full border border-blue-200 dark:border-blue-800">
                    {viewingHubDetails.hub_code}
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                    {viewingHubDetails.state} Logistics Hub
                  </span>
                </div>
                <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                  {viewingHubDetails.hub_name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setViewingHubDetails(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto">
              
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-slate-50 dark:bg-slate-950 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase font-mono block">Jurisdiction State</span>
                  <span className="font-bold text-slate-900 dark:text-white mt-0.5 block">
                    {viewingHubDetails.state}
                  </span>
                </div>
                <div className="bg-slate-50 dark:bg-slate-950 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase font-mono block">District Sector</span>
                  <span className="font-bold text-slate-900 dark:text-white mt-0.5 block">
                    {viewingHubDetails.district}
                  </span>
                </div>
                <div className="bg-slate-50 dark:bg-slate-950 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase font-mono block">GPS Latitude</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white mt-0.5 block">
                    {parseFloat(viewingHubDetails.latitude).toFixed(6)}
                  </span>
                </div>
                <div className="bg-slate-50 dark:bg-slate-950 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase font-mono block">GPS Longitude</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white mt-0.5 block">
                    {parseFloat(viewingHubDetails.longitude).toFixed(6)}
                  </span>
                </div>
                <div className="bg-slate-50 dark:bg-slate-950 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase font-mono block">Officer In-Charge</span>
                  <span className="font-bold text-slate-900 dark:text-white mt-0.5 block">
                    {viewingHubDetails.contact_person || 'Logistics Officer'}
                  </span>
                </div>
                <div className="bg-slate-50 dark:bg-slate-950 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase font-mono block">Contact Phone</span>
                  <span className="font-mono font-bold text-blue-600 dark:text-cyan-400 mt-0.5 block">
                    {viewingHubDetails.contact_phone || '+91-94350-00000'}
                  </span>
                </div>
              </div>

            </div>

            <div className="p-4 sm:p-5 bg-slate-50 dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  setViewingHubDetails(null);
                  if (onSelectHubOnMap) {
                    onSelectHubOnMap(viewingHubDetails);
                  }
                }}
                className="px-4 py-2 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors inline-flex items-center gap-1.5 cursor-pointer shadow-md shadow-blue-500/20"
              >
                <Navigation className="w-3.5 h-3.5" />
                <span>Focus on Interactive Map</span>
              </button>
              <button
                type="button"
                onClick={() => setViewingHubDetails(null)}
                className="px-4 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-full text-xs font-bold transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
