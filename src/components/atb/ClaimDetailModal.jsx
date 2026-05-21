import React, { useEffect } from 'react';
import { fmt$ } from '../../utils/format.js';

const HIGHLIGHT_KEYS = [
  ['_status', 'Status', null],
  ['_balance', 'Balance', (v) => fmt$(v)],
  ['_carrier', 'Carrier', null],
  ['InsurancePlanDescription', 'Plan', null],
  ['CPTCode', 'CPT Code', null],
  ['Modality', 'Modality', null],
  ['ServiceDate', 'Service Date', null],
  ['_dosAge', 'DOS Age', (v) => v != null ? `${v}d` : '—'],
  ['_dosBucket', 'DOS Bucket', null],
  ['_balanceTier', 'Balance Tier', null],
  ['InitialFileDate', 'Initial File Date', null],
  ['_initialFileDateAge', 'File Date Age', (v) => v != null ? `${v}d` : '—'],
  ['MAD Age', 'MAD Age', (v) => (v != null && v !== '') ? `${v}` : '—'],
  ['MAD Aging Bucket', 'MAD Bucket', null],
  ['Response Status', 'Response Status', null],
  ['FirstDenialCode', 'First Denial Code', null],
  ['LastDenialCode', 'Last Denial Code', null],
  ['FirstDenialGroup', 'Denial Group', null],
  ['InsuranceType', 'Insurance Type', null],
  ['Location State', 'State', null],
  ['New Action Grouping', 'Action Group', null],
  ['Work List', 'Work List', null],
];

const SKIP_PRIVATE = new Set([
  '_status', '_balance', '_carrier', '_chargeAmount', '_piField', '_dosAge',
  '_dosBucket', '_initialFileDateAge', '_initialFileDateBucket', '_lastInsFileDateAge',
  '_lastInsFileDateBucket', '_unbilledDosBucket', '_balanceTier', '_isUnbilled',
]);

export default function ClaimDetailModal({ claim, onClose }) {
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const rawFields = Object.entries(claim)
    .filter(([k]) => !SKIP_PRIVATE.has(k) && !k.startsWith('_'))
    .sort(([a], [b]) => a.localeCompare(b));

  return (
    <>
      <div className="claim-modal-backdrop" onClick={onClose} />
      <div className="claim-modal-panel">
        <div className="claim-modal-header">
          <div>
            <div className="claim-modal-title">Claim Detail</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              {claim._carrier || '—'} · {claim.CPTCode || '—'} · {String(claim.InsurancePlanDescription || '—').slice(0, 60)}
            </div>
          </div>
          <button className="drill-close" onClick={onClose}>✕</button>
        </div>
        <div className="claim-modal-body">
          <div className="claim-highlight-grid">
            {HIGHLIGHT_KEYS.map(([key, label, fmtFn]) => {
              const val = claim[key];
              const display = (val == null || val === '') ? '—' : (fmtFn ? fmtFn(val) : String(val));
              return (
                <div key={key} className="claim-highlight-item">
                  <div className="claim-field-label">{label}</div>
                  <div className="claim-field-value">{display}</div>
                </div>
              );
            })}
          </div>
          <div className="claim-raw-section">
            <div className="claim-raw-title">All Fields</div>
            <div className="claim-raw-grid">
              {rawFields.map(([key, val]) => (
                <div key={key} className="claim-raw-item">
                  <span className="claim-raw-key">{key}</span>
                  <span className="claim-raw-val">{(val == null || val === '') ? '—' : String(val)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
