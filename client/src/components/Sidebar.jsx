import React from 'react';
import { Database, Activity, ExternalLink, LogOut, Lock, ShieldCheck, ChevronRight, X } from 'lucide-react';
import ConnectorCard from './ConnectorCard';

/**
 * Sidebar Component.
 * Implements Antigravity §7, §8, §10.
 */
export default function Sidebar({
  user,
  isConnected,
  connectors,
  storeStats,
  onSyncGmail,
  onSyncCalendar,
  onOpenStorage,
  onOpenActivity,
  onDisconnect,
  onSelectQuery,
  mobileOpen,
  onCloseMobile
}) {
  const starterQueries = [
    { label: "Tomorrow's Schedule", query: "What's on my calendar tomorrow?" },
    { label: 'Stripe Failed Payment', query: 'Find the email from Stripe about the failed payment' },
    { label: 'Unread Emails', query: 'List my unread emails from this week' },
    { label: 'Cross-Source Meetings', query: "What meetings do I have this week, and which ones have a related email thread I haven't replied to?" }
  ];

  return (
    <>
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div className="sidebar-backdrop" onClick={onCloseMobile} role="presentation" />
      )}

      <aside className={`sidebar ${mobileOpen ? 'sidebar-mobile-open' : ''}`}>
        {/* Brand Header */}
        <div className="sidebar-header">
          <div className="sidebar-brand">
            <span className="brand-icon">🧠</span>
            <div className="brand-text">
              <span className="brand-title">Personal Brain</span>
              <span className="brand-subtitle">GBrain Knowledge Store</span>
            </div>
          </div>
          <button
            className="btn-icon mobile-close-btn"
            onClick={onCloseMobile}
            aria-label="Close menu"
          >
            <X size={16} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="sidebar-content">
          {/* Connections Section */}
          <div className="sidebar-section">
            <div className="section-label">Google Connections</div>
            <div className="connectors-list">
              <ConnectorCard
                type="gmail"
                state={connectors.gmail}
                isConnected={isConnected}
                onSync={onSyncGmail}
              />
              <ConnectorCard
                type="calendar"
                state={connectors.calendar}
                isConnected={isConnected}
                onSync={onSyncCalendar}
              />
            </div>
          </div>

          {/* GBrain Store Summary Card */}
          <div className="sidebar-section">
            <div className="section-label">Persistent Memory</div>
            <div className="store-summary-card">
              <div className="store-summary-header">
                <div className="store-summary-title">
                  <Database size={15} className="text-teal" />
                  <span>GBrain Entity Store</span>
                </div>
                <span className="store-total-badge">
                  {storeStats.emailCount + storeStats.eventCount} total
                </span>
              </div>

              <div className="store-stats-grid">
                <div className="store-stat-box">
                  <span className="stat-number">{storeStats.emailCount}</span>
                  <span className="stat-label">Emails</span>
                </div>
                <div className="store-stat-box">
                  <span className="stat-number">{storeStats.eventCount}</span>
                  <span className="stat-label">Events</span>
                </div>
              </div>

              <button
                className="btn btn-block btn-ghost btn-open-storage"
                onClick={onOpenStorage}
              >
                <span>Inspect Entity Store</span>
                <ChevronRight size={14} />
              </button>
            </div>
          </div>

          {/* Starter Queries Section */}
          <div className="sidebar-section">
            <div className="section-label">Quick Prompts</div>
            <div className="starter-query-chips">
              {starterQueries.map((item, idx) => (
                <button
                  key={idx}
                  className="starter-chip"
                  onClick={() => {
                    onSelectQuery(item.query);
                    if (onCloseMobile) onCloseMobile();
                  }}
                >
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Activity Logs Link */}
          <div className="sidebar-section">
            <button className="btn-activity-link" onClick={onOpenActivity}>
              <Activity size={14} className="text-muted" />
              <span>View Sync & Activity Logs</span>
            </button>
          </div>
        </div>

        {/* Account Footer */}
        <div className="sidebar-footer">
          {isConnected && user ? (
            <div className="account-footer-connected">
              <div className="user-info-row">
                <div className="user-avatar">
                  {user.picture ? (
                    <img src={user.picture} alt="" className="avatar-img" />
                  ) : (
                    <span>{(user.name || user.email || 'U').charAt(0).toUpperCase()}</span>
                  )}
                </div>
                <div className="user-details">
                  <span className="user-name">{user.name || 'Connected User'}</span>
                  <span className="user-email" title={user.email}>{user.email}</span>
                </div>
              </div>
              <button
                className="btn-icon btn-logout"
                onClick={onDisconnect}
                title="Disconnect Google Account"
                aria-label="Disconnect account"
              >
                <LogOut size={15} />
              </button>
            </div>
          ) : (
            <div className="account-footer-disconnected">
              {/* Same-tab OAuth link fixing target="_blank" per Antigravity §8 */}
              <a href="/api/auth/google" className="btn btn-block btn-primary btn-connect-google">
                <Lock size={14} />
                <span>Connect Google OAuth</span>
              </a>
              <span className="auth-privacy-note">
                <ShieldCheck size={11} className="text-teal" /> Read-only scopes. Single-user trust model.
              </span>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
