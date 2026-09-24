import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';

/**
 * Hook to centralize fetching and state for GBrain store stats.
 * Prevents redundant fetches across sidebar, storage manager, and top bar.
 * Implements Antigravity §14.
 */
export function useStoreStats() {
  const [stats, setStats] = useState({
    emailCount: 0,
    eventCount: 0,
    recentEmails: [],
    recentEvents: []
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getStoreStats();
      if (data && data.stats) {
        setStats(data.stats);
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch store statistics');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return {
    stats,
    loading,
    error,
    refreshStats: fetchStats
  };
}
