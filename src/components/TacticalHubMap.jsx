'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { Compass, Loader2 } from 'lucide-react';

// Dynamically import Leaflet map inner component to disable SSR
const DynamicTacticalHubMap = dynamic(
  () => import('./TacticalHubMapInner'),
  {
    ssr: false,
    loading: () => (
      <div className="w-full bg-slate-950 border border-slate-800 rounded-xl h-[600px] flex flex-col items-center justify-center space-y-3 relative overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f172a15_1px,transparent_1px),linear-gradient(to_bottom,#0f172a15_1px,transparent_1px)] bg-[size:3rem_3rem] pointer-events-none" />
        <div className="w-12 h-12 rounded-xl bg-slate-900 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-xl shadow-cyan-950/80">
          <Compass className="w-6 h-6 animate-spin" />
        </div>
        <div className="text-center z-10">
          <h4 className="text-xs font-mono font-bold text-slate-200 uppercase tracking-widest">
            INITIALIZING TACTICAL GIS SUB-SYSTEM...
          </h4>
          <p className="text-[11px] font-mono text-slate-500 mt-1">
            Loading OpenStreetMap Clean Raster & 50 geocoded NER supply hubs
          </p>
        </div>
      </div>
    ),
  }
);

export default function TacticalHubMap(props) {
  return <DynamicTacticalHubMap {...props} />;
}
