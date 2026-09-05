'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';

const NavContext = createContext({
  currentView: 'command',
  setCurrentView: () => {},
  mapFocusTarget: null,
  focusOnMap: () => {},
  sidebarOpen: false,
  setSidebarOpen: () => {},
  toggleSidebar: () => {},
  closeSidebar: () => {},
});

export function NavProvider({ children }) {
  const [currentView, setCurrentView] = useState('command');
  const [mapFocusTarget, setMapFocusTarget] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  const toggleSidebar = () => setSidebarOpen((prev) => !prev);
  const closeSidebar = () => setSidebarOpen(false);

  // Sync initial view if hash is present
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash.replace('#', '');
      if (['hazards', 'hubs', 'shipments', 'settings'].includes(hash)) {
        setCurrentView(hash);
      }
    }
  }, []);

  const switchView = (viewName) => {
    setCurrentView(viewName);
    setSidebarOpen(false);
    if (pathname !== '/') {
      router.push('/');
    }
  };

  const focusOnMap = (coords, zoom = 14, extraData = null) => {
    if (coords && coords.length === 2 && !isNaN(coords[0]) && !isNaN(coords[1])) {
      setMapFocusTarget({
        coords: [parseFloat(coords[0]), parseFloat(coords[1])],
        zoom,
        extraData,
        timestamp: Date.now()
      });
    }
    setCurrentView('command');
    setSidebarOpen(false);
    if (pathname !== '/') {
      router.push('/');
    }
  };

  return (
    <NavContext.Provider 
      value={{ 
        currentView, 
        setCurrentView: switchView, 
        mapFocusTarget, 
        focusOnMap,
        sidebarOpen,
        setSidebarOpen,
        toggleSidebar,
        closeSidebar
      }}
    >
      {children}
    </NavContext.Provider>
  );
}

export const useNav = () => useContext(NavContext);
