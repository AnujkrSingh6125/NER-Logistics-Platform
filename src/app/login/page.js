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
  RotateCcw
} from 'lucide-react';

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

  // If already authenticated and on login page, softly navigate to dashboard once without full page reload
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

        // If immediate session created (e.g. email confirmations auto-confirmed)
        if (data?.session) {
          setFormMsg({
            type: 'success',
            text: '[✓] Operator registered & authenticated! Launching Tactical Center...',
          });

          // 1. Notify parent AuthGuard if passed as a prop
          if (onAuthSuccess) {
            onAuthSuccess(data.session);
          }

          // 2. Perform a clean hard redirect to clear auth component state and hydrate dashboard
          setTimeout(() => {
            window.location.replace('/');
          }, 500);
          return;
        } else {
          // Seamlessly transition into the 6-Digit Email Verification Screen
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
          // Check for unconfirmed email error
          if (error.message?.toLowerCase().includes('email not confirmed') || error.message?.toLowerCase().includes('not confirmed')) {
            setFormMsg({
              type: 'error',
              text: 'Email not verified. Please verify your email to activate access.',
            });
          } else {
            setFormMsg({
              type: 'error',
              text: 'Access Denied: Account not found or incorrect passcode.',
            });
          }
          setLoading(false);
          return;
        }

        if (data?.session || data?.user) {
          setFormMsg({
            type: 'success',
            text: '[✓] Operator authenticated. Launching Tactical Center...',
          });

          // 1. Notify parent AuthGuard if passed as a prop
          if (onAuthSuccess && data?.session) {
            onAuthSuccess(data.session);
          }

          // 2. Perform a clean hard redirect to clear auth component state and hydrate dashboard
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
    <div className="min-h-screen bg-[#070d18] text-slate-100 flex flex-col justify-between relative overflow-hidden font-sans selection:bg-cyan-500/30 selection:text-cyan-200">
      
      {/* 1. ATMOSPHERIC SUNSET MOUNTAIN BACKGROUND */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Sky Sunset Gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#060b14] via-[#09152b] to-[#12284c] opacity-90" />
        
        {/* Sunset Horizon Glow */}
        <div className="absolute top-1/4 left-1/3 w-[800px] h-[500px] bg-gradient-to-r from-orange-500/10 via-rose-500/15 to-blue-600/20 rounded-full blur-[140px]" />
        
        {/* Mountain Horizon Silhouettes */}
        <div className="absolute bottom-0 inset-x-0 h-[450px] bg-gradient-to-t from-[#040810] via-[#060d1b]/80 to-transparent" />
        
        {/* Topographic Contour Lines SVG */}
        <svg className="absolute inset-0 w-full h-full opacity-10 text-cyan-500 stroke-current" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 900" fill="none">
          <path d="M-100 200 C300 150, 600 400, 1000 250 C1200 180, 1400 320, 1600 280" strokeWidth="1" strokeDasharray="4 4" />
          <path d="M-100 350 C250 300, 700 550, 1100 380 C1350 280, 1500 420, 1600 390" strokeWidth="1" />
          <path d="M-100 500 C400 420, 800 680, 1200 520 C1400 450, 1550 580, 1600 550" strokeWidth="1" strokeDasharray="6 6" />
          <path d="M-100 650 C500 580, 900 800, 1300 680 C1450 620, 1550 720, 1600 700" strokeWidth="1" />
        </svg>

        {/* Ambient Star & Light Nodes */}
        <div className="absolute top-20 left-1/4 w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee] animate-pulse" />
        <div className="absolute top-36 left-2/3 w-1.5 h-1.5 rounded-full bg-amber-400 shadow-[0_0_8px_#f59e0b] animate-ping" />
        <div className="absolute top-48 left-1/2 w-1 h-1 rounded-full bg-blue-300 shadow-[0_0_6px_#93c5fd]" />
      </div>

      {/* 2. MAIN CONTENT GRID (Hero Left + Auth Card Center/Right) */}
      <main className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-8 py-8 lg:py-12 flex-1 flex items-center">
        <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          
          {/* ================= LEFT HERO COLUMN ================= */}
          <div className="lg:col-span-5 space-y-6 sm:space-y-8 animate-fadeIn">
            
            {/* Tagline Badge */}
            <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-cyan-950/60 border border-cyan-500/30 text-cyan-300 text-xs font-mono font-bold tracking-wider shadow-inner">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              <span>SAFER REGIONS. STRONGER TOMORROW.</span>
            </div>

            {/* Main Headline */}
            <div className="space-y-3">
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight leading-[1.15]">
                Ground Intelligence for a{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-sky-300 to-blue-500">
                  Safer Northeast
                </span>
              </h1>
              <p className="text-sm text-slate-300 leading-relaxed font-sans max-w-lg">
                Real-time logging, coordination and disaster supply transit access for a more resilient Northeast India.
              </p>
            </div>

            {/* 4 Feature Badges */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              
              <div className="bg-slate-900/60 hover:bg-slate-900/90 border border-slate-800 hover:border-cyan-500/40 rounded-2xl p-3 text-center space-y-1.5 transition-all group backdrop-blur-md">
                <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center mx-auto text-cyan-400 group-hover:scale-110 transition-transform">
                  <Shield className="w-4 h-4" />
                </div>
                <div className="text-[11px] font-bold text-slate-200">Disaster Response</div>
              </div>

              <div className="bg-slate-900/60 hover:bg-slate-900/90 border border-slate-800 hover:border-cyan-500/40 rounded-2xl p-3 text-center space-y-1.5 transition-all group backdrop-blur-md">
                <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center mx-auto text-blue-400 group-hover:scale-110 transition-transform">
                  <Truck className="w-4 h-4" />
                </div>
                <div className="text-[11px] font-bold text-slate-200">Supply Tracking</div>
              </div>

              <div className="bg-slate-900/60 hover:bg-slate-900/90 border border-slate-800 hover:border-cyan-500/40 rounded-2xl p-3 text-center space-y-1.5 transition-all group backdrop-blur-md">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400 group-hover:scale-110 transition-transform">
                  <Users className="w-4 h-4" />
                </div>
                <div className="text-[11px] font-bold text-slate-200">Field Coordination</div>
              </div>

              <div className="bg-slate-900/60 hover:bg-slate-900/90 border border-slate-800 hover:border-cyan-500/40 rounded-2xl p-3 text-center space-y-1.5 transition-all group backdrop-blur-md">
                <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center mx-auto text-indigo-400 group-hover:scale-110 transition-transform">
                  <BarChart3 className="w-4 h-4" />
                </div>
                <div className="text-[11px] font-bold text-slate-200">Real-time Insights</div>
              </div>

            </div>

            {/* 8 NER States Coverage Block */}
            <div className="bg-slate-950/80 border border-slate-800/80 rounded-2xl p-4 backdrop-blur-md space-y-3">
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

              <div className="grid grid-cols-2 gap-y-1.5 gap-x-4 text-xs font-mono text-slate-300">
                {NER_STATES.map((state) => (
                  <div key={state} className="flex items-center space-x-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_6px_#22d3ee]" />
                    <span className="hover:text-cyan-300 transition-colors cursor-default">{state}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Watermark Quote */}
            <div className="pt-2">
              <span className="text-sm font-serif italic text-slate-400/80 tracking-wide">
                People Safer Together
              </span>
            </div>

          </div>

          {/* ================= CENTER / RIGHT AUTHENTICATION CARD ================= */}
          <div className="lg:col-span-4 flex justify-center">
            
            {/* Tactical Glassmorphic Card */}
            <div className="w-full max-w-md bg-slate-900/85 backdrop-blur-2xl border border-cyan-500/40 rounded-3xl p-6 sm:p-8 shadow-[0_0_50px_rgba(6,182,212,0.18)] space-y-5 relative overflow-hidden">
              
              {/* Subtle Card Background Radial Highlights */}
              <div className="absolute top-0 right-0 w-48 h-48 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

              {/* Top Header Badge & Title */}
              <div className="text-center space-y-2 relative z-10">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-cyan-500 border border-cyan-400/40 flex items-center justify-center mx-auto text-white shadow-[0_0_20px_rgba(6,182,212,0.35)]">
                  {isVerifyingOtp ? <KeyRound className="w-6 h-6" /> : <Shield className="w-6 h-6" />}
                </div>

                <h2 className="text-2xl sm:text-3xl font-black font-sans text-white tracking-tight">
                  {isVerifyingOtp ? (
                    <>Confirm <span className="text-cyan-400">OTP</span></>
                  ) : isRegistering ? (
                    <>Create <span className="text-cyan-400">Profile</span></>
                  ) : (
                    <>Welcome <span className="text-cyan-400">Back</span></>
                  )}
                </h2>
                
                <p className="text-xs text-slate-400 font-sans">
                  {isVerifyingOtp 
                    ? 'Enter the 6-digit confirmation code sent to your email' 
                    : isRegistering 
                    ? 'Complete all fields to register vehicle & operator profile' 
                    : 'Sign in to access tactical transit and hazard command'}
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

              {/* OTP VERIFICATION VIEW */}
              {isVerifyingOtp ? (
                <form onSubmit={handleVerifyOtp} className="space-y-4 font-mono relative z-10">
                  
                  <div>
                    <label className="block text-[11px] font-mono font-bold uppercase text-slate-400 mb-2 text-center">
                      6-Digit Security Token *
                    </label>
                    
                    {/* Segmented OTP Input Boxes */}
                    <div className="flex items-center justify-between gap-1.5" onPaste={handleOtpPaste}>
                      {otpToken.map((digit, idx) => (
                        <input
                          key={idx}
                          ref={(el) => (otpInputRefs.current[idx] = el)}
                          type="text"
                          maxLength={1}
                          inputMode="numeric"
                          value={digit}
                          onChange={(e) => handleOtpChange(idx, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Backspace' && !otpToken[idx] && idx > 0) {
                              otpInputRefs.current[idx - 1]?.focus();
                            }
                          }}
                          className="w-11 h-12 text-center bg-slate-950 border border-slate-700 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 rounded-xl text-lg font-mono font-bold text-cyan-400 focus:outline-none transition-all shadow-inner"
                        />
                      ))}
                    </div>
                  </div>

                  {/* Submit OTP Action */}
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3.5 mt-2 bg-gradient-to-r from-cyan-400 via-sky-500 to-blue-600 hover:from-cyan-300 hover:to-blue-500 disabled:opacity-50 text-slate-950 font-bold font-mono text-xs uppercase tracking-wider rounded-2xl transition-all shadow-[0_0_20px_rgba(6,182,212,0.4)] flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                        <span>Verifying Token...</span>
                      </>
                    ) : (
                      <>
                        <span>Confirm & Activate Account</span>
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
                      className="text-slate-400 hover:text-slate-200 transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>Back to Form</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleResendOtp}
                      disabled={!canResend}
                      className={`font-mono text-[11px] ${canResend ? 'text-cyan-400 hover:text-cyan-300 cursor-pointer font-bold' : 'text-slate-600 cursor-not-allowed'}`}
                    >
                      {canResend ? 'Resend Code' : `Resend in ${countdown}s`}
                    </button>
                  </div>

                </form>
              ) : (
                /* AUTHENTICATION FORM: SIGN IN / SIGN UP */
                <form onSubmit={handleAuth} autoComplete="off" className="space-y-3.5 font-sans relative z-10">
                  
                  {/* REGISTRATION-ONLY FIELDS */}
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
                            autoComplete="off"
                            className="w-full bg-slate-950/90 border border-slate-800 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 outline-none transition-all pl-9"
                          />
                          <User className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
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
                            autoComplete="off"
                            className="w-full bg-slate-950/90 border border-slate-800 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 rounded-xl pl-13 pr-12 py-2.5 text-xs text-white font-mono placeholder-slate-500 outline-none transition-all"
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
                            className="w-full bg-slate-950/90 border border-slate-800 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono uppercase placeholder-slate-500 outline-none transition-all pl-9"
                          />
                          <Truck className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
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
                        placeholder="e.g. operator.field@nerlogix.in"
                        autoComplete="off"
                        className="w-full bg-slate-950/90 border border-slate-800 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 outline-none transition-all pl-9"
                      />
                      <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
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
                        placeholder="Enter your password"
                        autoComplete="new-password"
                        className="w-full bg-slate-950/90 border border-slate-800 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 outline-none transition-all pl-9 pr-9"
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

                  {/* Submit Action CTA Button */}
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3.5 mt-2 bg-gradient-to-r from-cyan-400 via-sky-500 to-blue-600 hover:from-cyan-300 hover:to-blue-500 disabled:opacity-50 text-slate-950 font-bold font-mono text-xs uppercase tracking-wider rounded-2xl transition-all shadow-[0_0_20px_rgba(6,182,212,0.4)] flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                        <span>Processing...</span>
                      </>
                    ) : isRegistering ? (
                      <>
                        <span>Register & Send Code</span>
                        <ArrowRight className="w-4 h-4 text-slate-950" />
                      </>
                    ) : (
                      <>
                        <span>Sign In</span>
                        <ArrowRight className="w-4 h-4 text-slate-950" />
                      </>
                    )}
                  </button>

                </form>
              )}

              {/* Toggle Mode (Highlighted Red CTA for Register) */}
              {!isVerifyingOtp && (
                <div className="pt-3 text-center flex justify-center border-t border-slate-800/80">
                  {!isRegistering ? (
                    <button
                      type="button"
                      onClick={() => {
                        setIsRegistering(true);
                        setFormMsg({ type: null, text: '' });
                      }}
                      className="text-xs font-mono transition-all cursor-pointer inline-flex items-center space-x-2 px-4 py-1.5 rounded-full bg-red-500/15 hover:bg-red-500/25 border border-red-500/60 hover:border-red-400 text-red-400 hover:text-red-200 shadow-[0_0_18px_rgba(239,68,68,0.4)] hover:shadow-[0_0_25px_rgba(239,68,68,0.6)] group"
                    >
                      <User className="w-3.5 h-3.5 text-red-400 group-hover:scale-110 transition-transform animate-pulse" />
                      <span>Register as <strong className="text-red-300 font-extrabold underline underline-offset-2 decoration-red-400">Field Operator</strong></span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setIsRegistering(false);
                        setFormMsg({ type: null, text: '' });
                      }}
                      className="text-xs font-mono transition-all cursor-pointer inline-flex items-center space-x-2 px-4 py-1.5 rounded-full bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/40 text-slate-300 hover:text-white group"
                    >
                      <span>Already have an account?</span>
                      <strong className="text-cyan-400 hover:text-cyan-300 underline underline-offset-2">Sign In</strong>
                    </button>
                  )}
                </div>
              )}

            </div>

          </div>

          {/* ================= RIGHT AMBIENT QUOTE CARD ================= */}
          <div className="lg:col-span-3 hidden lg:flex flex-col items-start justify-center space-y-4 pl-4 animate-fadeIn">
            
            {/* Handwritten Title Badge */}
            <div className="text-xl font-serif italic text-cyan-200/90 tracking-wide">
              “For A Resilient Northeast”
            </div>

            {/* Glass Quote Card */}
            <div className="w-full bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-5 shadow-xl space-y-2">
              <p className="text-xs text-slate-300 italic leading-relaxed">
                “Prepared people build resilient regions.”
              </p>
              <div className="text-[10px] font-mono font-bold text-cyan-400 tracking-wider">
                — NER-LOGIX
              </div>
            </div>

          </div>

        </div>
      </main>

      {/* 3. BOTTOM SECURITY FOOTER STRIP */}
      <footer className="relative z-20 w-full px-6 sm:px-10 py-4 border-t border-white/5 backdrop-blur-sm flex flex-col sm:flex-row items-center justify-between gap-3 font-mono text-[11px] text-slate-400">
        
        {/* Left Security Indicators */}
        <div className="flex flex-wrap items-center gap-3 text-slate-400">
          <span className="flex items-center space-x-1 text-slate-300">
            <Lock className="w-3.5 h-3.5 text-cyan-400" />
            <span className="font-bold">Secure Access Portal</span>
          </span>
          <span>|</span>
          <span>256-bit Encryption</span>
          <span>|</span>
          <span>Government Use Only</span>
        </div>

        {/* Right Policy Links */}
        <div className="flex items-center space-x-4 text-slate-400">
          <button type="button" className="hover:text-cyan-300 transition-colors cursor-pointer">Help</button>
          <span>|</span>
          <button type="button" className="hover:text-cyan-300 transition-colors cursor-pointer">Privacy</button>
          <span>|</span>
          <button type="button" className="hover:text-cyan-300 transition-colors cursor-pointer">Terms</button>
          <span>|</span>
          <button type="button" className="hover:text-cyan-300 transition-colors cursor-pointer">Contact</button>
        </div>

      </footer>

    </div>
  );
}
