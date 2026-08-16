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
  const loadUserData = async (userId: string) => {
    if (lastFetchedUserId.current === userId) return;
    lastFetchedUserId.current = userId;
    await Promise.all([
      fetchProfile(userId),
      fetchRoles(userId),
      fetchCustomerClient(userId),
    ]);
  };

  useEffect(() => {
    let isMounted = true;

    // Supabase fires this immediately with the current session on subscribe,
    // so we don't need a separate getSession() call — that was causing
    // duplicate fetches of the same data.
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

  // Self-heal: make sure every customer account is linked to a CRM client record.
  useEffect(() => {
    if (loading || !user || roles.length > 0 || customerClient) return;

    let cancelled = false;

    (async () => {
      const meta = (user.user_metadata || {}) as Record<string, string>;

      const phone = (meta.phone || '').trim();

      if (!phone) {
        console.warn('Customer has no phone number. Skipping CRM client creation.');
        return;
      }

      const { data: existingByUser, error: userLookupError } = await supabase
        .from('clients')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (userLookupError) {
        console.error('Error checking client by user:', userLookupError);
        return;
      }

      if (existingByUser) {
        if (!cancelled) {
          setCustomerClient(existingByUser as CustomerClient);
        }
        return;
      }

      const { data: existingByPhone, error: phoneLookupError } = await supabase
        .from('clients')
        .select('*')
        .eq('phone', phone)
        .maybeSingle();

      if (phoneLookupError) {
        console.error('Error checking client by phone:', phoneLookupError);
        return;
      }

      if (existingByPhone) {
        const { data: linkedClient, error: linkError } = await supabase
          .from('clients')
          .update({
            user_id: user.id,
          })
          .eq('id', existingByPhone.id)
          .select('*')
          .maybeSingle();

        if (linkError) {
          console.error('Error linking existing CRM client:', linkError);

          if (!cancelled) {
            setCustomerClient(existingByPhone as CustomerClient);
          }

          return;
        }

        if (!cancelled) {
          setCustomerClient(
            (linkedClient as CustomerClient) ||
            (existingByPhone as CustomerClient)
          );
        }

        return;
      }

      const { data: newClient, error: insertError } = await supabase
        .from('clients')
        .insert({
          full_name: meta.full_name || user.email || 'Customer',
          phone,
          whatsapp_number: meta.whatsapp_number || phone,
          location: meta.location || '',
          notes: meta.notes || null,
          status: 'new',
          created_by: user.id,
          created_by_role: 'customer',
          user_id: user.id,
        })
        .select('*')
        .maybeSingle();

      if (insertError) {
        console.error('Error creating customer client:', insertError);
        return;
      }

      if (!cancelled && newClient) {
        setCustomerClient(newClient as CustomerClient);
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
