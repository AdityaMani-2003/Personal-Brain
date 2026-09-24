import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Bot, User as UserIcon, Copy, Check, RotateCw, AlertTriangle, Zap, Cpu } from 'lucide-react';
import SourcesPanel from './SourcesPanel';

function formatTimestamp(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/**
 * Message Item Component.
 * Supports truthful engine labels, Sources panel, copy, and regenerate.
 * Implements Antigravity §8 & §9.
 */
export default React.memo(function MessageItem({
  message,
  onRegenerate,
  onOpenStorage,
  onSyncPrompt
}) {
  const [copied, setCopied] = useState(false);

  const isUser = message.sender === 'user';
  const isAssistant = message.sender === 'assistant';
  const isLocalEngine = message.engine === 'local';

  const handleCopy = () => {
    if (!message.text) return;
    navigator.clipboard.writeText(message.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`message-row ${isUser ? 'message-row-user' : 'message-row-assistant'}`}>
      <div className="message-avatar">
        {isUser ? (
          <UserIcon size={16} className="text-secondary" />
        ) : (
          <Bot size={16} className={isLocalEngine ? 'text-amber' : 'text-teal'} />
        )}
      </div>

      <div className="message-content-container">
        {/* Header with Sender, Engine Label, and Timestamp */}
        <div className="message-meta-header">
          <span className="message-sender-name">
            {isUser ? 'You' : 'Personal Brain'}
          </span>

          {isAssistant && (
            <span
              className={`engine-pill ${isLocalEngine ? 'engine-pill-local' : 'engine-pill-gemini'}`}
              title={message.engineNotice || (isLocalEngine ? 'Using local reasoning engine' : 'Using Gemini 2.0 Flash function calling')}
            >
              {isLocalEngine ? <Cpu size={11} /> : <Zap size={11} />}
              <span>{isLocalEngine ? 'Local Engine · Grounded' : 'Gemini · Grounded'}</span>
            </span>
          )}

          <span className="message-timestamp">
            {formatTimestamp(message.timestamp)}
          </span>
        </div>

        {/* Engine Notice if Gemini is not configured */}
        {message.engineNotice && (
          <div className="engine-notice-bar">
            <AlertTriangle size={13} className="text-amber flex-shrink-0" />
            <span>{message.engineNotice}</span>
          </div>
        )}

        {/* Message Body */}
        <div className="message-bubble">
          {message.error ? (
            <div className="message-error-card">
              <span className="error-title">Query Processing Error:</span>
              <p>{message.error}</p>
            </div>
          ) : message.text ? (
            <div className="markdown-body">
              <ReactMarkdown>{message.text}</ReactMarkdown>
            </div>
          ) : message.isStreaming ? (
            <div className="streaming-placeholder">
              <span className="typing-dot" />
              <span className="typing-dot" />
              <span className="typing-dot" />
            </div>
          ) : null}
        </div>

        {/* Sources Panel */}
        {isAssistant && message.toolCalls && message.toolCalls.length > 0 && (
          <SourcesPanel
            toolCalls={message.toolCalls}
            onOpenStorage={onOpenStorage}
            onSyncPrompt={onSyncPrompt}
          />
        )}

        {/* Action Buttons: Copy & Regenerate */}
        {!message.isStreaming && message.text && (
          <div className="message-actions-bar">
            <button
              className="btn-msg-action"
              onClick={handleCopy}
              title="Copy answer to clipboard"
              aria-label="Copy answer"
            >
              {copied ? <Check size={13} className="text-teal" /> : <Copy size={13} />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>

            {isAssistant && onRegenerate && (
              <button
                className="btn-msg-action"
                onClick={() => onRegenerate(message.id)}
                title="Regenerate answer"
                aria-label="Regenerate answer"
              >
                <RotateCw size={13} />
                <span>Regenerate</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
});
