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
  Zap,
  Target,
  WifiOff,
  Info
} from 'lucide-react';

import SearchableHubSelect from '@/components/SearchableHubSelect';

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
  onDismissJourneyNotice,
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
    <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-4 font-sans text-xs text-slate-800 dark:text-slate-100 flex flex-col gap-3.5 max-h-none lg:max-h-[calc(100vh-180px)] overflow-y-auto pr-1 shadow-sm custom-scrollbar">
      
      {/* 1. SECTION HEADER */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center space-x-2">
          <div className="w-6 h-6 rounded-lg bg-blue-50 dark:bg-blue-950/60 flex items-center justify-center text-[#0284c7] dark:text-cyan-400">
            <Navigation className="w-3.5 h-3.5" />
          </div>
          <span className="text-xs font-bold text-slate-900 dark:text-white">
            Route Navigator
          </span>
        </div>
        <span className="text-[10px] font-bold text-[#0284c7] dark:text-cyan-400 bg-blue-50 dark:bg-blue-950/80 px-2 py-0.5 rounded-md border border-blue-100 dark:border-blue-900">
          Plan & Execute
        </span>
      </div>

      {/* 2. ORIGIN & DESTINATION DROPDOWNS (WITH SEARCH) */}
      <div className="space-y-3">
        {/* Origin Selector */}
        <div>
          <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center justify-between">
            <span className="flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>Origin Supply Hub</span>
            </span>
            {isGpsActive && (
              <span className="text-[10px] text-[#0284c7] dark:text-cyan-400 font-bold flex items-center space-x-1">
                <LocateFixed className="w-3 h-3" />
                <span>GPS Active</span>
              </span>
            )}
          </label>
          <SearchableHubSelect
            hubs={hubs}
            value={originHubId}
            onChange={(val) => onSelectOrigin && onSelectOrigin(val)}
            placeholder="Search Origin Hub (50 Facilities)..."
            allowCurrentLocation={true}
            disabledValue={destHubId}
            disabledTooltip="Selected as Dest"
            accentColor="emerald"
            id="origin-hub-search-select"
          />
        </div>

        {/* Destination Selector */}
        <div>
          <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center space-x-1.5">
            <span className="w-2 h-2 rounded-full bg-rose-500" />
            <span>Destination Supply Hub</span>
          </label>
          <SearchableHubSelect
            hubs={hubs}
            value={destHubId}
            onChange={(val) => onSelectDestination && onSelectDestination(val)}
            placeholder="Search Destination Hub (50 Facilities)..."
            allowCurrentLocation={false}
            disabledValue={originHubId}
            disabledTooltip="Selected as Origin"
            accentColor="rose"
            id="dest-hub-search-select"
          />
        </div>
      </div>

      {/* Inline Routing Error or Offline Notice Alert */}
      {routingError && (
        <div className={`p-3 rounded-xl border text-xs font-sans space-y-1 ${
          routingError.toLowerCase().includes('offline')
            ? 'bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800/80 text-amber-800 dark:text-amber-300'
            : 'bg-rose-50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300'
        }`}>
          <div className="flex items-start space-x-2">
            {routingError.toLowerCase().includes('offline') ? (
              <WifiOff className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500 mt-0.5" />
            )}
            <div className="space-y-0.5 min-w-0">
              <span className="font-bold block">
                {routingError.toLowerCase().includes('offline') ? 'Offline Routing Notice' : 'Routing Alert'}
              </span>
              <p className="text-[11px] leading-relaxed opacity-95">
                {routingError.replace(/^Offline Notice:\s*/i, '')}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Journey Status Notice Alert if any (shown only on active/terminated convoy events) */}
      {journeyNotice && (
        <div className={`p-2.5 rounded-xl text-xs font-sans font-medium flex items-center justify-between gap-2 shadow-xs ${
          journeyNotice.type === 'success'
            ? 'bg-emerald-50 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
            : 'bg-blue-50 text-blue-800 dark:text-cyan-300 border border-blue-200 dark:border-blue-800'
        }`}>
          <div className="flex items-center space-x-1.5 min-w-0">
            <Radio className="w-3.5 h-3.5 animate-pulse shrink-0 text-[#0284c7] dark:text-cyan-400" />
            <span className="truncate">{journeyNotice.message}</span>
          </div>
          {onDismissJourneyNotice && (
            <button
              type="button"
              onClick={onDismissJourneyNotice}
              className="px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-md transition-all shrink-0 cursor-pointer shadow-xs active:scale-95"
            >
              OK
            </button>
          )}
        </div>
      )}

      {/* 3. PRIMARY ROUTE FINDING ACTIONS */}
      <div className="flex items-center space-x-2 pt-0.5">
        <button
          type="button"
          onClick={onCalculateRoutes}
          disabled={calculatingRoute || !originHubId || !destHubId}
          className="flex-1 min-h-[44px] bg-[#0284c7] hover:bg-[#0369a1] text-white font-bold text-xs uppercase tracking-wider py-2.5 px-3 rounded-xl shadow-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {calculatingRoute ? (
            <>
              <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
              <span>Routing...</span>
            </>
          ) : (
            <>
              <Target className="w-4 h-4" />
              <span>FIND BEST ROUTE</span>
            </>
          )}
        </button>

        <button
          type="button"
          onClick={onResetRoutes}
          title="Reset Selection & Clear Route Geometry"
          className="px-3.5 py-2.5 min-h-[44px] rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200/90 dark:border-slate-700 flex items-center justify-center space-x-1 text-xs font-bold transition-all cursor-pointer shadow-xs shrink-0"
        >
          <RotateCcw className="w-4 h-4" />
          <span className="text-[11px]">RESET</span>
        </button>
      </div>

      {/* 4. ACTIVE CONVOY TELEMETRY POD */}
      {isTransitActive && activeConvoyData && (
        <div className="bg-emerald-950/90 border border-emerald-500/40 rounded-2xl p-3 shadow-sm space-y-2 text-white animate-in fade-in duration-200">
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
                onClick={() => setIsConvoyPodMinimized(!isConvoyPodMinimized)}
                className="p-0.5 text-slate-400 hover:text-white rounded"
              >
                {isConvoyPodMinimized ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {!isConvoyPodMinimized && (
            <div className="space-y-2 pt-1 border-t border-emerald-900/80">
              <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
                <div>
                  <span className="text-slate-400 block text-[9px]">ORIGIN:</span>
                  <span className="font-bold text-white truncate block">{activeConvoyData.origin_hub_name || activeConvoyData.origin || 'Assam Depot'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[9px]">DESTINATION:</span>
                  <span className="font-bold text-white truncate block">{activeConvoyData.dest_hub_name || activeConvoyData.destination || activeConvoyData.destination_hub_name || 'Regional Supply Depot'}</span>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={onMarkDelivered}
                  disabled={markingDelivered}
                  className="flex-1 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-[10px] rounded-lg flex items-center justify-center gap-1 cursor-pointer transition-all"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Mark Delivered</span>
                </button>
                <button
                  type="button"
                  onClick={onTerminateTransit}
                  disabled={terminatingJourney}
                  className="py-2 px-2.5 bg-rose-950/80 hover:bg-rose-900 border border-rose-700 text-rose-300 font-bold text-[10px] rounded-lg flex items-center justify-center cursor-pointer"
                  title="Terminate Transit"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 5. MULTI-ROUTE CANDIDATE LIST */}
      {routes.length > 0 && (
        <div className="space-y-2 pt-1 border-t border-slate-100 dark:border-slate-800">
          <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
            Candidate Corridors ({routes.length} Available):
          </span>
          <div className="space-y-1.5">
            {routes.map((route, idx) => {
              const isSelected = activeRouteIndex === idx;
              const sci = route.sciScore ?? 10;
              const hasHazards = (route.flaggedHazards?.length || 0) > 0;

              return (
                <div
                  key={`corridor-${idx}`}
                  onClick={() => onSelectRouteIndex && onSelectRouteIndex(idx)}
                  className={`p-2.5 rounded-xl border text-xs transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-blue-50 dark:bg-blue-950/40 border-[#0284c7] shadow-xs'
                      : 'bg-slate-50/70 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between font-bold">
                    <span className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${isSelected ? 'bg-[#0284c7]' : 'bg-slate-400'}`} />
                      <span className={isSelected ? 'text-[#0284c7] dark:text-cyan-400' : 'text-slate-800 dark:text-slate-200'}>
                        {route.routeLabel || `Corridor ${idx + 1}`}
                      </span>
                    </span>
                    <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold ${
                      sci < 25 ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' :
                      sci < 50 ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300' :
                      'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                    }`}>
                      SCI: {sci}/100
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                    <span>{route.distanceKm} km • {route.durationText}</span>
                    <span>{hasHazards ? `⚠️ ${route.flaggedHazards.length} alerts` : '✅ Clear'}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Start Transit Dispatch CTA */}
          {!isTransitActive && onStartTransit && (
            <button
              type="button"
              onClick={onStartTransit}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all mt-1"
            >
              <Truck className="w-4 h-4" />
              <span>DISPATCH CONVOY</span>
            </button>
          )}
        </div>
      )}

    </div>
  );
}
