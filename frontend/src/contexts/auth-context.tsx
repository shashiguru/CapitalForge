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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const initAuth = async () => {
      try {
        // Check if token exists in localStorage
        const token = localStorage.getItem('token');
        console.log('[Auth] Initializing... Token found:', !!token);
        
        if (!token) {
          console.log('[Auth] No token found, setting isLoading=false');
          setIsLoading(false);
          return;
        }

        // Try to validate token by fetching profile
        try {
          const profile = await authApi.getProfile();
          console.log('[Auth] Profile fetched successfully:', profile);
          setUser(profile);
        } catch (profileError) {
          console.error('[Auth] Profile fetch failed, but token exists:', profileError);
          // Profile fetch failed - this could mean the token is invalid
          // or the backend is down. Clear the token to be safe.
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
      console.log('[Auth] Login successful, setting user:', userData);
      setUser(userData);
      return true;
    } catch (error: any) {
      console.error('[Auth] Login failed:', error);
      throw new Error(error.response?.data?.message || 'Login failed');
    }
  };

  const register = async (credentials: RegisterCredentials): Promise<boolean> => {
    try {
      const response = await authApi.register(credentials);
      localStorage.setItem('token', response.accessToken);
      const userData = response.user as AppUser;
      setUser(userData);
      return true;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Registration failed');
    }
  };

  const logout = async () => {
    localStorage.removeItem('token');
    setUser(null);
    router.push('/auth/login');
  };

  const updateProfile = async (dto: { name?: string; currentPassword?: string; newPassword?: string }) => {
    const updated = await authApi.updateProfile(dto);
    setUser(updated);
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
