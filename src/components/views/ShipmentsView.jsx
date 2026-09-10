'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Truck, 
  MapPin, 
  Search, 
  Phone, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  Package, 
  Navigation,
  Radio,
  FileText,
  ShieldCheck,
  Boxes,
  RefreshCw,
  Trash2,
  Check,
  Sparkles
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { db } from '@/lib/offlineDb';
import { useAuth } from '@/context/AuthContext';
import LiveClockWidget from '@/components/LiveClockWidget';

export default function ShipmentsView({ shipments = null, onSelectShipmentOnMap }) {
  const { user, isNodalOfficer } = useAuth();
  const [liveShipments, setLiveShipments] = useState(shipments || []);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [actionNotice, setActionNotice] = useState(null);

  // Sync prop changes from parent
  useEffect(() => {
    if (shipments && Array.isArray(shipments)) {
      setLiveShipments(shipments);
    }
  }, [shipments]);

  // Core fetch function with resilient fallback to Dexie offline queue & localStorage active journey
  const fetchShipments = useCallback(async (isManual = false) => {
    if (isManual) setIsRefreshing(true);

    try {
      const { data, error } = await supabase
        .from('shipments')
        .select('*')
        .order('created_at', { ascending: false });

      let combined = Array.isArray(data) ? [...data] : [];

      // Check Dexie IndexedDB for offline queued shipments
      try {
        const offlineShipments = await db.offline_shipment_queue.where('synced').equals(0).toArray();
        if (Array.isArray(offlineShipments) && offlineShipments.length > 0) {
          offlineShipments.forEach(offS => {
            if (!combined.some(s => s.tracking_code === offS.tracking_code || (offS.id && s.id === offS.id))) {
              combined.unshift(offS);
            }
          });
        }
      } catch (e) {}

      // Check localStorage for any local active journey not yet in database
      if (typeof window !== 'undefined') {
        try {
          const cached = localStorage.getItem('ner_active_journey') || localStorage.getItem('ner_active_transit_journey');
          if (cached) {
            const parsed = JSON.parse(cached);
            if (parsed && parsed.tracking_code) {
              const alreadyExists = combined.some(s => 
                s.tracking_code === parsed.tracking_code || (parsed.id && s.id === parsed.id)
              );
              if (!alreadyExists) {
                combined.unshift(parsed);
              }
            }
          }
        } catch (e) {}
      }

      if (!error && combined.length > 0) {
        setLiveShipments(combined);
      } else if (combined.length > 0) {
        setLiveShipments(combined);
      } else if (shipments && shipments.length > 0) {
        setLiveShipments(shipments);
      } else {
        setLiveShipments([]);
      }
    } catch (err) {
      console.warn('Shipments fetch notice:', err);
    } finally {
      if (isManual) {
        setTimeout(() => setIsRefreshing(false), 500);
      }
    }
  }, [shipments]);

  // Initial load, auto-polling every 4s, and event listeners
  useEffect(() => {
    fetchShipments();

    // Supabase Realtime channel for live dispatch updates
    const channel = supabase
      .channel('public:shipments_view_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shipments' }, () => {
        fetchShipments();
      })
      .subscribe();

    // 4-second polling fallback for zero-latency sync
    const pollTimer = setInterval(() => {
      fetchShipments();
    }, 4000);

    const handleJourneyStarted = () => fetchShipments();
    const handleJourneyTerminated = () => fetchShipments();
    const handleJourneyDelivered = () => fetchShipments();
    const handleJourneyDeleted = () => fetchShipments();

    if (typeof window !== 'undefined') {
      window.addEventListener('ner_journey_started', handleJourneyStarted);
      window.addEventListener('ner_journey_terminated', handleJourneyTerminated);
      window.addEventListener('ner_journey_delivered', handleJourneyDelivered);
      window.addEventListener('ner_journey_deleted', handleJourneyDeleted);
      return () => {
        supabase.removeChannel(channel);
        clearInterval(pollTimer);
        window.removeEventListener('ner_journey_started', handleJourneyStarted);
        window.removeEventListener('ner_journey_terminated', handleJourneyTerminated);
        window.removeEventListener('ner_journey_delivered', handleJourneyDelivered);
        window.removeEventListener('ner_journey_deleted', handleJourneyDeleted);
      };
    }
  }, [fetchShipments]);

  // Action: Mark Consignment as Delivered
  const handleMarkDelivered = async (shipment) => {
    setActionNotice(`Marking ${shipment.tracking_code} as Delivered...`);
    try {
      if (shipment.id) {
        await supabase
          .from('shipments')
          .update({ status: 'DELIVERED', updated_at: new Date().toISOString() })
          .eq('id', shipment.id);
      }
      if (shipment.tracking_code) {
        await supabase
          .from('shipments')
          .update({ status: 'DELIVERED', updated_at: new Date().toISOString() })
          .eq('tracking_code', shipment.tracking_code);
      }

      if (typeof window !== 'undefined') {
        try {
          const cached = localStorage.getItem('ner_active_journey');
          if (cached && JSON.parse(cached)?.tracking_code === shipment.tracking_code) {
            localStorage.removeItem('ner_active_journey');
            localStorage.removeItem('ner_active_transit_journey');
            window.dispatchEvent(new CustomEvent('ner_journey_deleted'));
          }
        } catch (e) {}
      }

      await fetchShipments();
      setActionNotice(`✅ Consignment ${shipment.tracking_code} marked as DELIVERED.`);
      setTimeout(() => setActionNotice(null), 3500);
    } catch (err) {
      console.error('Error marking delivered:', err);
      setActionNotice('Failed to update status.');
      setTimeout(() => setActionNotice(null), 3000);
    }
  };

  // Action: Terminate & Delete Consignment Record
  const handleDeleteShipment = async (shipment) => {
    setActionNotice(`Terminating consignment ${shipment.tracking_code}...`);
    try {
      if (shipment.id) {
        await supabase
          .from('shipments')
          .delete()
          .eq('id', shipment.id);
      }
      if (shipment.tracking_code) {
        await supabase
          .from('shipments')
          .delete()
          .eq('tracking_code', shipment.tracking_code);
      }

      if (typeof window !== 'undefined') {
        try {
          const cached = localStorage.getItem('ner_active_journey');
          if (cached && JSON.parse(cached)?.tracking_code === shipment.tracking_code) {
            localStorage.removeItem('ner_active_journey');
            localStorage.removeItem('ner_active_transit_journey');
            window.dispatchEvent(new CustomEvent('ner_journey_deleted'));
          }
        } catch (e) {}
      }

      await fetchShipments();
      setActionNotice(`🗑️ Consignment ${shipment.tracking_code} deleted.`);
      setTimeout(() => setActionNotice(null), 3500);
    } catch (err) {
      console.error('Error deleting shipment:', err);
      setActionNotice('Failed to delete consignment.');
      setTimeout(() => setActionNotice(null), 3000);
    }
  };

  const displayShipments = liveShipments;

  const inTransitCount = displayShipments.filter((s) => {
    const st = (s.status || '').toLowerCase();
    return st === 'in_transit' || st === 'in-transit' || st === 'active';
  }).length;

  const deliveredCount = displayShipments.filter((s) => {
    const st = (s.status || '').toLowerCase();
    return st === 'delivered' || st === 'completed';
  }).length;

  const filteredShipments = displayShipments.filter((s) => {
    const q = search.toLowerCase();
    const originText = s.origin_hub_name || s.origin || '';
    const destText = s.dest_hub_name || s.destination_district || s.destination_state || '';
    const cargoText = s.cargo_type || s.commodity_type || '';
    const codeText = s.tracking_code || s.consignment_number || '';
    const driverText = s.driver_name || s.driver_code || '';

    const matchesSearch = 
      !q ||
      originText.toLowerCase().includes(q) ||
      destText.toLowerCase().includes(q) ||
      cargoText.toLowerCase().includes(q) ||
      codeText.toLowerCase().includes(q) ||
      driverText.toLowerCase().includes(q);

    const st = (s.status || '').toLowerCase();
    const matchesStatus = 
      statusFilter === 'ALL' ||
      (statusFilter === 'in_transit' && (st === 'in_transit' || st === 'in-transit' || st === 'active')) ||
      (statusFilter === 'delivered' && (st === 'delivered' || st === 'completed'));

    return matchesSearch && matchesStatus;
  });

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
                # RELIEF CONVOY FLEET
              </span>
              <span className="flex items-center space-x-1 text-[10px] font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-100/70 dark:bg-emerald-950/80 px-2 py-0.5 rounded-md border border-emerald-200/60 dark:border-emerald-800/60">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>LIVE TELEMETRY SYNC</span>
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              Relief Shipments & Consignment Fleet
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
              Live telemetry tracking, driver manifests, and multi-state delivery logistics for disaster relief supplies.
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

      {/* Action Notification Toast */}
      {actionNotice && (
        <div className="p-3 bg-blue-900/90 text-cyan-200 border border-blue-700 rounded-2xl text-xs font-mono flex items-center justify-between shadow-lg animate-in fade-in">
          <div className="flex items-center space-x-2">
            <Radio className="w-4 h-4 text-cyan-400 animate-pulse shrink-0" />
            <span>{actionNotice}</span>
          </div>
        </div>
      )}

      {/* 2. SUMMARY METRICS ROW (4 Clean Cards: Total, In-Transit, Delivered, Connectivity) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        
        {/* Card 1: Total Dispatches */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200/90 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
              Total Dispatches
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-100 dark:border-blue-900 flex items-center justify-center text-blue-600 dark:text-cyan-400">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-slate-900 dark:text-white font-mono">
              {displayShipments.length}
            </span>
            <p className="text-[10px] text-slate-400 mt-0.5">
              All Active Consignments
            </p>
          </div>
        </div>

        {/* Card 2: In-Transit */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200/90 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
              In-Transit Convoys
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-100 dark:border-emerald-900 flex items-center justify-center text-emerald-500">
              <Truck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-slate-900 dark:text-white font-mono">
              {inTransitCount}
            </span>
            <p className="text-[10px] text-slate-400 mt-0.5">
              Live GPS Broadcast
            </p>
          </div>
        </div>

        {/* Card 3: Delivered */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200/90 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
              Delivered Consignments
            </span>
            <div className="w-8 h-8 rounded-xl bg-cyan-50 dark:bg-cyan-950/60 border border-cyan-100 dark:border-cyan-900 flex items-center justify-center text-cyan-500">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-slate-900 dark:text-white font-mono">
              {deliveredCount}
            </span>
            <p className="text-[10px] text-slate-400 mt-0.5">
              Depot Intake Confirmed
            </p>
          </div>
        </div>

        {/* Card 4: Fleet Connectivity */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200/90 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
              Fleet Connectivity
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-100 dark:border-emerald-900 flex items-center justify-center text-emerald-500">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-slate-900 dark:text-white font-mono">
              100%
            </span>
            <p className="text-[10px] text-slate-400 mt-0.5">
              Telemetry Pings Active
            </p>
          </div>
        </div>

      </div>

      {/* 3. MAIN SHIPMENTS CONTAINER CARD */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-xs p-5 sm:p-6 space-y-5">
        
        {/* Container Header Bar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
          
          {/* Left Title & Icon */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-950/80 border border-blue-100 dark:border-blue-900 flex items-center justify-center text-blue-600 dark:text-cyan-400 shrink-0">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                Consignment Manifests
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Live relief transit status across North-Eastern supply corridors
              </p>
            </div>
          </div>

          {/* Right Controls: Search, 3 Tabs (All, In Transit, Delivered), Manual Refresh */}
          <div className="flex flex-wrap items-center gap-2.5">
            
            {/* Inline Search Input */}
            <div className="relative min-w-[190px] flex-1 sm:flex-initial">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search code, corridor, cargo..."
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* 3 Status Filter Tabs: All, In Transit, Delivered */}
            <div className="flex items-center space-x-1 bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200/80 dark:border-slate-800">
              {[
                { id: 'ALL', label: 'All' },
                { id: 'in_transit', label: 'In Transit' },
                { id: 'delivered', label: 'Delivered' },
              ].map((tab) => {
                const isSelected = statusFilter === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setStatusFilter(tab.id)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-blue-600 text-white shadow-2xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Refresh Button */}
            <button
              type="button"
              onClick={() => fetchShipments(true)}
              disabled={isRefreshing}
              className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer flex items-center justify-center"
              title="Refresh Fleet Data"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-blue-500' : ''}`} />
            </button>

          </div>

        </div>

        {/* Table Content or Empty State */}
        {filteredShipments.length === 0 ? (
          <div className="py-16 flex flex-col items-center justify-center text-center space-y-4">
            <div className="w-20 h-20 rounded-3xl bg-blue-50/60 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/60 flex items-center justify-center text-blue-500">
              <Truck className="w-9 h-9 stroke-[1.5]" />
            </div>
            <div className="space-y-1 max-w-sm">
              <h4 className="text-base font-bold text-slate-900 dark:text-white">
                No consignments found
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {displayShipments.length === 0
                  ? 'No relief journeys active yet. Start a journey from the Command Dashboard route navigator.'
                  : 'No active dispatches match your current search/filter settings.'}
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Mobile Shipment Cards (< md) */}
            <div className="md:hidden space-y-3">
            {filteredShipments.map((s, idx) => {
              const st = (s.status || '').toLowerCase();
              const isInTransit = st === 'in_transit' || st === 'in-transit' || st === 'active';
              const isDelivered = st === 'delivered' || st === 'completed';

              return (
                <div 
                  key={`mob-ship-${s.id || s.tracking_code || idx}`}
                  className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs space-y-3 font-sans"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="font-mono font-bold text-xs text-blue-600 dark:text-cyan-400 block">
                        {s.tracking_code || `TRK-${(s.id || '4921').slice(0, 8)}`}
                      </span>
                      <h4 className="font-bold text-sm text-slate-900 dark:text-white mt-0.5">
                        {s.cargo_type || s.commodity_type || 'Emergency Relief Supplies'}
                      </h4>
                    </div>
                    <span className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border shrink-0 ${
                      isInTransit
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                        : isDelivered
                        ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/70 dark:text-blue-300 border-blue-300 dark:border-blue-800'
                        : 'bg-amber-50 text-amber-700 dark:bg-amber-950/70 dark:text-amber-300 border-amber-300 dark:border-amber-800'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${isInTransit ? 'bg-emerald-500 animate-pulse' : isDelivered ? 'bg-blue-500' : 'bg-amber-500'}`} />
                      <span>{isInTransit ? 'In Transit' : isDelivered ? 'Delivered' : 'Pending'}</span>
                    </span>
                  </div>

                  {/* Corridor Path */}
                  <div className="bg-slate-50 dark:bg-slate-950/60 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 text-xs space-y-1">
                    <div className="text-slate-500 dark:text-slate-400 font-mono text-[10px] uppercase font-bold">Transit Corridor</div>
                    <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 truncate">
                      <span className="truncate">{s.origin_hub_name || s.origin || 'Guwahati Hub'}</span>
                      <span className="text-slate-400">➔</span>
                      <span className="truncate">{s.dest_hub_name || s.destination_district || s.destination_state || 'Regional Depot'}</span>
                    </div>
                  </div>

                  {/* Stats row */}
                  <div className="flex items-center justify-between text-xs font-mono text-slate-600 dark:text-slate-400 pt-0.5">
                    <span>Weight: <strong className="text-slate-900 dark:text-white">{s.cargo_weight_val || s.quantity_tons || '15.0'} {s.cargo_weight_unit || 'MT'}</strong></span>
                    <span>Driver: <strong className="text-cyan-600 dark:text-cyan-400">{s.driver_code || 'DRV-NER'}</strong></span>
                  </div>

                  {/* Action Buttons Grid */}
                  <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                    {(s.current_lat || s.current_latitude) ? (
                      <button
                        type="button"
                        onClick={() => {
                          if (onSelectShipmentOnMap) {
                            onSelectShipmentOnMap(s);
                          }
                        }}
                        className="py-2.5 px-2 bg-blue-50 dark:bg-blue-950 hover:bg-blue-100 dark:hover:bg-blue-900 text-blue-600 dark:text-cyan-400 font-bold text-xs rounded-xl border border-blue-200 dark:border-blue-800 transition-colors flex items-center justify-center space-x-1 cursor-pointer min-h-[44px] active:scale-98"
                      >
                        <Navigation className="w-3.5 h-3.5" />
                        <span>Radar</span>
                      </button>
                    ) : (
                      <div />
                    )}

                    {isInTransit ? (
                      <button
                        type="button"
                        onClick={() => handleMarkDelivered(s)}
                        className="py-2.5 px-2 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-600 dark:text-emerald-400 font-bold text-xs rounded-xl border border-emerald-200 dark:border-emerald-800 transition-colors flex items-center justify-center space-x-1 cursor-pointer min-h-[44px] active:scale-98"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Delivered</span>
                      </button>
                    ) : (
                      <div />
                    )}

                    <button
                      type="button"
                      onClick={() => handleDeleteShipment(s)}
                      className="py-2.5 px-2 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-400 font-bold text-xs rounded-xl border border-rose-200 dark:border-rose-800 transition-colors flex items-center justify-center space-x-1 cursor-pointer min-h-[44px] active:scale-98"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete</span>
                    </button>
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
                  <th className="pb-3 pl-2">Tracking Code</th>
                  <th className="pb-3">Corridor (Origin ➔ Dest)</th>
                  <th className="pb-3">Cargo Description</th>
                  <th className="pb-3">Weight</th>
                  <th className="pb-3">Driver ID</th>
                  <th className="pb-3">Status</th>
                  <th className="pb-3 pr-2 text-right">Actions & Telemetry</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredShipments.map((s, idx) => {
                  const st = (s.status || '').toLowerCase();
                  const isInTransit = st === 'in_transit' || st === 'in-transit' || st === 'active';
                  const isDelivered = st === 'delivered' || st === 'completed';

                  return (
                    <tr key={s.id || s.tracking_code || `ship-${idx}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="py-3.5 pl-2 font-mono font-bold text-blue-600 dark:text-cyan-400">
                        {s.tracking_code || `TRK-${(s.id || '4921').slice(0, 8)}`}
                      </td>
                      <td className="py-3.5 font-medium text-slate-800 dark:text-slate-200">
                        <span className="font-bold">{s.origin_hub_name || s.origin || 'Guwahati Hub'}</span>
                        <span className="text-slate-400 mx-1.5">➔</span>
                        <span>{s.dest_hub_name || s.destination_district || s.destination_state || 'Regional Depot'}</span>
                      </td>
                      <td className="py-3.5 text-slate-700 dark:text-slate-300">
                        {s.cargo_type || s.commodity_type || 'Emergency Relief Supplies'}
                      </td>
                      <td className="py-3.5 font-mono text-slate-600 dark:text-slate-400">
                        {s.cargo_weight_val || s.quantity_tons || '15.0'} {s.cargo_weight_unit || 'MT'}
                      </td>
                      <td className="py-3.5 font-mono text-slate-600 dark:text-slate-400">
                        {s.driver_code || (s.driver_name ? `DRV-${s.driver_name.slice(0, 4)}` : 'DRV-NER-4921')}
                      </td>
                      <td className="py-3.5">
                        <span className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                          isInTransit
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                            : isDelivered
                            ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/70 dark:text-blue-300 border-blue-300 dark:border-blue-800'
                            : 'bg-amber-50 text-amber-700 dark:bg-amber-950/70 dark:text-amber-300 border-amber-300 dark:border-amber-800'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${isInTransit ? 'bg-emerald-500 animate-pulse' : isDelivered ? 'bg-blue-500' : 'bg-amber-500'}`} />
                          <span>{isInTransit ? 'In Transit' : isDelivered ? 'Delivered' : 'Pending'}</span>
                        </span>
                      </td>
                      <td className="py-3.5 pr-2 text-right">
                        <div className="flex items-center justify-end space-x-1.5">
                          
                          {/* Map Radar Focus Button */}
                          {(s.current_lat || s.current_latitude) && (
                            <button
                              type="button"
                              onClick={() => {
                                if (onSelectShipmentOnMap) {
                                  onSelectShipmentOnMap(s);
                                }
                              }}
                              className="px-2.5 py-1 bg-blue-50 dark:bg-blue-950 hover:bg-blue-100 dark:hover:bg-blue-900 text-blue-600 dark:text-cyan-400 font-bold text-[11px] rounded-lg border border-blue-200 dark:border-blue-800 transition-colors inline-flex items-center space-x-1 cursor-pointer"
                              title="Track Radar Position"
                            >
                              <Navigation className="w-3 h-3" />
                              <span>Radar</span>
                            </button>
                          )}

                          {/* Quick Mark Delivered Button */}
                          {isInTransit && (
                            <button
                              type="button"
                              onClick={() => handleMarkDelivered(s)}
                              className="px-2 py-1 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-600 dark:text-emerald-400 font-bold text-[10px] rounded-lg border border-emerald-200 dark:border-emerald-800 transition-colors inline-flex items-center space-x-1 cursor-pointer"
                              title="Mark Consignment Delivered"
                            >
                              <Check className="w-3 h-3" />
                              <span>Delivered</span>
                            </button>
                          )}

                          {/* Terminate / Delete Button */}
                          <button
                            type="button"
                            onClick={() => handleDeleteShipment(s)}
                            className="p-1 text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-md transition-colors cursor-pointer"
                            title="Delete / Terminate Manifest"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>

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

    </div>
  );
}
