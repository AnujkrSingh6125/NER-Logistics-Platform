'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useNav } from '@/context/NavContext';
import { useAuth } from '@/context/AuthContext';
import { 
  Compass, 
  AlertTriangle, 
  Warehouse, 
  Truck, 
  Settings, 
  X,
  ChevronRight,
  Copy,
  Check,
  Shield,
  LogOut,
  Loader2,
  User
} from 'lucide-react';
import MountainLogo from '@/components/MountainLogo';

const NAV_ITEMS = [
  { id: 'command', label: 'Command', icon: Compass },
  { id: 'hazards', label: 'Hazards', icon: AlertTriangle },
  { id: 'hubs', label: 'Hubs', icon: Warehouse },
  { id: 'shipments', label: 'Shipments', icon: Truck },
];

const SECONDARY_ITEMS = [
  { id: 'settings', label: 'Settings', icon: Settings },
];

export default function Sidebar({ 
  isOpen: propIsOpen, 
  onClose: propOnClose, 
  activeTab: propActiveTab, 
  onSelectTab: propOnSelectTab,
  userProfile = null
}) {
  const { currentView, setCurrentView, sidebarOpen, closeSidebar } = useNav();
  const { user, profile, isNodalOfficer, nodalOfficer, signOut } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const [showAccountModal, setShowAccountModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Support both context-based and prop-based control
  const isOpen = propIsOpen !== undefined ? propIsOpen : sidebarOpen;
  const onClose = propOnClose || closeSidebar;
  const activeTab = propActiveTab || currentView;
  const onSelectTab = propOnSelectTab || setCurrentView;

  const isNodal = isNodalOfficer || userProfile?.role === 'nodal_officer' || profile?.role === 'nodal_officer';
  const isAuthenticated = Boolean(user || nodalOfficer || profile);

  // Determine display identity
  const displayName = isNodal 
    ? (nodalOfficer?.officer_name || userProfile?.full_name || 'Nodal Authority')
    : (profile?.full_name || user?.user_metadata?.full_name || userProfile?.full_name || user?.email?.split('@')[0] || 'Guest Operator');

  const displayRole = isNodal ? 'Nodal Officer' : 'Field Operator';
  const userInitial = isAuthenticated ? (displayName.charAt(0).toUpperCase() || 'O') : 'G';

  const rawId = user?.id || profile?.id || nodalOfficer?.id || userProfile?.id || '';
  
  // Tactical User ID generation (derived from driver_code or raw UUID prefix)
  const uniqueTacticalId = profile?.driver_code 
    || user?.user_metadata?.driver_code 
    || userProfile?.driver_code 
    || (rawId ? `OP-NER-${rawId.replace(/-/g, '').slice(0, 8).toUpperCase()}` : 'GUEST-OP');
  
  const fullUuid = rawId || 'N/A';

  const userEmail = user?.email || nodalOfficer?.email || profile?.email || userProfile?.email || 'Not Authenticated';
  const vehiclePlate = profile?.vehicle_number || user?.user_metadata?.vehicle_number || userProfile?.vehicle_number || '';
  const rawPhone = profile?.phone || user?.user_metadata?.phone || nodalOfficer?.phone || userProfile?.phone || '';
  const userPhone = rawPhone ? (rawPhone.startsWith('+91') ? rawPhone : `+91 ${rawPhone}`) : 'Not Provided';

  const copyToClipboard = (text) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await signOut();
    } catch (err) {
      console.warn('Logout notice:', err);
    } finally {
      setIsLoggingOut(false);
      setShowAccountModal(false);
      onClose();
      router.push('/login');
    }
  };

  // Hide on dedicated auth pages
  const isAuthPage = pathname.startsWith('/login') || pathname.startsWith('/nodal-login');
  if (isAuthPage) return null;

  return (
    <>
      {/* Dimmed Backdrop when Sidebar is open */}
      {isOpen && (
        <div 
          onClick={onClose}
          className="fixed inset-0 z-[1200] bg-slate-950/60 backdrop-blur-sm transition-opacity duration-300"
          aria-hidden="true"
        />
      )}

      {/* Sliding Drawer Container */}
      <aside
        className={`fixed top-0 left-0 z-[1300] h-full w-72 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 shadow-2xl transform transition-transform duration-300 ease-in-out flex flex-col justify-between p-4 overflow-y-auto ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div>
          {/* Header with Close Button */}
          <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center space-x-2.5">
              <MountainLogo className="w-8 h-8" />
              <div>
                <span className="font-black font-mono text-slate-900 dark:text-white text-sm tracking-wider block">
                  AshtaMarg
                </span>
                <p className="text-[10px] font-mono text-slate-500 dark:text-slate-400">TACTICAL LOGISTICS</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              title="Close Sidebar"
              className="p-1.5 text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Primary Navigation Tabs */}
          <div className="space-y-1">
            <span className="text-[10px] font-mono uppercase text-slate-400 dark:text-slate-500 px-3 tracking-wider block mb-1">
              Operations
            </span>
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    onSelectTab(item.id);
                    onClose();
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-mono font-medium transition-all cursor-pointer ${
                    isActive
                      ? 'bg-blue-50 dark:bg-cyan-500/10 text-blue-600 dark:text-cyan-400 border border-blue-200 dark:border-cyan-500/30 font-bold shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-blue-600 dark:text-cyan-400' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>

          {/* Secondary Navigation */}
          <div className="space-y-1 mt-6">
            <span className="text-[10px] font-mono uppercase text-slate-400 dark:text-slate-500 px-3 tracking-wider block mb-1">
              Management
            </span>
            {SECONDARY_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    onSelectTab(item.id);
                    onClose();
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-mono font-medium transition-all cursor-pointer ${
                    isActive
                      ? 'bg-blue-50 dark:bg-cyan-500/10 text-blue-600 dark:text-cyan-400 border border-blue-200 dark:border-cyan-500/30 font-bold shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* COMPACT ACCOUNT TRIGGER BUTTON / SIGN IN */}
        <div className="mt-auto pt-3 border-t border-slate-200 dark:border-slate-800">
          {isAuthenticated ? (
            <button
              type="button"
              onClick={() => setShowAccountModal(true)}
              className="w-full p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-950/80 hover:bg-slate-100 dark:hover:bg-slate-800/80 border border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 flex items-center justify-between gap-3 transition-all group text-left cursor-pointer shadow-2xs"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                {/* Account Symbol / Avatar */}
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs font-mono uppercase shrink-0 shadow-xs ${
                  isNodal 
                    ? 'bg-amber-500 text-slate-950' 
                    : 'bg-blue-600 dark:bg-cyan-500 text-white dark:text-slate-950'
                }`}>
                  {userInitial}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-slate-900 dark:text-white truncate leading-tight group-hover:text-blue-600 dark:group-hover:text-cyan-400 transition-colors">
                    {displayName}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[9px] font-mono text-slate-500 dark:text-slate-400 uppercase tracking-wide truncate">
                      {isNodal ? 'Nodal Officer' : 'Field Operator'}
                    </span>
                    {!isNodal && vehiclePlate && (
                      <span className="text-[9px] font-mono text-blue-600 dark:text-cyan-400 font-bold">
                        • {vehiclePlate}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 group-hover:text-slate-700 dark:group-hover:text-white transition-all shrink-0"/>
            </button>
          ) : (
            <Link
              href="/login"
              onClick={onClose}
              className="w-full p-2.5 rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white flex items-center justify-between gap-3 transition-all group text-left cursor-pointer shadow-md shadow-blue-500/20"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center font-bold text-xs font-mono shrink-0">
                  <User className="w-4 h-4 text-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-white truncate leading-tight">
                    Sign In / Register
                  </p>
                  <p className="text-[10px] text-white/80 leading-tight">
                    Access tactical routing & logs
                  </p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-white/80 group-hover:translate-x-0.5 transition-transform shrink-0" />
            </Link>
          )}

          {/* System Version Footnote */}
          <div className="text-[10px] font-mono text-slate-400 dark:text-slate-500 px-1 pt-2.5 flex items-center justify-between">
            <span>AshtaMarg v2.4.0</span>
            <span className="text-blue-600 dark:text-cyan-400 font-bold">8 NER STATES</span>
          </div>
        </div>
      </aside>

      {/* FULL OPERATOR ACCOUNT DOSSIER MODAL */}
      {showAccountModal && (
        <div className="fixed inset-0 z-[1400] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-150">
          <div className="relative w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl font-mono text-xs">
            
            {/* Close Button */}
            <button
              type="button"
              onClick={() => setShowAccountModal(false)}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4"/>
            </button>

            {/* Header / Avatar */}
            <div className="flex items-center gap-3.5 mb-5">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-lg shadow-md ${
                isNodal 
                  ? 'bg-amber-500 text-slate-950' 
                  : 'bg-blue-600 dark:bg-cyan-500 text-white dark:text-slate-950'
              }`}>
                {userInitial}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-bold text-sm text-slate-900 dark:text-white truncate">
                  {displayName}
                </h3>
                <span className={`inline-block text-[10px] px-2 py-0.5 rounded border font-bold uppercase mt-0.5 ${
                  isNodal 
                    ? 'text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/80 border-amber-200 dark:border-amber-800/80' 
                    : 'text-blue-700 dark:text-cyan-400 bg-blue-50 dark:bg-cyan-950/80 border-blue-200 dark:border-cyan-800/80'
                }`}>
                  {isNodal ? 'State Nodal Clearance' : 'Active Field Dispatcher'}
                </span>
              </div>
            </div>

            {/* UNIQUE USER ID POD */}
            <div className="p-3.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl mb-4 space-y-1">
              <span className="text-[9px] uppercase tracking-wider text-slate-500 dark:text-slate-400 block font-bold">
                Tactical Operator ID (Unique UID)
              </span>
              <div className="flex items-center justify-between gap-2">
                <span className="text-blue-600 dark:text-cyan-300 font-bold text-xs tracking-wider truncate">
                  {uniqueTacticalId}
                </span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(fullUuid)}
                  title="Copy Full UUID"
                  className="px-2 py-1 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors flex items-center gap-1 text-[10px] font-bold cursor-pointer shrink-0 shadow-2xs"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-500"/> : <Copy className="w-3.5 h-3.5"/>}
                  <span>{copied ? 'Copied' : 'Copy UUID'}</span>
                </button>
              </div>
            </div>

            {/* Account Details List */}
            <div className="space-y-2.5 pb-4 border-b border-slate-100 dark:border-slate-800 text-slate-700 dark:text-slate-300">
              <div className="flex justify-between items-center py-1 border-b border-slate-100 dark:border-slate-800/50">
                <span className="text-slate-500">Email:</span>
                <span className="text-slate-900 dark:text-white truncate max-w-[180px] font-medium">
                  {userEmail}
                </span>
              </div>

              {!isNodal && (
                <div className="flex justify-between items-center py-1 border-b border-slate-100 dark:border-slate-800/50">
                  <span className="text-slate-500">Vehicle Plate:</span>
                  <span className="text-slate-900 dark:text-white font-bold">
                    {vehiclePlate}
                  </span>
                </div>
              )}

              {isNodal && (
                <div className="flex justify-between items-center py-1 border-b border-slate-100 dark:border-slate-800/50">
                  <span className="text-slate-500">Department / State:</span>
                  <span className="text-slate-900 dark:text-white font-bold truncate max-w-[170px]">
                    {nodalOfficer?.department || nodalOfficer?.state || 'State Disaster Authority'}
                  </span>
                </div>
              )}

              <div className="flex justify-between items-center py-1 border-b border-slate-100 dark:border-slate-800/50">
                <span className="text-slate-500">Mobile Contact:</span>
                <span className="text-slate-900 dark:text-white font-medium">
                  {userPhone}
                </span>
              </div>

              <div className="flex justify-between items-center py-1">
                <span className="text-slate-500">Security Clearance:</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                  <Shield className="w-3 h-3 text-emerald-500" />
                  <span>AES-256 RLS Hardened</span>
                </span>
              </div>
            </div>

            {/* Action Buttons: Settings & Terminate Session */}
            <div className="pt-4 space-y-2">
              <button
                type="button"
                onClick={() => {
                  setShowAccountModal(false);
                  onSelectTab('settings');
                  onClose();
                }}
                className="w-full py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Settings className="w-4 h-4 text-slate-500"/>
                <span>Account & Security Settings</span>
              </button>

              <button
                type="button"
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="w-full py-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-600 text-rose-600 dark:text-rose-400 hover:text-white border border-rose-500/20 text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isLoggingOut ? (
                  <Loader2 className="w-4 h-4 animate-spin text-rose-500" />
                ) : (
                  <LogOut className="w-4 h-4"/>
                )}
                <span>{isLoggingOut ? 'Terminating...' : 'Terminate Session (Log Out)'}</span>
              </button>
            </div>

          </div>
        </div>
      )}
    </>
  );
}

