/**
 * Fetches realistic road driving geometry, distance, and duration via OSRM.
 * @param {Array<number>} start [lat, lng]
 * @param {Array<number>} end [lat, lng]
 */
export async function fetchRealRoadRoute(start, end) {
  if (!start || !end) return null;

  const [startLat, startLng] = start;
  const [endLat, endLng] = end;

  const isStartMainland = startLat < 26.2 && startLng < 89.5;
  const isEndNER = endLng >= 89.8;
  const isEndMainland = endLat < 26.2 && endLng < 89.5;
  const isStartNER = startLng >= 89.8;
  const requiresSiliguri = (isStartMainland && isEndNER) || (isStartNER && isEndMainland);

  const siliguri = [26.7271, 88.3953];
  const wpStr = requiresSiliguri 
    ? `${startLng},${startLat};${siliguri[1]},${siliguri[0]};${endLng},${endLat}`
    : `${startLng},${startLat};${endLng},${endLat}`;

  const url = `https://router.project-osrm.org/route/v1/driving/${wpStr}?overview=full&geometries=geojson`;

  try {
    const res = await fetch(url);
    const data = await res.json();

    if (!data.routes || data.routes.length === 0) {
      throw new Error('No drivable road route found between selected points.');
    }

    const route = data.routes[0];

    // Convert GeoJSON [lng, lat] to Leaflet [lat, lng]
    const latLngCoordinates = route.geometry.coordinates.map(([lng, lat]) => [lat, lng]);

    return {
      coordinates: latLngCoordinates,
      distanceKm: (route.distance / 1000).toFixed(1), // km
      durationHours: Math.floor(route.duration / 3600),
      durationMins: Math.round((route.duration % 3600) / 60),
    };
  } catch (error) {
    console.error('OSRM Highway Routing Error:', error);
    // Fallback to straight line only if road engine fails
    return {
      coordinates: [start, end],
      distanceKm: 'N/A',
      durationHours: 0,
      durationMins: 0,
      fallback: true,
    };
  }
}
