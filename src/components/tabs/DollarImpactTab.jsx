import React, { useMemo, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { calculateCPTBenchmarks, calculateUnderpaymentStats, fmt } from '../../utils/calculations.js';
import SortableTable from '../SortableTable.jsx';
import DrillDownPanel from '../DrillDownPanel.jsx';
import { fmt$, fmtRate } from '../../utils/format.js';

function InfoBox({ children }) {
  return (
    <div style={{
      background: '#e6f2fa',
      border: '1px solid #a8d4ed',
      borderLeft: '4px solid #0073bb',
      borderRadius: 6,
      padding: '12px 16px',
      fontSize: 13,
      color: '#16191f',
      lineHeight: 1.6,
    }}>
      {children}
    </div>
  );
}

function DollarImpactDrillDown({ row, filteredData }) {
  const payerRanking = useMemo(() => {
    const groups = {};
    for (const r of filteredData) {
      if (r.CPTCode !== row.cpt) continue;
      const payer = r.PrimIns || '(Unknown)';
      if (!groups[payer]) groups[payer] = { payer, totalChg: 0, totalIns: 0 };
      groups[payer].totalChg += fmt(r.ChgAmt);
      groups[payer].totalIns += fmt(r.InsPmtAmt);
    }
    return Object.values(groups)
      .filter(g => g.totalChg > 0)
      .map(g => ({ ...g, rate: g.totalIns / g.totalChg }))
      .sort((a, b) => b.rate - a.rate);
  }, [row, filteredData]);

  const records = useMemo(() =>
    filteredData
      .filter(r => r.PrimIns === row.payer && r.CPTCode === row.cpt)
      .sort((a, b) => fmt(b.ChgAmt) - fmt(a.ChgAmt)),
    [row, filteredData]
  );

  const benchmark = row.benchmark || 0;

  const payerColumns = useMemo(() => [
    { key: 'payer', label: 'Payer', sortable: true, filterType: 'text', render: (p) => p.payer === row.payer ? <strong>{p.payer} ◀</strong> : p.payer },
    { key: 'rate', label: 'Rate', sortable: true, filterType: 'number', cellClass: 'td-mono text-right', headerClass: 'text-right', render: (p) => <span className={p.rate < 0.02 ? 'rate-red' : p.rate >= benchmark ? 'rate-green' : p.rate >= benchmark * 0.85 ? 'rate-yellow' : 'rate-orange'}>{fmtRate(p.rate)}</span>, csvValue: (p) => (p.rate * 100).toFixed(2) + '%' },
    { key: 'totalChg', label: 'Total Chg', sortable: true, filterType: 'number', cellClass: 'td-mono text-right', headerClass: 'text-right', render: (p) => fmt$(p.totalChg), csvValue: (p) => p.totalChg?.toFixed(2) },
  ], [row.payer, benchmark]);

  const statusCls = (s) => s === 'Closed / Paid' ? 'badge-green' : s === 'Closed / Not Paid' ? 'badge-red' : s === 'Open / Not Paid' ? 'badge-orange' : 'badge-navy';

  const recordColumns = useMemo(() => [
    { key: 'ChgStatus', label: 'Status', sortable: true, filterType: 'multiselect', render: (r) => <span className={`badge ${statusCls(r.ChgStatus)}`} style={{ fontSize: 10 }}>{r.ChgStatus || '—'}</span> },
    { key: 'ChgAmt', label: 'Charge', sortable: true, filterType: 'number', cellClass: 'td-mono text-right', headerClass: 'text-right', render: (r) => fmt$(r.ChgAmt), csvValue: (r) => r.ChgAmt?.toFixed(2) },
    { key: 'InsPmtAmt', label: 'Ins Pmt', sortable: true, filterType: 'number', cellClass: 'td-mono text-right', headerClass: 'text-right', render: (r) => fmt$(r.InsPmtAmt), csvValue: (r) => r.InsPmtAmt?.toFixed(2) },
    { key: 'Balance', label: 'Balance', sortable: true, filterType: 'number', cellClass: 'td-mono text-right', headerClass: 'text-right', render: (r) => <span style={{ color: fmt(r.Balance) > 0 ? 'var(--danger)' : 'inherit' }}>{fmt$(r.Balance)}</span>, csvValue: (r) => r.Balance?.toFixed(2) },
  ], []);

  return (
    <>
      <div>
        <div className="drill-section-title">Payment Rate Summary</div>
        <div className="drill-kpis">
          <div className="drill-kpi"><div className="drill-kpi-label">Payer Rate</div><div className="drill-kpi-value" style={{ color: row.gapPct != null && row.gapPct < -15 ? 'var(--danger)' : 'inherit' }}>{row.payerRate != null ? fmtRate(row.payerRate) : '—'}</div></div>
          <div className="drill-kpi"><div className="drill-kpi-label">Benchmark</div><div className="drill-kpi-value">{row.benchmark != null ? fmtRate(row.benchmark) : '—'}</div></div>
          <div className="drill-kpi"><div className="drill-kpi-label">Gap</div><div className="drill-kpi-value" style={{ color: row.gapPct != null && row.gapPct < 0 ? 'var(--danger)' : 'var(--success)' }}>{row.gapPct != null ? `${row.gapPct >= 0 ? '+' : ''}${Math.round(row.gapPct)}%` : '—'}</div></div>
          <div className="drill-kpi"><div className="drill-kpi-label">Dollar Impact</div><div className="drill-kpi-value" style={{ color: 'var(--danger)' }}>{fmt$(row.dollarImpact)}</div></div>
          <div className="drill-kpi"><div className="drill-kpi-label">Total Charged</div><div className="drill-kpi-value">{fmt$(row.totalChgAmt)}</div></div>
        </div>
      </div>
      <div>
        <div className="drill-section-title">All Payers for CPT {row.cpt} — Ranked by Rate</div>
        <SortableTable columns={payerColumns} data={payerRanking} pageSize={20} exportFilename={`payer_ranking_${row.cpt}.csv`} emptyMessage="No payer data." />
      </div>
      {records.length > 0 && (
        <div>
          <div className="drill-section-title">Individual Records ({records.length})</div>
          <SortableTable columns={recordColumns} data={records} pageSize={20} exportFilename={`records_${row.payer}_${row.cpt}.csv`} emptyMessage="No records." />
        </div>
      )}
    </>
  );
}

const IMPACT_COLORS = [
  '#7f1d1d', '#991b1b', '#b91c1c', '#dc2626', '#ef4444',
  '#f97316', '#fb923c', '#fbbf24', '#f59e0b', '#d97706',
  '#b45309', '#92400e', '#78350f', '#6b21a8', '#7e22ce',
  '#6d28d9', '#5b21b6', '#4c1d95', '#1e3a8a', '#1e40af',
];

export default function DollarImpactTab({ filteredData, benchmarkMethod }) {
  const [drillRow, setDrillRow] = useState(null);
  const benchmarks = useMemo(
    () => calculateCPTBenchmarks(filteredData, benchmarkMethod),
    [filteredData, benchmarkMethod]
  );

  const allStats = useMemo(
    () => calculateUnderpaymentStats(filteredData, benchmarks, benchmarkMethod, 0),
    [filteredData, benchmarks, benchmarkMethod]
  );

  // Only combos where dollarImpact > 0
  const impactData = useMemo(
    () => allStats.filter((r) => r.dollarImpact > 0),
    [allStats]
  );

  const top20Chart = useMemo(
    () =>
      impactData.slice(0, 20).map((r) => ({
        name: `${r.payer.slice(0, 12)}…\n${r.cpt}`,
        label: `${r.payer} / ${r.cpt}`,
        impact: r.dollarImpact,
      })),
    [impactData]
  );

  const totalImpact = useMemo(
    () => impactData.reduce((s, r) => s + r.dollarImpact, 0),
    [impactData]
  );

  const columns = [
    { key: 'payer', label: 'Payer', sortable: true, filterType: 'multiselect' },
    { key: 'cpt', label: 'CPT', sortable: true, filterType: 'multiselect' },
    {
      key: 'benchmark',
      label: `Benchmark (dollar-weighted)`,
      sortable: true,
      filterType: 'number',
      cellClass: 'td-mono text-right',
      headerClass: 'text-right',
      render: (r) => r.benchmark == null ? <span className="insuf-data">Insuf. data</span> : fmtRate(r.benchmark),
      csvValue: (r) => r.benchmark != null ? (r.benchmark * 100).toFixed(2) + '%' : '',
    },
    {
      key: 'payerRate',
      label: 'Payer Rate',
      sortable: true,
      filterType: 'number',
      cellClass: 'td-mono text-right',
      headerClass: 'text-right',
      render: (r) => fmtRate(r.payerRate),
      csvValue: (r) => r.payerRate != null ? (r.payerRate * 100).toFixed(2) + '%' : '',
    },
    {
      key: 'gapPct',
      label: 'Underpayment %',
      sortable: true,
      filterType: 'number',
      cellClass: 'td-mono text-right',
      headerClass: 'text-right',
      render: (r) => {
        if (r.gapPct == null) return '—';
        const abs = Math.abs(r.gapPct);
        const cls = abs < 15 ? 'rate-yellow' : abs < 40 ? 'rate-orange' : 'rate-red';
        return <span className={cls}>{Math.round(r.gapPct)}%</span>;
      },
      csvValue: (r) => r.gapPct != null ? r.gapPct.toFixed(2) + '%' : '',
    },
    {
      key: 'dollarImpact',
      label: 'Dollar Impact',
      sortable: true,
      filterType: 'number',
      cellClass: 'td-mono text-right',
      headerClass: 'text-right',
      render: (r) => (
        <strong style={{ color: 'var(--danger)' }}>{fmt$(r.dollarImpact)}</strong>
      ),
      csvValue: (r) => r.dollarImpact?.toFixed(2),
    },
    {
      key: 'totalChgAmt',
      label: 'Total Chg Amt',
      sortable: true,
      filterType: 'number',
      cellClass: 'td-mono text-right',
      headerClass: 'text-right',
      render: (r) => fmt$(r.totalChgAmt),
      csvValue: (r) => r.totalChgAmt?.toFixed(2),
    },
  ];

  if (filteredData.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon">💰</div>
        <p>No data matches the current filters.</p>
      </div>
    );
  }

  return (
    <div className="section-gap">
      <InfoBox>
        <strong>Dollar Impact Ranking</strong> — Shows the estimated revenue left on the table, calculated as: (benchmark rate − payer rate) × total charges for that combination. This prioritizes where to focus — a payer 10% under benchmark on a high-volume code generates more recoverable revenue than a payer 40% under on a rarely-billed code. Only combinations with a positive dollar impact are shown.
      </InfoBox>

      {/* Summary */}
      <div className="summary-row">
        <div className="summary-item">
          <div className="si-label">Total Dollar Impact</div>
          <div className="si-value" style={{ color: 'var(--danger)' }}>
            {fmt$(totalImpact)}
          </div>
        </div>
        <div className="summary-item">
          <div className="si-label">Combos w/ Impact</div>
          <div className="si-value">{impactData.length}</div>
        </div>
        <div className="summary-item">
          <div className="si-label">Benchmark Method</div>
          <div className="si-value" style={{ textTransform: 'capitalize', fontFamily: 'var(--font)' }}>
            Dollar-weighted
          </div>
        </div>
      </div>

      {/* Bar Chart Top 20 */}
      {top20Chart.length > 0 && (
        <div className="chart-container">
          <div className="panel-header">
            <div className="panel-title">Top 20 Payer/CPT Combinations — Dollar Impact</div>
          </div>
          <div className="panel-body">
            <ResponsiveContainer width="100%" height={320}>
              <BarChart
                data={top20Chart}
                margin={{ top: 8, right: 16, left: 10, bottom: 60 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 10 }}
                  angle={-35}
                  textAnchor="end"
                  interval={0}
                />
                <YAxis tick={{ fontSize: 11 }} width={80} tickFormatter={(v) => fmt$(v)} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0];
                    return (
                      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 6, padding: '8px 12px', fontSize: 12, maxWidth: 240 }}>
                        <div style={{ fontWeight: 600 }}>{d.payload.label}</div>
                        <div style={{ color: 'var(--danger)' }}>Impact: {fmt$(d.value)}</div>
                      </div>
                    );
                  }}
                />
                <Bar dataKey="impact" radius={[3, 3, 0, 0]}>
                  {top20Chart.map((_, i) => (
                    <Cell key={i} fill={IMPACT_COLORS[i % IMPACT_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Full Table */}
      <div className="panel-header" style={{ background: 'var(--card)', borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0', border: '1px solid var(--border)', borderBottom: 'none', padding: '12px 16px' }}>
        <div className="panel-title">All Payer/CPT Combinations with Dollar Impact</div>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{impactData.length} rows</span>
      </div>
      <SortableTable
        columns={columns}
        data={impactData}
        pageSize={25}
        exportFilename="dollar_impact.csv"
        emptyMessage="No underpayment gaps found in filtered data (all payers are at or above benchmark)."
        onRowClick={setDrillRow}
      />

      {drillRow && (
        <DrillDownPanel
          title={`${drillRow.payer} — CPT ${drillRow.cpt}`}
          subtitle="Dollar Impact — Payer Detail"
          onClose={() => setDrillRow(null)}
        >
          <DollarImpactDrillDown row={drillRow} filteredData={filteredData} />
        </DrillDownPanel>
      )}
    </div>
  );
}
