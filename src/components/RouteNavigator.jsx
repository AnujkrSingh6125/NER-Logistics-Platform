'use client';

import React, { useState } from 'react';
import { 
  Navigation, 
  RotateCcw, 
  Truck, 
  Radio, 
  CheckCircle2, 
  Trash2, 
  ChevronDown, 
  ChevronUp, 
  Clock, 
  AlertTriangle,
  LocateFixed,
  Zap
} from 'lucide-react';

/**
 * RouteNavigator Component
 * 
 * Features:
 * 1. Persistent Route Finding Controls: Origin & Destination dropdowns, Find Best Route, and Reset
 *    buttons are permanently accessible and never covered up during an active transit.
 * 2. Decoupled Active Convoy Telemetry Pod: Displayed beneath calculation controls with a collapsible
 *    header so operators can minimize it while inspecting multiple route options.
 * 3. Candidate Corridors List: Interactive cards allowing instant preview and selection of candidate routes.
 * 4. Proper Layout & Scroll Handling: Flex-col container with max height to prevent viewport overflow.
 */
export default function RouteNavigator({
  hubs = [],
  originHubId = '',
  destHubId = '',
  onSelectOrigin,
  onSelectDestination,
  onCalculateRoutes,
  onResetRoutes,
  calculatingRoute = false,
  routingError = '',
  journeyNotice = null,
  routes = [],
  activeRouteIndex = 0,
  onSelectRouteIndex,
  isTransitActive = false,
  activeConvoyData = null,
  onStartTransit,
  onMarkDelivered,
  onTerminateTransit,
  markingDelivered = false,
  terminatingJourney = false,
  isGpsActive = false,
}) {
  const [isConvoyPodMinimized, setIsConvoyPodMinimized] = useState(false);

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-4 font-mono text-xs text-slate-800 dark:text-slate-100 flex flex-col gap-3 max-h-none lg:max-h-[calc(100vh-180px)] overflow-y-auto pr-1 shadow-xs custom-scrollbar">
      
      {/* 1. SECTION HEADER */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center space-x-1.5">
          <Navigation className="w-4 h-4 text-blue-600 dark:text-cyan-400" />
          <span className="text-xs font-bold uppercase tracking-wide text-slate-800 dark:text-slate-100">
            ROUTE NAVIGATOR
          </span>
        </div>
        <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700">
          OSRM • HIGHWAY
        </span>
      </div>

      {/* 2. ORIGIN & DESTINATION DROPDOWNS (Always Visible) */}
      <div className="space-y-2.5">
        {/* Origin Selector */}
        <div>
          <label className="block text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 mb-1 flex items-center justify-between">
            <span className="flex items-center space-x-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>ORIGIN SUPPLY HUB:</span>
            </span>
            {isGpsActive && (
              <span className="text-[9px] text-blue-600 dark:text-cyan-400 font-bold flex items-center space-x-1">
                <LocateFixed className="w-2.5 h-2.5" />
                <span>GPS Active</span>
              </span>
            )}
          </label>
          <select
            value={originHubId}
            onChange={(e) => onSelectOrigin && onSelectOrigin(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl py-3 px-3 sm:py-2 sm:px-2.5 text-xs text-slate-800 dark:text-slate-200 font-sans focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer truncate min-h-[44px]"
          >
            <option value="">-- Select Origin Hub (50 Facilities) --</option>
            <option value="CURRENT_LOCATION" className="font-bold text-blue-700 dark:text-cyan-400">
              📍 My Current Location (Live GPS Position)
            </option>
            {hubs.map((h) => {
              const val = h.hub_code || h.id;
              const isDisabled = val === destHubId;
              return (
                <option key={`orig-${val}`} value={val} disabled={isDisabled}>
                  {h.state}: {h.hub_name} ({h.hub_code}){isDisabled ? ' (Selected as Dest)' : ''}
                </option>
              );
            })}
          </select>
        </div>

        {/* Destination Selector */}
        <div>
          <label className="block text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 mb-1 flex items-center space-x-1">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
            <span>DESTINATION SUPPLY HUB:</span>
          </label>
          <select
            value={destHubId}
            onChange={(e) => onSelectDestination && onSelectDestination(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl py-3 px-3 sm:py-2 sm:px-2.5 text-xs text-slate-800 dark:text-slate-200 font-sans focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer truncate min-h-[44px]"
          >
            <option value="">-- Select Destination Hub (50 Facilities) --</option>
            {hubs.map((h) => {
              const val = h.hub_code || h.id;
              const isDisabled = val === originHubId;
              return (
                <option key={`dest-${val}`} value={val} disabled={isDisabled}>
                  {h.state}: {h.hub_name} ({h.hub_code}){isDisabled ? ' (Selected as Origin)' : ''}
                </option>
              );
            })}
          </select>
        </div>
      </div>

      {/* Inline Routing Error Alert if any */}
      {routingError && (
        <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-[11px] font-sans flex items-center space-x-1.5 animate-in fade-in duration-150">
          <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" />
          <span>{routingError}</span>
        </div>
      )}

      {/* Journey Status Notice Alert if any */}
      {journeyNotice && (
        <div className={`p-2.5 rounded-xl text-xs font-mono font-bold flex items-center space-x-1.5 ${
          journeyNotice.type === 'success'
            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
            : 'bg-blue-500/10 text-blue-600 dark:text-cyan-400 border border-blue-500/30'
        }`}>
          <Radio className="w-3.5 h-3.5 animate-pulse shrink-0" />
          <span>{journeyNotice.message}</span>
        </div>
      )}

      {/* 3. PRIMARY ROUTE FINDING ACTIONS (Permanently Accessible) */}
      <div className="flex items-center space-x-2 pt-0.5">
        <button
          type="button"
          onClick={onCalculateRoutes}
          disabled={calculatingRoute || !originHubId || !destHubId}
          className="flex-1 min-h-[48px] bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-bold text-xs uppercase tracking-wider py-3 px-3 rounded-xl shadow-md shadow-blue-500/20 flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-98 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {calculatingRoute ? (
            <>
              <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
              <span>Routing...</span>
            </>
          ) : (
            <>
              <Zap className="w-4 h-4 fill-current" />
              <span>FIND BEST ROUTE</span>
            </>
          )}
        </button>

        <button
          type="button"
          onClick={onResetRoutes}
          title="Reset Selection & Clear Route Geometry"
          className="px-3.5 py-3 min-h-[48px] rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 flex items-center justify-center space-x-1 text-xs font-bold transition-all cursor-pointer shadow-2xs shrink-0 active:scale-98"
        >
          <RotateCcw className="w-4 h-4" />
          <span className="hidden sm:inline text-[11px]">RESET</span>
        </button>
      </div>

      {/* 4. ACTIVE CONVOY TELEMETRY POD (Decoupled & Collapsible) */}
      {isTransitActive && activeConvoyData && (
        <div className="bg-gradient-to-br from-emerald-950/40 via-slate-900 to-slate-950 border border-emerald-500/40 rounded-2xl p-3 shadow-lg space-y-2 text-white animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider font-mono">
                CONVOY IN TRANSIT
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] font-mono text-cyan-300 bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-800 font-bold">
                {activeConvoyData.tracking_code || activeConvoyData.convoyCode || 'TRK-NER'}
              </span>
              <button
                type="button"
                onClick={() => setIsConvoyPodMinimized((prev) => !prev)}
                title={isConvoyPodMinimized ? 'Expand Convoy Telemetry' : 'Minimize Convoy Telemetry'}
                className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-slate-800/80 transition-colors"
              >
                {isConvoyPodMinimized ? (
                  <ChevronDown className="w-3.5 h-3.5" />
                ) : (
                  <ChevronUp className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>

          {!isConvoyPodMinimized && (
            <>
              <div className="text-xs font-sans text-slate-200 space-y-1.5 bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400 font-mono">Corridor:</span>
                  <span className="font-bold text-white truncate max-w-[170px]">
                    {activeConvoyData.origin_hub_name || 'Origin'} ➔ {activeConvoyData.dest_hub_name || 'Destination'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400 font-mono">Driver ID:</span>
                  <span className="font-mono text-cyan-400 font-bold">
                    {activeConvoyData.driver_code || activeConvoyData.driverCode || 'DRV-NER'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400 font-mono">Telemetry:</span>
                  <span className="text-emerald-400 font-bold flex items-center gap-1 font-mono text-[10px]">
                    <Radio className="w-3 h-3 text-emerald-400 animate-pulse" /> LIVE BROADCAST
                  </span>
                </div>
              </div>

              {/* Convoy Actions: Delivered + Terminate */}
              <div className="grid grid-cols-2 gap-2 pt-0.5">
                <button
                  type="button"
                  onClick={onMarkDelivered}
                  disabled={markingDelivered || terminatingJourney}
                  className="py-2.5 px-3 min-h-[44px] bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-mono font-bold text-[11px] uppercase tracking-wider rounded-xl border border-emerald-400/40 shadow-md shadow-emerald-500/20 flex items-center justify-center space-x-1.5 transition-all cursor-pointer active:scale-98 disabled:opacity-50"
                  title="Mark Convoy Consignment Delivered"
                >
                  {markingDelivered ? (
                    <>
                      <div className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                      <span>Delivering...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span>Delivered</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={onTerminateTransit}
                  disabled={terminatingJourney || markingDelivered}
                  className="py-2.5 px-3 min-h-[44px] bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 hover:text-rose-200 border border-rose-500/50 rounded-xl text-[11px] font-mono font-bold uppercase transition-all flex items-center justify-center space-x-1.5 shadow-sm cursor-pointer active:scale-98 disabled:opacity-50"
                  title="Terminate & Purge Active Transit Record"
                >
                  {terminatingJourney ? (
                    <>
                      <div className="w-3.5 h-3.5 rounded-full border-2 border-rose-300 border-t-transparent animate-spin" />
                      <span>Terminating...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4 shrink-0" />
                      <span>Terminate</span>
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* 5. START TRANSIT JOURNEY BUTTON (When no transit is active) */}
      {!isTransitActive && (
        <button
          type="button"
          onClick={onStartTransit}
          disabled={!originHubId || !destHubId || routes.length === 0}
          className="w-full min-h-[48px] py-3 px-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-md shadow-emerald-500/20 flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-98 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Truck className="w-4 h-4" />
          <span>🚀 START TRANSIT JOURNEY</span>
        </button>
      )}

      {/* 6. CANDIDATE CORRIDORS LIST (Interactive Preview Cards) */}
      {routes && routes.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <div className="flex justify-between items-center text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">
            <span>Candidate Corridors ({routes.length})</span>
            <span className="text-blue-600 dark:text-cyan-400 text-[9px] font-normal">Click to switch</span>
          </div>

          {/* Dynamic Detour Auto-Promotion Alert Banner */}
          {(() => {
            const recommendedDetourIdx = routes.findIndex((r) => r.isRecommendedDetour);
            if (recommendedDetourIdx >= 0 && activeRouteIndex !== recommendedDetourIdx) {
              const detourRoute = routes[recommendedDetourIdx];
              return (
                <div className="p-2.5 rounded-2xl bg-amber-500/10 dark:bg-amber-950/40 border border-amber-500/40 text-amber-800 dark:text-amber-200 text-xs font-sans space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-200 shadow-xs">
                  <div className="flex items-center justify-between font-bold">
                    <span className="flex items-center gap-1.5 text-amber-700 dark:text-amber-300 font-mono uppercase text-[10px]">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 animate-bounce" />
                      <span>RECOMMENDED DETOUR ACTIVE</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => onSelectRouteIndex && onSelectRouteIndex(recommendedDetourIdx)}
                      className="px-2 py-0.5 bg-amber-600 hover:bg-amber-500 text-white font-mono font-bold text-[9px] uppercase rounded-lg shadow-xs cursor-pointer transition-all"
                    >
                      SWITCH DETOUR
                    </button>
                  </div>
                  <p className="text-[10px] text-amber-900 dark:text-amber-200 leading-tight">
                    {detourRoute.detourPromotionReason || 'Primary highway corridor is compromised. Switch to this safe alternative bypass.'}
                  </p>
                </div>
              );
            }
            return null;
          })()}

          <div className="space-y-2">
            {routes.map((route, idx) => {
              const isSelected = idx === activeRouteIndex;
              const tag = route.tag || route.primaryTag || 'ALTERNATIVE';
              const isShortest = tag.includes('SHORTEST');
              const hazardCount = route.hazardCount ?? (route.flaggedHazards?.length || 0);
              const hasThreat = hazardCount > 0 || (route.sciScore && route.sciScore >= 40);
              const sci = route.sciScore ?? (hasThreat ? 65 : 12);
              const weather = route.weather;

              return (
                <div
                  key={route.id || `route-card-${idx}`}
                  onClick={() => onSelectRouteIndex && onSelectRouteIndex(idx)}
                  className={`p-2.5 rounded-2xl border cursor-pointer transition-all ${
                    isSelected
                      ? hasThreat
                        ? 'bg-rose-50/60 dark:bg-rose-950/40 border-rose-500 dark:border-rose-400 shadow-md shadow-rose-500/10 ring-1 ring-rose-400 dark:ring-rose-400'
                        : 'bg-blue-50/80 dark:bg-cyan-950/40 border-blue-500 dark:border-cyan-400 shadow-md shadow-blue-500/10 ring-1 ring-blue-400 dark:ring-cyan-400'
                      : hasThreat
                        ? 'bg-rose-50/20 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/60 text-slate-600 dark:text-slate-400 hover:border-rose-300 dark:hover:border-rose-700'
                        : 'bg-slate-50/60 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <div className="flex items-center gap-1.5 truncate">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${
                        isSelected 
                          ? (hasThreat ? 'bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.8)]' : 'bg-[#1a73e8] shadow-[0_0_6px_rgba(26,115,232,0.8)]') 
                          : 'bg-slate-400 dark:bg-slate-600'
                      }`} />
                      <span className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                        {route.summary || `Corridor ${idx + 1}`}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {route.isOfflineCached && (
                        <span className="px-1 py-0.2 rounded text-[7px] font-mono font-bold uppercase bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border border-cyan-500/30">
                          OFFLINE
                        </span>
                      )}
                      <span className={`px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase tracking-wider shrink-0 ${
                        route.isRecommendedDetour
                          ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/50 animate-pulse'
                          : hasThreat
                            ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/40'
                            : isShortest 
                              ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/40' 
                              : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                      }`}>
                        [{tag}]
                      </span>
                    </div>
                  </div>

                  {/* Weather Snapshot Bar */}
                  {weather && (
                    <div className="flex items-center justify-between text-[9px] text-slate-600 dark:text-slate-400 py-0.5 px-1 rounded bg-slate-100/70 dark:bg-slate-900/70 mb-1 font-sans">
                      <span className="flex items-center gap-1 truncate">
                        <span>{weather.weatherEmoji || '⛅'}</span>
                        <span className="truncate">{weather.dominantWeather || 'Moderate Weather'}</span>
                        {weather.maxRainfallMm > 0 && (
                          <span className="font-bold text-blue-600 dark:text-cyan-400">
                            ({weather.maxRainfallMm} mm/h)
                          </span>
                        )}
                      </span>
                      <span className="font-mono text-slate-500 dark:text-slate-400 shrink-0">
                        {weather.avgTemperature}°C
                      </span>
                    </div>
                  )}

                  <div className="flex justify-between items-center text-[10px] text-slate-500 dark:text-slate-400 mt-1 pt-1 border-t border-slate-200/50 dark:border-slate-800/60">
                    <div className="flex items-center gap-2 font-mono">
                      <span><b className="text-slate-800 dark:text-slate-200">{route.distanceKm} km</b></span>
                      <span>•</span>
                      <span className="flex items-center gap-1 text-slate-700 dark:text-slate-300 font-bold">
                        <Clock className="w-3 h-3 text-slate-400" />
                        {route.durationText || `${route.durationMin || 1} min`}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 font-mono">
                      <span className={`px-1 py-0.2 rounded text-[8px] font-extrabold uppercase border ${
                        sci < 25 
                          ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30' 
                          : sci < 50 
                            ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30' 
                            : 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30'
                      }`}>
                        SCI: {sci}
                      </span>
                      <span>
                        <b className={hazardCount === 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
                          {hazardCount === 0 ? '🟢 Clear' : `⚠️ ${hazardCount}`}
                        </b>
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
}
