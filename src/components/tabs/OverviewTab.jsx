import React, { useMemo } from 'react';
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
import { calculateOverviewStats } from '../../utils/calculations.js';

const STATUS_COLORS = {
  'Closed / Paid': '#15803d',
  'Closed / Not Paid': '#b91c1c',
  'Open / Paid': '#1e40af',
  'Open / Not Paid': '#b45309',
};

const INS_TYPE_COLORS = ['#1e40af', '#0e7490', '#6d28d9', '#b45309', '#065f46', '#9f1239', '#1e3a5f'];

function fmt$(n) {
  if (n == null) return '—';
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

function fmtPct(n) {
  return n != null ? `${(n * 100).toFixed(1)}%` : '—';
}

function StatCard({ label, value, sub, accent }) {
  return (
    <div className="stat-card" style={accent ? { borderTop: `3px solid ${accent}` } : {}}>
      <div className="card-label">{label}</div>
      <div className="card-value">{value}</div>
      {sub && <div className="card-sub">{sub}</div>}
    </div>
  );
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 6, padding: '8px 12px', fontSize: 12 }}>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{label}</div>
      {payload.map((p) => (
        <div key={p.name} style={{ color: p.fill || p.color }}>
          {p.name}: {typeof p.value === 'number' && p.name !== 'Count' ? fmt$(p.value) : p.value}
        </div>
      ))}
    </div>
  );
}

export default function OverviewTab({ filteredData }) {
  const stats = useMemo(() => calculateOverviewStats(filteredData), [filteredData]);

  const statusChartData = useMemo(
    () =>
      Object.entries(stats.statusCounts).map(([name, count]) => ({
        name,
        Count: count,
        fill: STATUS_COLORS[name] || '#6b7280',
      })),
    [stats.statusCounts]
  );

  const insTypeChartData = useMemo(
    () =>
      Object.entries(stats.insTypeCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([name, count], i) => ({ name, Count: count, fill: INS_TYPE_COLORS[i % INS_TYPE_COLORS.length] })),
    [stats.insTypeCounts]
  );

  const top5PayerData = useMemo(
    () => stats.top5Payers.map((p) => ({ name: p.payer.length > 20 ? p.payer.slice(0, 20) + '…' : p.payer, Balance: p.balance, fullName: p.payer })),
    [stats.top5Payers]
  );

  const top5DenialData = useMemo(
    () => stats.top5DenialCodes.map((d) => ({ name: d.code, Count: d.count })),
    [stats.top5DenialCodes]
  );

  if (filteredData.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon">📊</div>
        <p>No data matches the current filters.</p>
      </div>
    );
  }

  return (
    <div className="section-gap">
      {/* Summary Cards */}
      <div className="cards-grid">
        <StatCard label="Total Charges" value={fmt$(stats.totalChgAmt)} sub={`${stats.rowCount.toLocaleString()} rows`} accent="#1e40af" />
        <StatCard label="Ins Payments" value={fmt$(stats.totalInsPmt)} sub={`Rate: ${fmtPct(stats.overallPaymentRate)}`} accent="#15803d" />
        <StatCard label="Patient Payments" value={fmt$(stats.totalPtPmt)} accent="#0e7490" />
        <StatCard label="Total Balance" value={fmt$(stats.totalBalance)} accent="#b45309" />
        <StatCard
          label="Implied Write-offs"
          value={fmt$(stats.impliedWriteoffs)}
          sub="ChgAmt − InsPmt − PtPmt − Bal"
          accent="#b91c1c"
        />
        <StatCard label="Overall Pay Rate" value={fmtPct(stats.overallPaymentRate)} sub="InsPmt / ChgAmt" accent="#6d28d9" />
        <StatCard label="Unique Payers" value={stats.payerCount.toLocaleString()} accent="#1e40af" />
        <StatCard label="Unique CPT Codes" value={stats.cptCount.toLocaleString()} accent="#1e40af" />
      </div>

      {/* Charts Row */}
      <div className="charts-row">
        <div className="chart-container">
          <div className="panel-header">
            <div className="panel-title">Charge Status Breakdown</div>
          </div>
          <div className="panel-body">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={statusChartData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} tickFormatter={(v) => v.replace(' / ', '\n/ ')} />
                <YAxis tick={{ fontSize: 11 }} width={50} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="Count" radius={[3, 3, 0, 0]}>
                  {statusChartData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="chart-container">
          <div className="panel-header">
            <div className="panel-title">Payer Type Breakdown</div>
          </div>
          <div className="panel-body">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={insTypeChartData} margin={{ top: 4, right: 16, left: 0, bottom: 36 }} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: 11 }}
                  width={100}
                  tickFormatter={(v) => (v.length > 14 ? v.slice(0, 14) + '…' : v)}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="Count" radius={[0, 3, 3, 0]}>
                  {insTypeChartData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Top 5 Payers by Dollar Impact + Top 5 Denial Codes */}
      <div className="charts-row">
        <div className="chart-container">
          <div className="panel-header">
            <div className="panel-title">Top 5 Payers — Balance Outstanding</div>
          </div>
          <div className="panel-body">
            {top5PayerData.length === 0 ? (
              <div className="empty-state"><p>No data.</p></div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={top5PayerData} margin={{ top: 4, right: 16, left: 10, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} width={70} tickFormatter={(v) => fmt$(v)} />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0];
                      return (
                        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 6, padding: '8px 12px', fontSize: 12 }}>
                          <div style={{ fontWeight: 600 }}>{d.payload.fullName}</div>
                          <div>Balance: {fmt$(d.value)}</div>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="Balance" fill="#1e40af" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="chart-container">
          <div className="panel-header">
            <div className="panel-title">Top 5 First Denial Codes</div>
          </div>
          <div className="panel-body">
            {top5DenialData.length === 0 ? (
              <div className="empty-state"><p>No denial codes in data.</p></div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={top5DenialData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} width={50} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="Count" fill="#b91c1c" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
