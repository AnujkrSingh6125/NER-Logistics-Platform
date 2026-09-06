'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
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
  ChevronRight,
  RotateCcw,
  XCircle,
  Navigation,
  LocateFixed,
  Trash2
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { getHubsOffline, saveHubsOffline } from '@/lib/offlineDb';
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

const DEFAULT_HAZARDS = [];

export default function Home() {
  const { user, profile, isNodalOfficer, nodalOfficer } = useAuth();
  const { currentView, setCurrentView, mapFocusTarget, focusOnMap } = useNav();
  const userLocation = useUserLocation(); // Live browser GPS geolocation hook

  const [hubs, setHubs] = useState(FALLBACK_50_HUBS);
  const [hazards, setHazards] = useState([]);
  const [activeConvoysCount, setActiveConvoysCount] = useState(0);
  const [activeTileStyle, setActiveTileStyle] = useState('streets');

  // Route Planning State (Default empty so map strictly displays only hubs and hazards)
  const [originHubId, setOriginHubId] = useState('');
  const [destHubId, setDestHubId] = useState('');
  const [calculatingRoute, setCalculatingRoute] = useState(false);
  const [multiRouteData, setMultiRouteData] = useState(null);
  const [activeRouteIndex, setActiveRouteIndex] = useState(0);
  const [corridorHazards, setCorridorHazards] = useState([]);
  const [routeBounds, setRouteBounds] = useState(null);
  const [routingError, setRoutingError] = useState('');

  // ⚠️ Hazard Reporting & Interactive Map Picker States
  const [hazardModalOpen, setHazardModalOpen] = useState(false);
  const [isPickingLocation, setIsPickingLocation] = useState(false);
  const [hazardCoords, setHazardCoords] = useState(null);
  const [savedFormData, setSavedFormData] = useState(null);

  // 🚀 Transit Journey & Driver Duty States
  const [activeJourney, setActiveJourney] = useState(null);
  const [startingJourney, setStartingJourney] = useState(false);
  const [terminatingJourney, setTerminatingJourney] = useState(false);
  const [markingDelivered, setMarkingDelivered] = useState(false);
  const [journeyNotice, setJourneyNotice] = useState(null);
  const [isManifestModalOpen, setIsManifestModalOpen] = useState(false);

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

      // Check localStorage backup
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

  // Global event listener for Pin Hazard Location from any view
  useEffect(() => {
    const handleGlobalStartMapPick = (e) => {
      const formData = e.detail;
      setSavedFormData(formData);
      setCurrentView('command');
      setHazardModalOpen(false);
      setIsPickingLocation(true);
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('ner_start_map_pick', handleGlobalStartMapPick);
      return () => {
        window.removeEventListener('ner_start_map_pick', handleGlobalStartMapPick);
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

  // Handler: Manifest Successfully Dispatched from Modal
  const handleManifestDispatched = (shipmentRecord) => {
    setActiveJourney(shipmentRecord);
    setJourneyNotice({ type: 'success', message: `🚀 Convoy journey active: ${shipmentRecord.tracking_code}` });

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
      const shipId = activeJourney?.id;
      const trackingCode = activeJourney?.tracking_code;

      // 1. Update status to DELIVERED in public.shipments
      try {
        if (shipId) {
          await supabase
            .from('shipments')
            .update({ status: 'DELIVERED', updated_at: new Date().toISOString() })
            .eq('id', shipId);
        } else if (trackingCode) {
          await supabase
            .from('shipments')
            .update({ status: 'DELIVERED', updated_at: new Date().toISOString() })
            .eq('tracking_code', trackingCode);
        } else if (user?.id) {
          await supabase
            .from('shipments')
            .update({ status: 'DELIVERED', updated_at: new Date().toISOString() })
            .eq('driver_id', user.id)
            .in('status', ['IN_TRANSIT', 'in_transit', 'ACTIVE', 'active']);
        }
      } catch (e) {
        console.warn('Update shipment delivered notice:', e);
      }

      // 2. Halt active duty state in driver_profiles
      if (user?.id) {
        try {
          await supabase
            .from('driver_profiles')
            .update({
              is_active_duty: false,
              last_ping: new Date().toISOString()
            })
            .eq('id', user.id);
        } catch (e) {}
      }

      // 3. Stop GPS broadcasting & clean local state
      if (userLocation?.stopTracking) {
        try {
          userLocation.stopTracking();
        } catch (e) {}
      }
      
      if (typeof window !== 'undefined') {
        try {
          localStorage.removeItem('ner_active_journey');
          localStorage.removeItem('ner_active_transit_journey');
        } catch (e) {}
      }

      const deliveredCode = trackingCode || 'Consignment';
      setActiveJourney(null);
      setJourneyNotice({ type: 'success', message: `✅ Consignment ${deliveredCode} marked as DELIVERED.` });

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('ner_journey_completed'));
        window.dispatchEvent(new CustomEvent('ner_journey_deleted'));
      }
    } catch (err) {
      console.error('Mark delivered error:', err);
      setRoutingError('Failed to mark shipment as delivered.');
    } finally {
      setMarkingDelivered(false);
    }
  };

  // Handler: Terminate & Delete Transit Journey
  const handleDeleteJourney = async () => {
    if (!activeJourney && !user?.id) return;
    setTerminatingJourney(true);
    setJourneyNotice(null);

    try {
      // 1. Permanently delete from public.shipments
      try {
        if (activeJourney?.id) {
          await supabase
            .from('shipments')
            .delete()
            .eq('id', activeJourney.id);
        } else if (user?.id) {
          await supabase
            .from('shipments')
            .delete()
            .eq('driver_id', user.id)
            .in('status', ['IN_TRANSIT', 'in_transit', 'ACTIVE', 'active']);
        }
      } catch (e) {
        console.warn('Delete shipment note:', e);
      }

      // 2. Halt active duty state in driver_profiles
      if (user?.id) {
        try {
          await supabase
            .from('driver_profiles')
            .update({
              is_active_duty: false,
              last_ping: new Date().toISOString()
            })
            .eq('id', user.id);
        } catch (e) {}
      }

      // 3. Stop GPS broadcasting & clean local state
      if (userLocation?.stopTracking) {
        try {
          userLocation.stopTracking();
        } catch (e) {}
      }
      
      if (typeof window !== 'undefined') {
        try {
          localStorage.removeItem('ner_active_journey');
          localStorage.removeItem('ner_active_transit_journey');
        } catch (e) {}
      }

      setActiveJourney(null);
      setJourneyNotice({ type: 'info', message: 'Transit journey terminated and driver telemetry halted.' });

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('ner_journey_deleted'));
      }
    } catch (err) {
      console.error('Delete journey error:', err);
      setRoutingError('Failed to terminate journey.');
    } finally {
      setTerminatingJourney(false);
    }
  };

  // Load live data from Supabase
  useEffect(() => {
    async function initData() {
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

        const { data: shipData } = await supabase
          .from('shipments')
          .select('id')
          .in('status', ['IN_TRANSIT', 'in_transit', 'ACTIVE', 'active']);

        setActiveConvoysCount(shipData?.length || 0);
      } catch (err) {
        console.warn('Dashboard data fetch fallback:', err);
      }
    }

    initData();

    // Listen for new field hazard reports dispatched from modal
    const handleHazardReported = async () => {
      try {
        const { data: hazData } = await supabase
          .from('road_hazards')
          .select('*')
          .neq('status', 'resolved');
        if (hazData) setHazards(hazData);
      } catch (err) {}
    };

    // Listen for locally cleared/deleted hazard
    const handleHazardDeleted = (e) => {
      const delId = e?.detail?.id;
      if (delId) {
        setHazards((prev) => prev.filter((h) => h.id !== delId));
      }
    };

    // Listen for global navbar request to open hazard modal on dashboard
    const handleOpenHazardModal = (e) => {
      if (e.detail) setHazardCoords(e.detail);
      setHazardModalOpen(true);
    };

    // Helper to refresh active convoy counts
    const refreshShipmentsCount = async () => {
      try {
        const { data: shipData } = await supabase
          .from('shipments')
          .select('id')
          .in('status', ['IN_TRANSIT', 'in_transit', 'ACTIVE', 'active']);
        setActiveConvoysCount(shipData?.length || 0);
      } catch (e) {}
    };

    // Realtime channel for live hazard and shipments count sync
    const rtChannel = supabase
      .channel('dashboard_metrics_sync')
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

        // Secondary background verification to ensure 100% sync
        const { data: hazData } = await supabase
          .from('road_hazards')
          .select('*')
          .neq('status', 'resolved');
        if (hazData) setHazards(hazData);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shipments' }, () => {
        refreshShipmentsCount();
      })
      .subscribe();

    // Auto-polling interval for fallback metrics sync (every 10s)
    const pollInterval = setInterval(() => {
      refreshShipmentsCount();
    }, 10000);

    if (typeof window !== 'undefined') {
      window.addEventListener('ner_hazard_reported', handleHazardReported);
      window.addEventListener('ner_hazard_deleted', handleHazardDeleted);
      window.addEventListener('ner_open_hazard_modal', handleOpenHazardModal);
      window.addEventListener('ner_journey_started', refreshShipmentsCount);
      window.addEventListener('ner_journey_deleted', refreshShipmentsCount);
      return () => {
        supabase.removeChannel(rtChannel);
        clearInterval(pollInterval);
        window.removeEventListener('ner_hazard_reported', handleHazardReported);
        window.removeEventListener('ner_hazard_deleted', handleHazardDeleted);
        window.removeEventListener('ner_open_hazard_modal', handleOpenHazardModal);
        window.removeEventListener('ner_journey_started', refreshShipmentsCount);
        window.removeEventListener('ner_journey_deleted', refreshShipmentsCount);
      };
    }
  }, []);

  // Compute Origin Object (support live GPS position)
  const originHub = useMemo(() => {
    if (!originHubId) return null;
    if (originHubId === 'CURRENT_LOCATION') {
      if (userLocation.coords) {
        return {
          id: 'CURRENT_LOCATION',
          hub_code: 'GPS-LIVE',
          hub_name: 'My Current Location (GPS)',
          state: 'Live GPS',
          district: `±${Math.round(userLocation.accuracy || 0)}m`,
          latitude: userLocation.coords.lat,
          longitude: userLocation.coords.lng,
        };
      }
      return null;
    }
    return hubs.find((h) => h.hub_code === originHubId || h.id === originHubId) || null;
  }, [hubs, originHubId, userLocation.coords, userLocation.accuracy]);

  const destHub = useMemo(() => {
    if (!destHubId) return null;
    return hubs.find((h) => h.hub_code === destHubId || h.id === destHubId) || null;
  }, [hubs, destHubId]);

  // Destination options with currently selected origin filtered or disabled
  const destinationOptions = useMemo(() => {
    return hubs.map((h) => ({
      ...h,
      disabled: h.hub_code === originHubId || h.id === originHubId,
    }));
  }, [hubs, originHubId]);

  // Origin options with currently selected dest disabled
  const originOptions = useMemo(() => {
    return hubs.map((h) => ({
      ...h,
      disabled: h.hub_code === destHubId || h.id === destHubId,
    }));
  }, [hubs, destHubId]);

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

        // Fit bounds to encompass all candidate corridors simultaneously
        const allCorridorCoords = result.allRoutes.flatMap((r) => r.coordinates || []);
        if (allCorridorCoords.length > 1) {
          setRouteBounds(allCorridorCoords);
        }

        const chosenRoute = result.allRoutes[defaultIdx] || result.allRoutes[0];
        setCorridorHazards(chosenRoute.flaggedHazards || []);
      }
    } catch (err) {
      console.error('Route calculation error:', err);
      setRoutingError('Failed to compute route corridor. Retrying with topographic backup...');
    } finally {
      setCalculatingRoute(false);
    }
  }, [originHub, destHub, hazards]);

  // Route selection handler (Google Maps smooth instant switch without viewport jumping)
  const handleSelectRouteIndex = useCallback((idx) => {
    if (!multiRouteData?.allRoutes?.[idx]) return;
    setActiveRouteIndex(idx);
    const chosen = multiRouteData.allRoutes[idx];
    setCorridorHazards(chosen.flaggedHazards || []);
  }, [multiRouteData]);

  // Real-time re-evaluation of active calculated corridors whenever hazards change
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

  // Dedicated Reset / Clear Route Handler
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

  // AI Chat interactive map focus callbacks
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
    <div className="min-h-screen bg-slate-100/90 dark:bg-slate-950 text-slate-800 dark:text-slate-100 py-4 px-3 sm:px-5 lg:px-6 space-y-5 font-sans flex flex-col">
      
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
          onSelectShipmentOnMap={(shipment) => {
            focusOnMap([parseFloat(shipment.current_lat), parseFloat(shipment.current_lng)], 14, shipment);
          }} 
        />
      ) : currentView === 'settings' ? (
        <SettingsView />
      ) : (
        <>
          {/* 1. TOP HERO HEADER BANNER */}
          <div className="relative rounded-3xl bg-gradient-to-r from-blue-50/70 via-slate-50/60 to-white/90 dark:from-slate-900/80 dark:via-slate-900/60 dark:to-slate-950/80 border border-slate-200/90 dark:border-slate-800/90 p-5 sm:p-6 shadow-xs overflow-hidden">
            
            {/* Subtle soft backdrop accent */}
            <div className="absolute right-0 top-0 bottom-0 w-1/3 pointer-events-none opacity-15 dark:opacity-10 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-400 via-sky-300 to-transparent" />

            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 relative z-10">
              
              {/* Left Title & Subtitle */}
              <div className="space-y-1 max-w-2xl">
                <div className="flex items-center space-x-2">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-blue-600 dark:text-cyan-400 bg-blue-100/70 dark:bg-blue-950/80 px-2 py-0.5 rounded-md border border-blue-200/60 dark:border-blue-800/60">
                    # TACTICAL COMMAND GRID
                  </span>
                </div>
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                  Tactical Command & Convoy Center
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium">
                  Real-time GIS multi-route planning, convoy telemetry, and hazard mitigation across 8 North-Eastern States.
                </p>
              </div>

              {/* Right Slogan & Live Clock Widget */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 lg:gap-6 shrink-0">
                <div className="text-right hidden sm:block">
                  <span className="text-xs font-serif italic text-slate-700 dark:text-slate-300 font-medium block">
                    &ldquo;Better Intelligence, Safer Communities&rdquo;
                  </span>
                  <div className="w-12 h-0.5 bg-blue-500 rounded-full ml-auto mt-1" />
                </div>

                <LiveClockWidget />
              </div>

            </div>

          </div>

          {/* 2. SUMMARY METRICS ROW (4 Evenly Distributed Cards) */}
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            
            {/* Card 1: Strategic Hubs */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200/90 dark:border-slate-800 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                  Strategic Hubs
                </span>
                <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-100 dark:border-blue-900 flex items-center justify-center text-blue-600 dark:text-cyan-400">
                  <Building2 className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <span className="text-2xl font-black text-slate-900 dark:text-white font-mono">
                  50
                </span>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  8 NER States Online
                </p>
              </div>
            </div>

            {/* Card 2: Road Hazards */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200/90 dark:border-slate-800 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                  Active Hazards
                </span>
                <div className="w-8 h-8 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-100 dark:border-rose-900 flex items-center justify-center text-rose-500">
                  <AlertTriangle className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <span className="text-2xl font-black text-slate-900 dark:text-white font-mono">
                  {hazards.length}
                </span>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  {hazards.filter(h => (h.severity || '').toLowerCase() === 'critical').length} Critical Roadblocks
                </p>
              </div>
            </div>

            {/* Card 3: Live Convoys */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200/90 dark:border-slate-800 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                  Live Convoys
                </span>
                <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-100 dark:border-emerald-900 flex items-center justify-center text-emerald-500">
                  <Truck className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <span className="text-2xl font-black text-slate-900 dark:text-white font-mono">
                  {activeConvoysCount}
                </span>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  {activeConvoysCount > 0 ? `${activeConvoysCount} In-Transit Relief` : 'Fleet on Standby'}
                </p>
              </div>
            </div>

            {/* Card 4: Nodal Units */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200/90 dark:border-slate-800 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                  Nodal Units
                </span>
                <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-100 dark:border-amber-900 flex items-center justify-center text-amber-500">
                  <Radio className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <span className="text-2xl font-black text-slate-900 dark:text-white font-mono">
                  8
                </span>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  8 State Authorities
                </p>
              </div>
            </div>

          </div>

          {/* 3. TOP DASHBOARD 3-COLUMN WORKBENCH */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        
        {/* ========================================================================= */}
        {/* ========================================================================= */}
        {/* COLUMN 1: LEFT ROUTE NAVIGATOR (Span 3 on Desktop)                         */}
        {/* ========================================================================= */}
        <div className="lg:col-span-3 space-y-3.5 flex flex-col">
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

        {/* ========================================================================= */}
        {/* COLUMN 2: CENTER INTERACTIVE MAP VIEW (Span 6 on Desktop)                  */}
        {/* ========================================================================= */}
        <div className="lg:col-span-6 space-y-3.5 flex flex-col">
          
          {/* Section Header */}
          <div className="flex items-center justify-between px-1">
            <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 font-mono uppercase tracking-wide flex items-center space-x-2">
              <span>Interactive Map View</span>
            </h2>
            <div className="flex items-center space-x-1.5 text-[10px] font-mono text-slate-500 dark:text-slate-400">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse" />
              <span>GIS TELEMETRY LIVE</span>
            </div>
          </div>

          {/* Interactive Map Component Container with Live Geolocation Tracking */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-2.5 border border-slate-200/90 dark:border-slate-800 shadow-xs overflow-hidden">
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

        </div>

        {/* ========================================================================= */}
        {/* COLUMN 3: RIGHT ACTION & TELEMETRY PANEL (Span 3 on Desktop)               */}
        {/* ========================================================================= */}
        <div className="lg:col-span-3 space-y-3.5 flex flex-col">
          
          {/* CORRIDOR TELEMETRY Card */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-4 border border-slate-200/90 dark:border-slate-800 shadow-xs space-y-3.5 font-mono">
            
            <div className="flex items-center justify-between pb-1 border-b border-slate-100 dark:border-slate-800">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wide">
                CORRIDOR TELEMETRY
              </span>
              {activeRoute && (
                <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 uppercase bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                  LIVE
                </span>
              )}
            </div>

            {/* Segmented Layer Tabs */}
            <div className="flex items-center space-x-1 bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
              {['streets', 'topo', 'satellite'].map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setActiveTileStyle(t)}
                  className={`flex-1 py-1 px-1.5 rounded-lg text-[10px] font-bold uppercase transition-all cursor-pointer ${
                    activeTileStyle === t
                      ? 'bg-blue-600 text-white shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {t === 'streets' ? 'Primary' : t === 'topo' ? 'Topographic' : 'Satellite'}
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
                    <span className="text-2xl font-black text-slate-900 dark:text-white">
                      {activeRoute.distanceKm} <span className="text-xs font-bold text-slate-500 dark:text-slate-400">KM</span>
                    </span>
                    <div className="flex items-end space-x-0.5 h-5">
                      <div className="w-1 bg-blue-500 h-2 rounded-t" />
                      <div className="w-1 bg-blue-500 h-4 rounded-t" />
                      <div className="w-1 bg-blue-500 h-5 rounded-t" />
                      <div className="w-1 bg-blue-500 h-3 rounded-t" />
                    </div>
                  </div>
                </div>

                {/* ESTIMATED ETA */}
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                    ESTIMATED ETA
                  </span>
                  <div className="flex items-center justify-between">
                    <span className="text-xl font-bold text-slate-900 dark:text-white">
                      {activeRoute.durationText}
                    </span>
                    <div className="flex items-end space-x-0.5 h-5">
                      <div className="w-1 bg-cyan-500 h-3 rounded-t" />
                      <div className="w-1 bg-cyan-500 h-5 rounded-t" />
                      <div className="w-1 bg-cyan-500 h-4 rounded-t" />
                      <div className="w-1 bg-cyan-500 h-2 rounded-t" />
                    </div>
                  </div>
                </div>

                {/* SAFE CORRIDOR INDEX (SCI) THREAT SCORE GAUGE */}
                <div className="space-y-1.5 pt-0.5">
                  <div className="flex items-center justify-between text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">
                    <span className="flex items-center gap-1">
                      <span>SAFE CORRIDOR INDEX (SCI)</span>
                    </span>
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
                  <div className="w-full bg-slate-200 dark:bg-slate-800 h-2 rounded-full overflow-hidden p-0.5 border border-slate-300 dark:border-slate-700">
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

                {/* LIVE WEATHER & MONSOON THREAT HUD */}
                {activeRoute.weather && (
                  <div className={`p-3 rounded-2xl border text-[11px] space-y-1.5 ${
                    activeRoute.weather.riskTier === 'critical_monsoon'
                      ? 'bg-rose-50/80 dark:bg-rose-950/40 border-rose-400 dark:border-rose-800 text-rose-950 dark:text-rose-200'
                      : activeRoute.weather.riskTier === 'caution'
                        ? 'bg-amber-50/80 dark:bg-amber-950/40 border-amber-400 dark:border-amber-800 text-amber-950 dark:text-amber-200'
                        : 'bg-blue-50/80 dark:bg-slate-800/80 border-blue-200 dark:border-slate-700 text-slate-800 dark:text-slate-200'
                  }`}>
                    <div className="flex items-center justify-between font-bold uppercase text-[10px]">
                      <span className="flex items-center space-x-1.5">
                        <span className="text-sm">{activeRoute.weather.weatherEmoji || '🌤️'}</span>
                        <span>LIVE CORRIDOR WEATHER</span>
                      </span>
                      <span className="font-mono text-xs font-black">
                        {activeRoute.weather.avgTemperature}°C
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[10px] font-sans">
                      <span className="font-bold text-slate-700 dark:text-slate-200">
                        {activeRoute.weather.dominantWeather || 'Variable Mountain Weather'}
                      </span>
                      <span className="font-mono font-bold text-blue-600 dark:text-cyan-400">
                        {activeRoute.weather.maxRainfallMm > 0 ? `🌧️ ${activeRoute.weather.maxRainfallMm} mm/h` : '☀️ 0 mm/h Rain'}
                      </span>
                    </div>

                    {activeRoute.weather.alertMessage && (
                      <p className="text-[9.5px] leading-tight opacity-90 italic pt-0.5 border-t border-slate-200/60 dark:border-slate-700/60">
                        {activeRoute.weather.alertMessage}
                      </p>
                    )}
                  </div>
                )}

                {/* CORRIDOR SAFETY CHECK (Adaptive HUD Box) */}
                <div className={`border rounded-2xl p-3 text-[11px] space-y-1.5 ${
                  (activeRoute.flaggedHazards?.length || 0) === 0
                    ? 'bg-emerald-50/90 dark:bg-emerald-950/50 border-emerald-300 dark:border-emerald-800 text-emerald-950 dark:text-emerald-200'
                    : 'bg-rose-50/90 dark:bg-rose-950/50 border-rose-300 dark:border-rose-800 text-rose-950 dark:text-rose-200'
                }`}>
                  <div className="flex items-center justify-between font-bold uppercase text-[10px]">
                    <span className="flex items-center space-x-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
                      <span>GEOSPATIAL SAFETY AUDIT</span>
                    </span>
                    <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase border ${
                      (activeRoute.flaggedHazards?.length || 0) === 0
                        ? 'bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200 border-emerald-300 dark:border-emerald-700'
                        : 'bg-rose-100 dark:bg-rose-900 text-rose-800 dark:text-rose-200 border-rose-300 dark:border-rose-700'
                    }`}>
                      {(activeRoute.flaggedHazards?.length || 0) === 0 ? '100% CLEAR' : 'HIGH RISK'}
                    </span>
                  </div>

                  {(activeRoute.flaggedHazards?.length || 0) > 0 ? (
                    <div className="space-y-1.5">
                      <div className="font-bold text-rose-800 dark:text-rose-300 text-[10px] flex items-center space-x-1">
                        <AlertTriangle className="w-3 h-3 text-rose-600 dark:text-rose-400 shrink-0" />
                        <span>{activeRoute.flaggedHazards.length} THREAT PERIMETER(S) BREACHED:</span>
                      </div>
                      <div className="space-y-1.5">
                        {activeRoute.flaggedHazards.map((h, i) => {
                          const impactRad = h.impactRadiusKm || h.impact_radius_km || 5.0;
                          return (
                            <div key={h.id || i} className="text-[10px] text-rose-900 dark:text-rose-200 bg-white/90 dark:bg-slate-900/90 p-2 rounded-xl border border-rose-200 dark:border-rose-800 space-y-1 shadow-2xs">
                              <div className="flex items-center justify-between font-bold">
                                <span className="flex items-center gap-1.5 truncate text-rose-900 dark:text-rose-100">
                                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse shrink-0" />
                                  <span className="truncate">{h.title || (h.hazard_type ? h.hazard_type.replace(/_/g, ' ').toUpperCase() : 'Hazard')}</span>
                                </span>
                                <span className="text-[8px] px-1.5 py-0.2 rounded font-extrabold uppercase bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-700">
                                  {h.severity?.toUpperCase()}
                                </span>
                              </div>
                              <div className="text-[9px] text-rose-700 dark:text-rose-400 font-mono">
                                ⚠️ Breached: {h.distanceFromRouteKm} km from epicenter (radius: {impactRad} km)
                              </div>
                              {h.description && (
                                <div className="text-[9px] text-slate-600 dark:text-slate-400 italic line-clamp-1">
                                  {h.description}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="text-[10px] text-emerald-800 dark:text-emerald-300 font-medium space-y-0.5">
                      <div className="flex items-center space-x-1 font-bold text-emerald-700 dark:text-emerald-400">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <span>Optimal Mountain Transit Corridor</span>
                      </div>
                      <p className="text-[10px] text-emerald-700/90 dark:text-emerald-400/90 leading-tight">
                        Zero active danger perimeters or roadblocks breached along this route.
                      </p>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="py-6 text-center text-slate-400 dark:text-slate-500 font-sans text-xs space-y-2">
                <Navigation className="w-6 h-6 mx-auto text-slate-300 dark:text-slate-600" />
                <p className="font-medium text-slate-500 dark:text-slate-400 text-[11px]">
                  Select an Origin and Destination Hub to compute mountain transit distance & hazard telemetry.
                </p>
              </div>
            )}

          </div>

        </div>

      </div>
      </>
      )}

      {/* Interactive Report Hazard Modal with Map Picking & GPS Integration */}
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

      {/* Pre-Dispatch Start Journey Manifest Modal */}
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

      {/* Floating Tactical AI Copilot Launcher at Bottom-Right Corner */}
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