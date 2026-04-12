import React from 'react';

export default function Modal({ title, onClose, children }) {
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 className="modal-title" style={{ margin: 0 }}>{title}</h2>
          <button className="btn-icon" onClick={onClose} style={{ fontSize: 18, lineHeight: 1 }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}
