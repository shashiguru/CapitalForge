'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { authApi } from '@/lib/api';
import type { User as AppUser, LoginCredentials, RegisterCredentials } from '@/lib/types';

interface AuthContextType {
  user: AppUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (credentials: LoginCredentials) => Promise<boolean>;
  register: (credentials: RegisterCredentials) => Promise<boolean>;
  logout: () => Promise<void>;
  updateProfile: (dto: { name?: string; currentPassword?: string; newPassword?: string }) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Store user data in sessionStorage so it persists during page navigations
const STORAGE_KEY = 'cf_user';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const initAuth = async () => {
      try {
        // Check if we have a token
        const token = localStorage.getItem('token');
        console.log('[Auth] Initializing... Token found:', !!token);
        
        if (!token) {
          console.log('[Auth] No token found');
          setIsLoading(false);
          return;
        }

        // Check if we have cached user data from sessionStorage
        const cachedUserStr = sessionStorage.getItem(STORAGE_KEY);
        if (cachedUserStr) {
          try {
            const cachedUser = JSON.parse(cachedUserStr);
            console.log('[Auth] Restoring user from session:', cachedUser.email);
            setUser(cachedUser);
            setIsLoading(false);
            return;
          } catch (e) {
            console.error('[Auth] Failed to parse cached user');
          }
        }

        // No cached user, try to fetch profile
        try {
          const profile = await authApi.getProfile();
          console.log('[Auth] Profile fetched successfully:', profile.email);
          setUser(profile);
          sessionStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
        } catch (profileError: any) {
          console.error('[Auth] Profile fetch failed:', profileError.message);
          // Token might be invalid, clear it
          localStorage.removeItem('token');
          setUser(null);
        }
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, []);

  const login = async (credentials: LoginCredentials): Promise<boolean> => {
    try {
      const response = await authApi.login(credentials);
      localStorage.setItem('token', response.accessToken);
      const userData = response.user as AppUser;
      console.log('[Auth] Login successful:', userData.email);
      setUser(userData);
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(userData));
      return true;
    } catch (error: any) {
      console.error('[Auth] Login failed:', error.message);
      throw new Error(error.response?.data?.message || 'Login failed');
    }
  };

  const register = async (credentials: RegisterCredentials): Promise<boolean> => {
    try {
      const response = await authApi.register(credentials);
      localStorage.setItem('token', response.accessToken);
      const userData = response.user as AppUser;
      console.log('[Auth] Register successful:', userData.email);
      setUser(userData);
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(userData));
      return true;
    } catch (error: any) {
      console.error('[Auth] Register failed:', error.message);
      throw new Error(error.response?.data?.message || 'Registration failed');
    }
  };

  const logout = async () => {
    localStorage.removeItem('token');
    sessionStorage.removeItem(STORAGE_KEY);
    setUser(null);
    router.push('/auth/login');
  };

  const updateProfile = async (dto: { name?: string; currentPassword?: string; newPassword?: string }) => {
    const updated = await authApi.updateProfile(dto);
    setUser(updated);
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
        updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
