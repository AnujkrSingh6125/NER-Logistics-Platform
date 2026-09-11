'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { 
  MapContainer, 
  TileLayer, 
  Marker, 
  Circle,
  Polyline,
  Popup, 
  Tooltip, 
  useMap 
} from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { 
  Building2, 
  MapPin, 
  Phone, 
  Copy, 
  Check, 
  AlertTriangle, 
  Layers,
  Clock,
  ShieldAlert,
  Radio,
  Boxes,
  LocateFixed,
  Navigation,
  Filter,
  Maximize2,
  Minimize2,
  Search,
  Package,
  ChevronDown,
  ChevronsRight,
  Sparkles,
  CheckCircle2,
  Compass,
  X,
  Trash2,
  Loader2
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/context/AuthContext';
import { getHubsOffline, saveHubsOffline, deleteHazardOffline } from '@/lib/offlineDb';
import MapPinPicker from '@/components/MapPinPicker';
import { estimateNerLocationFallback } from '@/lib/geoUtils';
import MultiRouteLayer from '@/components/MultiRouteLayer';

// Restricted Geographic Boundaries for the 8 North East States
const NER_MAP_BOUNDS = [
  [21.5, 87.5], // South-West
  [29.8, 97.5], // North-East
];

const STATE_VIEWPORTS = {
  ALL: { center: [26.2006, 92.9376], zoom: 7.2 },
  Assam: { center: [26.2006, 92.9376], zoom: 7.8 },
  'Arunachal Pradesh': { center: [27.8000, 94.5000], zoom: 7.5 },
  Meghalaya: { center: [25.5788, 91.5000], zoom: 8.5 },
  Manipur: { center: [24.8170, 93.9368], zoom: 8.5 },
  Mizoram: { center: [23.3000, 92.8000], zoom: 8.2 },
  Nagaland: { center: [26.1584, 94.5624], zoom: 8.5 },
  Tripura: { center: [23.8315, 91.6000], zoom: 8.5 },
  Sikkim: { center: [27.5330, 88.5122], zoom: 9.0 },
};

const TILE_LAYERS = {
  streets: {
    name: 'Primary Streets',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
  },
  topo: {
    name: 'Topographic',
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: 'Map data: &copy; OpenStreetMap contributors, SRTM | Map style: &copy; OpenTopoMap',
    maxZoom: 17,
  },
  satellite: {
    name: 'Satellite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri',
    maxZoom: 18,
  },
};

// Master Fallback 50 NER Supply Hubs across all 8 states
const FALLBACK_50_HUBS = [
  // Assam (15 Hubs)
  { id: '1', hub_name: 'Guwahati Central Food Depot', hub_code: 'HUB-ASM-001', state: 'Assam', district: 'Kamrup Metropolitan', hub_type: 'state_central_depot', capacity_metric_tons: 15000, latitude: 26.1445, longitude: 91.7362, contact_person: 'R. K. Barooah', contact_phone: '+91-94350-10001' },
  { id: '2', hub_name: 'Dibrugarh Medical Storage', hub_code: 'HUB-ASM-002', state: 'Assam', district: 'Dibrugarh', hub_type: 'medical_depot', capacity_metric_tons: 3500, latitude: 27.4728, longitude: 94.9120, contact_person: 'Dr. Hiren Gogoi', contact_phone: '+91-94350-10002' },
  { id: '3', hub_name: 'Silchar Valley Hub', hub_code: 'HUB-ASM-003', state: 'Assam', district: 'Cachar', hub_type: 'district_fci_godown', capacity_metric_tons: 8000, latitude: 24.8333, longitude: 92.7789, contact_person: 'S. Purkayastha', contact_phone: '+91-94350-10003' },
  { id: '4', hub_name: 'Tezpur Transit Warehouse', hub_code: 'HUB-ASM-004', state: 'Assam', district: 'Sonitpur', hub_type: 'emergency_transit_camp', capacity_metric_tons: 5000, latitude: 26.6528, longitude: 92.7926, contact_person: 'N. K. Saikia', contact_phone: '+91-94350-10004' },
  { id: '5', hub_name: 'Jorhat Ration Depot', hub_code: 'HUB-ASM-005', state: 'Assam', district: 'Jorhat', hub_type: 'district_fci_godown', capacity_metric_tons: 6500, latitude: 26.7509, longitude: 94.2037, contact_person: 'B. Bora', contact_phone: '+91-94350-10005' },
  { id: '6', hub_name: 'Bongaigaon Fuel Storage', hub_code: 'HUB-ASM-006', state: 'Assam', district: 'Bongaigaon', hub_type: 'fuel_storage', capacity_metric_tons: 12000, latitude: 26.4958, longitude: 90.5432, contact_person: 'M. Choudhury', contact_phone: '+91-94350-10006' },
  { id: '7', hub_name: 'Nagaon Buffer Depot', hub_code: 'HUB-ASM-007', state: 'Assam', district: 'Nagaon', hub_type: 'district_fci_godown', capacity_metric_tons: 7200, latitude: 26.3452, longitude: 92.6840, contact_person: 'P. Goswami', contact_phone: '+91-94350-10007' },
  { id: '8', hub_name: 'Tinsukia Depot', hub_code: 'HUB-ASM-008', state: 'Assam', district: 'Tinsukia', hub_type: 'state_central_depot', capacity_metric_tons: 9000, latitude: 27.4922, longitude: 95.3468, contact_person: 'A. K. Sharma', contact_phone: '+91-94350-10008' },
  { id: '9', hub_name: 'Karimganj Border Depot', hub_code: 'HUB-ASM-009', state: 'Assam', district: 'Karimganj', hub_type: 'emergency_transit_camp', capacity_metric_tons: 4200, latitude: 24.8690, longitude: 92.3556, contact_person: 'M. Paul', contact_phone: '+91-94350-10009' },
  { id: '10', hub_name: 'Haflong Hill Transit', hub_code: 'HUB-ASM-010', state: 'Assam', district: 'Dima Hasao', hub_type: 'emergency_transit_camp', capacity_metric_tons: 3000, latitude: 25.1764, longitude: 93.0182, contact_person: 'D. Langthasa', contact_phone: '+91-94350-10010' },
  { id: '11', hub_name: 'Goalpara Food Hub', hub_code: 'HUB-ASM-011', state: 'Assam', district: 'Goalpara', hub_type: 'district_fci_godown', capacity_metric_tons: 4500, latitude: 26.1772, longitude: 90.6277, contact_person: 'R. Ahmed', contact_phone: '+91-94350-10011' },
  { id: '12', hub_name: 'North Lakhimpur Camp', hub_code: 'HUB-ASM-012', state: 'Assam', district: 'Lakhimpur', hub_type: 'emergency_transit_camp', capacity_metric_tons: 3800, latitude: 27.2356, longitude: 94.1037, contact_person: 'B. Doley', contact_phone: '+91-94350-10012' },
  { id: '13', hub_name: 'Barpeta Relief Store', hub_code: 'HUB-ASM-013', state: 'Assam', district: 'Barpeta', hub_type: 'district_fci_godown', capacity_metric_tons: 5200, latitude: 26.3216, longitude: 91.0048, contact_person: 'K. Das', contact_phone: '+91-94350-10013' },
  { id: '14', hub_name: 'Dhubri River Depot', hub_code: 'HUB-ASM-014', state: 'Assam', district: 'Dhubri', hub_type: 'state_central_depot', capacity_metric_tons: 6800, latitude: 26.0207, longitude: 89.9744, contact_person: 'J. Roy', contact_phone: '+91-94350-10014' },
  { id: '15', hub_name: 'Kokrajhar Transit Camp', hub_code: 'HUB-ASM-015', state: 'Assam', district: 'Kokrajhar', hub_type: 'emergency_transit_camp', capacity_metric_tons: 4000, latitude: 26.4014, longitude: 90.2716, contact_person: 'U. Brahma', contact_phone: '+91-94350-10015' },

  // Arunachal Pradesh (7 Hubs)
  { id: '16', hub_name: 'Itanagar State Relief Center', hub_code: 'HUB-ARU-001', state: 'Arunachal Pradesh', district: 'Papum Pare', hub_type: 'state_central_depot', capacity_metric_tons: 6000, latitude: 27.0844, longitude: 93.6053, contact_person: 'N. Tadar', contact_phone: '+91-94360-20001' },
  { id: '17', hub_name: 'Pasighat Logistics Post', hub_code: 'HUB-ARU-002', state: 'Arunachal Pradesh', district: 'East Siang', hub_type: 'emergency_transit_camp', capacity_metric_tons: 3500, latitude: 28.0665, longitude: 95.3267, contact_person: 'O. Moyong', contact_phone: '+91-94360-20002' },
  { id: '18', hub_name: 'Tawang High-Altitude Depot', hub_code: 'HUB-ARU-003', state: 'Arunachal Pradesh', district: 'Tawang', hub_type: 'medical_depot', capacity_metric_tons: 2500, latitude: 27.5861, longitude: 91.8653, contact_person: 'T. Norbu', contact_phone: '+91-94360-20003' },
  { id: '19', hub_name: 'Ziro Cold Storage Hub', hub_code: 'HUB-ARU-004', state: 'Arunachal Pradesh', district: 'Lower Subansiri', hub_type: 'district_fci_godown', capacity_metric_tons: 3000, latitude: 27.5450, longitude: 93.8290, contact_person: 'K. Tado', contact_phone: '+91-94360-20004' },
  { id: '20', hub_name: 'Tezu Relief Depot', hub_code: 'HUB-ARU-005', state: 'Arunachal Pradesh', district: 'Lohit', hub_type: 'district_fci_godown', capacity_metric_tons: 3200, latitude: 27.9256, longitude: 96.1627, contact_person: 'S. Tayeng', contact_phone: '+91-94360-20005' },
  { id: '21', hub_name: 'Bomdila Mountain Warehouse', hub_code: 'HUB-ARU-006', state: 'Arunachal Pradesh', district: 'West Kameng', hub_type: 'fuel_storage', capacity_metric_tons: 4000, latitude: 27.2645, longitude: 92.4231, contact_person: 'P. Dorjee', contact_phone: '+91-94360-20006' },
  { id: '22', hub_name: 'Aalo Transit Base', hub_code: 'HUB-ARU-007', state: 'Arunachal Pradesh', district: 'West Siang', hub_type: 'emergency_transit_camp', capacity_metric_tons: 2800, latitude: 28.1691, longitude: 94.7981, contact_person: 'G. Ete', contact_phone: '+91-94360-20007' },

  // Meghalaya (6 Hubs)
  { id: '23', hub_name: 'Shillong Central Medical Depot', hub_code: 'HUB-MEG-001', state: 'Meghalaya', district: 'East Khasi Hills', hub_type: 'medical_depot', capacity_metric_tons: 5000, latitude: 25.5788, longitude: 91.8933, contact_person: 'Dr. B. Mawlong', contact_phone: '+91-94361-30001' },
  { id: '24', hub_name: 'Jowai Highway Hub', hub_code: 'HUB-MEG-002', state: 'Meghalaya', district: 'West Jaintia Hills', hub_type: 'district_fci_godown', capacity_metric_tons: 4200, latitude: 25.4524, longitude: 92.2034, contact_person: 'H. Lyngdoh', contact_phone: '+91-94361-30002' },
  { id: '25', hub_name: 'Tura West Garo Depot', hub_code: 'HUB-MEG-003', state: 'Meghalaya', district: 'West Garo Hills', hub_type: 'state_central_depot', capacity_metric_tons: 6000, latitude: 25.5144, longitude: 90.2034, contact_person: 'M. Sangma', contact_phone: '+91-94361-30003' },
  { id: '26', hub_name: 'Nongpoh Transit Base', hub_code: 'HUB-MEG-004', state: 'Meghalaya', district: 'Ri-Bhoi', hub_type: 'fuel_storage', capacity_metric_tons: 4500, latitude: 25.9038, longitude: 91.8797, contact_person: 'E. Kharbhih', contact_phone: '+91-94361-30004' },
  { id: '27', hub_name: 'Williamnagar Supply Store', hub_code: 'HUB-MEG-005', state: 'Meghalaya', district: 'East Garo Hills', hub_type: 'district_fci_godown', capacity_metric_tons: 3500, latitude: 25.6047, longitude: 90.5989, contact_person: 'R. Marak', contact_phone: '+91-94361-30005' },
  { id: '28', hub_name: 'Baghmara Border Point', hub_code: 'HUB-MEG-006', state: 'Meghalaya', district: 'South Garo Hills', hub_type: 'emergency_transit_camp', capacity_metric_tons: 2500, latitude: 25.1866, longitude: 90.6374, contact_person: 'D. Shira', contact_phone: '+91-94361-30006' },

  // Manipur (6 Hubs)
  { id: '29', hub_name: 'Imphal Central Depot', hub_code: 'HUB-MAN-001', state: 'Manipur', district: 'Imphal West', hub_type: 'state_central_depot', capacity_metric_tons: 8500, latitude: 24.8170, longitude: 93.9368, contact_person: 'Y. Biren Singh', contact_phone: '+91-94360-40001' },
  { id: '30', hub_name: 'Churachandpur Valley Store', hub_code: 'HUB-MAN-002', state: 'Manipur', district: 'Churachandpur', hub_type: 'district_fci_godown', capacity_metric_tons: 4500, latitude: 24.3337, longitude: 93.6738, contact_person: 'T. Haokip', contact_phone: '+91-94360-40002' },
  { id: '31', hub_name: 'Senapati Highway Hub', hub_code: 'HUB-MAN-003', state: 'Manipur', district: 'Senapati', hub_type: 'emergency_transit_camp', capacity_metric_tons: 4000, latitude: 25.2678, longitude: 94.0167, contact_person: 'K. Poumai', contact_phone: '+91-94360-40003' },
  { id: '32', hub_name: 'Thoubal Food Depot', hub_code: 'HUB-MAN-004', state: 'Manipur', district: 'Thoubal', hub_type: 'district_fci_godown', capacity_metric_tons: 5000, latitude: 24.6393, longitude: 93.9989, contact_person: 'N. Tomba', contact_phone: '+91-94360-40004' },
  { id: '33', hub_name: 'Ukhrul Hill Station Depot', hub_code: 'HUB-MAN-005', state: 'Manipur', district: 'Ukhrul', hub_type: 'medical_depot', capacity_metric_tons: 2800, latitude: 25.1121, longitude: 94.3606, contact_person: 'A. Shimray', contact_phone: '+91-94360-40005' },
  { id: '34', hub_name: 'Jiribam Border Transit', hub_code: 'HUB-MAN-006', state: 'Manipur', district: 'Jiribam', hub_type: 'fuel_storage', capacity_metric_tons: 3500, latitude: 24.8028, longitude: 93.1239, contact_person: 'M. Meitei', contact_phone: '+91-94360-40006' },

  // Mizoram (5 Hubs)
  { id: '35', hub_name: 'Aizawl State Storage', hub_code: 'HUB-MIZ-001', state: 'Mizoram', district: 'Aizawl', hub_type: 'state_central_depot', capacity_metric_tons: 7000, latitude: 23.7271, longitude: 92.7176, contact_person: 'C. Zothansanga', contact_phone: '+91-94361-50001' },
  { id: '36', hub_name: 'Lunglei South Hub', hub_code: 'HUB-MIZ-002', state: 'Mizoram', district: 'Lunglei', hub_type: 'district_fci_godown', capacity_metric_tons: 4800, latitude: 22.8878, longitude: 92.7388, contact_person: 'R. Lalbiakzuala', contact_phone: '+91-94361-50002' },
  { id: '37', hub_name: 'Champhai Border Depot', hub_code: 'HUB-MIZ-003', state: 'Mizoram', district: 'Champhai', hub_type: 'emergency_transit_camp', capacity_metric_tons: 3200, latitude: 23.4735, longitude: 93.3283, contact_person: 'V. Lalrinawma', contact_phone: '+91-94361-50003' },
  { id: '38', hub_name: 'Kolasib Highway Transit', hub_code: 'HUB-MIZ-004', state: 'Mizoram', district: 'Kolasib', hub_type: 'fuel_storage', capacity_metric_tons: 3800, latitude: 24.2244, longitude: 92.6784, contact_person: 'K. Ralte', contact_phone: '+91-94361-50004' },
  { id: '39', hub_name: 'Serchhip Supply Depot', hub_code: 'HUB-MIZ-005', state: 'Mizoram', district: 'Serchhip', hub_type: 'medical_depot', capacity_metric_tons: 2600, latitude: 23.3414, longitude: 92.8504, contact_person: 'H. Sailo', contact_phone: '+91-94361-50005' },

  // Nagaland (5 Hubs)
  { id: '40', hub_name: 'Kohima State Central Depot', hub_code: 'HUB-NAG-001', state: 'Nagaland', district: 'Kohima', hub_type: 'state_central_depot', capacity_metric_tons: 6500, latitude: 25.6751, longitude: 94.1086, contact_person: 'V. Kire', contact_phone: '+91-94360-60001' },
  { id: '41', hub_name: 'Dimapur Railway Logistics Hub', hub_code: 'HUB-NAG-002', state: 'Nagaland', district: 'Dimapur', hub_type: 'state_central_depot', capacity_metric_tons: 14000, latitude: 25.9094, longitude: 93.7266, contact_person: 'T. Lotha', contact_phone: '+91-94360-60002' },
  { id: '42', hub_name: 'Mokokchung Transit Store', hub_code: 'HUB-NAG-003', state: 'Nagaland', district: 'Mokokchung', hub_type: 'district_fci_godown', capacity_metric_tons: 4000, latitude: 26.3256, longitude: 94.5161, contact_person: 'I. Jamir', contact_phone: '+91-94360-60003' },
  { id: '43', hub_name: 'Tuensang Eastern Hub', hub_code: 'HUB-NAG-004', state: 'Nagaland', district: 'Tuensang', hub_type: 'emergency_transit_camp', capacity_metric_tons: 3200, latitude: 26.2737, longitude: 94.8252, contact_person: 'S. Chang', contact_phone: '+91-94360-60004' },
  { id: '44', hub_name: 'Mon Border Depot', hub_code: 'HUB-NAG-005', state: 'Nagaland', district: 'Mon', hub_type: 'medical_depot', capacity_metric_tons: 2800, latitude: 26.7410, longitude: 95.0594, contact_person: 'N. Konyak', contact_phone: '+91-94360-60005' },

  // Tripura (4 Hubs)
  { id: '45', hub_name: 'Agartala Central Depot', hub_code: 'HUB-TRI-001', state: 'Tripura', district: 'West Tripura', hub_type: 'state_central_depot', capacity_metric_tons: 9500, latitude: 23.8315, longitude: 91.2868, contact_person: 'S. Bhowmik', contact_phone: '+91-94364-70001' },
  { id: '46', hub_name: 'Dharmanagar North Hub', hub_code: 'HUB-TRI-002', state: 'Tripura', district: 'North Tripura', hub_type: 'district_fci_godown', capacity_metric_tons: 5000, latitude: 24.3768, longitude: 92.1678, contact_person: 'P. Debbarma', contact_phone: '+91-94364-70002' },
  { id: '47', hub_name: 'Udaipur South Depot', hub_code: 'HUB-TRI-003', state: 'Tripura', district: 'Gomati', hub_type: 'fuel_storage', capacity_metric_tons: 4200, latitude: 23.5336, longitude: 91.4883, contact_person: 'A. Dasgupta', contact_phone: '+91-94364-70003' },
  { id: '48', hub_name: 'Ambassa Relief Post', hub_code: 'HUB-TRI-004', state: 'Tripura', district: 'Dhalai', hub_type: 'emergency_transit_camp', capacity_metric_tons: 3100, latitude: 23.9268, longitude: 91.8569, contact_person: 'B. Reang', contact_phone: '+91-94364-70004' },

  // Sikkim (2 Hubs)
  { id: '49', hub_name: 'Gangtok State Relief Hub', hub_code: 'HUB-SIK-001', state: 'Sikkim', district: 'East Sikkim', hub_type: 'state_central_depot', capacity_metric_tons: 5500, latitude: 27.3389, longitude: 88.6065, contact_person: 'P. Tshering Bhutia', contact_phone: '+91-94341-80001' },
  { id: '50', hub_name: 'Mangan North Sikkim High-Altitude Depot', hub_code: 'HUB-SIK-002', state: 'Sikkim', district: 'North Sikkim', hub_type: 'medical_depot', capacity_metric_tons: 2200, latitude: 27.5042, longitude: 88.5303, contact_person: 'K. Lepcha', contact_phone: '+91-94341-80002' },
];

const DEFAULT_HAZARDS = [];

// Helper: Clean Minimalist Supply Hub Pin (Blue GPS Beacon with Warehouse Icon)
function createSupplyHubDivIcon() {
  return L.divIcon({
    className: 'custom-supply-hub-pin',
    html: `
      <div class="relative flex items-center justify-center cursor-pointer group select-none">
        <div class="relative flex items-center justify-center w-6 h-6 rounded-full bg-gradient-to-tr from-blue-700 via-blue-600 to-cyan-500 text-white border-2 border-white shadow-[0_2px_8px_rgba(29,78,216,0.6)] group-hover:scale-125 transition-transform duration-150">
          <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect width="16" height="20" x="4" y="2" rx="2" ry="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M8 10h.01"/><path d="M16 10h.01"/><path d="M8 14h.01"/><path d="M16 14h.01"/></svg>
        </div>
      </div>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -14],
  });
}

// Helper: Selected Origin Supply Hub Marker (Pulsing Emerald Ring & Dynamic HUD Badge)
function createOriginHubDivIcon(hub = {}) {
  const shortName = hub.district || hub.hub_name || 'Origin';
  const code = hub.hub_code || '';

  return L.divIcon({
    className: 'custom-origin-hub-pin',
    html: `
      <div class="relative flex flex-col items-center justify-center cursor-pointer select-none">
        <div class="absolute -top-7 bg-emerald-600 text-white font-mono text-[8px] font-black px-2 py-0.5 rounded-md border border-emerald-300 shadow-[0_2px_12px_rgba(16,185,129,0.7)] whitespace-nowrap z-30 flex items-center gap-1 tracking-wider uppercase">
          <span>📍 ORIGIN</span>
        </div>
        <div class="relative flex items-center justify-center w-8 h-8">
          <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span class="absolute inline-flex w-10 h-10 rounded-full border-2 border-dashed border-emerald-400 opacity-60"></span>
          <div class="relative flex items-center justify-center w-7 h-7 rounded-full bg-gradient-to-tr from-emerald-600 via-teal-600 to-emerald-500 text-white border-2 border-white shadow-[0_0_16px_rgba(16,185,129,0.9)] z-20">
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect width="16" height="20" x="4" y="2" rx="2" ry="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M8 10h.01"/><path d="M16 10h.01"/><path d="M8 14h.01"/><path d="M16 14h.01"/></svg>
          </div>
        </div>
        <div class="w-1.5 h-1.5 bg-emerald-600 rotate-45 -mt-1 border-r border-b border-white z-20"></div>
        <div class="mt-0.5 px-2 py-0.5 rounded-md bg-emerald-950 text-emerald-300 font-sans text-[9px] font-black border border-emerald-500 shadow-sm whitespace-nowrap leading-tight text-center">
          <span>${shortName}</span>
          ${code ? `<span class="text-emerald-400 text-[8px] font-mono block">${code}</span>` : ''}
        </div>
      </div>
    `,
    iconSize: [70, 56],
    iconAnchor: [35, 18],
    popupAnchor: [0, -22],
  });
}

// Helper: Selected Destination Supply Hub Marker (Pulsing Cyan Target Ring & Dynamic HUD Badge)
function createDestinationHubDivIcon(hub = {}) {
  const shortName = hub.district || hub.hub_name || 'Dest';
  const code = hub.hub_code || '';

  return L.divIcon({
    className: 'custom-destination-hub-pin',
    html: `
      <div class="relative flex flex-col items-center justify-center cursor-pointer select-none">
        <div class="absolute -top-7 bg-cyan-600 text-white font-mono text-[8px] font-black px-2 py-0.5 rounded-md border border-cyan-300 shadow-[0_2px_12px_rgba(6,182,212,0.7)] whitespace-nowrap z-30 flex items-center gap-1 tracking-wider uppercase">
          <span>🎯 DESTINATION</span>
        </div>
        <div class="relative flex items-center justify-center w-8 h-8">
          <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
          <span class="absolute inline-flex w-10 h-10 rounded-full border-2 border-dashed border-cyan-400 opacity-60"></span>
          <div class="relative flex items-center justify-center w-7 h-7 rounded-full bg-gradient-to-tr from-cyan-600 via-blue-600 to-indigo-600 text-white border-2 border-white shadow-[0_0_16px_rgba(6,182,212,0.9)] z-20">
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect width="16" height="20" x="4" y="2" rx="2" ry="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M8 10h.01"/><path d="M16 10h.01"/><path d="M8 14h.01"/><path d="M16 14h.01"/></svg>
          </div>
        </div>
        <div class="w-1.5 h-1.5 bg-cyan-600 rotate-45 -mt-1 border-r border-b border-white z-20"></div>
        <div class="mt-0.5 px-2 py-0.5 rounded-md bg-cyan-950 text-cyan-300 font-sans text-[9px] font-black border border-cyan-500 shadow-sm whitespace-nowrap leading-tight text-center">
          <span>${shortName}</span>
          ${code ? `<span class="text-cyan-400 text-[8px] font-mono block">${code}</span>` : ''}
        </div>
      </div>
    `,
    iconSize: [70, 56],
    iconAnchor: [35, 18],
    popupAnchor: [0, -22],
  });
}

// Helper: Crisp Road Hazard Pin (Pulsating Red Alert Triangle)
function createRoadHazardDivIcon() {
  return L.divIcon({
    className: 'custom-road-hazard-pin',
    html: `
      <div class="relative flex items-center justify-center w-7 h-7 cursor-pointer">
        <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75"></span>
        <div class="relative inline-flex items-center justify-center rounded-full w-6 h-6 bg-red-600 border-2 border-white text-white shadow-[0_0_12px_rgba(239,68,68,0.9)]">
          <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        </div>
      </div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -14],
  });
}

// Helper: Live Driver Convoy Beacon (Strictly Nodal Radar View)
function createDriverDivIcon(driverCode = 'DRV-NER', isFocused = false) {
  return L.divIcon({
    className: 'custom-driver-convoy-pin',
    html: `
      <div class="relative flex flex-col items-center justify-center cursor-pointer">
        <div class="absolute -top-5 ${isFocused ? 'bg-cyan-500 text-slate-950 font-black border-white' : 'bg-slate-950 text-cyan-300 border-cyan-500/80'} font-mono text-[8px] px-1.5 py-0.5 rounded border shadow-md whitespace-nowrap z-10 transition-all">
          🚛 ${driverCode}
        </div>
        <div class="relative flex items-center justify-center ${isFocused ? 'w-8 h-8 border-amber-400 bg-cyan-950 shadow-[0_0_24px_rgba(6,182,212,1)] ring-4 ring-cyan-400/40' : 'w-7 h-7 border-cyan-400 bg-slate-900 shadow-[0_0_14px_rgba(6,182,212,0.9)]'} rounded-full border-2 text-cyan-400 transition-all">
          <span class="animate-ping absolute inline-flex h-full w-full rounded-full ${isFocused ? 'bg-amber-400 opacity-80' : 'bg-cyan-400 opacity-60'}"></span>
          <svg xmlns="http://www.w3.org/2000/svg" width="${isFocused ? 15 : 13}" height="${isFocused ? 15 : 13}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18.5" r="2.5"/><circle cx="7" cy="18.5" r="2.5"/></svg>
        </div>
      </div>
    `,
    iconSize: isFocused ? [32, 32] : [28, 28],
    iconAnchor: isFocused ? [16, 16] : [14, 14],
    popupAnchor: [0, -16],
  });
}

// Helper: User Self Location Pin
function createUserLocationDivIcon() {
  return L.divIcon({
    className: 'custom-user-location-pin',
    html: `
      <div class="relative flex items-center justify-center w-6 h-6">
        <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
        <div class="relative w-4 h-4 rounded-full bg-emerald-500 border-2 border-white shadow-[0_0_10px_rgba(16,185,129,0.9)]"></div>
      </div>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -12],
  });
}

function MapViewController({ selectedState, bounds, focusTarget, isFullscreen }) {
  const map = useMap();

  // Invalidate map size on fullscreen toggle to prevent grey bars
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        map.invalidateSize();
      } catch (e) {}
    }, 200);
    return () => clearTimeout(timer);
  }, [isFullscreen, map]);

  useEffect(() => {
    if (focusTarget?.coords && focusTarget.coords.length === 2) {
      try {
        map.flyTo(focusTarget.coords, focusTarget.zoom || 14, { duration: 1.2 });
      } catch (e) {}
      return;
    }

    if (bounds) {
      try {
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14, duration: 1.2 });
      } catch (e) {}
      return;
    }

    if (selectedState && STATE_VIEWPORTS[selectedState]) {
      const { center, zoom } = STATE_VIEWPORTS[selectedState];
      map.flyTo(center, zoom, { duration: 1.4 });
    }
  }, [selectedState, bounds, focusTarget, map]);

  return null;
}

const STABLE_DEFAULT_CENTER = [26.2006, 92.9376];

export default function TacticalHubMapInner({ 
  height = '490px', 
  activeTileStyle = 'streets',
  multiRouteData = null,
  activeRouteIndex = 0,
  onSelectRoute = null,
  routeBounds = null,
  originHub = null,
  destHub = null,
  hazards: propHazards = null,
  initialHazards = [],
  userLocation = null,
  isNodalOfficer = false,
  onSelectOrigin = null,
  onSelectDest = null,
  isPickingLocation = false,
  onLocationPick = null,
  pickedCoords = null,
  onCancelPick = null,
  focusTarget = null
}) {
  const { user, isNodalOfficer: authIsNodal } = useAuth();
  const effectiveIsNodal = isNodalOfficer || authIsNodal;

  const [hubs, setHubs] = useState(FALLBACK_50_HUBS);
  const [hazards, setHazards] = useState(propHazards || initialHazards || []);
  const [activeDrivers, setActiveDrivers] = useState([]);
  const [selectedState, setSelectedState] = useState('ALL');
  const [copiedId, setCopiedId] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [driverSearchQuery, setDriverSearchQuery] = useState('');
  const [selectedRadarDriver, setSelectedRadarDriver] = useState(null);
  const [showDriverDropdown, setShowDriverDropdown] = useState(false);
  const [deletingHazardId, setDeletingHazardId] = useState(null);

  const handleDeleteHazardFromMap = async (hazard, e) => {
    if (e) e.stopPropagation();
    if (!hazard?.id) return;

    const isMine = user?.id && (
      hazard.reported_by_id === user.id || 
      hazard.reported_by === user.id || 
      hazard.created_by === user.id || 
      hazard.user_id === user.id
    );
    const isNodal = effectiveIsNodal;

    if (!isNodal && !isMine) {
      alert('Unauthorized: You can only delete road hazards reported by your own account.');
      return;
    }

    const confirmMsg = isNodal && !isMine
      ? `[GOVERNMENT AUTHORITY OVERRIDE]\nAre you sure you want to delete this hazard? This action cannot be undone.`
      : `Are you sure you want to delete this hazard? This action cannot be undone.`;

    if (!window.confirm(confirmMsg)) return;

    try {
      setDeletingHazardId(hazard.id);
      // 1. Optimistic removal from map
      setHazards((prev) => prev.filter((h) => h.id !== hazard.id));

      // 2. Add to deleted cache
      if (typeof window !== 'undefined') {
        try {
          const delCache = JSON.parse(sessionStorage.getItem('ner_deleted_hazards') || '[]');
          if (!delCache.includes(hazard.id)) {
            delCache.push(hazard.id);
            sessionStorage.setItem('ner_deleted_hazards', JSON.stringify(delCache));
            localStorage.setItem('ner_deleted_hazards', JSON.stringify(delCache));
          }
        } catch (e) {}
      }

      // 3. Delete via backend API
      try {
        await fetch('/api/records/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'hazard', id: hazard.id }),
        });
      } catch (apiErr) {}

      // 4. Delete from Supabase directly
      await supabase
        .from('road_hazards')
        .delete()
        .eq('id', hazard.id);

      // 5. Delete from Dexie offline DB
      try {
        await deleteHazardOffline(hazard.id);
      } catch (dexErr) {}

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('ner_hazard_deleted', { detail: { id: hazard.id } }));
        window.dispatchEvent(new CustomEvent('ner_hazard_reported'));
      }
    } catch (err) {
      console.error('Failed to delete hazard from map:', err);
      alert(`Could not delete hazard: ${err.message || 'Permission denied by database policy'}`);
    } finally {
      setDeletingHazardId(null);
    }
  };

    // Sync with prop when parent updates
  useEffect(() => {
    if (propHazards !== null && propHazards !== undefined) {
      setHazards(propHazards);
    } else if (initialHazards && initialHazards.length > 0) {
      setHazards(initialHazards);
    }
  }, [propHazards, initialHazards]);

  // Exit fullscreen on ESC key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isFullscreen]);

  // Load supply hubs & road hazards
  useEffect(() => {
    async function load() {
      try {
        const { data: hubData } = await supabase
          .from('supply_hubs')
          .select('*')
          .order('state', { ascending: true });

        if (hubData && hubData.length > 0) {
          setHubs(hubData);
          saveHubsOffline(hubData).catch(() => {});
        } else {
          const cached = await getHubsOffline();
          if (cached && cached.length > 0) setHubs(cached);
        }

        const { data: hazData } = await supabase
          .from('road_hazards')
          .select('*')
          .neq('status', 'resolved');

        setHazards(hazData || []);
      } catch (e) {}
    }
    load();

    const handleHazardReported = async () => {
      try {
        const { data: hazData } = await supabase
          .from('road_hazards')
          .select('*')
          .neq('status', 'resolved');
        if (hazData) setHazards(hazData);
      } catch (e) {}
    };

    const handleHazardDeleted = (e) => {
      const delId = e?.detail?.id;
      if (delId) {
        setHazards((prev) => prev.filter((h) => h.id !== delId));
      }
    };

    // Realtime subscription for road hazards (DELETE, INSERT, UPDATE)
    const hazChannel = supabase
      .channel('map_hazards_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'road_hazards' }, async (payload) => {
        if (payload?.eventType === 'DELETE') {
          const delId = payload.old?.id;
          if (delId) {
            setHazards((prev) => prev.filter((h) => h.id !== delId));
          }
        } else if (payload?.eventType === 'INSERT') {
          if (payload.new && payload.new.status !== 'resolved') {
            setHazards((prev) => [payload.new, ...prev.filter((h) => h.id !== payload.new.id)]);
          }
        } else if (payload?.eventType === 'UPDATE') {
          if (payload.new?.status === 'resolved') {
            setHazards((prev) => prev.filter((h) => h.id !== payload.new.id));
          } else if (payload.new) {
            setHazards((prev) => [payload.new, ...prev.filter((h) => h.id !== payload.new.id)]);
          }
        }

        // Background query to guarantee synchronization
        const { data: hazData } = await supabase
          .from('road_hazards')
          .select('*')
          .neq('status', 'resolved');
        if (hazData) setHazards(hazData);
      })
      .subscribe();

    if (typeof window !== 'undefined') {
      window.addEventListener('ner_hazard_reported', handleHazardReported);
      window.addEventListener('ner_hazard_deleted', handleHazardDeleted);
      return () => {
        supabase.removeChannel(hazChannel);
        window.removeEventListener('ner_hazard_reported', handleHazardReported);
        window.removeEventListener('ner_hazard_deleted', handleHazardDeleted);
      };
    }
  }, []);

  // Live Fleet Telemetry: STRICTLY NODAL-ONLY CONVOY TRACKING
  useEffect(() => {
    async function fetchFleetTelemetry() {
      // If not a Nodal Officer, strictly do not fetch or display live fleet telemetry
      if (!effectiveIsNodal) {
        setActiveDrivers([]);
        setSelectedRadarDriver(null);
        setShowDriverDropdown(false);
        return;
      }
      try {
        // Query active in-transit shipments
        let shipQuery = supabase
          .from('shipments')
          .select('*')
          .in('status', ['IN_TRANSIT', 'in_transit', 'ACTIVE', 'active']);

        if (!isNodalOfficer && user?.id) {
          shipQuery = shipQuery.eq('driver_id', user.id);
        }

        const { data: shipmentsData } = await shipQuery;

        // Query active driver profiles
        let driversQuery = supabase
          .from('driver_profiles')
          .select('*')
          .eq('is_active_duty', true);

        if (!isNodalOfficer && user?.id) {
          driversQuery = driversQuery.eq('id', user.id);
        }

        const { data: driversData } = await driversQuery;

        const driversMap = new Map();
        if (driversData) {
          driversData.forEach(d => driversMap.set(d.id, d));
        }

        const combined = [];
        const seenDriverIds = new Set();

        if (shipmentsData && shipmentsData.length > 0) {
          shipmentsData.forEach(s => {
            const d = s.driver_id ? driversMap.get(s.driver_id) : null;
            const lat = s.current_lat || s.current_latitude || d?.current_latitude;
            const lng = s.current_lng || s.current_longitude || d?.current_longitude;

            if (lat && lng) {
              combined.push({
                id: s.id || `ship-${s.tracking_code}`,
                driver_id: s.driver_id,
                driver_code: s.driver_code || d?.driver_code || 'DRV-NER-4921',
                driver_name: s.driver_name || d?.full_name || 'Field Operator',
                driver_phone: s.driver_phone || d?.phone || '+91-94350-00000',
                vehicle_number: d?.vehicle_number || s.vehicle_number || 'AS-01-AX-9921',
                cargo_type: s.cargo_type || s.commodity_type || 'Emergency Relief Supplies',
                cargo_weight_val: s.cargo_weight_val || s.quantity_tons || 15.0,
                cargo_weight_unit: s.cargo_weight_unit || 'MT',
                origin_hub_name: s.origin_hub_name || s.origin || 'Guwahati Central Depot',
                dest_hub_name: s.dest_hub_name || s.destination_district || 'Regional Supply Depot',
                current_lat: lat,
                current_lng: lng,
                last_ping: s.updated_at || d?.last_ping || d?.last_telemetry_at || new Date().toISOString(),
                last_telemetry_at: s.updated_at || d?.last_ping || d?.last_telemetry_at || new Date().toISOString(),
                status: 'IN_TRANSIT',
                tracking_code: s.tracking_code,
              });
              if (s.driver_id) seenDriverIds.add(s.driver_id);
            }
          });
        }

        if (isNodalOfficer) {
          driversMap.forEach((d, id) => {
            if (!seenDriverIds.has(id) && d.current_latitude && d.current_longitude && d.is_active_duty) {
              combined.push({
                id: id,
                driver_id: id,
                driver_code: d.driver_code || `DRV-NER-${id.slice(0, 4).toUpperCase()}`,
                driver_name: d.full_name || 'Field Operator',
                driver_phone: d.phone || '+91-94350-00000',
                vehicle_number: d.vehicle_number || 'AS-01-AX-9921',
                cargo_type: 'General Relief Consignment',
                cargo_weight_val: 12.5,
                cargo_weight_unit: 'MT',
                origin_hub_name: 'Guwahati Hub',
                dest_hub_name: 'Field Corridor',
                current_lat: d.current_latitude,
                current_lng: d.current_longitude,
                last_ping: d.last_ping || d.last_telemetry_at || new Date().toISOString(),
                last_telemetry_at: d.last_ping || d.last_telemetry_at || new Date().toISOString(),
                status: 'IN_TRANSIT',
                tracking_code: `TRK-${d.driver_code || id.slice(0, 6)}`,
              });
            }
          });
        }

        setActiveDrivers(combined);
        if (combined.length === 0) {
          setSelectedRadarDriver(null);
          setShowDriverDropdown(false);
        }
      } catch (err) {
        console.warn('Fleet telemetry fetch fallback:', err);
      }
    }

    fetchFleetTelemetry();

    // Setup Supabase Realtime Subscription for Live Driver Tracking
    const channel = supabase
      .channel('fleet_telemetry_radar')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shipments' }, () => {
        fetchFleetTelemetry();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'driver_profiles' }, () => {
        fetchFleetTelemetry();
      })
      .subscribe();

    const handleJourneyUpdate = () => fetchFleetTelemetry();
    const handleJourneyHalted = () => {
      setActiveDrivers([]);
      setSelectedRadarDriver(null);
      setShowDriverDropdown(false);
      fetchFleetTelemetry();
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('ner_journey_started', handleJourneyUpdate);
      window.addEventListener('ner_journey_completed', handleJourneyHalted);
      window.addEventListener('ner_journey_deleted', handleJourneyHalted);
      return () => {
        supabase.removeChannel(channel);
        window.removeEventListener('ner_journey_started', handleJourneyUpdate);
        window.removeEventListener('ner_journey_completed', handleJourneyHalted);
        window.removeEventListener('ner_journey_deleted', handleJourneyHalted);
      };
    }
  }, [isNodalOfficer, user?.id]);

  // Filter matching drivers for tactical search bar
  const matchingDrivers = useMemo(() => {
    if (!driverSearchQuery.trim()) return activeDrivers;
    const q = driverSearchQuery.toLowerCase().trim();
    return activeDrivers.filter(d => 
      (d.driver_code && d.driver_code.toLowerCase().includes(q)) ||
      (d.driver_name && d.driver_name.toLowerCase().includes(q)) ||
      (d.vehicle_number && d.vehicle_number.toLowerCase().includes(q)) ||
      (d.cargo_type && d.cargo_type.toLowerCase().includes(q)) ||
      (d.tracking_code && d.tracking_code.toLowerCase().includes(q))
    );
  }, [activeDrivers, driverSearchQuery]);

  const handleSelectRadarDriver = (driver) => {
    setSelectedRadarDriver(driver);
    setDriverSearchQuery(driver.driver_code);
    setShowDriverDropdown(false);
    const dLat = parseFloat(driver.current_lat || driver.current_latitude);
    const dLng = parseFloat(driver.current_lng || driver.current_longitude);
    if (!isNaN(dLat) && !isNaN(dLng)) {
      setLocalFocusTarget({ coords: [dLat, dLng], zoom: 14 });
    }
  };

  const [localFocusTarget, setLocalFocusTarget] = useState(null);
  const effectiveFocusTarget = localFocusTarget || focusTarget;

  const filteredHubs = useMemo(() => {
    if (selectedState === 'ALL') return hubs;
    return hubs.filter((h) => h.state === selectedState);
  }, [hubs, selectedState]);

  const filteredHazards = useMemo(() => {
    if (selectedState === 'ALL') return hazards;
    return hazards.filter((h) => h.state === selectedState);
  }, [hazards, selectedState]);

  const handleCopyPhone = (phone, id, e) => {
    e.stopPropagation();
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(phone);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const activeTileConfig = TILE_LAYERS[activeTileStyle] || TILE_LAYERS.streets;

  return (
    <div 
      className={
        isFullscreen
          ? 'fixed inset-0 z-[5000] w-screen h-screen bg-slate-950 overflow-hidden flex flex-col'
          : `relative w-full rounded-2xl overflow-hidden shadow-xs border border-slate-200/90 dark:border-slate-800 ${isPickingLocation ? 'cursor-crosshair ring-2 ring-cyan-500' : ''}`
      } 
      style={{ height: isFullscreen ? '100vh' : height }}
    >
      
      <MapContainer
        center={STABLE_DEFAULT_CENTER}
        zoom={7.2}
        minZoom={1}
        maxZoom={19}
        maxBounds={null}
        maxBoundsViscosity={0}
        scrollWheelZoom={true}
        style={{ height: '100%', width: '100%', backgroundColor: '#f8fafc' }}
        className={`z-0 ${isPickingLocation ? 'cursor-crosshair' : ''}`}
      >
        <MapPinPicker
          isPinning={isPickingLocation}
          onLocationPicked={onLocationPick}
          pinnedCoords={pickedCoords}
        />
        <TileLayer
          key={activeTileStyle}
          attribution={activeTileConfig.attribution}
          url={activeTileConfig.url}
          maxZoom={activeTileConfig.maxZoom}
        />

        <MapViewController 
          selectedState={selectedState} 
          bounds={routeBounds}
          focusTarget={effectiveFocusTarget}
          isFullscreen={isFullscreen}
        />

        {/* Dynamic Multi-Route Corridors (Google Maps Tactical Alternative Routes) */}
        {multiRouteData?.allRoutes && multiRouteData.allRoutes.length > 0 && (
          <MultiRouteLayer
            routes={multiRouteData.allRoutes}
            activeRouteIndex={activeRouteIndex}
            onSelectRoute={onSelectRoute}
          />
        )}

        {/* 3. STRICTLY SUPPLY HUBS LAYER (50 Strategic Facilities) */}
        {filteredHubs.map((hub) => {
          const hLat = parseFloat(hub.latitude);
          const hLon = parseFloat(hub.longitude);
          if (isNaN(hLat) || isNaN(hLon)) return null;

          const isOrigin = originHub && (originHub.hub_code === hub.hub_code || originHub.id === hub.id);
          const isDest = destHub && (destHub.hub_code === hub.hub_code || destHub.id === hub.id);

          const icon = isOrigin
            ? createOriginHubDivIcon(hub)
            : isDest
            ? createDestinationHubDivIcon(hub)
            : createSupplyHubDivIcon();

          return (
            <Marker
              key={`hub-${hub.id || hub.hub_code}`}
              position={[hLat, hLon]}
              icon={icon}
              zIndexOffset={isOrigin || isDest ? 1000 : 100}
            >
              <Tooltip direction="top" offset={isOrigin || isDest ? [0, -22] : [0, -14]} className="custom-tactical-tooltip">
                <div className="flex items-center gap-1.5 px-1 py-0.5 font-sans font-bold text-xs text-white">
                  <span>{isOrigin ? '📍 ORIGIN:' : isDest ? '🎯 DESTINATION:' : '🏢'}</span>
                  <span className="text-white font-bold tracking-wide">{hub.hub_name}</span>
                  <span className="text-cyan-300 font-mono text-[10px]">({hub.hub_code})</span>
                </div>
              </Tooltip>

              <Popup className="custom-hub-popup" minWidth={290} maxWidth={320}>
                <div className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-sans text-xs rounded-2xl overflow-hidden shadow-2xl border border-slate-200/90 dark:border-slate-800">
                  {/* Dark Navy / Slate Top Header Bar */}
                  <div className="bg-[#0f172a] px-3.5 py-2.5 flex items-center justify-between text-white border-b border-slate-800">
                    <span className="font-bold text-xs tracking-wider font-mono text-white">
                      {hub.hub_code || 'HUB-001'}
                    </span>
                    <div className="flex items-center gap-1.5 pr-3">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]" />
                      <span className="text-emerald-400 font-medium text-[11px]">
                        Operational
                      </span>
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="p-3.5 space-y-3">
                    {/* Title & District, State */}
                    <div>
                      <h4 className="font-bold text-[13px] text-slate-900 dark:text-white leading-tight">
                        {hub.hub_name || 'Guwahati Logistics Hub'}
                      </h4>
                      <p className="text-slate-500 dark:text-slate-400 text-[11px] flex items-center gap-1 mt-0.5 font-medium">
                        <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                        <span>{hub.district || hub.hub_name}, {hub.state}</span>
                      </p>
                    </div>

                    {/* 2-Column Info Stats Grid */}
                    <div className="grid grid-cols-2 gap-2">
                      {/* Facility Type */}
                      <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/70 rounded-xl p-2 flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/60 shrink-0">
                          <Building2 className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <span className="block text-[8.5px] uppercase tracking-wider text-slate-400 dark:text-slate-400 font-bold leading-tight">
                            Facility Type
                          </span>
                          <strong className="block text-[10.5px] font-bold text-slate-800 dark:text-slate-100 truncate leading-tight mt-0.5">
                            {hub.hub_type || 'State Central Depot'}
                          </strong>
                        </div>
                      </div>

                      {/* Total Capacity */}
                      <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/70 rounded-xl p-2 flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/60 shrink-0">
                          <Boxes className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <span className="block text-[8.5px] uppercase tracking-wider text-slate-400 dark:text-slate-400 font-bold leading-tight">
                            Total Capacity
                          </span>
                          <strong className="block text-[10.5px] font-bold text-slate-800 dark:text-slate-100 truncate leading-tight mt-0.5">
                            {hub.capacity_mt ? `${hub.capacity_mt} MT` : hub.capacity_metric_tons ? `${parseFloat(hub.capacity_metric_tons).toLocaleString()} MT` : '2,500 MT'}
                          </strong>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons: Set as Origin & Set as Destination */}
                    <div className="grid grid-cols-2 gap-2 pt-0.5">
                      {onSelectOrigin && (
                        <button
                          type="button"
                          onClick={() => onSelectOrigin(hub)}
                          className={`py-2 px-2 rounded-xl text-[11px] font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs ${
                            isOrigin
                              ? 'bg-blue-600 text-white border border-blue-600 shadow-xs'
                              : 'bg-blue-50/70 hover:bg-blue-100/90 dark:bg-blue-950/40 dark:hover:bg-blue-900/60 text-blue-600 dark:text-cyan-400 border border-blue-200/90 dark:border-blue-800/60'
                          }`}
                        >
                          <Navigation className="w-3.5 h-3.5 shrink-0 -rotate-45" />
                          <span>{isOrigin ? 'Origin Set' : 'Set as Origin'}</span>
                        </button>
                      )}
                      {onSelectDest && (
                        <button
                          type="button"
                          onClick={() => onSelectDest(hub)}
                          className={`py-2 px-2 rounded-xl text-[11px] font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs ${
                            isDest
                              ? 'bg-blue-600 text-white border border-blue-600 shadow-xs'
                              : 'bg-blue-50/70 hover:bg-blue-100/90 dark:bg-blue-950/40 dark:hover:bg-blue-900/60 text-blue-600 dark:text-cyan-400 border border-blue-200/90 dark:border-blue-800/60'
                          }`}
                        >
                          <ChevronsRight className="w-3.5 h-3.5 shrink-0" />
                          <span>{isDest ? 'Dest Set' : 'Set as Destination'}</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* 2. ROAD HAZARDS LAYER (Points & Danger Radius Perimeters) */}
        {filteredHazards.map((haz) => {
          const hLat = parseFloat(haz.latitude);
          const hLon = parseFloat(haz.longitude);
          if (isNaN(hLat) || isNaN(hLon)) return null;

          const impactRadiusKm = parseFloat(haz.impact_radius_km) || 5.0;
          const radiusMeters = impactRadiusKm * 1000;

          const geo = estimateNerLocationFallback(hLat, hLon);
          const st = (haz.state && haz.state !== 'null' && haz.state !== 'NER' && !(haz.state === 'Assam' && haz.district === 'Unspecified Sector'))
            ? haz.state
            : geo.state;
          const dt = (haz.district && haz.district !== 'Unspecified Sector' && haz.district !== 'null' && haz.district !== '')
            ? haz.district
            : geo.district;
          const locationString = `${dt}, ${st}`;

          return (
            <React.Fragment key={`hazard-group-${haz.id}`}>
              {/* Dynamic Danger Zone Circle Perimeter */}
              <Circle
                center={[hLat, hLon]}
                radius={radiusMeters}
                pathOptions={{
                  color: '#ef4444',
                  fillColor: '#ef4444',
                  fillOpacity: 0.16,
                  weight: 1.5,
                  dashArray: '5, 5',
                }}
              >
                <Tooltip sticky className="custom-tactical-tooltip">
                  <div className="flex items-center gap-1.5 px-1 py-0.5 font-sans font-bold text-xs text-white">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                    <span>{haz.hazard_type ? haz.hazard_type.replace(/_/g, ' ') : 'Danger Perimeter'} ({impactRadiusKm} km)</span>
                  </div>
                </Tooltip>
              </Circle>

              {/* Hazard Center Marker Pin */}
              <Marker
                position={[hLat, hLon]}
                icon={createRoadHazardDivIcon()}
                zIndexOffset={500}
              >
                <Tooltip direction="top" offset={[0, -14]} className="custom-tactical-tooltip">
                  <div className="flex items-center gap-1.5 px-1.5 py-0.5 font-sans font-bold text-xs text-white">
                    <span className="text-rose-400">⚠️</span>
                    <span>{haz.title || (haz.hazard_type ? haz.hazard_type.replace(/_/g, ' ') : 'Road Hazard')}</span>
                    <span className="text-rose-300 font-mono text-[10px]">({haz.severity?.toUpperCase() || 'CRITICAL'} • {impactRadiusKm} km)</span>
                  </div>
                </Tooltip>

                <Popup className="custom-tactical-popup" minWidth={300} maxWidth={330}>
                  <div className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-sans text-xs rounded-2xl overflow-hidden shadow-2xl border border-slate-200/90 dark:border-slate-800">
                    {/* Top Header */}
                    <div className="bg-[#0f172a] px-3.5 py-2.5 flex items-center justify-between text-white border-b border-slate-800">
                      <div className="flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                        <span className="font-bold text-xs tracking-wider font-mono uppercase text-white">
                          {haz.hazard_type ? haz.hazard_type.replace(/_/g, ' ') : 'ROAD HAZARD'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 pr-3">
                        <span className={`w-2 h-2 rounded-full ${
                          haz.ai_verified || haz.is_verified || haz.reported_by_role === 'nodal_officer'
                            ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]'
                            : 'bg-rose-500 animate-pulse shadow-[0_0_8px_rgba(244,63,94,0.9)]'
                        }`} />
                        <span className={`text-[11px] font-medium font-mono ${
                          haz.ai_verified || haz.is_verified || haz.reported_by_role === 'nodal_officer'
                            ? 'text-emerald-400'
                            : 'text-rose-400 uppercase'
                        }`}>
                          {haz.ai_verified || haz.is_verified || haz.reported_by_role === 'nodal_officer' ? 'AI Verified' : (haz.severity ? `${haz.severity} SEVERITY` : 'CRITICAL')}
                        </span>
                      </div>
                    </div>

                    {/* Body Content */}
                    <div className="p-3.5 space-y-3">
                      {/* Evidence Media Preview (Photos & Videos) */}
                      {(haz.image_url || (haz.media_urls && haz.media_urls.length > 0)) && (
                        <div className="relative rounded-xl overflow-hidden border border-slate-200/90 dark:border-slate-800 bg-slate-100 dark:bg-slate-950 shadow-2xs">
                          {haz.image_url?.match(/\.(mp4|webm|mov|ogg|m4v)(\?.*)?$/i) || haz.media_urls?.[0]?.match(/\.(mp4|webm|mov|ogg|m4v)(\?.*)?$/i) ? (
                            <video 
                              src={haz.image_url || haz.media_urls?.[0]} 
                              controls 
                              playsInline 
                              className="w-full max-h-36 object-cover bg-black" 
                            />
                          ) : (
                            <img 
                              src={haz.image_url || haz.media_urls?.[0]} 
                              alt="Hazard evidence" 
                              className="w-full max-h-36 object-cover" 
                            />
                          )}
                          <div className="absolute top-2 right-2 px-2 py-0.5 rounded-md bg-black/75 backdrop-blur-xs text-white text-[9px] font-mono font-bold border border-white/20">
                            📸 Live Field Evidence
                          </div>
                          {haz.media_urls && haz.media_urls.length > 1 && (
                            <span className="absolute bottom-2 right-2 bg-black/85 text-cyan-300 font-mono text-[9px] font-bold px-1.5 py-0.5 rounded border border-cyan-800">
                              +{haz.media_urls.length - 1} more
                            </span>
                          )}
                        </div>
                      )}

                      {/* Title & Location */}
                      <div>
                        <h4 className="font-bold text-[13px] text-slate-900 dark:text-white leading-tight">
                          {haz.title || 'Road Obstruction Alert'}
                        </h4>
                        <p className="text-slate-500 dark:text-slate-400 text-[11px] flex items-center gap-1 mt-0.5 font-medium">
                          <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                          <span>{locationString}</span>
                        </p>
                      </div>

                      {/* 2-Column Info Stats Grid */}
                      <div className="grid grid-cols-2 gap-2">
                        {/* Severity Level */}
                        <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/70 rounded-xl p-2 flex items-center gap-2">
                          <div className="p-1.5 rounded-lg bg-white dark:bg-slate-800 text-rose-500 border border-slate-200/60 dark:border-slate-700/60 shrink-0">
                            <AlertTriangle className="w-3.5 h-3.5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <span className="block text-[8.5px] uppercase tracking-wider text-slate-400 dark:text-slate-400 font-bold leading-tight">
                              Severity Level
                            </span>
                            <strong className="block text-[10.5px] font-bold text-rose-600 dark:text-rose-400 truncate leading-tight mt-0.5 uppercase">
                              {haz.severity || 'Critical'}
                            </strong>
                          </div>
                        </div>

                        {/* Danger Radius */}
                        <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/70 rounded-xl p-2 flex items-center gap-2">
                          <div className="p-1.5 rounded-lg bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/60 shrink-0">
                            <ShieldAlert className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <span className="block text-[8.5px] uppercase tracking-wider text-slate-400 dark:text-slate-400 font-bold leading-tight">
                              Danger Radius
                            </span>
                            <strong className="block text-[10.5px] font-bold text-slate-800 dark:text-slate-100 truncate leading-tight mt-0.5">
                              {impactRadiusKm} km Perimeter
                            </strong>
                          </div>
                        </div>
                      </div>

                      {/* AI Threat Assessment Callout (if available) */}
                      {(haz.ai_verdict_summary || haz.ai_verified) && (
                        <div className="bg-blue-50/70 dark:bg-slate-800/60 border border-blue-100 dark:border-slate-700 rounded-xl p-2.5 text-[10.5px] space-y-1">
                          <div className="flex items-center justify-between text-blue-700 dark:text-cyan-400 font-bold text-[10px]">
                            <span className="flex items-center gap-1">
                              <Sparkles className="w-3 h-3 text-blue-600 dark:text-cyan-400" />
                              <span>AI Threat Assessment</span>
                            </span>
                            {haz.ai_confidence && (
                              <span className="font-mono font-extrabold text-emerald-600 dark:text-emerald-400">
                                {Math.round(haz.ai_confidence * 100)}% Match
                              </span>
                            )}
                          </div>
                          {haz.ai_verdict_summary && (
                            <p className="text-slate-700 dark:text-slate-300 leading-relaxed italic">
                              {haz.ai_verdict_summary}
                            </p>
                          )}
                        </div>
                      )}

                      {/* Reporter Notes (if present and distinct) */}
                      {haz.notes && haz.notes !== haz.ai_verdict_summary && (
                        <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/50 rounded-xl p-2 text-[10.5px] text-slate-600 dark:text-slate-300 leading-relaxed">
                          <span className="font-bold text-slate-700 dark:text-slate-200 block text-[9.5px] mb-0.5">Field Dispatch Notes:</span>
                          {haz.notes}
                        </div>
                      )}

                      {/* Reporter Info */}
                      {haz.reported_by_name && (
                        <div className="text-[9.5px] text-slate-400 flex items-center justify-between px-0.5">
                          <span>Reported by: <strong className="text-slate-700 dark:text-slate-200">{haz.reported_by_name}</strong></span>
                        </div>
                      )}

                      {/* Delete / Clear Action */}
                      {(effectiveIsNodal || (user?.id && (haz.reported_by_id === user.id || haz.reported_by === user.id))) && (
                        <button
                          type="button"
                          onClick={(e) => handleDeleteHazardFromMap(haz, e)}
                          disabled={deletingHazardId === haz.id}
                          className="w-full py-2 px-3 rounded-xl text-[11px] font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 shadow-2xs disabled:opacity-50"
                        >
                          {deletingHazardId === haz.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-500" />
                          ) : (
                            <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                          )}
                          <span>{effectiveIsNodal ? 'Authority Override: Delete Hazard' : 'Clear / Delete My Hazard'}</span>
                        </button>
                      )}
                    </div>
                  </div>
                </Popup>
              </Marker>
            </React.Fragment>
          );
        })}

        {/* 4. ACTIVE RELIEF CONVOY FLEET LAYER (Dedicated Telemetry for Nodal Authority Portal) */}
        {effectiveIsNodal && activeDrivers.map((driver) => {
          const dLat = parseFloat(driver.current_lat || driver.current_latitude);
          const dLng = parseFloat(driver.current_lng || driver.current_longitude);
          if (isNaN(dLat) || isNaN(dLng)) return null;

          const isFocused = selectedRadarDriver?.driver_code === driver.driver_code || selectedRadarDriver?.id === driver.id;

          return (
            <Marker
              key={`driver-${driver.id || driver.tracking_code || driver.driver_code}`}
              position={[dLat, dLng]}
              icon={createDriverDivIcon(driver.driver_code || 'CONVOY', isFocused)}
            >
              <Tooltip direction="top" offset={[0, -16]} permanent={isFocused}>
                <span className={`font-mono font-bold text-[10px] ${isFocused ? 'text-amber-400 bg-slate-950 px-1.5 py-0.5 rounded border border-amber-500 shadow-md' : 'text-cyan-600'}`}>
                  🚛 {driver.driver_code} • {driver.driver_name}
                </span>
              </Tooltip>

              <Popup>
                <div className="p-3.5 bg-slate-950/95 backdrop-blur-md text-slate-100 font-mono text-xs max-w-xs space-y-2.5 rounded-xl border border-cyan-700 shadow-2xl">
                  {/* Header */}
                  <div className="flex items-center justify-between pb-1.5 border-b border-cyan-900/60">
                    <div className="flex items-center space-x-1.5 font-bold text-cyan-400 text-[10px] uppercase">
                      <Radio className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
                      <span>TACTICAL FLEET TELEMETRY</span>
                    </div>
                    <span className="px-1.5 py-0.5 rounded text-[8px] font-bold uppercase bg-cyan-950 text-cyan-300 border border-cyan-700">
                      LIVE RADAR
                    </span>
                  </div>

                  {/* Driver & Vehicle */}
                  <div className="space-y-0.5">
                    <div className="flex items-center justify-between">
                      <h5 className="font-bold text-white text-xs">{driver.driver_name}</h5>
                      <span className="text-[10px] font-bold text-cyan-400">{driver.driver_code}</span>
                    </div>
                    <p className="text-[11px] text-slate-300">
                      Vehicle Reg: <strong className="text-cyan-300">{driver.vehicle_number || 'AS-01-AX-9921'}</strong>
                    </p>
                    {driver.driver_phone && (
                      <p className="text-[10px] text-slate-400 flex items-center space-x-1">
                        <Phone className="w-3 h-3 text-slate-500" />
                        <span>{driver.driver_phone}</span>
                      </p>
                    )}
                  </div>

                  {/* Active Consignment Manifest Details */}
                  <div className="bg-slate-900/90 p-2.5 rounded-lg border border-slate-800 text-[10px] space-y-1.5">
                    <div className="text-cyan-300 font-bold uppercase text-[9px] flex items-center space-x-1">
                      <Package className="w-3 h-3 text-cyan-400" />
                      <span>ACTIVE CONSIGNMENT MANIFEST</span>
                    </div>
                    
                    <div className="text-slate-200">
                      Payload: <strong className="text-white">{driver.cargo_type || 'Emergency Relief Supplies'}</strong>
                    </div>

                    <div className="flex justify-between text-slate-300">
                      <span>Weight:</span>
                      <strong className="text-emerald-400">
                        {driver.cargo_weight_val ? `${driver.cargo_weight_val} ${driver.cargo_weight_unit || 'MT'}` : '20 MT'}
                      </strong>
                    </div>

                    {driver.origin_hub_name && driver.dest_hub_name && (
                      <div className="text-[10px] text-emerald-400 pt-0.5 border-t border-slate-800 flex items-center space-x-1">
                        <MapPin className="w-3 h-3 shrink-0" />
                        <span className="truncate">{driver.origin_hub_name} ➔ {driver.dest_hub_name}</span>
                      </div>
                    )}
                  </div>

                  {/* Telemetry & Last Ping */}
                  <div className="text-[10px] text-slate-400 flex items-center justify-between pt-0.5">
                    <span className="text-[9px] text-slate-500">Last Telemetry Ping:</span>
                    <span className="font-mono text-cyan-300 text-[9px]">
                      {driver.last_telemetry_at ? new Date(driver.last_telemetry_at).toLocaleTimeString() : 'Live Stream'}
                    </span>
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* 5. USER'S OWN GPS POSITION MARKER (Rendered if live location active) */}
        {userLocation?.coords?.lat && userLocation?.coords?.lng && (
          <Marker
            position={[userLocation.coords.lat, userLocation.coords.lng]}
            icon={createUserLocationDivIcon()}
          >
            <Tooltip direction="top" offset={[0, -12]}>
              <span className="font-mono font-bold text-[10px] text-emerald-700">
                📍 My Live GPS Location
              </span>
            </Tooltip>
          </Marker>
        )}
      </MapContainer>

      {/* Dedicated Tactical Driver Tracking Search Bar (Government / Nodal Portal Only) */}
      {effectiveIsNodal && (
        <div className="absolute top-3 left-14 z-[400] max-w-[calc(100%-110px)] sm:w-80 font-mono text-xs">
          <div className="relative">
            <div className="flex items-center bg-slate-950/95 backdrop-blur-md border border-cyan-800/80 hover:border-cyan-500 rounded-xl px-2.5 py-1.5 shadow-xl transition-all">
              <Radio className="w-3.5 h-3.5 text-cyan-400 animate-pulse shrink-0 mr-2" />
              <input
                type="text"
                value={driverSearchQuery}
                onChange={(e) => {
                  setDriverSearchQuery(e.target.value);
                  setShowDriverDropdown(true);
                }}
                onFocus={() => setShowDriverDropdown(true)}
                placeholder={`Radar: Search Driver ID (${activeDrivers.length} on duty)...`}
                className="bg-transparent text-slate-100 placeholder:text-slate-500 text-[11px] focus:outline-none w-full font-mono"
              />
              {driverSearchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setDriverSearchQuery('');
                    setSelectedRadarDriver(null);
                  }}
                  className="text-slate-400 hover:text-white p-0.5 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowDriverDropdown(!showDriverDropdown)}
                className="text-cyan-400 hover:text-cyan-300 ml-1.5 pl-1.5 border-l border-slate-800 text-[10px] font-bold shrink-0 flex items-center gap-0.5 cursor-pointer"
              >
                <span>{activeDrivers.length}</span>
                <ChevronDown className="w-3 h-3" />
              </button>
            </div>

            {/* Dropdown list of active drivers on duty */}
            {showDriverDropdown && (
              <div className="absolute top-full left-0 right-0 mt-1.5 bg-[#070d19]/98 border border-cyan-800 rounded-xl shadow-2xl max-h-56 overflow-y-auto z-50 divide-y divide-slate-800 animate-in fade-in">
                <div className="px-3 py-1.5 bg-cyan-950/60 text-[9px] font-bold text-cyan-400 uppercase tracking-wider flex items-center justify-between">
                  <span>ACTIVE FLEET RADAR</span>
                  <span>{matchingDrivers.length} ON DUTY</span>
                </div>

                {matchingDrivers.length === 0 ? (
                  <div className="p-3 text-center text-[10px] text-slate-400">
                    {activeDrivers.length === 0 
                      ? 'No active drivers currently on duty.'
                      : 'No drivers match your search query.'}
                  </div>
                ) : (
                  matchingDrivers.map((driver) => (
                    <button
                      key={`radar-opt-${driver.id || driver.driver_code}`}
                      type="button"
                      onClick={() => handleSelectRadarDriver(driver)}
                      className={`w-full text-left p-2.5 hover:bg-cyan-950/40 transition-colors flex items-center justify-between cursor-pointer ${
                        selectedRadarDriver?.driver_code === driver.driver_code ? 'bg-cyan-950/80 border-l-2 border-cyan-400' : ''
                      }`}
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center space-x-1.5">
                          <span className="font-bold text-cyan-300 text-xs">{driver.driver_code}</span>
                          <span className="text-white text-[11px] font-bold">({driver.driver_name})</span>
                        </div>
                        <div className="text-[10px] text-slate-400 truncate max-w-[190px]">
                          📦 {driver.cargo_type || 'Relief Consignment'} • {driver.cargo_weight_val || 15} {driver.cargo_weight_unit || 'MT'}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="px-1.5 py-0.5 rounded text-[8px] font-bold uppercase bg-emerald-950 text-emerald-300 border border-emerald-700">
                          LIVE
                        </span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Floating Top Banner for Location Pinning */}
      {isPickingLocation && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[400] max-w-[92%] sm:max-w-md bg-slate-950/95 text-white px-4 py-2 rounded-2xl font-mono text-xs shadow-2xl border border-rose-500 flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center space-x-2 text-rose-400">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping shrink-0" />
            <span className="font-bold text-xs text-white">
              Click anywhere on the map to pin hazard location
            </span>
          </div>
          {onCancelPick && (
            <button
              type="button"
              onClick={onCancelPick}
              className="px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[10px] font-bold uppercase transition-colors shrink-0 cursor-pointer border border-slate-700"
            >
              Cancel
            </button>
          )}
        </div>
      )}

      {/* Tactical Maximize / Minimize Symbol Button (Positioned cleanly under zoom controls on left) */}
      <button
        type="button"
        onClick={() => setIsFullscreen(!isFullscreen)}
        title={isFullscreen ? 'Exit Fullscreen' : 'Maximize Map'}
        aria-label={isFullscreen ? 'Exit Fullscreen' : 'Maximize Map'}
        className="absolute top-[78px] left-2.5 z-[400] w-[34px] h-[34px] flex items-center justify-center bg-white/95 dark:bg-slate-950/95 hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-800 hover:border-cyan-500 rounded-lg shadow-md backdrop-blur-md transition-all cursor-pointer group"
      >
        {isFullscreen ? (
          <Minimize2 className="w-4 h-4 text-rose-600 dark:text-rose-400 group-hover:scale-110 transition-transform" />
        ) : (
          <Maximize2 className="w-4 h-4 text-slate-700 dark:text-cyan-400 group-hover:scale-110 transition-transform" />
        )}
      </button>

      {/* Map is kept clean with bottom-left overlay legend removed */}
    </div>
  );
}
