'use client';

import { useMapEvents, Marker } from 'react-leaflet';
import { useEffect } from 'react';
import L from 'leaflet';

// Tactical animated Ping Marker Icon for pinned location
const tacticalPingIcon = L.divIcon({
  className: 'custom-pin-marker',
  html: `
    <div class="relative flex items-center justify-center">
      <span class="absolute inline-flex w-7 h-7 rounded-full bg-rose-500 opacity-75 animate-ping"></span>
      <div class="relative w-7 h-7 rounded-full bg-gradient-to-tr from-rose-600 to-amber-500 border-2 border-white flex items-center justify-center text-[12px] text-white font-bold shadow-2xl">
        📍
      </div>
    </div>
  `,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

export default function MapPinPicker({ isPinning, onLocationPicked, pinnedCoords }) {
  const map = useMapEvents({
    click(e) {
      if (!isPinning) return;
      const { lat, lng } = e.latlng;
      const latVal = parseFloat(lat.toFixed(6));
      const lngVal = parseFloat(lng.toFixed(6));
      if (onLocationPicked) {
        onLocationPicked({
          latitude: latVal,
          longitude: lngVal,
          lat: latVal,
          lng: lngVal,
        });
      }
    },
  });

  useEffect(() => {
    const container = map?.getContainer();
    if (!container) return;
    if (isPinning) {
      container.style.cursor = 'crosshair';
    } else {
      container.style.cursor = '';
    }
    return () => {
      container.style.cursor = '';
    };
  }, [isPinning, map]);

  const pLat = pinnedCoords?.latitude || pinnedCoords?.lat;
  const pLng = pinnedCoords?.longitude || pinnedCoords?.lng;

  if (!pLat || !pLng || isNaN(pLat) || isNaN(pLng)) return null;

  return (
    <Marker 
      position={[pLat, pLng]} 
      icon={tacticalPingIcon} 
    />
  );
}
