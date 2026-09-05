'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { 
  User, 
  LogOut, 
  Trash2, 
  ChevronDown, 
  ShieldCheck, 
  Truck, 
  ShieldAlert, 
  AlertTriangle, 
  X, 
  Loader2, 
  Building2, 
  Mail, 
  MapPin, 
  CheckCircle2,
  Lock
} from 'lucide-react';

export default function AccountMenu() {
  const { user, profile, nodalOfficer, isNodalOfficer, signOut, deleteAccount, loading } = useAuth();
  const router = useRouter();

  const [isOpen, setIsOpen] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const menuRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle Logout
  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await signOut();
      setIsOpen(false);
      router.push('/login');
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setIsLoggingOut(false);
    }
  };

  // Handle Account Deletion
  const handleDeleteAccount = async () => {
    if (deleteConfirmText.trim().toUpperCase() !== 'DELETE') {
      setDeleteError('Please type DELETE to confirm account purge.');
      return;
    }

    setIsDeleting(true);
    setDeleteError('');

    try {
      const res = await deleteAccount();
      if (res && res.error) {
        throw new Error(res.error);
      }
      setShowDeleteModal(false);
      setIsOpen(false);
      router.push('/login');
    } catch (err) {
      console.error('Account deletion error:', err);
      setDeleteError(err.message || 'Failed to purge account. Please try again.');
      setIsDeleting(false);
    }
  };

  // If loading auth state
  if (loading) {
    return (
      <div className="flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-slate-500 text-xs font-mono">
        <div className="w-2 h-2 rounded-full bg-slate-400 animate-ping" />
        <span>SYNCING...</span>
      </div>
    );
  }

  // If guest (not logged in)
  if (!user && !nodalOfficer) {
    return null;
  }

  // Determine display attributes
  const displayName = isNodalOfficer
    ? nodalOfficer?.officer_name || 'Nodal Authority'
    : profile?.full_name || user?.email?.split('@')[0] || 'Field Operator';

  const displayEmail = isNodalOfficer
    ? nodalOfficer?.email || 'officer@sdma.gov.in'
    : user?.email || profile?.phone || 'No email attached';

  const roleLabel = isNodalOfficer ? 'NODAL OFFICER' : 'FIELD OPERATOR';
  const roleDepartment = isNodalOfficer
    ? nodalOfficer?.department || `${nodalOfficer?.state || 'State'} Disaster Authority`
    : profile?.state ? `${profile.state} Sector` : 'NER Field Logistics Unit';

  const initialLetter = displayName.charAt(0).toUpperCase();

  return (
    <div className="relative font-mono" ref={menuRef}>
      
      {/* Interactive Account Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 bg-slate-100/90 hover:bg-slate-200/80 border border-slate-200 rounded-2xl p-1.5 pl-2.5 transition-all cursor-pointer group shadow-2xs"
      >
        {/* Avatar badge */}
        <div className={`w-7 h-7 rounded-xl flex items-center justify-center font-bold text-xs text-white shadow-xs ${
          isNodalOfficer ? 'bg-gradient-to-tr from-amber-600 to-amber-500' : 'bg-gradient-to-tr from-blue-600 to-cyan-500'
        }`}>
          {isNodalOfficer ? <ShieldCheck className="w-4 h-4" /> : initialLetter}
        </div>

        {/* Name & Role preview */}
        <div className="flex flex-col text-left pr-1 hidden sm:flex">
          <div className="flex items-center space-x-1.5">
            <span className="text-xs font-bold text-slate-900 truncate max-w-[130px]">
              {displayName}
            </span>
          </div>
          <span className={`text-[9px] font-bold uppercase tracking-wider ${
            isNodalOfficer ? 'text-amber-700' : 'text-blue-700'
          }`}>
            {roleLabel}
          </span>
        </div>

        {/* Chevron icon */}
        <ChevronDown className={`w-3.5 h-3.5 text-slate-500 transition-transform duration-200 ${
          isOpen ? 'rotate-180 text-blue-600' : 'group-hover:text-slate-800'
        }`} />
      </button>

      {/* Flyout Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 sm:w-80 bg-white rounded-3xl border border-slate-200 shadow-2xl z-[100] overflow-hidden animate-fadeIn">
          
          {/* Header Profile Card */}
          <div className={`p-4 text-white ${
            isNodalOfficer 
              ? 'bg-gradient-to-br from-slate-900 via-amber-950 to-slate-900' 
              : 'bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900'
          }`}>
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-3">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-base text-white shadow-md ${
                  isNodalOfficer ? 'bg-amber-600' : 'bg-blue-600'
                }`}>
                  {isNodalOfficer ? <ShieldCheck className="w-5 h-5" /> : initialLetter}
                </div>
                <div>
                  <h4 className="text-sm font-bold truncate max-w-[160px] text-white">
                    {displayName}
                  </h4>
                  <p className="text-[10px] text-slate-300 truncate max-w-[160px]">
                    {displayEmail}
                  </p>
                </div>
              </div>

              <span className={`px-2 py-0.5 rounded-full text-[8px] font-bold uppercase border ${
                isNodalOfficer 
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/50' 
                  : 'bg-blue-500/20 text-cyan-300 border-blue-500/50'
              }`}>
                {roleLabel}
              </span>
            </div>

            {/* Department/Sector & Tactical Driver Code */}
            <div className="mt-3 pt-2.5 border-t border-slate-700/60 flex items-center justify-between text-[10px] text-slate-300">
              <div className="flex items-center space-x-1.5 truncate max-w-[180px]">
                <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="truncate">{roleDepartment}</span>
              </div>
              {profile?.driver_code && !isNodalOfficer && (
                <span className="font-mono text-cyan-300 font-bold px-1.5 py-0.5 rounded bg-cyan-950/80 border border-cyan-800 text-[9px]">
                  {profile.driver_code}
                </span>
              )}
            </div>
          </div>

          {/* Action Menu Items */}
          <div className="p-2 space-y-1 font-sans">
            
            {/* 1. Sign Out Button */}
            <button
              type="button"
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="w-full flex items-center space-x-2.5 px-3 py-2.5 rounded-2xl text-xs font-mono font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4 text-slate-500" />
              <span>{isLoggingOut ? 'Signing out...' : 'Sign Out Session'}</span>
            </button>

            {/* Divider */}
            <div className="my-1 border-t border-slate-100" />

            {/* 2. Delete Account (Danger Zone) */}
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                setShowDeleteModal(true);
                setDeleteConfirmText('');
                setDeleteError('');
              }}
              className="w-full flex items-center space-x-2.5 px-3 py-2.5 rounded-2xl text-xs font-mono font-bold text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
            >
              <Trash2 className="w-4 h-4 text-rose-500" />
              <span>Delete Account (Purge Data)</span>
            </button>

          </div>

        </div>
      )}

      {/* Delete Account Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-xs animate-fadeIn font-mono">
          <div className="bg-white rounded-3xl border border-rose-200 shadow-2xl w-full max-w-md overflow-hidden animate-scaleIn">
            
            {/* Modal Header */}
            <div className="p-4 sm:p-5 bg-rose-50 border-b border-rose-100 flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-rose-600 text-white flex items-center justify-center shadow-xs">
                  <ShieldAlert className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-rose-950 uppercase tracking-wide">
                    Permanent Account Purge
                  </h3>
                  <p className="text-[10px] text-rose-700 font-sans">
                    Cascade GDPR-Compliant Data Erasure
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-800 hover:bg-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4 font-sans">
              
              <div className="bg-rose-50/60 border border-rose-200/80 rounded-2xl p-3.5 text-xs text-rose-900 space-y-1.5">
                <div className="font-bold flex items-center space-x-1.5 text-rose-800 font-mono">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>WARNING: THIS ACTION CANNOT BE UNDONE</span>
                </div>
                <p className="text-[11px] leading-relaxed text-rose-900/90">
                  Deleting this account permanently erases your user credentials, authenticating keys, and profile records from the tactical platform. Any linked hazard alerts will be anonymized.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 font-mono">
                  To confirm, type <strong className="text-rose-600">DELETE</strong> below:
                </label>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder="Type DELETE to confirm"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-rose-500 font-bold tracking-wider"
                />
              </div>

              {deleteError && (
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-mono">
                  {deleteError}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDeleteModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-mono text-xs font-bold transition-colors cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleDeleteAccount}
                  disabled={deleteConfirmText.trim().toUpperCase() !== 'DELETE' || isDeleting}
                  className="flex-2 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-mono text-xs font-bold uppercase tracking-wider shadow-md shadow-rose-600/20 flex items-center justify-center space-x-1.5 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isDeleting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Purging Account...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Permanently Delete</span>
                    </>
                  )}
                </button>
              </div>

            </div>

          </div>
        </div>
      )}

    </div>
  );
}
