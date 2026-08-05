import React, { createContext, useContext, useEffect, useState } from 'react';
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

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .single();
    setProfile(data as Profile | null);
  };

  const fetchRoles = async (userId: string) => {
    const { data } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId);
    setRoles((data || []).map((r: any) => r.role as AppRole));
  };

  const fetchCustomerClient = async (userId: string) => {
    const { data } = await supabase
      .from('clients')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    setCustomerClient((data as CustomerClient | null) ?? null);
  };

  const refreshProfile = async () => {
    if (user) {
      await Promise.all([fetchProfile(user.id), fetchRoles(user.id), fetchCustomerClient(user.id)]);
    }
  };

  useEffect(() => {
    let isMounted = true;

    // Listener for ONGOING auth changes (does NOT control loading)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!isMounted) return;
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          setTimeout(() => {
            if (!isMounted) return;
            Promise.all([
              fetchProfile(session.user.id),
              fetchRoles(session.user.id),
              fetchCustomerClient(session.user.id),
            ]).then(() => {
              if (isMounted) setLoading(false);
            });
          }, 0);
        } else {
          setProfile(null);
          setRoles([]);
          setCustomerClient(null);
          if (isMounted) setLoading(false);
        }
      }
    );

    // INITIAL load (controls loading)
    const initializeAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!isMounted) return;
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          await Promise.all([
            fetchProfile(session.user.id),
            fetchRoles(session.user.id),
            fetchCustomerClient(session.user.id),
          ]);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    initializeAuth();

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setRoles([]);
    setCustomerClient(null);
  };

  const isAgent = roles.includes('agent');
  const isAdmin = roles.includes('admin') || roles.includes('super_admin');
  const isSuperAdmin = roles.includes('super_admin');
  // Marketplace customers have no staff roles at all.
  const isCustomer = !!user && roles.length === 0;

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
