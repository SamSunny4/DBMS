'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getUserDatasets } from './api.js';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedDatasetId, setSelectedDatasetId] = useState('shared');
  const [userDatasets, setUserDatasets] = useState([]);

  // Load token from localStorage on mount
  useEffect(() => {
    const savedToken = localStorage.getItem('auth_token');
    if (savedToken) {
      setToken(savedToken);
      // Optionally verify token is still valid by calling /auth/me
      verifyToken(savedToken);
    } else {
      setLoading(false);
    }
  }, []);

  const verifyToken = async (authToken) => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/auth/me`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
      } else {
        // Token invalid, clear it
        localStorage.removeItem('auth_token');
        setToken(null);
      }
    } catch (err) {
      console.error('Token verification failed:', err);
      localStorage.removeItem('auth_token');
      setToken(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (username, password) => {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Login failed');
    }

    const authToken = data.token;
    localStorage.setItem('auth_token', authToken);
    setToken(authToken);
    setUser(data.user);

    return data;
  };

  const register = async (username, email, password) => {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Registration failed');
    }

    const authToken = data.token;
    localStorage.setItem('auth_token', authToken);
    setToken(authToken);
    setUser(data.user);

    return data;
  };

  const reloadUserDatasets = useCallback(async () => {
    try {
      const { datasets } = await getUserDatasets();
      setUserDatasets(datasets || []);
    } catch {
      setUserDatasets([]);
    }
  }, []);

  // Load datasets whenever the logged-in user changes
  useEffect(() => {
    if (user?.username) {
      setSelectedDatasetId('shared');
      reloadUserDatasets();
    } else {
      setUserDatasets([]);
      setSelectedDatasetId('shared');
    }
  }, [user?.username, reloadUserDatasets]);

  const logout = async () => {
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/auth/logout`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
    } catch (err) {
      console.error('Logout error:', err);
    }

    localStorage.removeItem('auth_token');
    setToken(null);
    setUser(null);
  };

  const refreshToken = async () => {
    if (!token) return null;

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/auth/refresh`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (response.ok) {
        const newToken = data.token;
        localStorage.setItem('auth_token', newToken);
        setToken(newToken);
        setUser(data.user);
        return newToken;
      } else {
        logout();
        return null;
      }
    } catch (err) {
      console.error('Token refresh failed:', err);
      logout();
      return null;
    }
  };

  const value = {
    user,
    token,
    loading,
    login,
    register,
    logout,
    refreshToken,
    isAuthenticated: !!token,
    isAdmin: user?.role === 'admin',
    selectedDatasetId,
    setSelectedDatasetId,
    userDatasets,
    reloadUserDatasets,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
