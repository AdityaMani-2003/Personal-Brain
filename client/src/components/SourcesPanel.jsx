import React, { useState } from 'react';
import { Mail, Calendar, ChevronDown, ChevronRight, Search, ExternalLink } from 'lucide-react';

function formatToolDescription(tool) {
  const { name, args = {} } = tool;
  if (name === 'search_emails') {
    const parts = [];
    if (args.query) parts.push(`query: "${args.query}"`);
    if (args.from) parts.push(`from: ${args.from}`);
    if (args.after) parts.push(`after: ${args.after}`);
    if (args.before) parts.push(`before: ${args.before}`);
    return `Gmail Search (${parts.join(', ') || 'all'})`;
  }
  if (name === 'search_calendar_events') {
    const parts = [];
    if (args.query) parts.push(`query: "${args.query}"`);
    if (args.startDate) parts.push(`from: ${args.startDate.slice(0, 10)}`);
    if (args.endDate) parts.push(`to: ${args.endDate.slice(0, 10)}`);
    return `Calendar Search (${parts.join(', ') || 'agenda'})`;
  }
  return name;
}

/**
 * Collapsible Sources Searched & Evidence Panel.
 * Implements Antigravity §9.
 */
export default function SourcesPanel({ toolCalls, onOpenStorage, onSyncPrompt }) {
  const [isOpen, setIsOpen] = useState(false);

  if (!toolCalls || toolCalls.length === 0) return null;

  const totalResults = toolCalls.reduce((acc, t) => acc + (t.resultCount || 0), 0);
  const isZeroResults = totalResults === 0;

  return (
    <div className={`sources-panel ${isZeroResults ? 'sources-zero-results' : ''}`}>
      <button
        className="sources-toggle-btn"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
      >
        <div className="sources-toggle-left">
          {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          <Search size={13} className="text-muted" />
          <span className="sources-label">Sources searched ({toolCalls.length})</span>
        </div>
        <span className={`sources-badge ${isZeroResults ? 'badge-muted' : 'badge-teal'}`}>
          {totalResults} {totalResults === 1 ? 'entity found' : 'entities found'}
        </span>
      </button>

      {isOpen && (
        <div className="sources-content">
          <div className="sources-list">
            {toolCalls.map((tool, idx) => {
              const isGmail = tool.name === 'search_emails';
              const count = tool.resultCount || 0;

              return (
                <div key={idx} className="source-item">
                  <div className="source-item-left">
                    {isGmail ? (
                      <Mail size={13} className="text-teal" />
                    ) : (
                      <Calendar size={13} className="text-blue" />
                    )}
                    <span className="source-description">{formatToolDescription(tool)}</span>
                  </div>
                  <span className={`source-count ${count > 0 ? 'text-teal' : 'text-muted'}`}>
                    {count} {count === 1 ? 'match' : 'matches'}
                  </span>
                </div>
              );
            })}
          </div>

          {isZeroResults && (
            <div className="sources-zero-guidance">
              <span className="zero-guidance-title">Nothing found in store. Suggestions:</span>
              <div className="zero-guidance-actions">
                {onSyncPrompt && (
                  <button className="btn-guidance-link" onClick={onSyncPrompt}>
                    Sync latest Google data
                  </button>
                )}
                {onOpenStorage && (
                  <button className="btn-guidance-link" onClick={onOpenStorage}>
                    <ExternalLink size={12} />
                    Inspect GBrain Store
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
