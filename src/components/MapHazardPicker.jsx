'use client';

import { useMapEvents, Marker } from 'react-leaflet';
import L from 'leaflet';

const tempHazardIcon = L.divIcon({
  className: 'temp-hazard-pin',
  html: `
    <div class="relative flex items-center justify-center">
      <span class="absolute inline-flex w-7 h-7 rounded-full bg-amber-500 opacity-75 animate-ping"></span>
      <div class="relative w-7 h-7 rounded-full bg-amber-500 border-2 border-white flex items-center justify-center text-xs text-slate-950 font-bold shadow-xl">
        ⚠️
      </div>
    </div>
  `,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

export default function MapHazardPicker({ isInjectMode, onLocationSelected, selectedCoords }) {
  useMapEvents({
    click(e) {
      if (!isInjectMode) return;
      const { lat, lng } = e.latlng;
      if (onLocationSelected) {
        onLocationSelected({
          lat: parseFloat(lat.toFixed(6)),
          lng: parseFloat(lng.toFixed(6)),
        });
      }
    },
  });

  if (!selectedCoords?.lat || !selectedCoords?.lng) return null;

  return (
    <Marker 
      position={[selectedCoords.lat, selectedCoords.lng]} 
      icon={tempHazardIcon} 
    />
  );
}
