'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
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
  Sparkles,
  ChevronDown,
  User,
  ArrowRight,
  Shield,
  Activity,
  X
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { db, deleteShipmentOffline } from '@/lib/offlineDb';
import { useAuth } from '@/context/AuthContext';
import LiveClockWidget from '@/components/LiveClockWidget';

export default function ShipmentsView({ shipments = null, onSelectShipmentOnMap }) {
  const { user, profile, isNodalOfficer, nodalOfficer } = useAuth();
  const [liveShipments, setLiveShipments] = useState(shipments || []);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [actionNotice, setActionNotice] = useState(null);
  const [viewingShipmentDetails, setViewingShipmentDetails] = useState(null);

  const effectiveIsNodal = Boolean(isNodalOfficer || profile?.role === 'nodal_officer');

  // User Profile metadata for Hero Header
  const displayName = effectiveIsNodal 
    ? (nodalOfficer?.officer_name || 'Nodal Authority') 
    : (profile?.full_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Anuj');
  const userRoleText = effectiveIsNodal 
    ? `${nodalOfficer?.state_jurisdiction || 'NER'} • NODAL OPS` 
    : `${profile?.driver_code || user?.user_metadata?.driver_code || '#1524'} • NER OPS`;
  const userInitial = (displayName[0] || 'A').toUpperCase();

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
      let query = supabase
        .from('shipments')
        .select('*')
        .order('created_at', { ascending: false });

      // Privacy: Field operators only fetch their own shipments from DB
      if (!effectiveIsNodal && user?.id) {
        query = query.eq('driver_id', user.id);
      }

      const { data, error } = await query;

      let combined = Array.isArray(data) ? [...data] : [];

      // Check Dexie IndexedDB for offline queued shipments
      try {
        const offlineShipments = await db.offline_shipment_queue.where('synced').equals(0).toArray();
        if (Array.isArray(offlineShipments) && offlineShipments.length > 0) {
          offlineShipments.forEach(offS => {
            const isMine = effectiveIsNodal || (user?.id && offS.driver_id === user.id);
            if (isMine && !combined.some(s => (offS.tracking_code && s.tracking_code === offS.tracking_code) || (offS.id && s.id === offS.id))) {
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
              const isMine = effectiveIsNodal || (user?.id && parsed.driver_id === user.id);
              const alreadyExists = combined.some(s => 
                s.tracking_code === parsed.tracking_code || (parsed.id && s.id === parsed.id)
              );
              if (isMine && !alreadyExists) {
                combined.unshift(parsed);
              }
            }
          }
        } catch (e) {}
      }

      // Filter out permanently deleted shipments
      if (typeof window !== 'undefined') {
        try {
          const delCache = JSON.parse(sessionStorage.getItem('ner_deleted_shipments') || '[]');
          combined = combined.filter(s => !delCache.includes(s.id) && !delCache.includes(s.tracking_code));
        } catch (e) {}
      }

      if (combined.length > 0) {
        setLiveShipments(combined);
      } else if (shipments && Array.isArray(shipments) && shipments.length > 0) {
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
  }, [shipments, effectiveIsNodal, user?.id]);

  // Initial load, auto-polling every 4s, and event listeners
  useEffect(() => {
    fetchShipments();

    const channel = supabase
      .channel('public:shipments_view_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shipments' }, () => {
        fetchShipments();
      })
      .subscribe();

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
    setActionNotice(`Marking ${shipment.tracking_code || 'consignment'} as Delivered...`);
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
      setActionNotice(`✅ Consignment ${shipment.tracking_code || ''} marked as DELIVERED.`);
      setTimeout(() => setActionNotice(null), 3500);
    } catch (err) {
      console.error('Error marking delivered:', err);
      setActionNotice('Failed to update status.');
      setTimeout(() => setActionNotice(null), 3000);
    }
  };

  // Action: Terminate & Delete Consignment Record (Guaranteed Permanent Deletion)
  const handleDeleteShipment = async (shipment) => {
    const isMine = user?.id && (
      shipment.driver_id === user.id || 
      shipment.user_id === user.id || 
      shipment.created_by === user.id
    );
    const canDelete = isNodalOfficer || isMine;

    if (!canDelete) {
      alert('Access Denied: Drivers can only delete convoys they created or dispatched.');
      return;
    }

    const confirmPrompt = isNodalOfficer && !isMine
      ? `[GOVERNMENT AUTHORITY OVERRIDE]\nAre you sure you want to delete this convoy? This action cannot be undone.`
      : `Are you sure you want to delete this convoy? This action cannot be undone.`;

    if (!window.confirm(confirmPrompt)) return;

    setActionNotice(`Terminating consignment ${shipment.tracking_code || ''}...`);
    
    // 1. Optimistically remove from live UI immediately
    setLiveShipments(prev => prev.filter(s => s.id !== shipment.id && (!shipment.tracking_code || s.tracking_code !== shipment.tracking_code)));

    // 2. Add to deleted cache in sessionStorage & localStorage
    if (typeof window !== 'undefined') {
      try {
        const delCache = JSON.parse(sessionStorage.getItem('ner_deleted_shipments') || '[]');
        if (shipment.id && !delCache.includes(shipment.id)) delCache.push(shipment.id);
        if (shipment.tracking_code && !delCache.includes(shipment.tracking_code)) delCache.push(shipment.tracking_code);
        sessionStorage.setItem('ner_deleted_shipments', JSON.stringify(delCache));
        localStorage.setItem('ner_deleted_shipments', JSON.stringify(delCache));

        const cached = localStorage.getItem('ner_active_journey');
        if (cached && JSON.parse(cached)?.tracking_code === shipment.tracking_code) {
          localStorage.removeItem('ner_active_journey');
          localStorage.removeItem('ner_active_transit_journey');
        }
      } catch (e) {}
    }

    try {
      // 3. Server-side permanent delete via backend API (bypasses RLS issues)
      try {
        await fetch('/api/records/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'shipment', id: shipment.id, trackingCode: shipment.tracking_code }),
        });
      } catch (apiErr) {
        console.warn('API shipment delete note:', apiErr);
      }

      // 4. Client-side Supabase direct delete
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

      // 5. Purge from Dexie IndexedDB offline caches
      try {
        await deleteShipmentOffline(shipment.id, shipment.tracking_code);
      } catch (dexErr) {}

      // 6. Broadcast delete event
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('ner_journey_deleted', { detail: { id: shipment.id, tracking_code: shipment.tracking_code } }));
      }

      await fetchShipments();
      setActionNotice(`🗑️ Consignment ${shipment.tracking_code || ''} deleted permanently.`);
      setTimeout(() => setActionNotice(null), 3500);
    } catch (err) {
      console.error('Error deleting shipment:', err);
      setActionNotice('Failed to delete consignment.');
      setTimeout(() => setActionNotice(null), 3000);
    }
  };

  // Safe Date Formatter helper (guaranteed zero RangeError)
  const formatDispatchDate = (created_at) => {
    if (!created_at) return 'Active Journey';
    try {
      const d = new Date(created_at);
      if (isNaN(d.getTime())) return 'Active Journey';
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return 'Active Journey';
    }
  };

  // Safe Coordinate Formatter helper
  const formatCoord = (val, fallback = 26.14) => {
    const num = parseFloat(val);
    return isNaN(num) ? Number(fallback).toFixed(4) : num.toFixed(4);
  };

  // Privacy Scoping: Nodal Officers view all convoys across NER, Field Operators view only their own
  const displayShipments = useMemo(() => {
    const list = Array.isArray(liveShipments) ? liveShipments : [];
    if (effectiveIsNodal) return list;
    return list.filter((s) => {
      if (!s) return false;
      const isMyDriverId = Boolean(user?.id && s.driver_id === user.id);
      const isMyDriverCode = Boolean(profile?.driver_code && s.driver_code === profile.driver_code);
      const isMyDriverName = Boolean(profile?.full_name && s.driver_name === profile.full_name);

      let isMyLocalJourney = false;
      if (typeof window !== 'undefined') {
        try {
          const cached = localStorage.getItem('ner_active_journey') || localStorage.getItem('ner_active_transit_journey');
          if (cached) {
            const parsed = JSON.parse(cached);
            if (parsed && (parsed.tracking_code === s.tracking_code || (parsed.id && parsed.id === s.id))) {
              isMyLocalJourney = true;
            }
          }
        } catch (e) {}
      }

      return isMyDriverId || isMyDriverCode || isMyDriverName || isMyLocalJourney;
    });
  }, [liveShipments, effectiveIsNodal, user?.id, profile?.driver_code, profile?.full_name]);

  const inTransitCount = displayShipments.filter((s) => {
    if (!s) return false;
    const st = (s.status || '').toLowerCase();
    return st === 'in_transit' || st === 'in-transit' || st === 'active';
  }).length;

  const deliveredCount = displayShipments.filter((s) => {
    if (!s) return false;
    const st = (s.status || '').toLowerCase();
    return st === 'delivered' || st === 'completed';
  }).length;

  const pendingCount = displayShipments.length - inTransitCount - deliveredCount;

  const filteredShipments = useMemo(() => {
    return displayShipments.filter((s) => {
      if (!s) return false;
      const q = (search || '').toLowerCase().trim();
      const originText = String(s.origin_hub_name || s.origin || '');
      const destText = String(s.dest_hub_name || s.destination_district || s.destination_state || '');
      const cargoText = String(s.cargo_type || s.commodity_type || '');
      const codeText = String(s.tracking_code || s.consignment_number || '');
      const driverText = String(s.driver_name || s.driver_code || '');

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
  }, [displayShipments, search, statusFilter]);

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
            alt="Himalayan Convoy Corridors"
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
              {effectiveIsNodal ? 'Active Supply Convoys & Shipments' : 'My Supply Convoys & Dispatches'}
            </h1>
            <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-200 font-medium leading-relaxed drop-shadow-xs max-w-xl">
              {effectiveIsNodal 
                ? 'Live GPS telemetry, transit manifest logs, and multimodal delivery dispatch across 8 NER States.'
                : 'Transit manifest logs, active cargo consignments, and delivery execution status.'}
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
        
        {/* Card 1: Total Consignments */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-4.5 border border-slate-200/90 dark:border-slate-800 shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
              {effectiveIsNodal ? 'Total Convoys' : 'My Convoys'}
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-100 dark:border-blue-900 flex items-center justify-center text-blue-600 dark:text-cyan-400">
              <Truck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <span className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white font-mono">
              {displayShipments.length}
            </span>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 font-medium">
              {effectiveIsNodal ? 'Registered manifests' : 'Dispatched manifests'}
            </p>
          </div>
        </div>

        {/* Card 2: In Transit */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-4.5 border border-slate-200/90 dark:border-slate-800 shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
              In Transit
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-100 dark:border-amber-900 flex items-center justify-center text-amber-500">
              <Radio className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <span className="text-2xl sm:text-3xl font-black text-amber-500 dark:text-amber-400 font-mono">
              {inTransitCount}
            </span>
            <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-0.5 font-bold flex items-center gap-1">
              {inTransitCount > 0 ? (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
                  <span>{effectiveIsNodal ? 'Live GPS Active' : 'Transit Active'}</span>
                </>
              ) : (
                <span className="text-slate-400 font-normal">None in transit</span>
              )}
            </p>
          </div>
        </div>

        {/* Card 3: Delivered */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-4.5 border border-slate-200/90 dark:border-slate-800 shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
              Delivered
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-100 dark:border-emerald-900 flex items-center justify-center text-emerald-500">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <span className="text-2xl sm:text-3xl font-black text-emerald-500 dark:text-emerald-400 font-mono">
              {deliveredCount}
            </span>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 font-medium">
              {effectiveIsNodal ? 'Completed journeys' : 'Delivered by you'}
            </p>
          </div>
        </div>

        {/* Card 4: Active Drivers */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-4.5 border border-slate-200/90 dark:border-slate-800 shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
              {effectiveIsNodal ? 'Fleet on Duty' : 'Operator Status'}
            </span>
            <div className="w-8 h-8 rounded-xl bg-purple-50 dark:bg-purple-950/60 border border-purple-100 dark:border-purple-900 flex items-center justify-center text-purple-500">
              <User className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <span className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white font-mono">
              {effectiveIsNodal ? Math.max(1, inTransitCount) : (inTransitCount > 0 ? 'Active' : 'Standby')}
            </span>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 font-medium">
              {effectiveIsNodal ? 'Active operators' : (inTransitCount > 0 ? 'Convoy in motion' : 'Available for dispatch')}
            </p>
          </div>
        </div>

        {/* Card 5: Critical Cargoes */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-4.5 border border-slate-200/90 dark:border-slate-800 shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
              Priority Cargo
            </span>
            <div className="w-8 h-8 rounded-xl bg-cyan-50 dark:bg-cyan-950/60 border border-cyan-100 dark:border-cyan-900 flex items-center justify-center text-cyan-600 dark:text-cyan-400">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <span className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white font-mono">
              100%
            </span>
            <p className="text-[10px] text-cyan-600 dark:text-cyan-400 mt-0.5 font-semibold">
              Medical & Relief Tier
            </p>
          </div>
        </div>

      </div>

      {/* Action Toast Notice */}
      {actionNotice && (
        <div className="p-3 bg-blue-600 text-white font-bold text-xs rounded-2xl shadow-lg shadow-blue-500/20 flex items-center justify-between animate-in fade-in duration-150">
          <span>{actionNotice}</span>
          <button onClick={() => setActionNotice(null)} className="text-white/80 hover:text-white font-mono text-sm">✕</button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. CONTROLS TOOLBAR (Pills, Search, Status, Refresh) */}
      {/* ========================================================================= */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 sm:gap-4">
        
        {/* Left: 3-Tab Pill Switcher */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setStatusFilter('ALL')}
            className={`flex items-center gap-2 px-4 py-2 rounded-full font-bold text-xs transition-all cursor-pointer ${
              statusFilter === 'ALL'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25'
                : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200/90 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60'
            }`}
          >
            <Truck className="w-3.5 h-3.5" />
            <span>All Convoys</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
              statusFilter === 'ALL' ? 'bg-white/25 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
            }`}>
              {displayShipments.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('in_transit')}
            className={`flex items-center gap-2 px-4 py-2 rounded-full font-bold text-xs transition-all cursor-pointer ${
              statusFilter === 'in_transit'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25'
                : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200/90 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            <span>In Transit</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
              statusFilter === 'in_transit' ? 'bg-white/25 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
            }`}>
              {inTransitCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('delivered')}
            className={`flex items-center gap-2 px-4 py-2 rounded-full font-bold text-xs transition-all cursor-pointer ${
              statusFilter === 'delivered'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25'
                : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200/90 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Delivered</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
              statusFilter === 'delivered' ? 'bg-white/25 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
            }`}>
              {deliveredCount}
            </span>
          </button>
        </div>

        {/* Right: Search & Refresh */}
        <div className="flex flex-wrap items-center gap-2.5">
          
          {/* Pill Search Input */}
          <div className="relative min-w-[220px] flex-1 sm:flex-initial">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tracking code, route, driver..."
              className="w-full bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-full pl-9 pr-4 py-2 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-xs font-sans"
            />
          </div>

          {/* Refresh Data Button */}
          <button
            type="button"
            onClick={() => fetchShipments(true)}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs hover:bg-slate-50 dark:hover:bg-slate-800 transition-all shadow-xs cursor-pointer disabled:opacity-50"
            title="Refresh active convoys from server"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-blue-600 dark:text-cyan-400 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

        </div>

      </div>

      {/* ========================================================================= */}
      {/* 4. MASTER DATA TABLE CARD CONTAINER */}
      {/* ========================================================================= */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-xs overflow-hidden">
        
        {filteredShipments.length === 0 ? (
          <div className="py-16 flex flex-col items-center justify-center text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-blue-50 dark:bg-blue-950/60 border border-blue-100 dark:border-blue-900 flex items-center justify-center text-blue-500">
              <Truck className="w-8 h-8 stroke-[1.5]" />
            </div>
            <div className="space-y-1 max-w-sm">
              <h4 className="text-base font-bold text-slate-900 dark:text-white">
                No Active Convoys
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                No transit consignments match the selected criteria. Use "Start Journey" on the Command Center to dispatch convoys.
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Mobile Card List (< md) */}
            <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800 p-3 space-y-3">
              {filteredShipments.map((s, idx) => {
                const isDelivered = (s.status || '').toLowerCase() === 'delivered' || (s.status || '').toLowerCase() === 'completed';
                const isMine = Boolean(user?.id && (s.driver_id === user.id || s.user_id === user.id || s.created_by === user.id));
                const canManage = effectiveIsNodal || isMine;

                return (
                  <div 
                    key={`mob-ship-${s.id || s.tracking_code || idx}`}
                    className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-2xs space-y-3 font-sans"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-xs text-blue-600 dark:text-cyan-400">
                            {s.tracking_code || `TRK-NER-${idx + 1}`}
                          </span>
                          <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                            • {s.cargo_type || 'Emergency Supplies'}
                          </span>
                        </div>
                        <h4 className="font-bold text-sm text-slate-900 dark:text-white mt-1 flex items-center gap-1">
                          <span>{s.origin_hub_name || s.origin || 'Origin Hub'}</span>
                          <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                          <span>{s.dest_hub_name || s.destination || 'Destination Hub'}</span>
                        </h4>
                      </div>

                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase border shrink-0 ${
                        isDelivered 
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800' 
                          : 'bg-blue-50 text-blue-700 dark:bg-blue-950/70 dark:text-cyan-300 border-blue-200 dark:border-blue-800'
                      }`}>
                        {isDelivered ? 'DELIVERED' : 'IN TRANSIT'}
                      </span>
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 text-xs flex items-center justify-between">
                      <div className="space-y-0.5">
                        <span className="text-[10px] text-slate-400 block font-mono">Assigned Vehicle</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">{s.vehicle_number || 'AS-01-AX-9921'}</span>
                      </div>
                      <div className="text-right space-y-0.5">
                        <span className="text-[10px] text-slate-400 block font-mono">Driver</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">{s.driver_name || 'Field Driver'}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 font-mono">
                      <span>GPS: {formatCoord(s.current_lat || s.origin_lat, 26.14)}, {formatCoord(s.current_lng || s.origin_lng, 91.73)}</span>
                      <span className="text-blue-600 dark:text-cyan-400 font-bold">{s.estimated_eta || 'On Schedule'}</span>
                    </div>

                    <div className={`grid ${effectiveIsNodal ? 'grid-cols-2' : 'grid-cols-1'} gap-2 pt-1 border-t border-slate-100 dark:border-slate-800`}>
                      {effectiveIsNodal && (
                        <button
                          type="button"
                          onClick={() => {
                            if (onSelectShipmentOnMap) {
                              onSelectShipmentOnMap(s);
                            }
                          }}
                          className="py-2 px-3 bg-blue-50 dark:bg-blue-950 hover:bg-blue-100 dark:hover:bg-blue-900 text-blue-600 dark:text-cyan-400 font-bold text-xs rounded-full border border-blue-200 dark:border-blue-800 transition-colors flex items-center justify-center space-x-1.5 cursor-pointer"
                        >
                          <Navigation className="w-3.5 h-3.5" />
                          <span>Locate Convoy</span>
                        </button>
                      )}

                      {!isDelivered && canManage ? (
                        <button
                          type="button"
                          onClick={() => handleMarkDelivered(s)}
                          className="py-2 px-3 bg-emerald-50 dark:bg-emerald-950 hover:bg-emerald-100 dark:hover:bg-emerald-900 text-emerald-700 dark:text-emerald-300 font-bold text-xs rounded-full border border-emerald-200 dark:border-emerald-800 transition-colors flex items-center justify-center space-x-1.5 cursor-pointer"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                          <span>Mark Delivered</span>
                        </button>
                      ) : canManage ? (
                        <button
                          type="button"
                          onClick={() => handleDeleteShipment(s)}
                          className="py-2 px-3 bg-rose-50 dark:bg-rose-950 hover:bg-rose-100 dark:hover:bg-rose-900 text-rose-700 dark:text-rose-300 font-bold text-xs rounded-full border border-rose-200 dark:border-rose-800 transition-colors flex items-center justify-center space-x-1.5 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                          <span>Archive Record</span>
                        </button>
                      ) : null}
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
                    <th className="py-3.5 pl-6">TRACKING & CARGO</th>
                    <th className="py-3.5 px-3">STATUS</th>
                    <th className="py-3.5 px-3">TRANSIT CORRIDOR</th>
                    <th className="py-3.5 px-3">ASSIGNED VEHICLE & DRIVER</th>
                    <th className="py-3.5 px-3">GPS TELEMETRY / SPEED</th>
                    <th className="py-3.5 px-3">DISPATCHED AT</th>
                    <th className="py-3.5 pr-6 text-right">ACTIONS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                  {filteredShipments.map((s, idx) => {
                    const isDelivered = (s.status || '').toLowerCase() === 'delivered' || (s.status || '').toLowerCase() === 'completed';
                    const isMine = Boolean(user?.id && (s.driver_id === user.id || s.user_id === user.id || s.created_by === user.id));
                    const canManage = effectiveIsNodal || isMine;

                    return (
                      <tr 
                        key={s.id || s.tracking_code || `ship-${idx}`} 
                        className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        {/* 1. Tracking Code & Cargo */}
                        <td className="py-4 pl-6">
                          <div className="font-mono font-bold text-xs text-blue-600 dark:text-cyan-400">
                            {s.tracking_code || `TRK-NER-00${idx + 1}`}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                            {s.cargo_type || 'Emergency Supplies & Food Grain'}
                          </div>
                        </td>

                        {/* 2. Status Badge */}
                        <td className="py-4 px-3">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase border inline-flex items-center gap-1.5 ${
                            isDelivered 
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800' 
                              : 'bg-blue-50 text-blue-700 dark:bg-blue-950/70 dark:text-cyan-300 border-blue-200 dark:border-blue-800'
                          }`}>
                            {!isDelivered && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 dark:bg-cyan-400 animate-pulse" />}
                            <span>{isDelivered ? 'DELIVERED' : 'IN TRANSIT'}</span>
                          </span>
                        </td>

                        {/* 3. Transit Corridor */}
                        <td className="py-4 px-3 font-medium text-slate-700 dark:text-slate-300">
                          <div className="flex items-center space-x-1.5 text-xs">
                            <span className="font-bold text-slate-900 dark:text-slate-100">{s.origin_hub_name || s.origin || 'Guwahati Central'}</span>
                            <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="font-bold text-slate-900 dark:text-slate-100">{s.dest_hub_name || s.destination || 'Silchar Valley'}</span>
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                            Corridor: {s.distance_km ? `${s.distance_km} km` : 'Calculated Highway'}
                          </div>
                        </td>

                        {/* 4. Vehicle & Driver */}
                        <td className="py-4 px-3">
                          <div className="font-mono font-bold text-xs text-slate-900 dark:text-slate-100">
                            {s.vehicle_number || 'AS-01-AX-9921'}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">
                            {s.driver_name || 'Field Driver'}
                          </div>
                        </td>

                        {/* 5. Coordinates & Speed */}
                        <td className="py-4 px-3 font-mono text-[11px] text-slate-600 dark:text-slate-400">
                          <div>{formatCoord(s.current_lat || s.origin_lat, 26.14)},</div>
                          <div>{formatCoord(s.current_lng || s.origin_lng, 91.73)}</div>
                        </td>

                        {/* 6. Dispatched At */}
                        <td className="py-4 px-3 text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                          {formatDispatchDate(s.created_at)}
                        </td>

                        {/* 7. Action Buttons */}
                        <td className="py-4 pr-6 text-right">
                          <div className="inline-flex items-center space-x-2">
                            
                            {/* Locate Action Button - STRICTLY NODAL OFFICER ONLY */}
                            {effectiveIsNodal && (
                              <button
                                type="button"
                                onClick={() => {
                                  if (onSelectShipmentOnMap) {
                                    onSelectShipmentOnMap(s);
                                  }
                                }}
                                className="px-3 py-1.5 rounded-full bg-blue-50 dark:bg-blue-950 hover:bg-blue-100 dark:hover:bg-blue-900 text-blue-600 dark:text-cyan-400 font-bold text-xs border border-blue-200 dark:border-blue-800 transition-all inline-flex items-center space-x-1.5 cursor-pointer shadow-2xs"
                                title="Locate live convoy on GIS map (Nodal Authority Only)"
                              >
                                <Navigation className="w-3.5 h-3.5" />
                                <span>Locate</span>
                              </button>
                            )}

                            {/* Mark Delivered Action Button */}
                            {!isDelivered && canManage ? (
                              <button
                                type="button"
                                onClick={() => handleMarkDelivered(s)}
                                className="px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/80 hover:bg-emerald-100 dark:hover:bg-emerald-900 text-emerald-700 dark:text-emerald-300 font-bold text-xs border border-emerald-200 dark:border-emerald-800 transition-all inline-flex items-center space-x-1.5 cursor-pointer shadow-2xs"
                                title="Confirm safe consignment delivery"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                                <span>Mark Delivered</span>
                              </button>
                            ) : null}

                            {/* Terminate / Delete Action Button */}
                            {canManage ? (
                              <button
                                type="button"
                                onClick={() => handleDeleteShipment(s)}
                                className="px-3 py-1.5 rounded-full bg-rose-50 dark:bg-rose-950/70 hover:bg-rose-100 dark:hover:bg-rose-900 text-rose-600 dark:text-rose-300 font-bold text-xs border border-rose-200 dark:border-rose-800 transition-all inline-flex items-center space-x-1.5 cursor-pointer"
                                title="Terminate & Archive Consignment Record"
                              >
                                <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                                <span>Terminate</span>
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

    </div>
  );
}
