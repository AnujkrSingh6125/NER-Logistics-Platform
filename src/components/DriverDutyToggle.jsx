'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Radio, Power, Navigation, ShieldCheck, AlertCircle, Loader2 } from 'lucide-react';

export default function DriverDutyToggle({ driverProfile }) {
  const [isTracking, setIsTracking] = useState(driverProfile?.is_active_duty || false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [currentCoords, setCurrentCoords] = useState(null);
  const watchIdRef = useRef(null);

  // 1. Start Continuous Tracking
  const startTracking = async () => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      setErrorMsg('Geolocation is not supported on this device.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    // Register watchPosition listener
    watchIdRef.current = navigator.geolocation.watchPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        setCurrentCoords({ lat: latitude, lng: longitude });

        try {
          if (driverProfile?.id) {
            // Stream coordinates & active status to Supabase
            await supabase
              .from('driver_profiles')
              .update({
                current_latitude: latitude,
                current_longitude: longitude,
                is_active_duty: true,
                last_ping: new Date().toISOString(),
              })
              .eq('id', driverProfile.id);
          }

          // Also broadcast custom window event for immediate in-browser reactivity
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('ner_driver_telemetry', {
              detail: {
                id: driverProfile?.id || 'current-driver',
                driver_code: driverProfile?.driver_code || 'DRV-NER-001',
                full_name: driverProfile?.full_name || 'Field Operator',
                current_latitude: latitude,
                current_longitude: longitude,
                is_active_duty: true,
                last_ping: new Date().toISOString(),
              }
            }));
          }

          setIsTracking(true);
          setLoading(false);
        } catch (err) {
          console.error('Failed to sync telemetry coordinates:', err);
        }
      },
      (error) => {
        setLoading(false);
        if (error.code === error.PERMISSION_DENIED) {
          setErrorMsg('Location permission denied. Please enable GPS in browser settings.');
        } else {
          setErrorMsg(error.message || 'Error acquiring location.');
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 0,
      }
    );
  };

  // 2. Stop Tracking & Halt Hardware GPS
  const stopTracking = async () => {
    setLoading(true);

    // Halt the browser GPS listener
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    try {
      if (driverProfile?.id) {
        // Mark driver as inactive in database
        await supabase
          .from('driver_profiles')
          .update({
            is_active_duty: false,
            last_ping: new Date().toISOString(),
          })
          .eq('id', driverProfile.id);
      }

      // Broadcast custom window event for immediate in-browser reactivity
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('ner_driver_telemetry', {
          detail: {
            id: driverProfile?.id || 'current-driver',
            is_active_duty: false,
          }
        }));
      }

      setIsTracking(false);
      setCurrentCoords(null);
    } catch (err) {
      console.error('Failed to update duty status:', err);
    } finally {
      setLoading(false);
    }
  };

  // 3. Cleanup on component unmount & tab close
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  return (
    <div className="bg-slate-900 dark:bg-slate-950 border border-slate-800 rounded-2xl p-4 shadow-xl text-slate-100 font-mono">
      {/* Header & Status Indicator */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div>
          <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">Assigned Driver Code</span>
          <h4 className="font-mono text-sm font-bold text-cyan-400">{driverProfile?.driver_code || 'DRV-NER-LIVE'}</h4>
        </div>
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono font-bold border ${
          isTracking 
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
            : 'bg-slate-800 border-slate-700 text-slate-400'
        }`}>
          <Radio className={`w-3 h-3 text-emerald-400 ${isTracking ? 'animate-pulse' : ''}`} />
          {isTracking ? 'LIVE BROADCAST ON' : 'TRACKING PAUSED'}
        </div>
      </div>

      {/* Driver Coordinates & Metrics */}
      <div className="py-3 text-xs space-y-1 font-mono text-slate-300">
        <p className="flex justify-between">
          <span className="text-slate-500">Operator:</span> 
          <span className="text-slate-200 font-semibold">{driverProfile?.full_name || 'Field Operator'}</span>
        </p>
        <p className="flex justify-between">
          <span className="text-slate-500">Telemetry Status:</span>
          <span className={isTracking ? 'text-emerald-400 font-bold' : 'text-slate-400'}>
            {isTracking ? 'Streaming GPS to Gov Command HQ' : 'Offline (Privacy Mode)'}
          </span>
        </p>
        {currentCoords && isTracking && (
          <p className="flex justify-between text-cyan-400 pt-1">
            <span className="text-slate-500">Live Lat / Lng:</span>
            <span>[{currentCoords.lat.toFixed(4)}, {currentCoords.lng.toFixed(4)}]</span>
          </p>
        )}
      </div>

      {/* Error Message Callout */}
      {errorMsg && (
        <div className="mb-3 p-2 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-400 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0"/>
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Toggle Action CTA Button */}
      <button
        type="button"
        disabled={loading}
        onClick={isTracking ? stopTracking : startTracking}
        className={`w-full py-2.5 rounded-xl text-xs font-mono font-bold uppercase transition-all flex items-center justify-center gap-2 shadow-md cursor-pointer ${
          isTracking
            ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/20'
            : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20'
        }`}
      >
        <Power className="w-3.5 h-3.5"/>
        {loading 
          ? 'Processing...' 
          : isTracking 
            ? 'Stop Live Tracking (Go Offline)' 
            : 'Start Live Tracking (Go On Duty)'}
      </button>
    </div>
  );
}
