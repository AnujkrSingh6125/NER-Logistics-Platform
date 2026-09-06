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
  MapPin,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Sparkles,
  Radio,
  MessageSquareText,
  Shield,
  Users,
  BarChart3,
  Send,
  CloudUpload,
  Layers
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/context/AuthContext';
import { reverseGeocode } from '@/lib/geoUtils';
import { validateNerLocation } from '@/lib/nerGeofence';

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

  // Multilingual Voice Assistant State
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isProcessingVoice, setIsProcessingVoice] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [voiceReply, setVoiceReply] = useState('');
  const [detectedLang, setDetectedLang] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isVoiceComplete, setIsVoiceComplete] = useState(true);
  const [voiceMissingFields, setVoiceMissingFields] = useState([]);
  const [voiceActiveTurn, setVoiceActiveTurn] = useState(false);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);
  const speechRef = useRef(null);

  // Voice Recording Functions
  const startRecording = async () => {
    setErrorMsg(null);
    if (isSpeaking) {
      stopSpeech();
    }

    if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setErrorMsg('Voice recording is not supported in this browser environment.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const recorder = new MediaRecorder(stream);

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = async () => {
        const tracks = stream.getTracks();
        tracks.forEach((track) => track.stop());

        if (audioChunksRef.current.length === 0) return;
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await processAudioWithGemini(audioBlob);
      };

      recorder.start(250);
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setRecordingTime(0);
      setVoiceActiveTurn(true);

      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => {
          if (prev >= 30) {
            stopRecording();
            return 30;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (err) {
      if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') {
        setErrorMsg('Microphone access was blocked or denied. Please click the permissions icon (tune / lock) in your browser address bar and allow Microphone access.');
      } else if (err?.name === 'NotFoundError' || err?.name === 'DevicesNotFoundError') {
        setErrorMsg('No microphone device found on this system.');
      } else {
        setErrorMsg('Microphone unavailable: ' + (err?.message || 'Please check microphone permissions.'));
      }
    }
  };

  const stopRecording = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const speakVoiceReply = (text, language) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    const langLower = (language || '').toLowerCase();

    if (langLower.includes('hindi')) utterance.lang = 'hi-IN';
    else if (langLower.includes('bengali') || langLower.includes('bangla')) utterance.lang = 'bn-IN';
    else if (langLower.includes('assamese')) utterance.lang = 'as-IN';
    else if (langLower.includes('manipuri')) utterance.lang = 'mni-IN';
    else utterance.lang = 'en-IN';

    utterance.rate = 0.95;
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    speechRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  };

  const stopSpeech = () => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  };

  const processAudioWithGemini = async (blob) => {
    setIsProcessingVoice(true);
    try {
      const reader = new FileReader();
      const base64Promise = new Promise((resolve) => {
        reader.onloadend = () => resolve(reader.result);
      });
      reader.readAsDataURL(blob);
      const audioBase64 = await base64Promise;

      const res = await fetch('/api/ai/voice-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audioBase64,
          mimeType: 'audio/webm',
          currentFormData: {
            hazardType,
            severity,
            description,
            state,
            district,
            latitude: latInput,
            longitude: lngInput,
          },
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to analyze voice input.');
      }

      const data = json.data;
      setVoiceTranscript(data.original_transcript || '');
      setVoiceReply(data.voice_reply_prompt || '');
      setDetectedLang(data.detected_language || 'Detected');
      setIsVoiceComplete(!!data.is_complete);
      setVoiceMissingFields(data.missing_fields || []);

      // Voice assistant is ONLY for the description fill up
      const generatedDesc = data.description_summary || data.original_transcript || '';
      if (generatedDesc) {
        setDescription(generatedDesc);
      }

      // Read out voice response confirmation to driver
      if (data.voice_reply_prompt) {
        speakVoiceReply(data.voice_reply_prompt, data.detected_language);
      }
    } catch (e) {
      console.warn('Voice processing notice:', e?.message || e);
      setErrorMsg('Voice assistant notice: ' + (e?.message || 'Unable to analyze audio.'));
    } finally {
      setIsProcessingVoice(false);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

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
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
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
        if (err?.code === 1 /* PERMISSION_DENIED */) {
          setErrorMsg('Location permission was denied. Please allow location permissions in your browser or click on the map to set coordinates.');
        } else if (err?.code === 2 /* POSITION_UNAVAILABLE */) {
          setErrorMsg('GPS location unavailable. Please select your location on the map.');
        } else if (err?.code === 3 /* TIMEOUT */) {
          setErrorMsg('GPS location timed out. Please try again or select your location on the map.');
        } else {
          setErrorMsg('Could not fetch GPS location: ' + (err?.message || 'Unknown error.'));
        }
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
    const valid = ['landslide', 'flash_flood', 'road_washout', 'tree_fall', 'heavy_waterlogging', 'bridge_damage', 'other'];
    if (valid.includes(normalized)) return normalized;
    if (normalized.includes('other')) return 'other';
    if (normalized.includes('flood')) return 'flash_flood';
    if (normalized.includes('bridge')) return 'bridge_damage';
    if (normalized.includes('cave') || normalized.includes('blockade')) return 'road_washout';
    if (normalized.includes('mud') || normalized.includes('rock')) return 'landslide';
    return 'other';
  };

  const mapSeverity = (sev) => {
    if (!sev || typeof sev !== 'string') return 'high';
    const normalized = sev.toLowerCase();
    const valid = ['low', 'medium', 'high', 'critical'];
    return valid.includes(normalized) ? normalized : 'high';
  };

  // Fast client-side image compression & downscaling for instant AI inspection
  const fileToBase64 = (file) => new Promise((resolve, reject) => {
    if (!file) return reject(new Error('No file provided'));

    // For non-images (videos), read as standard Base64
    if (!file.type || !file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = () => resolve({ data: reader.result, mimeType: file.type || 'video/mp4' });
      reader.onerror = reject;
      reader.readAsDataURL(file);
      return;
    }

    // For images, resize to max 1024px to shrink payload by 98% and speed up AI inference
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const MAX_DIM = 1024;
        let width = img.width;
        let height = img.height;

        if (width > MAX_DIM || height > MAX_DIM) {
          if (width > height) {
            height = Math.round((height * MAX_DIM) / width);
            width = MAX_DIM;
          } else {
            width = Math.round((width * MAX_DIM) / height);
            height = MAX_DIM;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.82);
        resolve({ data: compressedDataUrl, mimeType: 'image/jpeg' });
      };
      img.onerror = () => {
        resolve({ data: e.target.result, mimeType: file.type || 'image/jpeg' });
      };
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

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

    // 2. Enforce NER Regional Boundary Geofence Check
    const geofenceResult = validateNerLocation(finalLat, finalLng);
    if (!geofenceResult.isInside) {
      setErrorMsg(`❌ Out of Operational Zone: ${geofenceResult.reason || 'Hazard coordinates must be inside the 8 North-Eastern states.'}`);
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
    setUploadProgress('🤖 Running Gemini AI disaster forensic inspection on evidence...');

    try {
      // 3. Convert media to Base64 for instant AI Pre-Screening BEFORE Storage Upload
      const base64List = await Promise.all(
        mediaItems.map((item) => fileToBase64(item.file))
      );

      // 4. Gemini Multimodal Disaster Authenticity Forensic Pre-Screen
      let verifyData = null;
      try {
        const verifyRes = await fetch('/api/ai/verify-hazard', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mediaBase64List: base64List,
            declaredHazardType: mapHazardType(hazardType),
            declaredSeverity: mapSeverity(severity),
            description: description.trim(),
            state: state || 'Assam',
            district: district || '',
          }),
        });

        verifyData = await verifyRes.json();
        if (!verifyRes.ok || !verifyData?.success) {
          setErrorMsg(`⚠️ AI Forensic Service Error: ${verifyData?.error || 'Failed to complete image authenticity verification.'}`);
          setSubmitting(false);
          setUploadProgress('');
          return; // HARD STOP!
        }
      } catch (fetchErr) {
        setErrorMsg(`⚠️ AI Forensic Connection Failure: ${fetchErr.message || 'Unable to connect to verification server.'}`);
        setSubmitting(false);
        setUploadProgress('');
        return; // HARD STOP!
      }

      // 5. HARD REJECTION GATE: If AI detects non-disaster, screenshot, fake media, or invalid/gibberish description
      if (!verifyData?.verified || !verifyData?.analysis?.is_real_hazard || !verifyData?.analysis?.is_description_valid) {
        const rejectReason = verifyData?.analysis?.rejection_reason || 
          verifyData?.analysis?.verdict_summary || 
          'The hazard report could not be verified due to invalid media evidence or meaningless description context.';
        
        setErrorMsg(`🚫 AI Verification Rejected: ${rejectReason}`);
        setSubmitting(false);
        setUploadProgress('');
        return; // HARD STOP! Do NOT upload to storage and do NOT insert into database!
      }

      // 6. Media passed AI validation: Proceed to upload evidence to Supabase Storage
      setUploadProgress(`Uploading ${mediaItems.length} verified media file(s)...`);
      const uploadedUrls = [];

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

      setUploadProgress('Saving verified disaster incident record...');

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

      // 7. Insert payload into Supabase with full AI forensic audit data
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
        is_verified: true,
        ai_verified: true,
        ai_confidence: verifyData?.analysis?.authenticity_confidence || 0.9,
        ai_hazard_type: verifyData?.analysis?.detected_hazard_type || dbHazardType,
        ai_verdict_summary: verifyData?.analysis?.verdict_summary || null,
        ai_analysis_raw: verifyData?.analysis || null,
      };

      // Try inserting with full payload
      let { data, error: dbError } = await supabase
        .from('road_hazards')
        .insert([basePayload])
        .select()
        .single();

      // Graceful fallback if database schema cache lacks optional columns
      if (dbError && (dbError.message?.includes('reported_by_id') || dbError.message?.includes('media_urls') || dbError.message?.includes('impact_radius_km') || dbError.message?.includes('ai_') || dbError.code === 'PGRST204')) {
        console.warn('Retrying hazard insertion without optional unmigrated columns:', dbError.message);
        const fallbackPayload = { ...basePayload };
        delete fallbackPayload.reported_by_id;
        delete fallbackPayload.media_urls;
        delete fallbackPayload.ai_verified;
        delete fallbackPayload.ai_confidence;
        delete fallbackPayload.ai_hazard_type;
        delete fallbackPayload.ai_verdict_summary;
        delete fallbackPayload.ai_analysis_raw;
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
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/75 backdrop-blur-md p-3 sm:p-5 overflow-y-auto animate-in fade-in duration-200 font-sans">
      <div className="relative w-full max-w-5xl bg-white dark:bg-[#0f172a] rounded-3xl shadow-2xl border border-slate-200/90 dark:border-slate-800 overflow-hidden flex flex-col md:flex-row my-auto max-h-[94vh]">
        
        {/* =========================================================================
            LEFT BRANDED SIDEBAR (Full-Bleed Road Hazard Image, Highlights, Tagline)
           ========================================================================= */}
        <div className="w-full md:w-[280px] lg:w-[320px] shrink-0 relative overflow-hidden flex flex-col justify-between border-b md:border-b-0 md:border-r border-slate-200/80 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 min-h-[360px] md:min-h-[580px]">
          {/* Full-bleed background image covering 100% of the left panel (slightly zoomed out and with decreased opacity) */}
          <img
            src="/road%20hazard.jpg"
            alt="Road Hazard Terrain in North-East India"
            className="absolute inset-0 w-full h-full object-cover object-center scale-95 opacity-80 transition-all"
          />
          
          {/* Balanced gradient overlay: clear readable tone at top, gentle blend through middle, and dark vignette at bottom */}
          <div className="absolute inset-0 bg-gradient-to-b from-slate-50/95 via-slate-50/50 via-35% to-black/85 dark:from-[#0b1220]/95 dark:via-[#0b1220]/50 dark:via-35% dark:to-black/90 pointer-events-none" />

          {/* Top Section */}
          <div className="relative z-10 p-5 sm:p-6 pb-2 space-y-4">
            {/* Top Brand Header */}
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-cyan-500 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
                <Radio className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-extrabold tracking-tight text-slate-900 dark:text-white leading-none">
                  NER-LOGIX
                </h2>
                <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 mt-0.5">
                  Tactical Logistics
                </p>
              </div>
            </div>

            {/* Feature Highlights with Frosted Glass Protection */}
            <div className="space-y-2.5 my-4">
              {/* 1. Faster Response */}
              <div className="flex items-center gap-2.5 bg-white/85 dark:bg-slate-900/85 backdrop-blur-md p-2 rounded-xl border border-white/80 dark:border-slate-700/60 shadow-2xs">
                <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-950/50 border border-blue-200/80 dark:border-blue-800/60 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
                  <Shield className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 leading-tight">
                    Faster Response
                  </h4>
                  <p className="text-[10.5px] text-slate-500 dark:text-slate-400 leading-tight font-medium">
                    Real-time alerts to field teams
                  </p>
                </div>
              </div>

              {/* 2. Safer Communities */}
              <div className="flex items-center gap-2.5 bg-white/85 dark:bg-slate-900/85 backdrop-blur-md p-2 rounded-xl border border-white/80 dark:border-slate-700/60 shadow-2xs">
                <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200/80 dark:border-emerald-800/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                  <Users className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 leading-tight">
                    Safer Communities
                  </h4>
                  <p className="text-[10.5px] text-slate-500 dark:text-slate-400 leading-tight font-medium">
                    Your reports save lives
                  </p>
                </div>
              </div>

              {/* 3. Stronger Logistics */}
              <div className="flex items-center gap-2.5 bg-white/85 dark:bg-slate-900/85 backdrop-blur-md p-2 rounded-xl border border-white/80 dark:border-slate-700/60 shadow-2xs">
                <div className="w-7 h-7 rounded-lg bg-purple-50 dark:bg-purple-950/50 border border-purple-200/80 dark:border-purple-800/60 flex items-center justify-center text-purple-600 dark:text-purple-400 shrink-0">
                  <BarChart3 className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 leading-tight">
                    Stronger Logistics
                  </h4>
                  <p className="text-[10.5px] text-slate-500 dark:text-slate-400 leading-tight font-medium">
                    Reliable disaster telemetry
                  </p>
                </div>
              </div>
            </div>

            {/* Inspirational Quote */}
            <div className="pt-1">
              <p className="text-sm font-bold italic text-slate-800 dark:text-slate-100 font-serif drop-shadow-xs">
                &ldquo;Every report builds a safer tomorrow.&rdquo;
              </p>
            </div>
          </div>

          {/* Bottom Tagline Overlaid over the Road Hazard Terrain */}
          <div className="relative z-10 p-5 sm:p-6 pt-12">
            <div className="pt-3 border-t border-white/30 dark:border-white/20">
              <p className="text-[11.5px] text-white font-bold drop-shadow-md tracking-wider uppercase">
                Secure Routes • Stronger Northeast
              </p>
            </div>
          </div>
        </div>

        {/* =========================================================================
            RIGHT MAIN FORM (Structured 5-Step Numbered Manifest)
           ========================================================================= */}
        <div className="flex-1 bg-white dark:bg-[#0f172a] flex flex-col overflow-hidden">
          
          {/* Header */}
          <div className="p-5 sm:p-6 pb-4 flex items-start justify-between border-b border-slate-100 dark:border-slate-800/80 shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-rose-600 text-white shadow-md shadow-rose-500/20">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white tracking-tight">
                    Report Field Hazard
                  </h3>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200/60 dark:border-rose-800/60">
                    FORENSIC DISPATCH
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                  Provide verified field intelligence to safeguard relief supply corridors
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form Content */}
          <form onSubmit={handleSubmit} className="p-5 sm:p-6 overflow-y-auto space-y-5 max-h-[calc(94vh-140px)]">

            {/* ----------------------------------------------------
                STEP 1: LOCATION & COORDINATES
               ---------------------------------------------------- */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold shrink-0">
                    1
                  </span>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                      Location & Coordinates
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Pin epicenter on map or fetch current device GPS
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleStartMapPickClick}
                    className="px-3 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer border border-slate-200/80 dark:border-slate-700"
                  >
                    <Map className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                    <span>Pin on Map</span>
                  </button>
                  <button
                    type="button"
                    onClick={fetchLocation}
                    disabled={locating}
                    className="px-3 py-1 rounded-xl bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-600 dark:text-blue-400 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer border border-blue-200/80 dark:border-blue-800/60 disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 text-blue-600 dark:text-blue-400 ${locating ? 'animate-spin' : ''}`} />
                    <span>Use My GPS</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-white dark:bg-slate-800/80 border border-slate-200/90 dark:border-slate-700 rounded-2xl px-3.5 py-2 flex items-center gap-2.5 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 transition-all">
                  <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                  <div className="flex-1">
                    <span className="block text-[9.5px] font-semibold text-slate-400 dark:text-slate-400">
                      Latitude <span className="text-rose-500">*</span>
                    </span>
                    <input
                      type="number"
                      step="any"
                      required
                      value={latInput}
                      onChange={handleLatChange}
                      placeholder="e.g. 26.144500"
                      className="bg-transparent text-xs font-mono text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none w-full font-bold"
                    />
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-800/80 border border-slate-200/90 dark:border-slate-700 rounded-2xl px-3.5 py-2 flex items-center gap-2.5 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 transition-all">
                  <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                  <div className="flex-1">
                    <span className="block text-[9.5px] font-semibold text-slate-400 dark:text-slate-400">
                      Longitude <span className="text-rose-500">*</span>
                    </span>
                    <input
                      type="number"
                      step="any"
                      required
                      value={lngInput}
                      onChange={handleLngChange}
                      placeholder="e.g. 91.736200"
                      className="bg-transparent text-xs font-mono text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none w-full font-bold"
                    />
                  </div>
                </div>
              </div>

              {/* Reverse Geocoding Place Box */}
              {isGeocoding ? (
                <div className="p-2.5 bg-blue-50/70 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/50 rounded-xl flex items-center gap-2 text-xs text-blue-700 dark:text-cyan-400 animate-pulse">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600 dark:text-cyan-400 shrink-0" />
                  <span>Resolving district and sector boundaries...</span>
                </div>
              ) : detectedLocation ? (
                <div className="p-2.5 bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/60 rounded-xl flex items-center gap-2 text-xs text-emerald-900 dark:text-emerald-200">
                  <MapPin className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span className="font-semibold truncate">📍 {detectedLocation.formattedSummary}</span>
                </div>
              ) : null}
            </div>

            {/* ----------------------------------------------------
                STEP 2: HAZARD CLASSIFICATION
               ---------------------------------------------------- */}
            <div className="space-y-2.5">
              <div className="flex items-center gap-2.5">
                <span className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold shrink-0">
                  2
                </span>
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                    Hazard Classification
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Select incident category and disruption level
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700 rounded-2xl p-2.5 flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 shrink-0">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="block text-[9.5px] font-semibold text-slate-400 dark:text-slate-400">
                      Hazard Type <span className="text-rose-500">*</span>
                    </span>
                    <select
                      value={hazardType}
                      required
                      onChange={(e) => setHazardType(e.target.value)}
                      className="w-full bg-transparent text-xs text-slate-800 dark:text-slate-100 font-bold focus:outline-none cursor-pointer truncate"
                    >
                      <option value="landslide" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">🪨 Landslide / Rockfall</option>
                      <option value="flash_flood" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">🌊 Flash Flood / Washout</option>
                      <option value="road_washout" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">🚧 Road Cave-in / Collapse</option>
                      <option value="bridge_damage" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">🌉 Bridge / Culvert Damage</option>
                      <option value="tree_fall" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">🌲 Tree Fall / Debris</option>
                      <option value="heavy_waterlogging" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">🌧️ Severe Waterlogging</option>
                      <option value="other" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">⚠️ Others / Unspecified Hazard</option>
                    </select>
                  </div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700 rounded-2xl p-2.5 flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 shrink-0">
                    <Shield className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="block text-[9.5px] font-semibold text-slate-400 dark:text-slate-400">
                      Severity Level <span className="text-rose-500">*</span>
                    </span>
                    <select
                      value={severity}
                      required
                      onChange={(e) => setSeverity(e.target.value)}
                      className="w-full bg-transparent text-xs text-slate-800 dark:text-slate-100 font-bold focus:outline-none cursor-pointer truncate"
                    >
                      <option value="critical" className="bg-white dark:bg-slate-800 text-rose-600 dark:text-rose-400 font-bold">🛑 Critical (Total Blockade)</option>
                      <option value="high" className="bg-white dark:bg-slate-800 text-rose-600 dark:text-rose-400">🔴 High (Major Disruption)</option>
                      <option value="medium" className="bg-white dark:bg-slate-800 text-amber-600 dark:text-amber-400">🟡 Medium (Caution / Slow)</option>
                      <option value="low" className="bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400">🟢 Low (Passable with Caution)</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* ----------------------------------------------------
                STEP 3: THREAT IMPACT RADIUS
               ---------------------------------------------------- */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold shrink-0">
                    3
                  </span>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                      Threat Danger Radius
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Estimated hazard perimeter buffer zone
                    </p>
                  </div>
                </div>

                <span className="text-xs font-mono font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-3 py-1 rounded-xl border border-blue-200/80 dark:border-blue-800/60">
                  {impactRadiusKm} km Perimeter
                </span>
              </div>

              {/* Preset Buttons */}
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
                      className={`py-2 px-1 rounded-xl text-xs font-semibold transition-all border cursor-pointer text-center ${
                        isSelected
                          ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                          : 'bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 border-slate-200/80 dark:border-slate-700/70 hover:bg-slate-100 dark:hover:bg-slate-700/60'
                      }`}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>

              {/* Slider */}
              <div className="pt-1">
                <input
                  type="range"
                  min="0.5"
                  max="25"
                  step="0.5"
                  value={impactRadiusKm}
                  onChange={(e) => setImpactRadiusKm(parseFloat(e.target.value))}
                  className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
              </div>
            </div>

            {/* ----------------------------------------------------
                STEP 4: DESCRIPTION & VOICE DICTATION
               ---------------------------------------------------- */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold shrink-0">
                    4
                  </span>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                      Description & Clearance Status
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Field dispatch details or multilingual voice dictation
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  {voiceReply && (
                    <button
                      type="button"
                      onClick={isSpeaking ? stopSpeech : () => speakVoiceReply(voiceReply, detectedLang)}
                      className={`px-2.5 py-1 rounded-xl border text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                        isSpeaking
                          ? 'bg-blue-600 text-white border-blue-600 animate-pulse'
                          : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700'
                      }`}
                      title={isSpeaking ? "Stop Voice Playback" : "Replay Spoken Confirmation"}
                    >
                      {isSpeaking ? <VolumeX className="w-3.5 h-3.5 text-white" /> : <Volume2 className="w-3.5 h-3.5 text-slate-500" />}
                      <span className="hidden sm:inline">{isSpeaking ? 'Mute' : 'Replay'}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={isRecording ? stopRecording : startRecording}
                    disabled={isProcessingVoice}
                    className={`text-xs font-semibold px-3 py-1 rounded-xl flex items-center gap-1.5 cursor-pointer transition-all border ${
                      isRecording
                        ? 'bg-red-600 text-white border-red-500 shadow-red-500/40 shadow-xs animate-pulse ring-2 ring-red-400'
                        : isProcessingVoice
                        ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800'
                        : 'text-blue-600 dark:text-blue-400 hover:text-blue-700 bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 dark:hover:bg-blue-900/60 border-blue-200/80 dark:border-blue-800/60'
                    }`}
                    title="Dictate in Hindi, Assamese, Bengali, or English to fill description"
                  >
                    {isProcessingVoice ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600 dark:text-cyan-400" />
                        <span>Transcribing...</span>
                      </>
                    ) : isRecording ? (
                      <>
                        <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                        <MicOff className="w-3.5 h-3.5" />
                        <span className="font-mono">{recordingTime}s • Stop</span>
                      </>
                    ) : (
                      <>
                        <Mic className="w-3.5 h-3.5 text-blue-600 dark:text-cyan-400" />
                        <span>Voice Dictate</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="relative">
                <textarea
                  rows={3}
                  required
                  maxLength={500}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. NH-27 blocked 3km past Haflong due to major rockfall. Excavators active, single lane blocked."
                  className="w-full bg-white dark:bg-slate-800/80 border border-slate-200/90 dark:border-slate-700 rounded-2xl p-3 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 shadow-2xs resize-none leading-relaxed transition-all"
                />
                <div className="text-right text-[10px] text-slate-400 font-mono -mt-1 mr-1">
                  {description.length}/500
                </div>
              </div>

              {/* Dynamic Voice Dictation Feedback Pill */}
              {voiceActiveTurn && (voiceTranscript || voiceReply || isProcessingVoice) && (
                <div className="p-3 bg-slate-900 text-white rounded-2xl text-xs space-y-1.5 border border-slate-800 shadow-md animate-in fade-in">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="font-bold text-cyan-400 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Gemini Voice Dictation ({detectedLang || 'Listening'})</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setVoiceActiveTurn(false)}
                      className="text-slate-400 hover:text-white text-xs cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>
                  {voiceTranscript && (
                    <p className="text-[11px] text-slate-300 italic">
                      🎙️ <span className="font-semibold text-slate-200">Heard:</span> &ldquo;{voiceTranscript}&rdquo;
                    </p>
                  )}
                  {voiceReply && (
                    <div className="text-[11px] text-cyan-200 font-medium pt-1 border-t border-slate-800 flex items-start justify-between gap-2">
                      <span>🤖 {voiceReply}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ----------------------------------------------------
                STEP 5: EVIDENCE MEDIA (PHOTOS / VIDEOS)
               ---------------------------------------------------- */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold shrink-0">
                    5
                  </span>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                      Field Evidence Media
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Upload live photos or video evidence for AI forensic verification
                    </p>
                  </div>
                </div>

                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                  Up to 3 files <span className="text-rose-500 font-bold">(Required)</span>
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                {/* Main Dropzone */}
                <label className={`sm:col-span-6 border-2 border-dashed border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-2xl p-4 flex flex-col items-center justify-center transition-all cursor-pointer text-center group ${mediaItems.length >= 3 ? 'opacity-50 pointer-events-none' : ''}`}>
                  <div className="w-9 h-9 rounded-full bg-blue-50 dark:bg-blue-950/60 border border-blue-100 dark:border-blue-900/60 flex items-center justify-center mb-1.5 group-hover:scale-105 transition-transform text-blue-600 dark:text-blue-400 shadow-2xs">
                    <CloudUpload className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    Drag & drop photos or videos here
                  </span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                    or click to browse (PNG, JPG, MP4 up to 25MB)
                  </span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,video/*"
                    multiple
                    disabled={mediaItems.length >= 3}
                    onChange={handleFilesSelect}
                    className="hidden"
                  />
                </label>

                {/* Thumbnail Slots (3 Slots) */}
                <div className="sm:col-span-6 grid grid-cols-3 gap-2">
                  {[0, 1, 2].map((slotIdx) => {
                    const item = mediaItems[slotIdx];
                    if (item) {
                      return (
                        <div
                          key={`slot-${slotIdx}-${item.name}`}
                          className="relative rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-900 aspect-square flex items-center justify-center group shadow-2xs"
                        >
                          {item.type === 'video' ? (
                            <div className="relative w-full h-full bg-slate-950 flex items-center justify-center">
                              <video src={item.previewUrl} className="w-full h-full object-cover opacity-80" playsInline muted />
                              <Film className="w-4 h-4 text-cyan-300 absolute" />
                              <span className="absolute bottom-1.5 left-1.5 px-1 py-0.2 rounded text-[7.5px] font-mono font-bold bg-black/80 text-cyan-300">
                                VID
                              </span>
                            </div>
                          ) : (
                            <div className="relative w-full h-full">
                              <img src={item.previewUrl} alt={`Evidence ${slotIdx + 1}`} className="w-full h-full object-cover" />
                              <span className="absolute bottom-1.5 left-1.5 px-1 py-0.2 rounded text-[7.5px] font-mono font-bold bg-black/80 text-amber-300">
                                IMG
                              </span>
                            </div>
                          )}
                          <button
                            type="button"
                            onClick={() => handleRemoveMedia(slotIdx)}
                            className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-black/80 hover:bg-rose-600 text-white flex items-center justify-center text-[10px] transition-colors cursor-pointer shadow-md"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      );
                    } else {
                      return (
                        <label
                          key={`empty-slot-${slotIdx}`}
                          className="border border-dashed border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-2xl aspect-square flex items-center justify-center transition-all cursor-pointer text-slate-400 hover:text-slate-600 group"
                        >
                          <Plus className="w-4 h-4 group-hover:scale-110 transition-transform" />
                          <input
                            type="file"
                            accept="image/*,video/*"
                            multiple
                            onChange={handleFilesSelect}
                            className="hidden"
                          />
                        </label>
                      );
                    }
                  })}
                </div>
              </div>
            </div>

            {/* Error / AI Rejection Alert Message */}
            {errorMsg && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/80 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-200 rounded-2xl text-xs font-medium flex items-center gap-2.5 animate-in fade-in">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Upload progress notice */}
            {submitting && uploadProgress && (
              <div className="p-3 bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 rounded-2xl text-xs font-mono flex items-center gap-2.5">
                <Loader2 className="w-4 h-4 animate-spin text-blue-600 dark:text-cyan-400 shrink-0" />
                <span>{uploadProgress}</span>
              </div>
            )}

            {/* Footer Action Buttons */}
            <div className="pt-3 flex items-center justify-between gap-3 border-t border-slate-100 dark:border-slate-800/80">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
              >
                <X className="w-3.5 h-3.5" />
                <span>Cancel</span>
              </button>

              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md shadow-rose-500/20 flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Verifying & Submitting...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Submit Hazard Report</span>
                  </>
                )}
              </button>
            </div>

          </form>
        </div>

      </div>
    </div>
  );
}



