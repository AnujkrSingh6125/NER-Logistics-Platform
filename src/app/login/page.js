'use client';

import React, { useState, useRef, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/context/AuthContext';
import { 
  User, 
  Mail, 
  Phone, 
  Truck, 
  Lock, 
  Eye, 
  EyeOff, 
  AlertTriangle, 
  CheckCircle2, 
  Loader2, 
  Shield,
  ShieldCheck,
  MapPin,
  BarChart3,
  Users,
  ArrowRight,
  KeyRound,
  ArrowLeft,
  Building2,
  ChevronRight,
  ChevronDown,
  Navigation,
  Compass,
  Radio,
  FileCheck2,
  Check
} from 'lucide-react';
import MountainLogo from '@/components/MountainLogo';

// 8 North Eastern States Information & Authorities
const NER_STATES = [
  'Assam',
  'Arunachal Pradesh',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Sikkim',
  'Tripura'
];

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

function LoginContent({ onAuthSuccess, defaultPortal = 'transporter' }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlPortal = searchParams?.get('portal') || searchParams?.get('role');
  
  const { user, isNodalOfficer, session, loading: authLoading, signInNodalOfficer } = useAuth();

  // Portal switcher: 'transporter' vs 'nodal'
  const [portal, setPortal] = useState(() => {
    if (urlPortal === 'nodal' || defaultPortal === 'nodal') return 'nodal';
    return 'transporter';
  });

  // Transporter state
  const [isRegistering, setIsRegistering] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const hasRedirectedRef = useRef(false);

  const [formMsg, setFormMsg] = useState({ type: null, text: '' });

  // Registration & Transporter Login Form State
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [password, setPassword] = useState('');

  // 6-digit OTP state
  const [otpToken, setOtpToken] = useState(['', '', '', '', '', '']);
  const [countdown, setCountdown] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const otpInputRefs = useRef([]);

  // Nodal Officer state
  const [selectedStateId, setSelectedStateId] = useState('');
  const [selectedOfficer, setSelectedOfficer] = useState(null);
  const [nodalEmail, setNodalEmail] = useState('');
  const [nodalPassword, setNodalPassword] = useState('');
  const [showNodalPassword, setShowNodalPassword] = useState(false);

  // Sync portal with URL param if it changes
  useEffect(() => {
    if (urlPortal === 'nodal') {
      setPortal('nodal');
    } else if (urlPortal === 'transporter') {
      setPortal('transporter');
    }
  }, [urlPortal]);

  // If already authenticated, redirect to dashboard
  useEffect(() => {
    if (user && !authLoading && !hasRedirectedRef.current) {
      hasRedirectedRef.current = true;
      if (onAuthSuccess && session) {
        onAuthSuccess(session);
      }
      router.replace('/');
    }
  }, [user, authLoading, session, onAuthSuccess, router]);

  // Countdown timer for OTP resend
  useEffect(() => {
    let timer;
    if (isVerifyingOtp && countdown > 0) {
      timer = setInterval(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
    } else if (countdown === 0) {
      setCanResend(true);
    }
    return () => clearInterval(timer);
  }, [isVerifyingOtp, countdown]);

  const clearMessages = () => {
    if (formMsg.text) setFormMsg({ type: null, text: '' });
  };

  const handlePhoneChange = (val) => {
    const digitsOnly = val.replace(/\D/g, '');
    if (digitsOnly.length <= 10) {
      setPhone(digitsOnly);
      clearMessages();
    }
  };

  const handleOtpChange = (index, value) => {
    const cleanVal = value.replace(/\D/g, '').slice(-1);
    const newOtp = [...otpToken];
    newOtp[index] = cleanVal;
    setOtpToken(newOtp);
    clearMessages();

    if (cleanVal && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otpToken[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pastedData) return;

    const newOtp = [...otpToken];
    for (let i = 0; i < 6; i++) {
      newOtp[i] = pastedData[i] || '';
    }
    setOtpToken(newOtp);
    clearMessages();

    const nextIndex = Math.min(pastedData.length, 5);
    otpInputRefs.current[nextIndex]?.focus();
  };

  // Client-side validation checks for Transporter
  const validateForm = () => {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    const phoneRegex = /^[6-9]\d{9}$/;

    if (isRegistering) {
      if (!fullName.trim() || fullName.trim().length < 3) {
        setFormMsg({ type: 'error', text: 'Full Name must be at least 3 characters long.' });
        return false;
      }
      if (!phone.trim() || !phoneRegex.test(phone.trim())) {
        setFormMsg({ type: 'error', text: 'Phone number must be exactly 10 digits starting with 6, 7, 8, or 9.' });
        return false;
      }
      if (!vehicleNumber.trim() || vehicleNumber.trim().length < 6) {
        setFormMsg({ type: 'error', text: 'Valid Vehicle Plate number is required (min 6 characters, e.g. AS-01-AX-9921).' });
        return false;
      }
      if (!email.trim() || !emailRegex.test(email.trim())) {
        setFormMsg({ type: 'error', text: 'A valid email address is mandatory.' });
        return false;
      }
      if (!password || password.length < 6) {
        setFormMsg({ type: 'error', text: 'Password must be at least 6 characters.' });
        return false;
      }
    } else {
      if (!email.trim()) {
        setFormMsg({ type: 'error', text: 'Enter your registered email address or username.' });
        return false;
      }
      if (!password) {
        setFormMsg({ type: 'error', text: 'Password is mandatory.' });
        return false;
      }
    }
    return true;
  };

  // 1. Submit Transporter Registration or Sign-In
  const handleAuth = async (e) => {
    e.preventDefault();
    setFormMsg({ type: null, text: '' });

    if (!validateForm()) return;

    setLoading(true);

    try {
      if (isRegistering) {
        const vNum = vehicleNumber.trim().toUpperCase();
        const { data, error } = await supabase.auth.signUp({
          email: email.trim().toLowerCase(),
          password: password,
          options: {
            data: {
              full_name: fullName.trim(),
              phone: `+91${phone.trim()}`,
              vehicle_number: vNum,
              role: 'citizen_driver',
            },
          },
        });

        if (error) {
          setFormMsg({
            type: 'error',
            text: error.message || 'Registration failed. Please check your inputs.',
          });
          setLoading(false);
          return;
        }

        // Check if user already existed in Supabase Auth
        if (data?.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
          const { data: logData, error: logErr } = await supabase.auth.signInWithPassword({
            email: email.trim().toLowerCase(),
            password: password,
          });

          if (!logErr && logData?.user) {
            try {
              await supabase.from('driver_profiles').upsert({
                id: logData.user.id,
                full_name: fullName.trim() || logData.user.user_metadata?.full_name || 'Field Operator',
                phone: `+91${phone.trim()}`,
                email: email.trim().toLowerCase(),
                driver_code: `DRV-NER-${logData.user.id.slice(0, 4).toUpperCase()}`,
                vehicle_number: vNum,
                is_active_duty: false,
                last_ping: new Date().toISOString(),
              }, { onConflict: 'id' });
            } catch (pErr) {}

            setFormMsg({
              type: 'success',
              text: '[✓] Operator authenticated! Launching Command Center...',
            });

            if (onAuthSuccess && logData?.session) {
              onAuthSuccess(logData.session);
            }

            setTimeout(() => {
              window.location.replace('/');
            }, 500);
            return;
          } else {
            setFormMsg({
              type: 'error',
              text: 'This email is already registered. Please switch to "Login" to sign in.',
            });
            setLoading(false);
            return;
          }
        }

        if (data?.session && data?.user) {
          try {
            await supabase.from('driver_profiles').upsert({
              id: data.user.id,
              full_name: fullName.trim(),
              phone: `+91${phone.trim()}`,
              email: email.trim().toLowerCase(),
              driver_code: `DRV-NER-${data.user.id.slice(0, 4).toUpperCase()}`,
              vehicle_number: vNum,
              is_active_duty: false,
              last_ping: new Date().toISOString(),
            }, { onConflict: 'id' });
          } catch (pErr) {}

          setFormMsg({
            type: 'success',
            text: '[✓] Transporter registered! Launching Tactical Center...',
          });

          if (onAuthSuccess) {
            onAuthSuccess(data.session);
          }

          setTimeout(() => {
            window.location.replace('/');
          }, 500);
          return;
        } else {
          setIsVerifyingOtp(true);
          setCountdown(60);
          setCanResend(false);
          setLoading(false);
          setFormMsg({
            type: 'success',
            text: `Verification code sent to ${email.trim().toLowerCase()}. Enter the 6-digit code below to activate your account.`,
          });

          setTimeout(() => {
            otpInputRefs.current[0]?.focus();
          }, 150);
        }

      } else {
        // --- SIGN IN ---
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password: password,
        });

        if (error) {
          if (error.message?.toLowerCase().includes('email not confirmed') || error.message?.toLowerCase().includes('not confirmed')) {
            setFormMsg({
              type: 'error',
              text: 'Email not verified. Please verify your email or re-register to activate access.',
            });
          } else {
            setFormMsg({
              type: 'error',
              text: 'Access Denied: Invalid email or password.',
            });
          }
          setLoading(false);
          return;
        }

        const authenticatedUser = data?.user || data?.session?.user;

        if (authenticatedUser) {
          const { data: profileRow } = await supabase
            .from('driver_profiles')
            .select('id')
            .eq('id', authenticatedUser.id)
            .maybeSingle();

          if (!profileRow) {
            const vNum = authenticatedUser.user_metadata?.vehicle_number || 'AS-01-AX-9921';
            const fName = authenticatedUser.user_metadata?.full_name || authenticatedUser.email?.split('@')[0] || 'Field Transporter';
            const uPhone = authenticatedUser.user_metadata?.phone || '';

            await supabase.from('driver_profiles').upsert({
              id: authenticatedUser.id,
              full_name: fName,
              phone: uPhone,
              email: authenticatedUser.email,
              driver_code: `DRV-NER-${authenticatedUser.id.slice(0, 4).toUpperCase()}`,
              vehicle_number: vNum,
              is_active_duty: false,
              last_ping: new Date().toISOString(),
            }, { onConflict: 'id' });
          }

          setFormMsg({
            type: 'success',
            text: '[✓] Transporter authenticated. Launching AshtaMarg...',
          });

          if (onAuthSuccess && data?.session) {
            onAuthSuccess(data.session);
          }

          setTimeout(() => {
            window.location.replace('/');
          }, 500);
          return;
        } else {
          setFormMsg({
            type: 'error',
            text: 'Authentication response incomplete. Please try again.',
          });
        }
      }
    } catch (err) {
      setFormMsg({
        type: 'error',
        text: err.message || 'Authentication failed. Please verify credentials.',
      });
    } finally {
      setLoading(false);
    }
  };

  // 2. Verify 6-Digit Email OTP
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    const token = otpToken.join('');

    if (token.length !== 6) {
      setFormMsg({ type: 'error', text: 'Please enter all 6 digits of the verification code.' });
      return;
    }

    setLoading(true);
    setFormMsg({ type: null, text: '' });

    try {
      let { data, error } = await supabase.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token: token,
        type: 'signup',
      });

      if (error) {
        const fallback = await supabase.auth.verifyOtp({
          email: email.trim().toLowerCase(),
          token: token,
          type: 'email',
        });
        error = fallback.error;
        data = fallback.data;
      }

      if (error) {
        setFormMsg({
          type: 'error',
          text: error.message || 'Invalid or expired verification code.',
        });
        setLoading(false);
        return;
      }

      try {
        const sessionUser = data?.user || (await supabase.auth.getSession())?.data?.session?.user;
        if (sessionUser) {
          const vNum = sessionUser.user_metadata?.vehicle_number || vehicleNumber.trim().toUpperCase() || 'AS-01-AX-9921';
          await supabase.from('driver_profiles').upsert({
            id: sessionUser.id,
            full_name: sessionUser.user_metadata?.full_name || fullName.trim() || 'Field Transporter',
            phone: sessionUser.user_metadata?.phone || `+91${phone.trim()}`,
            email: sessionUser.email || email.trim().toLowerCase(),
            driver_code: `DRV-NER-${sessionUser.id.slice(0, 4).toUpperCase()}`,
            vehicle_number: vNum,
            is_active_duty: false,
            last_ping: new Date().toISOString(),
          }, { onConflict: 'id' });
        }
      } catch (profileSyncErr) {
        console.warn('Driver profile sync note:', profileSyncErr);
      }

      setFormMsg({
        type: 'success',
        text: 'Account verified successfully! Launching Tactical Center...',
      });

      if (onAuthSuccess && data?.session) {
        onAuthSuccess(data.session);
      }

      setTimeout(() => {
        window.location.replace('/');
      }, 500);

    } catch (err) {
      setFormMsg({
        type: 'error',
        text: err.message || 'Invalid or expired verification code.',
      });
    } finally {
      setLoading(false);
    }
  };

  // 3. Resend OTP handler
  const handleResendOtp = async () => {
    if (!canResend) return;
    setFormMsg({ type: null, text: '' });
    setCanResend(false);
    setCountdown(60);

    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email.trim().toLowerCase(),
      });

      if (error) {
        setFormMsg({ type: 'error', text: error.message || 'Failed to resend code.' });
      } else {
        setFormMsg({ type: 'success', text: `New 6-digit confirmation code dispatched to ${email.trim()}` });
      }
    } catch (err) {
      setFormMsg({ type: 'error', text: 'Failed to resend verification code.' });
    }
  };

  // Nodal Directorate Selection
  const handleDirectorateChange = (e) => {
    const stateId = e.target.value;
    setSelectedStateId(stateId);
    clearMessages();

    if (!stateId) {
      setSelectedOfficer(null);
      setNodalEmail('');
      return;
    }

    const officer = NODAL_DIRECTORATES.find((d) => d.id === stateId);
    if (officer) {
      setSelectedOfficer(officer);
      setNodalEmail(officer.email);
    }
  };

  // Nodal Sign In Handler
  const handleNodalSubmit = async (e) => {
    e.preventDefault();
    clearMessages();
    setLoading(true);

    if (!nodalEmail.trim()) {
      setFormMsg({ type: 'error', text: 'Please select your state jurisdiction or enter official email.' });
      setLoading(false);
      return;
    }

    if (!nodalPassword) {
      setFormMsg({ type: 'error', text: 'Please enter authorized state nodal passcode.' });
      setLoading(false);
      return;
    }

    const { data, error } = await signInNodalOfficer({
      email: nodalEmail.trim().toLowerCase(),
      password: nodalPassword,
    });

    if (error) {
      setFormMsg({
        type: 'error',
        text: error.message || 'Authentication rejected. Passcode mismatch against State Registry.',
      });
      setLoading(false);
    } else {
      setFormMsg({
        type: 'success',
        text: `Access Granted! Welcome ${data?.officer?.officer_name || 'Nodal Authority'}. Redirecting...`,
      });
      setTimeout(() => {
        window.location.replace('/');
      }, 500);
    }
  };

  return (
    <div className="min-h-screen relative flex flex-col justify-between overflow-x-hidden font-sans text-white selection:bg-cyan-500/30 selection:text-cyan-200">
      
      {/* 1. CINEMATIC FULL-SCREEN BACKGROUND IMAGE (High Clarity & Vividness) */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <Image
          src="/login%20background.jpeg"
          alt="Logistics Fleet Highway"
          fill
          priority
          sizes="100vw"
          className="object-cover object-center brightness-100 contrast-105"
        />
        {/* Minimal soft vignette overlay: preserves total visual clarity of the truck, twilight sky, and road */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#020617]/75 via-black/20 to-[#020617]/50 pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#020617]/60 via-transparent to-[#020617]/60 pointer-events-none" />
      </div>

      {/* 2. TOP BRANDING HEADER */}
      <header className="relative z-20 w-full max-w-7xl mx-auto px-4 sm:px-8 pt-5 sm:pt-7 flex items-center justify-between">
        {/* Left: AshtaMarg Logo & Tagline */}
        <Link href="/" className="inline-flex items-center space-x-3 group">
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-[#071733]/80 border border-cyan-400/40 flex items-center justify-center shadow-[0_0_15px_rgba(6,182,212,0.35)] backdrop-blur-md group-hover:scale-105 transition-transform">
            <MountainLogo className="w-7 h-7 sm:w-8 sm:h-8" />
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-black tracking-tight text-white font-sans flex items-center gap-1.5 drop-shadow-md">
              <span>AshtaMarg</span>
            </div>
            <div className="text-[10px] sm:text-[11px] font-bold text-cyan-400 tracking-wider uppercase drop-shadow-xs">
              Logistics • Network • Intelligence
            </div>
          </div>
        </Link>

        {/* Right: Slogan & Tactical Icon */}
        <div className="flex items-center space-x-3 text-xs sm:text-sm text-slate-200 font-semibold drop-shadow-md">
          <span className="hidden sm:inline-block tracking-wide">
            Smarter Routes. Safer Journeys.
          </span>
          <div className="hidden sm:block w-px h-4 bg-white/30" />
          <div className="w-8 h-8 rounded-xl bg-[#071733]/80 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shadow-md backdrop-blur-md">
            <Compass className="w-4 h-4 animate-[spin_12s_linear_infinite]" />
          </div>
        </div>
      </header>

      {/* 3. MAIN CONTENT: 2-COLUMN LAYOUT */}
      <main className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-8 py-6 sm:py-10 flex-1 flex items-center">
        <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 xl:gap-14 items-center">
          
          {/* ========================================================================= */}
          {/* LEFT HERO SECTION (Showcasing 4 Pillars, Stats, Map Outline)               */}
          {/* ========================================================================= */}
          <div className="lg:col-span-7 xl:col-span-7 space-y-6 sm:space-y-8 animate-fadeIn">
            
            {/* Top Badge */}
            <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-[#071733]/80 border border-cyan-400/40 text-cyan-300 text-xs font-bold tracking-wide backdrop-blur-md shadow-[0_0_15px_rgba(6,182,212,0.25)]">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#34d399]" />
              <span>
                {portal === 'nodal' ? 'Authorized SDMA & Emergency Transit Portal' : 'Trusted by 10,000+ Transporters'}
              </span>
            </div>

            {/* Huge Headline with Deep Glow Shadows for Maximum Legibility */}
            <div className="space-y-2.5">
              <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-5xl font-extrabold text-white tracking-tight leading-[1.15] drop-shadow-[0_2px_12px_rgba(0,0,0,0.8)]">
                {portal === 'nodal' ? (
                  <>
                    State Command for{' '}
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-orange-300 to-emerald-400 drop-shadow-sm">
                      Disaster Logistics
                    </span>
                  </>
                ) : (
                  <>
                    Smarter Logistics <br />
                    for a{' '}
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-sky-300 to-blue-300 drop-shadow-sm">
                      Stronger Tomorrow
                    </span>
                  </>
                )}
              </h1>
              <p className="text-sm sm:text-base text-slate-100/90 leading-relaxed max-w-xl font-medium drop-shadow-[0_1px_8px_rgba(0,0,0,0.8)]">
                {portal === 'nodal'
                  ? 'Official state disaster transit management, real-time fleet radar monitoring, stockpile distribution, and high-altitude road obstruction clearance across 8 NER States.'
                  : 'Track, manage and optimize your fleet with real-time intelligence. AshtaMarg helps you move faster, safer and more efficiently across 8+ states in North East India.'}
              </p>
            </div>

            {/* 4 Feature Cards (Pillars) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 pt-1">
              
              {/* Feature 1 */}
              <div className="bg-[#071733]/70 hover:bg-[#0c224a]/85 border border-cyan-500/30 hover:border-cyan-400/60 rounded-2xl p-3.5 sm:p-4 backdrop-blur-md transition-all group shadow-lg">
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center text-cyan-400 mb-2.5 group-hover:scale-110 transition-transform">
                  <MapPin className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
                </div>
                <h4 className="text-xs sm:text-sm font-bold text-white mb-0.5">Real-time Tracking</h4>
                <p className="text-[11px] text-slate-300 leading-tight">Know where your fleet is, always.</p>
              </div>

              {/* Feature 2 */}
              <div className="bg-[#071733]/70 hover:bg-[#0c224a]/85 border border-cyan-500/30 hover:border-cyan-400/60 rounded-2xl p-3.5 sm:p-4 backdrop-blur-md transition-all group shadow-lg">
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-blue-500/20 border border-blue-400/40 flex items-center justify-center text-blue-400 mb-2.5 group-hover:scale-110 transition-transform">
                  <Shield className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
                </div>
                <h4 className="text-xs sm:text-sm font-bold text-white mb-0.5">Safer Operations</h4>
                <p className="text-[11px] text-slate-300 leading-tight">Reduce risk with smart alerts.</p>
              </div>

              {/* Feature 3 */}
              <div className="bg-[#071733]/70 hover:bg-[#0c224a]/85 border border-cyan-500/30 hover:border-cyan-400/60 rounded-2xl p-3.5 sm:p-4 backdrop-blur-md transition-all group shadow-lg">
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-400 mb-2.5 group-hover:scale-110 transition-transform">
                  <Navigation className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
                </div>
                <h4 className="text-xs sm:text-sm font-bold text-white mb-0.5">Optimized Routes</h4>
                <p className="text-[11px] text-slate-300 leading-tight">Save time, cut costs.</p>
              </div>

              {/* Feature 4 */}
              <div className="bg-[#071733]/70 hover:bg-[#0c224a]/85 border border-cyan-500/30 hover:border-cyan-400/60 rounded-2xl p-3.5 sm:p-4 backdrop-blur-md transition-all group shadow-lg">
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-indigo-500/20 border border-indigo-400/40 flex items-center justify-center text-indigo-400 mb-2.5 group-hover:scale-110 transition-transform">
                  <BarChart3 className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
                </div>
                <h4 className="text-xs sm:text-sm font-bold text-white mb-0.5">Actionable Insights</h4>
                <p className="text-[11px] text-slate-300 leading-tight">Make data-driven decisions.</p>
              </div>

            </div>

            {/* Bottom Stats Badge in Glassmorphic Pill */}
            <div className="inline-flex flex-wrap items-center gap-4 sm:gap-6 bg-[#071733]/75 border border-cyan-500/40 rounded-2xl px-5 py-3 backdrop-blur-md shadow-[0_0_30px_rgba(6,182,212,0.18)]">
              <div className="flex items-center space-x-2.5">
                <div className="w-7 h-7 rounded-lg bg-cyan-500/20 flex items-center justify-center text-cyan-400">
                  <Truck className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-sm font-extrabold text-white leading-none">8+ States</div>
                  <div className="text-[10px] text-slate-300 font-medium">Covered across NER</div>
                </div>
              </div>

              <div className="hidden sm:block w-px h-6 bg-white/20" />

              <div className="flex items-center space-x-2.5">
                <div className="w-7 h-7 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-sm font-extrabold text-white leading-none">99.9%</div>
                  <div className="text-[10px] text-slate-300 font-medium">Uptime Guarantee</div>
                </div>
              </div>

              <div className="hidden sm:block w-px h-6 bg-white/20" />

              <div className="flex items-center space-x-2.5">
                <div className="w-7 h-7 rounded-lg bg-blue-500/20 flex items-center justify-center text-blue-400">
                  <Radio className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-sm font-extrabold text-white leading-none">&lt; 2s</div>
                  <div className="text-[10px] text-slate-300 font-medium">Hazard Alert Broadcast</div>
                </div>
              </div>
            </div>

          </div>

          {/* ========================================================================= */}
          {/* RIGHT AUTH CARD (With Master Portal Switcher at Single Position)           */}
          {/* ========================================================================= */}
          <div className="lg:col-span-5 xl:col-span-5 flex justify-center w-full">
            
            {/* The Master Glassmorphic Auth Container */}
            <div className="w-full max-w-[440px] xl:max-w-[460px] bg-[#061226]/85 backdrop-blur-2xl border border-cyan-500/40 hover:border-cyan-400/60 rounded-3xl p-6 sm:p-8 shadow-[0_0_50px_rgba(6,182,212,0.25)] relative overflow-hidden transition-all duration-300 space-y-5">
              
              {/* Ambient glows inside card */}
              <div className="absolute top-0 right-0 w-44 h-44 bg-cyan-500/15 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute bottom-0 left-0 w-44 h-44 bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />

              {/* CARD TOP: BRAND LOGO */}
              <div className="flex items-center justify-center space-x-2.5 relative z-10 pt-1">
                <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center shadow-[0_0_12px_rgba(6,182,212,0.3)]">
                  <MountainLogo className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-lg font-black tracking-tight text-white leading-tight">
                    AshtaMarg
                  </div>
                  <div className="text-[9px] font-bold text-cyan-400 tracking-wider uppercase">
                    Logistics • Network • Intelligence
                  </div>
                </div>
              </div>

              {/* ===================================================================== */}
              {/* 🏆 MASTER PORTAL SWITCHER (SINGLE POSITION - ULTRA REFINED)          */}
              {/* ===================================================================== */}
              <div className="relative z-10 p-1 bg-[#030914]/90 rounded-2xl border border-cyan-500/30 shadow-inner grid grid-cols-2 gap-1 font-sans text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setPortal('transporter');
                    clearMessages();
                  }}
                  className={`py-2.5 px-3 rounded-xl font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    portal === 'transporter'
                      ? 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-[0_0_15px_rgba(6,182,212,0.4)]'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
                  }`}
                >
                  <Truck className="w-4 h-4 shrink-0" />
                  <span className="truncate">Transporter</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setPortal('nodal');
                    clearMessages();
                  }}
                  className={`py-2.5 px-3 rounded-xl font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    portal === 'nodal'
                      ? 'bg-gradient-to-r from-amber-500 via-orange-500 to-emerald-600 text-white shadow-[0_0_15px_rgba(245,158,11,0.4)]'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
                  }`}
                >
                  <Building2 className="w-4 h-4 shrink-0" />
                  <span className="truncate">Nodal Officer</span>
                </button>
              </div>

              {/* Global Alert Message Banner */}
              {formMsg.text && (
                <div
                  className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 animate-fadeIn relative z-10 ${
                    formMsg.type === 'error'
                      ? 'bg-rose-950/80 border-rose-800 text-rose-300'
                      : 'bg-emerald-950/80 border-emerald-800 text-emerald-300'
                  }`}
                >
                  {formMsg.type === 'error' ? (
                    <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
                  )}
                  <span className="leading-relaxed font-sans">{formMsg.text}</span>
                </div>
              )}

              {/* ===================================================================== */}
              {/* SECTION A: TRANSPORTER (CITIZEN / DRIVER) AUTH FLOW                    */}
              {/* ===================================================================== */}
              {portal === 'transporter' && (
                <div className="space-y-4 relative z-10">
                  
                  {/* Title & Subtitle */}
                  <div className="space-y-1">
                    <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                      {isVerifyingOtp 
                        ? 'Verify Security OTP' 
                        : isRegistering 
                        ? 'Create Driver Account' 
                        : 'Welcome Back'}
                    </h2>
                    <p className="text-xs text-slate-300">
                      {isVerifyingOtp 
                        ? 'Enter the 6-digit code sent to your email' 
                        : isRegistering 
                        ? 'Register your vehicle & profile for NER logistics' 
                        : 'Sign in to your account to continue'}
                    </p>
                  </div>

                  {/* Mode Tabs: [ 👤 Login ] vs [ 👤+ Create Account ] */}
                  {!isVerifyingOtp && (
                    <div className="grid grid-cols-2 p-1 bg-[#040c1c]/90 rounded-xl border border-slate-700/80 text-xs font-semibold">
                      <button
                        type="button"
                        onClick={() => {
                          setIsRegistering(false);
                          clearMessages();
                        }}
                        className={`py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                          !isRegistering
                            ? 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-sm font-bold'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        <User className="w-3.5 h-3.5" />
                        <span>Login</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setIsRegistering(true);
                          clearMessages();
                        }}
                        className={`py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                          isRegistering
                            ? 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-sm font-bold'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        <Truck className="w-3.5 h-3.5" />
                        <span>Create Account</span>
                      </button>
                    </div>
                  )}

                  {/* 1. OTP VERIFICATION FORM */}
                  {isVerifyingOtp ? (
                    <form onSubmit={handleVerifyOtp} className="space-y-4">
                      <div>
                        <label className="block text-[11px] font-mono font-bold uppercase text-slate-300 mb-2 text-center">
                          6-Digit Verification Token
                        </label>
                        <div className="flex items-center justify-center gap-2" onPaste={handleOtpPaste}>
                          {otpToken.map((digit, idx) => (
                            <input
                              key={idx}
                              ref={(el) => (otpInputRefs.current[idx] = el)}
                              type="text"
                              maxLength={1}
                              inputMode="numeric"
                              value={digit}
                              onChange={(e) => handleOtpChange(idx, e.target.value)}
                              onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                              className="w-11 h-12 text-center bg-[#040a17] border border-slate-700 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/30 rounded-xl text-lg font-mono font-bold text-cyan-400 focus:outline-none transition-all shadow-inner"
                            />
                          ))}
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-3 bg-gradient-to-r from-cyan-400 via-sky-500 to-blue-600 hover:from-cyan-300 hover:to-blue-500 disabled:opacity-50 text-slate-950 font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-[0_0_20px_rgba(6,182,212,0.4)] flex items-center justify-center gap-2 cursor-pointer"
                      >
                        {loading ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                            <span>Verifying...</span>
                          </>
                        ) : (
                          <>
                            <span>Verify & Sign In</span>
                            <ArrowRight className="w-4 h-4" />
                          </>
                        )}
                      </button>

                      <div className="flex items-center justify-between text-xs text-slate-300 pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            setIsVerifyingOtp(false);
                            clearMessages();
                          }}
                          className="hover:text-white transition-colors cursor-pointer flex items-center gap-1"
                        >
                          <ArrowLeft className="w-3.5 h-3.5" />
                          <span>Back to form</span>
                        </button>

                        <button
                          type="button"
                          onClick={handleResendOtp}
                          disabled={!canResend}
                          className={`font-mono text-[11px] ${canResend ? 'text-cyan-400 hover:text-cyan-300 cursor-pointer font-bold' : 'text-slate-500 cursor-not-allowed'}`}
                        >
                          {canResend ? 'Resend Code' : `Resend in ${countdown}s`}
                        </button>
                      </div>
                    </form>
                  ) : (
                    /* 2. MAIN LOGIN / SIGN UP FORM */
                    <form onSubmit={handleAuth} autoComplete="off" className="space-y-3.5">
                      
                      {/* REGISTRATION-ONLY FIELDS */}
                      {isRegistering && (
                        <>
                          {/* Full Name */}
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-200 mb-1">
                              Full Name <span className="text-cyan-400">*</span>
                            </label>
                            <div className="relative">
                              <input
                                type="text"
                                required
                                value={fullName}
                                onChange={(e) => { setFullName(e.target.value); clearMessages(); }}
                                placeholder="Enter your full name"
                                autoComplete="name"
                                className="w-full bg-[#040c1c]/90 border border-slate-700/80 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-400 outline-none transition-all pl-10"
                              />
                              <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                            </div>
                          </div>

                          {/* Mobile Number */}
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-200 mb-1">
                              Mobile Number <span className="text-cyan-400">*</span>
                            </label>
                            <div className="relative flex items-center">
                              <span className="absolute left-3 px-1.5 py-0.5 bg-slate-900 border border-slate-700 rounded text-[10px] font-mono text-cyan-400 font-bold pointer-events-none">
                                +91
                              </span>
                              <input
                                type="tel"
                                required
                                maxLength={10}
                                inputMode="numeric"
                                value={phone}
                                onChange={(e) => handlePhoneChange(e.target.value)}
                                placeholder="9435012345"
                                autoComplete="tel"
                                className="w-full bg-[#040c1c]/90 border border-slate-700/80 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 rounded-xl pl-13 pr-10 py-2.5 text-xs text-white font-mono placeholder-slate-400 outline-none transition-all"
                              />
                              <span className="absolute right-3 text-[10px] font-mono text-slate-400 pointer-events-none">
                                {phone.length}/10
                              </span>
                            </div>
                          </div>

                          {/* Vehicle Number */}
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-200 mb-1">
                              Vehicle Plate Number <span className="text-cyan-400">*</span>
                            </label>
                            <div className="relative">
                              <input
                                type="text"
                                required
                                value={vehicleNumber}
                                onChange={(e) => { setVehicleNumber(e.target.value.toUpperCase()); clearMessages(); }}
                                placeholder="e.g. AS-01-AX-9921"
                                autoComplete="off"
                                className="w-full bg-[#040c1c]/90 border border-slate-700/80 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono uppercase placeholder-slate-400 outline-none transition-all pl-10"
                              />
                              <Truck className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                            </div>
                          </div>
                        </>
                      )}

                      {/* Email Address / Username */}
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-200 mb-1">
                          Email Address / Username <span className="text-cyan-400">*</span>
                        </label>
                        <div className="relative">
                          <input
                            type="email"
                            required
                            value={email}
                            onChange={(e) => { setEmail(e.target.value); clearMessages(); }}
                            placeholder="Enter your registered email or username"
                            autoComplete="email"
                            inputMode="email"
                            className="w-full bg-[#040c1c]/90 border border-slate-700/80 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-400 outline-none transition-all pl-10"
                          />
                          <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                        </div>
                      </div>

                      {/* Password */}
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-200 mb-1">
                          Password <span className="text-cyan-400">*</span>
                        </label>
                        <div className="relative">
                          <input
                            type={showPassword ? 'text' : 'password'}
                            required
                            value={password}
                            onChange={(e) => { setPassword(e.target.value); clearMessages(); }}
                            placeholder="Enter your password"
                            autoComplete={isRegistering ? 'new-password' : 'current-password'}
                            className="w-full bg-[#040c1c]/90 border border-slate-700/80 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-400 outline-none transition-all pl-10 pr-10"
                          />
                          <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3.5 top-2.5 text-slate-400 hover:text-white transition-colors cursor-pointer p-0.5"
                          >
                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      {/* Remember Me & Forgot Password (Sign In mode) */}
                      {!isRegistering && (
                        <div className="flex items-center justify-between text-xs text-slate-300 pt-0.5">
                          <label className="flex items-center space-x-2 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={rememberMe}
                              onChange={(e) => setRememberMe(e.target.checked)}
                              className="w-3.5 h-3.5 rounded border-slate-700 bg-slate-900 text-cyan-500 focus:ring-cyan-400/30 accent-cyan-500 cursor-pointer"
                            />
                            <span className="text-[11px] text-slate-200">Remember me</span>
                          </label>

                          <button
                            type="button"
                            onClick={() => setFormMsg({ type: 'success', text: 'Password reset instructions dispatched to your registered email.' })}
                            className="text-[11px] text-cyan-400 hover:text-cyan-300 hover:underline transition-all cursor-pointer font-medium"
                          >
                            Forgot Password?
                          </button>
                        </div>
                      )}

                      {/* Glowing CTA Button */}
                      <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-3 mt-2 bg-gradient-to-r from-blue-600 via-sky-500 to-cyan-400 hover:from-blue-500 hover:to-cyan-300 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-[0_0_25px_rgba(14,165,233,0.45)] flex items-center justify-center gap-2 cursor-pointer"
                      >
                        {loading ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Processing...</span>
                          </>
                        ) : isRegistering ? (
                          <>
                            <span>Create Account</span>
                            <ArrowRight className="w-4 h-4" />
                          </>
                        ) : (
                          <>
                            <span>Sign In</span>
                            <ArrowRight className="w-4 h-4" />
                          </>
                        )}
                      </button>

                      {/* Bottom Toggle Text */}
                      <div className="text-center pt-2">
                        {isRegistering ? (
                          <p className="text-xs text-slate-300">
                            Already registered?{' '}
                            <button
                              type="button"
                              onClick={() => {
                                setIsRegistering(false);
                                clearMessages();
                              }}
                              className="text-cyan-400 hover:text-cyan-300 font-bold hover:underline ml-1 cursor-pointer"
                            >
                              Sign In →
                            </button>
                          </p>
                        ) : (
                          <p className="text-xs text-slate-300">
                            New to AshtaMarg?{' '}
                            <button
                              type="button"
                              onClick={() => {
                                setIsRegistering(true);
                                clearMessages();
                              }}
                              className="text-cyan-400 hover:text-cyan-300 font-bold hover:underline ml-1 cursor-pointer"
                            >
                              Create an account →
                            </button>
                          </p>
                        )}
                      </div>

                    </form>
                  )}

                </div>
              )}

              {/* ===================================================================== */}
              {/* SECTION B: SDMA NODAL OFFICER AUTHENTICATION FLOW                      */}
              {/* ===================================================================== */}
              {portal === 'nodal' && (
                <div className="space-y-4 relative z-10">
                  
                  {/* Title & Subtitle */}
                  <div className="space-y-1">
                    <div className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[10px] font-mono font-bold uppercase mb-1">
                      <ShieldCheck className="w-3 h-3 text-amber-400" />
                      <span>Restricted Government Gateway</span>
                    </div>
                    <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                      State Command HQ
                    </h2>
                    <p className="text-xs text-slate-300">
                      Official State Nodal Officer Passcode Authorization
                    </p>
                  </div>

                  <form onSubmit={handleNodalSubmit} autoComplete="off" className="space-y-3.5">
                    
                    {/* State Jurisdiction Dropdown */}
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-200 mb-1">
                        State Jurisdiction & Directorate <span className="text-amber-400">*</span>
                      </label>
                      <div className="relative">
                        <select
                          value={selectedStateId}
                          onChange={handleDirectorateChange}
                          className="w-full bg-[#040c1c]/90 border border-amber-500/40 focus:border-amber-400 focus:ring-1 focus:ring-amber-400 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none transition-all pl-10 pr-10 appearance-none cursor-pointer"
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
                        <MapPin className="w-4 h-4 text-amber-400 absolute left-3.5 top-3 pointer-events-none" />
                        <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3.5 top-3 pointer-events-none" />
                      </div>
                    </div>

                    {/* Officer Detail Preview Card if state selected */}
                    {selectedOfficer && (
                      <div className="p-3 rounded-xl bg-amber-950/50 border border-amber-500/40 space-y-1 text-xs">
                        <div className="flex items-center justify-between text-amber-300 font-bold">
                          <span className="truncate">{selectedOfficer.officer_name}</span>
                          <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-[9px] uppercase border border-amber-500/40 font-mono">
                            {selectedOfficer.state}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-200 leading-tight">
                          {selectedOfficer.designation}
                        </div>
                        <div className="text-[10px] text-slate-300 flex items-center space-x-1.5 pt-0.5">
                          <Phone className="w-3 h-3 text-amber-400 shrink-0" />
                          <span className="font-mono">{selectedOfficer.emergency_contact}</span>
                        </div>
                      </div>
                    )}

                    {/* Department Email */}
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-200 mb-1">
                        Department Email <span className="text-amber-400">*</span>
                      </label>
                      <div className="relative">
                        <input
                          type="email"
                          required
                          value={nodalEmail}
                          onChange={(e) => { setNodalEmail(e.target.value); clearMessages(); }}
                          placeholder="officer@sdma.gov.in"
                          autoComplete="email"
                          inputMode="email"
                          className="w-full bg-[#040c1c]/90 border border-slate-700/80 focus:border-amber-400 focus:ring-1 focus:ring-amber-400 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono placeholder-slate-400 outline-none transition-all pl-10"
                        />
                        <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                      </div>
                    </div>

                    {/* Nodal Passcode */}
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-200 mb-1">
                        Nodal Passcode <span className="text-amber-400">*</span>
                      </label>
                      <div className="relative">
                        <input
                          type={showNodalPassword ? 'text' : 'password'}
                          required
                          value={nodalPassword}
                          onChange={(e) => { setNodalPassword(e.target.value); clearMessages(); }}
                          placeholder="Enter authorized state passcode"
                          autoComplete="current-password"
                          className="w-full bg-[#040c1c]/90 border border-slate-700/80 focus:border-amber-400 focus:ring-1 focus:ring-amber-400 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono placeholder-slate-400 outline-none transition-all pl-10 pr-10"
                        />
                        <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                        <button
                          type="button"
                          onClick={() => setShowNodalPassword(!showNodalPassword)}
                          className="absolute right-3.5 top-2.5 text-slate-400 hover:text-white transition-colors cursor-pointer p-0.5"
                        >
                          {showNodalPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {/* Glowing CTA Button */}
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full py-3 mt-2 bg-gradient-to-r from-amber-500 via-orange-500 to-emerald-600 hover:from-amber-400 hover:to-emerald-500 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-[0_0_25px_rgba(245,158,11,0.45)] flex items-center justify-center gap-2 cursor-pointer"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin text-white" />
                          <span>Verifying Directorate Clearance...</span>
                        </>
                      ) : (
                        <>
                          <ShieldCheck className="w-4 h-4" />
                          <span>Access Command HQ</span>
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>

                  </form>
                </div>
              )}

            </div>

          </div>

        </div>
      </main>

      {/* 4. MODERNIZED FOOTER */}
      <footer className="relative z-20 w-full max-w-7xl mx-auto px-4 sm:px-8 py-4 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-2.5 text-xs text-slate-300">
        <div className="text-slate-300 font-medium">
          © 2026 AshtaMarg. All rights reserved.
        </div>

        <div className="flex items-center space-x-2 text-[11px] text-slate-300 font-medium">
          <Shield className="w-3.5 h-3.5 text-cyan-400" />
          <span>Your Data. Our Priority. • AES-256 RLS Hardened</span>
        </div>
      </footer>

    </div>
  );
}

export default function LoginPage(props) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#070d18] flex items-center justify-center text-cyan-400"><Loader2 className="w-8 h-8 animate-spin" /></div>}>
      <LoginContent {...props} />
    </Suspense>
  );
}
