'use client';

import React, { useState, useEffect } from 'react';
import { 
  Truck, 
  MapPin, 
  Package, 
  Scale, 
  User, 
  Phone, 
  Shield, 
  X, 
  AlertCircle, 
  CheckCircle2, 
  Radio,
  FileText,
  Mountain,
  ShieldCheck,
  BarChart3,
  Car,
  Loader2,
  ArrowRight
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';

const CARGO_PRESET_ITEMS = [
  { label: 'Essential Medicines & First Aid', icon: '💙' },
  { label: 'Food Grain Bags & Dry Rations', icon: '🌾' },
  { label: 'Emergency Shelter Kits & Tarpaulins', icon: '⛺' },
  { label: 'Purified Drinking Water Canisters', icon: '💧' },
  { label: 'Thermal Blankets & Winter Clothing', icon: '❄️' },
  { label: 'Disaster Relief Equipment & Tools', icon: '🔧' },
  { label: 'High-Priority Medical Supplies', icon: '➕' }
];

const DISPATCH_TEMPLATES = [
  {
    name: 'NDRF Medical & Cold Storage (10 MT)',
    cargo: 'Essential Medicines & Cold Storage Vaccines',
    weight: '10.0',
    unit: 'MT'
  },
  {
    name: 'Emergency Food Rations & Grains (15 MT)',
    cargo: 'Food Grain Bags & Dry Rations',
    weight: '15.0',
    unit: 'MT'
  },
  {
    name: 'Disaster Shelter Kits & Tarps (15 MT)',
    cargo: 'Emergency Shelter Kits & Tarpaulins',
    weight: '15.0',
    unit: 'MT'
  },
  {
    name: 'Purified Drinking Water Canisters (20 MT)',
    cargo: 'Purified Drinking Water Canisters',
    weight: '20.0',
    unit: 'MT'
  },
  {
    name: 'Winter Relief & Thermal Clothing (8 MT)',
    cargo: 'Thermal Blankets & Winter Clothing',
    weight: '8.0',
    unit: 'MT'
  }
];

export default function StartJourneyModal({
  isOpen,
  onClose,
  onSuccess,
  hubs = [],
  originHub = null,
  destHub = null,
  originHubId = '',
  destHubId = '',
  userLocation = null,
  activeRoute = null,
  user = null,
  profile = null
}) {
  const [cargoType, setCargoType] = useState('');
  const [cargoWeightVal, setCargoWeightVal] = useState('15.0');
  const [cargoWeightUnit, setCargoWeightUnit] = useState('MT');
  const [selectedOriginId, setSelectedOriginId] = useState(originHubId || 'CURRENT_LOCATION');
  const [selectedDestId, setSelectedDestId] = useState(destHubId || '');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [showTemplateMenu, setShowTemplateMenu] = useState(false);

  // Sync initial props
  useEffect(() => {
    if (isOpen) {
      if (originHubId) setSelectedOriginId(originHubId);
      if (destHubId) setSelectedDestId(destHubId);
      setErrorMsg('');
      setShowTemplateMenu(false);
    }
  }, [isOpen, originHubId, destHubId]);

  if (!isOpen) return null;

  // Resolve Driver Details (Read-only Auto-populated)
  const driverName = profile?.full_name || user?.user_metadata?.full_name || (user?.email ? user.email.split('@')[0] : 'anuj');
  const driverPhone = profile?.phone || user?.user_metadata?.phone || '+91 6294913005';
  const driverCode = profile?.driver_code || `DRV-NER-${user?.id ? user.id.slice(0, 4).toUpperCase() : '9C88'}`;
  const vehicleNumber = profile?.vehicle_number || user?.user_metadata?.vehicle_number || 'WB1995';

  // Handle Form Submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!cargoType.trim()) {
      setErrorMsg('Please specify the Goods / Cargo description.');
      return;
    }

    const weightNum = parseFloat(cargoWeightVal);
    if (isNaN(weightNum) || weightNum <= 0) {
      setErrorMsg('Please enter a valid positive goods weight / quantity.');
      return;
    }

    if (!selectedOriginId || !selectedDestId) {
      setErrorMsg('Please select both Origin and Destination facilities.');
      return;
    }

    if (selectedOriginId === selectedDestId) {
      setErrorMsg('Origin and Destination facilities cannot be identical.');
      return;
    }

    setSubmitting(true);

    try {
      // 1. Resolve Origin & Destination Names
      let originName = 'Guwahati Central Depot';
      let destName = 'Regional Supply Hub';
      let originUUID = null;
      let destUUID = null;

      if (selectedOriginId === 'CURRENT_LOCATION') {
        originName = 'Live GPS Position (Field Operator)';
      } else {
        const foundOrigin = hubs.find(h => h.id === selectedOriginId || h.hub_code === selectedOriginId);
        if (foundOrigin) {
          originName = foundOrigin.hub_name;
          originUUID = foundOrigin.id && /^[0-9a-f-]{36}$/i.test(foundOrigin.id) ? foundOrigin.id : null;
        }
      }

      const foundDest = hubs.find(h => h.id === selectedDestId || h.hub_code === selectedDestId);
      if (foundDest) {
        destName = foundDest.hub_name;
        destUUID = foundDest.id && /^[0-9a-f-]{36}$/i.test(foundDest.id) ? foundDest.id : null;
      }

      const currentLat = userLocation?.coords?.lat || (foundDest ? parseFloat(foundDest.latitude) : 26.1445);
      const currentLng = userLocation?.coords?.lng || (foundDest ? parseFloat(foundDest.longitude) : 91.7362);

      // 2. Start hardware GPS streaming
      if (typeof navigator !== 'undefined' && navigator.geolocation) {
        if (userLocation?.startTracking) {
          try {
            userLocation.startTracking();
          } catch (e) {}
        }
      }

      // 3. Prepare Comprehensive Shipment Record
      const trackingCode = `TRK-NER-${Date.now().toString().slice(-6)}`;
      
      const isValidUUID = (val) => typeof val === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
      const validDriverId = (user?.id && isValidUUID(user.id)) ? user.id : null;
      const validOriginHubId = originUUID && isValidUUID(originUUID) ? originUUID : null;
      const validDestHubId = destUUID && isValidUUID(destUUID) ? destUUID : null;

      const baseShipmentRecord = {
        tracking_code: trackingCode,
        driver_id: validDriverId,
        driver_code: driverCode,
        driver_name: driverName,
        driver_phone: driverPhone,
        cargo_type: cargoType.trim(),
        commodity_type: cargoType.trim(),
        cargo_weight_val: weightNum,
        quantity_tons: weightNum,
        cargo_weight_unit: cargoWeightUnit,
        origin_hub_id: validOriginHubId,
        origin_hub_name: originName,
        origin: originName,
        destination_hub_id: validDestHubId,
        dest_hub_name: destName,
        destination_district: foundDest?.district || 'District Hub',
        destination_state: foundDest?.state || 'Assam',
        current_lat: currentLat,
        current_lng: currentLng,
        current_latitude: currentLat,
        current_longitude: currentLng,
        status: 'IN_TRANSIT',
        priority: 'urgent',
        eta: activeRoute?.durationText || '3 hrs 15 mins',
      };

      // 4. Multi-tier Resilient Insert into public.shipments (Supabase)
      let savedShipment = { ...baseShipmentRecord };

      // Attempt 1: Full payload
      let { data: dbData, error: dbError } = await supabase
        .from('shipments')
        .insert([baseShipmentRecord])
        .select()
        .maybeSingle();

      // Attempt 2: If foreign key error or unmigrated column error, strip relational columns and retry
      if (dbError) {
        console.warn('Full shipment payload insert notice, retrying with sanitized payload:', dbError.message);
        
        const sanitizedPayload = { ...baseShipmentRecord };
        delete sanitizedPayload.driver_id;
        delete sanitizedPayload.origin_hub_id;
        delete sanitizedPayload.destination_hub_id;

        const retryResult = await supabase
          .from('shipments')
          .insert([sanitizedPayload])
          .select()
          .maybeSingle();

        if (!retryResult.error && retryResult.data) {
          dbData = retryResult.data;
          dbError = null;
        } else {
          // Attempt 3: Minimal fallback payload
          console.warn('Sanitized payload notice, retrying with minimal schema payload:', retryResult.error?.message);
          const minimalPayload = {
            tracking_code: trackingCode,
            cargo_type: cargoType.trim(),
            status: 'IN_TRANSIT',
            priority: 'urgent',
            origin_hub_name: originName,
            dest_hub_name: destName,
            current_lat: currentLat,
            current_lng: currentLng,
          };

          const minResult = await supabase
            .from('shipments')
            .insert([minimalPayload])
            .select()
            .maybeSingle();

          if (!minResult.error && minResult.data) {
            dbData = minResult.data;
            dbError = null;
          } else {
            console.error('All shipment insert tiers failed:', minResult.error?.message || retryResult.error?.message || dbError.message);
            throw new Error(`Database error saving shipment: ${(minResult.error || retryResult.error || dbError).message}`);
          }
        }
      }

      if (dbData?.id) {
        savedShipment.id = dbData.id;
      }

      // 5. Update Active Duty State on public.driver_profiles
      if (user?.id) {
        try {
          await supabase
            .from('driver_profiles')
            .update({
              is_active_duty: true,
              current_latitude: currentLat,
              current_longitude: currentLng,
              last_ping: new Date().toISOString()
            })
            .eq('id', user.id);
        } catch (dutyErr) {
          console.warn('Driver duty state update notice:', dutyErr);
        }
      }

      // 6. Save in Local Storage & Trigger Broadcast Callbacks
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('ner_active_journey', JSON.stringify(savedShipment));
          localStorage.setItem('ner_active_transit_journey', JSON.stringify(savedShipment));
          window.dispatchEvent(new CustomEvent('ner_journey_started', { detail: savedShipment }));
        } catch (e) {}
      }

      if (onSuccess) {
        onSuccess(savedShipment);
      }

      onClose();
    } catch (err) {
      console.error('Failed to create transit manifest:', err);
      setErrorMsg(err.message || 'Failed to dispatch manifest. Please check database connection.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/75 backdrop-blur-md p-3 sm:p-5 overflow-y-auto animate-in fade-in duration-200 font-sans">
      <div className="relative w-full max-w-5xl bg-white dark:bg-[#0f172a] rounded-3xl shadow-2xl border border-slate-200/90 dark:border-slate-800 overflow-hidden flex flex-col md:flex-row my-auto max-h-[94vh]">
        
        {/* =========================================================================
            LEFT BRANDED SIDEBAR (Full-Bleed Convoy Image, Highlights, Tagline)
           ========================================================================= */}
        <div className="w-full md:w-[280px] lg:w-[320px] shrink-0 relative overflow-hidden flex flex-col justify-between border-b md:border-b-0 md:border-r border-slate-200/80 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 min-h-[360px] md:min-h-[580px]">
          {/* Full-bleed background image covering 100% of the left panel */}
          <img
            src="/convoy.jpg"
            alt="NER Logistics Convoy in Transit"
            className="absolute inset-0 w-full h-full object-cover object-bottom"
          />
          
          {/* Lighter, clear gradient overlay allowing the vivid convoy image to shine through with high opacity */}
          <div className="absolute inset-0 bg-gradient-to-b from-slate-50/90 via-slate-50/30 via-30% to-black/75 dark:from-[#0b1220]/90 dark:via-[#0b1220]/30 dark:via-30% dark:to-black/80 pointer-events-none" />

          {/* Top Section */}
          <div className="relative z-10 p-5 sm:p-6 pb-2 space-y-4">
            {/* Top Brand Header */}
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-cyan-500 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
                <Mountain className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-extrabold tracking-tight text-slate-900 dark:text-white leading-none">
                  NER-LOGIX
                </h2>
                <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 mt-0.5">
                  Tactical Logistics
                </p>
              </div>
            </div>

            {/* Feature Highlights with Frosted Glass Protection */}
            <div className="space-y-2.5 my-4">
              {/* 1. Track in Real-Time */}
              <div className="flex items-center gap-2.5 bg-white/85 dark:bg-slate-900/85 backdrop-blur-md p-2 rounded-xl border border-white/80 dark:border-slate-700/60 shadow-2xs">
                <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200/80 dark:border-emerald-800/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                  <ShieldCheck className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 leading-tight">
                    Track in Real-Time
                  </h4>
                  <p className="text-[10.5px] text-slate-500 dark:text-slate-400 leading-tight font-medium">
                    Live GPS telemetry
                  </p>
                </div>
              </div>

              {/* 2. Safer Convoys */}
              <div className="flex items-center gap-2.5 bg-white/85 dark:bg-slate-900/85 backdrop-blur-md p-2 rounded-xl border border-white/80 dark:border-slate-700/60 shadow-2xs">
                <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-950/50 border border-blue-200/80 dark:border-blue-800/60 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
                  <Radio className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 leading-tight">
                    Safer Convoys
                  </h4>
                  <p className="text-[10.5px] text-slate-500 dark:text-slate-400 leading-tight font-medium">
                    Faster emergency response
                  </p>
                </div>
              </div>

              {/* 3. Reliable Logistics */}
              <div className="flex items-center gap-2.5 bg-white/85 dark:bg-slate-900/85 backdrop-blur-md p-2 rounded-xl border border-white/80 dark:border-slate-700/60 shadow-2xs">
                <div className="w-7 h-7 rounded-lg bg-purple-50 dark:bg-purple-950/50 border border-purple-200/80 dark:border-purple-800/60 flex items-center justify-center text-purple-600 dark:text-purple-400 shrink-0">
                  <BarChart3 className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 leading-tight">
                    Reliable Logistics
                  </h4>
                  <p className="text-[10.5px] text-slate-500 dark:text-slate-400 leading-tight font-medium">
                    Data driven operations
                  </p>
                </div>
              </div>
            </div>

            {/* Inspirational Quote */}
            <div className="pt-1">
              <p className="text-sm font-bold italic text-slate-800 dark:text-slate-100 font-serif drop-shadow-xs">
                &ldquo;Secure Routes, Stronger Northeast&rdquo;
              </p>
            </div>
          </div>

          {/* Bottom Tagline Overlaid over the Convoy Highway */}
          <div className="relative z-10 p-5 sm:p-6 pt-12">
            <div className="pt-3 border-t border-white/30 dark:border-white/20">
              <p className="text-[11.5px] text-white font-bold drop-shadow-md">
                Every dispatch makes a safer tomorrow.
              </p>
            </div>
          </div>
        </div>

        {/* =========================================================================
            RIGHT MAIN FORM (4-Step Dispatch Manifest)
           ========================================================================= */}
        <div className="flex-1 bg-white dark:bg-[#0f172a] flex flex-col overflow-hidden">
          
          {/* Header */}
          <div className="p-5 sm:p-6 pb-4 flex items-start justify-between border-b border-slate-100 dark:border-slate-800/80">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-blue-600 text-white shadow-md shadow-blue-500/20">
                <Truck className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white tracking-tight">
                    Start Transit Journey
                  </h3>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200/60 dark:border-blue-800/60">
                    DISPATCH MANIFEST
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                  Log cargo consignment and activate live telemetry broadcast
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form Content */}
          <form onSubmit={handleSubmit} className="p-5 sm:p-6 overflow-y-auto space-y-5 max-h-[calc(94vh-140px)]">
            
            {errorMsg && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/80 border border-rose-200 dark:border-rose-800 rounded-xl text-xs text-rose-700 dark:text-rose-200 flex items-center gap-2 animate-in fade-in">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* ----------------------------------------------------
                STEP 1: OPERATOR DETAILS
               ---------------------------------------------------- */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold shrink-0">
                    1
                  </span>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                      Operator Details
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Verify operator credentials before dispatch
                    </p>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-200/80 dark:border-emerald-800/60">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Verified • Active Duty</span>
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/70 rounded-xl p-2.5">
                  <span className="block text-[10px] font-semibold text-slate-400 dark:text-slate-400 mb-1">Driver Name</span>
                  <div className="flex items-center gap-1.5 text-slate-800 dark:text-slate-100 text-xs font-bold">
                    <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">{driverName}</span>
                  </div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/70 rounded-xl p-2.5">
                  <span className="block text-[10px] font-semibold text-slate-400 dark:text-slate-400 mb-1">Tactical ID</span>
                  <div className="flex items-center gap-1.5 text-slate-800 dark:text-slate-100 text-xs font-bold font-mono">
                    <Shield className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">{driverCode}</span>
                  </div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/70 rounded-xl p-2.5">
                  <span className="block text-[10px] font-semibold text-slate-400 dark:text-slate-400 mb-1">Phone Number</span>
                  <div className="flex items-center gap-1.5 text-slate-800 dark:text-slate-100 text-xs font-bold">
                    <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">{driverPhone}</span>
                  </div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/70 rounded-xl p-2.5">
                  <span className="block text-[10px] font-semibold text-slate-400 dark:text-slate-400 mb-1">Vehicle Registration</span>
                  <div className="flex items-center gap-1.5 text-slate-800 dark:text-slate-100 text-xs font-bold font-mono">
                    <Car className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">{vehicleNumber}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* ----------------------------------------------------
                STEP 2: CARGO INFORMATION
               ---------------------------------------------------- */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold shrink-0">
                    2
                  </span>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                      Cargo Information
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Provide details about the goods being transported
                    </p>
                  </div>
                </div>

                {/* Load from Template Popover Trigger */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowTemplateMenu(!showTemplateMenu)}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200/80 dark:border-blue-800/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-all cursor-pointer"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Load from Template</span>
                  </button>

                  {showTemplateMenu && (
                    <div className="absolute right-0 top-full mt-1.5 w-64 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl z-20 py-1.5 animate-in fade-in zoom-in-95">
                      <div className="px-3 py-1.5 border-b border-slate-100 dark:border-slate-700/60 text-[10px] font-bold uppercase text-slate-400">
                        Select Standard Relief Template
                      </div>
                      {DISPATCH_TEMPLATES.map((tmpl) => (
                        <button
                          key={tmpl.name}
                          type="button"
                          onClick={() => {
                            setCargoType(tmpl.cargo);
                            setCargoWeightVal(tmpl.weight);
                            setCargoWeightUnit(tmpl.unit);
                            setShowTemplateMenu(false);
                          }}
                          className="w-full text-left px-3.5 py-2 text-xs hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors"
                        >
                          <span className="font-bold block text-slate-900 dark:text-white">{tmpl.name}</span>
                          <span className="text-[10px] text-slate-400 truncate block mt-0.5">{tmpl.cargo}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Goods / Cargo Description <span className="text-rose-500">*</span>
                </label>
                <div className="bg-white dark:bg-slate-800/80 border border-slate-200/90 dark:border-slate-700 rounded-2xl px-3.5 py-2.5 flex items-center gap-2.5 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 transition-all">
                  <Package className="w-4 h-4 text-slate-400 shrink-0" />
                  <input
                    type="text"
                    required
                    value={cargoType}
                    onChange={(e) => setCargoType(e.target.value)}
                    placeholder="e.g. Essential Medicines & Cold Storage Vaccines"
                    className="bg-transparent text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none w-full font-medium"
                  />
                </div>
              </div>

              {/* Preset Pill Badges */}
              <div className="flex flex-wrap gap-2 pt-1">
                {CARGO_PRESET_ITEMS.map((item) => {
                  const isSelected = cargoType === item.label;
                  return (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => setCargoType(item.label)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer border ${
                        isSelected
                          ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                          : 'bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 border-slate-200/80 dark:border-slate-700/70 hover:bg-slate-100 dark:hover:bg-slate-700/60'
                      }`}
                    >
                      <span className="text-xs">{item.icon}</span>
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ----------------------------------------------------
                STEP 3: QUANTITY / WEIGHT
               ---------------------------------------------------- */}
            <div className="space-y-2.5">
              <div className="flex items-center gap-2.5">
                <span className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold shrink-0">
                  3
                </span>
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                    Quantity / Weight
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Specify total cargo weight or quantity
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2.5">
                <div className="bg-white dark:bg-slate-800/80 border border-slate-200/90 dark:border-slate-700 rounded-2xl px-3.5 py-2 flex items-center gap-2.5 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 transition-all">
                  <div className="p-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
                    <Scale className="w-4 h-4" />
                  </div>
                  <div className="flex-1">
                    <span className="block text-[9.5px] font-semibold text-slate-400 dark:text-slate-400">
                      Weight / Quantity <span className="text-rose-500">*</span>
                    </span>
                    <input
                      type="number"
                      step="0.1"
                      min="0.1"
                      required
                      value={cargoWeightVal}
                      onChange={(e) => setCargoWeightVal(e.target.value)}
                      placeholder="15.0"
                      className="bg-transparent text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none w-full font-bold"
                    />
                  </div>
                </div>

                {/* Unit Selector Toggle */}
                <div className="flex rounded-2xl bg-slate-100 dark:bg-slate-800 p-1 border border-slate-200/80 dark:border-slate-700">
                  <button
                    type="button"
                    onClick={() => setCargoWeightUnit('MT')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      cargoWeightUnit === 'MT'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    MT (Tons)
                  </button>
                  <button
                    type="button"
                    onClick={() => setCargoWeightUnit('Kg')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      cargoWeightUnit === 'Kg'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    Kg
                  </button>
                </div>
              </div>
            </div>

            {/* ----------------------------------------------------
                STEP 4: ROUTE DETAILS
               ---------------------------------------------------- */}
            <div className="space-y-2.5">
              <div className="flex items-center gap-2.5">
                <span className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold shrink-0">
                  4
                </span>
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                    Route Details
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Select origin and destination facilities
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Origin Facility */}
                <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700 rounded-2xl p-2.5 flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 shrink-0">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="block text-[9.5px] font-semibold text-slate-400 dark:text-slate-400">
                      Origin Facility <span className="text-rose-500">*</span>
                    </span>
                    <select
                      value={selectedOriginId}
                      onChange={(e) => setSelectedOriginId(e.target.value)}
                      className="w-full bg-transparent text-xs text-slate-800 dark:text-slate-100 font-bold focus:outline-none cursor-pointer truncate"
                    >
                      <option value="CURRENT_LOCATION" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">
                        My Current Location (Live GPS)
                      </option>
                      {hubs.map((hub) => (
                        <option key={`orig-${hub.id || hub.hub_code}`} value={hub.id || hub.hub_code} className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">
                          {hub.hub_name} ({hub.hub_code}) - {hub.state}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Destination Hub */}
                <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700 rounded-2xl p-2.5 flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 shrink-0">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="block text-[9.5px] font-semibold text-slate-400 dark:text-slate-400">
                      Destination Hub <span className="text-rose-500">*</span>
                    </span>
                    <select
                      value={selectedDestId}
                      onChange={(e) => setSelectedDestId(e.target.value)}
                      className="w-full bg-transparent text-xs text-slate-800 dark:text-slate-100 font-bold focus:outline-none cursor-pointer truncate"
                    >
                      <option value="" className="bg-white dark:bg-slate-800 text-slate-500">
                        -- Select Destination Facility --
                      </option>
                      {hubs.map((hub) => (
                        <option key={`dest-${hub.id || hub.hub_code}`} value={hub.id || hub.hub_code} className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">
                          {hub.hub_name} ({hub.hub_code}) - {hub.state}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Live Telemetry Notice */}
            <div className="p-3.5 bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-900/40 rounded-2xl flex items-center gap-3 text-xs text-blue-900 dark:text-blue-200">
              <div className="w-8 h-8 rounded-xl bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-cyan-400 flex items-center justify-center shrink-0">
                <Radio className="w-4 h-4 animate-pulse" />
              </div>
              <p className="text-[11.5px] leading-relaxed font-medium">
                Live telemetry will be automatically activated upon dispatch, sharing your convoy position with Nodal Emergency Centers.
              </p>
            </div>

            {/* Footer Action Buttons */}
            <div className="pt-3 flex items-center justify-between gap-3 border-t border-slate-100 dark:border-slate-800/80">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
              >
                <X className="w-3.5 h-3.5" />
                <span>Cancel</span>
              </button>

              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-500/20 flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Dispatching Convoy...</span>
                  </>
                ) : (
                  <>
                    <Truck className="w-4 h-4" />
                    <span>Confirm Dispatch & Begin Journey</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>

          </form>
        </div>

      </div>
    </div>
  );
}
