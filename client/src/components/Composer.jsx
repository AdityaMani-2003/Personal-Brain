import React, { useRef, useEffect } from 'react';
import { Send, Square, AlertTriangle, CornerDownLeft } from 'lucide-react';

/**
 * Chat Composer Input Component.
 * Supports textarea auto-expansion, keyboard shortcuts (/ to focus), and streaming cancellation.
 * Implements Antigravity §8 & §9.
 */
export default function Composer({
  value,
  onChange,
  onSend,
  onStop,
  isStreaming,
  geminiConfigured
}) {
  const textareaRef = useRef(null);

  // Auto-resize textarea height
  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
    }
  }, [value]);

  // Global '/' shortcut to focus composer
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        textareaRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isStreaming && value.trim()) {
        onSend();
      }
    }
  };

  return (
    <div className="composer-container">
      {!geminiConfigured && (
        <div className="composer-gemini-banner">
          <AlertTriangle size={13} className="text-amber flex-shrink-0" />
          <span>Gemini API key is not configured. Answering via local deterministic reasoning engine.</span>
        </div>
      )}

      <div className="composer-box">
        <textarea
          ref={textareaRef}
          className="composer-textarea"
          rows={1}
          placeholder="Ask a question about your synced emails or calendar... (Press '/' to focus)"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isStreaming}
          aria-label="Ask a question"
        />

        <div className="composer-controls">
          <div className="composer-hints">
            <span className="key-hint">
              <CornerDownLeft size={11} /> Enter to send
            </span>
            <span className="key-hint">Shift+Enter for newline</span>
          </div>

          <div className="composer-actions">
            {isStreaming ? (
              <button
                className="btn btn-stop"
                onClick={onStop}
                title="Stop streaming response"
                aria-label="Stop generation"
              >
                <Square size={13} fill="currentColor" />
                <span>Stop</span>
              </button>
            ) : (
              <button
                className="btn btn-send"
                onClick={onSend}
                disabled={!value.trim()}
                title="Send query"
                aria-label="Send message"
              >
                <Send size={14} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
