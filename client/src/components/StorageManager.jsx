import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Database,
  Mail,
  Calendar,
  Search,
  Trash2,
  X,
  Code,
  FileText,
  Clock,
  MapPin,
  Users,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Loader2
} from 'lucide-react';
import { api } from '../lib/api';

/**
 * Storage Manager Drawer Component.
 * Full-height slide-over drawer with real pagination, debounced search, structured & raw JSON view,
 * and safe deletion. Implements Antigravity §11.
 */
export default function StorageManager({
  isOpen,
  onClose,
  onStoreMutated,
  onRequestClearStore
}) {
  const [activeTab, setActiveTab] = useState('emails'); // 'emails' | 'events'
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  const [page, setPage] = useState(1);
  const [pageSize] = useState(15);
  const [data, setData] = useState({ items: [], total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(false);
  const [selectedEntity, setSelectedEntity] = useState(null);
  const [viewMode, setViewMode] = useState('structured'); // 'structured' | 'raw'
  const [deletingId, setDeletingId] = useState(null);

  // Debounce search query 300ms (Antigravity §14)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch paginated data
  const fetchData = useCallback(async () => {
    if (!isOpen) return;
    setLoading(true);
    try {
      if (activeTab === 'emails') {
        const res = await api.getEmails({
          query: debouncedQuery,
          page,
          pageSize
        });
        setData({
          items: res.emails || [],
          total: res.total || 0,
          totalPages: res.totalPages || 1
        });
        if (selectedEntity && activeTab === 'emails') {
          const stillExists = (res.emails || []).find(e => e.messageId === selectedEntity.messageId);
          if (!stillExists && res.emails?.length > 0) setSelectedEntity(res.emails[0]);
        } else if (res.emails?.length > 0 && !selectedEntity) {
          setSelectedEntity(res.emails[0]);
        }
      } else {
        const res = await api.getEvents({
          query: debouncedQuery,
          page,
          pageSize
        });
        setData({
          items: res.events || [],
          total: res.total || 0,
          totalPages: res.totalPages || 1
        });
        if (selectedEntity && activeTab === 'events') {
          const stillExists = (res.events || []).find(ev => ev.eventId === selectedEntity.eventId);
          if (!stillExists && res.events?.length > 0) setSelectedEntity(res.events[0]);
        } else if (res.events?.length > 0 && !selectedEntity) {
          setSelectedEntity(res.events[0]);
        }
      }
    } catch (err) {
      console.error('Failed to fetch storage items:', err);
    } finally {
      setLoading(false);
    }
  }, [isOpen, activeTab, debouncedQuery, page, pageSize]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handle Tab Change
  const handleTabChange = (newTab) => {
    setActiveTab(newTab);
    setSearchQuery('');
    setDebouncedQuery('');
    setPage(1);
    setSelectedEntity(null);
  };

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (isOpen && e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Delete Entity
  const handleDeleteEntity = async (entity) => {
    const id = activeTab === 'emails' ? entity.messageId : entity.eventId;
    setDeletingId(id);
    try {
      if (activeTab === 'emails') {
        await api.deleteEmail(id);
      } else {
        await api.deleteEvent(id);
      }
      setSelectedEntity(null);
      await fetchData();
      if (onStoreMutated) onStoreMutated();
    } catch (err) {
      alert(`Delete failed: ${err.message}`);
    } finally {
      setDeletingId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="storage-backdrop" onClick={onClose} role="presentation">
      <div
        className="storage-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="GBrain Storage Manager"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div className="storage-header">
          <div className="storage-title-row">
            <Database size={18} className="text-teal" />
            <h2>GBrain Storage Manager</h2>
            <span className="badge badge-subtle">{data.total} indexed</span>
          </div>

          <div className="storage-header-actions">
            <button
              className="btn btn-sm btn-danger-ghost"
              onClick={onRequestClearStore}
              title="Delete all data from store"
            >
              <Trash2 size={13} />
              <span>Clear Store</span>
            </button>

            <button
              className="btn-icon"
              onClick={onClose}
              aria-label="Close Storage Manager"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Tab & Search Toolbar */}
        <div className="storage-toolbar">
          <div className="storage-tabs">
            <button
              className={`storage-tab ${activeTab === 'emails' ? 'storage-tab-active' : ''}`}
              onClick={() => handleTabChange('emails')}
            >
              <Mail size={14} />
              <span>Emails</span>
            </button>
            <button
              className={`storage-tab ${activeTab === 'events' ? 'storage-tab-active' : ''}`}
              onClick={() => handleTabChange('events')}
            >
              <Calendar size={14} />
              <span>Events</span>
            </button>
          </div>

          <div className="storage-search-box">
            <Search size={14} className="text-muted" />
            <input
              type="text"
              className="storage-search-input"
              placeholder={`Search stored ${activeTab}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Search stored entities"
            />
            {searchQuery && (
              <button
                className="btn-clear-search"
                onClick={() => setSearchQuery('')}
                aria-label="Clear search query"
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        {/* Main Body: List + Detail Pane */}
        <div className="storage-body">
          {/* Entity List Column */}
          <div className="storage-list-column">
            {loading ? (
              <div className="storage-loading-state">
                <Loader2 size={24} className="animate-spin text-teal" />
                <span>Loading entities...</span>
              </div>
            ) : data.items.length === 0 ? (
              <div className="storage-empty-state">
                <Database size={28} className="text-muted" />
                <span className="empty-title">No {activeTab} found</span>
                <span className="empty-desc">
                  {debouncedQuery
                    ? `No entities matching "${debouncedQuery}"`
                    : `Sync ${activeTab} or load demo data to view items`}
                </span>
              </div>
            ) : (
              <div className="storage-entity-list">
                {data.items.map((item) => {
                  const id = activeTab === 'emails' ? item.messageId : item.eventId;
                  const isSelected = selectedEntity && (
                    activeTab === 'emails'
                      ? selectedEntity.messageId === id
                      : selectedEntity.eventId === id
                  );

                  return (
                    <button
                      key={id}
                      className={`storage-entity-card ${isSelected ? 'entity-card-selected' : ''}`}
                      onClick={() => setSelectedEntity(item)}
                    >
                      <div className="entity-card-top">
                        <span className="entity-card-title">
                          {activeTab === 'emails' ? (item.subject || '(No subject)') : (item.summary || '(Untitled Event)')}
                        </span>
                        {item.demo && (
                          <span className="badge badge-demo">demo</span>
                        )}
                      </div>

                      <div className="entity-card-snippet">
                        {activeTab === 'emails' ? (item.snippet || item.bodyText) : (item.description || item.location || 'Calendar event')}
                      </div>

                      <div className="entity-card-footer">
                        <span className="entity-meta-from">
                          {activeTab === 'emails' ? item.from : (item.organizer || 'Calendar')}
                        </span>
                        <span className="entity-meta-date">
                          {new Date(activeTab === 'emails' ? item.date : item.start).toLocaleDateString()}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Pagination Controls */}
            {data.totalPages > 1 && (
              <div className="storage-pagination">
                <button
                  className="btn btn-pagination"
                  disabled={page <= 1 || loading}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  aria-label="Previous page"
                >
                  <ChevronLeft size={14} />
                  <span>Prev</span>
                </button>

                <span className="pagination-info">
                  Page <strong>{page}</strong> of <strong>{data.totalPages}</strong>
                </span>

                <button
                  className="btn btn-pagination"
                  disabled={page >= data.totalPages || loading}
                  onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
                  aria-label="Next page"
                >
                  <span>Next</span>
                  <ChevronRight size={14} />
                </button>
              </div>
            )}
          </div>

          {/* Entity Detail Pane */}
          <div className="storage-detail-column">
            {selectedEntity ? (
              <div className="entity-detail-view">
                <div className="entity-detail-header">
                  <div className="detail-title-group">
                    <h3>
                      {activeTab === 'emails'
                        ? selectedEntity.subject || '(No subject)'
                        : selectedEntity.summary || '(Untitled Event)'}
                    </h3>
                    <div className="detail-tags-row">
                      {selectedEntity.demo && (
                        <span className="badge badge-demo">Demo Entity</span>
                      )}
                      <span className="badge badge-subtle">
                        ID: {activeTab === 'emails' ? selectedEntity.messageId : selectedEntity.eventId}
                      </span>
                    </div>
                  </div>

                  <div className="detail-header-actions">
                    <button
                      className={`btn btn-sm ${viewMode === 'raw' ? 'btn-primary' : 'btn-ghost'}`}
                      onClick={() => setViewMode(viewMode === 'raw' ? 'structured' : 'raw')}
                      title="Toggle Raw JSON View"
                    >
                      <Code size={13} />
                      <span>{viewMode === 'raw' ? 'Structured' : 'Raw JSON'}</span>
                    </button>

                    <button
                      className="btn btn-sm btn-danger-ghost"
                      onClick={() => handleDeleteEntity(selectedEntity)}
                      disabled={deletingId !== null}
                      title="Delete this entity from GBrain"
                    >
                      <Trash2 size={13} />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>

                <div className="entity-detail-body">
                  {viewMode === 'raw' ? (
                    <pre className="raw-json-block">
                      {JSON.stringify(selectedEntity, null, 2)}
                    </pre>
                  ) : activeTab === 'emails' ? (
                    /* Structured Email View */
                    <div className="structured-email-view">
                      <div className="detail-field-row">
                        <span className="field-label">From:</span>
                        <span className="field-value">{selectedEntity.from}</span>
                      </div>
                      <div className="detail-field-row">
                        <span className="field-label">To:</span>
                        <span className="field-value">
                          {Array.isArray(selectedEntity.to)
                            ? selectedEntity.to.join(', ')
                            : selectedEntity.to}
                        </span>
                      </div>
                      <div className="detail-field-row">
                        <span className="field-label">Date:</span>
                        <span className="field-value">
                          {new Date(selectedEntity.date).toLocaleString()}
                        </span>
                      </div>
                      {selectedEntity.labels && selectedEntity.labels.length > 0 && (
                        <div className="detail-field-row">
                          <span className="field-label">Labels:</span>
                          <div className="labels-wrap">
                            {selectedEntity.labels.map((l, i) => (
                              <span key={i} className="label-badge">{l}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      <div className="detail-body-section">
                        <span className="body-heading">Message Body</span>
                        <div className="body-content-text">
                          {selectedEntity.bodyText || selectedEntity.snippet || '(No content)'}
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Structured Event View */
                    <div className="structured-event-view">
                      <div className="detail-field-row">
                        <span className="field-label">Start:</span>
                        <span className="field-value">
                          <Clock size={13} className="text-teal inline-icon" />
                          {new Date(selectedEntity.start).toLocaleString()}
                        </span>
                      </div>
                      <div className="detail-field-row">
                        <span className="field-label">End:</span>
                        <span className="field-value">
                          {new Date(selectedEntity.end).toLocaleString()}
                        </span>
                      </div>
                      {selectedEntity.location && (
                        <div className="detail-field-row">
                          <span className="field-label">Location:</span>
                          <span className="field-value">
                            <MapPin size={13} className="text-amber inline-icon" />
                            {selectedEntity.location}
                          </span>
                        </div>
                      )}
                      {selectedEntity.organizer && (
                        <div className="detail-field-row">
                          <span className="field-label">Organizer:</span>
                          <span className="field-value">{selectedEntity.organizer}</span>
                        </div>
                      )}
                      {selectedEntity.attendees && selectedEntity.attendees.length > 0 && (
                        <div className="detail-attendees-section">
                          <span className="field-label">
                            <Users size={13} className="text-blue inline-icon" /> Attendees ({selectedEntity.attendees.length}):
                          </span>
                          <div className="attendees-list">
                            {selectedEntity.attendees.map((att, i) => (
                              <div key={i} className="attendee-chip">
                                <span className="attendee-email">{att.email || att.displayName}</span>
                                {att.responseStatus && (
                                  <span className={`attendee-status status-${att.responseStatus}`}>
                                    {att.responseStatus}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {selectedEntity.description && (
                        <div className="detail-body-section">
                          <span className="body-heading">Description</span>
                          <div className="body-content-text">
                            {selectedEntity.description}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="entity-unselected-view">
                <FileText size={32} className="text-muted" />
                <span>Select an item from the list to inspect details</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
