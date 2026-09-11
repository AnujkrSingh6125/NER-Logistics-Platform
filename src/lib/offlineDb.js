import Dexie from 'dexie';

// Initialize Tactical Offline Dexie Database
export const db = new Dexie('NERLogisticsDB');

db.version(1).stores({
  supply_hubs: 'id, hub_code, state, district, hub_type, capacity_metric_tons',
  road_hazards: 'id, hazard_type, severity, status, state, created_at',
  shipments: 'id, tracking_code, status, priority, destination_state, updated_at',
});

db.version(2).stores({
  supply_hubs: 'id, hub_code, state, district, hub_type, capacity_metric_tons',
  road_hazards: 'id, hazard_type, severity, status, state, created_at',
  shipments: 'id, tracking_code, status, priority, destination_state, updated_at',
  cached_routes: 'id, origin_id, dest_id, route_key, cached_at',
  offline_hazard_queue: '++id, hazard_type, severity, status, state, created_at, synced',
});

db.version(3).stores({
  supply_hubs: 'id, hub_code, state, district, hub_type, capacity_metric_tons',
  road_hazards: 'id, hazard_type, severity, status, state, created_at',
  shipments: 'id, tracking_code, status, priority, destination_state, updated_at',
  cached_routes: 'id, origin_id, dest_id, route_key, cached_at',
  offline_hazard_queue: '++id, hazard_type, severity, status, state, created_at, synced',
  offline_shipment_queue: '++id, tracking_code, status, created_at, synced',
});

/**
 * Cache Supply Hubs into Dexie IndexedDB
 * @param {Array} hubsArray
 */
export async function saveHubsOffline(hubsArray) {
  if (!hubsArray || !hubsArray.length) return;
  try {
    await db.supply_hubs.bulkPut(hubsArray);
  } catch (err) {
    console.error('Dexie: Failed to bulkPut supply hubs:', err);
  }
}

/**
 * Retrieve cached Supply Hubs from Dexie IndexedDB
 * @returns {Promise<Array>}
 */
export async function getHubsOffline() {
  try {
    return await db.supply_hubs.toArray();
  } catch (err) {
    console.error('Dexie: Failed to load cached supply hubs:', err);
    return [];
  }
}

/**
 * Count cached Supply Hubs
 * @returns {Promise<number>}
 */
export async function getHubsCountOffline() {
  try {
    return await db.supply_hubs.count();
  } catch (err) {
    return 0;
  }
}

/**
 * Helper to generate consistent route cache key
 */
export function makeRouteKey(originLat, originLng, destLat, destLng) {
  const oLat = parseFloat(originLat).toFixed(3);
  const oLng = parseFloat(originLng).toFixed(3);
  const dLat = parseFloat(destLat).toFixed(3);
  const dLng = parseFloat(destLng).toFixed(3);
  return `${oLat},${oLng}->${dLat},${dLng}`;
}

/**
 * Cache Calculated Routes in Dexie for offline mountain corridors
 * @param {Object} params - { originLat, originLng, destLat, destLng, originId, destId, routesData }
 */
export async function cacheRouteOffline({ originLat, originLng, destLat, destLng, originId = null, destId = null, routesData }) {
  if (!routesData) return;
  try {
    const route_key = makeRouteKey(originLat, originLng, destLat, destLng);
    await db.cached_routes.put({
      id: route_key,
      route_key,
      origin_id: originId,
      dest_id: destId,
      origin_lat: originLat,
      origin_lng: originLng,
      dest_lat: destLat,
      dest_lng: destLng,
      routes_data: routesData,
      cached_at: new Date().toISOString(),
    });
  } catch (err) {
    console.warn('Dexie: Failed to cache route offline:', err);
  }
}

/**
 * Retrieve Cached Route when offline or network fails
 * @param {number} originLat 
 * @param {number} originLng 
 * @param {number} destLat 
 * @param {number} destLng 
 * @returns {Promise<Object|null>}
 */
export async function getOfflineCachedRoute(originLat, originLng, destLat, destLng) {
  try {
    const route_key = makeRouteKey(originLat, originLng, destLat, destLng);
    const cached = await db.cached_routes.get(route_key);
    if (cached && cached.routes_data) {
      return {
        ...cached.routes_data,
        isOfflineCached: true,
        cachedAt: cached.cached_at,
      };
    }
    return null;
  } catch (err) {
    console.warn('Dexie: Failed to retrieve offline route:', err);
    return null;
  }
}

/**
 * Save active shipment / convoy manifest locally in Dexie IndexedDB
 * @param {Object} shipmentPayload 
 */
export async function saveShipmentOffline(shipmentPayload) {
  if (!shipmentPayload) return;
  try {
    const record = {
      ...shipmentPayload,
      id: shipmentPayload.id || `shp-offline-${Date.now()}`,
      updated_at: new Date().toISOString(),
    };
    await db.shipments.put(record);
    return record;
  } catch (err) {
    console.error('Dexie: Failed to save shipment offline:', err);
    return shipmentPayload;
  }
}

/**
 * Queue a convoy shipment dispatch locally when network is unavailable
 * @param {Object} shipmentPayload 
 * @returns {Promise<number>} Queue record ID
 */
export async function queueOfflineShipment(shipmentPayload) {
  try {
    const record = {
      ...shipmentPayload,
      created_at: shipmentPayload.created_at || new Date().toISOString(),
      synced: 0,
    };
    // Save to active shipments table as well
    await saveShipmentOffline(record);
    const queueId = await db.offline_shipment_queue.add(record);
    return queueId;
  } catch (err) {
    console.error('Dexie: Failed to queue offline shipment dispatch:', err);
    return null;
  }
}

/**
 * Retrieve all pending un-synced offline convoy dispatches
 * @returns {Promise<Array>}
 */
export async function getOfflinePendingShipments() {
  try {
    return await db.offline_shipment_queue.where('synced').equals(0).toArray();
  } catch (err) {
    console.error('Dexie: Failed to get pending offline shipments:', err);
    return [];
  }
}

/**
 * Mark an offline shipment as synced
 * @param {number} queueId 
 * @param {string} serverId 
 */
export async function markOfflineShipmentSynced(queueId, serverId = null) {
  try {
    await db.offline_shipment_queue.update(queueId, { 
      synced: 1, 
      synced_at: new Date().toISOString(),
      server_id: serverId 
    });
  } catch (err) {
    console.error(`Dexie: Failed to mark shipment ${queueId} as synced:`, err);
  }
}

/**
 * Queue a road hazard report locally when driver is in zero-connectivity zone
 * @param {Object} hazardPayload 
 * @returns {Promise<number>} ID of queued record
 */
export async function queueOfflineReport(hazardPayload) {
  try {
    const record = {
      ...hazardPayload,
      created_at: hazardPayload.created_at || new Date().toISOString(),
      synced: 0,
    };
    const id = await db.offline_hazard_queue.add(record);
    return id;
  } catch (err) {
    console.error('Dexie: Failed to queue offline hazard report:', err);
    throw err;
  }
}

/**
 * Retrieve all pending un-synced offline hazard reports
 * @returns {Promise<Array>}
 */
export async function getOfflinePendingReports() {
  try {
    return await db.offline_hazard_queue.where('synced').equals(0).toArray();
  } catch (err) {
    console.error('Dexie: Failed to get pending offline reports:', err);
    return [];
  }
}

/**
 * Mark an offline hazard report as synced
 * @param {number} id 
 */
export async function markOfflineReportSynced(id) {
  try {
    await db.offline_hazard_queue.update(id, { synced: 1, synced_at: new Date().toISOString() });
  } catch (err) {
    console.error(`Dexie: Failed to mark report ${id} as synced:`, err);
  }
}

/**
 * Auto-sync all pending offline hazard reports to Supabase when network resumes
 * @param {Function} insertHazardFn - Async function to insert hazard into Supabase
 * @returns {Promise<{ syncedCount: number, errors: Array }>}
 */
export async function syncPendingReportsWhenOnline(insertHazardFn) {
  const pending = await getOfflinePendingReports();
  if (!pending.length) return { syncedCount: 0, errors: [] };

  let syncedCount = 0;
  const errors = [];

  for (const item of pending) {
    try {
      const { id, synced, ...payload } = item;
      await insertHazardFn(payload);
      await markOfflineReportSynced(id);
      syncedCount++;
    } catch (err) {
      errors.push({ id: item.id, error: err?.message || err });
    }
  }

  return { syncedCount, errors };
}

/**
 * Auto-sync all pending offline convoy dispatches to Supabase when network resumes
 * @param {Function} insertShipmentFn - Async function to insert shipment into Supabase
 * @returns {Promise<{ syncedCount: number, errors: Array }>}
 */
export async function syncPendingShipmentsWhenOnline(insertShipmentFn) {
  const pending = await getOfflinePendingShipments();
  if (!pending.length) return { syncedCount: 0, errors: [] };

  let syncedCount = 0;
  const errors = [];

  for (const item of pending) {
    try {
      const { id, synced, is_offline_dispatched, ...payload } = item;
      const res = await insertShipmentFn(payload);
      await markOfflineShipmentSynced(id, res?.id);
      syncedCount++;
    } catch (err) {
      errors.push({ id: item.id, error: err?.message || err });
    }
  }

  return { syncedCount, errors };
}

/**
 * Permanently delete hazard from Dexie IndexedDB offline caches
 * @param {string|number} hazardId
 */
export async function deleteHazardOffline(hazardId) {
  if (!hazardId) return;
  try {
    if (db.road_hazards) {
      await db.road_hazards.delete(hazardId).catch(() => {});
    }
    if (db.offline_hazard_queue) {
      await db.offline_hazard_queue.where('id').equals(hazardId).delete().catch(() => {});
    }
  } catch (err) {
    console.warn('Dexie: Failed to delete hazard offline:', err);
  }
}

/**
 * Permanently delete shipment / convoy from Dexie IndexedDB offline caches
 * @param {string|number} shipmentId
 * @param {string} trackingCode
 */
export async function deleteShipmentOffline(shipmentId, trackingCode) {
  try {
    if (db.shipments) {
      if (shipmentId) await db.shipments.delete(shipmentId).catch(() => {});
      if (trackingCode) await db.shipments.where('tracking_code').equals(trackingCode).delete().catch(() => {});
    }
    if (db.offline_shipment_queue) {
      if (shipmentId) await db.offline_shipment_queue.where('id').equals(shipmentId).delete().catch(() => {});
      if (trackingCode) await db.offline_shipment_queue.where('tracking_code').equals(trackingCode).delete().catch(() => {});
    }
  } catch (err) {
    console.warn('Dexie: Failed to delete shipment offline:', err);
  }
}
