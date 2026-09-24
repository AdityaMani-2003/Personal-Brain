import React from 'react';
import { Mail, Calendar, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';

function formatRelativeTime(isoString) {
  if (!isoString) return 'Never';
  const date = new Date(isoString);
  const now = new Date();
  const diffSec = Math.floor((now - date) / 1000);

  if (diffSec < 60) return 'Just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return `${Math.floor(diffSec / 86400)}d ago`;
}

/**
 * Truthful Connector Card Component.
 * Implements Antigravity §10.
 */
export default function ConnectorCard({
  type, // 'gmail' | 'calendar'
  state,
  isConnected,
  onSync
}) {
  const isGmail = type === 'gmail';
  const title = isGmail ? 'Google Gmail' : 'Google Calendar';
  const Icon = isGmail ? Mail : Calendar;

  const status = !isConnected ? 'not_connected' : (state?.status || 'idle');
  const isSyncing = status === 'syncing';
  const hasError = status === 'error';
  const isOk = status === 'ok' || (status === 'idle' && state?.lastSuccessAt);

  const indexedCount = state?.indexedCount || 0;
  const countLabel = isGmail ? 'emails' : 'events';
  const relativeSyncTime = formatRelativeTime(state?.lastSuccessAt);

  return (
    <div className={`connector-card ${hasError ? 'card-has-error' : ''}`}>
      <div className="connector-card-header">
        <div className="connector-icon-wrapper">
          <Icon size={16} className={isGmail ? 'text-teal' : 'text-blue'} />
        </div>
        <div className="connector-info">
          <div className="connector-title-row">
            <span className="connector-name">{title}</span>
            <span
              className={`status-dot ${
                !isConnected
                  ? 'status-dot-disconnected'
                  : isSyncing
                  ? 'status-dot-syncing'
                  : hasError
                  ? 'status-dot-error'
                  : 'status-dot-connected'
              }`}
              title={
                !isConnected
                  ? 'Not connected'
                  : isSyncing
                  ? 'Syncing now...'
                  : hasError
                  ? 'Sync error'
                  : 'Connected'
              }
            />
          </div>
          <div className="connector-stats-row">
            <span className="connector-count">
              <strong>{indexedCount}</strong> {countLabel}
            </span>
            <span className="connector-time">· {relativeSyncTime}</span>
          </div>
        </div>
      </div>

      {hasError && (
        <div className="connector-error-banner">
          <AlertCircle size={12} className="text-red flex-shrink-0" />
          <span className="error-text" title={state?.lastError}>
            {state?.lastError || 'Sync failed'}
          </span>
          <button
            className="btn-retry"
            onClick={onSync}
            disabled={!isConnected || isSyncing}
          >
            Retry
          </button>
        </div>
      )}

      <div className="connector-actions">
        <button
          className="btn btn-card-action"
          onClick={onSync}
          disabled={!isConnected || isSyncing}
          title={!isConnected ? 'Connect your Google account to sync data' : `Sync ${title}`}
        >
          <RefreshCw size={13} className={isSyncing ? 'animate-spin' : ''} />
          <span>{isSyncing ? 'Syncing...' : 'Sync Now'}</span>
        </button>
      </div>
    </div>
  );
}
