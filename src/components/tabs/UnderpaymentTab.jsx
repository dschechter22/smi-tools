import React, { useMemo, useState } from 'react';
import { calculateCPTBenchmarks, calculateUnderpaymentStats, fmt } from '../../utils/calculations.js';
import SortableTable from '../SortableTable.jsx';
import DrillDownPanel from '../DrillDownPanel.jsx';
import { fmt$, fmtRate } from '../../utils/format.js';

function getRateClass(payerRate, benchmark) {
  if (benchmark == null || payerRate == null) return '';
  if (payerRate < 0.02) return 'rate-red';
  const ratio = payerRate / benchmark;
  if (ratio >= 1) return 'rate-green';
  if (ratio >= 0.85) return 'rate-yellow';
  if (ratio >= 0.60) return 'rate-orange';
  return 'rate-red';
}

function getRateBadgeClass(payerRate, benchmark) {
  if (benchmark == null || payerRate == null) return 'badge-gray';
  if (payerRate < 0.02) return 'badge-red';
  const ratio = payerRate / benchmark;
  if (ratio >= 1) return 'badge-green';
  if (ratio >= 0.85) return 'badge-yellow';
  if (ratio >= 0.60) return 'badge-orange';
  return 'badge-red';
}

function InfoBox({ children }) {
  return <div style={{ background: '#e6f2fa', border: '1px solid #a8d4ed', borderLeft: '4px solid #0073bb', borderRadius: 6, padding: '12px 16px', fontSize: 13, color: '#16191f', lineHeight: 1.6 }}>{children}</div>;
}

function UnderpaymentDrillDown({ row, filteredData }) {
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
      .sort((a, b) => fmt(b.ChgAmt) - fmt(a.ChgAmt))
      .slice(0, 20),
    [row, filteredData]
  );

  const statusCls = (s) => s === 'Closed / Paid' ? 'badge-green' : s === 'Closed / Not Paid' ? 'badge-red' : s === 'Open / Not Paid' ? 'badge-orange' : 'badge-navy';

  return (
    <>
      <div>
        <div className="drill-section-title">Payment Rate Summary</div>
        <div className="drill-kpis">
          <div className="drill-kpi"><div className="drill-kpi-label">Payer Rate</div><div className="drill-kpi-value" style={{ color: row.gapPct != null && row.gapPct < -15 ? 'var(--danger)' : 'inherit' }}>{row.payerRate != null ? fmtRate(row.payerRate) : '—'}</div></div>
          <div className="drill-kpi"><div className="drill-kpi-label">Benchmark</div><div className="drill-kpi-value">{row.benchmark != null ? fmtRate(row.benchmark) : '—'}</div></div>
          <div className="drill-kpi"><div className="drill-kpi-label">Gap</div><div className="drill-kpi-value" style={{ color: row.gapPct != null && row.gapPct < 0 ? 'var(--danger)' : 'var(--success)' }}>{row.gapPct != null ? `${row.gapPct >= 0 ? '+' : ''}${Math.round(row.gapPct)}%` : '—'}</div></div>
          <div className="drill-kpi"><div className="drill-kpi-label">Dollar Impact</div><div className="drill-kpi-value" style={{ color: row.dollarImpact > 0 ? 'var(--danger)' : 'inherit' }}>{fmt$(row.dollarImpact)}</div></div>
          <div className="drill-kpi"><div className="drill-kpi-label">Total Charged</div><div className="drill-kpi-value">{fmt$(row.totalChgAmt)}</div></div>
          <div className="drill-kpi"><div className="drill-kpi-label">Records</div><div className="drill-kpi-value">{row.sampleSize}</div></div>
        </div>
      </div>
      <div>
        <div className="drill-section-title">All Payers for CPT {row.cpt} — Ranked by Rate</div>
        <table className="drill-mini-table">
          <thead><tr><th>#</th><th>Payer</th><th className="r">Rate</th><th className="r">Total Chg</th></tr></thead>
          <tbody>
            {payerRanking.map((p, i) => (
              <tr key={p.payer} style={{ background: p.payer === row.payer ? '#fef9e7' : undefined }}>
                <td style={{ color: 'var(--text-muted)' }}>{i + 1}</td>
                <td>{p.payer === row.payer ? <strong>{p.payer} ◀</strong> : p.payer}</td>
                <td className="r"><span className={p.rate < 0.02 ? 'rate-red' : p.rate >= (row.benchmark || 0) ? 'rate-green' : p.rate >= (row.benchmark || 0) * 0.85 ? 'rate-yellow' : 'rate-orange'}>{fmtRate(p.rate)}</span></td>
                <td className="r">{fmt$(p.totalChg)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {records.length > 0 && (
        <div>
          <div className="drill-section-title">Individual Records (top {records.length})</div>
          <table className="drill-mini-table">
            <thead><tr><th>Status</th><th className="r">Charge</th><th className="r">Ins Pmt</th><th className="r">Balance</th></tr></thead>
            <tbody>
              {records.map((r, i) => (
                <tr key={i}>
                  <td><span className={`badge ${statusCls(r.ChgStatus)}`} style={{ fontSize: 10 }}>{r.ChgStatus || '—'}</span></td>
                  <td className="r">{fmt$(r.ChgAmt)}</td>
                  <td className="r">{fmt$(r.InsPmtAmt)}</td>
                  <td className="r" style={{ color: fmt(r.Balance) > 0 ? 'var(--danger)' : 'inherit' }}>{fmt$(r.Balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

export default function UnderpaymentTab({ filteredData, benchmarkMethod, onBenchmarkMethodChange }) {
  const [threshold, setThreshold] = useState(15);
  const [drillRow, setDrillRow] = useState(null);

  const benchmarks = useMemo(() => calculateCPTBenchmarks(filteredData, benchmarkMethod), [filteredData, benchmarkMethod]);
  const stats = useMemo(() => calculateUnderpaymentStats(filteredData, benchmarks, benchmarkMethod, threshold), [filteredData, benchmarks, benchmarkMethod, threshold]);

  const columns = [
    { key: 'payer', label: 'Payer', sortable: true, filterType: 'multiselect' },
    { key: 'cpt', label: 'CPT', sortable: true, filterType: 'multiselect' },
    { key: 'payerType', label: 'Payer Type', sortable: true, filterType: 'multiselect' },
    { key: 'totalChgAmt', label: 'Total Chg Amt', sortable: true, filterType: 'number', cellClass: 'td-mono text-right', headerClass: 'text-right', render: (r) => fmt$(r.totalChgAmt), csvValue: (r) => r.totalChgAmt?.toFixed(2) },
    { key: 'payerRate', label: 'Payer Rate', sortable: true, filterType: 'number', cellClass: 'text-right', headerClass: 'text-right',
      render: (r) => { if (r.payerRate == null) return '—'; return <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>{r.payerRate < 0.02 && <span className="not-paying-badge">NOT PAYING</span>}<span className={getRateClass(r.payerRate, r.benchmark)}>{fmtRate(r.payerRate)}</span></span>; },
      csvValue: (r) => r.payerRate != null ? (r.payerRate * 100).toFixed(2) + '%' : '' },
    { key: 'benchmark', label: 'Benchmark (dollar-weighted)', sortable: true, filterType: 'number', cellClass: 'td-mono text-right', headerClass: 'text-right',
      render: (r) => r.benchmark == null ? <span className="insuf-data">Insufficient data</span> : fmtRate(r.benchmark),
      csvValue: (r) => r.benchmark != null ? (r.benchmark * 100).toFixed(2) + '%' : 'Insufficient data' },
    { key: 'gapPct', label: 'Gap %', sortable: true, filterType: 'number', cellClass: 'td-mono text-right', headerClass: 'text-right',
      render: (r) => { if (r.gapPct == null) return '—'; const cls = r.gapPct >= 0 ? 'rate-green' : r.gapPct >= -15 ? 'rate-yellow' : r.gapPct >= -40 ? 'rate-orange' : 'rate-red'; return <span className={cls}>{r.gapPct >= 0 ? '+' : ''}{Math.round(r.gapPct)}%</span>; },
      csvValue: (r) => r.gapPct != null ? r.gapPct.toFixed(2) + '%' : '' },
    { key: 'dollarImpact', label: 'Dollar Impact', sortable: true, filterType: 'number', cellClass: 'td-mono text-right', headerClass: 'text-right',
      render: (r) => <span style={{ color: r.dollarImpact > 0 ? 'var(--danger)' : 'var(--text-muted)' }}>{fmt$(r.dollarImpact)}</span>,
      csvValue: (r) => r.dollarImpact?.toFixed(2) },
    { key: 'flag', label: 'Flag', sortable: true, cellClass: 'text-center', headerClass: 'text-center',
      render: (r) => r.benchmark == null ? <span className="badge badge-gray">—</span> : <span className={`badge ${getRateBadgeClass(r.payerRate, r.benchmark)}`}>{r.flag ? '⚑ Flag' : r.payerRate < 0.02 ? '⚑ NP' : '✓ OK'}</span>,
      csvValue: (r) => r.flag ? 'FLAGGED' : r.payerRate < 0.02 ? 'NOT PAYING' : 'OK' },
  ];

  if (filteredData.length === 0) return <div className="empty-state"><div className="empty-icon">📊</div><p>No data matches the current filters.</p></div>;

  const flaggedCount = stats.filter((r) => r.flag).length;
  const notPayingCount = stats.filter((r) => r.payerRate != null && r.payerRate < 0.02).length;
  const totalImpact = stats.reduce((s, r) => s + r.dollarImpact, 0);

  return (
    <div className="section-gap">
      <InfoBox>
        <strong>Underpayment Analysis</strong> — Payment rate is calculated as total insurance payments divided by total charges for each payer+CPT combination (dollar-weighted). The benchmark is the overall dollar-weighted rate for that CPT across all payers in the filtered dataset. <strong>Click any row</strong> to see how this payer ranks vs all others for that CPT.
      </InfoBox>

      <div className="panel">
        <div className="panel-body" style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <div className="control-group">
            <label>Benchmark Method:</label>
            <div className="toggle-group">
              <button className={benchmarkMethod === 'mean' ? 'active' : ''} onClick={() => onBenchmarkMethodChange('mean')}>Mean</button>
              <button className={benchmarkMethod === 'median' ? 'active' : ''} onClick={() => onBenchmarkMethodChange('median')}>Median</button>
            </div>
          </div>
          <div className="control-group">
            <label>Flag threshold (% below benchmark):</label>
            <div className="threshold-input">
              <input type="number" min={0} max={100} value={threshold} onChange={(e) => setThreshold(Math.max(0, Math.min(100, Number(e.target.value))))} />
              <span>%</span>
            </div>
          </div>
        </div>
      </div>

      <div className="summary-row">
        <div className="summary-item"><div className="si-label">Flagged Combos</div><div className="si-value" style={{ color: flaggedCount > 0 ? 'var(--danger)' : 'var(--success)' }}>{flaggedCount}</div></div>
        <div className="summary-item"><div className="si-label">Not Paying (&lt;2%)</div><div className="si-value" style={{ color: notPayingCount > 0 ? 'var(--danger)' : 'var(--success)' }}>{notPayingCount}</div></div>
        <div className="summary-item"><div className="si-label">Total Dollar Impact</div><div className="si-value" style={{ color: totalImpact > 0 ? 'var(--danger)' : 'var(--success)' }}>{fmt$(totalImpact)}</div></div>
        <div className="summary-item"><div className="si-label">CPT Benchmarks Available</div><div className="si-value">{Object.keys(benchmarks).length}</div></div>
      </div>

      <div className="panel">
        <div className="panel-body" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 12 }}>
          <span><span className="badge badge-green">Green</span> ≥ benchmark</span>
          <span><span className="badge badge-yellow">Yellow</span> 85–100% of benchmark</span>
          <span><span className="badge badge-orange">Orange</span> 60–85% of benchmark</span>
          <span><span className="badge badge-red">Red</span> &lt; 60% of benchmark</span>
          <span><span className="not-paying-badge">NOT PAYING</span> Payer rate &lt; 2%</span>
        </div>
      </div>

      <SortableTable columns={columns} data={stats} pageSize={25} exportFilename="underpayment_analysis.csv" emptyMessage="No payer/CPT combinations found in filtered data." onRowClick={setDrillRow} />

      {drillRow && (
        <DrillDownPanel title={`${drillRow.payer} — CPT ${drillRow.cpt}`} subtitle="Underpayment Detail" onClose={() => setDrillRow(null)}>
          <UnderpaymentDrillDown row={drillRow} filteredData={filteredData} />
        </DrillDownPanel>
      )}
    </div>
  );
}
