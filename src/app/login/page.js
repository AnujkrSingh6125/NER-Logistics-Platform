'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
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
  MapPin,
  BarChart3,
  Users,
  ArrowRight,
  KeyRound,
  ArrowLeft,
  Building2,
  Sparkles,
  ChevronRight
} from 'lucide-react';
import MountainLogo from '@/components/MountainLogo';

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

export default function LoginPage({ onAuthSuccess }) {
  const router = useRouter();
  const { user, session, loading: authLoading } = useAuth();
  const [isRegistering, setIsRegistering] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const hasRedirectedRef = useRef(false);

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

  const [formMsg, setFormMsg] = useState({ type: null, text: '' });

  // Registration & Login Form State
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

  // Client-side validation checks
  const validateForm = () => {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    const phoneRegex = /^[6-9]\d{9}$/;

    if (isRegistering) {
      if (!fullName.trim() || fullName.trim().length < 3) {
        setFormMsg({ type: 'error', text: 'Full Name must be at least 3 characters long.' });
        return false;
      }
      if (!email.trim() || !emailRegex.test(email.trim())) {
        setFormMsg({ type: 'error', text: 'A valid email address is mandatory.' });
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
      if (!password || password.length < 6) {
        setFormMsg({ type: 'error', text: 'Passcode must be at least 6 characters.' });
        return false;
      }
    } else {
      if (!email.trim() || !emailRegex.test(email.trim())) {
        setFormMsg({ type: 'error', text: 'Enter a valid registered email address.' });
        return false;
      }
      if (!password) {
        setFormMsg({ type: 'error', text: 'Passcode is mandatory.' });
        return false;
      }
    }
    return true;
  };

  // 1. Submit Registration or Sign-In
  const handleAuth = async (e) => {
    e.preventDefault();
    setFormMsg({ type: null, text: '' });

    if (!validateForm()) return;

    setLoading(true);

    try {
      if (isRegistering) {
        // --- SIGN UP WITH EMAIL VERIFICATION ---
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

        // Check if user already existed in Supabase Auth (empty identities array)
        if (data?.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
          // Attempt sign in with password to re-create/re-provision profile in driver_profiles table
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
              text: '[✓] Operator profile authenticated! Launching Tactical Center...',
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
              text: 'This email is already registered with a different passcode. Please switch to "Sign In" to log in.',
            });
            setLoading(false);
            return;
          }
        }

        // If immediate session created (e.g. email confirmations disabled or pre-verified)
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
            text: '[✓] Operator registered & authenticated! Launching Tactical Center...',
          });

          if (onAuthSuccess) {
            onAuthSuccess(data.session);
          }

          setTimeout(() => {
            window.location.replace('/');
          }, 500);
          return;
        } else {
          // Transition into 6-Digit Email Verification Screen
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
              text: 'Access Denied: Invalid email or passcode.',
            });
          }
          setLoading(false);
          return;
        }

        const authenticatedUser = data?.user || data?.session?.user;

        if (authenticatedUser) {
          // Verify or auto-provision driver profile
          const { data: profileRow } = await supabase
            .from('driver_profiles')
            .select('id')
            .eq('id', authenticatedUser.id)
            .maybeSingle();

          if (!profileRow) {
            const vNum = authenticatedUser.user_metadata?.vehicle_number || 'AS-01-AX-9921';
            const fName = authenticatedUser.user_metadata?.full_name || authenticatedUser.email?.split('@')[0] || 'Field Operator';
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
            text: '[✓] Operator authenticated. Launching Tactical Center...',
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

      // Sync driver profile upon confirmed email activation
      try {
        const sessionUser = data?.user || (await supabase.auth.getSession())?.data?.session?.user;
        if (sessionUser) {
          const vNum = sessionUser.user_metadata?.vehicle_number || vehicleNumber.trim().toUpperCase() || 'AS-01-AX-9921';
          await supabase.from('driver_profiles').upsert({
            id: sessionUser.id,
            full_name: sessionUser.user_metadata?.full_name || fullName.trim() || 'Field Operator',
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

  return (
    <div className="min-h-screen bg-[#070d18] text-slate-100 flex flex-col justify-between relative overflow-x-hidden font-sans selection:bg-cyan-500/30 selection:text-cyan-200">
      
      {/* 1. ATMOSPHERIC SUNSET MOUNTAIN BACKGROUND */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#060b14] via-[#09152b] to-[#12284c] opacity-90" />
        <div className="absolute top-1/4 left-1/3 w-[800px] h-[500px] bg-gradient-to-r from-orange-500/10 via-rose-500/15 to-blue-600/20 rounded-full blur-[140px]" />
        <div className="absolute bottom-0 inset-x-0 h-[450px] bg-gradient-to-t from-[#040810] via-[#060d1b]/80 to-transparent" />
        
        {/* Topographic Contour Lines SVG */}
        <svg className="absolute inset-0 w-full h-full opacity-10 text-cyan-500 stroke-current" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 900" fill="none">
          <path d="M-100 200 C300 150, 600 400, 1000 250 C1200 180, 1400 320, 1600 280" strokeWidth="1" strokeDasharray="4 4" />
          <path d="M-100 350 C250 300, 700 550, 1100 380 C1350 280, 1500 420, 1600 390" strokeWidth="1" />
          <path d="M-100 500 C400 420, 800 680, 1200 520 C1400 450, 1550 580, 1600 550" strokeWidth="1" strokeDasharray="6 6" />
          <path d="M-100 650 C500 580, 900 800, 1300 680 C1450 620, 1550 720, 1600 700" strokeWidth="1" />
        </svg>

        <div className="absolute top-20 left-1/4 w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee] animate-pulse" />
        <div className="absolute top-36 left-2/3 w-1.5 h-1.5 rounded-full bg-amber-400 shadow-[0_0_8px_#f59e0b] animate-ping" />
        <div className="absolute top-48 left-1/2 w-1 h-1 rounded-full bg-blue-300 shadow-[0_0_6px_#93c5fd]" />
      </div>

      {/* 2. TOP MOBILE / DESKTOP APP BRAND BAR */}
      <header className="relative z-20 w-full max-w-7xl mx-auto px-4 sm:px-8 pt-4 sm:pt-6 flex items-center justify-between">
        <Link href="/" className="inline-flex items-center space-x-2.5 group">
          <MountainLogo className="w-9 h-9 sm:w-10 sm:h-10 drop-shadow-md group-hover:scale-105 transition-transform" />
          <div>
            <span className="text-lg sm:text-xl font-black tracking-tight text-white font-sans block group-hover:text-cyan-400 transition-colors leading-tight">
              AshtaMarg
            </span>
            <span className="text-[10px] sm:text-[11px] font-medium text-cyan-400/90 tracking-wide">
              Tactical Logistics • 8 NER States
            </span>
          </div>
        </Link>

        {/* Nodal Officer Portal Fast Link */}
        <Link
          href="/nodal-login"
          className="px-3 py-1.5 rounded-xl bg-amber-950/60 hover:bg-amber-900/80 border border-amber-500/40 text-amber-300 text-[11px] font-mono font-bold flex items-center space-x-1.5 transition-all shadow-xs group"
        >
          <Building2 className="w-3.5 h-3.5 text-amber-400 group-hover:scale-110 transition-transform" />
          <span className="hidden xs:inline">Nodal Officer</span>
          <span>Portal</span>
          <ChevronRight className="w-3 h-3 text-amber-400/80" />
        </Link>
      </header>

      {/* 3. MAIN CONTENT (Mobile-First Layout: Auth Card First on Mobile) */}
      <main className="relative z-10 w-full max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-5 sm:py-8 lg:py-12 flex-1 flex items-center">
        <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-12 items-center">
          
          {/* ========================================================================= */}
          {/* AUTHENTICATION CARD (Order 1 on Mobile, Center/Right Span 5 on Desktop)    */}
          {/* ========================================================================= */}
          <div className="order-1 lg:order-2 lg:col-span-6 xl:col-span-5 flex justify-center w-full">
            
            {/* Mobile-Optimized Glassmorphic Card */}
            <div className="w-full max-w-md bg-slate-900/90 backdrop-blur-2xl border border-cyan-500/40 rounded-3xl p-5 sm:p-7 shadow-[0_0_50px_rgba(6,182,212,0.18)] space-y-4 relative overflow-hidden">
              
              {/* Radial Highlight Backdrops */}
              <div className="absolute top-0 right-0 w-48 h-48 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

              {/* Segmented Sign In / Register Tab Switcher (Prominent & Thumb-Friendly) */}
              {!isVerifyingOtp && (
                <div className="grid grid-cols-2 p-1 bg-slate-950/80 rounded-2xl border border-slate-800 font-mono text-xs font-bold shadow-inner relative z-10">
                  <button
                    type="button"
                    onClick={() => {
                      setIsRegistering(false);
                      setFormMsg({ type: null, text: '' });
                    }}
                    className={`py-2.5 px-2 rounded-xl text-center transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      !isRegistering
                        ? 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-md font-bold'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>Sign In</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsRegistering(true);
                      setFormMsg({ type: null, text: '' });
                    }}
                    className={`py-2.5 px-2 rounded-xl text-center transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      isRegistering
                        ? 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-md font-bold'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Truck className="w-3.5 h-3.5" />
                    <span>Create Profile</span>
                  </button>
                </div>
              )}

              {/* Header Title & Subtitle */}
              <div className="text-center space-y-1 relative z-10 pt-1">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-blue-600 to-cyan-500 border border-cyan-400/40 flex items-center justify-center mx-auto text-white shadow-[0_0_20px_rgba(6,182,212,0.35)]">
                  {isVerifyingOtp ? <KeyRound className="w-5 h-5" /> : isRegistering ? <Truck className="w-5 h-5" /> : <Shield className="w-5 h-5" />}
                </div>

                <h2 className="text-xl sm:text-2xl font-black font-sans text-white tracking-tight pt-1">
                  {isVerifyingOtp ? (
                    <>Verify <span className="text-cyan-400">Security OTP</span></>
                  ) : isRegistering ? (
                    <>Register <span className="text-cyan-400">Field Driver</span></>
                  ) : (
                    <>Driver <span className="text-cyan-400">Portal Login</span></>
                  )}
                </h2>
                
                <p className="text-[11px] sm:text-xs text-slate-400 font-sans leading-relaxed">
                  {isVerifyingOtp 
                    ? 'Enter the 6-digit confirmation code sent to your email' 
                    : isRegistering 
                    ? 'Register vehicle & operator profile for NER relief corridors' 
                    : 'Enter registered credentials to access tactical navigation'}
                </p>
              </div>

              {/* Global Feedback Banner */}
              {formMsg.text && (
                <div
                  className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 animate-fadeIn relative z-10 ${
                    formMsg.type === 'error'
                      ? 'bg-rose-950/70 border-rose-800 text-rose-300'
                      : 'bg-emerald-950/70 border-emerald-800 text-emerald-300'
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

              {/* 1. OTP VERIFICATION SCREEN */}
              {isVerifyingOtp ? (
                <form onSubmit={handleVerifyOtp} className="space-y-4 font-mono relative z-10">
                  
                  <div>
                    <label className="block text-[11px] font-mono font-bold uppercase text-slate-400 mb-2 text-center">
                      6-Digit Confirmation Token *
                    </label>
                    
                    {/* Responsive 6-Box OTP Inputs */}
                    <div className="flex items-center justify-center gap-1.5 sm:gap-2.5 max-w-xs mx-auto" onPaste={handleOtpPaste}>
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
                          className="w-10 sm:w-12 h-12 sm:h-13 text-center bg-slate-950 border border-slate-700 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/30 rounded-xl text-lg font-mono font-bold text-cyan-400 focus:outline-none transition-all shadow-inner"
                        />
                      ))}
                    </div>
                  </div>

                  {/* Confirm Action Button */}
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full min-h-[48px] py-3 bg-gradient-to-r from-cyan-400 via-sky-500 to-blue-600 hover:from-cyan-300 hover:to-blue-500 disabled:opacity-50 text-slate-950 font-bold font-mono text-xs uppercase tracking-wider rounded-2xl transition-all shadow-[0_0_20px_rgba(6,182,212,0.4)] flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                        <span>Verifying Token...</span>
                      </>
                    ) : (
                      <>
                        <span>Activate & Launch Dashboard</span>
                        <ArrowRight className="w-4 h-4 text-slate-950" />
                      </>
                    )}
                  </button>

                  {/* Resend & Back Controls */}
                  <div className="flex items-center justify-between text-xs font-sans text-slate-400 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setIsVerifyingOtp(false);
                        setFormMsg({ type: null, text: '' });
                      }}
                      className="text-slate-400 hover:text-slate-200 transition-colors cursor-pointer flex items-center gap-1 py-1"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>Back to Form</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleResendOtp}
                      disabled={!canResend}
                      className={`font-mono text-[11px] py-1 ${canResend ? 'text-cyan-400 hover:text-cyan-300 cursor-pointer font-bold' : 'text-slate-600 cursor-not-allowed'}`}
                    >
                      {canResend ? 'Resend Code' : `Resend in ${countdown}s`}
                    </button>
                  </div>

                </form>
              ) : (
                /* 2. AUTHENTICATION FORM: SIGN IN / SIGN UP */
                <form onSubmit={handleAuth} autoComplete="off" className="space-y-3 font-sans relative z-10">
                  
                  {/* REGISTRATION-ONLY INPUTS */}
                  {isRegistering && (
                    <>
                      {/* Full Name */}
                      <div>
                        <label className="block text-[11px] font-mono font-bold uppercase text-slate-400 mb-1">
                          Full Name <span className="text-rose-500">*</span>
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            required
                            value={fullName}
                            onChange={(e) => { setFullName(e.target.value); clearMessages(); }}
                            placeholder="e.g. Bikramjit Baruah"
                            autoComplete="name"
                            className="w-full min-h-[44px] bg-slate-950/90 border border-slate-800 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 rounded-xl px-3.5 py-2.5 text-sm sm:text-xs text-white placeholder-slate-500 outline-none transition-all pl-10"
                          />
                          <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                        </div>
                      </div>

                      {/* 10-Digit Mobile */}
                      <div>
                        <label className="block text-[11px] font-mono font-bold uppercase text-slate-400 mb-1">
                          Mobile Number (10 Digits) <span className="text-rose-500">*</span>
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
                            className="w-full min-h-[44px] bg-slate-950/90 border border-slate-800 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 rounded-xl pl-13 pr-12 py-2.5 text-sm sm:text-xs text-white font-mono placeholder-slate-500 outline-none transition-all"
                          />
                          <span className="absolute right-3 text-[10px] font-mono text-slate-500 pointer-events-none">
                            {phone.length}/10
                          </span>
                        </div>
                      </div>

                      {/* Vehicle Number */}
                      <div>
                        <label className="block text-[11px] font-mono font-bold uppercase text-slate-400 mb-1">
                          Vehicle Registration Number <span className="text-rose-500">*</span>
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            required
                            value={vehicleNumber}
                            onChange={(e) => {
                              setVehicleNumber(e.target.value.toUpperCase());
                              clearMessages();
                            }}
                            placeholder="e.g. AS-01-AX-9921"
                            autoComplete="off"
                            className="w-full min-h-[44px] bg-slate-950/90 border border-slate-800 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 rounded-xl px-3.5 py-2.5 text-sm sm:text-xs text-white font-mono uppercase placeholder-slate-500 outline-none transition-all pl-10"
                          />
                          <Truck className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                        </div>
                      </div>
                    </>
                  )}

                  {/* Email Address */}
                  <div>
                    <label className="block text-[11px] font-mono font-bold uppercase text-slate-400 mb-1">
                      Email Address <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => { setEmail(e.target.value); clearMessages(); }}
                        placeholder="operator.field@ashtamarg.in"
                        autoComplete="email"
                        inputMode="email"
                        className="w-full min-h-[44px] bg-slate-950/90 border border-slate-800 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 rounded-xl px-3.5 py-2.5 text-sm sm:text-xs text-white placeholder-slate-500 outline-none transition-all pl-10"
                      />
                      <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                    </div>
                  </div>

                  {/* Passcode */}
                  <div>
                    <label className="block text-[11px] font-mono font-bold uppercase text-slate-400 mb-1">
                      Passcode <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={password}
                        onChange={(e) => { setPassword(e.target.value); clearMessages(); }}
                        placeholder="Enter your security passcode"
                        autoComplete={isRegistering ? 'new-password' : 'current-password'}
                        className="w-full min-h-[44px] bg-slate-950/90 border border-slate-800 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 rounded-xl px-3.5 py-2.5 text-sm sm:text-xs text-white placeholder-slate-500 outline-none transition-all pl-10 pr-10"
                      />
                      <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3.5 top-3.5 text-slate-500 hover:text-slate-300 transition-colors cursor-pointer p-0.5"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Action CTA Button */}
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full min-h-[48px] py-3.5 mt-2 bg-gradient-to-r from-cyan-400 via-sky-500 to-blue-600 hover:from-cyan-300 hover:to-blue-500 disabled:opacity-50 text-slate-950 font-bold font-mono text-xs uppercase tracking-wider rounded-2xl transition-all shadow-[0_0_20px_rgba(6,182,212,0.4)] flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                        <span>Processing...</span>
                      </>
                    ) : isRegistering ? (
                      <>
                        <span>Register & Send Verification Code</span>
                        <ArrowRight className="w-4 h-4 text-slate-950" />
                      </>
                    ) : (
                      <>
                        <span>Sign In to Tactical Dashboard</span>
                        <ArrowRight className="w-4 h-4 text-slate-950" />
                      </>
                    )}
                  </button>

                </form>
              )}

            </div>

          </div>

          {/* ========================================================================= */}
          {/* INFORMATION & COVERAGE SHOWCASE (Order 2 on Mobile, Span 6 Desktop)        */}
          {/* ========================================================================= */}
          <div className="order-2 lg:order-1 lg:col-span-6 xl:col-span-7 space-y-5 sm:space-y-6 animate-fadeIn">
            
            {/* Tagline Badge */}
            <div className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-full bg-cyan-950/60 border border-cyan-500/30 text-cyan-300 text-[11px] sm:text-xs font-mono font-bold tracking-wider shadow-inner">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              <span>SAFER REGIONS. STRONGER TOMORROW.</span>
            </div>

            {/* Main Headline */}
            <div className="space-y-2">
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white tracking-tight leading-[1.2]">
                Ground Intelligence for a{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-sky-300 to-blue-500">
                  Safer Northeast
                </span>
              </h1>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-sans max-w-xl">
                Real-time multi-route logging, GPS convoy tracking, and choke point mitigation across all 8 North Eastern States.
              </p>
            </div>

            {/* 4 Feature Badges in 2x2 or 4x1 responsive grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              
              <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-3 text-center space-y-1 backdrop-blur-md">
                <div className="w-7 h-7 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center mx-auto text-cyan-400">
                  <Shield className="w-3.5 h-3.5" />
                </div>
                <div className="text-[11px] font-bold text-slate-200">Disaster Relief</div>
              </div>

              <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-3 text-center space-y-1 backdrop-blur-md">
                <div className="w-7 h-7 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center mx-auto text-blue-400">
                  <Truck className="w-3.5 h-3.5" />
                </div>
                <div className="text-[11px] font-bold text-slate-200">Convoy Tracking</div>
              </div>

              <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-3 text-center space-y-1 backdrop-blur-md">
                <div className="w-7 h-7 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400">
                  <Users className="w-3.5 h-3.5" />
                </div>
                <div className="text-[11px] font-bold text-slate-200">Driver Network</div>
              </div>

              <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-3 text-center space-y-1 backdrop-blur-md">
                <div className="w-7 h-7 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center mx-auto text-indigo-400">
                  <BarChart3 className="w-3.5 h-3.5" />
                </div>
                <div className="text-[11px] font-bold text-slate-200">GIS Telemetry</div>
              </div>

            </div>

            {/* 8 NER States Coverage Block */}
            <div className="bg-slate-950/80 border border-slate-800/80 rounded-2xl p-3.5 sm:p-4 backdrop-blur-md space-y-2.5">
              <div className="flex items-center justify-between text-xs font-mono text-slate-400 pb-2 border-b border-slate-800">
                <span className="font-bold text-slate-200 uppercase flex items-center space-x-1.5">
                  <MapPin className="w-3.5 h-3.5 text-cyan-400" />
                  <span>8 NER STATES COVERAGE</span>
                </span>
                <span className="text-[10px] text-emerald-400 font-bold flex items-center space-x-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>50 STRATEGIC HUBS</span>
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono text-slate-300">
                {NER_STATES.map((state) => (
                  <div key={state} className="flex items-center space-x-1.5 text-[11px]">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0" />
                    <span className="truncate">{state}</span>
                  </div>
                ))}
              </div>
            </div>

          </div>

        </div>
      </main>

      {/* 4. SECURITY & COMPLIANCE FOOTER */}
      <footer className="relative z-20 w-full px-4 sm:px-8 py-3.5 border-t border-white/5 backdrop-blur-sm flex flex-col sm:flex-row items-center justify-between gap-2.5 font-mono text-[11px] text-slate-400 text-center sm:text-left">
        <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 sm:gap-3 text-slate-400 text-[10px] sm:text-[11px]">
          <span className="flex items-center space-x-1 text-slate-300 font-bold">
            <Lock className="w-3 h-3 text-cyan-400" />
            <span>Secure Access Portal</span>
          </span>
          <span>•</span>
          <span>AES-256 RLS Hardened</span>
          <span>•</span>
          <span>8 NER States Transit</span>
        </div>

        <div className="text-[10px] text-slate-500">
          AshtaMarg Tactical System v2.4.0
        </div>
      </footer>

    </div>
  );
}

