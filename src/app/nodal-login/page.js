'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { 
  ShieldCheck, 
  Mail, 
  Lock, 
  MapPin, 
  Loader2, 
  CheckCircle2, 
  Eye, 
  EyeOff, 
  AlertCircle, 
  ChevronRight, 
  ChevronDown,
  User, 
  Shield, 
  Truck, 
  Compass, 
  Radio, 
  Building2, 
  Navigation,
  FileCheck2,
  Phone
} from 'lucide-react';
import ThemeToggle from '@/components/ThemeToggle';
import MountainLogo from '@/components/MountainLogo';

const NODAL_DIRECTORATES = [
  {
    id: 'assam',
    state: 'Assam',
    label: 'Assam — ASDMA & State Logistics Cell',
    officer_name: 'Dr. Diganta Sarmah',
    department: 'Assam State Disaster Management Authority (ASDMA)',
    designation: 'State Logistics Coordinator & Joint Director',
    email: 'diganta.sarmah@sdma.assam.gov.in',
    emergency_contact: '+91-94350-12845',
  },
  {
    id: 'arunachal',
    state: 'Arunachal Pradesh',
    label: 'Arunachal Pradesh — BRO & Disaster Cell',
    officer_name: 'Col. Tashi Norbu (Retd.)',
    department: 'Border Roads Organization (BRO) / Disaster Cell',
    designation: 'Chief Disaster Logistics Strategist',
    email: 'tashi.norbu@bro.arunachal.gov.in',
    emergency_contact: '+91-94360-88412',
  },
  {
    id: 'meghalaya',
    state: 'Meghalaya',
    label: 'Meghalaya — PWD & SDRF Transit Command',
    officer_name: 'Bah P. Kharkongor',
    department: 'Meghalaya PWD (Roads & Infrastructure)',
    designation: 'Superintending Engineer & Nodal Officer (Highways)',
    email: 'p.kharkongor@pwd.meghalaya.gov.in',
    emergency_contact: '+91-94361-04290',
  },
  {
    id: 'manipur',
    state: 'Manipur',
    label: 'Manipur — Transport & Relief Ops',
    officer_name: 'Th. Premjit Singh',
    department: 'Manipur State Transport & Disaster Relief Dept',
    designation: 'Director of Inland Tactical Transit',
    email: 'premjit.singh@transport.manipur.gov.in',
    emergency_contact: '+91-94360-31189',
  },
  {
    id: 'mizoram',
    state: 'Mizoram',
    label: 'Mizoram — FCS&CA Supply Operations',
    officer_name: 'Lalrinsanga Ralte',
    department: 'Food, Civil Supplies & Consumer Affairs Dept',
    designation: 'Deputy Director of Supply Operations',
    email: 'lalrinsanga.ralte@fcsca.mizoram.gov.in',
    emergency_contact: '+91-94361-55073',
  },
  {
    id: 'nagaland',
    state: 'Nagaland',
    label: 'Nagaland — NSDMA Logistics Cell',
    officer_name: 'K. Temjen Jamir',
    department: 'Nagaland State Disaster Management Authority (NSDMA)',
    designation: 'Joint Chief Logistics Officer',
    email: 'temjen.jamir@nsdma.nagaland.gov.in',
    emergency_contact: '+91-94360-62410',
  },
  {
    id: 'tripura',
    state: 'Tripura',
    label: 'Tripura — Disaster Rehab & Relief',
    officer_name: 'Subrata Debbarma',
    department: 'Tripura Logistics Cell & Revenue Disaster Division',
    designation: 'State Transit Emergency Coordinator',
    email: 'subrata.debbarma@revenue.tripura.gov.in',
    emergency_contact: '+91-94364-77123',
  },
  {
    id: 'sikkim',
    state: 'Sikkim',
    label: 'Sikkim — SSDMA Mountain Command',
    officer_name: 'Karma Chopel Lepcha',
    department: 'Sikkim State Disaster Management Authority (SSDMA)',
    designation: 'Mountain Logistics & Hazard Response Commander',
    email: 'karma.lepcha@ssdma.sikkim.gov.in',
    emergency_contact: '+91-94341-90864',
  },
];

export default function NodalLoginPage() {
  const router = useRouter();
  const { user, isNodalOfficer, signInNodalOfficer, loading: authLoading } = useAuth();

  const [selectedStateId, setSelectedStateId] = useState('');
  const [selectedOfficer, setSelectedOfficer] = useState(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const hasRedirectedRef = React.useRef(false);

  // If already logged in as nodal officer, redirect to dashboard cleanly
  useEffect(() => {
    if (user && isNodalOfficer && !authLoading && !hasRedirectedRef.current) {
      hasRedirectedRef.current = true;
      router.replace('/');
    }
  }, [user, isNodalOfficer, authLoading, router]);

  // Handle State Dropdown Selection
  const handleDirectorateChange = (e) => {
    const stateId = e.target.value;
    setSelectedStateId(stateId);
    setErrorMsg('');
    setSuccessMsg('');

    if (!stateId) {
      setSelectedOfficer(null);
      return;
    }

    const officer = NODAL_DIRECTORATES.find((d) => d.id === stateId);
    if (officer) {
      setSelectedOfficer(officer);
    }
  };

  // Handle Form Submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setSubmitting(true);

    if (!email.trim()) {
      setErrorMsg('Please select your state jurisdiction or provide department email.');
      setSubmitting(false);
      return;
    }

    if (!password) {
      setErrorMsg('Please enter your authorized nodal passcode.');
      setSubmitting(false);
      return;
    }

    const { data, error } = await signInNodalOfficer({
      email: email.trim().toLowerCase(),
      password: password,
    });

    if (error) {
      setErrorMsg(error.message || 'Authentication rejected. Verification failed against official registry.');
      setSubmitting(false);
    } else {
      setSuccessMsg(`Access Granted! Welcome ${data?.officer?.officer_name || 'Nodal Authority'}. Redirecting...`);
      setTimeout(() => {
        window.location.replace('/');
      }, 500);
    }
  };

  return (
    <div className="min-h-screen bg-[#070d18] text-slate-100 flex flex-col justify-between relative overflow-hidden font-sans selection:bg-amber-500/30 selection:text-amber-200">
      
      {/* 1. ATMOSPHERIC SUNSET MOUNTAIN BACKGROUND (AMBER / GOLD TONE) */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Sky Sunset Gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#060b14] via-[#0d1628] to-[#1c1d38] opacity-90" />
        
        {/* Golden / Amber Horizon Glow */}
        <div className="absolute top-1/4 left-1/3 w-[800px] h-[500px] bg-gradient-to-r from-amber-500/15 via-orange-500/15 to-emerald-600/15 rounded-full blur-[140px]" />
        
        {/* Mountain Horizon Silhouettes */}
        <div className="absolute bottom-0 inset-x-0 h-[450px] bg-gradient-to-t from-[#040810] via-[#080f1e]/80 to-transparent" />
        
        {/* Topographic Contour Lines SVG */}
        <svg className="absolute inset-0 w-full h-full opacity-10 text-amber-500 stroke-current" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 900" fill="none">
          <path d="M-100 200 C300 150, 600 400, 1000 250 C1200 180, 1400 320, 1600 280" strokeWidth="1" strokeDasharray="4 4" />
          <path d="M-100 350 C250 300, 700 550, 1100 380 C1350 280, 1500 420, 1600 390" strokeWidth="1" />
          <path d="M-100 500 C400 420, 800 680, 1200 520 C1400 450, 1550 580, 1600 550" strokeWidth="1" strokeDasharray="6 6" />
          <path d="M-100 650 C500 580, 900 800, 1300 680 C1450 620, 1550 720, 1600 700" strokeWidth="1" />
        </svg>

        {/* Ambient Light Beacons */}
        <div className="absolute top-20 left-1/4 w-1.5 h-1.5 rounded-full bg-amber-400 shadow-[0_0_8px_#f59e0b] animate-pulse" />
        <div className="absolute top-36 left-2/3 w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#10b981] animate-ping" />
        <div className="absolute top-48 left-1/2 w-1 h-1 rounded-full bg-cyan-300 shadow-[0_0_6px_#67e8f9]" />
      </div>

      {/* 2. MAIN CONTENT GRID (Hero Left + Login Card Center/Right) */}
      <main className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-8 py-8 lg:py-12 flex-1 flex items-center">
        <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          
          {/* ================= LEFT HERO COLUMN ================= */}
          <div className="lg:col-span-5 space-y-6 sm:space-y-8 animate-fadeIn">
            
            {/* Platform Brand Identity Header */}
            <Link href="/" className="inline-flex items-center space-x-3 group">
              <MountainLogo className="w-11 h-11 drop-shadow-md group-hover:scale-105 transition-transform" />
              <div>
                <span className="text-xl font-black tracking-tight text-white font-sans block group-hover:text-amber-400 transition-colors">
                  AshtaMarg
                </span>
                <span className="text-[11px] font-medium text-amber-400/90 tracking-wide">
                  State Disaster Logistics • 8 NER States
                </span>
              </div>
            </Link>

            {/* Tagline Badge */}
            <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-amber-950/60 border border-amber-500/30 text-amber-300 text-xs font-mono font-bold tracking-wider shadow-inner">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              <span>GOVERNMENT DISASTER RESPONSE COMMAND</span>
            </div>

            {/* Main Headline */}
            <div className="space-y-3">
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight leading-[1.15]">
                Transit Command for{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-orange-300 to-emerald-400">
                  State Disaster Authorities
                </span>
              </h1>
              <p className="text-sm text-slate-300 leading-relaxed font-sans max-w-lg">
                Official logistics coordination, fleet radar monitoring, and high-altitude road obstruction clearance across the 8 North Eastern States.
              </p>
            </div>

            {/* 4 Command Capability Badges */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              
              <div className="bg-slate-900/60 hover:bg-slate-900/90 border border-slate-800 hover:border-amber-500/40 rounded-2xl p-3 text-center space-y-1.5 transition-all group backdrop-blur-md">
                <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400 group-hover:scale-110 transition-transform">
                  <Radio className="w-4 h-4" />
                </div>
                <div className="text-[11px] font-bold text-slate-200">Fleet Radar</div>
              </div>

              <div className="bg-slate-900/60 hover:bg-slate-900/90 border border-slate-800 hover:border-amber-500/40 rounded-2xl p-3 text-center space-y-1.5 transition-all group backdrop-blur-md">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400 group-hover:scale-110 transition-transform">
                  <FileCheck2 className="w-4 h-4" />
                </div>
                <div className="text-[11px] font-bold text-slate-200">Hazard Verification</div>
              </div>

              <div className="bg-slate-900/60 hover:bg-slate-900/90 border border-slate-800 hover:border-amber-500/40 rounded-2xl p-3 text-center space-y-1.5 transition-all group backdrop-blur-md">
                <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center mx-auto text-cyan-400 group-hover:scale-110 transition-transform">
                  <Building2 className="w-4 h-4" />
                </div>
                <div className="text-[11px] font-bold text-slate-200">Hub Stockpiles</div>
              </div>

              <div className="bg-slate-900/60 hover:bg-slate-900/90 border border-slate-800 hover:border-amber-500/40 rounded-2xl p-3 text-center space-y-1.5 transition-all group backdrop-blur-md">
                <div className="w-8 h-8 rounded-xl bg-orange-500/10 border border-orange-500/30 flex items-center justify-center mx-auto text-orange-400 group-hover:scale-110 transition-transform">
                  <Navigation className="w-4 h-4" />
                </div>
                <div className="text-[11px] font-bold text-slate-200">Transit Corridors</div>
              </div>

            </div>

            {/* 8 State Directorates Coverage List */}
            <div className="bg-slate-950/80 border border-slate-800/80 rounded-2xl p-4 backdrop-blur-md space-y-3">
              <div className="flex items-center justify-between text-xs font-mono text-slate-400 pb-2 border-b border-slate-800">
                <span className="font-bold text-slate-200 uppercase flex items-center space-x-1.5">
                  <Shield className="w-3.5 h-3.5 text-amber-400" />
                  <span>8 STATE DISASTER DIRECTORATES</span>
                </span>
                <span className="text-[10px] text-emerald-400 font-bold flex items-center space-x-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>AUTHORITATIVE WHITELIST</span>
                </span>
              </div>

              <div className="grid grid-cols-2 gap-y-1.5 gap-x-4 text-xs font-mono text-slate-300">
                {NODAL_DIRECTORATES.map((dir) => (
                  <button
                    key={dir.id}
                    type="button"
                    onClick={() => {
                      setSelectedStateId(dir.id);
                      setSelectedOfficer(dir);
                    }}
                    className={`flex items-center space-x-2 text-left transition-colors cursor-pointer ${
                      selectedStateId === dir.id ? 'text-amber-300 font-bold' : 'hover:text-slate-200'
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${selectedStateId === dir.id ? 'bg-amber-400 shadow-[0_0_8px_#f59e0b]' : 'bg-slate-600'}`} />
                    <span className="truncate">{dir.state} ({dir.department.split(' ')[0]})</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Watermark Quote */}
            <div className="pt-2">
              <span className="text-sm font-serif italic text-slate-400/80 tracking-wide">
                Preparedness Saves Lives
              </span>
            </div>

          </div>

          {/* ================= CENTER / RIGHT NODAL LOGIN CARD ================= */}
          <div className="lg:col-span-4 flex justify-center">
            
            {/* Tactical Glassmorphic Nodal Login Card */}
            <div className="w-full max-w-md bg-slate-900/85 backdrop-blur-2xl border border-amber-500/40 rounded-3xl p-6 sm:p-8 shadow-[0_0_50px_rgba(245,158,11,0.18)] space-y-6 relative overflow-hidden">
              
              {/* Subtle Card Background Radial Highlights */}
              <div className="absolute top-0 right-0 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute bottom-0 left-0 w-48 h-48 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />

              {/* Top Shield Badge & Header */}
              <div className="text-center space-y-2 relative z-10">
                <div className="w-12 h-12 rounded-2xl bg-amber-950/60 border border-amber-500/40 flex items-center justify-center mx-auto text-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.3)]">
                  <ShieldCheck className="w-6 h-6" />
                </div>

                <h2 className="text-2xl sm:text-3xl font-black font-sans text-white tracking-tight">
                  State Command <span className="text-amber-400">HQ</span>
                </h2>
                
                <p className="text-xs text-slate-400 font-sans">
                  Official State Nodal Officer Passcode Gateway
                </p>
              </div>

              {/* Feedback Notifications */}
              {errorMsg && (
                <div className="p-3 rounded-xl bg-rose-950/70 border border-rose-800 text-rose-300 text-xs font-sans flex items-start space-x-2 animate-fadeIn relative z-10">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {successMsg && (
                <div className="p-3 rounded-xl bg-emerald-950/70 border border-emerald-800 text-emerald-300 text-xs font-sans flex items-start space-x-2 animate-fadeIn relative z-10">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
                  <span>{successMsg}</span>
                </div>
              )}

              {/* NODAL AUTHENTICATION FORM */}
              <form onSubmit={handleSubmit} className="space-y-4 font-sans relative z-10" autoComplete="off">
                
                {/* State Jurisdiction Selector */}
                <div>
                  <label className="block text-[11px] font-mono font-bold uppercase text-slate-400 mb-1">
                    State Jurisdiction & Directorate *
                  </label>
                  <div className="relative">
                    <select
                      value={selectedStateId}
                      onChange={handleDirectorateChange}
                      className="w-full bg-slate-950/90 border border-slate-800 focus:border-amber-400 focus:ring-1 focus:ring-amber-400 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none transition-all pl-9 pr-9 appearance-none cursor-pointer"
                    >
                      <option value="" className="bg-slate-900 text-slate-400">
                        -- Select State Directorate Jurisdiction --
                      </option>
                      {NODAL_DIRECTORATES.map((d) => (
                        <option key={d.id} value={d.id} className="bg-slate-900 text-white">
                          {d.label}
                        </option>
                      ))}
                    </select>
                    <MapPin className="w-4 h-4 text-amber-500 absolute left-3 top-3 pointer-events-none" />
                    <ChevronDown className="w-4 h-4 text-slate-500 absolute right-3 top-3 pointer-events-none" />
                  </div>
                </div>

                {/* Officer Record Preview Badge */}
                {selectedOfficer && (
                  <div className="p-3 rounded-2xl bg-amber-500/5 border border-amber-500/20 space-y-1.5 text-xs font-mono">
                    <div className="flex items-center justify-between text-amber-300 font-bold">
                      <span className="truncate">{selectedOfficer.officer_name}</span>
                      <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-[9px] uppercase border border-amber-500/30">
                        {selectedOfficer.state}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400 leading-tight">
                      {selectedOfficer.designation}
                    </div>
                    <div className="text-[10px] text-slate-400 flex items-center space-x-1 pt-0.5">
                      <Phone className="w-3 h-3 text-amber-400 shrink-0" />
                      <span>{selectedOfficer.emergency_contact}</span>
                    </div>
                  </div>
                )}

                {/* Department Email */}
                <div>
                  <label className="block text-[11px] font-mono font-bold uppercase text-slate-400 mb-1">
                    Department Email *
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="e.g. officer@sdma.gov.in"
                      autoComplete="off"
                      className="w-full bg-slate-950/90 border border-slate-800 focus:border-amber-400 focus:ring-1 focus:ring-amber-400 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 outline-none transition-all pl-9 font-mono"
                    />
                    <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                  </div>
                </div>

                {/* Department Nodal Passcode */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] font-mono font-bold uppercase text-slate-400">
                      Nodal Passcode *
                    </label>
                  </div>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter authorized nodal passcode"
                      autoComplete="new-password"
                      className="w-full bg-slate-950/90 border border-slate-800 focus:border-amber-400 focus:ring-1 focus:ring-amber-400 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 outline-none transition-all pl-9 pr-9 font-mono"
                    />
                    <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-3 text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-gradient-to-r from-amber-400 via-orange-500 to-emerald-500 hover:from-amber-300 hover:to-emerald-400 text-slate-950 font-bold text-xs uppercase tracking-wider py-3.5 px-4 rounded-2xl shadow-[0_0_20px_rgba(245,158,11,0.4)] flex items-center justify-center space-x-2 transition-all cursor-pointer disabled:opacity-50 mt-2"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                      <span>VERIFYING CLEARANCE...</span>
                    </>
                  ) : (
                    <>
                      <span>Access Command HQ</span>
                      <ChevronRight className="w-4 h-4 text-slate-950" />
                    </>
                  )}
                </button>

              </form>

            </div>

          </div>

          {/* ================= RIGHT AMBIENT QUOTE CARD ================= */}
          <div className="lg:col-span-3 hidden lg:flex flex-col items-start justify-center space-y-4 pl-4 animate-fadeIn">
            
            {/* Handwritten Title Badge */}
            <div className="text-xl font-serif italic text-amber-200/90 tracking-wide">
              “State Command Authority”
            </div>

            {/* Glass Quote Card */}
            <div className="w-full bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-5 shadow-xl space-y-2">
              <p className="text-xs text-slate-300 italic leading-relaxed">
                “Rapid coordination bridges mountain logistics in times of crisis.”
              </p>
              <div className="text-[10px] font-mono font-bold text-amber-400 tracking-wider">
                — MDoNER SDMA Command
              </div>
            </div>

          </div>

        </div>
      </main>

      {/* 4. BOTTOM SECURITY FOOTER STRIP */}
      <footer className="relative z-20 w-full px-6 sm:px-10 py-4 border-t border-white/5 backdrop-blur-sm flex flex-col sm:flex-row items-center justify-between gap-3 font-mono text-[11px] text-slate-400">
        
        {/* Left Security Indicators */}
        <div className="flex flex-wrap items-center gap-3 text-slate-400">
          <span className="flex items-center space-x-1 text-amber-400">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span className="font-bold">Restricted Department Portal</span>
          </span>
          <span>|</span>
          <span>256-bit PostGIS Spatial Encryption</span>
          <span>|</span>
          <span>Authorized Nodal Officers Only</span>
        </div>

        {/* Right Policy Links */}
        <div className="flex items-center space-x-4 text-slate-400">
          <button type="button" className="hover:text-amber-300 transition-colors cursor-pointer">Department Help</button>
          <span>|</span>
          <button type="button" className="hover:text-amber-300 transition-colors cursor-pointer">Protocol</button>
          <span>|</span>
          <button type="button" className="hover:text-amber-300 transition-colors cursor-pointer">Contact HQ</button>
        </div>

      </footer>

    </div>
  );
}
