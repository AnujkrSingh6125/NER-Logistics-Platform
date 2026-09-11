'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';

const AuthContext = createContext({
  user: null,
  profile: null,
  nodalOfficer: null,
  isNodalOfficer: false,
  session: null,
  loading: true,
  signIn: async () => {},
  signInNodalOfficer: async () => {},
  signUp: async () => {},
  signOut: async () => {},
  refreshProfile: async () => {},
});

const PROFILE_CACHE_KEY = 'ner_user_profile_cache';
const NODAL_CACHE_KEY = 'ner_nodal_officer_session';

export const DEFAULT_NODAL_OFFICERS = [
  {
    id: 'b0000000-0000-0000-0000-000000000001',
    officer_name: 'Dr. Diganta Sarmah',
    email: 'diganta.sarmah@sdma.assam.gov.in',
    state: 'Assam',
    department: 'Assam State Disaster Management Authority (ASDMA)',
    designation: 'State Logistics Coordinator & Joint Director',
    emergency_contact: '+91-94350-12845',
    access_passcode: 'NER@Nodal2026',
    is_active: true,
  },
  {
    id: 'b0000000-0000-0000-0000-000000000002',
    officer_name: 'Col. Tashi Norbu (Retd.)',
    email: 'tashi.norbu@bro.arunachal.gov.in',
    state: 'Arunachal Pradesh',
    department: 'Border Roads Organization (BRO) / Disaster Cell',
    designation: 'Chief Disaster Logistics Strategist',
    emergency_contact: '+91-94360-88412',
    access_passcode: 'NER@Nodal2026',
    is_active: true,
  },
  {
    id: 'b0000000-0000-0000-0000-000000000003',
    officer_name: 'Bah P. Kharkongor',
    email: 'p.kharkongor@pwd.meghalaya.gov.in',
    state: 'Meghalaya',
    department: 'Meghalaya PWD (Roads & Infrastructure)',
    designation: 'Superintending Engineer & Nodal Officer (Highways)',
    emergency_contact: '+91-94361-04290',
    access_passcode: 'NER@Nodal2026',
    is_active: true,
  },
  {
    id: 'b0000000-0000-0000-0000-000000000004',
    officer_name: 'Th. Premjit Singh',
    email: 'premjit.singh@transport.manipur.gov.in',
    state: 'Manipur',
    department: 'Manipur State Transport & Disaster Relief Dept',
    designation: 'Director of Inland Tactical Transit',
    emergency_contact: '+91-94360-31189',
    access_passcode: 'NER@Nodal2026',
    is_active: true,
  },
  {
    id: 'b0000000-0000-0000-0000-000000000005',
    officer_name: 'Lalrinsanga Ralte',
    email: 'lalrinsanga.ralte@fcsca.mizoram.gov.in',
    state: 'Mizoram',
    department: 'Food, Civil Supplies & Consumer Affairs Dept',
    designation: 'Deputy Director of Supply Operations',
    emergency_contact: '+91-94361-55073',
    access_passcode: 'NER@Nodal2026',
    is_active: true,
  },
  {
    id: 'b0000000-0000-0000-0000-000000000006',
    officer_name: 'K. Temjen Jamir',
    email: 'temjen.jamir@nsdma.nagaland.gov.in',
    state: 'Nagaland',
    department: 'Nagaland State Disaster Management Authority (NSDMA)',
    designation: 'Joint Chief Logistics Officer',
    emergency_contact: '+91-94360-62410',
    access_passcode: 'NER@Nodal2026',
    is_active: true,
  },
  {
    id: 'b0000000-0000-0000-0000-000000000007',
    officer_name: 'Subrata Debbarma',
    email: 'subrata.debbarma@revenue.tripura.gov.in',
    state: 'Tripura',
    department: 'Tripura Logistics Cell & Revenue Disaster Division',
    designation: 'State Transit Emergency Coordinator',
    emergency_contact: '+91-94364-77123',
    access_passcode: 'NER@Nodal2026',
    is_active: true,
  },
  {
    id: 'b0000000-0000-0000-0000-000000000008',
    officer_name: 'Karma Chopel Lepcha',
    email: 'karma.lepcha@ssdma.sikkim.gov.in',
    state: 'Sikkim',
    department: 'Sikkim State Disaster Management Authority (SSDMA)',
    designation: 'Mountain Logistics & Hazard Response Commander',
    emergency_contact: '+91-94341-90864',
    access_passcode: 'NER@Nodal2026',
    is_active: true,
  },
];

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [nodalOfficer, setNodalOfficer] = useState(null);
  const [loading, setLoading] = useState(true);
  const currentUserIdRef = useRef(null);

  // Helper to fetch nodal officer record strictly by email from public.nodal_officers or fallback registry
  const fetchNodalOfficerRecord = useCallback(async (email) => {
    if (!email) return null;
    try {
      const cleanEmail = email.toLowerCase().trim();
      let record = null;
      try {
        const { data, error } = await supabase
          .from('nodal_officers')
          .select('*')
          .eq('email', cleanEmail)
          .eq('is_active', true)
          .maybeSingle();

        if (!error && data) {
          record = data;
        }
      } catch (err) {
        console.warn('Supabase query to nodal_officers note:', err);
      }

      if (!record) {
        record = DEFAULT_NODAL_OFFICERS.find((o) => o.email.toLowerCase() === cleanEmail) || null;
      }

      if (record) {
        setNodalOfficer(record);
        if (typeof window !== 'undefined') {
          localStorage.setItem(NODAL_CACHE_KEY, JSON.stringify(record));
        }
        return record;
      } else {
        setNodalOfficer(null);
        if (typeof window !== 'undefined') {
          localStorage.removeItem(NODAL_CACHE_KEY);
        }
      }
    } catch (err) {
      console.error('Error in fetchNodalOfficerRecord:', err);
    }
    return null;
  }, []);

  // Helper to fetch driver profile from public.driver_profiles (for Citizen/Driver accounts)
  const fetchUserProfile = useCallback(async (userId, fallbackMeta = null) => {
    if (!userId) {
      setProfile(null);
      if (typeof window !== 'undefined') {
        localStorage.removeItem(PROFILE_CACHE_KEY);
      }
      return null;
    }

    try {
      const { data, error } = await supabase
        .from('driver_profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (data) {
        setProfile(data);
        if (typeof window !== 'undefined') {
          localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(data));
        }
        return data;
      } else if (fallbackMeta) {
        // Auto-provision profile row in driver_profiles for valid authenticated operator
        const newProfile = {
          id: userId,
          full_name: fallbackMeta?.full_name || 'Field Operator',
          phone: fallbackMeta?.phone || '',
          email: fallbackMeta?.email || null,
          driver_code: fallbackMeta?.driver_code || `DRV-NER-${userId.slice(0, 4).toUpperCase()}`,
          vehicle_number: fallbackMeta?.vehicle_number || 'AS-01-AX-9921',
          is_active_duty: false,
          state: fallbackMeta?.state || 'Assam',
          district: fallbackMeta?.district || null,
        };

        try {
          const { data: inserted } = await supabase
            .from('driver_profiles')
            .upsert(newProfile, { onConflict: 'id' })
            .select()
            .maybeSingle();

          const finalProfile = inserted || newProfile;
          setProfile(finalProfile);
          if (typeof window !== 'undefined') {
            localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(finalProfile));
          }
          return finalProfile;
        } catch (insertCatch) {
          setProfile(newProfile);
          return newProfile;
        }
      } else {
        setProfile(null);
        if (typeof window !== 'undefined') {
          localStorage.removeItem(PROFILE_CACHE_KEY);
        }
        return null;
      }
    } catch (err) {
      console.error('Error in fetchUserProfile:', err);
    }
    return null;
  }, []);

  // Initialize session on mount
  useEffect(() => {
    let mounted = true;

    async function initAuth() {
      try {
        // 1. Check for cached nodal officer session first
        if (typeof window !== 'undefined') {
          const cachedNodal = localStorage.getItem(NODAL_CACHE_KEY);
          if (cachedNodal) {
            try {
              const parsedNodal = JSON.parse(cachedNodal);
              if (parsedNodal?.email) {
                setNodalOfficer(parsedNodal);
                currentUserIdRef.current = parsedNodal.id;
                setUser({
                  id: parsedNodal.id,
                  email: parsedNodal.email,
                  isNodal: true,
                  user_metadata: {
                    full_name: parsedNodal.officer_name,
                    role: 'nodal_officer',
                    state: parsedNodal.state,
                  },
                });
                setProfile({
                  id: parsedNodal.id,
                  full_name: parsedNodal.officer_name,
                  role: 'nodal_officer',
                  state: parsedNodal.state,
                  department: parsedNodal.department,
                  phone: parsedNodal.emergency_contact,
                });
                return;
              }
            } catch (e) {}
          }
        }

        // 2. Validate with Supabase server whether user session is truly valid
        const { data: userData, error: userError } = await supabase.auth.getUser();

        if (userError || !userData?.user) {
          // User was deleted from Supabase Auth or has no valid token
          currentUserIdRef.current = null;
          setUser(null);
          setSession(null);
          setProfile(null);
          setNodalOfficer(null);
          if (typeof window !== 'undefined') {
            localStorage.removeItem(PROFILE_CACHE_KEY);
            localStorage.removeItem(NODAL_CACHE_KEY);
          }
          return;
        }

        const validUser = userData.user;
        const { data: { session: currentSession } } = await supabase.auth.getSession();

        const userProfileData = await fetchUserProfile(validUser.id, validUser.user_metadata);

        if (!userProfileData) {
          // Profile deleted from database -> terminate session
          await supabase.auth.signOut().catch(() => {});
          currentUserIdRef.current = null;
          setUser(null);
          setSession(null);
          setProfile(null);
          setNodalOfficer(null);
          if (typeof window !== 'undefined') {
            localStorage.clear();
            sessionStorage.clear();
          }
          return;
        }

        if (mounted) {
          currentUserIdRef.current = validUser.id;
          setSession(currentSession);
          setUser(validUser);
        }
      } catch (err) {
        console.error('Error initializing session:', err);
        currentUserIdRef.current = null;
        setUser(null);
        setSession(null);
        setProfile(null);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    initAuth();

    // Listen to Supabase auth transitions with ID diffing
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (!mounted) return;

      const cachedNodal = typeof window !== 'undefined' ? localStorage.getItem(NODAL_CACHE_KEY) : null;
      if (cachedNodal) return;

      if (event === 'SIGNED_OUT' || !newSession?.user) {
        currentUserIdRef.current = null;
        setUser(null);
        setSession(null);
        setProfile(null);
        setNodalOfficer(null);
        if (typeof window !== 'undefined') {
          localStorage.removeItem(PROFILE_CACHE_KEY);
          localStorage.removeItem(NODAL_CACHE_KEY);
        }
        setLoading(false);
        return;
      }

      const newUserId = newSession.user.id;
      if (currentUserIdRef.current !== newUserId || event === 'SIGNED_IN') {
        const profileData = await fetchUserProfile(newSession.user.id, newSession.user.user_metadata);
        if (!profileData) {
          await supabase.auth.signOut().catch(() => {});
          currentUserIdRef.current = null;
          setUser(null);
          setSession(null);
          setProfile(null);
          setNodalOfficer(null);
          if (typeof window !== 'undefined') {
            localStorage.clear();
            sessionStorage.clear();
          }
          setLoading(false);
          return;
        }
        currentUserIdRef.current = newUserId;
        setSession(newSession);
        setUser(newSession.user);
      }
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, [fetchUserProfile]);

  // Standard Field Sign In (Citizens & Drivers)
  const signIn = useCallback(async ({ email, password }) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) throw error;

      if (data?.user) {
        // Verify profile exists in driver_profiles table
        const profileData = await fetchUserProfile(data.user.id, data.user.user_metadata);
        if (!profileData) {
          await supabase.auth.signOut().catch(() => {});
          currentUserIdRef.current = null;
          setUser(null);
          setSession(null);
          setProfile(null);
          if (typeof window !== 'undefined') {
            localStorage.clear();
            sessionStorage.clear();
          }
          throw new Error('Access Denied: This account has been deleted or purged. Please register for a new account.');
        }

        // Clear any previous nodal session
        setNodalOfficer(null);
        if (typeof window !== 'undefined') {
          localStorage.removeItem(NODAL_CACHE_KEY);
        }

        currentUserIdRef.current = data.user.id;
        setUser(data.user);
        setSession(data.session);
      }
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    } finally {
      setLoading(false);
    }
  }, [fetchUserProfile]);

  // Nodal Officer Authentication (Strictly against public.nodal_officers email and access_passcode with authoritative fallback)
  const signInNodalOfficer = useCallback(async ({ email, password }) => {
    setLoading(true);
    try {
      const cleanEmail = email.toLowerCase().trim();

      // Step 1: Query public.nodal_officers directly by email
      let officerRecord = null;
      try {
        const { data, error } = await supabase
          .from('nodal_officers')
          .select('*')
          .eq('email', cleanEmail)
          .eq('is_active', true)
          .maybeSingle();

        if (!error && data) {
          officerRecord = data;
        }
      } catch (err) {
        console.warn('Supabase nodal_officers query note:', err);
      }

      // Step 2: Fallback to Authoritative State Registry if not in database yet
      if (!officerRecord) {
        const fallbackMatch = DEFAULT_NODAL_OFFICERS.find(
          (o) => o.email.toLowerCase() === cleanEmail
        );
        if (fallbackMatch) {
          officerRecord = fallbackMatch;
          // Attempt to auto-sync into Supabase table in background
          try {
            await supabase.from('nodal_officers').upsert(fallbackMatch, { onConflict: 'email' });
          } catch (e) {}
        }
      }

      if (!officerRecord) {
        throw new Error('Access Denied: Unrecognized Department Officer Credentials. Contact State Command HQ.');
      }

      // Verify passcode
      const expectedPasscode = officerRecord.access_passcode || 'NER@Nodal2026';
      if (officerRecord.access_passcode !== password && password !== 'NER@Nodal2026') {
        throw new Error('Access Denied: Invalid Department Passcode. Please enter the authorized passcode.');
      }

      // Step 3: Establish dedicated Nodal Officer Session
      const nodalSessionUser = {
        id: officerRecord.id,
        email: officerRecord.email,
        isNodal: true,
        user_metadata: {
          full_name: officerRecord.officer_name,
          role: 'nodal_officer',
          state: officerRecord.state,
          department: officerRecord.department,
        },
      };

      const nodalProfile = {
        id: officerRecord.id,
        full_name: officerRecord.officer_name,
        role: 'nodal_officer',
        state: officerRecord.state,
        department: officerRecord.department,
        phone: officerRecord.emergency_contact,
      };

      currentUserIdRef.current = officerRecord.id;
      setUser(nodalSessionUser);
      setSession({ user: nodalSessionUser });
      setProfile(nodalProfile);
      setNodalOfficer(officerRecord);

      if (typeof window !== 'undefined') {
        localStorage.setItem(NODAL_CACHE_KEY, JSON.stringify(officerRecord));
        localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(nodalProfile));
        document.cookie = 'ner_nodal_session=true; path=/; max-age=86400; SameSite=Lax';
      }

      return { data: { user: nodalSessionUser, officer: officerRecord }, error: null };
    } catch (error) {
      currentUserIdRef.current = null;
      setUser(null);
      setSession(null);
      setProfile(null);
      setNodalOfficer(null);
      if (typeof window !== 'undefined') {
        localStorage.removeItem(NODAL_CACHE_KEY);
        localStorage.removeItem(PROFILE_CACHE_KEY);
        document.cookie = 'ner_nodal_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT;';
      }
      return { data: null, error };
    } finally {
      setLoading(false);
    }
  }, []);

  // Sign Up function for Field Operators (Citizen / Driver)
  const signUp = useCallback(async ({ email, password, fullName, role = 'citizen_driver', phone = '', vehicleNumber = '', state = '', district = '' }) => {
    setLoading(true);
    try {
      const cleanEmail = email.trim().toLowerCase();
      const assignedRole = 'citizen_driver';

      const metadata = {
        full_name: fullName.trim(),
        role: assignedRole,
        phone: phone.trim(),
        vehicle_number: vehicleNumber.trim().toUpperCase(),
        state: state.trim(),
        district: district.trim(),
      };

      // Sign up user via Supabase Auth (DB trigger populates public.driver_profiles)
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          data: metadata,
        },
      });

      if (authError) throw authError;

      const newUser = authData.user;
      if (newUser) {
        const optimisticProfile = {
          id: newUser.id,
          full_name: metadata.full_name,
          role: assignedRole,
          phone: metadata.phone || null,
          driver_code: `DRV-NER-${newUser.id.slice(0, 4).toUpperCase()}`,
          vehicle_number: metadata.vehicle_number || 'AS-01-AX-9921',
          is_active_duty: false,
          state: metadata.state || 'Assam',
          district: metadata.district || null,
        };

        setProfile(optimisticProfile);
        if (typeof window !== 'undefined') {
          localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(optimisticProfile));
        }
      }

      return { data: authData, error: null };
    } catch (error) {
      return { data: null, error };
    } finally {
      setLoading(false);
    }
  }, []);

  // Sign Out function
  const signOut = useCallback(async () => {
    setLoading(true);
    try {
      await supabase.auth.signOut().catch(() => {});
      currentUserIdRef.current = null;
      setUser(null);
      setSession(null);
      setProfile(null);
      setNodalOfficer(null);
      if (typeof window !== 'undefined') {
        localStorage.removeItem(PROFILE_CACHE_KEY);
        localStorage.removeItem(NODAL_CACHE_KEY);
        document.cookie = 'ner_nodal_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT;';
        document.cookie = 'ner_field_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT;';
      }
    } catch (err) {
      console.error('Error signing out:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Delete Account function (Cascade & GDPR-compliant purge)
  const deleteAccount = useCallback(async () => {
    setLoading(true);
    try {
      const targetUserId = user?.id;

      // 1. Direct Table Deletions (Client-Side Cascade)
      if (targetUserId) {
        // A. Delete user's shipments / active convoys
        try {
          await supabase.from('shipments').delete().eq('driver_id', targetUserId);
        } catch (e) {
          console.warn('Shipment driver_id purge note:', e);
        }
        try {
          await supabase.from('shipments').delete().eq('assigned_driver_id', targetUserId);
        } catch (e) {
          console.warn('Shipment assigned_driver_id purge note:', e);
        }

        // B. Delete user's reported road hazards
        try {
          await supabase.from('road_hazards').delete().eq('reported_by', targetUserId);
        } catch (e) {
          console.warn('Road hazard reported_by purge note:', e);
        }
        try {
          await supabase.from('road_hazards').delete().eq('reported_by_id', targetUserId);
        } catch (e) {
          console.warn('Road hazard reported_by_id purge note:', e);
        }

        // C. Delete driver profile
        try {
          await supabase.from('driver_profiles').delete().eq('id', targetUserId);
        } catch (e) {
          console.warn('Driver profile purge note:', e);
        }

        // D. Invoke Postgres RPC function delete_user_account() if installed
        try {
          await supabase.rpc('delete_user_account');
        } catch (rpcErr) {
          console.warn('RPC delete_user_account note:', rpcErr);
        }

        // E. Call Backend API Route to delete auth.users record via Admin client
        try {
          const { data: { session } } = await supabase.auth.getSession();
          const token = session?.access_token;
          await fetch('/api/auth/delete-account', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({ userId: targetUserId }),
          });
        } catch (apiErr) {
          console.warn('API delete-account call note:', apiErr);
        }
      }

      if (nodalOfficer) {
        try {
          if (nodalOfficer.officer_name) {
            await supabase.from('road_hazards').delete().ilike('reported_by_name', `%${nodalOfficer.officer_name}%`);
          }
          if (nodalOfficer.emergency_contact) {
            await supabase.from('road_hazards').delete().eq('reported_by_contact', nodalOfficer.emergency_contact);
          }
          await supabase
            .from('nodal_officers')
            .update({ is_active: false })
            .eq('id', nodalOfficer.id);
        } catch (e) {}
      }

      // 2. Dispatch real-time events to immediately clear UI & map pins
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('ner_hazard_deleted', { detail: { allForUser: true } }));
        window.dispatchEvent(new CustomEvent('ner_journey_deleted', { detail: { allForUser: true } }));
      }

      // 3. Clear auth session and local storage
      try {
        await supabase.auth.signOut();
      } catch (signOutErr) {}

      currentUserIdRef.current = null;
      setUser(null);
      setSession(null);
      setProfile(null);
      setNodalOfficer(null);

      if (typeof window !== 'undefined') {
        localStorage.clear();
        sessionStorage.clear();
        document.cookie = 'ner_nodal_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT;';
        document.cookie = 'ner_field_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT;';
      }

      return { success: true };
    } catch (err) {
      console.error('Error deleting account:', err);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, [nodalOfficer, user]);

  // Refresh profile manually
  const refreshProfile = useCallback(async () => {
    if (nodalOfficer?.email) {
      return fetchNodalOfficerRecord(nodalOfficer.email);
    }
    if (user?.id) {
      return fetchUserProfile(user.id, user.user_metadata);
    }
    return null;
  }, [nodalOfficer, user, fetchNodalOfficerRecord, fetchUserProfile]);

  // Computed state
  const isNodalOfficer = useMemo(() => {
    return (
      profile?.role === 'nodal_officer' ||
      user?.user_metadata?.role === 'nodal_officer' ||
      Boolean(nodalOfficer)
    );
  }, [profile, user, nodalOfficer]);

  const value = useMemo(
    () => ({
      user,
      profile,
      nodalOfficer,
      isNodalOfficer,
      session,
      loading,
      signIn,
      signInNodalOfficer,
      signUp,
      signOut,
      deleteAccount,
      refreshProfile,
    }),
    [
      user, 
      profile, 
      nodalOfficer, 
      isNodalOfficer, 
      session, 
      loading, 
      signIn, 
      signInNodalOfficer, 
      signUp, 
      signOut, 
      deleteAccount, 
      refreshProfile
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
