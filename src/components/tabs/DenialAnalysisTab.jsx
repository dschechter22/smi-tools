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

function fmtPct(n, decimals = 1) {
  if (n == null) return '—';
  return `${n.toFixed(decimals)}%`;
}

export default function DenialAnalysisTab({ filteredData }) {
  const denialStats = useMemo(() => calculatePayerDenialStats(filteredData), [filteredData]);
  const topCodes = useMemo(() => calculateTopDenialCodes(filteredData), [filteredData]);

  // Top 20 payers by denial count for chart
  const chartData = useMemo(
    () =>
      denialStats
        .slice(0, 20)
        .map((p) => ({
          name: p.payer.length > 18 ? p.payer.slice(0, 18) + '…' : p.payer,
          fullName: p.payer,
          rate: parseFloat(p.denialRate.toFixed(1)),
        })),
    [denialStats]
  );

  const avgDenialRate = useMemo(() => {
    if (!denialStats.length) return 0;
    return denialStats.reduce((s, p) => s + p.denialRate, 0) / denialStats.length;
  }, [denialStats]);

  const totalClaims = useMemo(() => denialStats.reduce((s, p) => s + p.total, 0), [denialStats]);
  const totalDenied = useMemo(() => denialStats.reduce((s, p) => s + p.denied, 0), [denialStats]);
  const totalRedenied = useMemo(() => denialStats.reduce((s, p) => s + p.redenied, 0), [denialStats]);

  const payerColumns = [
    { key: 'payer', label: 'Payer', sortable: true },
    {
      key: 'total',
      label: 'Total Claims',
      sortable: true,
      cellClass: 'td-mono text-right',
      headerClass: 'text-right',
      render: (r) => r.total.toLocaleString(),
    },
    {
      key: 'denied',
      label: 'Denied',
      sortable: true,
      cellClass: 'td-mono text-right',
      headerClass: 'text-right',
      render: (r) => r.denied.toLocaleString(),
    },
    {
      key: 'denialRate',
      label: 'Denial Rate',
      sortable: true,
      cellClass: 'td-mono text-right',
      headerClass: 'text-right',
      render: (r) => {
        const cls = r.denialRate < 5 ? 'rate-green' : r.denialRate < 15 ? 'rate-yellow' : r.denialRate < 30 ? 'rate-orange' : 'rate-red';
        return <span className={cls}>{fmtPct(r.denialRate)}</span>;
      },
      csvValue: (r) => r.denialRate.toFixed(2) + '%',
    },
    {
      key: 'redenied',
      label: 'Re-denied',
      sortable: true,
      cellClass: 'td-mono text-right',
      headerClass: 'text-right',
      render: (r) => r.redenied.toLocaleString(),
    },
    {
      key: 'redenialRate',
      label: 'Re-denial Rate',
      sortable: true,
      cellClass: 'td-mono text-right',
      headerClass: 'text-right',
      render: (r) => {
        const cls = r.redenialRate < 5 ? 'rate-green' : r.redenialRate < 20 ? 'rate-yellow' : 'rate-orange';
        return <span className={cls}>{fmtPct(r.redenialRate)}</span>;
      },
      csvValue: (r) => r.redenialRate.toFixed(2) + '%',
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
      {/* Summary */}
      <div className="summary-row">
        <div className="summary-item">
          <div className="si-label">Total Claims</div>
          <div className="si-value">{totalClaims.toLocaleString()}</div>
        </div>
        <div className="summary-item">
          <div className="si-label">Denied Claims</div>
          <div className="si-value" style={{ color: totalDenied > 0 ? 'var(--danger)' : 'var(--success)' }}>
            {totalDenied.toLocaleString()}
          </div>
        </div>
        <div className="summary-item">
          <div className="si-label">Overall Denial Rate</div>
          <div className="si-value" style={{ color: totalClaims > 0 && (totalDenied / totalClaims) > 0.1 ? 'var(--danger)' : 'var(--success)' }}>
            {totalClaims > 0 ? fmtPct((totalDenied / totalClaims) * 100) : '—'}
          </div>
        </div>
        <div className="summary-item">
          <div className="si-label">Re-denied Claims</div>
          <div className="si-value" style={{ color: totalRedenied > 0 ? 'var(--orange)' : 'var(--success)' }}>
            {totalRedenied.toLocaleString()}
          </div>
        </div>
        <div className="summary-item">
          <div className="si-label">Avg Denial Rate (by payer)</div>
          <div className="si-value">{fmtPct(avgDenialRate)}</div>
        </div>
      </div>

      {/* Denial Rate Chart — Top 20 Payers */}
      {chartData.length > 0 && (
        <div className="chart-container">
          <div className="panel-header">
            <div className="panel-title">Denial Rate % — Top 20 Payers by Volume</div>
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
                        <div>Denial Rate: {d.value}%</div>
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
                  <th className="text-right">Count</th>
                  <th className="text-right">% of All Claims</th>
                </tr>
              </thead>
              <tbody>
                {topCodes.map((c, i) => (
                  <tr key={c.code}>
                    <td style={{ color: 'var(--text-muted)', width: 36 }}>{i + 1}</td>
                    <td><strong>{c.code}</strong></td>
                    <td className="td-mono text-right">{c.count.toLocaleString()}</td>
                    <td className="td-mono text-right">
                      <span className={c.pct > 10 ? 'rate-red' : c.pct > 5 ? 'rate-orange' : 'rate-yellow'}>
                        {fmtPct(c.pct)}
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
