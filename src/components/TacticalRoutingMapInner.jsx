'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { 
  MapContainer, 
  TileLayer, 
  CircleMarker, 
  Polyline, 
  Popup, 
  Tooltip, 
  useMap 
} from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { 
  Truck, 
  Compass, 
  AlertTriangle, 
  Building2, 
  MapPin, 
  ShieldAlert, 
  ShieldCheck, 
  Navigation, 
  Clock, 
  Zap, 
  Layers, 
  ChevronRight, 
  RotateCcw, 
  Activity, 
  Radio, 
  Phone,
  Check,
  PackageCheck,
  Flame,
  Droplet,
  Pill,
  Wheat,
  LifeBuoy
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { getHubsOffline } from '@/lib/offlineDb';
import { fetchRouteGeometry, findHazardsAlongRoute, getDistanceKm } from '@/lib/routingService';

// Default Active Hazards
const DEFAULT_HAZARDS = [];
const STABLE_DEFAULT_CENTER = [26.2006, 92.9376];

// Commodity configurations
const COMMODITY_CONFIG = {
  medicines: { label: 'Medicines & Cold Chain', icon: Pill, color: 'text-rose-400', badge: 'bg-rose-950 text-rose-300 border-rose-800' },
  food_grains: { label: 'Food Grains & Rations', icon: Wheat, color: 'text-amber-400', badge: 'bg-amber-950 text-amber-300 border-amber-800' },
  fuel: { label: 'Fuel / POL Consignment', icon: Flame, color: 'text-purple-400', badge: 'bg-purple-950 text-purple-300 border-purple-800' },
  drinking_water: { label: 'Potable Drinking Water', icon: Droplet, color: 'text-cyan-400', badge: 'bg-cyan-950 text-cyan-300 border-cyan-800' },
  emergency_kits: { label: 'Disaster Relief Kits', icon: LifeBuoy, color: 'text-emerald-400', badge: 'bg-emerald-950 text-emerald-300 border-emerald-800' },
};

// Map auto-fitter subcomponent
function RouteBoundsController({ routeCoords }) {
  const map = useMap();
  useEffect(() => {
    if (routeCoords && routeCoords.length > 1) {
      try {
        const bounds = L.latLngBounds(routeCoords);
        map.fitBounds(bounds, {
          padding: [60, 60],
          maxZoom: 12,
          animate: true,
          duration: 1.2,
        });
      } catch (err) {
        console.error('FitBounds error:', err);
      }
    }
  }, [routeCoords, map]);
  return null;
}

export default function TacticalRoutingMapInner({ 
  height = '620px', 
  defaultOriginId = null,
  defaultDestId = null,
  activeDrivers = [],
  onRouteCalculated = null 
}) {
  const [hubs, setHubs] = useState([]);
  const [hazards, setHazards] = useState(DEFAULT_HAZARDS);
  const [loadingHubs, setLoadingHubs] = useState(true);

  // Form Selections
  const [originHubId, setOriginHubId] = useState(defaultOriginId || 'HUB-ASM-001'); // Guwahati default
  const [destinationHubId, setDestinationHubId] = useState(defaultDestId || 'HUB-ASM-010'); // Haflong default
  const [commodity, setCommodity] = useState('emergency_kits');
  const [priority, setPriority] = useState('critical');

  // Route State
  const [calculating, setCalculating] = useState(false);
  const [routeData, setRouteData] = useState(null);
  const [corridorHazards, setCorridorHazards] = useState([]);

  // 1. Fetch Hubs & Hazards on load
  useEffect(() => {
    async function loadData() {
      try {
        setLoadingHubs(true);
        // Load Hubs
        const { data: hubsData, error: hubsErr } = await supabase
          .from('supply_hubs')
          .select('*')
          .order('state', { ascending: true });

        if (!hubsErr && hubsData && hubsData.length > 0) {
          setHubs(hubsData);
        } else {
          const offlineHubs = await getHubsOffline();
          if (offlineHubs && offlineHubs.length > 0) {
            setHubs(offlineHubs);
          }
        }

        // Load Hazards
        const { data: hazData } = await supabase
          .from('road_hazards')
          .select('*')
          .neq('status', 'resolved');

        setHazards(hazData || []);
      } catch (err) {
        console.warn('TacticalRouting: Initial data load failed, using fallbacks:', err);
      } finally {
        setLoadingHubs(false);
      }
    }

    loadData();
  }, []);

  // Get selected Origin & Destination Hub Objects
  const originHub = useMemo(() => {
    return hubs.find((h) => h.hub_code === originHubId || h.id === originHubId) || hubs[0];
  }, [hubs, originHubId]);

  const destHub = useMemo(() => {
    return hubs.find((h) => h.hub_code === destinationHubId || h.id === destinationHubId) || hubs[9] || hubs[1];
  }, [hubs, destinationHubId]);

  // 2. Calculate Tactical Route Function
  const calculateRoute = async () => {
    if (!originHub || !destHub) return;
    setCalculating(true);

    const start = [parseFloat(originHub.latitude), parseFloat(originHub.longitude)];
    const end = [parseFloat(destHub.latitude), parseFloat(destHub.longitude)];

    try {
      const result = await fetchRouteGeometry(start, end);
      if (result.success) {
        setRouteData(result);
        
        // Compute active road hazards in proximity of the route polyline
        const closeHazards = findHazardsAlongRoute(result.coordinates, hazards, 15);
        setCorridorHazards(closeHazards);

        if (onRouteCalculated) {
          onRouteCalculated({
            ...result,
            originHub,
            destHub,
            commodity,
            priority,
            corridorHazards: closeHazards,
          });
        }
      }
    } catch (err) {
      console.error('Route calculation error:', err);
    } finally {
      setCalculating(false);
    }
  };

  // Run initial route calculation once hubs are loaded
  useEffect(() => {
    if (hubs.length > 0 && !routeData) {
      calculateRoute();
    }
  }, [hubs]);

  // Format commodity config
  const activeCommodity = COMMODITY_CONFIG[commodity] || COMMODITY_CONFIG.emergency_kits;
  const CommodityIcon = activeCommodity.icon;

  return (
    <div className="w-full bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-2xl flex flex-col relative">
      
      {/* 1. TACTICAL ROUTE SELECTION & DISPATCH PANEL */}
      <div className="bg-slate-900/95 border-b border-slate-800 p-3 sm:p-4 z-20 backdrop-blur-md">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3">
          
          {/* Header Title */}
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-sm">
              <Navigation className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-mono text-sm font-bold text-slate-100 uppercase tracking-wider">
                  CONVOY ROUTE NAVIGATION & TELEMETRY
                </h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-cyan-950/80 text-cyan-300 border border-cyan-700">
                  OSRM TACTICAL ENGINE
                </span>
              </div>
              <p className="text-[11px] font-mono text-slate-400">
                Dynamic hill corridor calculation with real-time hazard avoidance & waypoint geometry
              </p>
            </div>
          </div>

          {/* Quick Route Status Badges */}
          {routeData && (
            <div className="flex items-center space-x-2 font-mono text-xs">
              <div className="px-3 py-1 rounded-lg bg-slate-950 border border-slate-800 flex items-center space-x-1.5">
                <Compass className="w-3.5 h-3.5 text-cyan-400" />
                <span className="text-slate-400">Distance:</span>
                <span className="font-bold text-cyan-300">{routeData.distanceKm} km</span>
              </div>
              <div className="px-3 py-1 rounded-lg bg-slate-950 border border-slate-800 flex items-center space-x-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-slate-400">Hill Transit Time:</span>
                <span className="font-bold text-amber-300">{routeData.durationText}</span>
              </div>
            </div>
          )}
        </div>

        {/* 2. ROUTE SELECTOR FORM CONTROLS */}
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-12 gap-2 pt-2 border-t border-slate-800/80">
          
          {/* Origin Hub */}
          <div className="sm:col-span-4">
            <label className="block text-[10px] font-mono uppercase font-bold text-slate-400 mb-1 flex items-center space-x-1">
              <span className="w-2 h-2 rounded-full bg-cyan-400 inline-block" />
              <span>ORIGIN DEPOT:</span>
            </label>
            <select
              value={originHubId}
              onChange={(e) => setOriginHubId(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 hover:border-cyan-500 rounded-lg text-xs font-mono text-slate-100 focus:outline-none focus:ring-1 focus:ring-cyan-500 cursor-pointer"
            >
              {hubs.map((h) => (
                <option key={`origin-${h.id || h.hub_code}`} value={h.hub_code || h.id}>
                  {h.state}: {h.hub_name} ({h.hub_code})
                </option>
              ))}
            </select>
          </div>

          {/* Destination Hub / Target District */}
          <div className="sm:col-span-4">
            <label className="block text-[10px] font-mono uppercase font-bold text-slate-400 mb-1 flex items-center space-x-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
              <span>DESTINATION DISASTER SECTOR:</span>
            </label>
            <select
              value={destinationHubId}
              onChange={(e) => setDestinationHubId(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 hover:border-emerald-500 rounded-lg text-xs font-mono text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
            >
              {hubs.map((h) => (
                <option key={`dest-${h.id || h.hub_code}`} value={h.hub_code || h.id}>
                  {h.state}: {h.hub_name} - {h.district}
                </option>
              ))}
            </select>
          </div>

          {/* Commodity Type */}
          <div className="sm:col-span-2">
            <label className="block text-[10px] font-mono uppercase font-bold text-slate-400 mb-1">
              COMMODITY:
            </label>
            <select
              value={commodity}
              onChange={(e) => setCommodity(e.target.value)}
              className="w-full px-2 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-100 focus:outline-none focus:ring-1 focus:ring-cyan-500 cursor-pointer"
            >
              {Object.entries(COMMODITY_CONFIG).map(([k, cfg]) => (
                <option key={k} value={k}>
                  {cfg.label}
                </option>
              ))}
            </select>
          </div>

          {/* Calculate Button */}
          <div className="sm:col-span-2 flex items-end">
            <button
              type="button"
              onClick={calculateRoute}
              disabled={calculating}
              className="w-full py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center justify-center space-x-1.5 shadow-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              {calculating ? (
                <>
                  <div className="w-3 h-3 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  <span>Routing...</span>
                </>
              ) : (
                <>
                  <Zap className="w-3.5 h-3.5" />
                  <span>Plot Route</span>
                </>
              )}
            </button>
          </div>

        </div>

      </div>

      {/* 2. LEAFLET ROUTING MAP CONTAINER */}
      <div className="relative w-full" style={{ height }}>
        
        {/* Loading Overlay */}
        {calculating && (
          <div className="absolute inset-0 bg-slate-950/70 z-[500] flex flex-col items-center justify-center space-y-2">
            <div className="w-8 h-8 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin" />
            <span className="text-xs font-mono text-cyan-300 tracking-wider">
              COMPUTING TOPOGRAPHIC WAYPOINTS & MOUNTAIN ROAD TELEMETRY...
            </span>
          </div>
        )}

        <MapContainer
          center={STABLE_DEFAULT_CENTER}
          zoom={7}
          scrollWheelZoom={true}
          style={{ height: '100%', width: '100%', backgroundColor: '#f8fafc' }}
          className="z-0"
        >
          {/* Tile Layer (Clean OpenStreetMap Standard Streets) */}
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            maxZoom={19}
          />

          {/* Auto Fit Bounds on Calculated Route */}
          {routeData?.coordinates && (
            <RouteBoundsController routeCoords={routeData.coordinates} />
          )}

          {/* 1. Outer Glowing Tactical Polyline */}
          {routeData?.coordinates && (
            <Polyline
              positions={routeData.coordinates}
              pathOptions={{
                color: '#00d2ef',
                weight: 8,
                opacity: 0.35,
                lineCap: 'round',
                lineJoin: 'round',
              }}
            />
          )}

          {/* 2. Inner Glowing Core Polyline */}
          {routeData?.coordinates && (() => {
            const sci = routeData.sciScore ?? 10;
            const coreColor = sci < 25 ? '#10b981' : sci < 50 ? '#f59e0b' : '#ef4444';
            return (
              <Polyline
                positions={routeData.coordinates}
                pathOptions={{
                  color: coreColor,
                  weight: 4,
                  opacity: 0.95,
                  dashArray: routeData.isFallback ? '6, 8' : undefined,
                }}
              >
                <Tooltip sticky>
                  <div className="bg-slate-950 text-slate-100 font-mono text-[11px] p-1.5 rounded border border-slate-700">
                    <div className="font-bold text-cyan-300">Convoy Transit Corridor (SCI: {sci}/100)</div>
                    <div>Distance: {routeData.distanceKm} km • Est: {routeData.durationText}</div>
                  </div>
                </Tooltip>
              </Polyline>
            );
          })()}

          {/* 3. Origin Depot Custom Marker */}
          {originHub && (
            <CircleMarker
              center={[parseFloat(originHub.latitude), parseFloat(originHub.longitude)]}
              radius={10}
              pathOptions={{
                color: '#53eafd',
                fillColor: '#00b7d7',
                fillOpacity: 1,
                weight: 3,
              }}
            >
              <Tooltip permanent direction="top" offset={[0, -10]}>
                <div className="bg-slate-950 text-cyan-300 font-mono text-[10px] font-bold px-1 rounded border border-cyan-800">
                  ORIGIN: {originHub.hub_code}
                </div>
              </Tooltip>
              <Popup className="custom-hub-popup" minWidth={280} maxWidth={310}>
                <div className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-sans text-xs rounded-2xl overflow-hidden shadow-2xl border border-slate-200/90 dark:border-slate-800">
                  <div className="bg-[#0f172a] px-3.5 py-2 flex items-center justify-between text-white border-b border-slate-800">
                    <span className="font-bold text-xs tracking-wider font-mono text-cyan-400">
                      {originHub.hub_code || 'ORIGIN-HUB'}
                    </span>
                    <div className="flex items-center gap-1.5 pr-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.9)]" />
                      <span className="text-emerald-400 font-medium text-[10px]">
                        Origin Dispatch
                      </span>
                    </div>
                  </div>
                  <div className="p-3 space-y-2.5">
                    <div>
                      <h4 className="font-bold text-xs text-slate-900 dark:text-white">{originHub.hub_name}</h4>
                      <p className="text-slate-500 dark:text-slate-400 text-[11px] flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                        <span>{originHub.district}, {originHub.state}</span>
                      </p>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/70 rounded-xl p-2 flex items-center justify-between">
                      <span className="text-[10px] text-slate-400 uppercase font-bold">Capacity</span>
                      <strong className="text-xs font-bold text-slate-800 dark:text-slate-100">
                        {originHub.capacity_metric_tons ? `${parseFloat(originHub.capacity_metric_tons).toLocaleString()} MT` : '2,500 MT'}
                      </strong>
                    </div>
                  </div>
                </div>
              </Popup>
            </CircleMarker>
          )}

          {/* 4. Destination Custom Marker */}
          {destHub && (
            <CircleMarker
              center={[parseFloat(destHub.latitude), parseFloat(destHub.longitude)]}
              radius={10}
              pathOptions={{
                color: '#5ee9b5',
                fillColor: '#00bb7f',
                fillOpacity: 1,
                weight: 3,
              }}
            >
              <Tooltip permanent direction="top" offset={[0, -10]}>
                <div className="bg-slate-950 text-emerald-300 font-mono text-[10px] font-bold px-1 rounded border border-emerald-800">
                  DESTINATION: {destHub.district}
                </div>
              </Tooltip>
              <Popup className="custom-hub-popup" minWidth={280} maxWidth={310}>
                <div className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-sans text-xs rounded-2xl overflow-hidden shadow-2xl border border-slate-200/90 dark:border-slate-800">
                  <div className="bg-[#0f172a] px-3.5 py-2 flex items-center justify-between text-white border-b border-slate-800">
                    <span className="font-bold text-xs tracking-wider font-mono text-emerald-400">
                      {destHub.hub_code || 'TARGET-HUB'}
                    </span>
                    <div className="flex items-center gap-1.5 pr-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.9)]" />
                      <span className="text-emerald-400 font-medium text-[10px]">
                        Target Sector
                      </span>
                    </div>
                  </div>
                  <div className="p-3 space-y-2.5">
                    <div>
                      <h4 className="font-bold text-xs text-slate-900 dark:text-white">{destHub.hub_name}</h4>
                      <p className="text-slate-500 dark:text-slate-400 text-[11px] flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                        <span>{destHub.district}, {destHub.state}</span>
                      </p>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/70 rounded-xl p-2 flex items-center justify-between">
                      <span className="text-[10px] text-slate-400 uppercase font-bold">Contact</span>
                      <strong className="text-xs font-bold text-slate-800 dark:text-slate-100">
                        {destHub.contact_phone || 'Nodal Relief Desk'}
                      </strong>
                    </div>
                  </div>
                </div>
              </Popup>
            </CircleMarker>
          )}

          {/* 5. Plot Active Road Hazards on Map */}
          {hazards.map((haz) => {
            const hLat = parseFloat(haz.latitude);
            const hLon = parseFloat(haz.longitude);
            if (isNaN(hLat) || isNaN(hLon)) return null;

            const isCritical = haz.severity === 'critical';

            return (
              <CircleMarker
                key={haz.id}
                center={[hLat, hLon]}
                radius={isCritical ? 9 : 7}
                pathOptions={{
                  color: isCritical ? '#ffccd3' : '#fee685',
                  fillColor: isCritical ? '#ff2357' : '#f99c00',
                  fillOpacity: 0.9,
                  weight: 2,
                }}
              >
                <Tooltip direction="bottom">
                  <div className="bg-slate-950 text-rose-300 font-mono text-[10px] p-1 rounded border border-rose-800">
                    <span className="font-bold uppercase">⚠️ {haz.hazard_type?.replace(/_/g, ' ')}</span>
                  </div>
                </Tooltip>

                <Popup>
                  <div className="bg-slate-950 text-slate-100 font-mono p-3 rounded-lg border border-rose-800 shadow-2xl max-w-xs">
                    <div className="flex items-center justify-between pb-1 mb-1 border-b border-slate-800">
                      <span className="text-[10px] font-bold uppercase text-rose-400">
                        ACTIVE HAZARD
                      </span>
                      <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-800">
                        {haz.severity}
                      </span>
                    </div>
                    <h5 className="text-xs font-bold text-white">{haz.title}</h5>
                    <p className="text-[10px] text-slate-300 mt-1">{haz.notes}</p>
                    <div className="text-[9px] text-slate-500 mt-1.5">{haz.district}, {haz.state}</div>
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}

          {/* 6. Active Live Telemetry Convoy Drivers */}
          {activeDrivers && activeDrivers.map((drv) => {
            const lat = parseFloat(drv.current_latitude);
            const lng = parseFloat(drv.current_longitude);
            if (isNaN(lat) || isNaN(lng)) return null;

            return (
              <CircleMarker
                key={drv.id || drv.driver_code}
                center={[lat, lng]}
                radius={8}
                pathOptions={{
                  color: '#34d399',
                  fillColor: '#059669',
                  fillOpacity: 0.95,
                  weight: 3,
                }}
              >
                <Tooltip direction="top" offset={[0, -8]}>
                  <div className="bg-slate-950 text-emerald-300 font-mono text-[10px] p-1 rounded border border-emerald-800 flex items-center space-x-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span>{drv.driver_code || 'LIVE TRUCK'} ({drv.full_name || 'Driver'})</span>
                  </div>
                </Tooltip>
                <Popup>
                  <div className="bg-slate-950 text-slate-100 font-mono p-3 rounded-lg border border-emerald-800 shadow-2xl max-w-xs">
                    <div className="flex items-center justify-between pb-1 mb-1 border-b border-slate-800">
                      <span className="text-[10px] font-bold uppercase text-emerald-400 flex items-center space-x-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        <span>LIVE RELIEF VEHICLE</span>
                      </span>
                      <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                        ACTIVE DUTY
                      </span>
                    </div>
                    <h5 className="text-xs font-bold text-white">{drv.full_name || 'Convoy Operator'}</h5>
                    <div className="text-[10px] text-slate-300 mt-1 font-sans">
                      <div>Code: <strong className="font-mono text-cyan-300">{drv.driver_code}</strong></div>
                      <div>Vehicle Reg: <strong className="font-mono text-cyan-400">{drv.vehicle_number || 'AS-01-AX-9921'}</strong></div>
                    </div>
                    <div className="text-[9px] text-slate-500 mt-1.5 font-mono">
                      Last Ping: {drv.last_ping ? new Date(drv.last_ping).toLocaleTimeString() : 'Just now'}
                    </div>
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}
        </MapContainer>

        {/* 3. FLOATING HUD TELEMETRY & HAZARD PROXIMITY CARD OVERLAY */}
        <div className="absolute top-4 right-4 z-[400] max-w-sm w-full bg-slate-950/95 border border-slate-800 rounded-xl p-3.5 shadow-2xl backdrop-blur-xl space-y-2.5 font-mono text-xs">
          
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex items-center space-x-2">
              <Activity className="w-4 h-4 text-cyan-400" />
              <span className="font-bold text-white uppercase text-xs">TACTICAL CONVOY HUD</span>
            </div>
            <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border ${
              priority === 'critical' ? 'bg-rose-950 text-rose-300 border-rose-800' : 'bg-amber-950 text-amber-300 border-amber-800'
            }`}>
              {priority} PRIORITY
            </span>
          </div>

          {/* Consignment Info */}
          <div className="flex items-center justify-between bg-slate-900/90 p-2 rounded-lg border border-slate-800">
            <div className="flex items-center space-x-2">
              <CommodityIcon className={`w-4 h-4 ${activeCommodity.color}`} />
              <span className="text-[11px] font-bold text-slate-200">{activeCommodity.label}</span>
            </div>
            <span className="text-[10px] text-slate-400">Payload: 25 MT</span>
          </div>

          {/* Telemetry Stats */}
          {routeData && (
            <div className="grid grid-cols-2 gap-2 bg-slate-900/60 p-2 rounded-lg border border-slate-800">
              <div>
                <div className="text-[9px] text-slate-400 uppercase">Transit Distance</div>
                <div className="text-sm font-bold text-cyan-300">{routeData.distanceKm} KM</div>
              </div>
              <div>
                <div className="text-[9px] text-slate-400 uppercase">Mountain ETA</div>
                <div className="text-sm font-bold text-amber-300">{routeData.durationText}</div>
              </div>
            </div>
          )}

          {/* Hazard Corridor Warning Section */}
          <div className="pt-1">
            {corridorHazards.length > 0 ? (
              <div className="p-2.5 rounded-lg bg-rose-950/50 border border-rose-700/80 text-rose-200 text-[11px] space-y-1.5">
                <div className="flex items-center space-x-1.5 font-bold uppercase text-rose-300">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                  <span>CORRIDOR ALERT ({corridorHazards.length} HAZARD{corridorHazards.length > 1 ? 'S' : ''} DETECTED)</span>
                </div>
                <div className="space-y-1 text-[10px] text-rose-300/90 max-h-24 overflow-y-auto">
                  {corridorHazards.map((h, i) => (
                    <div key={i} className="flex items-start justify-between border-t border-rose-900/50 pt-1">
                      <span className="truncate mr-1">• {h.title}</span>
                      <span className="font-bold text-amber-300 shrink-0">{h.distanceFromRouteKm} km off route</span>
                    </div>
                  ))}
                </div>
                <div className="text-[9px] text-rose-400 pt-0.5">
                  Recommendation: Heavy convoy clearance teams or alternate transit loop recommended.
                </div>
              </div>
            ) : (
              <div className="p-2 rounded-lg bg-emerald-950/40 border border-emerald-800 text-emerald-300 text-[11px] flex items-center space-x-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>CORRIDOR CLEAR: No critical road blocks within 15 km buffer.</span>
              </div>
            )}
          </div>

        </div>

      </div>

      {/* 4. FOOTER STATUS */}
      <div className="bg-slate-900/90 border-t border-slate-800 p-2.5 px-4 flex flex-wrap items-center justify-between text-xs font-mono text-slate-400">
        <div className="flex items-center space-x-2">
          <Radio className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
          <span>Origin: <strong className="text-white">{originHub?.hub_name}</strong> $\rightarrow$ Destination: <strong className="text-white">{destHub?.district} Sector</strong></span>
        </div>
        <div className="text-[11px]">
          Engine: <strong className="text-cyan-300">{routeData?.isFallback ? 'Geodesic Topographic Arc' : 'Live OSRM Highway Grid'}</strong>
        </div>
      </div>

    </div>
  );
}
