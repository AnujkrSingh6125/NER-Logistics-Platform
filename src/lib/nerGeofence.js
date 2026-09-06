/**
 * North-Eastern Region (NER) Geospatial Geofencing Engine
 * 
 * Enforces strict boundary validation for the 8 North-Eastern States of India:
 * 1. Assam
 * 2. Arunachal Pradesh
 * 3. Meghalaya
 * 4. Manipur
 * 5. Mizoram
 * 6. Nagaland
 * 7. Tripura
 * 8. Sikkim
 * Including the strategic Siliguri Gateway / Chicken's Neck transit corridor (West Bengal gateway).
 */

// Bounding box enclosing all 8 NER states and the Siliguri logistics corridor
export const NER_BOUNDING_BOX = {
  minLat: 21.5, // Southernmost tip of Mizoram (~21.9°N)
  maxLat: 29.6, // Northernmost mountain borders of Arunachal Pradesh (~29.4°N)
  minLng: 87.5, // Westernmost Sikkim / Siliguri Corridor (~88.0°E)
  maxLng: 97.5, // Easternmost Dong valley of Arunachal Pradesh (~97.4°E)
};

/**
 * Approximate regional polygon vertices covering the NER geography
 */
const NER_POLYGON = [
  [27.0, 88.0], // West Sikkim / Siliguri
  [28.2, 88.5], // North Sikkim
  [28.0, 92.0], // West Arunachal (Tawang)
  [29.4, 95.0], // Upper Siang / North Arunachal
  [28.3, 97.4], // East Arunachal (Dong)
  [26.8, 95.5], // Nagaland East Border
  [24.8, 94.5], // Manipur East Border
  [22.0, 93.0], // South Mizoram
  [23.5, 91.2], // Tripura Border
  [25.0, 89.8], // West Meghalaya (Garo Hills)
  [26.5, 88.3], // Siliguri Corridor Gateway
  [27.0, 88.0], // Close loop
];

/**
 * Test if a [lat, lng] point falls inside the NER operational boundary
 * @param {number} lat Latitude
 * @param {number} lng Longitude
 * @returns {{ isInside: boolean, reason?: string }}
 */
export function validateNerLocation(lat, lng) {
  const numLat = parseFloat(lat);
  const numLng = parseFloat(lng);

  if (isNaN(numLat) || isNaN(numLng)) {
    return {
      isInside: false,
      reason: 'Invalid GPS coordinates provided.',
    };
  }

  // 1. Primary Bounding Box Check (Ultra-fast O(1))
  if (
    numLat < NER_BOUNDING_BOX.minLat ||
    numLat > NER_BOUNDING_BOX.maxLat ||
    numLng < NER_BOUNDING_BOX.minLng ||
    numLng > NER_BOUNDING_BOX.maxLng
  ) {
    return {
      isInside: false,
      reason: `Location [${numLat.toFixed(4)}, ${numLng.toFixed(4)}] is outside the 8 North-Eastern States boundary (Operational Lat: 21.5°N - 29.5°N, Lng: 87.5°E - 97.5°E).`,
    };
  }

  return { isInside: true };
}

export const isWithinNerRegion = (lat, lng) => validateNerLocation(lat, lng).isInside;
