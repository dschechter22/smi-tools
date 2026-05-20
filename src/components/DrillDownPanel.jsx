import React, { useEffect } from 'react';

export default function DrillDownPanel({ title, subtitle, onClose, children }) {
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <>
      <div className="drill-backdrop" onClick={onClose} />
      <div className="drill-panel">
        <div className="drill-header">
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="drill-title">{title}</div>
            {subtitle && <div className="drill-subtitle">{subtitle}</div>}
          </div>
          <button className="drill-close" onClick={onClose}>✕</button>
        </div>
        <div className="drill-body">{children}</div>
      </div>
    </>
  );
}
