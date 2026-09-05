/**
 * Reverse Geocoding & Geographic Detection Utility for 8 NER States
 * Resolves real-world location details (Road/Highway, Town/Village, District, State)
 * from geographic coordinates with multi-tier online reverse geocoding and offline NER spatial fallback.
 */

// Master 50 NER Supply Hubs with known coordinates for fallback proximity resolution
const NER_REFERENCE_HUBS = [
  { name: 'Guwahati Central Depot', state: 'Assam', district: 'Kamrup Metropolitan', lat: 26.1445, lng: 91.7362 },
  { name: 'Dibrugarh Medical Storage', state: 'Assam', district: 'Dibrugarh', lat: 27.4728, lng: 94.9120 },
  { name: 'Silchar Valley Hub', state: 'Assam', district: 'Cachar', lat: 24.8333, lng: 92.7789 },
  { name: 'Tezpur Transit Warehouse', state: 'Assam', district: 'Sonitpur', lat: 26.6528, lng: 92.7926 },
  { name: 'Jorhat Ration Depot', state: 'Assam', district: 'Jorhat', lat: 26.7509, lng: 94.2037 },
  { name: 'Bongaigaon Fuel Storage', state: 'Assam', district: 'Bongaigaon', lat: 26.4958, lng: 90.5432 },
  { name: 'Nagaon Buffer Depot', state: 'Assam', district: 'Nagaon', lat: 26.3452, lng: 92.6840 },
  { name: 'Tinsukia Depot', state: 'Assam', district: 'Tinsukia', lat: 27.4922, lng: 95.3468 },
  { name: 'Karimganj Border Depot', state: 'Assam', district: 'Karimganj', lat: 24.8690, lng: 92.3556 },
  { name: 'Haflong Hill Transit', state: 'Assam', district: 'Dima Hasao', lat: 25.1764, lng: 93.0182 },
  { name: 'Goalpara Food Hub', state: 'Assam', district: 'Goalpara', lat: 26.1772, lng: 90.6277 },
  { name: 'North Lakhimpur Camp', state: 'Assam', district: 'Lakhimpur', lat: 27.2356, lng: 94.1037 },
  { name: 'Barpeta Relief Store', state: 'Assam', district: 'Barpeta', lat: 26.3216, lng: 91.0048 },
  { name: 'Dhubri River Depot', state: 'Assam', district: 'Dhubri', lat: 26.0207, lng: 89.9744 },
  { name: 'Kokrajhar Transit Camp', state: 'Assam', district: 'Kokrajhar', lat: 26.4014, lng: 90.2716 },
  { name: 'Itanagar State Relief Center', state: 'Arunachal Pradesh', district: 'Papum Pare', lat: 27.0844, lng: 93.6053 },
  { name: 'Pasighat Logistics Post', state: 'Arunachal Pradesh', district: 'East Siang', lat: 28.0665, lng: 95.3267 },
  { name: 'Tawang High-Altitude Depot', state: 'Arunachal Pradesh', district: 'Tawang', lat: 27.5861, lng: 91.8653 },
  { name: 'Ziro Cold Storage Hub', state: 'Arunachal Pradesh', district: 'Lower Subansiri', lat: 27.5450, lng: 93.8290 },
  { name: 'Tezu Relief Depot', state: 'Arunachal Pradesh', district: 'Lohit', lat: 27.9256, lng: 96.1627 },
  { name: 'Bomdila Mountain Warehouse', state: 'Arunachal Pradesh', district: 'West Kameng', lat: 27.2645, lng: 92.4231 },
  { name: 'Aalo Transit Base', state: 'Arunachal Pradesh', district: 'West Siang', lat: 28.1691, lng: 94.7981 },
  { name: 'Shillong Central Medical Depot', state: 'Meghalaya', district: 'East Khasi Hills', lat: 25.5788, lng: 91.8933 },
  { name: 'Jowai Highway Hub', state: 'Meghalaya', district: 'West Jaintia Hills', lat: 25.4524, lng: 92.2034 },
  { name: 'Tura West Garo Depot', state: 'Meghalaya', district: 'West Garo Hills', lat: 25.5144, lng: 90.2034 },
  { name: 'Nongpoh Transit Base', state: 'Meghalaya', district: 'Ri-Bhoi', lat: 25.9038, lng: 91.8797 },
  { name: 'Williamnagar Supply Store', state: 'Meghalaya', district: 'East Garo Hills', lat: 25.6047, lng: 90.5989 },
  { name: 'Baghmara Border Point', state: 'Meghalaya', district: 'South Garo Hills', lat: 25.1866, lng: 90.6374 },
  { name: 'Imphal Central Depot', state: 'Manipur', district: 'Imphal West', lat: 24.8170, lng: 93.9368 },
  { name: 'Churachandpur Valley Store', state: 'Manipur', district: 'Churachandpur', lat: 24.3337, lng: 93.6738 },
  { name: 'Senapati Highway Hub', state: 'Manipur', district: 'Senapati', lat: 25.2678, lng: 94.0167 },
  { name: 'Thoubal Food Depot', state: 'Manipur', district: 'Thoubal', lat: 24.6393, lng: 93.9989 },
  { name: 'Ukhrul Hill Station Depot', state: 'Manipur', district: 'Ukhrul', lat: 25.1121, lng: 94.3606 },
  { name: 'Jiribam Border Transit', state: 'Manipur', district: 'Jiribam', lat: 24.8028, lng: 93.1239 },
  { name: 'Aizawl State Storage', state: 'Mizoram', district: 'Aizawl', lat: 23.7271, lng: 92.7176 },
  { name: 'Lunglei South Hub', state: 'Mizoram', district: 'Lunglei', lat: 22.8878, lng: 92.7388 },
  { name: 'Champhai Border Depot', state: 'Mizoram', district: 'Champhai', lat: 23.4735, lng: 93.3283 },
  { name: 'Kolasib Highway Transit', state: 'Mizoram', district: 'Kolasib', lat: 24.2244, lng: 92.6784 },
  { name: 'Serchhip Supply Depot', state: 'Mizoram', district: 'Serchhip', lat: 23.3414, lng: 92.8504 },
  { name: 'Kohima State Central Depot', state: 'Nagaland', district: 'Kohima', lat: 25.6751, lng: 94.1086 },
  { name: 'Dimapur Railway Logistics Hub', state: 'Nagaland', district: 'Dimapur', lat: 25.9094, lng: 93.7266 },
  { name: 'Mokokchung Transit Store', state: 'Nagaland', district: 'Mokokchung', lat: 26.3256, lng: 94.5161 },
  { name: 'Tuensang Eastern Hub', state: 'Nagaland', district: 'Tuensang', lat: 26.2737, lng: 94.8252 },
  { name: 'Mon Border Depot', state: 'Nagaland', district: 'Mon', lat: 26.7410, lng: 95.0594 },
  { name: 'Agartala Central Depot', state: 'Tripura', district: 'West Tripura', lat: 23.8315, lng: 91.2868 },
  { name: 'Dharmanagar North Hub', state: 'Tripura', district: 'North Tripura', lat: 24.3768, lng: 92.1678 },
  { name: 'Udaipur South Depot', state: 'Tripura', district: 'Gomati', lat: 23.5336, lng: 91.4883 },
  { name: 'Ambassa Relief Post', state: 'Tripura', district: 'Dhalai', lat: 23.9268, lng: 91.8569 },
  { name: 'Gangtok State Relief Hub', state: 'Sikkim', district: 'East Sikkim', lat: 27.3389, lng: 88.6065 },
  { name: 'Mangan North Sikkim Depot', state: 'Sikkim', district: 'North Sikkim', lat: 27.5042, lng: 88.5303 },
];

const VALID_NER_STATES = [
  'Assam',
  'Arunachal Pradesh',
  'Meghalaya',
  'Manipur',
  'Mizoram',
  'Nagaland',
  'Tripura',
  'Sikkim'
];

// In-memory cache to prevent redundant network roundtrips
const geocodeCache = new Map();

/**
 * Calculates straight line distance in km between two lat/lng points
 */
function getDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Fast offline spatial fallback that estimates the NER state & nearest district sector
 */
export function estimateNerLocationFallback(lat, lng) {
  if (lat == null || lng == null || isNaN(lat) || isNaN(lng)) {
    return { state: 'Assam', district: 'Central Sector', formattedSummary: 'Assam Sector' };
  }

  // Find the nearest reference supply hub
  let nearestHub = NER_REFERENCE_HUBS[0];
  let minDistance = Infinity;

  for (const hub of NER_REFERENCE_HUBS) {
    const dist = getDistanceKm(lat, lng, hub.lat, hub.lng);
    if (dist < minDistance) {
      minDistance = dist;
      nearestHub = hub;
    }
  }

  const distanceText = minDistance < 5 ? '' : `${Math.round(minDistance)}km from `;
  const formattedSummary = `${distanceText}${nearestHub.district}, ${nearestHub.state}`;

  return {
    state: nearestHub.state,
    district: nearestHub.district,
    road: '',
    locality: nearestHub.district,
    displayName: `${nearestHub.district} Region, ${nearestHub.state}, India`,
    formattedSummary
  };
}

/**
 * Primary Reverse Geocoding Function: Queries Nominatim with automatic fallback
 */
export async function reverseGeocode(lat, lng) {
  if (lat == null || lng == null || isNaN(parseFloat(lat)) || isNaN(parseFloat(lng))) {
    return null;
  }

  const numLat = parseFloat(Number(lat).toFixed(4));
  const numLng = parseFloat(Number(lng).toFixed(4));

  if (numLat < -90 || numLat > 90 || numLng < -180 || numLng > 180) {
    return null;
  }

  const cacheKey = `${numLat},${numLng}`;
  if (geocodeCache.has(cacheKey)) {
    return geocodeCache.get(cacheKey);
  }

  try {
    const endpoint = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${numLat}&lon=${numLng}&zoom=14&addressdetails=1`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4500);

    const response = await fetch(endpoint, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        'Accept-Language': 'en'
      }
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      if (data && data.address) {
        const addr = data.address;

        // 1. Road or Highway
        const road = addr.road || addr.highway || addr.path || addr.pedestrian || addr.footway || '';

        // 2. Locality
        const locality = addr.town || addr.village || addr.city || addr.suburb || addr.hamlet || addr.neighbourhood || addr.municipality || '';

        // 3. District / County
        let district = addr.county || addr.state_district || addr.district || locality || '';
        if (district.toLowerCase().endsWith(' district')) {
          district = district.slice(0, -9).trim();
        }

        // 4. State
        let state = addr.state || '';
        const matchedNerState = VALID_NER_STATES.find(
          (s) => s.toLowerCase() === state.toLowerCase()
        );
        if (matchedNerState) {
          state = matchedNerState;
        }

        // 5. Formatted Summary
        const summaryParts = [];
        if (road) summaryParts.push(road);
        if (locality && locality !== road) summaryParts.push(locality);
        if (district && district !== locality && district !== road) summaryParts.push(district);
        if (state && !summaryParts.includes(state)) summaryParts.push(state);

        const formattedSummary = summaryParts.length > 0 
          ? summaryParts.join(', ') 
          : (data.display_name ? data.display_name.split(',').slice(0, 3).join(',').trim() : `${district}, ${state}`);

        const result = {
          displayName: data.display_name || formattedSummary,
          formattedSummary,
          road,
          locality,
          district: district || 'Central Sector',
          state: state || 'Assam',
          country: addr.country || 'India'
        };

        geocodeCache.set(cacheKey, result);
        return result;
      }
    }
  } catch (err) {
    console.warn('Online reverse geocoding fallback triggered:', err.message || err);
  }

  // Fallback to spatial estimation
  const fallback = estimateNerLocationFallback(numLat, numLng);
  geocodeCache.set(cacheKey, fallback);
  return fallback;
}
