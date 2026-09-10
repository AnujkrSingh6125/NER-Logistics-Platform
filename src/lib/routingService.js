/**
 * Tactical Routing & Geospatial Hazard Avoidance Engine for NER Logistics
 * Multi-route calculation with OSRM (Primary Highway & Alternative Mountain Bypasses)
 * Automated Geospatial Hazard Proximity Analysis, Risk Scoring, & Safest Route Recommendation
 */

/**
 * Haversine formula to compute great-circle distance between two points in kilometers
 */
export function getDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Format duration into human readable hours & minutes (incorporating mountain hill terrain factor)
 * NER mountainous roads typically reduce heavy vehicle transit speed by ~30%
 */
export function formatTransitDuration(seconds, distanceKm) {
  const adjustedSeconds = seconds * 1.3;
  const totalMinutes = Math.round(adjustedSeconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;

  if (hours === 0) {
    return `${mins} mins`;
  }
  return `${hours} hrs ${mins > 0 ? `${mins} mins` : ''}`;
}

/**
 * Minimum distance from a point to a line segment on a 2D plane (spherical approximation for short segments)
 */
function getDistanceToSegmentKm(pLat, pLon, aLat, aLon, bLat, bLon) {
  const dAB = getDistanceKm(aLat, aLon, bLat, bLon);
  if (dAB === 0) return getDistanceKm(pLat, pLon, aLat, aLon);

  // Vector projection parameter
  const t = Math.max(
    0,
    Math.min(
      1,
      ((pLat - aLat) * (bLat - aLat) + (pLon - aLon) * (bLon - aLon)) /
        ((bLat - aLat) ** 2 + (bLon - aLon) ** 2)
    )
  );

  const projLat = aLat + t * (bLat - aLat);
  const projLon = aLon + t * (bLon - aLon);
  return getDistanceKm(pLat, pLon, projLat, projLon);
}

/**
 * Detect road hazards along a route within a proximity buffer (threshold in km) and calculate risk
 */
export function analyzeRouteHazards(routeCoords, hazards, thresholdKm = 10) {
  if (!routeCoords || routeCoords.length === 0 || !hazards || hazards.length === 0) {
    return {
      flaggedHazards: [],
      riskScore: 0,
      safetyStatus: 'optimal', // 'optimal' | 'moderate' | 'high_risk'
      safetyLabel: 'Safest Corridor (0 Hazards)',
    };
  }

  const flaggedHazards = [];
  let totalRiskScore = 0;

  const SEVERITY_WEIGHTS = {
    critical: 100,
    high: 60,
    medium: 30,
    low: 10,
  };

  for (const hazard of hazards) {
    const hLat = parseFloat(hazard.latitude);
    const hLon = parseFloat(hazard.longitude);
    if (isNaN(hLat) || isNaN(hLon)) continue;

    let minDistance = Infinity;

    // Check distance against sampled segments of the route
    const step = Math.max(1, Math.floor(routeCoords.length / 80));
    for (let i = 0; i < routeCoords.length - step; i += step) {
      const [aLat, aLon] = routeCoords[i];
      const [bLat, bLon] = routeCoords[Math.min(i + step, routeCoords.length - 1)];
      const dist = getDistanceToSegmentKm(hLat, hLon, aLat, aLon, bLat, bLon);
      if (dist < minDistance) {
        minDistance = dist;
      }
    }

    if (minDistance <= thresholdKm) {
      const roundedDist = Math.round(minDistance * 10) / 10;
      const baseWeight = SEVERITY_WEIGHTS[hazard.severity] || 30;

      // Proximity penalty multiplier: closer than 2km = full penalty, 2-5km = 0.7x, 5-10km = 0.3x
      const proximityMultiplier =
        roundedDist <= 2 ? 1.0 : roundedDist <= 5 ? 0.7 : 0.35;

      const hazardRisk = Math.round(baseWeight * proximityMultiplier);
      totalRiskScore += hazardRisk;

      flaggedHazards.push({
        ...hazard,
        distanceFromRouteKm: roundedDist,
        hazardRisk,
      });
    }
  }

  // Sort hazards by closest proximity to route
  flaggedHazards.sort((a, b) => a.distanceFromRouteKm - b.distanceFromRouteKm);

  let safetyStatus = 'optimal';
  let safetyLabel = 'Safest Corridor (0 Roadblocks)';

  if (totalRiskScore > 70 || flaggedHazards.some((h) => h.severity === 'critical' && h.distanceFromRouteKm <= 3)) {
    safetyStatus = 'high_risk';
    safetyLabel = `High Risk (${flaggedHazards.length} Hazards Flagged)`;
  } else if (flaggedHazards.length > 0) {
    safetyStatus = 'moderate';
    safetyLabel = `Caution (${flaggedHazards.length} Hazards Nearby)`;
  }

  return {
    flaggedHazards,
    riskScore: totalRiskScore,
    safetyStatus,
    safetyLabel,
  };
}

/**
 * Generate geodesic / curved interpolated path for offline fallback or alternative route
 */
export function generateInterpolatedPath(startCoords, endCoords, deviationMultiplier = 0.08) {
  const [startLat, startLon] = startCoords;
  const [endLat, endLon] = endCoords;
  const straightDist = getDistanceKm(startLat, startLon, endLat, endLon);
  const steps = 25;
  const interpolated = [];

  for (let i = 0; i <= steps; i++) {
    const fraction = i / steps;
    const lat = startLat + (endLat - startLat) * fraction;
    const lon = startLon + (endLon - startLon) * fraction;
    const deviation = Math.sin(fraction * Math.PI) * deviationMultiplier;
    interpolated.push([lat + deviation * 0.35, lon + deviation]);
  }

  const estDistanceKm = Math.round(straightDist * 1.38 * 10) / 10;
  const estDurationSec = (estDistanceKm / 35) * 3600;

  return {
    coordinates: interpolated,
    distanceKm: estDistanceKm,
    durationText: formatTransitDuration(estDurationSec, estDistanceKm),
    durationSeconds: estDurationSec,
    isFallback: true,
  };
}

import { fetchMultiTacticalRoutes, rescoreRoutesWithHazards } from './routeAnalyzer.js';
import { cacheRouteOffline, getOfflineCachedRoute } from './offlineDb.js';

/**
 * Fetch Multi-Route Geometry from OSRM and perform Automated Hazard & Weather Proximity Scoring
 * Seamlessly falls back to Dexie IndexedDB offline cached route if network is unavailable
 * @param {[number, number]} startCoords - [lat, lng]
 * @param {[number, number]} endCoords - [lat, lng]
 * @param {Array<Object>} activeHazards - List of active road hazards
 */
export async function calculateSafestMultiRoutes(startCoords, endCoords, activeHazards = []) {
  const [sLat, sLng] = startCoords;
  const [eLat, eLng] = endCoords;

  try {
    const result = await fetchMultiTacticalRoutes(startCoords, endCoords, activeHazards);
    if (result && result.success && result.allRoutes && result.allRoutes.length > 0) {
      // Asynchronously cache successful route geometry into Dexie IndexedDB
      cacheRouteOffline({
        originLat: sLat,
        originLng: sLng,
        destLat: eLat,
        destLng: eLng,
        routesData: result,
      }).catch(() => {});

      return result;
    }
  } catch (e) {
    console.warn('Online tactical routing failed, checking Dexie offline cache:', e?.message || e);
  }

  // Check Dexie offline storage for previously cached corridor
  try {
    const cached = await getOfflineCachedRoute(sLat, sLng, eLat, eLng);
    if (cached && cached.allRoutes && cached.allRoutes.length > 0) {
      console.log('⚡ Using Dexie Offline Cached Route for corridor [', sLat, sLng, '->', eLat, eLng, ']');
      // Rescore cached corridors with any local hazards
      const rescored = rescoreRoutesWithHazards(cached.allRoutes, activeHazards);
      if (rescored && rescored.success) {
        return {
          ...rescored,
          isOfflineCached: true,
          cachedAt: cached.cachedAt,
        };
      }
      return {
        ...cached,
        isOfflineCached: true,
      };
    }
  } catch (dbErr) {
    console.warn('Dexie offline cache lookup error:', dbErr);
  }

  // If NOT in cache and offline (or online routing failed with no cache):
  // Strictly do NOT generate fake curves or synthetic estimation.
  return {
    success: false,
    isOfflineUncached: true,
    error: 'Offline Notice: Road corridor geometry is not cached on this device. Please connect to internet once to calculate & cache this route.',
    allRoutes: [],
    rankedRoutes: [],
    recommendedRoute: null,
  };
}

// Backward-compatible exports
export async function fetchMultiRouteGeometry(startCoords, endCoords, hazards = []) {
  return calculateSafestMultiRoutes(startCoords, endCoords, hazards);
}

export async function fetchRouteGeometry(startCoords, endCoords) {
  const multi = await calculateSafestMultiRoutes(startCoords, endCoords);
  if (multi.success && multi.recommendedRoute) {
    return {
      success: true,
      ...multi.recommendedRoute,
    };
  }
  return { success: false };
}

export function findHazardsAlongRoute(routeCoords, hazards, thresholdKm = 10) {
  const result = analyzeRouteHazards(routeCoords, hazards, thresholdKm);
  return result.flaggedHazards;
}

export { fetchRealRoadRoute } from '@/utils/routeEngine';
export { fetchMultiTacticalRoutes, rescoreRoutesWithHazards };



