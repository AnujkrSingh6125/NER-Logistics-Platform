'use client';

import { useState, useEffect, useRef } from 'react';
import { 
  X, 
  AlertTriangle, 
  Map, 
  Upload, 
  RefreshCw, 
  Loader2, 
  Image as ImageIcon, 
  Video, 
  Film, 
  Plus, 
  CheckCircle2, 
  Trash2,
  FileText,
  MapPin
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/context/AuthContext';
import { reverseGeocode } from '@/lib/geoUtils';

export default function ReportHazardModal({ 
  isOpen = true, 
  onClose, 
  onSuccess, 
  onHazardReported, 
  userProfile,
  initialCoords = null,
  onStartMapPick = null,
  initialFormData = null
}) {
  const { user, profile, isNodalOfficer, nodalOfficer } = useAuth();
  const effectiveProfile = userProfile || profile;

  const initLat = initialCoords?.latitude ?? initialCoords?.lat;
  const initLng = initialCoords?.longitude ?? initialCoords?.lng;

  const [latInput, setLatInput] = useState(initLat != null ? initLat.toString() : '');
  const [lngInput, setLngInput] = useState(initLng != null ? initLng.toString() : '');
  const [coords, setCoords] = useState({ 
    lat: initLat ? parseFloat(initLat) : null, 
    lng: initLng ? parseFloat(initLng) : null 
  });
  const [locating, setLocating] = useState(false);
  const [coordMode, setCoordMode] = useState(initLat ? 'map' : 'manual');

  // Real-world Reverse Geocoding state
  const [detectedLocation, setDetectedLocation] = useState(null);
  const [isGeocoding, setIsGeocoding] = useState(false);

  const [hazardType, setHazardType] = useState(initialFormData?.hazardType || 'landslide');
  const [severity, setSeverity] = useState(initialFormData?.severity || 'high');
  const [description, setDescription] = useState(initialFormData?.description || '');
  const [state, setState] = useState(initialFormData?.state || effectiveProfile?.state || nodalOfficer?.state || 'Assam');
  const [district, setDistrict] = useState(initialFormData?.district || effectiveProfile?.district || '');
  const [impactRadiusKm, setImpactRadiusKm] = useState(initialFormData?.impact_radius_km || 5.0);
  
  // Multi-media state: up to 3 images or videos
  // Array of { file, previewUrl, type: 'image' | 'video', name: string, size: number }
  const [mediaItems, setMediaItems] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [errorMsg, setErrorMsg] = useState(null);

  const fileInputRef = useRef(null);

  // Initialize or update coords if initialCoords changes
  useEffect(() => {
    const latVal = initialCoords?.latitude ?? initialCoords?.lat;
    const lngVal = initialCoords?.longitude ?? initialCoords?.lng;
    if (latVal != null && lngVal != null && !isNaN(parseFloat(latVal)) && !isNaN(parseFloat(lngVal))) {
      const parsedLat = parseFloat(Number(latVal).toFixed(6));
      const parsedLng = parseFloat(Number(lngVal).toFixed(6));
      setCoords({ lat: parsedLat, lng: parsedLng });
      setLatInput(parsedLat.toString());
      setLngInput(parsedLng.toString());
      setCoordMode('map');
      setLocating(false);
    }
  }, [initialCoords]);

  // Sync saved form state when re-opened after pinning
  useEffect(() => {
    if (initialFormData) {
      if (initialFormData.hazardType) setHazardType(initialFormData.hazardType);
      if (initialFormData.severity) setSeverity(initialFormData.severity);
      if (initialFormData.description !== undefined) setDescription(initialFormData.description);
      if (initialFormData.state) setState(initialFormData.state);
      if (initialFormData.district) setDistrict(initialFormData.district);
      if (initialFormData.impact_radius_km) setImpactRadiusKm(initialFormData.impact_radius_km);
    }
  }, [initialFormData]);

  // Direct manual coordinate typing
  const handleLatChange = (e) => {
    const val = e.target.value;
    setLatInput(val);
    const parsed = parseFloat(val);
    if (!isNaN(parsed)) {
      setCoords((prev) => ({ ...prev, lat: parsed }));
      setCoordMode('manual');
    }
  };

  const handleLngChange = (e) => {
    const val = e.target.value;
    setLngInput(val);
    const parsed = parseFloat(val);
    if (!isNaN(parsed)) {
      setCoords((prev) => ({ ...prev, lng: parsed }));
      setCoordMode('manual');
    }
  };

  // Fetch live browser GPS location
  const fetchLocation = () => {
    setLocating(true);
    setErrorMsg(null);
    if (!navigator.geolocation) {
      setErrorMsg('Geolocation is not supported by your browser.');
      setLocating(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const latVal = parseFloat(pos.coords.latitude.toFixed(6));
        const lngVal = parseFloat(pos.coords.longitude.toFixed(6));
        setCoords({ lat: latVal, lng: lngVal });
        setLatInput(latVal.toString());
        setLngInput(lngVal.toString());
        setLocating(false);
        setCoordMode('gps');
      },
      (err) => {
        setErrorMsg('Could not fetch GPS location: ' + err.message);
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Automatic Real-World Reverse Geocoding Effect
  useEffect(() => {
    const lat = parseFloat(latInput);
    const lng = parseFloat(lngInput);

    if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      setIsGeocoding(true);
      const timer = setTimeout(async () => {
        try {
          const res = await reverseGeocode(lat, lng);
          if (res) {
            setDetectedLocation(res);
            if (res.state) {
              const nerStates = ['Assam', 'Arunachal Pradesh', 'Meghalaya', 'Manipur', 'Mizoram', 'Nagaland', 'Tripura', 'Sikkim'];
              const matchedState = nerStates.find(s => s.toLowerCase() === res.state.toLowerCase());
              if (matchedState) setState(matchedState);
            }
            if (res.district) {
              setDistrict(res.district);
            }
          } else {
            setDetectedLocation(null);
          }
        } catch (e) {
          console.warn('Geocoding hook error:', e);
        } finally {
          setIsGeocoding(false);
        }
      }, 400);

      return () => clearTimeout(timer);
    } else {
      setDetectedLocation(null);
      setIsGeocoding(false);
    }
  }, [latInput, lngInput]);

  const handleStartMapPickClick = () => {
    const currentData = {
      hazardType,
      severity,
      description,
      state,
      district,
    };
    if (onStartMapPick) {
      onStartMapPick(currentData);
    } else if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ner_start_map_pick', { detail: currentData }));
      if (onClose) onClose();
    }
  };

  // Multi-media upload handler (Images + Videos, Max 3)
  const handleFilesSelect = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const availableSlots = 3 - mediaItems.length;
    if (availableSlots <= 0) {
      setErrorMsg('Maximum 3 media files (photos/videos) allowed.');
      return;
    }

    const filesToAdd = files.slice(0, availableSlots);
    if (files.length > availableSlots) {
      setErrorMsg(`Only ${availableSlots} more file(s) added. Maximum limit is 3.`);
    } else {
      setErrorMsg(null);
    }

    const newItems = filesToAdd.map((file) => {
      const isVideo = file.type.startsWith('video/');
      const previewUrl = URL.createObjectURL(file);
      return {
        file,
        previewUrl,
        type: isVideo ? 'video' : 'image',
        name: file.name,
        size: file.size
      };
    });

    setMediaItems((prev) => [...prev, ...newItems]);
    // Reset file input value so user can re-add if needed
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemoveMedia = (indexToRemove) => {
    setMediaItems((prev) => {
      const item = prev[indexToRemove];
      if (item?.previewUrl) {
        URL.revokeObjectURL(item.previewUrl);
      }
      return prev.filter((_, idx) => idx !== indexToRemove);
    });
  };

  const mapHazardType = (type) => {
    if (!type || typeof type !== 'string') return 'landslide';
    const normalized = type.toLowerCase().replace(/[\s-]/g, '_');
    const valid = ['landslide', 'flash_flood', 'road_washout', 'tree_fall', 'heavy_waterlogging', 'bridge_damage'];
    if (valid.includes(normalized)) return normalized;
    if (normalized.includes('flood')) return 'flash_flood';
    if (normalized.includes('bridge')) return 'bridge_damage';
    if (normalized.includes('cave') || normalized.includes('blockade')) return 'road_washout';
    if (normalized.includes('mud') || normalized.includes('rock')) return 'landslide';
    return 'landslide';
  };

  const mapSeverity = (sev) => {
    if (!sev || typeof sev !== 'string') return 'high';
    const normalized = sev.toLowerCase();
    const valid = ['low', 'medium', 'high', 'critical'];
    return valid.includes(normalized) ? normalized : 'high';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // 1. Strict Validation: Every field is compulsory
    const finalLat = parseFloat(latInput);
    const finalLng = parseFloat(lngInput);

    if (isNaN(finalLat) || isNaN(finalLng)) {
      setErrorMsg('Latitude & Longitude are compulsory. Please pin on map or enter valid coordinates.');
      return;
    }
    if (finalLat < -90 || finalLat > 90 || finalLng < -180 || finalLng > 180) {
      setErrorMsg('Coordinates out of valid geographic range (Lat -90..90, Lng -180..180).');
      return;
    }

    if (!hazardType) {
      setErrorMsg('Hazard Type is compulsory. Please select the hazard category.');
      return;
    }

    if (!severity) {
      setErrorMsg('Severity Level is compulsory. Please select the incident severity.');
      return;
    }

    if (!description.trim() || description.trim().length < 5) {
      setErrorMsg('Field Description & Clearance Status is compulsory (minimum 5 characters).');
      return;
    }

    if (mediaItems.length === 0) {
      setErrorMsg('Evidence Media Upload is compulsory. Please upload at least 1 photo or video (up to 3).');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);
    setUploadProgress('Uploading media evidence (0/3)...');

    try {
      const uploadedUrls = [];

      // 2. Upload up to 3 media files (images or videos) to Supabase Storage
      for (let i = 0; i < mediaItems.length; i++) {
        const item = mediaItems[i];
        setUploadProgress(`Uploading media ${i + 1} of ${mediaItems.length}...`);
        
        try {
          const ext = item.file.name.split('.').pop() || (item.type === 'video' ? 'mp4' : 'jpg');
          const cleanExt = ext.toLowerCase().replace(/[^a-z0-9]/g, '');
          const fileName = `${Date.now()}-${i}-${Math.random().toString(36).substring(2, 8)}.${cleanExt}`;
          const filePath = `reports/${fileName}`;

          const { error: uploadError } = await supabase.storage
            .from('hazard-images')
            .upload(filePath, item.file, { upsert: true });

          if (!uploadError) {
            const { data: urlData } = supabase.storage
              .from('hazard-images')
              .getPublicUrl(filePath);

            if (urlData?.publicUrl) {
              uploadedUrls.push(urlData.publicUrl);
            }
          } else {
            console.warn(`Upload error on file ${item.name}:`, uploadError.message);
          }
        } catch (fileErr) {
          console.warn('Media upload exception:', fileErr);
        }
      }

      setUploadProgress('Finalizing hazard incident record...');

      const reporterRole = isNodalOfficer ? 'nodal_officer' : 'citizen_driver';
      const reporterName = isNodalOfficer
        ? `${nodalOfficer?.officer_name || 'Nodal Authority'} (${nodalOfficer?.department || 'SDMA'})`
        : (effectiveProfile?.full_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Field Reporter');
      const reporterContact = isNodalOfficer
        ? (nodalOfficer?.emergency_contact || '')
        : (effectiveProfile?.phone || user?.user_metadata?.phone || '');

      const dbHazardType = mapHazardType(hazardType);
      const dbSeverity = mapSeverity(severity);
      const titleText = description.trim().slice(0, 60);

      // Ensure accurate real-world state and district via direct reverse geocoding lookup
      let finalPlace = detectedLocation;
      if (!finalPlace) {
        try {
          finalPlace = await reverseGeocode(finalLat, finalLng);
        } catch (e) {}
      }

      const realState = finalPlace?.state || (state && state !== 'Assam' ? state : null) || effectiveProfile?.state || nodalOfficer?.state || 'Assam';
      const realDistrict = finalPlace?.district || finalPlace?.locality || (district && district !== 'Unspecified Sector' ? district : null) || 'Central Sector';

      // 3. Resilient Insert payload (handles both citizen drivers and nodal officers gracefully)
      const userId = isNodalOfficer ? null : (user?.id || null);
      const primaryMediaUrl = (uploadedUrls && uploadedUrls.length > 0) ? uploadedUrls[0] : null;

      const basePayload = {
        title: titleText,
        hazard_type: dbHazardType,
        severity: dbSeverity,
        impact_radius_km: parseFloat(impactRadiusKm) || 5.0,
        status: isNodalOfficer ? 'verified' : 'reported',
        latitude: finalLat,
        longitude: finalLng,
        state: realState,
        district: realDistrict,
        notes: description.trim(),
        image_url: primaryMediaUrl,
        media_urls: uploadedUrls,
        reported_by: userId,
        reported_by_id: userId,
        reported_by_role: reporterRole,
        reported_by_name: reporterName,
        reported_by_contact: reporterContact,
        is_verified: !!isNodalOfficer,
      };

      // Try inserting with full payload
      let { data, error: dbError } = await supabase
        .from('road_hazards')
        .insert([basePayload])
        .select()
        .single();

      // Graceful fallback if database schema cache lacks 'reported_by_id', 'media_urls', or 'impact_radius_km'
      if (dbError && (dbError.message?.includes('reported_by_id') || dbError.message?.includes('media_urls') || dbError.message?.includes('impact_radius_km') || dbError.code === 'PGRST204')) {
        console.warn('Retrying hazard insertion without optional unmigrated columns:', dbError.message);
        const fallbackPayload = { ...basePayload };
        delete fallbackPayload.reported_by_id;
        delete fallbackPayload.media_urls;
        if (dbError.message?.includes('impact_radius_km')) {
          delete fallbackPayload.impact_radius_km;
        }

        const retryResult = await supabase
          .from('road_hazards')
          .insert([fallbackPayload])
          .select()
          .single();

        data = retryResult.data;
        dbError = retryResult.error;
      }

      if (dbError) throw dbError;

      if (onSuccess) onSuccess(data);
      if (onHazardReported) onHazardReported(data);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('ner_hazard_reported', { detail: data }));
      }

      if (onClose) onClose();
    } catch (err) {
      console.error('Hazard submission failure:', err);
      setErrorMsg(err.message || 'Failed to submit report. Please check database connection.');
    } finally {
      setSubmitting(false);
      setUploadProgress('');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-150 font-sans">
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-200/90 my-auto flex flex-col max-h-[92vh]">
        
        {/* 1. Dark Top Header Bar */}
        <div className="bg-[#1a2530] px-5 sm:px-6 py-4 flex items-center justify-between text-white shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="w-7 h-7 rounded-lg bg-red-500/20 border border-red-500/40 flex items-center justify-center text-red-400">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-wide leading-tight">
                New Hazard Report
              </h3>
              <p className="text-[10px] text-slate-400 font-mono">
                All fields are compulsory • Up to 3 photos/videos
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 2. Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1 bg-white">
          
          {/* Location Card with Pin Hazard Location & Lat/Lng Inputs */}
          <div className="bg-[#faf6ee] border border-[#eee4d0] rounded-2xl p-3.5 space-y-3">
            
            {/* Action Bar with Pin Location & Live GPS */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleStartMapPickClick}
                className="flex-1 py-2.5 px-3 bg-[#24424d] hover:bg-[#1a333c] text-white rounded-xl font-medium text-xs flex items-center justify-center space-x-2 shadow-xs transition-all cursor-pointer"
              >
                <Map className="w-4 h-4 text-cyan-300" />
                <span>Pin Hazard Location</span>
              </button>

              <button
                type="button"
                onClick={fetchLocation}
                disabled={locating}
                className="py-2.5 px-3 bg-white hover:bg-slate-50 text-slate-700 border border-[#e5d9c5] rounded-xl font-medium text-xs flex items-center justify-center space-x-1.5 shadow-xs transition-all cursor-pointer disabled:opacity-50"
                title="Fetch live device GPS"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-cyan-600 ${locating ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Use GPS</span>
              </button>
            </div>

            {/* Latitude & Longitude Inputs (Compulsory) */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                  LATITUDE <span className="text-red-500 font-black">*</span>
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  value={latInput}
                  onChange={handleLatChange}
                  placeholder="e.g. 26.144500"
                  className="w-full bg-white border border-[#e5d9c5] rounded-xl px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#24424d] shadow-xs"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                  LONGITUDE <span className="text-red-500 font-black">*</span>
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  value={lngInput}
                  onChange={handleLngChange}
                  placeholder="e.g. 91.736200"
                  className="w-full bg-white border border-[#e5d9c5] rounded-xl px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#24424d] shadow-xs"
                />
              </div>
            </div>

            {/* Real-World Place Detection Banner */}
            {isGeocoding ? (
              <div className="p-2.5 bg-blue-50/80 border border-blue-200/80 rounded-xl flex items-center space-x-2 text-[11px] font-mono text-blue-800 animate-pulse">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600 shrink-0" />
                <span>Identifying real-world location & road sector...</span>
              </div>
            ) : detectedLocation ? (
              <div className="p-2.5 bg-white border border-emerald-200 rounded-xl flex items-start space-x-2 text-[11px] shadow-2xs animate-in fade-in">
                <MapPin className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center space-x-1.5 font-bold text-emerald-900 text-xs">
                    <span>📍 {detectedLocation.formattedSummary}</span>
                  </div>
                  {detectedLocation.displayName && (
                    <div className="text-[10px] text-slate-500 font-mono mt-0.5 truncate">
                      {detectedLocation.displayName}
                    </div>
                  )}
                </div>
              </div>
            ) : null}

          </div>

          {/* Hazard Type & Severity Level Grid (Compulsory) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                HAZARD TYPE <span className="text-red-500 font-black">*</span>
              </label>
              <select
                value={hazardType}
                required
                onChange={(e) => setHazardType(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#24424d] shadow-xs cursor-pointer"
              >
                <option value="landslide">Landslide/Rockfall</option>
                <option value="flash_flood">Flash Flood/Washout</option>
                <option value="road_washout">Road Cave-in/Collapse</option>
                <option value="bridge_damage">Bridge/Culvert Damage</option>
                <option value="tree_fall">Tree Fall/Debris</option>
                <option value="heavy_waterlogging">Severe Waterlogging</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                SEVERITY LEVEL <span className="text-red-500 font-black">*</span>
              </label>
              <select
                value={severity}
                required
                onChange={(e) => setSeverity(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#24424d] shadow-xs cursor-pointer"
              >
                <option value="critical">🛑 Critical (Total Blockade)</option>
                <option value="high">🔴 High (Critical Damage)</option>
                <option value="medium">🟡 Medium (Caution / Slow Transit)</option>
                <option value="low">🟢 Low (Passable with Caution)</option>
              </select>
            </div>
          </div>

          {/* Threat Impact Radius / Danger Zone (Compulsory) */}
          <div className="space-y-2 bg-[#f4ebe1] dark:bg-slate-800/80 p-3 rounded-2xl border border-[#e5d9c5] dark:border-slate-700 shadow-xs">
            <div className="flex items-center justify-between">
              <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center space-x-1.5">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span>THREAT IMPACT RADIUS <span className="text-red-500 font-black">*</span></span>
              </label>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-800">
                🎯 {impactRadiusKm} km Danger Perimeter
              </span>
            </div>

            {/* Quick Preset Buttons */}
            <div className="grid grid-cols-5 gap-1.5 pt-0.5">
              {[
                { val: 1.0, label: '1 km' },
                { val: 3.0, label: '3 km' },
                { val: 5.0, label: '5 km (Std)' },
                { val: 10.0, label: '10 km' },
                { val: 20.0, label: '20 km' },
              ].map((p) => {
                const isSelected = parseFloat(impactRadiusKm) === p.val;
                return (
                  <button
                    key={`radius-btn-${p.val}`}
                    type="button"
                    onClick={() => setImpactRadiusKm(p.val)}
                    className={`py-1 px-1 rounded-xl text-[10px] font-mono font-bold transition-all border cursor-pointer text-center ${
                      isSelected
                        ? 'bg-red-600 text-white border-red-600 shadow-xs ring-2 ring-red-400/40'
                        : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:border-red-400'
                    }`}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>

            {/* Slider */}
            <div className="pt-1 flex items-center space-x-2">
              <input
                type="range"
                min="0.5"
                max="25"
                step="0.5"
                value={impactRadiusKm}
                onChange={(e) => setImpactRadiusKm(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-slate-300 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-red-600"
              />
              <span className="text-[10px] font-mono text-slate-600 dark:text-slate-400 font-bold shrink-0 min-w-[38px] text-right">
                {impactRadiusKm} km
              </span>
            </div>
          </div>

          {/* Field Description & Clearance Status (Compulsory) */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                FIELD DESCRIPTION & CLEARANCE STATUS <span className="text-red-500 font-black">*</span>
              </label>
              <span className="text-[9px] font-mono text-slate-400">Compulsory</span>
            </div>
            <textarea
              rows={3}
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. NH-27 blocked 3km past Haflong due to rockfall. Excavators on-site, single lane blocked."
              className="w-full bg-white border border-slate-200 rounded-xl p-3 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#24424d] shadow-xs resize-none leading-relaxed"
            />
          </div>

          {/* 3. MULTI-MEDIA UPLOAD POD (Images + Videos, Max 3, Compulsory) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                EVIDENCE MEDIA (PHOTOS / VIDEOS) <span className="text-red-500 font-black">*</span>
              </label>
              <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${
                mediaItems.length > 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
              }`}>
                {mediaItems.length}/3 Uploaded {mediaItems.length === 0 ? '(Required)' : '✓'}
              </span>
            </div>

            {/* Media Items Preview Grid */}
            {mediaItems.length > 0 && (
              <div className="grid grid-cols-3 gap-2.5">
                {mediaItems.map((item, idx) => (
                  <div 
                    key={`media-${idx}-${item.name}`} 
                    className="relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-900 shadow-xs group aspect-square flex items-center justify-center"
                  >
                    {item.type === 'video' ? (
                      <div className="relative w-full h-full bg-slate-950 flex items-center justify-center">
                        <video
                          src={item.previewUrl}
                          className="w-full h-full object-cover opacity-80"
                          playsInline
                          muted
                        />
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <div className="w-8 h-8 rounded-full bg-black/70 flex items-center justify-center text-white border border-white/30">
                            <Film className="w-4 h-4 text-cyan-400" />
                          </div>
                        </div>
                        <span className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded text-[8px] font-mono font-bold bg-black/80 text-cyan-300 border border-cyan-800 uppercase">
                          VIDEO
                        </span>
                      </div>
                    ) : (
                      <div className="relative w-full h-full">
                        <img
                          src={item.previewUrl}
                          alt={`Evidence preview ${idx + 1}`}
                          className="w-full h-full object-cover"
                        />
                        <span className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded text-[8px] font-mono font-bold bg-black/80 text-amber-300 border border-amber-800 uppercase">
                          PHOTO
                        </span>
                      </div>
                    )}

                    {/* Delete item button */}
                    <button
                      type="button"
                      onClick={() => handleRemoveMedia(idx)}
                      title="Remove this media"
                      className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/80 hover:bg-red-600 text-white flex items-center justify-center text-[10px] transition-colors cursor-pointer shadow-md"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}

                {/* Add More button if under 3 */}
                {mediaItems.length < 3 && (
                  <label className="border border-dashed border-[#dfd2be] bg-[#faf6ee]/70 hover:bg-[#faf6ee] rounded-2xl aspect-square flex flex-col items-center justify-center transition-colors cursor-pointer text-center group">
                    <div className="w-7 h-7 rounded-full bg-white border border-[#e5d9c5] flex items-center justify-center mb-1 group-hover:scale-105 transition-transform shadow-2xs">
                      <Plus className="w-3.5 h-3.5 text-slate-700" />
                    </div>
                    <span className="text-[10px] font-bold text-slate-700">Add More</span>
                    <span className="text-[8px] font-mono text-slate-400">({3 - mediaItems.length} left)</span>
                    <input
                      type="file"
                      accept="image/*,video/*"
                      multiple
                      onChange={handleFilesSelect}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
            )}

            {/* Initial Empty Upload Dropzone */}
            {mediaItems.length === 0 && (
              <label className="border-2 border-dashed border-[#dfd2be] bg-[#faf6ee]/60 hover:bg-[#faf6ee] rounded-2xl p-4 flex flex-col items-center justify-center transition-colors cursor-pointer text-center group">
                <div className="flex items-center space-x-2 mb-1.5">
                  <div className="w-8 h-8 rounded-full bg-white border border-[#e5d9c5] flex items-center justify-center shadow-2xs group-hover:scale-105 transition-transform text-slate-700">
                    <ImageIcon className="w-4 h-4 text-blue-600" />
                  </div>
                  <div className="w-8 h-8 rounded-full bg-white border border-[#e5d9c5] flex items-center justify-center shadow-2xs group-hover:scale-105 transition-transform text-slate-700">
                    <Video className="w-4 h-4 text-rose-600" />
                  </div>
                </div>
                <span className="text-xs font-bold text-slate-800">
                  Click or Drag & Drop Photos or Videos
                </span>
                <span className="text-[10px] text-slate-500 mt-0.5 font-medium">
                  Upload up to 3 medias (PNG, JPG, WebP, MP4, MOV up to 25MB each)
                </span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/*"
                  multiple
                  required
                  onChange={handleFilesSelect}
                  className="hidden"
                />
              </label>
            )}
          </div>

          {/* Error / Alert Message */}
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-medium flex items-center space-x-2 animate-in fade-in">
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-500" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Upload progress notice */}
          {submitting && uploadProgress && (
            <div className="p-2.5 bg-blue-50 border border-blue-200 text-blue-700 rounded-xl text-xs font-mono flex items-center space-x-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
              <span>{uploadProgress}</span>
            </div>
          )}

          {/* Footer Action Buttons */}
          <div className="flex items-center justify-end space-x-3 pt-2 shrink-0 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2.5 rounded-xl bg-[#24424d] hover:bg-[#1a333c] text-white font-bold text-xs shadow-md hover:shadow-lg transition-all flex items-center space-x-2 cursor-pointer disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Submitting...</span>
                </>
              ) : (
                <span>Submit Report</span>
              )}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}



