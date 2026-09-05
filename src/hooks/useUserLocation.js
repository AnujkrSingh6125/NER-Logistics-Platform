'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Custom Geolocation Hook for Live Field Positioning
 * Tracks GPS coordinates, accuracy circle (in meters), status, and error states.
 */
export function useUserLocation() {
  const [coords, setCoords] = useState(null); // { lat: number, lng: number }
  const [accuracy, setAccuracy] = useState(null); // in meters
  const [status, setStatus] = useState('idle'); // 'idle' | 'prompting' | 'tracking' | 'denied' | 'error'
  const [errorMessage, setErrorMessage] = useState(null);
  const watchIdRef = useRef(null);

  const startTracking = useCallback(() => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      setStatus('error');
      setErrorMessage('Geolocation is not supported by this browser.');
      return;
    }

    setStatus('prompting');
    setErrorMessage(null);

    // Initial instant fetch + continuous watch
    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, accuracy: acc } = position.coords;
        setCoords({ lat: latitude, lng: longitude });
        setAccuracy(acc);
        setStatus('tracking');
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          setStatus('denied');
          setErrorMessage('Location permission denied. Enable location in browser settings to track live position.');
        } else {
          setStatus('error');
          setErrorMessage(error.message || 'Unable to retrieve location.');
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 5000,
      }
    );
  }, []);

  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null && typeof window !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
      setStatus('idle');
    }
  }, []);

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null && typeof window !== 'undefined' && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  return { coords, accuracy, status, errorMessage, startTracking, stopTracking };
}
