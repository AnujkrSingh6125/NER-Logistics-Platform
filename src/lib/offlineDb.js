import Dexie from 'dexie';
import { supabase } from '@/lib/supabaseClient';

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
 * Auto-sync pending offline hazard reports with Gemini AI Verification
 * Runs text & image forensics on each queued report when internet connection is regained.
 * If AI passes: Uploads media to Supabase storage and imports into public.road_hazards.
 * If AI fails: Rejects report in offline queue and emits rejection bulletin notice.
 * @param {Function} onResult - Callback with { status: 'verified_and_synced' | 'rejected', item }
 * @returns {Promise<{ syncedCount: number, rejectedCount: number, results: Array }>}
 */
export async function syncOfflineHazardsWithAiVerification(onResult = null) {
  const pending = await getOfflinePendingReports();
  if (!pending.length) return { syncedCount: 0, rejectedCount: 0, results: [] };

  let syncedCount = 0;
  let rejectedCount = 0;
  const results = [];

  for (const item of pending) {
    try {
      // 1. Run Gemini AI Verification on the queued report
      let verifyData = null;
      try {
        const verifyRes = await fetch('/api/ai/verify-hazard', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mediaBase64List: item.mediaBase64List || [],
            declaredHazardType: item.hazard_type,
            declaredSeverity: item.severity,
            description: item.notes || item.description || '',
            state: item.state || 'Assam',
            district: item.district || '',
          }),
        });

        if (verifyRes.ok) {
          verifyData = await verifyRes.json();
        }
      } catch (aiErr) {
        console.warn('Network error during offline sync AI check:', aiErr);
        continue; // Keep in queue for next sync cycle
      }

      if (!verifyData || !verifyData.success) {
        // AI service unreachable or temporary error; keep in queue to retry later
        continue;
      }

      // 2. Check AI verification result
      const isPassed = verifyData.verified && 
                       verifyData.analysis?.is_real_hazard && 
                       verifyData.analysis?.is_description_valid;

      if (!isPassed) {
        // AI REJECTED: Mark as rejected in queue
        const rejectionReason = verifyData.analysis?.rejection_reason || 
          verifyData.analysis?.verdict_summary || 
          'Media evidence or description context did not pass authenticity verification.';

        await db.offline_hazard_queue.update(item.id, {
          synced: 2, // 2 = Rejected by AI
          sync_status: 'rejected',
          rejection_reason: rejectionReason,
          synced_at: new Date().toISOString()
        });

        // Also remove temporary hazard marker from offline road_hazards
        if (item.temp_id) {
          await db.road_hazards.delete(item.temp_id).catch(() => {});
        }

        rejectedCount++;
        const rejectResult = {
          id: item.id,
          title: item.title || item.notes?.slice(0, 40) || 'Hazard Report',
          location: `${item.district ? item.district + ', ' : ''}${item.state}`,
          status: 'rejected',
          reason: rejectionReason,
          created_at: item.created_at
        };
        results.push(rejectResult);

        // Emit bulletin rejection event
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('ner_offline_hazard_rejected', { detail: rejectResult }));
        }

        if (onResult) onResult(rejectResult);
      } else {
        // AI PASSED: Upload images to Supabase storage & Insert to Supabase road_hazards
        const uploadedUrls = [];
        if (item.mediaBase64List && item.mediaBase64List.length > 0) {
          for (let i = 0; i < item.mediaBase64List.length; i++) {
            const m = item.mediaBase64List[i];
            try {
              const mime = m.mimeType || 'image/jpeg';
              const ext = mime.split('/')[1] || 'jpg';
              const cleanExt = ext.toLowerCase().replace(/[^a-z0-9]/g, '');
              const fileName = `offline-sync-${Date.now()}-${i}.${cleanExt}`;
              const filePath = `reports/${fileName}`;

              // Convert base64 back to Blob
              const byteCharacters = atob(m.data.replace(/^data:[^;]+;base64,/, ''));
              const byteNumbers = new Array(byteCharacters.length);
              for (let j = 0; j < byteCharacters.length; j++) {
                byteNumbers[j] = byteCharacters.charCodeAt(j);
              }
              const byteArray = new Uint8Array(byteNumbers);
              const blob = new Blob([byteArray], { type: mime });

              const { error: upErr } = await supabase.storage
                .from('hazard-images')
                .upload(filePath, blob, { upsert: true });

              if (!upErr) {
                const { data: urlData } = supabase.storage.from('hazard-images').getPublicUrl(filePath);
                if (urlData?.publicUrl) uploadedUrls.push(urlData.publicUrl);
              }
            } catch (upEx) {
              console.warn('Failed to upload offline media during sync:', upEx);
            }
          }
        }

        const primaryUrl = uploadedUrls.length > 0 ? uploadedUrls[0] : null;

        const serverPayload = {
          title: item.title || (item.notes ? item.notes.slice(0, 60) : 'Hazard Incident'),
          hazard_type: item.hazard_type,
          severity: item.severity,
          impact_radius_km: item.impact_radius_km || 5.0,
          status: 'reported',
          latitude: item.latitude,
          longitude: item.longitude,
          state: item.state,
          district: item.district,
          notes: item.notes,
          image_url: primaryUrl,
          media_urls: uploadedUrls,
          reported_by: item.reported_by || null,
          reported_by_id: item.reported_by_id || null,
          reported_by_role: item.reported_by_role || 'citizen_driver',
          reported_by_name: item.reported_by_name || 'Field Reporter',
          reported_by_contact: item.reported_by_contact || '',
          is_verified: true,
          ai_verified: true,
          ai_confidence: verifyData.analysis?.authenticity_confidence || 0.9,
          ai_hazard_type: verifyData.analysis?.detected_hazard_type || item.hazard_type,
          ai_verdict_summary: verifyData.analysis?.verdict_summary || null,
          ai_analysis_raw: verifyData.analysis || null,
        };

        const { data: insertedData, error: insErr } = await supabase
          .from('road_hazards')
          .insert([serverPayload])
          .select()
          .maybeSingle();

        if (!insErr && insertedData) {
          await db.offline_hazard_queue.update(item.id, {
            synced: 1,
            sync_status: 'verified_and_synced',
            server_id: insertedData.id,
            synced_at: new Date().toISOString()
          });

          // Save to local cached road_hazards
          await db.road_hazards.put(insertedData);
          syncedCount++;

          const passResult = {
            id: item.id,
            title: item.title,
            location: `${item.district ? item.district + ', ' : ''}${item.state}`,
            status: 'verified_and_synced',
            hazard: insertedData,
          };
          results.push(passResult);

          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('ner_hazard_reported', { detail: insertedData }));
          }

          if (onResult) onResult(passResult);
        }
      }
    } catch (err) {
      console.error(`Error processing offline hazard ${item.id}:`, err);
    }
  }

  return { syncedCount, rejectedCount, results };
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
      await db.road_hazards.filter(h => h.id === hazardId || h.temp_id === hazardId).delete().catch(() => {});
    }
    if (db.offline_hazard_queue) {
      await db.offline_hazard_queue.where('id').equals(hazardId).delete().catch(() => {});
      await db.offline_hazard_queue.filter(h => h.id === hazardId || h.temp_id === hazardId).delete().catch(() => {});
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
      await db.shipments.filter(s => (shipmentId && (s.id === shipmentId || s.server_id === shipmentId)) || (trackingCode && s.tracking_code === trackingCode)).delete().catch(() => {});
    }
    if (db.offline_shipment_queue) {
      if (trackingCode) await db.offline_shipment_queue.where('tracking_code').equals(trackingCode).delete().catch(() => {});
      await db.offline_shipment_queue.filter(s => (shipmentId && (s.id === shipmentId || s.server_id === shipmentId)) || (trackingCode && s.tracking_code === trackingCode)).delete().catch(() => {});
    }
  } catch (err) {
    console.warn('Dexie: Failed to delete shipment offline:', err);
  }
}

/**
 * Retrieve all offline hazard reports rejected by Gemini AI forensics
 * @returns {Promise<Array>}
 */
export async function getOfflineRejectedReports() {
  try {
    if (!db.offline_hazard_queue) return [];
    return await db.offline_hazard_queue.where('synced').equals(2).toArray();
  } catch (err) {
    console.warn('Dexie: Failed to get rejected offline reports:', err);
    return [];
  }
}

/**
 * Dismiss/delete a rejected offline hazard report record from queue
 * @param {number} id
 */
export async function dismissOfflineRejectedReport(id) {
  try {
    if (db.offline_hazard_queue && id) {
      await db.offline_hazard_queue.delete(id);
    }
  } catch (err) {
    console.warn(`Dexie: Failed to dismiss rejected report ${id}:`, err);
  }
}

/**
 * Clear all rejected offline hazard reports
 */
export async function clearAllRejectedReports() {
  try {
    if (db.offline_hazard_queue) {
      await db.offline_hazard_queue.where('synced').equals(2).delete();
    }
  } catch (err) {
    console.warn('Dexie: Failed to clear all rejected reports:', err);
  }
}
