import React, { useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { calculatePayerDenialStats, calculateTopDenialCodes, isTrueDenial, fmt } from '../../utils/calculations.js';
import SortableTable from '../SortableTable.jsx';
import DrillDownPanel from '../DrillDownPanel.jsx';
import { fmt$, fmtPct } from '../../utils/format.js';

function InfoBox({ children }) {
  return (
    <div style={{ background: '#e6f2fa', border: '1px solid #a8d4ed', borderLeft: '4px solid #0073bb', borderRadius: 6, padding: '12px 16px', fontSize: 13, color: '#16191f', lineHeight: 1.6 }}>
      {children}
    </div>
  );
}

function DenialDrillDown({ row, filteredData }) {
  const cptRows = useMemo(() => {
    const groups = {};
    for (const r of filteredData) {
      if (r.PrimIns !== row.payer) continue;
      const cpt = r.CPTCode || '(Unknown)';
      if (!groups[cpt]) groups[cpt] = { cpt, totalChgAmt: 0, deniedChgAmt: 0 };
      groups[cpt].totalChgAmt += fmt(r.ChgAmt);
      if (isTrueDenial(r.FirstDenialCode)) groups[cpt].deniedChgAmt += fmt(r.ChgAmt);
    }
    return Object.values(groups)
      .map(g => ({ ...g, denialRate: g.totalChgAmt > 0 ? (g.deniedChgAmt / g.totalChgAmt) * 100 : 0 }))
      .sort((a, b) => b.deniedChgAmt - a.deniedChgAmt)
      .slice(0, 15);
  }, [row, filteredData]);

  const codeRows = useMemo(() => {
    const codes = {};
    for (const r of filteredData) {
      if (r.PrimIns !== row.payer || !isTrueDenial(r.FirstDenialCode)) continue;
      const code = r.FirstDenialCode.trim();
      if (!codes[code]) codes[code] = { code, group: r.FirstDenialGroup || '', amt: 0 };
      codes[code].amt += fmt(r.ChgAmt);
    }
    return Object.values(codes)
      .sort((a, b) => b.amt - a.amt)
      .slice(0, 10)
      .map(c => ({ ...c, pct: row.deniedChgAmt > 0 ? (c.amt / row.deniedChgAmt) * 100 : 0 }));
  }, [row, filteredData]);

  return (
    <>
      <div>
        <div className="drill-section-title">Summary</div>
        <div className="drill-kpis">
          <div className="drill-kpi"><div className="drill-kpi-label">Total Charged</div><div className="drill-kpi-value">{fmt$(row.totalChgAmt)}</div></div>
          <div className="drill-kpi"><div className="drill-kpi-label">Denied $</div><div className="drill-kpi-value" style={{ color: 'var(--danger)' }}>{fmt$(row.deniedChgAmt)}</div></div>
          <div className="drill-kpi"><div className="drill-kpi-label">Denial Rate</div><div className="drill-kpi-value" style={{ color: row.denialRateDollar > 15 ? 'var(--danger)' : 'var(--success)' }}>{fmtPct(row.denialRateDollar)}</div></div>
          <div className="drill-kpi"><div className="drill-kpi-label">Re-denial Rate</div><div className="drill-kpi-value" style={{ color: row.redenialRateDollar > 10 ? 'var(--orange)' : 'inherit' }}>{fmtPct(row.redenialRateDollar)}</div></div>
        </div>
      </div>
      <div>
        <div className="drill-section-title">Top CPTs by Denied Dollars</div>
        <table className="drill-mini-table">
          <thead><tr><th>CPT</th><th className="r">Total Chg</th><th className="r">Denied $</th><th className="r">Denial Rate</th></tr></thead>
          <tbody>
            {cptRows.map(r => (
              <tr key={r.cpt}>
                <td><strong>{r.cpt}</strong></td>
                <td className="r">{fmt$(r.totalChgAmt)}</td>
                <td className="r" style={{ color: r.deniedChgAmt > 0 ? 'var(--danger)' : 'inherit' }}>{fmt$(r.deniedChgAmt)}</td>
                <td className="r"><span className={r.denialRate > 30 ? 'rate-red' : r.denialRate > 15 ? 'rate-orange' : r.denialRate > 5 ? 'rate-yellow' : 'rate-green'}>{fmtPct(r.denialRate)}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div>
        <div className="drill-section-title">Top Denial Codes</div>
        <table className="drill-mini-table">
          <thead><tr><th>Code</th><th>Group</th><th className="r">Denied $</th><th className="r">% of Denials</th></tr></thead>
          <tbody>
            {codeRows.map(r => (
              <tr key={r.code}>
                <td><span className="badge badge-red">{r.code}</span></td>
                <td style={{ color: 'var(--text-muted)', fontSize: 11 }}>{r.group || '—'}</td>
                <td className="r">{fmt$(r.amt)}</td>
                <td className="r">{fmtPct(r.pct)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export default function DenialAnalysisTab({ filteredData }) {
  const [drillRow, setDrillRow] = useState(null);
  const denialStats = useMemo(() => calculatePayerDenialStats(filteredData), [filteredData]);
  const topCodes = useMemo(() => calculateTopDenialCodes(filteredData), [filteredData]);

  const chartData = useMemo(() =>
    denialStats.slice(0, 20).map((p) => ({
      name: p.payer.length > 18 ? p.payer.slice(0, 18) + '…' : p.payer,
      fullName: p.payer,
      rate: parseFloat(p.denialRateDollar.toFixed(1)),
    })),
    [denialStats]
  );

  const avgDenialRate = useMemo(() => {
    if (!denialStats.length) return 0;
    return denialStats.reduce((s, p) => s + p.denialRateDollar, 0) / denialStats.length;
  }, [denialStats]);

  const totalChgAmt = useMemo(() => denialStats.reduce((s, p) => s + p.totalChgAmt, 0), [denialStats]);
  const totalDeniedAmt = useMemo(() => denialStats.reduce((s, p) => s + p.deniedChgAmt, 0), [denialStats]);
  const totalRedeniedAmt = useMemo(() => denialStats.reduce((s, p) => s + p.redeniedChgAmt, 0), [denialStats]);

  const payerColumns = [
    { key: 'payer', label: 'Payer', sortable: true, filterType: 'multiselect' },
    { key: 'totalChgAmt', label: 'Total Charged', sortable: true, filterType: 'number', cellClass: 'td-mono text-right', headerClass: 'text-right', render: (r) => fmt$(r.totalChgAmt), csvValue: (r) => r.totalChgAmt?.toFixed(2) },
    { key: 'deniedChgAmt', label: 'Denied $', sortable: true, filterType: 'number', cellClass: 'td-mono text-right', headerClass: 'text-right', render: (r) => <span style={{ color: r.deniedChgAmt > 0 ? 'var(--danger)' : 'inherit' }}>{fmt$(r.deniedChgAmt)}</span>, csvValue: (r) => r.deniedChgAmt?.toFixed(2) },
    { key: 'denialRateDollar', label: 'Denial Rate ($)', sortable: true, filterType: 'number', cellClass: 'td-mono text-right', headerClass: 'text-right', render: (r) => { const cls = r.denialRateDollar < 5 ? 'rate-green' : r.denialRateDollar < 15 ? 'rate-yellow' : r.denialRateDollar < 30 ? 'rate-orange' : 'rate-red'; return <span className={cls}>{fmtPct(r.denialRateDollar)}</span>; }, csvValue: (r) => r.denialRateDollar.toFixed(2) + '%' },
    { key: 'redenialRateDollar', label: 'Re-denial Rate', sortable: true, filterType: 'number', cellClass: 'td-mono text-right', headerClass: 'text-right', render: (r) => { const cls = r.redenialRateDollar < 5 ? 'rate-green' : r.redenialRateDollar < 20 ? 'rate-yellow' : 'rate-orange'; return <span className={cls}>{fmtPct(r.redenialRateDollar)}</span>; }, csvValue: (r) => r.redenialRateDollar.toFixed(2) + '%' },
    { key: 'top3Codes', label: 'Top 3 Denial Codes', sortable: false, filterType: 'text', render: (r) => <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{r.top3Codes}</span> },
  ];

  if (filteredData.length === 0) return <div className="empty-state"><div className="empty-icon">🚫</div><p>No data matches the current filters.</p></div>;

  return (
    <div className="section-gap">
      <InfoBox>
        <strong>Denial Analysis</strong> — Only <strong>true denials</strong> (1,028 mapped codes) are counted toward denial rates and dollar amounts. Non-denial adjustments (e.g. contractual, informational) are excluded. Rates use charge dollars — a 30% denial rate means 30 cents of every dollar charged was truly denied. <strong>Click any row</strong> to drill into CPT and code-level details.
      </InfoBox>

      <div className="summary-row">
        <div className="summary-item"><div className="si-label">Total Charged</div><div className="si-value">{fmt$(totalChgAmt)}</div></div>
        <div className="summary-item"><div className="si-label">Denied $ Amount</div><div className="si-value" style={{ color: totalDeniedAmt > 0 ? 'var(--danger)' : 'var(--success)' }}>{fmt$(totalDeniedAmt)}</div></div>
        <div className="summary-item"><div className="si-label">Overall Denial Rate ($)</div><div className="si-value" style={{ color: totalChgAmt > 0 && (totalDeniedAmt / totalChgAmt) > 0.1 ? 'var(--danger)' : 'var(--success)' }}>{totalChgAmt > 0 ? fmtPct((totalDeniedAmt / totalChgAmt) * 100) : '—'}</div></div>
        <div className="summary-item"><div className="si-label">Re-denied $ Amount</div><div className="si-value" style={{ color: totalRedeniedAmt > 0 ? 'var(--orange)' : 'var(--success)' }}>{fmt$(totalRedeniedAmt)}</div></div>
        <div className="summary-item"><div className="si-label">Avg Denial Rate $ (by payer)</div><div className="si-value">{fmtPct(avgDenialRate)}</div></div>
      </div>

      {chartData.length > 0 && (
        <div className="chart-container">
          <div className="panel-header"><div className="panel-title">Denial Rate % (by $) — Top 20 Payers by Denied Amount</div></div>
          <div className="panel-body">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 72 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-40} textAnchor="end" interval={0} />
                <YAxis tick={{ fontSize: 11 }} width={45} tickFormatter={(v) => `${v}%`} />
                <Tooltip content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0];
                  return <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 6, padding: '8px 12px', fontSize: 12 }}><div style={{ fontWeight: 600 }}>{d.payload.fullName}</div><div>Denial Rate ($): {d.value}%</div></div>;
                }} />
                <ReferenceLine y={parseFloat(avgDenialRate.toFixed(1))} stroke="#b45309" strokeDasharray="4 2" label={{ value: `Avg ${Math.round(avgDenialRate)}%`, fontSize: 11, fill: '#b45309', position: 'right' }} />
                <Bar dataKey="rate" fill="#1e40af" radius={[3, 3, 0, 0]} label={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="panel">
        <div className="panel-header"><div className="panel-title">Top 10 Overall Denial Codes</div></div>
        <div className="panel-body no-pad">
          {topCodes.length === 0 ? <div className="empty-state"><p>No denial codes in data.</p></div> : (
            <table><thead><tr><th>#</th><th>Denial Code</th><th className="text-right">Denied $</th><th className="text-right">% of Total Charged</th></tr></thead>
              <tbody>{topCodes.map((c, i) => (
                <tr key={c.code}>
                  <td style={{ color: 'var(--text-muted)', width: 36 }}>{i + 1}</td>
                  <td><strong>{c.code}</strong></td>
                  <td className="td-mono text-right">{fmt$(c.chgAmt)}</td>
                  <td className="td-mono text-right"><span className={c.pctOfTotal > 10 ? 'rate-red' : c.pctOfTotal > 5 ? 'rate-orange' : 'rate-yellow'}>{fmtPct(c.pctOfTotal)}</span></td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </div>
      </div>

      <div className="panel-header" style={{ background: 'var(--card)', borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0', border: '1px solid var(--border)', borderBottom: 'none', padding: '12px 16px' }}>
        <div className="panel-title">Payer Denial Summary</div>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Click a row to drill down</span>
      </div>
      <SortableTable columns={payerColumns} data={denialStats} pageSize={25} exportFilename="denial_analysis.csv" emptyMessage="No denial data found." onRowClick={setDrillRow} />

      {drillRow && (
        <DrillDownPanel title={drillRow.payer} subtitle="Denial Analysis — Payer Detail" onClose={() => setDrillRow(null)}>
          <DenialDrillDown row={drillRow} filteredData={filteredData} />
        </DrillDownPanel>
      )}
    </div>
  );
}
