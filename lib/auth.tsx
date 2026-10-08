import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { Merchant, Profile } from '../types';
import { fetchMyMerchant, fetchProfile } from './api';
import { navigate } from './router';
import { supabase } from './supabase';

interface AuthState {
  session: Session | null;
  userId: string | null;
  email: string;
  profile: Profile | null;
  /** 自己擁有的店家（沒有申請過就是 null） */
  merchant: Merchant | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  refreshMerchant: () => Promise<void>;
  setProfile: (profile: Profile) => void;
  setMerchant: (merchant: Merchant | null) => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [merchant, setMerchant] = useState<Merchant | null>(null);
  const [loading, setLoading] = useState(true);
  const userId = session?.user.id || null;

  useEffect(() => {
    const client = supabase();
    let active = true;
    client.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      if (!data.session) setLoading(false);
    }).catch(() => setLoading(false));

    const { data } = client.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);
      if (!nextSession) {
        setProfile(null);
        setMerchant(null);
        setLoading(false);
      }
      if (event === 'PASSWORD_RECOVERY') navigate('/reset-password');
    });

    // 從信件連結回來（?code=...）時，登入完成後把網址清乾淨
    const url = new URL(window.location.href);
    if (url.searchParams.has('code') || url.searchParams.has('error_description')) {
      const description = url.searchParams.get('error_description');
      url.search = '';
      window.setTimeout(() => {
        window.history.replaceState(null, '', url.toString());
        if (description) {
          window.dispatchEvent(new CustomEvent('healthgenie_toast', {
            detail: { message: '連結已失效或已使用過，請直接登入', type: 'info' },
          }));
        }
      }, 1500);
    }

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!userId) return;
    setProfile(await fetchProfile(userId));
  }, [userId]);

  const refreshMerchant = useCallback(async () => {
    if (!userId) return;
    setMerchant(await fetchMyMerchant(userId));
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    setLoading(true);
    Promise.all([fetchProfile(userId), fetchMyMerchant(userId)])
      .then(([nextProfile, nextMerchant]) => {
        if (!active) return;
        setProfile(nextProfile);
        setMerchant(nextMerchant);
      })
      .catch(() => {
        // 讀取失敗時保持登入狀態，頁面會顯示個別錯誤
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [userId]);

  const signOut = useCallback(async () => {
    await supabase().auth.signOut();
    navigate('/stores');
  }, []);

  const value = useMemo<AuthState>(() => ({
    session,
    userId,
    email: session?.user.email || '',
    profile,
    merchant,
    loading,
    refreshProfile,
    refreshMerchant,
    setProfile,
    setMerchant,
    signOut,
  }), [session, userId, profile, merchant, loading, refreshProfile, refreshMerchant, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthState => {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth 必須在 AuthProvider 裡使用');
  return value;
};

/** 需要登入的頁面：未登入時帶到登入頁，登入後再回來 */
export const loginPath = (returnTo: string): string => `/login?next=${encodeURIComponent(returnTo)}`;
