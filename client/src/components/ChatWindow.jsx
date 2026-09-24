import React, { useState, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useConnectors } from '../hooks/useConnectors';
import { useStoreStats } from '../hooks/useStoreStats';
import { useChatStream } from '../hooks/useChatStream';
import { api } from '../lib/api';

import Sidebar from './Sidebar';
import TopBar from './TopBar';
import MessageFeed from './MessageFeed';
import Composer from './Composer';
import StorageManager from './StorageManager';
import ToastContainer from './ToastContainer';
import ConfirmDialog from './ConfirmDialog';
import ActivityModal from './ActivityModal';

/**
 * Main Workspace Window for Personal Brain.
 * Decomposed and modularized per Antigravity §8.
 */
export default function ChatWindow() {
  const [toasts, setToasts] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isStorageOpen, setIsStorageOpen] = useState(false);
  const [isActivityOpen, setIsActivityOpen] = useState(false);
  const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Stacking Toast System
  const showToast = useCallback((message, type = 'info') => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  }, []);

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Centralized Store Stats
  const { stats, refreshStats } = useStoreStats();

  // Connectors Hook Callbacks
  const handleSyncSuccess = useCallback((source, count) => {
    const label = source === 'gmail' ? 'emails' : 'events';
    showToast(`Synchronized ${count} ${label} from ${source === 'gmail' ? 'Gmail' : 'Google Calendar'}`, 'success');
    refreshStats();
  }, [showToast, refreshStats]);

  const handleSyncError = useCallback((source, err) => {
    showToast(`Sync ${source} failed: ${err}`, 'error');
  }, [showToast]);

  // Connectors Hook
  const {
    connectors,
    refreshConnectors,
    syncGmail,
    syncCalendar,
    runSequentialAutoSync
  } = useConnectors({
    onSyncSuccess: handleSyncSuccess,
    onSyncError: handleSyncError
  });

  // Auth Hook Callbacks
  const handleAuthSuccess = useCallback((userName) => {
    showToast(`Connected as ${userName}. Running initial sync...`, 'success');
    runSequentialAutoSync();
  }, [showToast, runSequentialAutoSync]);

  const handleAuthError = useCallback((reason) => {
    const errorMap = {
      token_exchange_failed: 'Google sign-in failed: The client secret in server/.env is rejected as invalid by Google. Check your Google Cloud Console credentials.',
      config_missing: 'Google OAuth is not configured on the server. Please add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to server/.env.',
      access_denied: 'Google sign-in was canceled or access was denied.',
      invalid_state: 'Security verification failed (state mismatch). Please try signing in again.',
      missing_code: 'No authorization code received from Google. Please try again.',
      init_failed: 'Failed to initiate Google OAuth consent flow.'
    };
    const message = errorMap[reason] || `Google sign-in error (${reason}). Please check your server configuration.`;
    showToast(message, 'error');
  }, [showToast]);

  // Auth Hook
  const { user, configStatus, isAuthenticated, disconnect } = useAuth({
    onAuthSuccess: handleAuthSuccess,
    onAuthError: handleAuthError
  });

  // Chat Streaming Hook
  const {
    messages,
    isStreaming,
    currentStatus,
    sendMessage,
    stopStreaming,
    clearMessages,
    regenerateAnswer
  } = useChatStream();

  // Handlers
  const handleSend = () => {
    if (!inputValue.trim() || isStreaming) return;
    const query = inputValue;
    setInputValue('');
    sendMessage(query);
  };

  const handleSelectStarterQuery = (query) => {
    setInputValue(query);
    sendMessage(query);
  };

  const handleDisconnect = async () => {
    const ok = await disconnect();
    if (ok) {
      showToast('Disconnected Google account', 'info');
      refreshConnectors();
    }
  };

  // Demo Data Handlers
  const handleLoadDemo = async () => {
    try {
      const res = await api.loadDemoData();
      showToast(`Loaded demo dataset (${res.emailsLoaded} emails, ${res.eventsLoaded} events)`, 'success');
      refreshStats();
      refreshConnectors();
    } catch (err) {
      showToast(`Failed to load demo data: ${err.message}`, 'error');
    }
  };

  const handleClearDemo = async () => {
    try {
      const res = await api.clearDemoData();
      showToast(`Removed demo dataset (${res.emailsDeleted} emails, ${res.eventsDeleted} events)`, 'info');
      refreshStats();
      refreshConnectors();
    } catch (err) {
      showToast(`Failed to remove demo data: ${err.message}`, 'error');
    }
  };

  // Clear Entire Store Confirmation
  const handleConfirmClearStore = async () => {
    setIsClearConfirmOpen(false);
    try {
      const res = await api.clearStore();
      showToast('Cleared all data from GBrain store', 'info');
      refreshStats();
      refreshConnectors();
    } catch (err) {
      showToast(`Failed to clear store: ${err.message}`, 'error');
    }
  };

  const hasData = stats.emailCount > 0 || stats.eventCount > 0;
  const hasDemoData = stats.recentEmails.some((e) => e.demo) || stats.recentEvents.some((ev) => ev.demo);

  return (
    <div className="app-layout">
      {/* Sidebar */}
      <Sidebar
        user={user}
        isConnected={isAuthenticated}
        connectors={connectors}
        storeStats={stats}
        onSyncGmail={() => syncGmail().catch(() => {})}
        onSyncCalendar={() => syncCalendar().catch(() => {})}
        onOpenStorage={() => setIsStorageOpen(true)}
        onOpenActivity={() => setIsActivityOpen(true)}
        onDisconnect={handleDisconnect}
        onSelectQuery={handleSelectStarterQuery}
        mobileOpen={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
      />

      {/* Main Workspace */}
      <main className="workspace-main">
        <TopBar
          geminiConfigured={configStatus.geminiConfigured}
          storeCount={stats.emailCount + stats.eventCount}
          onOpenStorage={() => setIsStorageOpen(true)}
          onClearFeed={clearMessages}
          onToggleMobileSidebar={() => setMobileSidebarOpen(!mobileSidebarOpen)}
        />

        <div className="workspace-body">
          <MessageFeed
            messages={messages}
            isStreaming={isStreaming}
            currentStatus={currentStatus}
            isConnected={isAuthenticated}
            hasData={hasData}
            hasDemoData={hasDemoData}
            onConnect={() => {}}
            onSyncGmail={() => syncGmail().catch(() => {})}
            onSyncCalendar={() => syncCalendar().catch(() => {})}
            onLoadDemo={handleLoadDemo}
            onClearDemo={handleClearDemo}
            onSelectQuery={handleSelectStarterQuery}
            onRegenerate={regenerateAnswer}
            onOpenStorage={() => setIsStorageOpen(true)}
          />

          <Composer
            value={inputValue}
            onChange={setInputValue}
            onSend={handleSend}
            onStop={stopStreaming}
            isStreaming={isStreaming}
            geminiConfigured={configStatus.geminiConfigured}
          />
        </div>
      </main>

      {/* Storage Manager Drawer */}
      <StorageManager
        isOpen={isStorageOpen}
        onClose={() => setIsStorageOpen(false)}
        onStoreMutated={() => {
          refreshStats();
          refreshConnectors();
        }}
        onRequestClearStore={() => setIsClearConfirmOpen(true)}
      />

      {/* Recent Activity Modal */}
      <ActivityModal
        isOpen={isActivityOpen}
        onClose={() => setIsActivityOpen(false)}
      />

      {/* In-App Confirmation Dialog for Destructive Clear Store */}
      <ConfirmDialog
        isOpen={isClearConfirmOpen}
        title="Clear GBrain Store?"
        message={`This will delete all ${stats.emailCount} emails and ${stats.eventCount} events from your local GBrain store. Your actual Google Gmail and Calendar accounts will never be modified. This action cannot be undone.`}
        confirmLabel="Clear Store"
        danger={true}
        onConfirm={handleConfirmClearStore}
        onCancel={() => setIsClearConfirmOpen(false)}
      />

      {/* Stacking Toasts */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
