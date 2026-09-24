import React from 'react';
import { Database, Trash2, Zap, Cpu, Menu } from 'lucide-react';

/**
 * TopBar Component.
 * Implements Antigravity §7 & §8.
 */
export default function TopBar({
  geminiConfigured,
  storeCount,
  onOpenStorage,
  onClearFeed,
  onToggleMobileSidebar
}) {
  return (
    <header className="topbar">
      <div className="topbar-left">
        <button
          className="btn-icon mobile-menu-btn"
          onClick={onToggleMobileSidebar}
          aria-label="Toggle navigation menu"
        >
          <Menu size={18} />
        </button>

        <div className="topbar-title-group">
          <span className="topbar-title">Workspace</span>
          <span className="topbar-separator">/</span>
          <span className="topbar-subtitle">Intelligence Assistant</span>
        </div>
      </div>

      <div className="topbar-right">
        {/* Engine status indicator */}
        <div
          className={`topbar-engine-badge ${geminiConfigured ? 'engine-active' : 'engine-local'}`}
          title={geminiConfigured ? 'Gemini 2.5 Flash function calling ready' : 'Local deterministic reasoning engine'}
        >
          {geminiConfigured ? <Zap size={12} className="text-teal" /> : <Cpu size={12} className="text-amber" />}
          <span>{geminiConfigured ? 'Gemini 2.5 Flash' : 'Local Engine'}</span>
        </div>

        {/* Storage Shortcut */}
        <button
          className="btn btn-topbar-action"
          onClick={onOpenStorage}
          title="Open GBrain Store Manager"
          aria-label="Open Storage Manager"
        >
          <Database size={14} className="text-teal" />
          <span>Store</span>
          <span className="badge badge-subtle">{storeCount}</span>
        </button>

        {/* Clear Feed */}
        <button
          className="btn-icon"
          onClick={onClearFeed}
          title="Clear current conversation"
          aria-label="Clear chat feed"
        >
          <Trash2 size={15} />
        </button>
      </div>
    </header>
  );
}
