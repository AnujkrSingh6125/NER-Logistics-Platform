'use client';

import React from 'react';
import { Polyline, Marker, Tooltip } from 'react-leaflet';
import L from 'leaflet';

/**
 * Helper: Generate Google Maps style floating ETA pill DivIcon
 */
function createEtaDivIcon(route, isActive, index) {
  const durationText = route.durationText || `${route.durationMin || 1} min`;
  const hazardCount = route.hazardScore ?? (route.flaggedHazards?.length || route.hazardCount || 0);
  const isEco = route.primaryTag?.includes('SAFEST') || route.tag?.includes('SAFEST') || route.isRecommendedSafest || hazardCount === 0;

  const html = isActive
    ? `
      <div class="inline-flex items-center gap-1.5 px-3 py-1 bg-[#1a73e8] text-white font-sans font-bold text-[12px] rounded-xl shadow-[0_4px_16px_rgba(26,115,232,0.55)] border-2 border-white cursor-pointer select-none whitespace-nowrap transform -translate-x-1/2 -translate-y-1/2 hover:scale-110 active:scale-95 transition-transform ring-2 ring-blue-400/40">
        <span class="tracking-tight">${durationText}</span>
        ${isEco ? `<span class="text-[12px] leading-none">🍃</span>` : hazardCount > 0 ? `<span class="text-[9px] bg-red-600 text-white font-mono px-1 py-0.5 rounded-full font-extrabold">⚠️${hazardCount}</span>` : ''}
      </div>
    `
    : `
      <div class="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white text-slate-800 font-sans font-bold text-[11px] rounded-xl shadow-[0_3px_10px_rgba(0,0,0,0.25)] border border-slate-300 hover:border-blue-500 cursor-pointer select-none whitespace-nowrap transform -translate-x-1/2 -translate-y-1/2 hover:scale-110 hover:bg-slate-50 active:scale-95 transition-all">
        <span class="tracking-tight">${durationText}</span>
        ${hazardCount > 0 ? `<span class="text-[9px] text-amber-600 font-bold">⚠️${hazardCount}</span>` : `<span class="text-[11px] leading-none opacity-80">🍃</span>`}
      </div>
    `;

  return L.divIcon({
    className: 'custom-google-eta-pill-marker',
    html,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
}

/**
 * GoogleStyleRouteLayer - 1:1 Google Maps Multi-Route Visualization & Interactive Switching Layer
 * 
 * Features:
 * - Active selected route: Solid Google Royal Blue (#1a73e8, weight: 6) with white underlay casing (#ffffff, weight: 9)
 * - Inactive alternative routes: Google Slate-Gray (#9aa0a6, weight: 5, opacity: 0.75) with subtle casing (#ffffff, weight: 7, opacity: 0.6)
 * - Floating clickable ETA pill badges anchored on each route's unique deviation branch
 * - Effortless click-to-switch interaction via polylines, hit-boxes, and floating ETA badges
 */
export default function GoogleStyleRouteLayer({
  routes = [],
  activeRouteIndex = 0,
  onSelectRoute = null,
}) {
  if (!routes || routes.length === 0) return null;

  // Separate inactive routes from active route to ensure active route is on TOP of the SVG stack
  const inactiveRoutesWithIndex = routes
    .map((route, index) => ({ route, index }))
    .filter(({ index }) => index !== activeRouteIndex);

  const activeRouteItem = routes[activeRouteIndex]
    ? { route: routes[activeRouteIndex], index: activeRouteIndex }
    : null;

  return (
    <>
      {/* ========================================================================= */}
      {/* 1. LAYER INACTIVE ALTERNATIVE ROUTES FIRST (Bottom of SVG Stack)          */}
      {/* ========================================================================= */}
      {inactiveRoutesWithIndex.map(({ route, index }) => {
        const tag = route.tag || route.primaryTag || (route.isRecommendedSafest ? 'SAFEST' : 'ALTERNATIVE');
        const isHighRisk = route.safetyStatus === 'high_risk';
        const hazardCount = route.hazardScore ?? (route.flaggedHazards?.length || route.hazardCount || 0);

        // Neutral Google Slate-Gray for inactive alternatives (or soft red if dangerous)
        const polyColor = isHighRisk ? '#f87171' : '#9aa0a6';

        const anchorPos = route.anchorPoint || route.midpoint;
        const hasAnchor = anchorPos && 
          Array.isArray(anchorPos) && 
          anchorPos.length === 2 && 
          !isNaN(anchorPos[0]) && 
          !isNaN(anchorPos[1]);

        return (
          <React.Fragment key={route.id || `inactive-route-${index}`}>
            {/* Wide transparent hit-box for effortless click detection */}
            <Polyline
              positions={route.coordinates}
              eventHandlers={{
                click: () => onSelectRoute && onSelectRoute(index),
              }}
              pathOptions={{
                color: 'transparent',
                weight: 24,
                opacity: 0,
                className: 'cursor-pointer',
              }}
            />

            {/* Subtle White Casing Outline Underlay */}
            <Polyline
              positions={route.coordinates}
              eventHandlers={{
                click: () => onSelectRoute && onSelectRoute(index),
              }}
              pathOptions={{
                color: '#ffffff',
                weight: 7,
                opacity: 0.6,
                lineCap: 'round',
                lineJoin: 'round',
                className: 'cursor-pointer',
              }}
            />

            {/* Continuous Full Inactive Polyline */}
            <Polyline
              positions={route.coordinates}
              eventHandlers={{
                click: () => onSelectRoute && onSelectRoute(index),
              }}
              pathOptions={{
                color: polyColor,
                weight: 5,
                opacity: 0.75,
                lineCap: 'round',
                lineJoin: 'round',
                className: 'cursor-pointer hover:opacity-100 transition-opacity',
              }}
            >
              <Tooltip sticky>
                <div className="bg-slate-950 text-white font-mono text-[11px] p-2.5 rounded-xl border border-slate-700 shadow-2xl space-y-1.5 max-w-xs pointer-events-none">
                  <div className="flex items-center justify-between gap-2 pb-1 border-b border-slate-800">
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase tracking-wide border bg-slate-900 text-slate-300 border-slate-700">
                      [{tag}]
                    </span>
                    <span className="text-[10px] text-slate-400 font-bold truncate max-w-[140px]">
                      {route.summary || route.corridorName || `Route ${index + 1}`}
                    </span>
                  </div>

                  <div className="text-slate-200 text-xs font-bold flex items-center justify-between">
                    <span>{route.distanceKm} km</span>
                    <span className="text-slate-500">•</span>
                    <span>{route.durationText}</span>
                  </div>

                  <div className="text-[10px] flex items-center justify-between border-t border-slate-800/80 pt-1 text-slate-400">
                    <span>
                      {hazardCount === 0 ? '🟢 0 Hazards' : `⚠️ ${hazardCount} Hazard(s)`}
                    </span>
                    <span className="text-blue-400 font-bold ml-2 animate-pulse">
                      👉 Click to select
                    </span>
                  </div>
                </div>
              </Tooltip>
            </Polyline>

            {/* Floating Google Maps Alternative ETA Badge Pill */}
            {hasAnchor && (
              <Marker
                position={anchorPos}
                icon={createEtaDivIcon(route, false, index)}
                eventHandlers={{
                  click: () => onSelectRoute && onSelectRoute(index),
                }}
              />
            )}
          </React.Fragment>
        );
      })}

      {/* ========================================================================= */}
      {/* 2. LAYER ACTIVE SELECTED ROUTE LAST (Top of SVG Stack)                    */}
      {/* ========================================================================= */}
      {activeRouteItem && (
        <React.Fragment key={activeRouteItem.route.id || `active-route-${activeRouteItem.index}`}>
          {(() => {
            const { route, index } = activeRouteItem;
            const tag = route.tag || route.primaryTag || (route.isRecommendedSafest ? 'SAFEST' : 'RECOMMENDED');
            const hazardCount = route.hazardScore ?? (route.flaggedHazards?.length || route.hazardCount || 0);

            // High-Contrast Google Royal Blue (or alert red if high risk)
            const coreColor = route.safetyStatus === 'high_risk' ? '#ef4444' : '#1a73e8';

            const anchorPos = route.anchorPoint || route.midpoint;
            const hasAnchor = anchorPos && 
              Array.isArray(anchorPos) && 
              anchorPos.length === 2 && 
              !isNaN(anchorPos[0]) && 
              !isNaN(anchorPos[1]);

            return (
              <>
                {/* Clean White Casing Outline Underlay */}
                <Polyline
                  positions={route.coordinates}
                  pathOptions={{
                    color: '#ffffff',
                    weight: 9,
                    opacity: 0.95,
                    lineCap: 'round',
                    lineJoin: 'round',
                  }}
                />

                {/* Inner Bold High-Contrast Solid Primary Google Blue Line */}
                <Polyline
                  positions={route.coordinates}
                  pathOptions={{
                    color: coreColor,
                    weight: 6,
                    opacity: 1.0,
                    lineCap: 'round',
                    lineJoin: 'round',
                    className: 'cursor-default',
                  }}
                >
                  <Tooltip sticky>
                    <div className="bg-slate-950 text-white font-mono text-[11px] p-2.5 rounded-xl border border-slate-700 shadow-2xl space-y-1.5 max-w-xs pointer-events-none">
                      <div className="flex items-center justify-between gap-2 pb-1 border-b border-slate-800">
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase tracking-wide border ${
                          tag === 'SHORTEST & SAFEST'
                            ? 'bg-blue-950 text-blue-300 border-blue-600'
                            : tag === 'SHORTEST'
                            ? 'bg-cyan-950 text-cyan-300 border-cyan-600'
                            : tag === 'SAFEST'
                            ? 'bg-emerald-950 text-emerald-300 border-emerald-600'
                            : 'bg-blue-950 text-blue-300 border-blue-600'
                        }`}>
                          [ACTIVE • {tag}]
                        </span>
                        <span className="text-[10px] text-slate-400 font-bold truncate max-w-[130px]">
                          {route.summary || route.corridorName || `Route ${index + 1}`}
                        </span>
                      </div>

                      <div className="text-slate-100 text-xs font-bold flex items-center justify-between">
                        <span className="text-white">{route.distanceKm} km</span>
                        <span className="text-slate-500">•</span>
                        <span className="text-white">{route.durationText}</span>
                      </div>

                      <div className="text-[10px] flex items-center justify-between border-t border-slate-800/80 pt-1">
                        <span className={hazardCount === 0 ? 'text-emerald-400' : 'text-amber-400'}>
                          {hazardCount === 0 ? '🟢 0 Hazards' : `⚠️ ${hazardCount} Hazard(s)`}
                        </span>
                        <span className="text-blue-400 font-bold ml-2">
                          ✓ Active Corridor
                        </span>
                      </div>
                    </div>
                  </Tooltip>
                </Polyline>

                {/* Floating Google Maps Active Solid Blue ETA Badge Pill */}
                {hasAnchor && (
                  <Marker
                    position={anchorPos}
                    icon={createEtaDivIcon(route, true, index)}
                    eventHandlers={{
                      click: () => onSelectRoute && onSelectRoute(index),
                    }}
                  />
                )}
              </>
            );
          })()}
        </React.Fragment>
      )}
    </>
  );
}