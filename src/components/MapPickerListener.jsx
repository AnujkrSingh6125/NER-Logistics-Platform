'use client';

import { useMapEvents, Marker } from 'react-leaflet';
import L from 'leaflet';

const selectPinIcon = L.divIcon({
  className: 'custom-picker-pin',
  html: `
    <div class="relative flex items-center justify-center">
      <span class="absolute inline-flex w-6 h-6 rounded-full bg-cyan-400 opacity-75 animate-ping"></span>
      <div class="relative w-6 h-6 rounded-full bg-cyan-500 border-2 border-white flex items-center justify-center text-[10px] text-slate-950 font-bold shadow-lg">
        📍
      </div>
    </div>
  `,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

export default function MapPickerListener({ isPicking, onPick, selectedCoords }) {
  useMapEvents({
    click(e) {
      if (!isPicking) return;
      onPick({
        lat: parseFloat(e.latlng.lat.toFixed(6)),
        lng: parseFloat(e.latlng.lng.toFixed(6)),
      });
    },
  });

  if (!selectedCoords?.lat || !selectedCoords?.lng) return null;

  return (
    <Marker 
      position={[selectedCoords.lat, selectedCoords.lng]} 
      icon={selectPinIcon} 
    />
  );
}
