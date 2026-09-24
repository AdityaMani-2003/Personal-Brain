import React from 'react';
import { Sparkles, CheckCircle2, Circle, ArrowRight, Database, Mail, Calendar, Trash2 } from 'lucide-react';

/**
 * Onboarding Hero & Empty State Component.
 * Implements Antigravity §8 & §10.
 */
export default function OnboardingHero({
  isConnected,
  hasData,
  hasDemoData,
  onConnect,
  onSyncGmail,
  onSyncCalendar,
  onLoadDemo,
  onClearDemo,
  onSelectQuery
}) {
  const starterQueries = [
    {
      label: 'Tomorrow Agenda',
      query: "What's on my calendar tomorrow?"
    },
    {
      label: 'Stripe Payment',
      query: 'Find the email from Stripe about the failed payment'
    },
    {
      label: 'Unread Emails',
      query: 'List my unread emails from this week'
    },
    {
      label: 'Cross-Source Correlation (Tier 2)',
      query: "What meetings do I have this week, and which ones have a related email thread I haven't replied to?"
    }
  ];

  return (
    <div className="onboarding-hero">
      <div className="hero-badge">
        <Sparkles size={14} className="text-teal" />
        <span>Grounded Personal Productivity</span>
      </div>

      <h1 className="hero-title">Your Personal Intelligence Workspace</h1>
      <p className="hero-subtitle">
        Connect your Google Gmail and Calendar to ask complex natural-language questions
        with verified, cross-source reasoning powered by Gemini and the GBrain store.
      </p>

      {/* Onboarding Checklist */}
      <div className="onboarding-steps-card">
        <div className="steps-header">
          <span>Getting Started Checklist</span>
          {hasDemoData && (
            <span className="badge badge-amber">Demo Data Active</span>
          )}
        </div>

        <div className="steps-list">
          {/* Step 1: Connect */}
          <div className={`step-item ${isConnected ? 'step-completed' : ''}`}>
            <div className="step-status-icon">
              {isConnected ? (
                <CheckCircle2 size={16} className="text-teal" />
              ) : (
                <Circle size={16} className="text-muted" />
              )}
            </div>
            <div className="step-content">
              <span className="step-title">1. Connect Google Account</span>
              <span className="step-desc">
                {isConnected ? 'Connected with read-only scopes' : 'Grant read-only access to Gmail and Calendar'}
              </span>
            </div>
            {!isConnected && onConnect && (
              <a href="/api/auth/google" className="btn btn-sm btn-primary">
                Connect
              </a>
            )}
          </div>

          {/* Step 2: Sync */}
          <div className={`step-item ${hasData ? 'step-completed' : ''}`}>
            <div className="step-status-icon">
              {hasData ? (
                <CheckCircle2 size={16} className="text-teal" />
              ) : (
                <Circle size={16} className="text-muted" />
              )}
            </div>
            <div className="step-content">
              <span className="step-title">2. Ingest & Synchronize</span>
              <span className="step-desc">
                {hasData ? 'Data synchronized into local GBrain store' : 'Fetch recent emails and upcoming calendar events'}
              </span>
            </div>
            {isConnected && !hasData && (
              <div className="step-actions">
                <button className="btn btn-sm btn-ghost" onClick={onSyncGmail}>
                  <Mail size={12} /> Sync Gmail
                </button>
                <button className="btn btn-sm btn-ghost" onClick={onSyncCalendar}>
                  <Calendar size={12} /> Sync Calendar
                </button>
              </div>
            )}
          </div>

          {/* Step 3: Ask */}
          <div className={`step-item ${hasData ? 'step-completed' : ''}`}>
            <div className="step-status-icon">
              <Circle size={16} className="text-muted" />
            </div>
            <div className="step-content">
              <span className="step-title">3. Ask Natural-Language Questions</span>
              <span className="step-desc">
                Reason across both sources with strict grounding and tool execution evidence
              </span>
            </div>
          </div>
        </div>

        {/* Demo Mode Action Banner */}
        <div className="hero-demo-bar">
          {!hasDemoData ? (
            <div className="demo-bar-inner">
              <span className="demo-hint">Exploring without a Google account?</span>
              <button className="btn btn-sm btn-ghost text-teal" onClick={onLoadDemo}>
                <Database size={13} />
                <span>Load Sample Demo Data</span>
              </button>
            </div>
          ) : (
            <div className="demo-bar-inner">
              <span className="demo-hint text-amber">Sample demo data is loaded in your store.</span>
              <button className="btn btn-sm btn-danger-ghost" onClick={onClearDemo}>
                <Trash2 size={13} />
                <span>Remove Demo Data</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Starter Queries Grid */}
      <div className="starter-queries-section">
        <span className="starter-title">Try Asking</span>
        <div className="starter-grid">
          {starterQueries.map((sq, idx) => (
            <button
              key={idx}
              className="starter-card"
              onClick={() => onSelectQuery(sq.query)}
            >
              <div className="starter-card-top">
                <span className="starter-card-label">{sq.label}</span>
                <ArrowRight size={13} className="starter-arrow" />
              </div>
              <span className="starter-card-query">"{sq.query}"</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
