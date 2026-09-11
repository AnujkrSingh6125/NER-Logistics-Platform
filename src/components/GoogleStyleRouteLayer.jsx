'use client';

import React from 'react';
import { Polyline, Marker, Tooltip } from 'react-leaflet';
import L from 'leaflet';

/**
 * Safe Corridor Index (SCI) Color Mapping Helper
 * - SCI < 25: Green (#10b981 / emerald) -> Safe / Optimal Corridor
 * - SCI 25 - 49: Orange / Amber (#f59e0b / #ea580c) -> Moderate Risk / Caution Corridor
 * - SCI >= 50: Red (#ef4444 / rose-red) -> High Risk / Hazard Alert Corridor
 */
export function getRouteColorBySci(sciScore) {
  const sci = sciScore !== undefined && sciScore !== null ? Number(sciScore) : 10;
  if (sci < 25) {
    return {
      activeColor: '#10b981',       // Emerald Green (Optimal Safe)
      inactiveColor: '#34d399',     // Soft Green
      activeBadgeBg: '#059669',     // Rich Emerald
      badgeStyle: 'bg-emerald-600 shadow-[0_4px_16px_rgba(16,185,129,0.5)] ring-emerald-400/50',
      badgeBorder: 'border-emerald-500',
      badgeText: 'text-emerald-700 dark:text-emerald-400',
      statusPill: 'bg-emerald-950 text-emerald-300 border-emerald-600',
      label: 'OPTIMAL SAFE',
      dotEmoji: '🟢',
    };
  } else if (sci < 50) {
    return {
      activeColor: '#f59e0b',       // Amber / Orange (Caution)
      inactiveColor: '#fbbf24',     // Soft Amber
      activeBadgeBg: '#d97706',     // Rich Amber
      badgeStyle: 'bg-amber-600 shadow-[0_4px_16px_rgba(245,158,11,0.5)] ring-amber-400/50',
      badgeBorder: 'border-amber-500',
      badgeText: 'text-amber-700 dark:text-amber-400',
      statusPill: 'bg-amber-950 text-amber-300 border-amber-600',
      label: 'CAUTION',
      dotEmoji: '🟠',
    };
  } else {
    return {
      activeColor: '#ef4444',       // Rose Red (High Risk)
      inactiveColor: '#f87171',     // Soft Red
      activeBadgeBg: '#dc2626',     // Rich Red
      badgeStyle: 'bg-red-600 shadow-[0_4px_16px_rgba(239,68,68,0.5)] ring-red-400/50',
      badgeBorder: 'border-red-500',
      badgeText: 'text-red-700 dark:text-red-400',
      statusPill: 'bg-rose-950 text-rose-300 border-rose-600',
      label: 'HIGH RISK',
      dotEmoji: '🔴',
    };
  }
}

/**
 * Helper: Generate Google Maps style floating ETA pill DivIcon with SCI Color Theme
 */
function createEtaDivIcon(route, isActive, index) {
  const durationText = route.durationText || `${route.durationMin || 1} min`;
  const sci = route.sciScore !== undefined && route.sciScore !== null ? Math.round(route.sciScore) : 10;
  const hazardCount = route.hazardScore ?? (route.flaggedHazards?.length || route.hazardCount || 0);
  const colorMeta = getRouteColorBySci(sci);

  const html = isActive
    ? `
      <div class="inline-flex items-center gap-1.5 px-3 py-1.5 text-white font-sans font-bold text-[12px] rounded-xl border-2 border-white cursor-pointer select-none whitespace-nowrap transform -translate-x-1/2 -translate-y-1/2 hover:scale-110 active:scale-95 transition-transform ring-2 ${colorMeta.badgeStyle}">
        <span class="tracking-tight">${durationText}</span>
        <span class="text-[9px] bg-black/30 text-white font-mono px-1.5 py-0.5 rounded-full font-extrabold tracking-wide">SCI ${sci}</span>
        ${hazardCount > 0 ? `<span class="text-[9px] bg-red-900 text-white font-mono px-1 py-0.5 rounded-full font-extrabold">⚠️${hazardCount}</span>` : `<span class="text-[11px] leading-none">🍃</span>`}
      </div>
    `
    : `
      <div class="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white text-slate-800 font-sans font-bold text-[11px] rounded-xl shadow-[0_3px_12px_rgba(0,0,0,0.22)] border-2 ${colorMeta.badgeBorder} hover:scale-110 hover:bg-slate-50 active:scale-95 transition-all">
        <span class="tracking-tight">${durationText}</span>
        <span class="text-[9px] ${colorMeta.badgeText} font-mono font-extrabold">SCI ${sci}</span>
        ${hazardCount > 0 ? `<span class="text-[9px] text-amber-600 font-bold">⚠️${hazardCount}</span>` : `<span class="text-[10px]">🍃</span>`}
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
 * GoogleStyleRouteLayer - Dynamic SCI-Colored Multi-Route Visualization & Interactive Switching Layer
 * 
 * Features:
 * - Red, Orange, Green color coding strictly mapped to Safe Corridor Index (SCI) score:
 *   • SCI < 25 -> Vibrant Green (#10b981) [Optimal Safe]
 *   • SCI 25–49 -> Vibrant Orange / Amber (#f59e0b) [Moderate / Caution]
 *   • SCI >= 50 -> Vibrant Red (#ef4444) [High Risk / Hazard Alert]
 * - Casing outline underlay for high contrast over any map style
 * - Floating clickable ETA & SCI badges anchored on unique route branches
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
        const sci = route.sciScore !== undefined && route.sciScore !== null ? Number(route.sciScore) : 10;
        const colorMeta = getRouteColorBySci(sci);
        const tag = route.tag || route.primaryTag || colorMeta.label;
        const hazardCount = route.hazardScore ?? (route.flaggedHazards?.length || route.hazardCount || 0);

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
                opacity: 0.65,
                lineCap: 'round',
                lineJoin: 'round',
                className: 'cursor-pointer',
              }}
            />

            {/* Continuous Inactive Polyline Colored by SCI Score */}
            <Polyline
              positions={route.coordinates}
              eventHandlers={{
                click: () => onSelectRoute && onSelectRoute(index),
              }}
              pathOptions={{
                color: colorMeta.inactiveColor,
                weight: 5.5,
                opacity: 0.85,
                lineCap: 'round',
                lineJoin: 'round',
                className: 'cursor-pointer hover:opacity-100 transition-opacity',
              }}
            >
              <Tooltip sticky>
                <div className="bg-slate-950 text-white font-mono text-[11px] p-2.5 rounded-xl border border-slate-700 shadow-2xl space-y-1.5 max-w-xs pointer-events-none">
                  <div className="flex items-center justify-between gap-2 pb-1 border-b border-slate-800">
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase tracking-wide border ${colorMeta.statusPill}`}>
                      [{tag} • SCI: {sci}/100]
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
                    <span className="text-cyan-400 font-bold ml-2 animate-pulse">
                      👉 Click to select
                    </span>
                  </div>
                </div>
              </Tooltip>
            </Polyline>

            {/* Floating Alternative ETA & SCI Badge Pill */}
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
            const sci = route.sciScore !== undefined && route.sciScore !== null ? Number(route.sciScore) : 10;
            const colorMeta = getRouteColorBySci(sci);
            const tag = route.tag || route.primaryTag || colorMeta.label;
            const hazardCount = route.hazardScore ?? (route.flaggedHazards?.length || route.hazardCount || 0);

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

                {/* Inner Bold Solid Primary Line Colored by Safe Corridor Index (SCI) */}
                <Polyline
                  positions={route.coordinates}
                  pathOptions={{
                    color: colorMeta.activeColor,
                    weight: 6.5,
                    opacity: 1.0,
                    lineCap: 'round',
                    lineJoin: 'round',
                    className: 'cursor-default',
                  }}
                >
                  <Tooltip sticky>
                    <div className="bg-slate-950 text-white font-mono text-[11px] p-2.5 rounded-xl border border-slate-700 shadow-2xl space-y-1.5 max-w-xs pointer-events-none">
                      <div className="flex items-center justify-between gap-2 pb-1 border-b border-slate-800">
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase tracking-wide border ${colorMeta.statusPill}`}>
                          [ACTIVE • {tag} • SCI: {sci}/100]
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
                        <span className="text-emerald-400 font-bold ml-2">
                          ✓ Active Corridor
                        </span>
                      </div>
                    </div>
                  </Tooltip>
                </Polyline>

                {/* Floating Active Solid SCI-Colored ETA Badge Pill */}
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