import React, { useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import DrillDownPanel from '../DrillDownPanel.jsx';
import ClaimDetailModal from './ClaimDetailModal.jsx';
import SortableTable from '../SortableTable.jsx';
import {
  buildBucketBreakdown, STANDARD_BUCKET_ORDER, BALANCE_TIER_ORDER,
  hasDenialCode, buildDenialCodeRanking,
} from '../../utils/atbCalculations.js';
import { fmt$, fmtPct } from '../../utils/format.js';

const CLAIM_COLS = [
  {
    key: '_status', label: 'Status', filterType: 'multiselect',
    render: (r) => {
      const cls = r._status === 'Unbilled' ? 'badge-navy' : r._status === 'Unresponded' ? 'badge-orange' : 'badge-green';
      return <span className={`badge ${cls}`}>{r._status}</span>;
    },
  },
  { key: '_carrier', label: 'Carrier', filterType: 'text' },
  { key: 'InsurancePlanDescription', label: 'Plan', filterType: 'text' },
  { key: 'CPTCode', label: 'CPT', filterType: 'text' },
  {
    key: '_balance', label: 'Balance', filterType: 'number',
    render: (r) => <span style={{ color: 'var(--danger)', fontWeight: 700 }}>{fmt$(r._balance)}</span>,
    csvValue: (r) => r._balance?.toFixed(2),
  },
  { key: '_dosBucket', label: 'DOS Bucket', filterType: 'multiselect' },
  { key: 'MAD Aging Bucket', label: 'MAD Bucket', filterType: 'multiselect' },
  { key: '_balanceTier', label: 'Balance Tier', filterType: 'multiselect' },
  {
    key: 'FirstDenialCode', label: 'Denial Code', filterType: 'text',
    render: (r) => r.FirstDenialCode && String(r.FirstDenialCode).trim()
      ? <span className="badge badge-yellow">{r.FirstDenialCode}</span>
      : '—',
  },
  { key: 'Location State', label: 'State', filterType: 'multiselect' },
];

const AGING_COLS = [
  { key: 'bucket', label: 'Bucket', filterType: 'text' },
  { key: 'balance', label: 'Balance', filterType: 'number', render: (r) => fmt$(r.balance) },
  { key: 'count', label: 'Claims', filterType: 'number' },
  { key: 'pct', label: '% of Total', filterType: 'number', render: (r) => fmtPct(r.pct) },
];

const TIER_COLS = [
  { key: 'bucket', label: 'Balance Tier', filterType: 'text' },
  { key: 'balance', label: 'Balance', filterType: 'number', render: (r) => fmt$(r.balance) },
  { key: 'count', label: 'Claims', filterType: 'number' },
  { key: 'pct', label: '% of Total', filterType: 'number', render: (r) => fmtPct(r.pct) },
];

const DENIAL_COLS = [
  {
    key: 'code', label: 'Code', filterType: 'text',
    render: (r) => <span className="badge badge-yellow">{r.code}</span>,
  },
  { key: 'balance', label: 'Balance', filterType: 'number', render: (r) => fmt$(r.balance), csvValue: (r) => r.balance?.toFixed(2) },
  { key: 'count', label: 'Claims', filterType: 'number' },
  { key: 'pct', label: '%', filterType: 'number', render: (r) => fmtPct(r.pct) },
];

export default function DrillAnalyticsPanel({ title, subtitle, rows, onClose, exportFilename = 'drill' }) {
  const [agingMode, setAgingMode] = useState('dos');
  const [detailClaim, setDetailClaim] = useState(null);

  const kpis = useMemo(() => {
    let balance = 0, unbilled = 0, unresponded = 0, responded = 0, denied = 0;
    let dosSum = 0, dosN = 0, madSum = 0, madN = 0;
    for (const r of rows) {
      balance += r._balance;
      if (r._isUnbilled) unbilled += r._balance;
      else if (hasDenialCode(r)) denied += r._balance;
      else if (r._status === 'Unresponded') unresponded += r._balance;
      else responded += r._balance;
      if (r._dosAge != null) { dosSum += r._dosAge; dosN++; }
      const mad = parseFloat(r['MAD Age']);
      if (!isNaN(mad)) { madSum += mad; madN++; }
    }
    return {
      balance, unbilled, unresponded, responded, denied, count: rows.length,
      avgDosAge: dosN > 0 ? Math.round(dosSum / dosN) : null,
      avgMadAge: madN > 0 ? Math.round(madSum / madN) : null,
    };
  }, [rows]);

  const agingData = useMemo(() => {
    const col = agingMode === 'dos' ? '_dosBucket' : 'MAD Aging Bucket';
    return buildBucketBreakdown(rows, col, STANDARD_BUCKET_ORDER);
  }, [rows, agingMode]);

  const tierData = useMemo(() => buildBucketBreakdown(rows, '_balanceTier', BALANCE_TIER_ORDER), [rows]);

  const denialCodes = useMemo(() => {
    const denied = rows.filter(hasDenialCode);
    return denied.length > 0 ? buildDenialCodeRanking(denied) : [];
  }, [rows]);

  return (
    <>
      <DrillDownPanel title={title} subtitle={subtitle} onClose={onClose}>
        {/* KPI Row */}
        <div className="summary-row">
          <div className="summary-item">
            <div className="si-label">Balance</div>
            <div className="si-value" style={{ color: 'var(--danger)' }}>{fmt$(kpis.balance)}</div>
          </div>
          <div className="summary-item">
            <div className="si-label">Claims</div>
            <div className="si-value">{kpis.count.toLocaleString()}</div>
          </div>
          {kpis.unbilled > 0 && (
            <div className="summary-item">
              <div className="si-label">Unbilled</div>
              <div className="si-value" style={{ color: '#1e40af' }}>{fmt$(kpis.unbilled)}</div>
            </div>
          )}
          {kpis.unresponded > 0 && (
            <div className="summary-item">
              <div className="si-label">Unresponded</div>
              <div className="si-value" style={{ color: 'var(--orange)' }}>{fmt$(kpis.unresponded)}</div>
            </div>
          )}
          {kpis.denied > 0 && (
            <div className="summary-item">
              <div className="si-label">Denied</div>
              <div className="si-value" style={{ color: 'var(--danger)' }}>{fmt$(kpis.denied)}</div>
            </div>
          )}
          <div className="summary-item">
            <div className="si-label">Avg DOS Age</div>
            <div className="si-value">{kpis.avgDosAge != null ? `${kpis.avgDosAge}d` : '—'}</div>
          </div>
          <div className="summary-item">
            <div className="si-label">Avg MAD Age</div>
            <div className="si-value">{kpis.avgMadAge != null ? `${kpis.avgMadAge}d` : '—'}</div>
          </div>
        </div>

        {/* Aging chart with DOS/MAD toggle */}
        <div className="panel">
          <div className="panel-header">
            <span className="panel-title">{agingMode === 'dos' ? 'DOS Aging' : 'MAD Aging'}</span>
            <div className="aging-mode-toggle">
              <button type="button" className={agingMode === 'dos' ? 'active' : ''} onClick={() => setAgingMode('dos')}>DOS Age</button>
              <button type="button" className={agingMode === 'mad' ? 'active' : ''} onClick={() => setAgingMode('mad')}>MAD Age</button>
            </div>
          </div>
          <div className="panel-body">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={agingData} margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="bucket" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={fmt$} tick={{ fontSize: 11 }} width={64} />
                <Tooltip formatter={(v) => [fmt$(v), 'Balance']} contentStyle={{ fontSize: 12 }} />
                <Bar dataKey="balance" fill="#1e40af" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <SortableTable columns={AGING_COLS} data={agingData} exportFilename={`${exportFilename}-aging.csv`} pageSize={15} />
        </div>

        {/* Balance tier chart */}
        <div className="panel">
          <div className="panel-header"><span className="panel-title">Balance Tier Distribution</span></div>
          <div className="panel-body">
            <ResponsiveContainer width="100%" height={190}>
              <BarChart data={tierData} margin={{ top: 4, right: 16, left: 8, bottom: 44 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="bucket" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" interval={0} />
                <YAxis tickFormatter={fmt$} tick={{ fontSize: 11 }} width={64} />
                <Tooltip formatter={(v) => [fmt$(v), 'Balance']} contentStyle={{ fontSize: 12 }} />
                <Bar dataKey="balance" fill="#0ea5e9" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <SortableTable columns={TIER_COLS} data={tierData} exportFilename={`${exportFilename}-tiers.csv`} pageSize={15} />
        </div>

        {/* Denial codes section (only if denied rows exist) */}
        {denialCodes.length > 0 && (
          <div className="panel">
            <div className="panel-header"><span className="panel-title">Denial Codes</span></div>
            <SortableTable columns={DENIAL_COLS} data={denialCodes} exportFilename={`${exportFilename}-denials.csv`} pageSize={10} />
          </div>
        )}

        {/* Claims table — click row to open ClaimDetailModal */}
        <div className="panel">
          <div className="panel-header">
            <span className="panel-title">Claims ({rows.length.toLocaleString()})</span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Click a row for full detail</span>
          </div>
          <SortableTable
            columns={CLAIM_COLS}
            data={rows}
            pageSize={50}
            exportFilename={`${exportFilename}.csv`}
            onRowClick={setDetailClaim}
          />
        </div>
      </DrillDownPanel>

      {detailClaim && <ClaimDetailModal claim={detailClaim} onClose={() => setDetailClaim(null)} />}
    </>
  );
}
