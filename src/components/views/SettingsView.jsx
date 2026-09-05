'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Settings, 
  User, 
  ShieldCheck, 
  ShieldAlert, 
  AlertTriangle, 
  Trash2, 
  Loader2, 
  X, 
  Check, 
  Copy, 
  KeyRound, 
  Lock,
  Truck,
  Building2,
  Phone,
  Mail
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabaseClient';
import LiveClockWidget from '@/components/LiveClockWidget';

export default function SettingsView() {
  const { user, profile, isNodalOfficer, nodalOfficer, signOut } = useAuth();
  const router = useRouter();

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);
  const [copiedUuid, setCopiedUuid] = useState(false);

  const isNodal = isNodalOfficer || profile?.role === 'nodal_officer';
  const displayName = isNodal 
    ? (nodalOfficer?.officer_name || 'State Nodal Authority') 
    : (profile?.full_name || user?.user_metadata?.full_name || 'Anuj');
  
  const rawId = user?.id || profile?.id || nodalOfficer?.id || '';
  const tacticalId = profile?.driver_code 
    || user?.user_metadata?.driver_code 
    || (rawId ? `OP-NER-${rawId.replace(/-/g, '').slice(0, 8).toUpperCase()}` : 'OP-NER-8F3E2B1A');
  const fullUuid = rawId || '8f3e2b1a-9921-4d1e-bf11-0c58a9e21012';

  const copyToClipboard = (text) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedUuid(true);
      setTimeout(() => setCopiedUuid(false), 2000);
    }
  };

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    setDeleteError(null);
    try {
      // 1. Invoke Supabase RPC to purge data and auth record
      const { error: rpcError } = await supabase.rpc('delete_user_account');

      if (rpcError) {
        console.warn('RPC delete_user_account returned error, falling back to direct table purge:', rpcError.message);
        if (user?.id) {
          await supabase.from('driver_profiles').delete().eq('id', user.id);
          await supabase.from('road_hazards').delete().eq('reported_by_id', user.id);
        }
      }

      // 2. Clear storage & sign out
      await signOut();
      if (typeof window !== 'undefined') {
        localStorage.clear();
        sessionStorage.clear();
        window.location.href = '/login';
      }
    } catch (err) {
      console.error('Account deletion failure:', err);
      setDeleteError(err.message || 'Failed to complete account deletion. Please try again.');
      setIsDeleting(false);
    }
  };

  return (
    <div className="flex-1 p-5 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto w-full font-sans">
      
      {/* 1. HERO HEADER SECTION */}
      <div className="relative rounded-3xl bg-gradient-to-r from-blue-50/70 via-slate-50/60 to-white/90 dark:from-slate-900/80 dark:via-slate-900/60 dark:to-slate-950/80 border border-slate-200/90 dark:border-slate-800/90 p-6 sm:p-7 shadow-xs overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          
          <div className="space-y-1.5 max-w-2xl">
            <div className="flex items-center space-x-2">
              <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-blue-600 dark:text-cyan-400 bg-blue-100/70 dark:bg-blue-950/80 px-2 py-0.5 rounded-md border border-blue-200/60 dark:border-blue-800/60">
                # SYSTEM CONFIGURATION
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              Platform & Security Preferences
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
              Manage operator credentials, account security protocols, and GDPR compliance preferences.
            </p>
          </div>

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

      {/* 2. SETTINGS CARDS */}
      <div className="space-y-5">
        
        {/* Operator Profile Card */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-xs p-6 sm:p-7 space-y-6">
          <div className="flex items-center space-x-3 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-sm shadow-xs ${
              isNodal ? 'bg-amber-500 text-slate-950' : 'bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-cyan-400'
            }`}>
              <User className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Operator Profile</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Authenticated field personnel and unique tactical identity</p>
            </div>
          </div>

          {/* Tactical Operator ID (UID) Pod inside Profile */}
          <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-1.5">
            <span className="text-[10px] uppercase text-slate-500 dark:text-slate-400 font-bold block font-mono tracking-wider">
              Tactical Operator ID (Unique UID)
            </span>
            <div className="flex items-center justify-between gap-3">
              <span className="text-blue-600 dark:text-cyan-400 font-bold font-mono text-sm tracking-wider truncate">
                {tacticalId}
              </span>
              <button
                type="button"
                onClick={() => copyToClipboard(fullUuid)}
                title="Copy Full UUID"
                className="px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-200 transition-colors flex items-center gap-1.5 text-xs font-mono font-bold cursor-pointer shrink-0 shadow-2xs"
              >
                {copiedUuid ? <Check className="w-3.5 h-3.5 text-emerald-500"/> : <Copy className="w-3.5 h-3.5"/>}
                <span>{copiedUuid ? 'Copied' : 'Copy UUID'}</span>
              </button>
            </div>
          </div>

          {/* Profile Details Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3 text-xs">
            <div className="flex justify-between items-center py-2.5 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-500">Operator Name:</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">
                {displayName}
              </span>
            </div>

            <div className="flex justify-between items-center py-2.5 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-500">Official Role:</span>
              <span className="font-mono font-bold text-blue-600 dark:text-cyan-400">
                {isNodal ? 'State Nodal Officer' : 'Field Logistics Operator'}
              </span>
            </div>

            <div className="flex justify-between items-center py-2.5 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-500">Registered Email:</span>
              <span className="font-medium text-slate-800 dark:text-slate-200 truncate max-w-[200px]">
                {user?.email || nodalOfficer?.email || 'N/A'}
              </span>
            </div>

            {!isNodal ? (
              <div className="flex justify-between items-center py-2.5 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500">Vehicle Registration:</span>
                <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                  {profile?.vehicle_number || user?.user_metadata?.vehicle_number || 'WB1995'}
                </span>
              </div>
            ) : (
              <div className="flex justify-between items-center py-2.5 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500">Jurisdiction:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  {nodalOfficer?.state || 'NER Regional HQ'}
                </span>
              </div>
            )}

            <div className="flex justify-between items-center py-2.5 border-b border-slate-100 dark:border-slate-800 md:border-b-0">
              <span className="text-slate-500">Department:</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">
                {isNodal ? (nodalOfficer?.department || 'Joint Ops Center') : 'MDoNER Field Operations'}
              </span>
            </div>

            <div className="flex justify-between items-center py-2.5">
              <span className="text-slate-500">Security Clearance:</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">
                AES-256 RLS Hardened
              </span>
            </div>
          </div>
        </div>

      </div>

      {/* 3. DANGER ZONE / ACCOUNT DELETION */}
      <div className="rounded-3xl border-2 border-rose-200 dark:border-rose-900/60 bg-rose-50/40 dark:bg-rose-950/20 p-6 sm:p-7 shadow-xs space-y-4 font-sans">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-rose-200/80 dark:border-rose-900/60">
          <div className="flex items-start space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-100 dark:bg-rose-900/60 flex items-center justify-center text-rose-600 dark:text-rose-400 shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-rose-950 dark:text-rose-200 flex items-center gap-2">
                <span>Danger Zone</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-rose-200/60 dark:bg-rose-900/80 text-rose-800 dark:text-rose-300 font-bold uppercase">
                  Irreversible
                </span>
              </h3>
              <p className="text-xs text-rose-800/80 dark:text-rose-300/80 mt-0.5">
                Complete account deletion and irreversible data purge per GDPR & DPDP standards.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setConfirmText('');
              setDeleteError(null);
              setShowDeleteModal(true);
            }}
            className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl flex items-center justify-center space-x-2 shadow-sm transition-all cursor-pointer shrink-0 self-start sm:self-auto"
          >
            <Trash2 className="w-4 h-4" />
            <span>Delete My Account</span>
          </button>
        </div>

        <div className="text-xs text-rose-900/70 dark:text-rose-300/70 leading-relaxed font-medium">
          Once you delete your account, your driver telemetry profile, active assignment records, and authorization tokens will be permanently purged from the database. You will no longer be able to log in or access regional supply routes.
        </div>
      </div>

      {/* 4. CONFIRMATION MODAL FOR ACCOUNT DELETION */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-[1500] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-150">
          <div className="relative w-full max-w-md bg-white dark:bg-slate-900 border border-rose-300 dark:border-rose-900 rounded-3xl p-6 shadow-2xl font-mono text-xs space-y-5">
            
            {/* Close Button */}
            <button
              type="button"
              onClick={() => !isDeleting && setShowDeleteModal(false)}
              disabled={isDeleting}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-50"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Modal Header */}
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-rose-100 dark:bg-rose-950 flex items-center justify-center text-rose-600 dark:text-rose-400 shrink-0">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                  Confirm Account Purge
                </h3>
                <span className="text-[10px] text-rose-600 dark:text-rose-400 font-bold uppercase tracking-wider">
                  Action Cannot Be Undone
                </span>
              </div>
            </div>

            {/* Warning Message */}
            <div className="p-3.5 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/60 rounded-2xl text-[11px] text-rose-900 dark:text-rose-200 leading-relaxed font-sans">
              You are about to permanently delete your operator account:
              <div className="font-mono font-bold text-xs text-rose-950 dark:text-white mt-1">
                {user?.email || nodalOfficer?.email || displayName}
              </div>
              <ul className="list-disc pl-4 mt-2 space-y-1 text-[10px] text-rose-800 dark:text-rose-300">
                <li>Driver profile and vehicle registration will be erased.</li>
                <li>Reported road hazard records linked to this account will be cleaned up.</li>
                <li>Authentication credentials will be purged from <code className="font-bold">auth.users</code>.</li>
              </ul>
            </div>

            {/* Error notice if any */}
            {deleteError && (
              <div className="p-3 bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 rounded-xl text-[11px] border border-rose-300 dark:border-rose-800 font-sans">
                {deleteError}
              </div>
            )}

            {/* Type Confirmation */}
            <div className="space-y-1.5 font-sans">
              <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block">
                To confirm, type <span className="text-rose-600 dark:text-rose-400 font-mono font-bold">DELETE</span> below:
              </label>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="DELETE"
                disabled={isDeleting}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:border-rose-500 transition-colors"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 pt-1 font-sans">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                disabled={isDeleting}
                className="w-1/2 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleDeleteAccount}
                disabled={confirmText !== 'DELETE' || isDeleting}
                className="w-1/2 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Purging...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Purge Account</span>
                  </>
                )}
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
