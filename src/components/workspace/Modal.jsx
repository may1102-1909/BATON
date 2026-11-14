import React, { useEffect, useRef } from 'react';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

let modalCount = 0;

/** Accessible dialog: focus moves in, Tab is trapped, Escape closes, focus returns to the opener. */
export function Modal({ title, onClose, children }) {
  const dialogRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const titleId = useRef(`ws-modal-title-${++modalCount}`).current;

  useEffect(() => {
    const opener = document.activeElement;
    const dialog = dialogRef.current;
    const first = dialog?.querySelector('input:not([disabled]), select, textarea') || dialog?.querySelector(FOCUSABLE);
    first?.focus();

    function onKeyDown(event) {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onCloseRef.current?.();
        return;
      }
      if (event.key !== 'Tab' || !dialog) return;
      const items = [...dialog.querySelectorAll(FOCUSABLE)];
      if (items.length === 0) return;
      const firstItem = items[0];
      const lastItem = items[items.length - 1];
      if (event.shiftKey && document.activeElement === firstItem) {
        event.preventDefault();
        lastItem.focus();
      } else if (!event.shiftKey && document.activeElement === lastItem) {
        event.preventDefault();
        firstItem.focus();
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      if (opener instanceof HTMLElement && document.contains(opener)) opener.focus();
    };
  }, []);

  return (
    <div className="ws-modal-backdrop" onClick={() => onClose?.()}>
      <div
        ref={dialogRef}
        className="ws-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={event => event.stopPropagation()}
      >
        <div className="ws-modal-header">
          <h2 id={titleId} className="ws-modal-title">{title}</h2>
          <button type="button" className="ws-btn ws-btn-sm" aria-label="Close dialog" onClick={() => onClose?.()}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Confirmation dialog with an optional typed phrase; `onConfirm` may be async. */
export function ConfirmDialog({ title, children, confirmLabel = 'Confirm', danger = true, busy = false, onConfirm, onCancel }) {
  return (
    <Modal title={title} onClose={busy ? undefined : onCancel}>
      <div style={{ fontSize: '0.9rem', lineHeight: 1.6, color: '#d1d5db' }}>{children}</div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
        <button type="button" className="ws-btn" onClick={onCancel} disabled={busy}>Cancel</button>
        <button type="button" className={`ws-btn ${danger ? 'ws-btn-danger' : 'ws-btn-primary'}`} onClick={onConfirm} disabled={busy}>
          {busy ? 'Working…' : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}

export default Modal;
