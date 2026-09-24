import React, { useState, useEffect } from 'react';
import { Activity, X, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { api } from '../lib/api';

/**
 * Activity Log Modal Component.
 * Implements Antigravity §10.
 */
export default function ActivityModal({ isOpen, onClose }) {
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      api.getActivity()
        .then((res) => {
          setActivity(res.activity || []);
        })
        .catch((err) => console.error('Failed to fetch activity:', err))
        .finally(() => setLoading(false));

      const handleKeyDown = (e) => {
        if (e.key === 'Escape') onClose();
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="dialog-backdrop" onClick={onClose} role="presentation">
      <div
        className="dialog-box activity-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="activity-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="dialog-header">
          <div className="dialog-title-row">
            <Activity size={18} className="text-teal" />
            <h3 id="activity-title">Recent Activity Logs</h3>
          </div>
          <button className="dialog-close-btn" onClick={onClose} aria-label="Close dialog">
            <X size={16} />
          </button>
        </div>

        <div className="dialog-body activity-dialog-body">
          {loading ? (
            <div className="activity-loading">
              <RefreshCw size={18} className="animate-spin text-teal" />
              <span>Loading activity...</span>
            </div>
          ) : activity.length === 0 ? (
            <div className="activity-empty">
              <Activity size={24} className="text-muted" />
              <span>No activity recorded yet</span>
            </div>
          ) : (
            <div className="activity-timeline">
              {activity.map((entry) => {
                const isError = entry.status === 'error';
                return (
                  <div key={entry.id} className="activity-row">
                    <div className="activity-icon-col">
                      {isError ? (
                        <AlertCircle size={14} className="text-red" />
                      ) : (
                        <CheckCircle2 size={14} className="text-teal" />
                      )}
                    </div>
                    <div className="activity-details-col">
                      <span className="activity-message">{entry.message}</span>
                      <span className="activity-time">
                        {new Date(entry.timestamp).toLocaleString()}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
