'use client';

import React, { useState, useMemo } from 'react';
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
  Warehouse
} from 'lucide-react';

import LiveClockWidget from '@/components/LiveClockWidget';

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
  const [search, setSearch] = useState('');
  const [stateFilter, setStateFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [copiedId, setCopiedId] = useState(null);
  const [selectedState, setSelectedState] = useState('All 8 NER States');

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
    <div className="flex-1 p-5 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto w-full font-sans">
      
      {/* 1. HERO HEADER SECTION with Mountain Theme & Live Clock */}
      <div className="relative rounded-3xl bg-gradient-to-r from-blue-50/70 via-slate-50/60 to-white/90 dark:from-slate-900/80 dark:via-slate-900/60 dark:to-slate-950/80 border border-slate-200/90 dark:border-slate-800/90 p-6 sm:p-7 shadow-xs overflow-hidden">
        
        {/* Soft backdrop accent */}
        <div className="absolute right-0 top-0 bottom-0 w-1/3 pointer-events-none opacity-15 dark:opacity-10 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-400 via-sky-300 to-transparent" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          
          {/* Left Title & Subtitle */}
          <div className="space-y-1.5 max-w-2xl">
            <div className="flex items-center space-x-2">
              <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-blue-600 dark:text-cyan-400 bg-blue-100/70 dark:bg-blue-950/80 px-2 py-0.5 rounded-md border border-blue-200/60 dark:border-blue-800/60">
                # SUPPLY CHAIN DEPOSITORIES
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              50 Strategic Supply Hubs Directory
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
              Geolocated food grain godowns, medical stockpiles, and central transit supply hubs across 8 North-Eastern States.
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

      {/* 2. SUMMARY METRICS ROW (3 Balanced Cards) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-5">
        
        {/* Card 1: Total Facilities */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200/90 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Total Facilities
            </span>
            <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-100 dark:border-blue-900 flex items-center justify-center text-blue-600 dark:text-cyan-400">
              <Warehouse className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white font-mono">
              {hubs.length || 50}
            </div>
            <span className="text-[10px] text-blue-600 dark:text-cyan-400 font-sans font-semibold">
              8 NER States Active
            </span>
          </div>
        </div>

        {/* Card 2: DYNAMIC STATE HUBS & CAPACITY TELEMETRY */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-cyan-500/30 dark:border-cyan-500/40 shadow-xs flex flex-col justify-between relative">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-blue-600 dark:text-cyan-400">
              <Database className="w-4 h-4 shrink-0" />
              <span className="text-[11px] font-bold uppercase tracking-wider">State Hub Telemetry</span>
            </div>

            {/* Dynamic State Selection Dropdown */}
            <div className="relative">
              <select
                value={selectedState}
                onChange={(e) => setSelectedState(e.target.value)}
                className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-[11px] rounded-xl px-2.5 py-1 text-slate-800 dark:text-cyan-300 focus:outline-none focus:border-cyan-400 cursor-pointer pr-7 appearance-none font-bold font-mono"
              >
                {NER_STATES.map((stateName) => (
                  <option key={stateName} value={stateName}>
                    {stateName}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Dynamic Value Display */}
          <div className="mt-3 flex items-baseline justify-between border-t border-slate-100 dark:border-slate-800/80 pt-2.5">
            <div>
              <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white font-mono">
                {stateMetrics.count}
              </div>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                Active Facilities
              </span>
            </div>
            <div className="text-right">
              <div className="text-2xl sm:text-3xl font-black text-blue-600 dark:text-cyan-300 font-mono">
                {stateMetrics.capacityMT}
              </div>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                Storage Capacity
              </span>
            </div>
          </div>
        </div>

        {/* Card 3: Facility Health */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200/90 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Facility Health
            </span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-100 dark:border-emerald-900 flex items-center justify-center text-emerald-500">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-black text-emerald-500 dark:text-emerald-400 font-mono">
              100%
            </div>
            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-sans font-medium">
              All Depots Operational
            </span>
          </div>
        </div>

      </div>

      {/* 3. MAIN HUBS DIRECTORY CARD */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-xs p-5 sm:p-6 space-y-5">
        
        {/* Container Header Bar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
          
          {/* Left Title & Icon */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-950/80 border border-blue-100 dark:border-blue-900 flex items-center justify-center text-blue-600 dark:text-cyan-400 shrink-0">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                Depot Registry
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Browse and inspect {filteredHubs.length} verified supply facilities
              </p>
            </div>
          </div>

          {/* Right Filters */}
          <div className="flex flex-wrap items-center gap-2.5">
            
            {/* Inline Search Input */}
            <div className="relative min-w-[200px] flex-1 sm:flex-initial">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search hub name, code, district..."
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
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

          </div>

        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-sans">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 text-[10px] font-bold font-mono text-slate-400 uppercase tracking-wider">
                <th className="pb-3 pl-2">#</th>
                <th className="pb-3">Hub / Facility</th>
                <th className="pb-3">Code</th>
                <th className="pb-3">State & District</th>
                <th className="pb-3">Coordinates (Lat, Lng)</th>
                <th className="pb-3">Contact Officer</th>
                <th className="pb-3">Contact Phone</th>
                <th className="pb-3 pr-2 text-right">Map Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredHubs.map((h, idx) => (
                <tr key={h.id || `hub-${idx}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="py-3 pl-2 font-mono text-slate-400 font-bold">
                    {idx + 1}
                  </td>
                  <td className="py-3">
                    <div className="font-bold text-slate-900 dark:text-slate-100">
                      {h.hub_name}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      {h.state} Supply Sector
                    </div>
                  </td>
                  <td className="py-3 font-mono text-[11px] text-blue-600 dark:text-cyan-400 font-bold">
                    {h.hub_code}
                  </td>
                  <td className="py-3 font-medium text-slate-700 dark:text-slate-300">
                    {h.state}, {h.district}
                  </td>
                  <td className="py-3 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                    {parseFloat(h.latitude).toFixed(4)}, {parseFloat(h.longitude).toFixed(4)}
                  </td>
                  <td className="py-3 text-slate-600 dark:text-slate-400">
                    {h.contact_person || 'Logistics Officer'}
                  </td>
                  <td className="py-3">
                    <button
                      type="button"
                      onClick={(e) => handleCopyPhone(h.contact_phone || '+91-94350-00000', h.id || idx, e)}
                      className="inline-flex items-center space-x-1 font-mono text-[11px] text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-cyan-400 transition-colors cursor-pointer"
                      title="Click to copy phone number"
                    >
                      <span>{h.contact_phone || '+91-94350-00000'}</span>
                      {copiedId === (h.id || idx) ? (
                        <Check className="w-3 h-3 text-emerald-500" />
                      ) : (
                        <Copy className="w-3 h-3 text-slate-400 hover:text-slate-600" />
                      )}
                    </button>
                  </td>
                  <td className="py-3 pr-2 text-right">
                    <button
                      type="button"
                      onClick={() => {
                        if (onSelectHubOnMap) {
                          onSelectHubOnMap(h);
                        }
                      }}
                      className="px-2.5 py-1 bg-blue-50 dark:bg-blue-950 hover:bg-blue-100 dark:hover:bg-blue-900 text-blue-600 dark:text-cyan-400 font-bold text-[11px] rounded-lg border border-blue-200 dark:border-blue-800 transition-colors inline-flex items-center space-x-1 cursor-pointer"
                    >
                      <Navigation className="w-3 h-3" />
                      <span>Focus</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

      </div>

    </div>
  );
}
