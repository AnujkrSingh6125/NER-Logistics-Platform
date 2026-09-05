import Dexie from 'dexie';

// Initialize Tactical Offline Dexie Database
export const db = new Dexie('NERLogisticsDB');

db.version(1).stores({
  supply_hubs: 'id, hub_code, state, district, hub_type, capacity_metric_tons',
  road_hazards: 'id, hazard_type, severity, status, state, created_at',
  shipments: 'id, tracking_code, status, priority, destination_state, updated_at',
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
