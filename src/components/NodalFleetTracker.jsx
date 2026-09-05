'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Marker, Popup, Tooltip, Circle } from 'react-leaflet';
import L from 'leaflet';
import { Truck, Radio, Navigation, ShieldCheck, Clock, MapPin, AlertCircle } from 'lucide-react';

// Custom Animated Radar Pulse Driver Icon
const createDriverIcon = (driverCode) => {
  return L.divIcon({
    className: 'custom-driver-pin',
    html: `
      <div class="relative flex items-center justify-center w-8 h-8">
        <span class="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping"></span>
        <div class="relative inline-flex items-center justify-center w-7 h-7 rounded-full bg-emerald-600 border-2 border-white shadow-lg text-white font-mono text-[9px] font-bold">
          🚚
        </div>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16],
  });
};

export default function NodalFleetTracker({ onDriverCountChange }) {
  const [activeDrivers, setActiveDrivers] = useState([]);
  const [lastUpdate, setLastUpdate] = useState(null);
  const onDriverCountChangeRef = React.useRef(onDriverCountChange);

  useEffect(() => {
    onDriverCountChangeRef.current = onDriverCountChange;
  }, [onDriverCountChange]);

  useEffect(() => {
    // 1. Initial fetch of active duty drivers
    async function fetchActiveDrivers() {
      try {
        const { data, error } = await supabase
          .from('driver_profiles')
          .select('*')
          .eq('is_active_duty', true);

        if (!error && data) {
          setActiveDrivers(data);
          setLastUpdate(new Date());
          if (onDriverCountChangeRef.current) onDriverCountChangeRef.current(data.length);
        }
      } catch (err) {
        console.warn('Initial driver fleet fetch fallback:', err);
      }
    }

    fetchActiveDrivers();

    // 2. Realtime subscription to public.driver_profiles
    const channel = supabase
      .channel('public:driver_profiles_tracking')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'driver_profiles' },
        (payload) => {
          const { eventType, new: newRec, old: oldRec } = payload;
          setLastUpdate(new Date());

          if (eventType === 'INSERT' || eventType === 'UPDATE') {
            if (newRec && newRec.is_active_duty) {
              setActiveDrivers((prev) => {
                const filtered = prev.filter((d) => d.id !== newRec.id);
                const updated = [newRec, ...filtered];
                if (onDriverCountChangeRef.current) onDriverCountChangeRef.current(updated.length);
                return updated;
              });
            } else if (newRec && !newRec.is_active_duty) {
              // Instantly remove driver from map when they go offline
              setActiveDrivers((prev) => {
                const updated = prev.filter((d) => d.id !== newRec.id);
                if (onDriverCountChangeRef.current) onDriverCountChangeRef.current(updated.length);
                return updated;
              });
            }
          } else if (eventType === 'DELETE' && oldRec) {
            setActiveDrivers((prev) => {
              const updated = prev.filter((d) => d.id !== oldRec.id);
              if (onDriverCountChangeRef.current) onDriverCountChangeRef.current(updated.length);
              return updated;
            });
          }
        }
      )
      .subscribe();

    // 3. Local in-browser event listener for immediate zero-latency reactivity
    const handleLocalTelemetry = (e) => {
      const drv = e.detail;
      if (!drv) return;
      setLastUpdate(new Date());

      if (drv.is_active_duty) {
        setActiveDrivers((prev) => {
          const filtered = prev.filter((d) => d.id !== drv.id);
          const updated = [drv, ...filtered];
          if (onDriverCountChangeRef.current) onDriverCountChangeRef.current(updated.length);
          return updated;
        });
      } else {
        setActiveDrivers((prev) => {
          const updated = prev.filter((d) => d.id !== drv.id);
          if (onDriverCountChangeRef.current) onDriverCountChangeRef.current(updated.length);
          return updated;
        });
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('ner_driver_telemetry', handleLocalTelemetry);
    }

    return () => {
      supabase.removeChannel(channel);
      if (typeof window !== 'undefined') {
        window.removeEventListener('ner_driver_telemetry', handleLocalTelemetry);
      }
    };
  }, []);

  return (
    <>
      {activeDrivers.map((driver) => {
        const lat = parseFloat(driver.current_latitude);
        const lng = parseFloat(driver.current_longitude);
        if (isNaN(lat) || isNaN(lng)) return null;

        const customIcon = createDriverIcon(driver.driver_code);

        return (
          <React.Fragment key={driver.id || driver.driver_code}>
            {/* Accuracy Pulse Ring */}
            <Circle
              center={[lat, lng]}
              radius={350}
              pathOptions={{
                color: '#10b981',
                fillColor: '#10b981',
                fillOpacity: 0.12,
                weight: 1.5,
              }}
            />

            {/* Live Vehicle Marker */}
            <Marker position={[lat, lng]} icon={customIcon}>
              <Tooltip permanent={false} direction="top" offset={[0, -16]}>
                <div className="bg-slate-950 text-emerald-300 font-mono text-[10px] p-1.5 rounded-lg border border-emerald-800 shadow-xl flex items-center space-x-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="font-bold">{driver.driver_code || 'LIVE TRUCK'}</span>
                  <span>({driver.full_name || 'Driver'})</span>
                </div>
              </Tooltip>

              <Popup>
                <div className="bg-slate-950 text-slate-100 font-mono p-3 rounded-xl border border-emerald-800 shadow-2xl max-w-xs space-y-2">
                  <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
                    <span className="text-[10px] font-bold uppercase text-emerald-400 flex items-center space-x-1">
                      <Radio className="w-3.5 h-3.5 animate-pulse" />
                      <span>LIVE TELEMETRY STREAM</span>
                    </span>
                    <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 font-bold">
                      ON DUTY
                    </span>
                  </div>

                  <div className="space-y-1 text-xs">
                    <h5 className="font-bold text-white text-sm">{driver.full_name}</h5>
                    <div className="text-[11px] text-cyan-300 font-mono">
                      Tactical ID: <strong>{driver.driver_code}</strong>
                    </div>
                    <div className="text-[10px] text-slate-300 font-mono">
                      Vehicle Reg: <strong className="text-cyan-400">{driver.vehicle_number || 'AS-01-AX-9921'}</strong>
                    </div>
                    <div className="text-[9px] text-slate-500 pt-1 font-mono">
                      Telemetry: {driver.last_telemetry_at || driver.last_ping ? new Date(driver.last_telemetry_at || driver.last_ping).toLocaleTimeString() : 'Live Radar'}
                    </div>
                  </div>
                </div>
              </Popup>
            </Marker>
          </React.Fragment>
        );
      })}
    </>
  );
}
