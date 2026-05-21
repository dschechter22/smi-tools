import React, { useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import {
  buildAtbPayerBreakdown,
  buildAtbDenialBreakdown,
  buildBucketBreakdown,
  buildStackedAgingByBucket,
  STANDARD_BUCKET_ORDER,
  BALANCE_TIER_ORDER,
  hasDenialCode,
} from '../../utils/atbCalculations.js';
import SortableTable from '../SortableTable.jsx';
import DrillAnalyticsPanel from './DrillAnalyticsPanel.jsx';
import { fmt$, fmtPct } from '../../utils/format.js';

const AGING_COLUMNS = [
  { key: 'bucket', label: 'DOS Bucket', filterType: 'text' },
  { key: 'Unbilled', label: 'Unbilled', filterType: 'number', render: (r) => fmt$(r.Unbilled) },
  { key: 'Unresponded', label: 'Unresponded', filterType: 'number', render: (r) => fmt$(r.Unresponded) },
  { key: 'Responded', label: 'Responded', filterType: 'number', render: (r) => fmt$(r.Responded) },
  {
    key: '_total', label: 'Total', filterType: 'number',
    render: (r) => fmt$((r.Unbilled || 0) + (r.Unresponded || 0) + (r.Responded || 0)),
  },
];

const TIER_COLUMNS = [
  { key: 'bucket', label: 'Balance Tier', filterType: 'text' },
  { key: 'balance', label: 'Balance', filterType: 'number', render: (r) => fmt$(r.balance) },
  { key: 'count', label: 'Claims', filterType: 'number' },
  { key: 'pct', label: '% of Total', filterType: 'number', render: (r) => fmtPct(r.pct) },
];

const PAYER_COLUMNS = [
  { key: 'carrier', label: 'Carrier', filterType: 'text' },
  { key: 'totalBalance', label: 'Total Balance', filterType: 'number', render: (r) => fmt$(r.totalBalance) },
  { key: 'unbilledBalance', label: 'Unbilled', filterType: 'number', render: (r) => fmt$(r.unbilledBalance) },
  { key: 'unrespondedBalance', label: 'Unresponded', filterType: 'number', render: (r) => fmt$(r.unrespondedBalance) },
  { key: 'respondedBalance', label: 'Responded', filterType: 'number', render: (r) => fmt$(r.respondedBalance) },
  { key: 'claimCount', label: 'Claims', filterType: 'number' },
  { key: 'avgDosAge', label: 'Avg DOS Age', filterType: 'number', render: (r) => r.avgDosAge != null ? `${r.avgDosAge}d` : '—' },
];

const DENIAL_COLUMNS = [
  { key: 'code', label: 'Denial Code', filterType: 'text' },
  { key: 'group', label: 'Group', filterType: 'text' },
  { key: 'balance', label: 'Balance', filterType: 'number', render: (r) => fmt$(r.balance) },
  { key: 'count', label: 'Claims', filterType: 'number' },
  { key: 'pctOfTotal', label: '% of Denied', filterType: 'number', render: (r) => fmtPct(r.pctOfTotal) },
];

const STACKED_COLORS = { Unbilled: '#1e40af', Unresponded: '#f97316', Responded: '#16a34a' };

export default function OverviewTab({ filteredData }) {
  const [agingMode, setAgingMode] = useState('dos');
  const [drillRows, setDrillRows] = useState(null);
  const [drillTitle, setDrillTitle] = useState('');

  const kpis = useMemo(() => {
    let total = 0, unbilled = 0, unresponded = 0, responded = 0, denied = 0, claims = 0;
    for (const r of filteredData) {
      total += r._balance;
      claims++;
      if (r._isUnbilled) unbilled += r._balance;
      else if (hasDenialCode(r)) denied += r._balance;
      else if (r._status === 'Unresponded') unresponded += r._balance;
      else responded += r._balance;
    }
    return { total, unbilled, unresponded, responded, denied, claims };
  }, [filteredData]);

  const agingData = useMemo(
    () => buildStackedAgingByBucket(
      filteredData,
      agingMode === 'dos' ? '_dosBucket' : 'MAD Aging Bucket',
      STANDARD_BUCKET_ORDER,
    ),
    [filteredData, agingMode],
  );

  const tierData = useMemo(
    () => buildBucketBreakdown(filteredData, '_balanceTier', BALANCE_TIER_ORDER),
    [filteredData],
  );

  const payerData = useMemo(() => buildAtbPayerBreakdown(filteredData), [filteredData]);

  const denialData = useMemo(() => buildAtbDenialBreakdown(filteredData), [filteredData]);

  const openDrill = (rows, title) => { setDrillRows(rows); setDrillTitle(title); };
  const closeDrill = () => { setDrillRows(null); setDrillTitle(''); };

  if (filteredData.length === 0) {
    return <div className="empty-state"><p>No claims in the current filter.</p></div>;
  }

  return (
    <div className="section-gap">
      {/* KPI Summary */}
      <div className="panel">
        <div className="panel-header"><span className="panel-title">AR Overview</span></div>
        <div className="summary-row">
          <div className="summary-item" style={{ borderTop: '3px solid var(--danger)' }}>
            <div className="si-label">Total Open Balance</div>
            <div className="si-value" style={{ color: 'var(--danger)' }}>{fmt$(kpis.total)}</div>
          </div>
          <div className="summary-item" style={{ borderTop: '3px solid #1e40af' }}>
            <div className="si-label">Unbilled</div>
            <div className="si-value" style={{ color: '#1e40af' }}>{fmt$(kpis.unbilled)}</div>
            <div className="si-sub">{fmtPct(kpis.total > 0 ? (kpis.unbilled / kpis.total) * 100 : null)}</div>
          </div>
          <div className="summary-item" style={{ borderTop: '3px solid var(--orange)' }}>
            <div className="si-label">Unresponded</div>
            <div className="si-value" style={{ color: 'var(--orange)' }}>{fmt$(kpis.unresponded)}</div>
            <div className="si-sub">{fmtPct(kpis.total > 0 ? (kpis.unresponded / kpis.total) * 100 : null)}</div>
          </div>
          <div className="summary-item" style={{ borderTop: '3px solid var(--success)' }}>
            <div className="si-label">Responded</div>
            <div className="si-value" style={{ color: 'var(--success)' }}>{fmt$(kpis.responded)}</div>
            <div className="si-sub">{fmtPct(kpis.total > 0 ? (kpis.responded / kpis.total) * 100 : null)}</div>
          </div>
          <div className="summary-item" style={{ borderTop: '3px solid var(--danger)' }}>
            <div className="si-label">Denied</div>
            <div className="si-value" style={{ color: 'var(--danger)' }}>{fmt$(kpis.denied)}</div>
            <div className="si-sub">{fmtPct(kpis.total > 0 ? (kpis.denied / kpis.total) * 100 : null)}</div>
          </div>
          <div className="summary-item">
            <div className="si-label">Total Claims</div>
            <div className="si-value">{kpis.claims.toLocaleString()}</div>
          </div>
        </div>
      </div>

      {/* Stacked Aging with DOS/MAD toggle */}
      <div className="panel">
        <div className="panel-header">
          <span className="panel-title">{agingMode === 'dos' ? 'DOS Aging — All AR' : 'MAD Aging — All AR'}</span>
          <div className="aging-mode-toggle">
            <button type="button" className={agingMode === 'dos' ? 'active' : ''} onClick={() => setAgingMode('dos')}>DOS Age</button>
            <button type="button" className={agingMode === 'mad' ? 'active' : ''} onClick={() => setAgingMode('mad')}>MAD Age</button>
          </div>
        </div>
        <div className="panel-body">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={agingData} margin={{ top: 4, right: 16, left: 16, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="bucket" tick={{ fontSize: 12 }} />
              <YAxis tickFormatter={fmt$} tick={{ fontSize: 12 }} width={72} />
              <Tooltip formatter={(v) => [fmt$(v)]} contentStyle={{ fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Unbilled" stackId="a" fill={STACKED_COLORS.Unbilled} />
              <Bar dataKey="Unresponded" stackId="a" fill={STACKED_COLORS.Unresponded} />
              <Bar dataKey="Responded" stackId="a" fill={STACKED_COLORS.Responded} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <SortableTable
          columns={AGING_COLUMNS}
          data={agingData}
          exportFilename="overview-aging.csv"
          onRowClick={(row) => openDrill(
            filteredData.filter((r) => (agingMode === 'dos' ? r._dosBucket : r['MAD Aging Bucket']) === row.bucket),
            `${agingMode === 'dos' ? 'DOS' : 'MAD'} Bucket: ${row.bucket}`,
          )}
        />
      </div>

      {/* Balance Tier Distribution */}
      <div className="panel">
        <div className="panel-header"><span className="panel-title">Balance Tier Distribution</span></div>
        <div className="panel-body">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={tierData} margin={{ top: 4, right: 16, left: 16, bottom: 48 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="bucket" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" interval={0} />
              <YAxis tickFormatter={fmt$} tick={{ fontSize: 12 }} width={72} />
              <Tooltip formatter={(v) => [fmt$(v), 'Balance']} contentStyle={{ fontSize: 12 }} />
              <Bar dataKey="balance" fill="#0ea5e9" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <SortableTable
          columns={TIER_COLUMNS}
          data={tierData}
          exportFilename="overview-tiers.csv"
          onRowClick={(row) => openDrill(
            filteredData.filter((r) => r._balanceTier === row.bucket),
            `Balance Tier: ${row.bucket}`,
          )}
        />
      </div>

      {/* Payer Breakdown */}
      <div className="panel">
        <div className="panel-header"><span className="panel-title">Payer Breakdown</span></div>
        <SortableTable
          columns={PAYER_COLUMNS}
          data={payerData}
          exportFilename="overview-payers.csv"
          onRowClick={(row) => openDrill(
            filteredData.filter((r) => r._carrier === row.carrier),
            `Carrier: ${row.carrier}`,
          )}
        />
      </div>

      {/* Top Denial Codes */}
      <div className="panel">
        <div className="panel-header">
          <span className="panel-title">Top Denial Codes</span>
          <span className="panel-subtitle" style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 8 }}>
            Total denied: {fmt$(denialData.totalDenied)}
          </span>
        </div>
        {denialData.codes.length === 0 ? (
          <div style={{ padding: '16px 20px', color: 'var(--text-muted)', fontSize: 13 }}>No denial codes in current filter.</div>
        ) : (
          <SortableTable
            columns={DENIAL_COLUMNS}
            data={denialData.codes}
            exportFilename="overview-denials.csv"
            onRowClick={(row) => openDrill(
              filteredData.filter((r) => String(r.FirstDenialCode || '').trim().toUpperCase() === row.code),
              `Denial Code: ${row.code}`,
            )}
          />
        )}
      </div>

      {/* Drill-down via DrillAnalyticsPanel */}
      {drillRows && (
        <DrillAnalyticsPanel
          title={drillTitle}
          rows={drillRows}
          onClose={closeDrill}
          exportFilename="overview-drill"
        />
      )}
    </div>
  );
}
