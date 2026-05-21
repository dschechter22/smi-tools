import React, { useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import {
  buildBucketBreakdown, buildPayerPerformance, STANDARD_BUCKET_ORDER,
} from '../../utils/atbCalculations.js';
import SortableTable from '../SortableTable.jsx';
import DrillDownPanel from '../DrillDownPanel.jsx';
import { fmt$, fmtPct } from '../../utils/format.js';

// ── Column Definitions ────────────────────────────────────────────────────────

const INIT_BUCKET_COLS = [
  {
    key: 'bucket', label: 'Initial File Date Bucket', sortable: false, filterType: 'multiselect',
  },
  {
    key: 'balance', label: 'Balance', sortable: true, filterType: 'number',
    cellClass: 'td-mono text-right', headerClass: 'text-right',
    render: (r) => <span style={{ color: 'var(--danger)', fontWeight: 700 }}>{fmt$(r.balance)}</span>,
    csvValue: (r) => r.balance?.toFixed(2),
  },
  {
    key: 'count', label: 'Claims', sortable: true, filterType: 'number',
    cellClass: 'td-mono text-right', headerClass: 'text-right',
  },
  {
    key: 'pct', label: '% of Total', sortable: true, filterType: 'number',
    cellClass: 'td-mono text-right', headerClass: 'text-right',
    render: (r) => fmtPct(r.pct),
    csvValue: (r) => r.pct?.toFixed(2) + '%',
  },
];

const MAD_BUCKET_COLS = [
  {
    key: 'bucket', label: 'MAD Aging Bucket', sortable: false, filterType: 'multiselect',
  },
  {
    key: 'balance', label: 'Balance', sortable: true, filterType: 'number',
    cellClass: 'td-mono text-right', headerClass: 'text-right',
    render: (r) => <span style={{ color: 'var(--danger)', fontWeight: 700 }}>{fmt$(r.balance)}</span>,
    csvValue: (r) => r.balance?.toFixed(2),
  },
  {
    key: 'count', label: 'Claims', sortable: true, filterType: 'number',
    cellClass: 'td-mono text-right', headerClass: 'text-right',
  },
  {
    key: 'pct', label: '% of Total', sortable: true, filterType: 'number',
    cellClass: 'td-mono text-right', headerClass: 'text-right',
    render: (r) => fmtPct(r.pct),
    csvValue: (r) => r.pct?.toFixed(2) + '%',
  },
];

const PAYER_PERF_COLS = [
  {
    key: 'carrier', label: 'Carrier', sortable: true, filterType: 'text',
  },
  {
    key: 'balance', label: 'Balance', sortable: true, filterType: 'number',
    cellClass: 'td-mono text-right', headerClass: 'text-right',
    render: (r) => <span style={{ color: 'var(--danger)', fontWeight: 700 }}>{fmt$(r.balance)}</span>,
    csvValue: (r) => r.balance?.toFixed(2),
  },
  {
    key: 'count', label: 'Claims', sortable: true, filterType: 'number',
    cellClass: 'td-mono text-right', headerClass: 'text-right',
  },
  {
    key: 'respondedBalance', label: 'Responded $', sortable: true, filterType: 'number',
    cellClass: 'td-mono text-right', headerClass: 'text-right',
    render: (r) => <span style={{ color: 'var(--success)' }}>{fmt$(r.respondedBalance)}</span>,
    csvValue: (r) => r.respondedBalance?.toFixed(2),
  },
  {
    key: 'unrespondedBalance', label: 'Unresponded $', sortable: true, filterType: 'number',
    cellClass: 'td-mono text-right', headerClass: 'text-right',
    render: (r) => <span style={{ color: 'var(--orange)' }}>{fmt$(r.unrespondedBalance)}</span>,
    csvValue: (r) => r.unrespondedBalance?.toFixed(2),
  },
  {
    key: 'responseRate', label: 'Response Rate', sortable: true, filterType: 'number',
    cellClass: 'td-mono text-right', headerClass: 'text-right',
    render: (r) => `${r.responseRate.toFixed(1)}%`,
    csvValue: (r) => r.responseRate.toFixed(1) + '%',
  },
  {
    key: 'avgMadAge', label: 'Avg MAD Age', sortable: true, filterType: 'number',
    cellClass: 'td-mono text-right', headerClass: 'text-right',
    render: (r) => r.avgMadAge != null ? `${r.avgMadAge}d` : '—',
    csvValue: (r) => r.avgMadAge ?? '',
  },
  {
    key: 'avgInitFileAge', label: 'Avg Init File Age', sortable: true, filterType: 'number',
    cellClass: 'td-mono text-right', headerClass: 'text-right',
    render: (r) => r.avgInitFileAge != null ? `${r.avgInitFileAge}d` : '—',
    csvValue: (r) => r.avgInitFileAge ?? '',
  },
];

const RESPONSE_STATUS_COLS = [
  {
    key: 'carrier', label: 'Carrier', sortable: true, filterType: 'text',
  },
  {
    key: 'respondedBalance', label: 'Responded $', sortable: true, filterType: 'number',
    cellClass: 'td-mono text-right', headerClass: 'text-right',
    render: (r) => <span style={{ color: 'var(--success)' }}>{fmt$(r.respondedBalance)}</span>,
    csvValue: (r) => r.respondedBalance?.toFixed(2),
  },
  {
    key: 'unrespondedBalance', label: 'Unresponded $', sortable: true, filterType: 'number',
    cellClass: 'td-mono text-right', headerClass: 'text-right',
    render: (r) => <span style={{ color: 'var(--orange)' }}>{fmt$(r.unrespondedBalance)}</span>,
    csvValue: (r) => r.unrespondedBalance?.toFixed(2),
  },
  {
    key: 'totalBalance', label: 'Total Balance', sortable: true, filterType: 'number',
    cellClass: 'td-mono text-right', headerClass: 'text-right',
    render: (r) => <span style={{ color: 'var(--danger)', fontWeight: 700 }}>{fmt$(r.totalBalance)}</span>,
    csvValue: (r) => r.totalBalance?.toFixed(2),
  },
  {
    key: 'responseRate', label: 'Response Rate', sortable: true, filterType: 'number',
    cellClass: 'td-mono text-right', headerClass: 'text-right',
    render: (r) => `${r.responseRate.toFixed(1)}%`,
    csvValue: (r) => r.responseRate.toFixed(1) + '%',
  },
];

const DRILL_CLAIM_COLS = [
  {
    key: '_status', label: 'Status', sortable: true, filterType: 'multiselect',
    render: (r) => {
      if (r._status === 'Unresponded') return <span className="badge badge-orange">Unresponded</span>;
      return <span className="badge badge-green">Responded</span>;
    },
  },
  {
    key: '_carrier', label: 'Carrier', sortable: true, filterType: 'text',
  },
  {
    key: 'InsurancePlanDescription', label: 'Plan', sortable: true, filterType: 'text',
  },
  {
    key: 'CPTCode', label: 'CPT', sortable: true, filterType: 'text',
  },
  {
    key: '_balance', label: 'Balance', sortable: true, filterType: 'number',
    cellClass: 'td-mono text-right', headerClass: 'text-right',
    render: (r) => <span style={{ color: 'var(--danger)', fontWeight: 700 }}>{fmt$(r._balance)}</span>,
    csvValue: (r) => r._balance?.toFixed(2),
  },
  {
    key: '_initialFileDateAge', label: 'Init File Age', sortable: true, filterType: 'number',
    cellClass: 'td-mono text-right', headerClass: 'text-right',
    render: (r) => r._initialFileDateAge != null ? `${r._initialFileDateAge}d` : '—',
    csvValue: (r) => r._initialFileDateAge ?? '',
  },
  {
    key: 'MAD Age', label: 'MAD Age', sortable: true, filterType: 'number',
    cellClass: 'td-mono text-right', headerClass: 'text-right',
    render: (r) => {
      const v = parseFloat(r['MAD Age']);
      return isNaN(v) ? '—' : `${Math.round(v)}d`;
    },
    csvValue: (r) => r['MAD Age'] ?? '',
  },
  {
    key: 'MAD Aging Bucket', label: 'MAD Bucket', sortable: true, filterType: 'multiselect',
  },
  {
    key: '_dosBucket', label: 'DOS Bucket', sortable: true, filterType: 'multiselect',
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function isBilledAr(row) {
  return !row._isUnbilled && !(row.FirstDenialCode && String(row.FirstDenialCode).trim() !== '');
}

function drillTitle(drillRow, drillType) {
  if (!drillRow) return '';
  if (drillType === 'payer' || drillType === 'responseStatus') return drillRow.carrier;
  return drillRow.bucket;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function BilledArTab({ filteredData }) {
  const [drillRow, setDrillRow] = useState(null);
  const [drillType, setDrillType] = useState(null);

  // ── Billed AR rows ──────────────────────────────────────────────────────────
  const billedRows = useMemo(
    () => (filteredData || []).filter(isBilledAr),
    [filteredData]
  );

  // ── Summary KPIs ────────────────────────────────────────────────────────────
  const summary = useMemo(() => {
    let totalBalance = 0;
    let respondedBalance = 0;
    let unrespondedBalance = 0;
    let respondedCount = 0;
    let madAgeSum = 0;
    let madAgeCount = 0;

    for (const row of billedRows) {
      totalBalance += row._balance;
      if (row._status === 'Responded') {
        respondedBalance += row._balance;
        respondedCount++;
      } else if (row._status === 'Unresponded') {
        unrespondedBalance += row._balance;
      }
      const mad = parseFloat(row['MAD Age']);
      if (!isNaN(mad)) {
        madAgeSum += mad;
        madAgeCount++;
      }
    }

    const total = billedRows.length;
    return {
      totalBalance,
      respondedBalance,
      unrespondedBalance,
      total,
      avgMadAge: madAgeCount > 0 ? Math.round(madAgeSum / madAgeCount) : null,
      responseRate: total > 0 ? (respondedCount / total) * 100 : 0,
    };
  }, [billedRows]);

  // ── Aging breakdowns ────────────────────────────────────────────────────────
  const initBucketData = useMemo(
    () => buildBucketBreakdown(billedRows, '_initialFileDateBucket', STANDARD_BUCKET_ORDER),
    [billedRows]
  );

  const madBucketData = useMemo(
    () => buildBucketBreakdown(billedRows, 'MAD Aging Bucket', STANDARD_BUCKET_ORDER),
    [billedRows]
  );

  // ── Payer Performance ───────────────────────────────────────────────────────
  const payerPerformance = useMemo(
    () => buildPayerPerformance(billedRows),
    [billedRows]
  );

  // ── Response Status by Payer ────────────────────────────────────────────────
  const responseStatusByPayer = useMemo(() => {
    const map = {};
    for (const row of billedRows) {
      const c = row._carrier || '(Unknown)';
      if (!map[c]) map[c] = { carrier: c, respondedBalance: 0, unrespondedBalance: 0, totalBalance: 0, respondedCount: 0, total: 0 };
      const g = map[c];
      g.totalBalance += row._balance;
      g.total++;
      if (row._status === 'Responded') {
        g.respondedBalance += row._balance;
        g.respondedCount++;
      } else if (row._status === 'Unresponded') {
        g.unrespondedBalance += row._balance;
      }
    }
    return Object.values(map)
      .map((g) => ({
        carrier: g.carrier,
        respondedBalance: g.respondedBalance,
        unrespondedBalance: g.unrespondedBalance,
        totalBalance: g.totalBalance,
        responseRate: g.total > 0 ? (g.respondedCount / g.total) * 100 : 0,
      }))
      .sort((a, b) => b.totalBalance - a.totalBalance);
  }, [billedRows]);

  // ── Drill-down claims ───────────────────────────────────────────────────────
  const drillClaims = useMemo(() => {
    if (!drillRow || !drillType) return [];
    if (drillType === 'initBucket') return billedRows.filter((r) => r._initialFileDateBucket === drillRow.bucket);
    if (drillType === 'madBucket') return billedRows.filter((r) => r['MAD Aging Bucket'] === drillRow.bucket);
    if (drillType === 'payer') return billedRows.filter((r) => r._carrier === drillRow.carrier);
    if (drillType === 'responseStatus') return billedRows.filter((r) => r._carrier === drillRow.carrier);
    return [];
  }, [billedRows, drillRow, drillType]);

  const drillSummary = useMemo(() => {
    let balance = 0;
    for (const r of drillClaims) balance += r._balance;
    return { balance, count: drillClaims.length };
  }, [drillClaims]);

  const openDrill = (row, type) => {
    setDrillRow(row);
    setDrillType(type);
  };

  const closeDrill = () => {
    setDrillRow(null);
    setDrillType(null);
  };

  const tooltipFormatter = (value) => [fmt$(value), undefined];

  // ── Empty state ─────────────────────────────────────────────────────────────
  if (billedRows.length === 0) {
    return (
      <div className="panel">
        <div className="empty-state">
          <div className="empty-icon">📋</div>
          <p>No billed AR claims match the current filters.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="section-gap">

      {/* Section 1: Summary KPIs */}
      <div className="summary-row">
        <div className="summary-item">
          <div className="si-label">Total Billed Balance</div>
          <div className="si-value" style={{ color: 'var(--danger)' }}>{fmt$(summary.totalBalance)}</div>
        </div>
        <div className="summary-item">
          <div className="si-label">Responded Balance</div>
          <div className="si-value" style={{ color: 'var(--success)' }}>{fmt$(summary.respondedBalance)}</div>
        </div>
        <div className="summary-item">
          <div className="si-label">Unresponded Balance</div>
          <div className="si-value" style={{ color: 'var(--orange)' }}>{fmt$(summary.unrespondedBalance)}</div>
        </div>
        <div className="summary-item">
          <div className="si-label">Claim Count</div>
          <div className="si-value">{summary.total.toLocaleString()}</div>
        </div>
        <div className="summary-item">
          <div className="si-label">Avg MAD Age</div>
          <div className="si-value">{summary.avgMadAge != null ? `${summary.avgMadAge}d` : '—'}</div>
        </div>
        <div className="summary-item">
          <div className="si-label">Response Rate</div>
          <div className="si-value">{`${summary.responseRate.toFixed(1)}%`}</div>
        </div>
      </div>

      {/* Section 2: Initial File Date Aging */}
      <div className="panel">
        <div className="panel-header">
          <span className="panel-title">Initial File Date Aging</span>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Click a row to drill down</span>
        </div>
        <div className="panel-body">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={initBucketData} margin={{ top: 8, right: 20, left: 10, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis
                dataKey="bucket"
                tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                angle={-35}
                textAnchor="end"
                interval={0}
              />
              <YAxis
                tickFormatter={(v) => fmt$(v)}
                tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                width={72}
              />
              <Tooltip formatter={tooltipFormatter} />
              <Bar dataKey="balance" name="Balance" fill="#0073bb" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <SortableTable
          columns={INIT_BUCKET_COLS}
          data={initBucketData}
          pageSize={15}
          exportFilename="billed_ar_init_file_aging.csv"
          onRowClick={(row) => openDrill(row, 'initBucket')}
        />
      </div>

      {/* Section 3: MAD Aging */}
      <div className="panel">
        <div className="panel-header">
          <span className="panel-title">MAD Aging</span>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Click a row to drill down</span>
        </div>
        <div className="panel-body">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={madBucketData} margin={{ top: 8, right: 20, left: 10, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis
                dataKey="bucket"
                tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                angle={-35}
                textAnchor="end"
                interval={0}
              />
              <YAxis
                tickFormatter={(v) => fmt$(v)}
                tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                width={72}
              />
              <Tooltip formatter={tooltipFormatter} />
              <Bar dataKey="balance" name="Balance" fill="#6d28d9" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <SortableTable
          columns={MAD_BUCKET_COLS}
          data={madBucketData}
          pageSize={15}
          exportFilename="billed_ar_mad_aging.csv"
          onRowClick={(row) => openDrill(row, 'madBucket')}
        />
      </div>

      {/* Section 4: Payer Performance */}
      <div className="panel">
        <div className="panel-header">
          <span className="panel-title">Payer Performance</span>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Click a row to drill down</span>
        </div>
        <SortableTable
          columns={PAYER_PERF_COLS}
          data={payerPerformance}
          pageSize={25}
          exportFilename="billed_ar_payer_performance.csv"
          onRowClick={(row) => openDrill(row, 'payer')}
        />
      </div>

      {/* Section 5: Response Status by Payer */}
      <div className="panel">
        <div className="panel-header">
          <span className="panel-title">Response Status by Payer</span>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Click a row to drill down</span>
        </div>
        <SortableTable
          columns={RESPONSE_STATUS_COLS}
          data={responseStatusByPayer}
          pageSize={25}
          exportFilename="billed_ar_response_status.csv"
          onRowClick={(row) => openDrill(row, 'responseStatus')}
        />
      </div>

      {/* Drill-Down Panel */}
      {drillRow && drillType && (
        <DrillDownPanel
          title={drillTitle(drillRow, drillType)}
          subtitle={`Billed AR — ${drillType === 'initBucket' ? 'Initial File Date Bucket' : drillType === 'madBucket' ? 'MAD Aging Bucket' : drillType === 'payer' ? 'Payer Performance' : 'Response Status'}`}
          onClose={closeDrill}
        >
          <div className="section-gap">
            <div className="summary-row">
              <div className="summary-item">
                <div className="si-label">Balance</div>
                <div className="si-value" style={{ color: 'var(--danger)' }}>{fmt$(drillSummary.balance)}</div>
              </div>
              <div className="summary-item">
                <div className="si-label">Claims</div>
                <div className="si-value">{drillSummary.count.toLocaleString()}</div>
              </div>
            </div>
            <SortableTable
              columns={DRILL_CLAIM_COLS}
              data={drillClaims}
              pageSize={50}
              exportFilename={`billed_ar_drill_${drillType}.csv`}
              emptyMessage="No matching claims."
            />
          </div>
        </DrillDownPanel>
      )}

    </div>
  );
}
