import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import type { Tier } from '@/lib/commission';

type AppRole = 'agent' | 'admin' | 'super_admin';
type AgentStatus = 'pending' | 'approved' | 'suspended';

interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  phone: string;
  town_estate: string;
  mpesa_number: string;
  referral_code: string | null;
  status: AgentStatus;
}

export interface CustomerClient {
  id: string;
  full_name: string;
  phone: string;
  whatsapp_number: string | null;
  location: string | null;
  status: string;
  total_spend: number;
  booking_count: number;
  client_code: string | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  customerClient: CustomerClient | null;
  isCustomer: boolean;
  roles: AppRole[];
  loading: boolean;
  isAgent: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [customerClient, setCustomerClient] = useState<CustomerClient | null>(null);
  const [loading, setLoading] = useState(true);
  const lastFetchedUserId = useRef<string | null>(null);
  const loadUserDataPromise = useRef<Promise<void> | null>(null);

  const fetchProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching profile:', error);
      setProfile(null);
      return;
    }

    setProfile(data as Profile | null);
  };

  const fetchRoles = async (userId: string) => {
    const { data, error } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId);
    if (error) {
      console.error('Error fetching roles:', error);
    }
    setRoles((data || []).map((r: any) => r.role as AppRole));
  };

  const fetchCustomerClient = async (userId: string) => {
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) {
      console.error('Error fetching customer client:', error);
    }
    setCustomerClient((data as CustomerClient | null) ?? null);
  };

  const refreshProfile = async () => {
    if (user) {
      await Promise.all([fetchProfile(user.id), fetchRoles(user.id), fetchCustomerClient(user.id)]);
    }
  };

  // Loads profile/roles/client data for a user exactly once per session,
  // regardless of how many auth events fire for that same user.
  const loadUserData = (userId: string): Promise<void> => {
    // If we're already fetching (or have finished fetching) this same user's
    // data, return the SAME promise instead of assuming it's already done.
    // This avoids a race where a second auth event marks loading as finished
    // before the real network fetch has actually completed.
    if (lastFetchedUserId.current === userId && loadUserDataPromise.current) {
      return loadUserDataPromise.current;
    }
    lastFetchedUserId.current = userId;
    loadUserDataPromise.current = Promise.all([
      fetchProfile(userId),
      fetchRoles(userId),
      fetchCustomerClient(userId),
    ]).then(() => {});
    return loadUserDataPromise.current;
  };

  useEffect(() => {
    let isMounted = true;

    // Supabase fires this immediately with the current session on subscribe,
    // so we don't need a separate getSession() call.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!isMounted) return;
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          loadUserData(session.user.id).then(() => {
            if (isMounted) setLoading(false);
          });
        } else {
          lastFetchedUserId.current = null;
          loadUserDataPromise.current = null;
          setProfile(null);
          setRoles([]);
          setCustomerClient(null);
          if (isMounted) setLoading(false);
        }
      }
    );

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const isAgent = roles.includes('agent');
  const isAdmin = roles.includes('admin') || roles.includes('super_admin');
  const isSuperAdmin = roles.includes('super_admin');
  // Marketplace customers have no staff roles at all.
  const isCustomer = !!user && roles.length === 0;

  // Customer self-service link. Only an existing, unowned client record whose email
  // matches a Google-verified sign-in is linked, and only on the server (claim_client_record).
  // Phone numbers are never used to link. If nothing matches, the profile dialog asks
  // the customer for their details and creates the record.
  useEffect(() => {
    if (loading || !user || roles.length > 0 || customerClient) return;

    let cancelled = false;

    (async () => {
      const { data: clientId, error: claimError } = await supabase.rpc('claim_client_record' as any);

      if (claimError) {
        console.error('Could not check customer record:', claimError.message);
        return;
      }

      if (!clientId || cancelled) return;

      const { data: linked, error: loadError } = await supabase
        .from('clients')
        .select('*')
        .eq('id', clientId as any)
        .maybeSingle();

      if (loadError) {
        console.error('Could not load linked customer record:', loadError.message);
        return;
      }

      if (!cancelled && linked) {
        setCustomerClient(linked as CustomerClient);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [loading, user, roles.length, customerClient]);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setRoles([]);
    setCustomerClient(null);
    lastFetchedUserId.current = null;
    loadUserDataPromise.current = null;
  };

  return (
    <AuthContext.Provider value={{
      user, session, profile, roles, loading,
      customerClient, isCustomer,
      isAgent, isAdmin, isSuperAdmin,
      signOut, refreshProfile,
    }}>
      {children}
    </AuthContext.Provider>
  );
}
