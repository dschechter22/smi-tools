import React, { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { calculatePayerDenialStats, calculateTopDenialCodes } from '../../utils/calculations.js';
import SortableTable from '../SortableTable.jsx';

function fmt$(n) {
  if (n == null) return '—';
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

function fmtPct(n, decimals = 1) {
  if (n == null) return '—';
  return `${n.toFixed(decimals)}%`;
}

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

export default function DenialAnalysisTab({ filteredData }) {
  const denialStats = useMemo(() => calculatePayerDenialStats(filteredData), [filteredData]);
  const topCodes = useMemo(() => calculateTopDenialCodes(filteredData), [filteredData]);

  // Top 20 payers by denied dollar amount for chart
  const chartData = useMemo(
    () =>
      denialStats
        .slice(0, 20)
        .map((p) => ({
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
    { key: 'payer', label: 'Payer', sortable: true, filterType: 'text' },
    {
      key: 'totalChgAmt',
      label: 'Total Charged',
      sortable: true,
      filterType: 'number',
      cellClass: 'td-mono text-right',
      headerClass: 'text-right',
      render: (r) => fmt$(r.totalChgAmt),
      csvValue: (r) => r.totalChgAmt?.toFixed(2),
    },
    {
      key: 'deniedChgAmt',
      label: 'Denied $',
      sortable: true,
      filterType: 'number',
      cellClass: 'td-mono text-right',
      headerClass: 'text-right',
      render: (r) => <span style={{ color: r.deniedChgAmt > 0 ? 'var(--danger)' : 'inherit' }}>{fmt$(r.deniedChgAmt)}</span>,
      csvValue: (r) => r.deniedChgAmt?.toFixed(2),
    },
    {
      key: 'denialRateDollar',
      label: 'Denial Rate ($)',
      sortable: true,
      filterType: 'number',
      cellClass: 'td-mono text-right',
      headerClass: 'text-right',
      render: (r) => {
        const cls = r.denialRateDollar < 5 ? 'rate-green' : r.denialRateDollar < 15 ? 'rate-yellow' : r.denialRateDollar < 30 ? 'rate-orange' : 'rate-red';
        return <span className={cls}>{fmtPct(r.denialRateDollar)}</span>;
      },
      csvValue: (r) => r.denialRateDollar.toFixed(2) + '%',
    },
    {
      key: 'redenialRateDollar',
      label: 'Re-denial Rate',
      sortable: true,
      filterType: 'number',
      cellClass: 'td-mono text-right',
      headerClass: 'text-right',
      render: (r) => {
        const cls = r.redenialRateDollar < 5 ? 'rate-green' : r.redenialRateDollar < 20 ? 'rate-yellow' : 'rate-orange';
        return <span className={cls}>{fmtPct(r.redenialRateDollar)}</span>;
      },
      csvValue: (r) => r.redenialRateDollar.toFixed(2) + '%',
    },
    {
      key: 'top3Codes',
      label: 'Top 3 Denial Codes',
      sortable: false,
      render: (r) => <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{r.top3Codes}</span>,
    },
  ];

  if (filteredData.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon">🚫</div>
        <p>No data matches the current filters.</p>
      </div>
    );
  }

  return (
    <div className="section-gap">
      <InfoBox>
        <strong>Denial Analysis</strong> — Rates are calculated using charge dollars and claim counts (from the ChgCt column), not row counts. Each row in the source data may represent many claims with the same attributes. A payer with a 30% denial rate by dollars has 30 cents of every dollar charged being denied — a materially different problem than a payer with a high denial rate on low-dollar codes.
      </InfoBox>

      {/* Summary */}
      <div className="summary-row">
        <div className="summary-item">
          <div className="si-label">Total Charged</div>
          <div className="si-value">{fmt$(totalChgAmt)}</div>
        </div>
        <div className="summary-item">
          <div className="si-label">Denied $ Amount</div>
          <div className="si-value" style={{ color: totalDeniedAmt > 0 ? 'var(--danger)' : 'var(--success)' }}>
            {fmt$(totalDeniedAmt)}
          </div>
        </div>
        <div className="summary-item">
          <div className="si-label">Overall Denial Rate ($)</div>
          <div className="si-value" style={{ color: totalChgAmt > 0 && (totalDeniedAmt / totalChgAmt) > 0.1 ? 'var(--danger)' : 'var(--success)' }}>
            {totalChgAmt > 0 ? fmtPct((totalDeniedAmt / totalChgAmt) * 100) : '—'}
          </div>
        </div>
        <div className="summary-item">
          <div className="si-label">Re-denied $ Amount</div>
          <div className="si-value" style={{ color: totalRedeniedAmt > 0 ? 'var(--orange)' : 'var(--success)' }}>
            {fmt$(totalRedeniedAmt)}
          </div>
        </div>
        <div className="summary-item">
          <div className="si-label">Avg Denial Rate $ (by payer)</div>
          <div className="si-value">{fmtPct(avgDenialRate)}</div>
        </div>
      </div>

      {/* Denial Rate Chart — Top 20 Payers */}
      {chartData.length > 0 && (
        <div className="chart-container">
          <div className="panel-header">
            <div className="panel-title">Denial Rate % (by $) — Top 20 Payers by Denied Amount</div>
          </div>
          <div className="panel-body">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 72 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 10 }}
                  angle={-40}
                  textAnchor="end"
                  interval={0}
                />
                <YAxis
                  tick={{ fontSize: 11 }}
                  width={45}
                  tickFormatter={(v) => `${v}%`}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0];
                    return (
                      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 6, padding: '8px 12px', fontSize: 12 }}>
                        <div style={{ fontWeight: 600 }}>{d.payload.fullName}</div>
                        <div>Denial Rate ($): {d.value}%</div>
                      </div>
                    );
                  }}
                />
                <ReferenceLine
                  y={parseFloat(avgDenialRate.toFixed(1))}
                  stroke="#b45309"
                  strokeDasharray="4 2"
                  label={{ value: `Avg ${avgDenialRate.toFixed(1)}%`, fontSize: 11, fill: '#b45309', position: 'right' }}
                />
                <Bar
                  dataKey="rate"
                  fill="#1e40af"
                  radius={[3, 3, 0, 0]}
                  label={false}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Top 10 Denial Codes */}
      <div className="panel">
        <div className="panel-header">
          <div className="panel-title">Top 10 Overall Denial Codes</div>
        </div>
        <div className="panel-body no-pad">
          {topCodes.length === 0 ? (
            <div className="empty-state"><p>No denial codes in data.</p></div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Denial Code</th>
                  <th className="text-right">Denied $</th>
                  <th className="text-right">% of Total Charged</th>
                </tr>
              </thead>
              <tbody>
                {topCodes.map((c, i) => (
                  <tr key={c.code}>
                    <td style={{ color: 'var(--text-muted)', width: 36 }}>{i + 1}</td>
                    <td><strong>{c.code}</strong></td>
                    <td className="td-mono text-right">{fmt$(c.chgAmt)}</td>
                    <td className="td-mono text-right">
                      <span className={c.pctOfTotal > 10 ? 'rate-red' : c.pctOfTotal > 5 ? 'rate-orange' : 'rate-yellow'}>
                        {fmtPct(c.pctOfTotal)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Full Payer Denial Table */}
      <div className="panel-header" style={{ background: 'var(--card)', borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0', border: '1px solid var(--border)', borderBottom: 'none', padding: '12px 16px' }}>
        <div className="panel-title">Payer Denial Summary</div>
      </div>
      <SortableTable
        columns={payerColumns}
        data={denialStats}
        pageSize={25}
        exportFilename="denial_analysis.csv"
        emptyMessage="No denial data found."
      />
    </div>
  );
}
