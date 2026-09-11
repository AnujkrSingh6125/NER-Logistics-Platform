'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, X, ChevronDown, Check, MapPin, LocateFixed } from 'lucide-react';

export default function SearchableHubSelect({
  hubs = [],
  value = '',
  onChange,
  placeholder = 'Select Supply Hub',
  allowCurrentLocation = false,
  disabledValue = '',
  disabledTooltip = 'Already Selected',
  accentColor = 'blue', // 'blue' | 'emerald' | 'rose'
  className = '',
  id = ''
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef(null);
  const searchInputRef = useRef(null);

  // Close dropdown on click outside or Escape key
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
      // Auto-focus search input when opening
      setTimeout(() => {
        if (searchInputRef.current) {
          searchInputRef.current.focus();
        }
      }, 50);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // Find currently selected hub object or state
  const isCurrentLocation = value === 'CURRENT_LOCATION';
  const selectedHub = useMemo(() => {
    if (!value || isCurrentLocation) return null;
    return hubs.find((h) => (h.hub_code && h.hub_code === value) || (h.id && h.id === value)) || null;
  }, [value, hubs, isCurrentLocation]);

  // Filter hubs based on search query (by hub_name, hub_code, state, district)
  const filteredHubs = useMemo(() => {
    if (!searchQuery.trim()) return hubs;
    const q = searchQuery.toLowerCase().trim();
    return hubs.filter((h) => {
      const nameMatch = h.hub_name?.toLowerCase().includes(q);
      const codeMatch = h.hub_code?.toLowerCase().includes(q);
      const stateMatch = h.state?.toLowerCase().includes(q);
      const districtMatch = h.district?.toLowerCase().includes(q);
      return nameMatch || codeMatch || stateMatch || districtMatch;
    });
  }, [hubs, searchQuery]);

  // Determine if Current Location should be shown in filtered search results
  const showCurrentLocationOption = useMemo(() => {
    if (!allowCurrentLocation) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      'current location'.includes(q) ||
      'gps'.includes(q) ||
      'live position'.includes(q) ||
      'my location'.includes(q)
    );
  }, [allowCurrentLocation, searchQuery]);

  // Handle Hub Selection
  const handleSelect = (hubVal) => {
    if (onChange) {
      onChange(hubVal);
    }
    setIsOpen(false);
    setSearchQuery('');
  };

  // Toggle dropdown
  const toggleDropdown = () => {
    setIsOpen((prev) => !prev);
    if (!isOpen) {
      setSearchQuery('');
    }
  };

  // Accent styles for dot/indicator
  const dotColorClass = 
    accentColor === 'emerald' ? 'bg-emerald-500' :
    accentColor === 'rose' ? 'bg-rose-500' :
    'bg-[#0284c7]';

  return (
    <div className={`relative w-full ${className}`} ref={dropdownRef} id={id}>
      {/* TRIGGER BUTTON */}
      <button
        type="button"
        onClick={toggleDropdown}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={`w-full bg-slate-50 dark:bg-slate-950 hover:bg-slate-100/80 dark:hover:bg-slate-900 border ${
          isOpen
            ? 'border-[#0284c7] ring-1 ring-[#0284c7]'
            : 'border-slate-200/90 dark:border-slate-800'
        } rounded-xl py-2 px-3 text-xs text-slate-800 dark:text-slate-200 font-sans flex items-center justify-between min-h-[44px] text-left transition-all cursor-pointer shadow-xs`}
      >
        <div className="flex items-center space-x-2 min-w-0 flex-1 pr-2">
          {isCurrentLocation ? (
            <div className="flex items-center space-x-1.5 truncate">
              <span className="text-sm shrink-0">📍</span>
              <span className="font-bold text-[#0284c7] dark:text-cyan-400 truncate">
                My Current Location (Live GPS Position)
              </span>
            </div>
          ) : selectedHub ? (
            <div className="flex items-center space-x-2 truncate">
              <span className={`w-2 h-2 rounded-full ${dotColorClass} shrink-0`} />
              <div className="flex items-baseline space-x-1.5 truncate">
                <span className="font-bold text-slate-900 dark:text-white truncate">
                  {selectedHub.hub_name}
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate font-medium">
                  • {selectedHub.state}
                </span>
                <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 bg-slate-200/70 dark:bg-slate-800 px-1.5 py-0.2 rounded shrink-0">
                  {selectedHub.hub_code}
                </span>
              </div>
            </div>
          ) : (
            <div className="flex items-center space-x-1.5 text-slate-400 dark:text-slate-500">
              <MapPin className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{placeholder}</span>
            </div>
          )}
        </div>

        <div className="flex items-center space-x-1 text-slate-400 shrink-0">
          <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180 text-[#0284c7]' : ''}`} />
        </div>
      </button>

      {/* DROPDOWN POPUP MENU */}
      {isOpen && (
        <div className="absolute z-50 left-0 right-0 top-full mt-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 font-sans">
          
          {/* SEARCH INPUT BAR */}
          <div className="p-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-950/90 backdrop-blur-sm">
            <div className="relative flex items-center">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by hub name or code (e.g. HUB-ASM-001)..."
                className="w-full pl-8 pr-7 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:border-[#0284c7] focus:ring-1 focus:ring-[#0284c7]"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded cursor-pointer"
                  title="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* LIST OF HUBS / CURRENT LOCATION */}
          <div className="max-h-56 overflow-y-auto custom-scrollbar divide-y divide-slate-100 dark:divide-slate-800/60">
            
            {/* 1. Live GPS Current Location Option */}
            {showCurrentLocationOption && (
              <button
                type="button"
                onClick={() => handleSelect('CURRENT_LOCATION')}
                className={`w-full p-2.5 text-left flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                  isCurrentLocation
                    ? 'bg-blue-50 dark:bg-blue-950/60 text-[#0284c7] dark:text-cyan-400 font-bold'
                    : 'hover:bg-blue-50/60 dark:hover:bg-blue-950/40 text-blue-600 dark:text-cyan-400'
                }`}
              >
                <div className="flex items-center space-x-2 min-w-0">
                  <LocateFixed className="w-4 h-4 shrink-0 text-[#0284c7] dark:text-cyan-400" />
                  <div>
                    <span className="text-xs font-bold block">
                      📍 My Current Location
                    </span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-normal block">
                      Use active hardware GPS telemetry as route start
                    </span>
                  </div>
                </div>
                {isCurrentLocation && (
                  <Check className="w-4 h-4 text-[#0284c7] dark:text-cyan-400 shrink-0" />
                )}
              </button>
            )}

            {/* 2. Hub Items */}
            {filteredHubs.length > 0 ? (
              filteredHubs.map((h) => {
                const hubVal = h.hub_code || h.id;
                const isSelected = value === hubVal || value === h.id || value === h.hub_code;
                const isDisabled = Boolean(disabledValue && (disabledValue === hubVal || disabledValue === h.id || disabledValue === h.hub_code));

                return (
                  <button
                    key={`hub-opt-${hubVal}`}
                    type="button"
                    disabled={isDisabled}
                    onClick={() => !isDisabled && handleSelect(hubVal)}
                    className={`w-full p-2.5 text-left flex items-center justify-between gap-2 transition-colors ${
                      isDisabled
                        ? 'opacity-40 cursor-not-allowed bg-slate-50/50 dark:bg-slate-900/50'
                        : isSelected
                        ? 'bg-blue-50 dark:bg-blue-950/50 text-[#0284c7] dark:text-cyan-400 cursor-pointer font-bold'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/70 text-slate-800 dark:text-slate-200 cursor-pointer'
                    }`}
                  >
                    <div className="min-w-0 flex-1 pr-2">
                      <div className="flex items-center space-x-1.5">
                        <span className="text-xs font-bold truncate text-slate-900 dark:text-slate-100">
                          {h.hub_name}
                        </span>
                        {isDisabled && (
                          <span className="text-[10px] font-normal text-rose-500 italic shrink-0">
                            ({disabledTooltip})
                          </span>
                        )}
                      </div>
                      <div className="text-[10.5px] text-slate-500 dark:text-slate-400 truncate flex items-center space-x-1 mt-0.5">
                        <span className="font-semibold text-slate-700 dark:text-slate-300">{h.state}</span>
                        {h.district && <span>• {h.district}</span>}
                      </div>
                    </div>

                    <div className="flex items-center space-x-1.5 shrink-0">
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700">
                        {h.hub_code}
                      </span>
                      {isSelected && (
                        <Check className="w-4 h-4 text-[#0284c7] dark:text-cyan-400" />
                      )}
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="p-4 text-center text-slate-400 dark:text-slate-500 text-xs">
                <p className="font-medium">No supply hubs found matching &quot;{searchQuery}&quot;</p>
                <p className="text-[10px] mt-1 text-slate-400">Try searching by city name, state (e.g. Assam, Tripura), or code (e.g. HUB-ASM-001)</p>
              </div>
            )}
          </div>

          {/* FOOTER STATS & ESC HINT */}
          <div className="p-1.5 px-3 bg-slate-50 dark:bg-slate-950/80 border-t border-slate-100 dark:border-slate-800 text-[10px] text-slate-400 dark:text-slate-500 flex items-center justify-between">
            <span>
              Showing {filteredHubs.length} of {hubs.length} facilities
            </span>
            <span className="font-mono">
              ESC to close
            </span>
          </div>

        </div>
      )}
    </div>
  );
}
