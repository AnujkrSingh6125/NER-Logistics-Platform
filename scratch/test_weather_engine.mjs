import { fetchCoordinateWeather, fetchRouteWeatherSummary } from '../src/lib/weatherService.js';

async function testWeather() {
  console.log('--- Testing Coordinate Weather (Guwahati & Haflong) ---');
  const guwahati = await fetchCoordinateWeather(26.1445, 91.7362);
  console.log('Guwahati Weather:', guwahati);

  const haflong = await fetchCoordinateWeather(25.1764, 93.0232);
  console.log('Haflong (NH-27) Weather:', haflong);

  console.log('\n--- Testing Route Weather Summary (Guwahati to Silchar Corridor) ---');
  const mockRoute = [
    [26.1445, 91.7362], // Guwahati
    [25.9000, 92.2000], // Jagi Road
    [25.5700, 92.7800], // Lumding / Dima Hasao
    [25.1764, 93.0232], // Haflong
    [24.8333, 92.7789]  // Silchar
  ];

  const summary = await fetchRouteWeatherSummary(mockRoute);
  console.log('Corridor Weather Summary:', summary);
}

testWeather();
