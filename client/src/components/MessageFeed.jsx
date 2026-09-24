import React, { useRef, useEffect } from 'react';
import MessageItem from './MessageItem';
import OnboardingHero from './OnboardingHero';
import { Loader2 } from 'lucide-react';

/**
 * Message Feed Container Component.
 * Implements Antigravity §8.
 */
export default function MessageFeed({
  messages,
  isStreaming,
  currentStatus,
  isConnected,
  hasData,
  hasDemoData,
  onConnect,
  onSyncGmail,
  onSyncCalendar,
  onLoadDemo,
  onClearDemo,
  onSelectQuery,
  onRegenerate,
  onOpenStorage
}) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, currentStatus]);

  if (!messages || messages.length === 0) {
    return (
      <div className="message-feed-scroll">
        <OnboardingHero
          isConnected={isConnected}
          hasData={hasData}
          hasDemoData={hasDemoData}
          onConnect={onConnect}
          onSyncGmail={onSyncGmail}
          onSyncCalendar={onSyncCalendar}
          onLoadDemo={onLoadDemo}
          onClearDemo={onClearDemo}
          onSelectQuery={onSelectQuery}
        />
      </div>
    );
  }

  return (
    <div className="message-feed-scroll" role="log" aria-live="polite">
      <div className="message-feed-inner">
        {messages.map((message) => (
          <MessageItem
            key={message.id}
            message={message}
            onRegenerate={onRegenerate}
            onOpenStorage={onOpenStorage}
            onSyncPrompt={onSyncGmail}
          />
        ))}

        {/* Live streaming status pill */}
        {isStreaming && currentStatus && (
          <div className="streaming-status-pill">
            <Loader2 size={13} className="animate-spin text-teal" />
            <span>{currentStatus}</span>
          </div>
        )}

        <div ref={bottomRef} style={{ height: 1 }} />
      </div>
    </div>
  );
}
