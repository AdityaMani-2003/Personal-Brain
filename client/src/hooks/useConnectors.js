import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../lib/api';

/**
 * Hook to manage Google connectors state and synchronization actions.
 * Implements Antigravity §10.
 */
export function useConnectors({ onSyncSuccess, onSyncError } = {}) {
  const [connectors, setConnectors] = useState({
    gmail: { status: 'idle', lastAttemptAt: null, lastSuccessAt: null, lastError: null, lastSyncedCount: 0, indexedCount: 0 },
    calendar: { status: 'idle', lastAttemptAt: null, lastSuccessAt: null, lastError: null, lastSyncedCount: 0, indexedCount: 0 }
  });
  const [loading, setLoading] = useState(true);

  const onSyncSuccessRef = useRef(onSyncSuccess);
  const onSyncErrorRef = useRef(onSyncError);

  useEffect(() => {
    onSyncSuccessRef.current = onSyncSuccess;
    onSyncErrorRef.current = onSyncError;
  }, [onSyncSuccess, onSyncError]);

  const fetchConnectors = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.getConnectors();
      if (res && res.connectors) {
        setConnectors(res.connectors);
      }
    } catch (err) {
      console.error('Failed to fetch connectors state:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConnectors();
  }, [fetchConnectors]);

  const syncGmail = async () => {
    setConnectors(prev => ({
      ...prev,
      gmail: { ...prev.gmail, status: 'syncing' }
    }));

    try {
      const res = await api.syncGmail(50);
      await fetchConnectors();
      if (onSyncSuccessRef.current) onSyncSuccessRef.current('gmail', res.syncedCount);
      return res;
    } catch (err) {
      setConnectors(prev => ({
        ...prev,
        gmail: { ...prev.gmail, status: 'error', lastError: err.message }
      }));
      if (onSyncErrorRef.current) onSyncErrorRef.current('gmail', err.message);
      throw err;
    }
  };

  const syncCalendar = async () => {
    setConnectors(prev => ({
      ...prev,
      calendar: { ...prev.calendar, status: 'syncing' }
    }));

    try {
      const res = await api.syncCalendar();
      await fetchConnectors();
      if (onSyncSuccessRef.current) onSyncSuccessRef.current('calendar', res.syncedCount);
      return res;
    } catch (err) {
      setConnectors(prev => ({
        ...prev,
        calendar: { ...prev.calendar, status: 'error', lastError: err.message }
      }));
      if (onSyncErrorRef.current) onSyncErrorRef.current('calendar', err.message);
      throw err;
    }
  };

  // Run sequential auto-sync for both services after OAuth connection
  const runSequentialAutoSync = async () => {
    try {
      await syncGmail();
    } catch (e) {
      console.warn('Auto-sync Gmail failed:', e.message);
    }
    try {
      await syncCalendar();
    } catch (e) {
      console.warn('Auto-sync Calendar failed:', e.message);
    }
  };

  return {
    connectors,
    loading,
    refreshConnectors: fetchConnectors,
    syncGmail,
    syncCalendar,
    runSequentialAutoSync
  };
}
