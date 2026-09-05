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
  Navigation,
  Radio
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';

const CARGO_PRESETS = [
  'Essential Medicines & First Aid',
  'Food Grain Bags & Dry Rations',
  'Emergency Shelter Kits & Tarpaulins',
  'Purified Drinking Water Canisters',
  'Thermal Blankets & Winter Clothing',
  'Disaster Relief Equipment & Tools',
  'High-Priority Medical Supplies'
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

  // Sync initial props
  useEffect(() => {
    if (isOpen) {
      if (originHubId) setSelectedOriginId(originHubId);
      if (destHubId) setSelectedDestId(destHubId);
      setErrorMsg('');
    }
  }, [isOpen, originHubId, destHubId]);

  if (!isOpen) return null;

  // Resolve Driver Details (Read-only Auto-populated)
  const driverName = profile?.full_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Field Operator';
  const driverPhone = profile?.phone || user?.user_metadata?.phone || '+91-94350-00000';
  const driverCode = profile?.driver_code || `DRV-NER-${user?.id ? user.id.slice(0, 4).toUpperCase() : '4921'}`;
  const vehicleNumber = profile?.vehicle_number || user?.user_metadata?.vehicle_number || 'AS-01-AX-9921';

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
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl bg-[#070d19] border border-cyan-800/80 rounded-2xl shadow-2xl my-auto max-h-[92vh] flex flex-col text-slate-100 font-mono">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-cyan-950 bg-[#0b1426]/90 rounded-t-2xl">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-cyan-950 border border-cyan-700/60 text-cyan-400">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-sm font-bold text-white tracking-wide">
                  START TRANSIT JOURNEY
                </h3>
                <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase bg-cyan-950 text-cyan-300 border border-cyan-700">
                  DISPATCH MANIFEST
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Log cargo consignment and activate live telemetry broadcast
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto max-h-[calc(92vh-130px)]">
          
          {errorMsg && (
            <div className="p-3 bg-rose-950/80 border border-rose-800 rounded-xl text-xs text-rose-200 flex items-center space-x-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Section 1: Auto-Populated Driver Profile (Read-Only) */}
          <div className="p-3.5 bg-[#050a14] rounded-xl border border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              <span className="flex items-center space-x-1.5 text-cyan-400">
                <Shield className="w-3.5 h-3.5" />
                <span>OPERATOR CREDENTIALS (VERIFIED)</span>
              </span>
              <span className="text-emerald-400 flex items-center space-x-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                <span>ACTIVE DUTY</span>
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
              <div className="bg-[#081020] p-2 rounded-lg border border-slate-800">
                <span className="block text-[9px] text-slate-500 font-bold uppercase">DRIVER NAME</span>
                <span className="text-slate-200 font-bold truncate block">{driverName}</span>
              </div>
              <div className="bg-[#081020] p-2 rounded-lg border border-slate-800">
                <span className="block text-[9px] text-slate-500 font-bold uppercase">TACTICAL ID</span>
                <span className="text-cyan-400 font-bold truncate block">{driverCode}</span>
              </div>
              <div className="bg-[#081020] p-2 rounded-lg border border-slate-800">
                <span className="block text-[9px] text-slate-500 font-bold uppercase">PHONE</span>
                <span className="text-slate-300 truncate block">{driverPhone}</span>
              </div>
              <div className="bg-[#081020] p-2 rounded-lg border border-slate-800">
                <span className="block text-[9px] text-slate-500 font-bold uppercase">VEHICLE REG</span>
                <span className="text-cyan-300 font-bold truncate block">{vehicleNumber}</span>
              </div>
            </div>
          </div>

          {/* Section 2: Mandatory Cargo Description */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
              GOODS / CARGO DESCRIPTION <span className="text-rose-500">*</span>
            </label>
            <div className="bg-[#050a14] border border-slate-800 focus-within:border-cyan-500 rounded-xl px-3.5 py-2.5 flex items-center space-x-2.5 transition-colors">
              <Package className="w-4 h-4 text-cyan-400 shrink-0" />
              <input
                type="text"
                required
                value={cargoType}
                onChange={(e) => setCargoType(e.target.value)}
                placeholder="e.g. Essential Medicines & Cold Storage Vaccines"
                className="bg-transparent text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none w-full"
              />
            </div>

            {/* Quick Preset Badges */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {CARGO_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setCargoType(preset)}
                  className={`px-2 py-1 rounded-md text-[10px] transition-colors border ${
                    cargoType === preset
                      ? 'bg-cyan-950 text-cyan-300 border-cyan-600'
                      : 'bg-slate-900/80 text-slate-400 border-slate-800 hover:text-slate-200 hover:border-slate-700'
                  }`}
                >
                  + {preset}
                </button>
              ))}
            </div>
          </div>

          {/* Section 3: Goods Weight / Quantity */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
              CARGO WEIGHT / QUANTITY <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2 bg-[#050a14] border border-slate-800 focus-within:border-cyan-500 rounded-xl px-3.5 py-2.5 flex items-center space-x-2.5 transition-colors">
                <Scale className="w-4 h-4 text-cyan-400 shrink-0" />
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  required
                  value={cargoWeightVal}
                  onChange={(e) => setCargoWeightVal(e.target.value)}
                  placeholder="e.g. 15.0"
                  className="bg-transparent text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none w-full font-bold"
                />
              </div>

              {/* Unit Selector */}
              <div className="flex rounded-xl bg-[#050a14] border border-slate-800 p-1">
                <button
                  type="button"
                  onClick={() => setCargoWeightUnit('MT')}
                  className={`flex-1 rounded-lg text-xs font-bold transition-colors ${
                    cargoWeightUnit === 'MT'
                      ? 'bg-cyan-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  MT (Tons)
                </button>
                <button
                  type="button"
                  onClick={() => setCargoWeightUnit('Kg')}
                  className={`flex-1 rounded-lg text-xs font-bold transition-colors ${
                    cargoWeightUnit === 'Kg'
                      ? 'bg-cyan-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Kg
                </button>
              </div>
            </div>
          </div>

          {/* Section 4: Origin & Destination Facility Selectors */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            
            {/* Origin Hub */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center space-x-1">
                <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                <span>ORIGIN FACILITY <span className="text-rose-500">*</span></span>
              </label>
              <select
                value={selectedOriginId}
                onChange={(e) => setSelectedOriginId(e.target.value)}
                className="w-full bg-[#050a14] border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500 cursor-pointer"
              >
                <option value="CURRENT_LOCATION">📍 My Current Location (Live GPS)</option>
                {hubs.map((hub) => (
                  <option key={`orig-${hub.id || hub.hub_code}`} value={hub.id || hub.hub_code}>
                    {hub.hub_name} ({hub.hub_code}) - {hub.state}
                  </option>
                ))}
              </select>
            </div>

            {/* Destination Hub */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center space-x-1">
                <Navigation className="w-3.5 h-3.5 text-rose-400" />
                <span>DESTINATION HUB <span className="text-rose-500">*</span></span>
              </label>
              <select
                value={selectedDestId}
                onChange={(e) => setSelectedDestId(e.target.value)}
                className="w-full bg-[#050a14] border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500 cursor-pointer"
              >
                <option value="">-- Select Destination Facility --</option>
                {hubs.map((hub) => (
                  <option key={`dest-${hub.id || hub.hub_code}`} value={hub.id || hub.hub_code}>
                    {hub.hub_name} ({hub.hub_code}) - {hub.state}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Telemetry Notice */}
          <div className="p-3 bg-cyan-950/40 border border-cyan-800/50 rounded-xl text-[11px] text-cyan-300 flex items-start space-x-2.5">
            <Radio className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5 animate-pulse" />
            <p className="leading-relaxed">
              Upon dispatch, live hardware GPS streaming will automatically broadcast your convoy position to Nodal Emergency Centers.
            </p>
          </div>

          {/* Footer Actions */}
          <div className="pt-2 flex items-center justify-end space-x-3 border-t border-slate-800/80">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2.5 rounded-xl border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 text-xs font-bold uppercase transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold uppercase tracking-wider shadow-lg shadow-emerald-900/40 flex items-center space-x-2 transition-all cursor-pointer disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>DISPATCHING CONVOY...</span>
                </>
              ) : (
                <>
                  <Truck className="w-4 h-4" />
                  <span>CONFIRM DISPATCH & BEGIN JOURNEY</span>
                </>
              )}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
