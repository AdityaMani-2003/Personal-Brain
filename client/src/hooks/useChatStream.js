import { useState, useRef, useCallback } from 'react';
import { api } from '../lib/api';

/**
 * Hook to manage chat messages, SSE streaming, cancellation, and evidence tracking.
 * Implements Antigravity §8 & §9.
 */
export function useChatStream({ onQueryComplete } = {}) {
  const [messages, setMessages] = useState([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentStatus, setCurrentStatus] = useState(null);

  const abortControllerRef = useRef(null);

  const stopStreaming = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
    setCurrentStatus(null);
  }, []);

  const clearMessages = useCallback(() => {
    stopStreaming();
    setMessages([]);
  }, [stopStreaming]);

  const sendMessage = useCallback(async (queryText) => {
    if (!queryText || !queryText.trim() || isStreaming) return;

    const trimmed = queryText.trim();
    const userMessageId = `user_${Date.now()}`;
    const assistantMessageId = `asst_${Date.now()}`;

    // Add user message
    const userMsg = {
      id: userMessageId,
      sender: 'user',
      text: trimmed,
      timestamp: new Date().toISOString()
    };

    // Add placeholder assistant message
    const assistantMsg = {
      id: assistantMessageId,
      sender: 'assistant',
      text: '',
      engine: 'gemini',
      engineNotice: null,
      toolCalls: [],
      timestamp: new Date().toISOString(),
      isStreaming: true,
      error: null
    };

    setMessages(prev => [...prev, userMsg, assistantMsg]);
    setIsStreaming(true);
    setCurrentStatus('Thinking and consulting GBrain store...');

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      await api.sendChatMessageStream(
        trimmed,
        { signal: controller.signal },
        {
          onMeta: (meta) => {
            setMessages(prev =>
              prev.map(m =>
                m.id === assistantMessageId
                  ? { ...m, engine: meta.engine, engineNotice: meta.reason }
                  : m
              )
            );
          },
          onTool: (tool) => {
            setMessages(prev =>
              prev.map(m =>
                m.id === assistantMessageId
                  ? {
                      ...m,
                      toolCalls: [...(m.toolCalls || []), tool]
                    }
                  : m
              )
            );
          },
          onStatus: (status) => {
            setCurrentStatus(status);
          },
          onChunk: (chunk) => {
            setMessages(prev =>
              prev.map(m =>
                m.id === assistantMessageId
                  ? { ...m, text: m.text + chunk }
                  : m
              )
            );
          },
          onDone: () => {
            setMessages(prev =>
              prev.map(m =>
                m.id === assistantMessageId
                  ? { ...m, isStreaming: false }
                  : m
              )
            );
            setIsStreaming(false);
            setCurrentStatus(null);
            if (onQueryComplete) onQueryComplete();
          },
          onError: (err) => {
            setMessages(prev =>
              prev.map(m =>
                m.id === assistantMessageId
                  ? {
                      ...m,
                      isStreaming: false,
                      error: err.message || 'Stream connection error'
                    }
                  : m
              )
            );
            setIsStreaming(false);
            setCurrentStatus(null);
          }
        }
      );
    } catch (err) {
      if (err.name !== 'AbortError') {
        setMessages(prev =>
          prev.map(m =>
            m.id === assistantMessageId
              ? {
                  ...m,
                  isStreaming: false,
                  error: err.message || 'Failed to complete query'
                }
              : m
          )
        );
      }
      setIsStreaming(false);
      setCurrentStatus(null);
    } finally {
      abortControllerRef.current = null;
    }
  }, [isStreaming, onQueryComplete]);

  const regenerateAnswer = useCallback(async (assistantMessageId) => {
    // Find the corresponding user message before this assistant message
    const msgIndex = messages.findIndex(m => m.id === assistantMessageId);
    if (msgIndex <= 0) return;

    const userMsg = messages[msgIndex - 1];
    if (userMsg && userMsg.sender === 'user') {
      // Remove this assistant message and resend query
      setMessages(prev => prev.filter(m => m.id !== assistantMessageId));
      await sendMessage(userMsg.text);
    }
  }, [messages, sendMessage]);

  return {
    messages,
    isStreaming,
    currentStatus,
    sendMessage,
    stopStreaming,
    clearMessages,
    regenerateAnswer
  };
}
