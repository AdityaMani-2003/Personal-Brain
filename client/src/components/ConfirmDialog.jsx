import React, { useEffect, useRef } from 'react';
import { AlertCircle, X } from 'lucide-react';

/**
 * Accessible In-App Confirmation Dialog.
 * Replaces window.confirm per Antigravity §8.
 */
export default function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
  onConfirm,
  onCancel
}) {
  const confirmBtnRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      confirmBtnRef.current?.focus();
      const handleKeyDown = (e) => {
        if (e.key === 'Escape') {
          onCancel();
        }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  return (
    <div className="dialog-backdrop" onClick={onCancel} role="presentation">
      <div
        className="dialog-box"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        aria-describedby="dialog-desc"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="dialog-header">
          <div className="dialog-title-row">
            {danger && <AlertCircle size={18} className="text-red" />}
            <h3 id="dialog-title">{title}</h3>
          </div>
          <button className="dialog-close-btn" onClick={onCancel} aria-label="Close dialog">
            <X size={16} />
          </button>
        </div>

        <div className="dialog-body" id="dialog-desc">
          <p>{message}</p>
        </div>

        <div className="dialog-actions">
          <button className="btn btn-ghost" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            ref={confirmBtnRef}
            className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
