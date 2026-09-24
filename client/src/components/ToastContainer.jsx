import React from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

/**
 * Stacking Toast Notification System.
 * Supports stacking, pause-on-hover, and dismiss button per Antigravity §8.
 */
export default function ToastContainer({ toasts, onDismiss, onMouseEnter, onMouseLeave }) {
  if (!toasts || toasts.length === 0) return null;

  return (
    <div
      className="toast-container"
      role="status"
      aria-live="polite"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {toasts.map((toast) => {
        const isSuccess = toast.type === 'success';
        const isError = toast.type === 'error';

        return (
          <div
            key={toast.id}
            className={`toast-item ${isSuccess ? 'toast-success' : isError ? 'toast-error' : 'toast-info'}`}
          >
            <div className="toast-icon">
              {isSuccess && <CheckCircle2 size={16} className="text-teal" />}
              {isError && <AlertCircle size={16} className="text-red" />}
              {!isSuccess && !isError && <Info size={16} className="text-blue" />}
            </div>
            <div className="toast-message">{toast.message}</div>
            <button
              className="toast-dismiss-btn"
              onClick={() => onDismiss(toast.id)}
              aria-label="Dismiss notification"
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
