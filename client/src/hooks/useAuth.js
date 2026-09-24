import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../lib/api';

/**
 * Hook for managing Google OAuth authentication state and callback detection.
 * Implements Antigravity §8 & §10.
 */
export function useAuth({ onAuthSuccess, onAuthError } = {}) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [configStatus, setConfigStatus] = useState({ geminiConfigured: false, googleConfigured: false });

  const onAuthSuccessRef = useRef(onAuthSuccess);
  const onAuthErrorRef = useRef(onAuthError);

  useEffect(() => {
    onAuthSuccessRef.current = onAuthSuccess;
    onAuthErrorRef.current = onAuthError;
  }, [onAuthSuccess, onAuthError]);

  const fetchUser = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getAuth();
      if (data && data.user) {
        setUser(data.user);
      } else {
        setUser(null);
      }
    } catch (err) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchConfig = useCallback(async () => {
    try {
      const res = await api.getConfigStatus();
      setConfigStatus({
        geminiConfigured: res.geminiConfigured,
        googleConfigured: res.googleConfigured
      });
    } catch (e) {
      // Ignore
    }
  }, []);

  // Handle URL redirect query params and initial boot ONCE on mount
  useEffect(() => {
    fetchConfig();
    fetchUser();

    const params = new URLSearchParams(window.location.search);
    const authStatus = params.get('auth');
    const userName = params.get('user');
    const reason = params.get('reason');

    if (authStatus === 'success') {
      window.history.replaceState({}, '', window.location.pathname);
      fetchUser().then(() => {
        if (onAuthSuccessRef.current) {
          onAuthSuccessRef.current(decodeURIComponent(userName || 'User'));
        }
      });
    } else if (authStatus === 'error') {
      window.history.replaceState({}, '', window.location.pathname);
      if (onAuthErrorRef.current) {
        onAuthErrorRef.current(reason || 'Authentication failed');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const disconnect = async () => {
    try {
      await api.disconnectAuth();
      setUser(null);
      return true;
    } catch (err) {
      console.error('Failed to disconnect account:', err);
      return false;
    }
  };

  return {
    user,
    loading,
    configStatus,
    isAuthenticated: Boolean(user),
    refreshUser: fetchUser,
    disconnect
  };
}
