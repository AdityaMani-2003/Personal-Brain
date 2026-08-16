import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { 
  Mail, 
  Calendar, 
  Send, 
  Database, 
  Lock, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw,
  Zap,
  Bot,
  User as UserIcon,
  Copy,
  Check,
  RotateCw,
  Trash2,
  X,
  Search,
  FileText,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Layers,
  Clock,
  ExternalLink,
  ChevronRight
} from 'lucide-react';

/**
 * Utilitarian Inbox/Dashboard UI for Personal Brain (Linear/Raycast inspired)
 */
export default function ChatWindow() {
  const [user, setUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [syncingGmail, setSyncingGmail] = useState(false);
  const [syncingCalendar, setSyncingCalendar] = useState(false);
  const [toast, setToast] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

  // Store Explorer Modal State
  const [isStoreOpen, setIsStoreOpen] = useState(false);
  const [storeStats, setStoreStats] = useState({ emailCount: 0, eventCount: 0, recentEmails: [], recentEvents: [] });
  const [activeTab, setActiveTab] = useState('emails');
  const [searchFilter, setSearchFilter] = useState('');
  const [selectedEntity, setSelectedEntity] = useState(null);
  const [clearingStore, setClearingStore] = useState(false);

  const messagesEndRef = useRef(null);

  // Fetch active user profile from /api/auth/me
  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => {
        if (data.user) {
          setUser(data.user);
        }
      })
      .catch((err) => console.log('No active OAuth user session:', err.message));
    
    fetchStoreStats();
  }, []);

  const fetchStoreStats = async () => {
    try {
      const res = await fetch('/api/store/stats');
      const data = await res.json();
      if (data.status === 'success' && data.stats) {
        setStoreStats(data.stats);
      }
    } catch (err) {
      console.log('Error fetching store stats:', err.message);
    }
  };

  // Detect ?auth=success or ?auth=error in URL after Google OAuth redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const authStatus = params.get('auth');
    const userName = params.get('user');
    const reason = params.get('reason');

    if (authStatus === 'success') {
      window.history.replaceState({}, '', window.location.pathname);
      showToast(`Connected as ${decodeURIComponent(userName || 'Google User')} — syncing data...`, 'success');
      fetch('/api/auth/me').then(r => r.json()).then(d => { if (d.user) setUser(d.user); });
      setTimeout(() => {
        handleSyncGmail();
        setTimeout(() => handleSyncCalendar(), 1500);
      }, 500);
    } else if (authStatus === 'error') {
      window.history.replaceState({}, '', window.location.pathname);
      showToast(`Auth Error: ${decodeURIComponent(reason || 'Failed')}`, 'error');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const showToast = (text, type = 'info') => {
    setToast({ text, type });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  const handleCopyText = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    showToast('Copied response to clipboard', 'success');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleClearHistory = () => {
    setMessages([]);
    showToast('Cleared chat workspace', 'info');
  };

  const handleClearGBrainStore = async () => {
    if (!window.confirm('Are you sure you want to clear all stored emails and calendar events from GBrain store?')) {
      return;
    }
    setClearingStore(true);
    try {
      const res = await fetch('/api/store/clear', { method: 'DELETE' });
      const data = await res.json();
      if (data.status === 'success') {
        showToast('Cleared GBrain store', 'success');
        setSelectedEntity(null);
        fetchStoreStats();
      } else {
        showToast(`Failed to clear store: ${data.error}`, 'error');
      }
    } catch (err) {
      showToast(`Error clearing store: ${err.message}`, 'error');
    } finally {
      setClearingStore(false);
    }
  };

  const handleDeleteEntity = async (type, id) => {
    try {
      const endpoint = type === 'email' ? `/api/store/email/${id}` : `/api/store/event/${id}`;
      const res = await fetch(endpoint, { method: 'DELETE' });
      const data = await res.json();
      if (data.status === 'success') {
        showToast(`Deleted ${type} entity from GBrain store`, 'success');
        setSelectedEntity(null);
        fetchStoreStats();
      } else {
        showToast(`Delete error: ${data.error}`, 'error');
      }
    } catch (err) {
      showToast(`Network error: ${err.message}`, 'error');
    }
  };

  const handleSyncGmail = async () => {
    setSyncingGmail(true);
    try {
      const res = await fetch('/api/ingest/gmail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ maxResults: 50 })
      });
      const rawText = await res.text();
      let data = {};
      try {
        data = rawText ? JSON.parse(rawText) : {};
      } catch (pErr) {
        throw new Error(rawText || 'Server returned empty response');
      }
      if (res.ok && data.status === 'success') {
        showToast(`Synced ${data.syncedCount} Gmail messages into GBrain`, 'success');
        fetchStoreStats();
      } else {
        showToast(`Gmail Sync: ${data.error || data.details || 'Failed'}`, 'error');
      }
    } catch (err) {
      showToast(`Network error syncing Gmail: ${err.message}`, 'error');
    } finally {
      setSyncingGmail(false);
    }
  };

  const handleSyncCalendar = async () => {
    setSyncingCalendar(true);
    try {
      const res = await fetch('/api/ingest/calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const rawText = await res.text();
      let data = {};
      try {
        data = rawText ? JSON.parse(rawText) : {};
      } catch (pErr) {
        throw new Error(rawText || 'Server returned empty response');
      }
      if (res.ok && data.status === 'success') {
        showToast(`Synced ${data.syncedCount} Calendar events into GBrain`, 'success');
        fetchStoreStats();
      } else {
        showToast(`Calendar Sync: ${data.error || data.details || 'Failed'}`, 'error');
      }
    } catch (err) {
      showToast(`Network error syncing Calendar: ${err.message}`, 'error');
    } finally {
      setSyncingCalendar(false);
    }
  };

  const handleRegenerate = () => {
    const lastUserMessage = [...messages].reverse().find(m => m.sender === 'user');
    if (lastUserMessage) {
      handleSend(lastUserMessage.text);
    }
  };

  const handleSend = async (textToSend) => {
    const prompt = textToSend || inputValue;
    if (!prompt.trim() || loading) return;

    const userMessage = {
      id: Date.now(),
      sender: 'user',
      text: prompt.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, userMessage]);
    if (!textToSend) setInputValue('');
    setLoading(true);

    const botMessageId = Date.now() + 1;
    const botMessagePlaceholder = {
      id: botMessageId,
      sender: 'bot',
      text: '',
      statusText: 'Querying GBrain Store...',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, botMessagePlaceholder]);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream'
        },
        body: JSON.stringify({
          message: prompt.trim(),
          query: prompt.trim(),
          stream: true
        })
      });

      if (!response.ok) {
        throw new Error(`Server HTTP ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let botText = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop();

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('data: ')) {
            const dataStr = trimmed.replace(/^data: /, '').trim();
            if (!dataStr) continue;
            try {
              const payload = JSON.parse(dataStr);
              if (payload.type === 'status') {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === botMessageId
                      ? { ...m, statusText: payload.message }
                      : m
                  )
                );
              } else if (payload.type === 'chunk') {
                botText += payload.text;
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === botMessageId
                      ? { ...m, text: botText, statusText: null }
                      : m
                  )
                );
              } else if (payload.type === 'error') {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === botMessageId
                      ? {
                          ...m,
                          text: `Error: ${payload.error}`,
                          statusText: null,
                          isError: true
                        }
                      : m
                  )
                );
              }
            } catch (parseErr) {
              console.error('SSE parse error:', parseErr);
            }
          }
        }
      }
    } catch (err) {
      console.error('Streaming error:', err);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === botMessageId
            ? {
                ...m,
                text: `Connection error: ${err.message}. Please ensure the server is running.`,
                statusText: null,
                isError: true
              }
            : m
        )
      );
    } finally {
      setLoading(false);
    }
  };

  const filteredEmails = storeStats.recentEmails.filter(e => {
    if (!searchFilter) return true;
    const sf = searchFilter.toLowerCase();
    return (
      (e.subject && e.subject.toLowerCase().includes(sf)) ||
      (e.from && e.from.toLowerCase().includes(sf)) ||
      (e.snippet && e.snippet.toLowerCase().includes(sf))
    );
  });

  const filteredEvents = storeStats.recentEvents.filter(ev => {
    if (!searchFilter) return true;
    const sf = searchFilter.toLowerCase();
    return (
      (ev.summary && ev.summary.toLowerCase().includes(sf)) ||
      (ev.organizer && ev.organizer.toLowerCase().includes(sf)) ||
      (ev.description && ev.description.toLowerCase().includes(sf))
    );
  });

  const sampleQueries = [
    { label: "Tomorrow's Schedule", query: "What's on my calendar tomorrow?", icon: Calendar, tag: "Tier 1" },
    { label: "Stripe Failed Payment Email", query: "Find the email from Stripe about the failed payment.", icon: Mail, tag: "Tier 1" },
    { label: "Unread Emails This Week", query: "List my unread emails from this week.", icon: Mail, tag: "Tier 1" },
    { label: "Meetings & Unreplied Emails", query: "What meetings do I have this week, and which ones have a related email thread I haven't replied to?", icon: Layers, tag: "Tier 2 Cross-Source", highlight: true }
  ];

  return (
    <div style={styles.dashboardContainer}>
      {/* Left Utilitarian Sidebar */}
      <aside style={styles.sidebar}>
        {/* Brand Header */}
        <div style={styles.sidebarBrand}>
          <div style={styles.brandBadge}>
            <Zap size={15} style={{ color: 'var(--teal-accent)' }} />
          </div>
          <div>
            <div style={styles.brandTitle}>PERSONAL BRAIN</div>
            <div style={styles.brandSubtitle}>
              <span className="live-dot" style={{ marginRight: '6px' }} />
              GBrain Engine v1.0
            </div>
          </div>
        </div>

        {/* Connectors & Sources Section */}
        <div style={styles.sidebarSection}>
          <div style={styles.sectionHeader}>CONNECTED SOURCES</div>
          
          {/* Gmail Source Card */}
          <div style={styles.sourceCard}>
            <div style={styles.sourceTop}>
              <div style={styles.sourceInfo}>
                <div style={{ ...styles.sourceIconBox, backgroundColor: 'rgba(239, 68, 68, 0.12)', color: '#ef4444' }}>
                  <Mail size={14} />
                </div>
                <div>
                  <div style={styles.sourceName}>Gmail Connector</div>
                  <div style={styles.sourceMeta}>{storeStats.emailCount} messages synced</div>
                </div>
              </div>
              <button
                onClick={handleSyncGmail}
                disabled={syncingGmail}
                style={styles.syncBtn}
                title="Sync Gmail into GBrain Store"
              >
                <RefreshCw size={12} style={{ animation: syncingGmail ? 'spin 1s linear infinite' : 'none' }} />
              </button>
            </div>
          </div>

          {/* Calendar Source Card */}
          <div style={styles.sourceCard}>
            <div style={styles.sourceTop}>
              <div style={styles.sourceInfo}>
                <div style={{ ...styles.sourceIconBox, backgroundColor: 'rgba(59, 130, 246, 0.12)', color: '#3b82f6' }}>
                  <Calendar size={14} />
                </div>
                <div>
                  <div style={styles.sourceName}>Google Calendar</div>
                  <div style={styles.sourceMeta}>{storeStats.eventCount} events synced</div>
                </div>
              </div>
              <button
                onClick={handleSyncCalendar}
                disabled={syncingCalendar}
                style={styles.syncBtn}
                title="Sync Calendar into GBrain Store"
              >
                <RefreshCw size={12} style={{ animation: syncingCalendar ? 'spin 1s linear infinite' : 'none' }} />
              </button>
            </div>
          </div>
        </div>

        {/* GBrain Memory Store Section */}
        <div style={styles.sidebarSection}>
          <div style={styles.sectionHeader}>GBRAIN PERSISTENT STORE</div>
          <div style={styles.storeCard}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Database size={13} style={{ color: 'var(--teal-accent)' }} />
                <span style={{ fontSize: '0.82rem', fontWeight: '600', color: '#f3f4f6' }}>Memory Files</span>
              </div>
              <span style={styles.badgePill}>{storeStats.emailCount + storeStats.eventCount} Entities</span>
            </div>
            <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginBottom: '10px' }}>
              Indexed in JSON entity format with graph references per SPEC §4.
            </p>
            <button
              onClick={() => {
                fetchStoreStats();
                setIsStoreOpen(true);
              }}
              style={styles.inspectBtn}
            >
              <span>Inspect Storage Manager</span>
              <ArrowRight size={12} />
            </button>
          </div>
        </div>

        {/* Quick Query Templates */}
        <div style={{ ...styles.sidebarSection, flex: 1, overflowY: 'auto' }}>
          <div style={styles.sectionHeader}>STARTER QUERIES</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {sampleQueries.map((q, i) => (
              <button
                key={i}
                onClick={() => handleSend(q.query)}
                disabled={loading}
                style={{
                  ...styles.presetBtn,
                  borderColor: q.highlight ? 'rgba(45, 212, 191, 0.4)' : 'var(--border-subtle)',
                  backgroundColor: q.highlight ? 'rgba(45, 212, 191, 0.06)' : 'var(--bg-card)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <q.icon size={13} style={{ color: q.highlight ? 'var(--teal-accent)' : 'var(--text-secondary)' }} />
                  <span style={{ fontSize: '0.8rem', fontWeight: '500', color: '#f3f4f6' }}>{q.label}</span>
                </div>
                <span style={{
                  ...styles.tagPill,
                  backgroundColor: q.highlight ? 'rgba(45, 212, 191, 0.15)' : '#1f2430',
                  color: q.highlight ? 'var(--teal-accent)' : 'var(--text-muted)'
                }}>
                  {q.tag}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Sidebar Footer */}
        <div style={styles.sidebarFooter}>
          {user ? (
            <div style={styles.userCard}>
              <div style={styles.userAvatar}>
                {user.picture ? (
                  <img src={user.picture} alt={user.name} style={{ width: '100%', height: '100%', borderRadius: '50%' }} />
                ) : (
                  <UserIcon size={12} color="#ffffff" />
                )}
              </div>
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <div style={styles.userName}>{user.name || user.email}</div>
                <div style={styles.userStatus}>OAuth Authenticated</div>
              </div>
              <a href="/api/auth/google" target="_blank" rel="noreferrer" style={styles.reauthIconBtn} title="Re-authenticate">
                <Lock size={12} />
              </a>
            </div>
          ) : (
            <a href="/api/auth/google" target="_blank" rel="noreferrer" style={styles.authLinkBtn}>
              <Lock size={13} />
              <span>Connect Google OAuth</span>
            </a>
          )}
        </div>
      </aside>

      {/* Main Workspace Area */}
      <main style={styles.workspace}>
        {/* Workspace Top Navigation Bar */}
        <header style={styles.topBar}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={styles.workspaceTitle}>Conversational Agent Workspace</span>
            <div style={styles.statusChip}>
              <span className="live-dot" />
              <span>GBrain Store Active</span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {messages.length > 0 && (
              <button onClick={handleClearHistory} style={styles.topBarBtn} title="Clear workspace feed">
                <Trash2 size={13} />
                <span>Clear Feed</span>
              </button>
            )}
            <button
              onClick={() => { fetchStoreStats(); setIsStoreOpen(true); }}
              style={styles.topBarBtn}
            >
              <Database size={13} style={{ color: 'var(--teal-accent)' }} />
              <span>Store ({storeStats.emailCount + storeStats.eventCount})</span>
            </button>
          </div>
        </header>

        {/* Toast Notification Banner */}
        {toast && (
          <div style={{
            ...styles.toastBanner,
            borderColor: toast.type === 'error' ? 'rgba(239, 68, 68, 0.4)' : 'rgba(45, 212, 191, 0.4)',
            backgroundColor: toast.type === 'error' ? 'rgba(239, 68, 68, 0.12)' : 'rgba(45, 212, 191, 0.12)',
            color: toast.type === 'error' ? '#fca5a5' : '#5eead4'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {toast.type === 'error' ? <AlertCircle size={15} /> : <CheckCircle2 size={15} />}
              <span>{toast.text}</span>
            </div>
            <button onClick={() => setToast(null)} style={styles.toastCloseBtn}>✕</button>
          </div>
        )}

        {/* Feed Area */}
        <div style={styles.feedArea}>
          {messages.length === 0 ? (
            /* Empty State Hero (Dense Utilitarian) */
            <div style={styles.emptyHero} className="fade-in">
              <div style={styles.heroBadge}>
                <Sparkles size={16} style={{ color: 'var(--teal-accent)' }} />
                <span>Personal Productivity Agent over Gmail & Calendar</span>
              </div>
              <h1 style={styles.heroTitle}>Query your emails and schedule naturally</h1>
              <p style={styles.heroDesc}>
                Personal Brain uses <strong>GBrain</strong> entity storage and <strong>Gemini function calling</strong> to answer single-source and cross-source queries across your synchronized data.
              </p>

              <div style={styles.heroGrid}>
                <div style={styles.heroCard}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <Calendar size={15} style={{ color: '#3b82f6' }} />
                    <span style={styles.heroCardTitle}>Tier 1 — Single Source Lookup</span>
                  </div>
                  <p style={styles.heroCardText}>"What's on my calendar tomorrow?" or "Find the email from Stripe about failed payment."</p>
                </div>

                <div style={styles.heroCard}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <Layers size={15} style={{ color: 'var(--teal-accent)' }} />
                    <span style={styles.heroCardTitle}>Tier 2 — Cross-Source Correlation</span>
                  </div>
                  <p style={styles.heroCardText}>"What meetings do I have this week, and which ones have a related email thread I haven't replied to?"</p>
                </div>
              </div>

              <div style={{ width: '100%', marginTop: '1.5rem' }}>
                <div style={{ fontSize: '0.78rem', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Click to try a live query:
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                  {sampleQueries.map((q, i) => (
                    <button
                      key={i}
                      onClick={() => handleSend(q.query)}
                      style={styles.heroActionBtn}
                    >
                      <q.icon size={14} style={{ color: q.highlight ? 'var(--teal-accent)' : '#9ca3af' }} />
                      <div style={{ textAlign: 'left', flex: 1 }}>
                        <div style={{ fontSize: '0.82rem', fontWeight: '600', color: '#f3f4f6' }}>{q.label}</div>
                        <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{q.query}</div>
                      </div>
                      <ChevronRight size={14} style={{ color: 'var(--text-muted)' }} />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* Message Feed Items */
            messages.map((msg) => {
              const isUser = msg.sender === 'user';

              return (
                <div key={msg.id} className="fade-in" style={styles.messageRow}>
                  {isUser ? (
                    <div style={styles.userPromptBlock}>
                      <div style={styles.userPromptMeta}>
                        <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--teal-accent)', fontWeight: '600' }}>&gt; QUERY</span>
                        <span style={styles.timestamp}>{msg.timestamp}</span>
                      </div>
                      <div style={styles.userPromptText}>{msg.text}</div>
                    </div>
                  ) : (
                    <div style={styles.botAnswerBlock}>
                      <div style={styles.botAnswerMeta}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Bot size={14} style={{ color: 'var(--teal-accent)' }} />
                          <span style={{ fontWeight: '600', fontSize: '0.85rem', color: '#ffffff' }}>Personal Brain</span>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>GBrain Grounded Answer</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {msg.text && (
                            <button
                              onClick={() => handleCopyText(msg.text, msg.id)}
                              style={styles.iconCopyBtn}
                              title="Copy markdown text"
                            >
                              {copiedId === msg.id ? <Check size={13} color="var(--teal-accent)" /> : <Copy size={13} />}
                            </button>
                          )}
                          <span style={styles.timestamp}>{msg.timestamp}</span>
                        </div>
                      </div>

                      <div style={styles.botAnswerContent}>
                        {msg.statusText && !msg.text ? (
                          <div style={styles.statusPill}>
                            <span className="live-dot" />
                            <span>{msg.statusText}</span>
                          </div>
                        ) : (
                          <>
                            {msg.statusText && (
                              <div style={styles.statusPill}>
                                <Zap size={13} style={{ color: 'var(--teal-accent)' }} />
                                <span>{msg.statusText}</span>
                              </div>
                            )}
                            <div className="markdown-body">
                              <ReactMarkdown>{msg.text}</ReactMarkdown>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}

          {loading && !messages.find(m => m.sender === 'bot' && m.statusText) && (
            <div style={styles.loadingRow} className="fade-in">
              <div style={styles.loadingPill}>
                <span className="live-dot" />
                <span>Searching GBrain entities and reasoning across Gmail + Calendar...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Bottom Command Input Console */}
        <div style={styles.inputConsole}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            style={styles.inputForm}
          >
            <div style={styles.inputBox}>
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--teal-accent)', fontWeight: '600', paddingLeft: '12px' }}>&gt;</span>
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Ask a question across Gmail & Calendar (e.g. 'What's on my calendar tomorrow?')..."
                style={styles.input}
              />
              {messages.length > 0 && !loading && (
                <button
                  type="button"
                  onClick={handleRegenerate}
                  style={styles.regenBtn}
                  title="Regenerate last response"
                >
                  <RotateCw size={13} />
                </button>
              )}
              <button
                type="submit"
                disabled={loading || !inputValue.trim()}
                style={{
                  ...styles.sendBtn,
                  opacity: !inputValue.trim() || loading ? 0.4 : 1
                }}
              >
                <Send size={14} />
              </button>
            </div>
          </form>
          <div style={styles.inputFooterHint}>
            <span>Tip: Try Tier 2 query <em>"What meetings do I have this week, and which ones have an unreplied email thread?"</em></span>
          </div>
        </div>
      </main>

      {/* GBrain Storage Inspector Modal */}
      {isStoreOpen && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent} className="fade-in">
            <div style={styles.modalHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Database size={16} style={{ color: 'var(--teal-accent)' }} />
                <span style={{ fontWeight: '600', fontSize: '0.95rem', color: '#ffffff' }}>
                  GBrain Storage Manager
                </span>
                <span style={styles.badgePill}>{storeStats.emailCount} Emails</span>
                <span style={styles.badgePill}>{storeStats.eventCount} Events</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  onClick={handleClearGBrainStore}
                  disabled={clearingStore || (storeStats.emailCount === 0 && storeStats.eventCount === 0)}
                  style={styles.clearStoreBtn}
                  title="Delete all JSON entities in GBrain storage"
                >
                  <Trash2 size={13} />
                  <span>{clearingStore ? 'Clearing...' : 'Clear Storage'}</span>
                </button>
                <button onClick={() => setIsStoreOpen(false)} style={styles.modalCloseBtn}>
                  <X size={16} />
                </button>
              </div>
            </div>

            <div style={styles.modalBody}>
              <div style={styles.modalControls}>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    onClick={() => { setActiveTab('emails'); setSelectedEntity(null); }}
                    style={{
                      ...styles.tabBtn,
                      backgroundColor: activeTab === 'emails' ? '#1f2430' : 'transparent',
                      color: activeTab === 'emails' ? '#ffffff' : 'var(--text-secondary)'
                    }}
                  >
                    <Mail size={13} />
                    <span>Emails ({storeStats.emailCount})</span>
                  </button>
                  <button
                    onClick={() => { setActiveTab('events'); setSelectedEntity(null); }}
                    style={{
                      ...styles.tabBtn,
                      backgroundColor: activeTab === 'events' ? '#1f2430' : 'transparent',
                      color: activeTab === 'events' ? '#ffffff' : 'var(--text-secondary)'
                    }}
                  >
                    <Calendar size={13} />
                    <span>Events ({storeStats.eventCount})</span>
                  </button>
                </div>

                <div style={styles.searchFilterBox}>
                  <Search size={13} color="var(--text-muted)" />
                  <input
                    type="text"
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    placeholder="Filter entities..."
                    style={styles.filterInput}
                  />
                </div>
              </div>

              <div style={styles.modalGrid}>
                <div style={styles.entityList}>
                  {activeTab === 'emails' ? (
                    filteredEmails.length === 0 ? (
                      <div style={styles.emptyStoreState}>No email JSON entities in GBrain storage.</div>
                    ) : (
                      filteredEmails.map((item, idx) => (
                        <div
                          key={idx}
                          onClick={() => setSelectedEntity(item)}
                          style={{
                            ...styles.entityCard,
                            borderColor: selectedEntity === item ? 'var(--teal-accent)' : 'var(--border-subtle)'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div style={styles.entitySubject}>{item.subject || '(No Subject)'}</div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteEntity('email', item.messageId);
                              }}
                              style={styles.deleteCardBtn}
                              title="Delete email entity"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                          <div style={styles.entityFrom}>From: {item.from}</div>
                          <div style={styles.entitySnippet}>{item.snippet}</div>
                        </div>
                      ))
                    )
                  ) : (
                    filteredEvents.length === 0 ? (
                      <div style={styles.emptyStoreState}>No event JSON entities in GBrain storage.</div>
                    ) : (
                      filteredEvents.map((item, idx) => (
                        <div
                          key={idx}
                          onClick={() => setSelectedEntity(item)}
                          style={{
                            ...styles.entityCard,
                            borderColor: selectedEntity === item ? 'var(--teal-accent)' : 'var(--border-subtle)'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div style={styles.entitySubject}>{item.summary || item.title || '(No Title)'}</div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteEntity('event', item.eventId);
                              }}
                              style={styles.deleteCardBtn}
                              title="Delete event entity"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                          <div style={styles.entityFrom}>Organizer: {item.organizer || 'N/A'}</div>
                          <div style={styles.entitySnippet}>
                            {item.start ? new Date(item.start).toLocaleString() : 'All Day'}
                          </div>
                        </div>
                      ))
                    )
                  )}
                </div>

                <div style={styles.entityPreview}>
                  {selectedEntity ? (
                    <div>
                      <div style={styles.previewHeader}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <FileText size={14} color="var(--teal-accent)" />
                          <span style={{ fontWeight: '600', color: '#ffffff' }}>Entity JSON Properties</span>
                        </div>
                        <button
                          onClick={() => {
                            if (activeTab === 'emails') {
                              handleDeleteEntity('email', selectedEntity.messageId);
                            } else {
                              handleDeleteEntity('event', selectedEntity.eventId);
                            }
                          }}
                          style={styles.deleteSingleBtn}
                        >
                          <Trash2 size={12} />
                          <span>Delete</span>
                        </button>
                      </div>
                      <pre style={styles.jsonPre}>
                        {JSON.stringify(selectedEntity, null, 2)}
                      </pre>
                    </div>
                  ) : (
                    <div style={styles.previewEmpty}>
                      <Database size={24} color="var(--border-medium)" />
                      <span>Select an entity from the list to inspect raw JSON page</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  dashboardContainer: {
    display: 'flex',
    height: '100vh',
    width: '100vw',
    backgroundColor: 'var(--bg-app)',
    overflow: 'hidden'
  },
  sidebar: {
    width: '270px',
    backgroundColor: 'var(--bg-sidebar)',
    borderRight: '1px solid var(--border-subtle)',
    display: 'flex',
    flexDirection: 'column',
    padding: '1rem',
    gap: '1.2rem',
    boxSizing: 'border-box'
  },
  sidebarBrand: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    paddingBottom: '0.8rem',
    borderBottom: '1px solid var(--border-subtle)'
  },
  brandBadge: {
    width: '32px',
    height: '32px',
    borderRadius: '8px',
    backgroundColor: 'rgba(45, 212, 191, 0.12)',
    border: '1px solid rgba(45, 212, 191, 0.25)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  brandTitle: {
    fontSize: '0.88rem',
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: '0.05em'
  },
  brandSubtitle: {
    fontSize: '0.72rem',
    color: 'var(--text-muted)',
    display: 'flex',
    alignItems: 'center'
  },
  sidebarSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  sectionHeader: {
    fontSize: '0.68rem',
    fontWeight: '700',
    color: 'var(--text-muted)',
    letterSpacing: '0.06em',
    textTransform: 'uppercase'
  },
  sourceCard: {
    backgroundColor: 'var(--bg-card)',
    borderRadius: '8px',
    border: '1px solid var(--border-subtle)',
    padding: '8px 10px'
  },
  sourceTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  sourceInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  sourceIconBox: {
    width: '26px',
    height: '26px',
    borderRadius: '6px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  sourceName: {
    fontSize: '0.8rem',
    fontWeight: '600',
    color: '#f3f4f6'
  },
  sourceMeta: {
    fontSize: '0.72rem',
    color: 'var(--text-muted)'
  },
  syncBtn: {
    background: 'none',
    border: '1px solid var(--border-medium)',
    borderRadius: '5px',
    color: 'var(--text-secondary)',
    padding: '5px 7px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  storeCard: {
    backgroundColor: 'var(--bg-card)',
    borderRadius: '8px',
    border: '1px solid var(--border-subtle)',
    padding: '10px'
  },
  badgePill: {
    fontSize: '0.7rem',
    fontWeight: '600',
    backgroundColor: '#1e2430',
    color: 'var(--teal-accent)',
    padding: '2px 6px',
    borderRadius: '4px',
    border: '1px solid rgba(45, 212, 191, 0.2)'
  },
  inspectBtn: {
    width: '100%',
    backgroundColor: '#191d28',
    border: '1px solid var(--border-medium)',
    borderRadius: '6px',
    color: '#f3f4f6',
    padding: '6px 8px',
    fontSize: '0.76rem',
    fontWeight: '600',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  presetBtn: {
    width: '100%',
    textAlign: 'left',
    padding: '8px 10px',
    borderRadius: '6px',
    border: '1px solid var(--border-subtle)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    transition: 'all 0.15s ease'
  },
  tagPill: {
    fontSize: '0.66rem',
    fontWeight: '600',
    padding: '2px 5px',
    borderRadius: '4px'
  },
  sidebarFooter: {
    marginTop: 'auto',
    paddingTop: '0.8rem',
    borderTop: '1px solid var(--border-subtle)'
  },
  userCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    backgroundColor: 'var(--bg-card)',
    padding: '8px',
    borderRadius: '8px',
    border: '1px solid var(--border-subtle)'
  },
  userAvatar: {
    width: '26px',
    height: '26px',
    borderRadius: '50%',
    backgroundColor: 'var(--border-medium)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  userName: {
    fontSize: '0.78rem',
    fontWeight: '600',
    color: '#ffffff',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  },
  userStatus: {
    fontSize: '0.68rem',
    color: 'var(--teal-accent)'
  },
  reauthIconBtn: {
    color: 'var(--text-muted)',
    padding: '4px',
    display: 'flex',
    alignItems: 'center'
  },
  authLinkBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    width: '100%',
    backgroundColor: '#191d28',
    border: '1px solid var(--border-medium)',
    borderRadius: '6px',
    color: '#ffffff',
    padding: '8px',
    fontSize: '0.8rem',
    fontWeight: '600',
    textDecoration: 'none'
  },
  workspace: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    backgroundColor: 'var(--bg-app)',
    overflow: 'hidden'
  },
  topBar: {
    height: '46px',
    backgroundColor: 'var(--bg-sidebar)',
    borderBottom: '1px solid var(--border-subtle)',
    padding: '0 1.2rem',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  workspaceTitle: {
    fontSize: '0.85rem',
    fontWeight: '600',
    color: '#ffffff'
  },
  statusChip: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '0.72rem',
    color: 'var(--text-secondary)',
    backgroundColor: '#141822',
    padding: '3px 8px',
    borderRadius: '999px',
    border: '1px solid var(--border-subtle)'
  },
  topBarBtn: {
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border-subtle)',
    borderRadius: '6px',
    color: 'var(--text-secondary)',
    padding: '4px 8px',
    fontSize: '0.76rem',
    fontWeight: '500',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '6px'
  },
  toastBanner: {
    margin: '10px 1.2rem 0 1.2rem',
    padding: '8px 12px',
    borderRadius: '6px',
    border: '1px solid',
    fontSize: '0.8rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  toastCloseBtn: {
    background: 'none',
    border: 'none',
    color: 'currentColor',
    cursor: 'pointer',
    fontSize: '0.9rem'
  },
  feedArea: {
    flex: 1,
    overflowY: 'auto',
    padding: '1.2rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem'
  },
  emptyHero: {
    maxWidth: '720px',
    margin: '3rem auto 0 auto',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center'
  },
  heroBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    backgroundColor: 'rgba(45, 212, 191, 0.08)',
    border: '1px solid rgba(45, 212, 191, 0.25)',
    borderRadius: '999px',
    padding: '4px 12px',
    fontSize: '0.78rem',
    color: 'var(--teal-accent)',
    marginBottom: '1rem'
  },
  heroTitle: {
    fontSize: '1.6rem',
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: '-0.02em',
    marginBottom: '0.5rem'
  },
  heroDesc: {
    fontSize: '0.9rem',
    color: 'var(--text-secondary)',
    maxWidth: '560px',
    lineHeight: '1.5',
    marginBottom: '1.8rem'
  },
  heroGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '12px',
    width: '100%'
  },
  heroCard: {
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border-subtle)',
    borderRadius: '8px',
    padding: '14px',
    textAlign: 'left'
  },
  heroCardTitle: {
    fontSize: '0.85rem',
    fontWeight: '600',
    color: '#ffffff'
  },
  heroCardText: {
    fontSize: '0.78rem',
    color: 'var(--text-muted)',
    lineHeight: '1.4'
  },
  heroActionBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border-subtle)',
    borderRadius: '8px',
    padding: '10px 12px',
    cursor: 'pointer',
    transition: 'all 0.15s ease'
  },
  messageRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px'
  },
  userPromptBlock: {
    backgroundColor: '#151822',
    border: '1px solid var(--border-medium)',
    borderRadius: '8px',
    padding: '10px 12px',
    alignSelf: 'flex-start',
    maxWidth: '100%',
    width: '100%',
    boxSizing: 'border-box'
  },
  userPromptMeta: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '4px',
    fontSize: '0.74rem'
  },
  userPromptText: {
    fontSize: '0.92rem',
    fontWeight: '500',
    color: '#ffffff'
  },
  botAnswerBlock: {
    backgroundColor: 'var(--bg-surface)',
    border: '1px solid var(--border-subtle)',
    borderLeft: '3px solid var(--teal-accent)',
    borderRadius: '8px',
    padding: '12px 14px',
    width: '100%',
    boxSizing: 'border-box'
  },
  botAnswerMeta: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px',
    paddingBottom: '6px',
    borderBottom: '1px solid var(--border-subtle)'
  },
  iconCopyBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    padding: '2px 4px',
    display: 'flex',
    alignItems: 'center'
  },
  timestamp: {
    fontSize: '0.72rem',
    color: 'var(--text-muted)',
    fontFamily: 'var(--font-mono)'
  },
  botAnswerContent: {
    fontSize: '0.9rem'
  },
  statusPill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    backgroundColor: '#171b26',
    border: '1px solid var(--border-medium)',
    borderRadius: '6px',
    padding: '4px 10px',
    fontSize: '0.8rem',
    color: 'var(--teal-accent)',
    marginBottom: '8px'
  },
  loadingRow: {
    display: 'flex',
    alignItems: 'center',
    padding: '8px 0'
  },
  loadingPill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border-subtle)',
    borderRadius: '6px',
    padding: '6px 12px',
    fontSize: '0.8rem',
    color: 'var(--teal-accent)'
  },
  inputConsole: {
    backgroundColor: 'var(--bg-sidebar)',
    borderTop: '1px solid var(--border-subtle)',
    padding: '0.8rem 1.2rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px'
  },
  inputForm: {
    width: '100%'
  },
  inputBox: {
    display: 'flex',
    alignItems: 'center',
    backgroundColor: 'var(--bg-input)',
    border: '1px solid var(--border-medium)',
    borderRadius: '8px',
    padding: '4px 8px'
  },
  input: {
    flex: 1,
    background: 'none',
    border: 'none',
    color: '#ffffff',
    fontSize: '0.9rem',
    padding: '8px 10px',
    outline: 'none',
    fontFamily: 'var(--font-sans)'
  },
  regenBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    padding: '6px',
    display: 'flex',
    alignItems: 'center'
  },
  sendBtn: {
    backgroundColor: 'var(--teal-accent)',
    border: 'none',
    borderRadius: '6px',
    color: '#090a0f',
    padding: '6px 12px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: '600'
  },
  inputFooterHint: {
    fontSize: '0.72rem',
    color: 'var(--text-muted)',
    paddingLeft: '4px'
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(5, 6, 9, 0.85)',
    backdropFilter: 'blur(4px)',
    zIndex: 100,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '1rem'
  },
  modalContent: {
    backgroundColor: 'var(--bg-sidebar)',
    border: '1px solid var(--border-medium)',
    borderRadius: '10px',
    width: '100%',
    maxWidth: '920px',
    height: '600px',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden'
  },
  modalHeader: {
    padding: '0.8rem 1rem',
    borderBottom: '1px solid var(--border-subtle)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  clearStoreBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    borderRadius: '6px',
    color: '#fca5a5',
    fontSize: '0.76rem',
    fontWeight: '600',
    padding: '4px 8px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '4px'
  },
  modalCloseBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center'
  },
  modalBody: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    padding: '1rem',
    gap: '1rem',
    overflow: 'hidden'
  },
  modalControls: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  tabBtn: {
    border: '1px solid var(--border-subtle)',
    borderRadius: '6px',
    padding: '6px 12px',
    fontSize: '0.8rem',
    fontWeight: '500',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '6px'
  },
  searchFilterBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    backgroundColor: 'var(--bg-input)',
    border: '1px solid var(--border-subtle)',
    borderRadius: '6px',
    padding: '4px 8px'
  },
  filterInput: {
    background: 'none',
    border: 'none',
    color: '#ffffff',
    fontSize: '0.8rem',
    outline: 'none',
    width: '180px'
  },
  modalGrid: {
    flex: 1,
    display: 'grid',
    gridTemplateColumns: '320px 1fr',
    gap: '1rem',
    overflow: 'hidden'
  },
  entityList: {
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  emptyStoreState: {
    fontSize: '0.8rem',
    color: 'var(--text-muted)',
    padding: '1rem',
    textAlign: 'center'
  },
  entityCard: {
    backgroundColor: 'var(--bg-card)',
    border: '1px solid',
    borderRadius: '6px',
    padding: '8px 10px',
    cursor: 'pointer',
    transition: 'all 0.15s ease'
  },
  entitySubject: {
    fontSize: '0.82rem',
    fontWeight: '600',
    color: '#ffffff',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  },
  deleteCardBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer'
  },
  entityFrom: {
    fontSize: '0.72rem',
    color: 'var(--text-muted)'
  },
  entitySnippet: {
    fontSize: '0.74rem',
    color: 'var(--text-secondary)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    marginTop: '4px'
  },
  entityPreview: {
    backgroundColor: '#0d0f14',
    border: '1px solid var(--border-subtle)',
    borderRadius: '6px',
    padding: '10px',
    overflowY: 'auto'
  },
  previewHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px',
    paddingBottom: '6px',
    borderBottom: '1px solid var(--border-subtle)'
  },
  deleteSingleBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    borderRadius: '4px',
    color: '#fca5a5',
    fontSize: '0.72rem',
    padding: '3px 6px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '4px'
  },
  jsonPre: {
    fontFamily: 'var(--font-mono)',
    fontSize: '0.76rem',
    color: '#d1d5db',
    lineHeight: '1.4',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word'
  },
  previewEmpty: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    color: 'var(--text-muted)',
    fontSize: '0.8rem'
  }
};
