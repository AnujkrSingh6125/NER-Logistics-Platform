'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/context/AuthContext';
import { useNav } from '@/context/NavContext';
import { useUserLocation } from '@/hooks/useUserLocation';
import TacticalHubMap from '@/components/TacticalHubMap';
import ReportHazardModal from '@/components/ReportHazardModal';
import StartJourneyModal from '@/components/StartJourneyModal';
import HazardsView from '@/components/views/HazardsView';
import HubsView from '@/components/views/HubsView';
import ShipmentsView from '@/components/views/ShipmentsView';
import SettingsView from '@/components/views/SettingsView';
import LiveClockWidget from '@/components/LiveClockWidget';
import RouteNavigator from '@/components/RouteNavigator';
import TacticalAiChatWidget from '@/components/TacticalAiChatWidget';
import { 
  Building2, 
  AlertTriangle, 
  Truck, 
  Radio, 
  Zap, 
  Route, 
  Search, 
  Settings, 
  ArrowRight, 
  ExternalLink, 
  CheckCircle2, 
  ShieldCheck, 
  Compass, 
  TrendingUp, 
  Layers, 
  Boxes, 
  Users, 
  Activity,
  MapPin,
  Clock,
  ChevronRight,
  RotateCcw,
  XCircle,
  Navigation,
  LocateFixed,
  Trash2,
  Maximize2,
  ShieldAlert,
  X,
  Map as MapIcon
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { 
  db, 
  getHubsOffline, 
  saveHubsOffline, 
  syncPendingReportsWhenOnline, 
  syncPendingShipmentsWhenOnline,
  syncOfflineHazardsWithAiVerification,
  getOfflineRejectedReports,
  dismissOfflineRejectedReport
} from '@/lib/offlineDb';
import { calculateSafestMultiRoutes, findHazardsAlongRoute, rescoreRoutesWithHazards } from '@/lib/routingService';

// Master Fallback 50 NER Supply Hubs across all 8 states
const FALLBACK_50_HUBS = [
  // Assam (15 Hubs)
  { id: '1', hub_name: 'Guwahati Central Food Depot', hub_code: 'HUB-ASM-001', state: 'Assam', district: 'Kamrup Metropolitan', latitude: 26.1445, longitude: 91.7362 },
  { id: '2', hub_name: 'Dibrugarh Medical Storage', hub_code: 'HUB-ASM-002', state: 'Assam', district: 'Dibrugarh', latitude: 27.4728, longitude: 94.9120 },
  { id: '3', hub_name: 'Silchar Valley Hub', hub_code: 'HUB-ASM-003', state: 'Assam', district: 'Cachar', latitude: 24.8333, longitude: 92.7789 },
  { id: '4', hub_name: 'Tezpur Transit Warehouse', hub_code: 'HUB-ASM-004', state: 'Assam', district: 'Sonitpur', latitude: 26.6528, longitude: 92.7926 },
  { id: '5', hub_name: 'Jorhat Ration Depot', hub_code: 'HUB-ASM-005', state: 'Assam', district: 'Jorhat', latitude: 26.7509, longitude: 94.2037 },
  { id: '6', hub_name: 'Bongaigaon Fuel Storage', hub_code: 'HUB-ASM-006', state: 'Assam', district: 'Bongaigaon', latitude: 26.4958, longitude: 90.5432 },
  { id: '7', hub_name: 'Nagaon Buffer Depot', hub_code: 'HUB-ASM-007', state: 'Assam', district: 'Nagaon', latitude: 26.3452, longitude: 92.6840 },
  { id: '8', hub_name: 'Tinsukia Depot', hub_code: 'HUB-ASM-008', state: 'Assam', district: 'Tinsukia', latitude: 27.4922, longitude: 95.3468 },
  { id: '9', hub_name: 'Karimganj Border Depot', hub_code: 'HUB-ASM-009', state: 'Assam', district: 'Karimganj', latitude: 24.8690, longitude: 92.3556 },
  { id: '10', hub_name: 'Haflong Hill Transit', hub_code: 'HUB-ASM-010', state: 'Assam', district: 'Dima Hasao', latitude: 25.1764, longitude: 93.0182 },
  { id: '11', hub_name: 'Goalpara Food Hub', hub_code: 'HUB-ASM-011', state: 'Assam', district: 'Goalpara', latitude: 26.1772, longitude: 90.6277 },
  { id: '12', hub_name: 'North Lakhimpur Camp', hub_code: 'HUB-ASM-012', state: 'Assam', district: 'Lakhimpur', latitude: 27.2356, longitude: 94.1037 },
  { id: '13', hub_name: 'Barpeta Relief Store', hub_code: 'HUB-ASM-013', state: 'Assam', district: 'Barpeta', latitude: 26.3216, longitude: 91.0048 },
  { id: '14', hub_name: 'Dhubri River Depot', hub_code: 'HUB-ASM-014', state: 'Assam', district: 'Dhubri', latitude: 26.0207, longitude: 89.9744 },
  { id: '15', hub_name: 'Kokrajhar Transit Camp', hub_code: 'HUB-ASM-015', state: 'Assam', district: 'Kokrajhar', latitude: 26.4014, longitude: 90.2716 },

  // Arunachal Pradesh (7 Hubs)
  { id: '16', hub_name: 'Itanagar State Relief Center', hub_code: 'HUB-ARU-001', state: 'Arunachal Pradesh', district: 'Papum Pare', latitude: 27.0844, longitude: 93.6053 },
  { id: '17', hub_name: 'Pasighat Logistics Post', hub_code: 'HUB-ARU-002', state: 'Arunachal Pradesh', district: 'East Siang', latitude: 28.0665, longitude: 95.3267 },
  { id: '18', hub_name: 'Tawang High-Altitude Depot', hub_code: 'HUB-ARU-003', state: 'Arunachal Pradesh', district: 'Tawang', latitude: 27.5861, longitude: 91.8653 },
  { id: '19', hub_name: 'Ziro Cold Storage Hub', hub_code: 'HUB-ARU-004', state: 'Arunachal Pradesh', district: 'Lower Subansiri', latitude: 27.5450, longitude: 93.8290 },
  { id: '20', hub_name: 'Tezu Relief Depot', hub_code: 'HUB-ARU-005', state: 'Arunachal Pradesh', district: 'Lohit', latitude: 27.9256, longitude: 96.1627 },
  { id: '21', hub_name: 'Bomdila Mountain Warehouse', hub_code: 'HUB-ARU-006', state: 'Arunachal Pradesh', district: 'West Kameng', latitude: 27.2645, longitude: 92.4231 },
  { id: '22', hub_name: 'Aalo Transit Base', hub_code: 'HUB-ARU-007', state: 'Arunachal Pradesh', district: 'West Siang', latitude: 28.1691, longitude: 94.7981 },

  // Meghalaya (6 Hubs)
  { id: '23', hub_name: 'Shillong Central Medical Depot', hub_code: 'HUB-MEG-001', state: 'Meghalaya', district: 'East Khasi Hills', latitude: 25.5788, longitude: 91.8933 },
  { id: '24', hub_name: 'Jowai Highway Hub', hub_code: 'HUB-MEG-002', state: 'Meghalaya', district: 'West Jaintia Hills', latitude: 25.4524, longitude: 92.2034 },
  { id: '25', hub_name: 'Tura West Garo Depot', hub_code: 'HUB-MEG-003', state: 'Meghalaya', district: 'West Garo Hills', latitude: 25.5144, longitude: 90.2034 },
  { id: '26', hub_name: 'Nongpoh Transit Base', hub_code: 'HUB-MEG-004', state: 'Meghalaya', district: 'Ri-Bhoi', latitude: 25.9038, longitude: 91.8797 },
  { id: '27', hub_name: 'Williamnagar Supply Store', hub_code: 'HUB-MEG-005', state: 'Meghalaya', district: 'East Garo Hills', latitude: 25.6047, longitude: 90.5989 },
  { id: '28', hub_name: 'Baghmara Border Point', hub_code: 'HUB-MEG-006', state: 'Meghalaya', district: 'South Garo Hills', latitude: 25.1866, longitude: 90.6374 },

  // Manipur (6 Hubs)
  { id: '29', hub_name: 'Imphal Central Depot', hub_code: 'HUB-MAN-001', state: 'Manipur', district: 'Imphal West', latitude: 24.8170, longitude: 93.9368 },
  { id: '30', hub_name: 'Churachandpur Valley Store', hub_code: 'HUB-MAN-002', state: 'Manipur', district: 'Churachandpur', latitude: 24.3337, longitude: 93.6738 },
  { id: '31', hub_name: 'Senapati Highway Hub', hub_code: 'HUB-MAN-003', state: 'Manipur', district: 'Senapati', latitude: 25.2678, longitude: 94.0167 },
  { id: '32', hub_name: 'Thoubal Food Depot', hub_code: 'HUB-MAN-004', state: 'Manipur', district: 'Thoubal', latitude: 24.6393, longitude: 93.9989 },
  { id: '33', hub_name: 'Ukhrul Hill Station Depot', hub_code: 'HUB-MAN-005', state: 'Manipur', district: 'Ukhrul', latitude: 25.1121, longitude: 94.3606 },
  { id: '34', hub_name: 'Jiribam Border Transit', hub_code: 'HUB-MAN-006', state: 'Manipur', district: 'Jiribam', latitude: 24.8028, longitude: 93.1239 },

  // Mizoram (5 Hubs)
  { id: '35', hub_name: 'Aizawl State Storage', hub_code: 'HUB-MIZ-001', state: 'Mizoram', district: 'Aizawl', latitude: 23.7271, longitude: 92.7176 },
  { id: '36', hub_name: 'Lunglei South Hub', hub_code: 'HUB-MIZ-002', state: 'Mizoram', district: 'Lunglei', latitude: 22.8878, longitude: 92.7388 },
  { id: '37', hub_name: 'Champhai Border Depot', hub_code: 'HUB-MIZ-003', state: 'Mizoram', district: 'Champhai', latitude: 23.4735, longitude: 93.3283 },
  { id: '38', hub_name: 'Kolasib Highway Transit', hub_code: 'HUB-MIZ-004', state: 'Mizoram', district: 'Kolasib', latitude: 24.2244, longitude: 92.6784 },
  { id: '39', hub_name: 'Serchhip Supply Depot', hub_code: 'HUB-MIZ-005', state: 'Mizoram', district: 'Serchhip', latitude: 23.3414, longitude: 92.8504 },

  // Nagaland (5 Hubs)
  { id: '40', hub_name: 'Kohima State Central Depot', hub_code: 'HUB-NAG-001', state: 'Nagaland', district: 'Kohima', latitude: 25.6751, longitude: 94.1086 },
  { id: '41', hub_name: 'Dimapur Railway Logistics Hub', hub_code: 'HUB-NAG-002', state: 'Nagaland', district: 'Dimapur', latitude: 25.9094, longitude: 93.7266 },
  { id: '42', hub_name: 'Mokokchung Transit Store', hub_code: 'HUB-NAG-003', state: 'Nagaland', district: 'Mokokchung', latitude: 26.3256, longitude: 94.5161 },
  { id: '43', hub_name: 'Tuensang Eastern Hub', hub_code: 'HUB-NAG-004', state: 'Nagaland', district: 'Tuensang', latitude: 26.2737, longitude: 94.8252 },
  { id: '44', hub_name: 'Mon Border Depot', hub_code: 'HUB-NAG-005', state: 'Nagaland', district: 'Mon', latitude: 26.7410, longitude: 95.0594 },

  // Tripura (4 Hubs)
  { id: '45', hub_name: 'Agartala Central Depot', hub_code: 'HUB-TRI-001', state: 'Tripura', district: 'West Tripura', latitude: 23.8315, longitude: 91.2868 },
  { id: '46', hub_name: 'Dharmanagar North Hub', hub_code: 'HUB-TRI-002', state: 'Tripura', district: 'North Tripura', latitude: 24.3768, longitude: 92.1678 },
  { id: '47', hub_name: 'Udaipur South Depot', hub_code: 'HUB-TRI-003', state: 'Tripura', district: 'Gomati', latitude: 23.5336, longitude: 91.4883 },
  { id: '48', hub_name: 'Ambassa Relief Post', hub_code: 'HUB-TRI-004', state: 'Tripura', district: 'Dhalai', latitude: 23.9268, longitude: 91.8569 },

  // Sikkim (2 Hubs)
  { id: '49', hub_name: 'Gangtok State Relief Hub', hub_code: 'HUB-SIK-001', state: 'Sikkim', district: 'East Sikkim', latitude: 27.3389, longitude: 88.6065 },
  { id: '50', hub_name: 'Mangan North Sikkim High-Altitude Depot', hub_code: 'HUB-SIK-002', state: 'Sikkim', district: 'North Sikkim', latitude: 27.5042, longitude: 88.5303 },
];

export default function Home() {
  const { user, profile, isNodalOfficer, nodalOfficer } = useAuth();
  const { currentView, setCurrentView, mapFocusTarget, focusOnMap } = useNav();
  const userLocation = useUserLocation();

  const [hubs, setHubs] = useState(FALLBACK_50_HUBS);
  const [hazards, setHazards] = useState([]);
  const [shipmentsList, setShipmentsList] = useState([]);
  const [activeTileStyle, setActiveTileStyle] = useState('streets');

  // Route Planning State
  const [originHubId, setOriginHubId] = useState('');
  const [destHubId, setDestHubId] = useState('');
  const [calculatingRoute, setCalculatingRoute] = useState(false);
  const [multiRouteData, setMultiRouteData] = useState(null);
  const [activeRouteIndex, setActiveRouteIndex] = useState(0);
  const [corridorHazards, setCorridorHazards] = useState([]);
  const [routeBounds, setRouteBounds] = useState(null);
  const [routingError, setRoutingError] = useState('');

  // Hazard Reporting & Map Picker States
  const [hazardModalOpen, setHazardModalOpen] = useState(false);
  const [isPickingLocation, setIsPickingLocation] = useState(false);
  const [hazardCoords, setHazardCoords] = useState(null);
  const [savedFormData, setSavedFormData] = useState(null);

  // Transit Journey & Driver Duty States
  const [activeJourney, setActiveJourney] = useState(null);
  const [startingJourney, setStartingJourney] = useState(false);
  const [terminatingJourney, setTerminatingJourney] = useState(false);
  const [markingDelivered, setMarkingDelivered] = useState(false);
  const [journeyNotice, setJourneyNotice] = useState(null);
  const [bulletinNotices, setBulletinNotices] = useState([]);
  const [isManifestModalOpen, setIsManifestModalOpen] = useState(false);

  // Load any rejected offline hazard reports on mount & listen for new AI rejections
  useEffect(() => {
    async function loadRejectedBulletins() {
      try {
        const rejected = await getOfflineRejectedReports();
        if (rejected && rejected.length > 0) {
          const formatted = rejected.map(r => ({
            id: r.id,
            title: r.title || r.notes?.slice(0, 40) || 'Hazard Report',
            location: `${r.district ? r.district + ', ' : ''}${r.state || 'NER Corridor'}`,
            status: 'rejected',
            reason: r.rejection_reason || 'Media evidence or description context did not pass authenticity verification.',
            created_at: r.created_at
          }));
          setBulletinNotices(formatted);
        }
      } catch (err) {
        console.warn('Failed to load offline rejected reports:', err);
      }
    }

    loadRejectedBulletins();

    const handleHazardRejected = (e) => {
      if (e.detail) {
        setBulletinNotices(prev => {
          if (prev.some(item => item.id === e.detail.id)) return prev;
          return [e.detail, ...prev];
        });
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('ner_offline_hazard_rejected', handleHazardRejected);
      return () => {
        window.removeEventListener('ner_offline_hazard_rejected', handleHazardRejected);
      };
    }
  }, []);

  const handleDismissBulletin = async (id) => {
    await dismissOfflineRejectedReport(id);
    setBulletinNotices(prev => prev.filter(n => n.id !== id));
  };

  // Mobile View Segmented Tab State
  const [mobileTab, setMobileTab] = useState('route');

  // Check active transit journey on mount
  useEffect(() => {
    async function loadActiveJourney() {
      if (!user?.id) {
        setActiveJourney(null);
        return;
      }
      try {
        const { data, error } = await supabase
          .from('shipments')
          .select('*')
          .eq('driver_id', user.id)
          .in('status', ['IN_TRANSIT', 'in_transit', 'ACTIVE', 'active'])
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!error && data) {
          setActiveJourney(data);
          if (userLocation?.status === 'idle' && userLocation?.startTracking) {
            userLocation.startTracking();
          }
          return;
        }
      } catch (e) {
        console.warn('Active journey check notice:', e);
      }

      if (typeof window !== 'undefined') {
        try {
          const cached = localStorage.getItem('ner_active_transit_journey') || localStorage.getItem('ner_active_journey');
          if (cached) {
            const parsed = JSON.parse(cached);
            if (parsed && (parsed.status === 'IN_TRANSIT' || parsed.status === 'in_transit') && (!parsed.driver_id || parsed.driver_id === user.id)) {
              setActiveJourney(parsed);
              if (userLocation?.status === 'idle' && userLocation?.startTracking) {
                userLocation.startTracking();
              }
            }
          }
        } catch (err) {}
      }
    }
    loadActiveJourney();
  }, [user?.id]);

  // 1. Fetch Shipments with Dexie + LocalStorage fallbacks
  const fetchAllShipments = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('shipments')
        .select('*')
        .order('created_at', { ascending: false });

      let combined = Array.isArray(data) ? [...data] : [];

      // Check Dexie IndexedDB for offline shipments
      try {
        const offlineList = await db.shipments.toArray();
        if (Array.isArray(offlineList) && offlineList.length > 0) {
          offlineList.forEach(off => {
            if (!combined.some(s => s.id === off.id || (off.tracking_code && s.tracking_code === off.tracking_code))) {
              combined.unshift(off);
            }
          });
        }
      } catch (dexErr) {}

      // Check localStorage for any local active journey
      if (typeof window !== 'undefined') {
        try {
          const cached = localStorage.getItem('ner_active_journey') || localStorage.getItem('ner_active_transit_journey');
          if (cached) {
            const parsed = JSON.parse(cached);
            if (parsed && parsed.tracking_code) {
              const alreadyExists = combined.some(s => 
                s.tracking_code === parsed.tracking_code || (parsed.id && s.id === parsed.id)
              );
              if (!alreadyExists) {
                combined.unshift(parsed);
              }
            }
          }
        } catch (e) {}
      }

      // Filter out permanently deleted shipments
      if (typeof window !== 'undefined') {
        try {
          const delCache = JSON.parse(sessionStorage.getItem('ner_deleted_shipments') || '[]');
          combined = combined.filter(s => !delCache.includes(s.id) && !delCache.includes(s.tracking_code));
        } catch (e) {}
      }

      setShipmentsList(combined);
    } catch (err) {
      console.warn('Shipments fetch notice:', err);
    }
  }, []);

  // 2. Fetch Hazards with Dexie fallback
  const fetchAllHazards = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('road_hazards')
        .select('*')
        .order('created_at', { ascending: false });

      let combined = Array.isArray(data) ? [...data] : [];

      // Check Dexie IndexedDB for offline queued hazards
      try {
        const offlineHazards = await db.offline_hazard_queue.where('synced').equals(0).toArray();
        if (Array.isArray(offlineHazards) && offlineHazards.length > 0) {
          offlineHazards.forEach(offH => {
            if (!combined.some(h => h.id === offH.id)) {
              combined.unshift(offH);
            }
          });
        }
      } catch (e) {}

      // Filter out permanently deleted hazards
      if (typeof window !== 'undefined') {
        try {
          const delCache = JSON.parse(sessionStorage.getItem('ner_deleted_hazards') || '[]');
          combined = combined.filter(h => !delCache.includes(h.id));
        } catch (e) {}
      }

      if (combined.length > 0) {
        setHazards(combined);
      } else {
        let defaultMocks = [
          { id: 'hz1', title: 'Landslide on NH-27 (Nagaon Bypass)', hazard_type: 'landslide', severity: 'critical', latitude: 26.345, longitude: 92.684, status: 'active', state: 'Assam' },
          { id: 'hz2', title: 'Road Repair near Imphal-Churachandpur', hazard_type: 'road_damage', severity: 'medium', latitude: 24.580, longitude: 93.810, status: 'active', state: 'Manipur' }
        ];
        if (typeof window !== 'undefined') {
          try {
            const delCache = JSON.parse(sessionStorage.getItem('ner_deleted_hazards') || '[]');
            defaultMocks = defaultMocks.filter(h => !delCache.includes(h.id));
          } catch (e) {}
        }
        setHazards(defaultMocks);
      }
    } catch (err) {
      console.warn('Hazards fetch notice:', err);
      try {
        const offlineHazards = await db.road_hazards.toArray();
        if (offlineHazards && offlineHazards.length > 0) {
          setHazards(offlineHazards);
        }
      } catch (e) {}
    }
  }, []);

  // Synchronized Realtime Subscriptions & Polling
  useEffect(() => {
    fetchAllHazards();
    fetchAllShipments();

    // Supabase Realtime channel for live updates
    const channel = supabase
      .channel('public:home_realtime_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'road_hazards' }, () => {
        fetchAllHazards();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shipments' }, () => {
        fetchAllShipments();
      })
      .subscribe();

    // 4-second polling fallback for zero-latency sync across tabs
    const pollTimer = setInterval(() => {
      fetchAllHazards();
      fetchAllShipments();
    }, 4000);

    const handleReloadHazards = () => fetchAllHazards();
    const handleReloadShipments = () => fetchAllShipments();

    if (typeof window !== 'undefined') {
      window.addEventListener('ner_hazard_reported', handleReloadHazards);
      window.addEventListener('ner_hazard_deleted', handleReloadHazards);
      window.addEventListener('ner_journey_started', handleReloadShipments);
      window.addEventListener('ner_journey_terminated', handleReloadShipments);
      window.addEventListener('ner_journey_delivered', handleReloadShipments);
      window.addEventListener('ner_journey_deleted', handleReloadShipments);

      return () => {
        supabase.removeChannel(channel);
        clearInterval(pollTimer);
        window.removeEventListener('ner_hazard_reported', handleReloadHazards);
        window.removeEventListener('ner_hazard_deleted', handleReloadHazards);
        window.removeEventListener('ner_journey_started', handleReloadShipments);
        window.removeEventListener('ner_journey_terminated', handleReloadShipments);
        window.removeEventListener('ner_journey_delivered', handleReloadShipments);
        window.removeEventListener('ner_journey_deleted', handleReloadShipments);
      };
    }
  }, [fetchAllHazards, fetchAllShipments]);

  // Automatic Store-and-Forward Sync whenever network connectivity resumes
  useEffect(() => {
    async function handleOnlineSync() {
      try {
        // 1. Sync offline hazards with Gemini AI Verification
        const hazardSync = await syncOfflineHazardsWithAiVerification((result) => {
          if (result.status === 'rejected') {
            setBulletinNotices(prev => {
              if (prev.some(item => item.id === result.id)) return prev;
              return [result, ...prev];
            });
          }
        });

        // 2. Sync pending offline convoys / dispatches
        const shipmentSync = await syncPendingShipmentsWhenOnline(async (payload) => {
          const res = await supabase.from('shipments').insert([payload]).select().maybeSingle();
          return res?.data;
        });

        if (hazardSync.syncedCount > 0 || shipmentSync.syncedCount > 0) {
          fetchAllHazards();
          fetchAllShipments();
          setJourneyNotice({
            type: 'success',
            message: `✅ Network Restored: Verified & synced ${hazardSync.syncedCount} hazard(s) and ${shipmentSync.syncedCount} convoy(s) with cloud server.`,
          });
        }
      } catch (err) {
        console.warn('Auto-sync notice:', err);
      }
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('online', handleOnlineSync);
      if (navigator.onLine) {
        handleOnlineSync();
      }
      return () => {
        window.removeEventListener('online', handleOnlineSync);
      };
    }
  }, [fetchAllHazards, fetchAllShipments]);

  // Live computed metrics matching ShipmentsView and HazardsView exactly:
  const inTransitConvoysCount = useMemo(() => {
    return shipmentsList.filter((s) => {
      const st = (s.status || '').toLowerCase();
      return st === 'in_transit' || st === 'in-transit' || st === 'active';
    }).length;
  }, [shipmentsList]);

  const activeHazardsCount = useMemo(() => {
    return hazards.filter(h => (h.status || '').toLowerCase() !== 'resolved').length;
  }, [hazards]);

  const criticalHazardsCount = useMemo(() => {
    return hazards.filter(h => (h.status || '').toLowerCase() !== 'resolved' && (h.severity || '').toLowerCase() === 'critical').length;
  }, [hazards]);

  // Continuous Telemetry Sync during active journey
  useEffect(() => {
    if (!activeJourney || !userLocation?.coords || !user?.id) return;

    const interval = setInterval(async () => {
      try {
        const [lat, lng] = Array.isArray(userLocation.coords) 
          ? userLocation.coords 
          : [userLocation.coords.lat, userLocation.coords.lng];

        if (!lat || !lng || isNaN(lat) || isNaN(lng)) return;

        await supabase
          .from('driver_profiles')
          .update({
            current_latitude: lat,
            current_longitude: lng,
            is_active_duty: true,
            last_ping: new Date().toISOString()
          })
          .eq('id', user.id);

        if (activeJourney.id) {
          await supabase
            .from('shipments')
            .update({
              current_lat: lat,
              current_lng: lng,
              updated_at: new Date().toISOString()
            })
            .eq('id', activeJourney.id);
        }
      } catch (err) {
        console.warn('Telemetry ping sync notice:', err);
      }
    }, 12000);

    return () => clearInterval(interval);
  }, [activeJourney, userLocation?.coords, user?.id]);

  // Global event listener for Pin Hazard Location and Open Hazard Modal
  useEffect(() => {
    const handleGlobalStartMapPick = (e) => {
      const formData = e.detail;
      setSavedFormData(formData);
      setCurrentView('command');
      setHazardModalOpen(false);
      setIsPickingLocation(true);
    };

    const handleOpenHazardModal = () => {
      setHazardModalOpen(true);
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('ner_start_map_pick', handleGlobalStartMapPick);
      window.addEventListener('ner_open_hazard_modal', handleOpenHazardModal);
      return () => {
        window.removeEventListener('ner_start_map_pick', handleGlobalStartMapPick);
        window.removeEventListener('ner_open_hazard_modal', handleOpenHazardModal);
      };
    }
  }, [setCurrentView]);

  // Handler: Open Pre-Dispatch Manifest Modal
  const handleOpenManifestModal = () => {
    setJourneyNotice(null);
    setRoutingError('');

    if (!originHubId || !destHubId) {
      setRoutingError('Please select both Origin and Destination supply facilities.');
      return;
    }

    if (!user?.id) {
      setRoutingError('Please log in with a Driver or Field account to initiate transit dispatch.');
      return;
    }

    setIsManifestModalOpen(true);
  };

  // Handler: Manifest Successfully Dispatched from Modal (Online or Offline)
  const handleManifestDispatched = (shipmentRecord) => {
    setActiveJourney(shipmentRecord);
    const isOffline = shipmentRecord?.is_offline_dispatched || (typeof navigator !== 'undefined' && !navigator.onLine);
    setJourneyNotice({ 
      type: 'success', 
      message: isOffline 
        ? `📡 Offline Convoy Dispatched: ${shipmentRecord.tracking_code} (Queued in IndexedDB)` 
        : `🚀 Convoy journey active: ${shipmentRecord.tracking_code}` 
    });

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ner_journey_started', { detail: shipmentRecord }));
    }
  };

  // Handler: Mark Journey as Delivered from Driver Portal
  const handleMarkJourneyDelivered = async () => {
    if (!activeJourney && !user?.id) return;
    setMarkingDelivered(true);
    setJourneyNotice(null);

    try {
      if (activeJourney.id) {
        await supabase
          .from('shipments')
          .update({
            status: 'DELIVERED',
            updated_at: new Date().toISOString()
          })
          .eq('id', activeJourney.id);
      }

      if (user?.id) {
        await supabase
          .from('driver_profiles')
          .update({
            is_active_duty: false,
            last_ping: new Date().toISOString()
          })
          .eq('id', user.id);
      }

      setActiveJourney(null);
      setJourneyNotice({ type: 'success', message: '✅ Relief cargo delivered safely!' });

      if (typeof window !== 'undefined') {
        localStorage.removeItem('ner_active_transit_journey');
        localStorage.removeItem('ner_active_journey');
        window.dispatchEvent(new CustomEvent('ner_journey_delivered', { detail: activeJourney }));
      }
    } catch (err) {
      console.error('Error marking delivered:', err);
    } finally {
      setMarkingDelivered(false);
    }
  };

  // Handler: Terminate Journey
  const handleDeleteJourney = async () => {
    if (!activeJourney && !user?.id) return;
    setTerminatingJourney(true);
    try {
      if (activeJourney?.id) {
        await supabase
          .from('shipments')
          .update({ status: 'TERMINATED', updated_at: new Date().toISOString() })
          .eq('id', activeJourney.id);
      }

      if (user?.id) {
        await supabase
          .from('driver_profiles')
          .update({ is_active_duty: false, last_ping: new Date().toISOString() })
          .eq('id', user.id);
      }

      setActiveJourney(null);
      setJourneyNotice({ type: 'info', message: 'Transit journey terminated and driver telemetry halted.' });

      if (typeof window !== 'undefined') {
        localStorage.removeItem('ner_active_transit_journey');
        localStorage.removeItem('ner_active_journey');
        window.dispatchEvent(new CustomEvent('ner_journey_terminated', { detail: activeJourney }));
      }
    } catch (err) {
      console.error('Error terminating journey:', err);
    } finally {
      setTerminatingJourney(false);
    }
  };

  // Selected Origin & Dest Objects
  const originHub = useMemo(() => {
    if (!originHubId) return null;
    if (originHubId === 'CURRENT_LOCATION') {
      const coords = userLocation.coords || [26.1445, 91.7362];
      return {
        id: 'CURRENT_LOCATION',
        hub_name: 'Current Live GPS Location',
        hub_code: 'MY-GPS',
        state: 'Assam',
        latitude: Array.isArray(coords) ? coords[0] : coords.lat,
        longitude: Array.isArray(coords) ? coords[1] : coords.lng,
      };
    }
    return hubs.find((h) => h.hub_code === originHubId || h.id === originHubId) || null;
  }, [originHubId, userLocation.coords, hubs]);

  const destHub = useMemo(() => {
    if (!destHubId) return null;
    return hubs.find((h) => h.hub_code === destHubId || h.id === destHubId) || null;
  }, [destHubId, hubs]);

  // If user picks CURRENT_LOCATION, auto-start location tracking if idle
  const handleOriginChange = (val) => {
    setOriginHubId(val);
    if (val === 'CURRENT_LOCATION' && userLocation.status === 'idle') {
      userLocation.startTracking();
    }
  };

  // Route calculation
  const calculateTacticalRoutes = useCallback(async (startHub = originHub, endHub = destHub) => {
    setRoutingError('');
    if (!startHub || !endHub) {
      setRoutingError('Please select both Origin and Destination supply hubs.');
      return;
    }

    if (startHub.id === endHub.id || startHub.hub_code === endHub.hub_code) {
      setRoutingError('Origin and Destination cannot be the same facility.');
      return;
    }

    setCalculatingRoute(true);
    const start = [parseFloat(startHub.latitude), parseFloat(startHub.longitude)];
    const end = [parseFloat(endHub.latitude), parseFloat(endHub.longitude)];

    try {
      const result = await calculateSafestMultiRoutes(start, end, hazards);
      if (result.success && result.allRoutes?.length > 0) {
        setMultiRouteData(result);
        const defaultIdx = typeof result.safestRouteIndex === 'number' && result.safestRouteIndex >= 0 ? result.safestRouteIndex : 0;
        setActiveRouteIndex(defaultIdx);

        const allCorridorCoords = result.allRoutes.flatMap((r) => r.coordinates || []);
        if (allCorridorCoords.length > 1) {
          setRouteBounds(allCorridorCoords);
        }

        const chosenRoute = result.allRoutes[defaultIdx] || result.allRoutes[0];
        setCorridorHazards(chosenRoute.flaggedHazards || []);
        setRoutingError('');
      } else {
        setMultiRouteData(null);
        setRouteBounds(null);
        setCorridorHazards([]);
        setRoutingError(result?.error || 'Offline Notice: Road corridor geometry is not cached on this device. Please reconnect to internet once to calculate and cache this route.');
      }
    } catch (err) {
      console.warn('Route calculation notice:', err);
      setMultiRouteData(null);
      setRouteBounds(null);
      setCorridorHazards([]);
      setRoutingError('Offline Notice: Road corridor geometry is not cached on this device. Please reconnect to internet once to calculate and cache this route.');
    } finally {
      setCalculatingRoute(false);
    }
  }, [originHub, destHub, hazards]);

  const handleSelectRouteIndex = useCallback((idx) => {
    if (!multiRouteData?.allRoutes?.[idx]) return;
    setActiveRouteIndex(idx);
    const chosen = multiRouteData.allRoutes[idx];
    setCorridorHazards(chosen.flaggedHazards || []);
  }, [multiRouteData]);

  useEffect(() => {
    if (multiRouteData?.allRoutes && multiRouteData.allRoutes.length > 0) {
      const rescored = rescoreRoutesWithHazards(multiRouteData.allRoutes, hazards);
      if (rescored && rescored.allRoutes) {
        setMultiRouteData(rescored);
        const currentActive = rescored.allRoutes[activeRouteIndex] || rescored.allRoutes[0];
        setCorridorHazards(currentActive?.flaggedHazards || []);
      }
    }
  }, [hazards]);

  const handleResetRoute = () => {
    setOriginHubId('');
    setDestHubId('');
    setMultiRouteData(null);
    setActiveRouteIndex(0);
    setCorridorHazards([]);
    setRouteBounds(null);
    setRoutingError('');
  };

  const activeRoute = multiRouteData?.allRoutes?.[activeRouteIndex] || multiRouteData?.primaryRoute;

  // AI Chat callbacks
  const handleChatSelectHazard = useCallback((hazardIdentifier) => {
    setCurrentView('command');
    const match = hazards.find(h => 
      h.id === hazardIdentifier || 
      (h.title && h.title.toLowerCase().includes(String(hazardIdentifier).toLowerCase())) ||
      (h.hazard_type && h.hazard_type.toLowerCase().includes(String(hazardIdentifier).toLowerCase()))
    );
    if (match && match.latitude && match.longitude) {
      focusOnMap([parseFloat(match.latitude), parseFloat(match.longitude)], 15, match);
    }
  }, [hazards, focusOnMap, setCurrentView]);

  const handleChatSelectHub = useCallback((hubIdentifier) => {
    setCurrentView('command');
    const match = hubs.find(h => 
      h.hub_code === hubIdentifier || 
      h.id === hubIdentifier || 
      (h.hub_name && h.hub_name.toLowerCase().includes(String(hubIdentifier).toLowerCase()))
    );
    if (match && match.latitude && match.longitude) {
      focusOnMap([parseFloat(match.latitude), parseFloat(match.longitude)], 14, match);
    }
  }, [hubs, focusOnMap, setCurrentView]);

  return (
    <div className="min-h-screen bg-[#f4f7fb] dark:bg-slate-950 text-slate-800 dark:text-slate-100 py-4 px-3 sm:px-5 lg:px-6 space-y-4 sm:space-y-5 font-sans flex flex-col">
      
      {currentView === 'hazards' ? (
        <HazardsView 
          hazards={hazards} 
          onSelectHazardOnMap={(hazard) => {
            focusOnMap([parseFloat(hazard.latitude), parseFloat(hazard.longitude)], 15, hazard);
          }} 
        />
      ) : currentView === 'hubs' ? (
        <HubsView 
          hubs={hubs} 
          onSelectHubOnMap={(hub) => {
            focusOnMap([parseFloat(hub.latitude), parseFloat(hub.longitude)], 14, hub);
          }} 
        />
      ) : currentView === 'shipments' ? (
        <ShipmentsView 
          shipments={shipmentsList}
          onSelectShipmentOnMap={(shipment) => {
            if (isNodalOfficer || profile?.role === 'nodal_officer') {
              focusOnMap([parseFloat(shipment.current_lat), parseFloat(shipment.current_lng)], 14, shipment);
            }
          }} 
        />
      ) : currentView === 'settings' ? (
        <SettingsView />
      ) : (
        <>
          {/* ========================================================================= */}
          {/* 1. TOP HERO HEADER BANNER WITH REAL BACKGROUND IMAGE FROM /header background.jpeg */}
          {/* ========================================================================= */}
          <div className="relative rounded-2xl border border-slate-200/90 dark:border-slate-800 py-3 sm:py-3.5 px-4 sm:px-6 shadow-[0_4px_20px_rgba(0,0,0,0.03)] overflow-hidden bg-slate-900/10">
            
            {/* Background Image Layer */}
            <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
              <Image
                src="/header%20background.jpeg"
                alt="Himalayan Valley & Mountains"
                fill
                priority
                className="object-cover object-center opacity-100 dark:opacity-90 contrast-[1.08] brightness-[0.98]"
              />
              {/* Ultra-light gradient for pristine image visibility and crisp text legibility */}
              <div className="absolute inset-0 bg-gradient-to-r from-white/50 via-white/15 to-transparent dark:from-slate-950/75 dark:via-slate-950/30 dark:to-transparent pointer-events-none" />
              <div className="absolute inset-0 bg-gradient-to-t from-white/15 via-transparent to-transparent dark:from-slate-950/30 dark:via-transparent dark:to-transparent pointer-events-none" />
            </div>

            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 sm:gap-4 relative z-10">
              
              {/* Left Title & Subtitle */}
              <div className="space-y-1 max-w-xl bg-white/35 dark:bg-slate-900/45 py-2 px-3.5 rounded-xl backdrop-blur-[2px] border border-white/50 dark:border-slate-700/40">
                <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#0284c7]/15 dark:bg-cyan-500/20 text-[#0284c7] dark:text-cyan-400 border border-[#0284c7]/20 dark:border-cyan-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#0284c7] dark:bg-cyan-400 animate-pulse" />
                  <span className="text-[9px] sm:text-[10px] font-mono font-extrabold uppercase tracking-widest">
                    TACTICAL COMMAND CENTER
                  </span>
                </div>
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight leading-tight drop-shadow-sm">
                  Tactical Command & Convoy Center
                </h1>
                <p className="text-[11px] sm:text-xs text-slate-700 dark:text-slate-200 font-medium leading-normal drop-shadow-sm line-clamp-1 sm:line-clamp-none">
                  Real-time GIS multi-route planning, convoy telemetry, and hazard mitigation across 8 North-Eastern States.
                </p>
              </div>

              {/* Right Slogan & Live Clock Widget */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 lg:gap-5 shrink-0">
                <div className="text-right hidden sm:block bg-white/35 dark:bg-slate-900/45 px-3 py-1.5 rounded-xl backdrop-blur-[2px] border border-white/50 dark:border-slate-700/40">
                  <span className="text-xs font-serif italic text-slate-800 dark:text-slate-200 font-bold block drop-shadow-sm">
                    &ldquo;Better Intelligence, Safer Communities&rdquo;
                  </span>
                  <div className="w-10 h-0.5 bg-[#0284c7] rounded-full ml-auto mt-0.5" />
                </div>

                <LiveClockWidget />
              </div>

            </div>

          </div>

          {/* ========================================================================= */}
          {/* AI VERIFICATION BULLETIN BANNER (Offline Reports Rejection Feedback)       */}
          {/* ========================================================================= */}
          {bulletinNotices && bulletinNotices.length > 0 && (
            <div className="space-y-2.5">
              {bulletinNotices.map((notice) => (
                <div 
                  key={notice.id}
                  className="relative bg-gradient-to-r from-amber-500/15 via-rose-500/10 to-rose-500/15 border border-rose-400/50 dark:border-rose-500/50 rounded-2xl p-4 sm:p-4.5 shadow-md backdrop-blur-sm animate-in fade-in slide-in-from-top-2 duration-300"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3.5 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0 mt-0.5 border border-rose-500/30">
                        <ShieldAlert className="w-5 h-5" />
                      </div>
                      <div className="space-y-1.5 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-500/30">
                            ⚠️ AI Forensic Bulletin
                          </span>
                          <span className="text-xs font-mono text-slate-600 dark:text-slate-300 font-semibold">
                            {notice.location || 'NER Corridor'}
                          </span>
                        </div>
                        <h4 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                          Offline Hazard Report Not Approved: &ldquo;{notice.title || 'Road Hazard Report'}&rdquo;
                        </h4>
                        <div className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed bg-white/70 dark:bg-slate-900/70 p-3 rounded-xl border border-rose-200/60 dark:border-rose-900/50 mt-1">
                          <p className="font-semibold text-rose-700 dark:text-rose-300 flex items-center gap-1.5 mb-1">
                            <span>🔍 Forensic Verification Result:</span>
                          </p>
                          <p className="text-slate-800 dark:text-slate-200">
                            {notice.reason || 'The submitted imagery and textual context did not pass authenticity verification for automatic inclusion in the active safety grid.'}
                          </p>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 italic pt-0.5">
                          Note: Your report data remains preserved on this device in the local queue. You can submit a fresh report with clear photos and verified details when online.
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDismissBulletin(notice.id)}
                      className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors shrink-0"
                      title="Dismiss notice"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ========================================================================= */}
          {/* 2. SUMMARY METRICS ROW (3 Evenly Distributed Cards: Hubs, Hazards, Convoys) */}
          {/* ========================================================================= */}
          <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-3 gap-3 sm:gap-4">
            
            {/* Card 1: Strategic Hubs */}
            <div 
              onClick={() => setCurrentView('hubs')}
              className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-800 shadow-[0_2px_12px_rgba(0,0,0,0.02)] hover:shadow-md transition-all flex items-center justify-between group cursor-pointer"
            >
              <div className="flex items-center space-x-3.5 min-w-0">
                <div className="w-11 h-11 rounded-2xl bg-blue-50 dark:bg-blue-950/60 border border-blue-100 dark:border-blue-900 flex items-center justify-center text-[#0284c7] dark:text-cyan-400 shrink-0 group-hover:scale-105 transition-transform">
                  <Layers className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block truncate">
                    Strategic Hubs
                  </span>
                  <span className="text-2xl font-black text-slate-900 dark:text-white font-mono leading-none mt-0.5 block">
                    50
                  </span>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 truncate">
                    8 NER States Online
                  </p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-[#0284c7] group-hover:translate-x-0.5 transition-transform shrink-0" />
            </div>

            {/* Card 2: Active Hazards */}
            <div 
              onClick={() => setCurrentView('hazards')}
              className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-800 shadow-[0_2px_12px_rgba(0,0,0,0.02)] hover:shadow-md transition-all flex items-center justify-between group cursor-pointer"
            >
              <div className="flex items-center space-x-3.5 min-w-0">
                <div className="w-11 h-11 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-100 dark:border-rose-900 flex items-center justify-center text-rose-500 shrink-0 group-hover:scale-105 transition-transform">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block truncate">
                    Active Hazards
                  </span>
                  <span className="text-2xl font-black text-slate-900 dark:text-white font-mono leading-none mt-0.5 block">
                    {activeHazardsCount}
                  </span>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 truncate">
                    {criticalHazardsCount} Critical Roadblocks
                  </p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-rose-400 group-hover:translate-x-0.5 transition-transform shrink-0" />
            </div>

            {/* Card 3: Live Convoys */}
            <div 
              onClick={() => setCurrentView('shipments')}
              className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-800 shadow-[0_2px_12px_rgba(0,0,0,0.02)] hover:shadow-md transition-all flex items-center justify-between group cursor-pointer"
            >
              <div className="flex items-center space-x-3.5 min-w-0">
                <div className="w-11 h-11 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-100 dark:border-emerald-900 flex items-center justify-center text-emerald-600 shrink-0 group-hover:scale-105 transition-transform">
                  <Truck className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block truncate">
                    Live Convoys
                  </span>
                  <span className="text-2xl font-black text-slate-900 dark:text-white font-mono leading-none mt-0.5 block">
                    {inTransitConvoysCount}
                  </span>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 truncate">
                    {inTransitConvoysCount > 0 ? `${inTransitConvoysCount} En Route • 0 Halted` : '0 En Route • 0 Halted'}
                  </p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-emerald-500 group-hover:translate-x-0.5 transition-transform shrink-0" />
            </div>

          </div>

          {/* ========================================================================= */}
          {/* 3. 3-COLUMN WORKBENCH (Route Navigator, Interactive Map, Telemetry)        */}
          {/* ========================================================================= */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        
            {/* COLUMN 1: LEFT ROUTE NAVIGATOR */}
            <div className={`order-2 lg:order-1 lg:col-span-3 space-y-3.5 ${mobileTab === 'route' ? 'flex flex-col' : 'hidden lg:flex lg:flex-col'}`}>
              <RouteNavigator
                hubs={hubs}
                originHubId={originHubId}
                destHubId={destHubId}
                onSelectOrigin={handleOriginChange}
                onSelectDestination={setDestHubId}
                onCalculateRoutes={() => calculateTacticalRoutes(originHub, destHub)}
                onResetRoutes={handleResetRoute}
                calculatingRoute={calculatingRoute}
                routingError={routingError}
                journeyNotice={journeyNotice}
                onDismissJourneyNotice={() => setJourneyNotice(null)}
                routes={multiRouteData?.allRoutes || []}
                activeRouteIndex={activeRouteIndex}
                onSelectRouteIndex={handleSelectRouteIndex}
                isTransitActive={!!activeJourney}
                activeConvoyData={activeJourney}
                onStartTransit={handleOpenManifestModal}
                onMarkDelivered={handleMarkJourneyDelivered}
                onTerminateTransit={handleDeleteJourney}
                markingDelivered={markingDelivered}
                terminatingJourney={terminatingJourney}
                isGpsActive={userLocation.status === 'tracking'}
              />
            </div>

            {/* COLUMN 2: CENTER INTERACTIVE MAP VIEW */}
            <div className="order-1 lg:order-2 lg:col-span-6 space-y-3 flex flex-col">
              
              {/* Section Header */}
              <div className="flex items-center justify-between px-1">
                <h2 className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center space-x-2">
                  <div className="w-5 h-5 rounded-md bg-blue-50 dark:bg-blue-950/60 flex items-center justify-center text-[#0284c7]">
                    <MapIcon className="w-3.5 h-3.5" />
                  </div>
                  <span>Interactive Map View</span>
                </h2>
                <div className="flex items-center space-x-3 text-[10px] font-mono text-slate-500 dark:text-slate-400">
                  <div className="flex items-center space-x-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse" />
                    <span className="font-bold">GIS TELEMETRY LIVE</span>
                  </div>
                </div>
              </div>

              {/* Map Container */}
              <div className="bg-white dark:bg-slate-900 rounded-3xl p-2 sm:p-2.5 border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
                <TacticalHubMap
                  height="490px"
                  activeTileStyle={activeTileStyle}
                  multiRouteData={multiRouteData}
                  activeRouteIndex={activeRouteIndex}
                  onSelectRoute={handleSelectRouteIndex}
                  routeBounds={routeBounds}
                  originHub={originHub}
                  destHub={destHub}
                  hazards={hazards}
                  userLocation={userLocation}
                  isNodalOfficer={isNodalOfficer}
                  isPickingLocation={isPickingLocation}
                  focusTarget={mapFocusTarget}
                  onLocationPick={(coords) => {
                    setHazardCoords(coords);
                    setIsPickingLocation(false);
                    setHazardModalOpen(true);
                  }}
                  pickedCoords={hazardCoords}
                  onCancelPick={() => {
                    setIsPickingLocation(false);
                    setHazardModalOpen(true);
                  }}
                  onSelectOrigin={(hub) => {
                    setOriginHubId(hub.hub_code || hub.id);
                    if (destHubId && destHubId !== (hub.hub_code || hub.id)) {
                      calculateTacticalRoutes(hub, destHub);
                    }
                  }}
                  onSelectDest={(hub) => {
                    setDestHubId(hub.hub_code || hub.id);
                    if (originHubId && originHubId !== (hub.hub_code || hub.id)) {
                      calculateTacticalRoutes(originHub, hub);
                    }
                  }}
                />
              </div>

              {/* Mobile Segmented Control Bar */}
              <div className="flex lg:hidden items-center bg-slate-200/80 dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-300/80 dark:border-slate-800 text-xs font-mono font-bold shadow-xs">
                <button
                  type="button"
                  onClick={() => setMobileTab('route')}
                  className={`flex-1 py-2.5 px-2 rounded-xl text-center transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    mobileTab === 'route'
                      ? 'bg-[#0284c7] text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Route className="w-3.5 h-3.5" />
                  <span>Route</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMobileTab('telemetry')}
                  className={`flex-1 py-2.5 px-2 rounded-xl text-center transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    mobileTab === 'telemetry'
                      ? 'bg-[#0284c7] text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Activity className="w-3.5 h-3.5" />
                  <span>Telemetry</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMobileTab('hazards')}
                  className={`flex-1 py-2.5 px-2 rounded-xl text-center transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    mobileTab === 'hazards'
                      ? 'bg-[#0284c7] text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                  <span>Hazards</span>
                  {hazards.length > 0 && (
                    <span className="bg-rose-500 text-white text-[9px] px-1.5 py-0.2 rounded-full font-bold">
                      {hazards.length}
                    </span>
                  )}
                </button>
              </div>

            </div>

            {/* COLUMN 3: RIGHT CORRIDOR TELEMETRY PANEL */}
            <div className={`order-3 lg:col-span-3 space-y-3.5 ${mobileTab === 'telemetry' || mobileTab === 'hazards' ? 'flex flex-col' : 'hidden lg:flex lg:flex-col'}`}>
              
              <div className="bg-white dark:bg-slate-900 rounded-3xl p-4 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-3.5 font-sans">
                
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center space-x-2">
                    <div className="w-6 h-6 rounded-lg bg-blue-50 dark:bg-blue-950/60 flex items-center justify-center text-[#0284c7]">
                      <Radio className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-xs font-bold text-slate-900 dark:text-white">
                      Corridor Telemetry
                    </span>
                  </div>
                  {activeRoute && (
                    <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded border ${
                      activeRoute.isOfflineCached
                        ? 'text-cyan-700 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-950/60 border-cyan-200 dark:border-cyan-800'
                        : 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800'
                    }`}>
                      {activeRoute.isOfflineCached ? '⚡ OFFLINE CACHED' : 'LIVE'}
                    </span>
                  )}
                </div>

                {/* Segmented Layer Tabs: PRIMARY | SECONDARY | SATELLITE */}
                <div className="flex items-center space-x-1 bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200/90 dark:border-slate-800">
                  {['streets', 'topo', 'satellite'].map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setActiveTileStyle(t)}
                      className={`flex-1 py-1.5 px-2 rounded-lg text-[10px] font-bold uppercase transition-all cursor-pointer ${
                        activeTileStyle === t
                          ? 'bg-[#0284c7] text-white shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      {t === 'streets' ? 'PRIMARY' : t === 'topo' ? 'SECONDARY' : 'SATELLITE'}
                    </button>
                  ))}
                </div>

                {activeRoute ? (
                  <>
                    {/* TOTAL TRANSIT DISTANCE */}
                    <div className="space-y-1 pt-1">
                      <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                        TOTAL TRANSIT DISTANCE
                      </span>
                      <div className="flex items-center justify-between">
                        <span className="text-2xl font-black text-slate-900 dark:text-white font-mono">
                          {activeRoute.distanceKm} <span className="text-xs font-bold text-slate-500">KM</span>
                        </span>
                        <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-100 dark:border-blue-900 flex items-center justify-center text-[#0284c7] dark:text-cyan-400 shrink-0 shadow-2xs">
                          <Route className="w-4 h-4" />
                        </div>
                      </div>
                    </div>

                    {/* ESTIMATED ETA */}
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                        ESTIMATED ETA
                      </span>
                      <div className="flex items-center justify-between">
                        <span className="text-xl font-bold text-slate-900 dark:text-white font-mono">
                          {activeRoute.durationText}
                        </span>
                        <div className="w-8 h-8 rounded-xl bg-cyan-50 dark:bg-cyan-950/60 border border-cyan-100 dark:border-cyan-900 flex items-center justify-center text-cyan-600 dark:text-cyan-400 shrink-0 shadow-2xs">
                          <Clock className="w-4 h-4" />
                        </div>
                      </div>
                    </div>

                    {/* SAFE CORRIDOR INDEX (SCI) */}
                    <div className="space-y-1.5 pt-0.5 font-mono">
                      <div className="flex items-center justify-between text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">
                        <span>SAFE CORRIDOR INDEX (SCI)</span>
                        <span className={`px-1.5 py-0.2 rounded text-[9px] font-black ${
                          (activeRoute.sciScore ?? 10) < 25 
                            ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/30' 
                            : (activeRoute.sciScore ?? 10) < 50 
                              ? 'text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/30' 
                              : 'text-rose-600 dark:text-rose-400 bg-rose-500/10 border border-rose-500/30'
                        }`}>
                          {activeRoute.sciScore ?? 10} / 100 • {(activeRoute.sciScore ?? 10) < 25 ? 'OPTIMAL' : (activeRoute.sciScore ?? 10) < 50 ? 'CAUTION' : 'HIGH RISK'}
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden p-0.5 border border-slate-200 dark:border-slate-700">
                        <div 
                          className={`h-full rounded-full transition-all duration-500 ${
                            (activeRoute.sciScore ?? 10) < 25 
                              ? 'bg-gradient-to-r from-emerald-500 to-teal-400' 
                              : (activeRoute.sciScore ?? 10) < 50 
                                ? 'bg-gradient-to-r from-amber-500 to-yellow-400' 
                                : 'bg-gradient-to-r from-rose-500 to-red-600'
                          }`}
                          style={{ width: `${Math.max(8, Math.min(100, activeRoute.sciScore ?? 10))}%` }}
                        />
                      </div>
                    </div>

                    {/* LIVE WEATHER */}
                    {activeRoute.weather && (
                      <div className={`p-3 rounded-2xl border text-[11px] space-y-1.5 ${
                        activeRoute.weather.riskTier === 'critical_monsoon'
                          ? 'bg-rose-50/80 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-950 dark:text-rose-200'
                          : activeRoute.weather.riskTier === 'caution'
                            ? 'bg-amber-50/80 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-950 dark:text-amber-200'
                            : 'bg-blue-50/80 dark:bg-slate-800/80 border-blue-200 dark:border-slate-700 text-slate-800 dark:text-slate-200'
                      }`}>
                        <div className="flex items-center justify-between font-bold uppercase text-[10px]">
                          <span className="flex items-center space-x-1.5">
                            <span className="text-sm">{activeRoute.weather.weatherEmoji || '🌤️'}</span>
                            <span>LIVE WEATHER</span>
                          </span>
                          <span className="font-mono text-xs font-black">
                            {activeRoute.weather.avgTemperature}°C
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="font-bold text-slate-700 dark:text-slate-200">
                            {activeRoute.weather.dominantWeather || 'Variable Weather'}
                          </span>
                          <span className="font-mono font-bold text-[#0284c7] dark:text-cyan-400">
                            {activeRoute.weather.maxRainfallMm > 0 ? `🌧️ ${activeRoute.weather.maxRainfallMm} mm/h` : '☀️ 0 mm/h Rain'}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* GEOSPATIAL SAFETY AUDIT */}
                    <div className={`border rounded-2xl p-3 text-[11px] space-y-1.5 ${
                      (activeRoute.flaggedHazards?.length || 0) === 0
                        ? 'bg-emerald-50/90 dark:bg-emerald-950/50 border-emerald-300 dark:border-emerald-800 text-emerald-950 dark:text-emerald-200'
                        : 'bg-rose-50/90 dark:bg-rose-950/50 border-rose-300 dark:border-rose-800 text-rose-950 dark:text-rose-200'
                    }`}>
                      <div className="flex items-center justify-between font-bold uppercase text-[10px]">
                        <span className="flex items-center space-x-1">
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
                          <span>SAFETY AUDIT</span>
                        </span>
                        <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase border ${
                          (activeRoute.flaggedHazards?.length || 0) === 0
                            ? 'bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200 border-emerald-300'
                            : 'bg-rose-100 dark:bg-rose-900 text-rose-800 dark:text-rose-200 border-rose-300'
                        }`}>
                          {(activeRoute.flaggedHazards?.length || 0) === 0 ? '100% CLEAR' : 'HIGH RISK'}
                        </span>
                      </div>
                      {(activeRoute.flaggedHazards?.length || 0) > 0 ? (
                        <div className="text-[10px] text-rose-800 dark:text-rose-300 font-bold">
                          ⚠️ {activeRoute.flaggedHazards.length} danger perimeters along route.
                        </div>
                      ) : (
                        <div className="text-[10px] text-emerald-800 dark:text-emerald-300 leading-tight">
                          Zero active roadblocks or landslides detected along this route.
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="py-8 text-center text-slate-400 dark:text-slate-500 font-sans text-xs space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-blue-50/60 dark:bg-slate-800/60 border border-blue-100/80 dark:border-slate-700 flex items-center justify-center mx-auto text-[#0284c7]">
                      <Navigation className="w-6 h-6 rotate-45" />
                    </div>
                    <p className="font-medium text-slate-500 dark:text-slate-400 text-xs max-w-[200px] mx-auto leading-relaxed">
                      Select an Origin and Destination Hub to compute mountain transit distance & hazard telemetry.
                    </p>
                  </div>
                )}

              </div>

            </div>

          </div>
        </>
      )}

      {/* Hazard Report Modal */}
      {hazardModalOpen && (
        <ReportHazardModal
          isOpen={hazardModalOpen}
          initialCoords={hazardCoords}
          initialFormData={savedFormData}
          onStartMapPick={(currentFormData) => {
            setSavedFormData(currentFormData);
            setHazardModalOpen(false);
            setIsPickingLocation(true);
          }}
          onClose={() => {
            setHazardModalOpen(false);
            setHazardCoords(null);
            setSavedFormData(null);
            setIsPickingLocation(false);
          }}
          onSuccess={() => {
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('ner_hazard_reported'));
            }
          }}
          onHazardReported={() => {
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('ner_hazard_reported'));
            }
          }}
        />
      )}

      {/* Start Journey Modal */}
      {isManifestModalOpen && (
        <StartJourneyModal
          isOpen={isManifestModalOpen}
          onClose={() => setIsManifestModalOpen(false)}
          onSuccess={handleManifestDispatched}
          hubs={hubs}
          originHub={originHub}
          destHub={destHub}
          originHubId={originHubId}
          destHubId={destHubId}
          userLocation={userLocation}
          activeRoute={activeRoute}
          user={user}
          profile={profile}
        />
      )}

      {/* Tactical AI Floating Assistant */}
      <TacticalAiChatWidget 
        hazards={hazards}
        hubs={hubs}
        activeRoute={activeRoute}
        userLocation={userLocation}
        onSelectHazardOnMap={handleChatSelectHazard}
        onSelectHubOnMap={handleChatSelectHub}
      />

    </div>
  );
}
