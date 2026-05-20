import React, { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { calculatePatientInsuranceSplit } from '../../utils/calculations.js';
import SortableTable from '../SortableTable.jsx';

function fmt$(n) {
  if (n == null) return '—';
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

function fmtPct(n) {
  if (n == null) return '—';
  return `${n.toFixed(1)}%`;
}

export default function PatientInsuranceSplitTab({ filteredData }) {
  const splitData = useMemo(() => calculatePatientInsuranceSplit(filteredData), [filteredData]);

  // Top 20 payers by charge volume for the stacked bar chart
  // Sort by chgCt descending for chart
  const chartData = useMemo(() => {
    return [...splitData]
      .sort((a, b) => b.chgCt - a.chgCt)
      .slice(0, 20)
      .map((p) => ({
        name: p.payer.length > 16 ? p.payer.slice(0, 16) + '…' : p.payer,
        fullName: p.payer,
        InsPmt: p.totalInsPmt,
        PtPmt: p.totalPtPmt,
      }));
  }, [splitData]);

  const totalChgAmt = useMemo(() => splitData.reduce((s, p) => s + p.totalChgAmt, 0), [splitData]);
  const totalInsPmt = useMemo(() => splitData.reduce((s, p) => s + p.totalInsPmt, 0), [splitData]);
  const totalPtPmt = useMemo(() => splitData.reduce((s, p) => s + p.totalPtPmt, 0), [splitData]);
  const totalBalance = useMemo(() => splitData.reduce((s, p) => s + p.totalBalance, 0), [splitData]);
  const totalWriteoffs = useMemo(() => splitData.reduce((s, p) => s + p.impliedWriteoffs, 0), [splitData]);
  const overallPtPct = useMemo(() => {
    const total = totalInsPmt + totalPtPmt;
    return total > 0 ? (totalPtPmt / total) * 100 : 0;
  }, [totalInsPmt, totalPtPmt]);

  const columns = [
    { key: 'payer', label: 'Payer', sortable: true },
    {
      key: 'totalChgAmt',
      label: 'Total Charges',
      sortable: true,
      cellClass: 'td-mono text-right',
      headerClass: 'text-right',
      render: (r) => fmt$(r.totalChgAmt),
      csvValue: (r) => r.totalChgAmt?.toFixed(2),
    },
    {
      key: 'totalInsPmt',
      label: 'Ins Payment',
      sortable: true,
      cellClass: 'td-mono text-right',
      headerClass: 'text-right',
      render: (r) => <span style={{ color: 'var(--primary)' }}>{fmt$(r.totalInsPmt)}</span>,
      csvValue: (r) => r.totalInsPmt?.toFixed(2),
    },
    {
      key: 'totalPtPmt',
      label: 'Pt Payment',
      sortable: true,
      cellClass: 'td-mono text-right',
      headerClass: 'text-right',
      render: (r) => <span style={{ color: 'var(--orange)' }}>{fmt$(r.totalPtPmt)}</span>,
      csvValue: (r) => r.totalPtPmt?.toFixed(2),
    },
    {
      key: 'totalBalance',
      label: 'Balance',
      sortable: true,
      cellClass: 'td-mono text-right',
      headerClass: 'text-right',
      render: (r) => <span style={{ color: r.totalBalance > 0 ? 'var(--danger)' : 'inherit' }}>{fmt$(r.totalBalance)}</span>,
      csvValue: (r) => r.totalBalance?.toFixed(2),
    },
    {
      key: 'insPct',
      label: 'Ins %',
      sortable: true,
      cellClass: 'td-mono text-right',
      headerClass: 'text-right',
      render: (r) => <span className="rate-green">{fmtPct(r.insPct)}</span>,
      csvValue: (r) => r.insPct?.toFixed(2) + '%',
    },
    {
      key: 'ptPct',
      label: 'Pt %',
      sortable: true,
      cellClass: 'td-mono text-right',
      headerClass: 'text-right',
      render: (r) => {
        const cls = r.ptPct < 10 ? 'rate-green' : r.ptPct < 25 ? 'rate-yellow' : r.ptPct < 40 ? 'rate-orange' : 'rate-red';
        return <span className={cls}>{fmtPct(r.ptPct)}</span>;
      },
      csvValue: (r) => r.ptPct?.toFixed(2) + '%',
    },
    {
      key: 'impliedWriteoffs',
      label: 'Implied Write-offs',
      sortable: true,
      cellClass: 'td-mono text-right',
      headerClass: 'text-right',
      render: (r) => (
        <span style={{ color: r.impliedWriteoffs > 0 ? 'var(--danger)' : r.impliedWriteoffs < 0 ? 'var(--success)' : 'inherit' }}>
          {fmt$(r.impliedWriteoffs)}
        </span>
      ),
      csvValue: (r) => r.impliedWriteoffs?.toFixed(2),
    },
  ];

  if (filteredData.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon">💳</div>
        <p>No data matches the current filters.</p>
      </div>
    );
  }

  return (
    <div className="section-gap">
      {/* Explanation */}
      <div className="panel">
        <div className="panel-body">
          <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>
            <strong style={{ color: 'var(--text)' }}>Patient responsibility ratio</strong> = PtPmtAmt / (InsPmtAmt + PtPmtAmt) per payer. A high patient percentage may indicate cost-shifting or underpayment by the insurer. Table is sorted by patient % descending.
          </p>
        </div>
      </div>

      {/* Summary */}
      <div className="summary-row">
        <div className="summary-item">
          <div className="si-label">Total Charges</div>
          <div className="si-value">{fmt$(totalChgAmt)}</div>
        </div>
        <div className="summary-item">
          <div className="si-label">Total Ins Payments</div>
          <div className="si-value" style={{ color: 'var(--primary)' }}>{fmt$(totalInsPmt)}</div>
        </div>
        <div className="summary-item">
          <div className="si-label">Total Pt Payments</div>
          <div className="si-value" style={{ color: 'var(--orange)' }}>{fmt$(totalPtPmt)}</div>
        </div>
        <div className="summary-item">
          <div className="si-label">Total Balance</div>
          <div className="si-value" style={{ color: 'var(--danger)' }}>{fmt$(totalBalance)}</div>
        </div>
        <div className="summary-item">
          <div className="si-label">Implied Write-offs</div>
          <div className="si-value" style={{ color: totalWriteoffs > 0 ? 'var(--danger)' : 'inherit' }}>{fmt$(totalWriteoffs)}</div>
        </div>
        <div className="summary-item">
          <div className="si-label">Overall Pt %</div>
          <div className="si-value" style={{ color: overallPtPct > 25 ? 'var(--orange)' : 'inherit' }}>{fmtPct(overallPtPct)}</div>
        </div>
      </div>

      {/* Stacked Bar Chart */}
      {chartData.length > 0 && (
        <div className="chart-container">
          <div className="panel-header">
            <div className="panel-title">Top 20 Payers by Volume — Insurance vs Patient Payments</div>
          </div>
          <div className="panel-body">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData} margin={{ top: 8, right: 16, left: 10, bottom: 72 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 10 }}
                  angle={-40}
                  textAnchor="end"
                  interval={0}
                />
                <YAxis tick={{ fontSize: 11 }} width={80} tickFormatter={(v) => {
                  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
                  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
                  return `$${v}`;
                }} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0];
                    const insPmt = payload.find(p => p.dataKey === 'InsPmt')?.value || 0;
                    const ptPmt = payload.find(p => p.dataKey === 'PtPmt')?.value || 0;
                    const total = insPmt + ptPmt;
                    return (
                      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 6, padding: '8px 12px', fontSize: 12 }}>
                        <div style={{ fontWeight: 600, marginBottom: 4 }}>{d.payload.fullName}</div>
                        <div style={{ color: '#1e40af' }}>Ins: {fmt$(insPmt)} ({total > 0 ? ((insPmt / total) * 100).toFixed(1) : 0}%)</div>
                        <div style={{ color: '#c2410c' }}>Pt: {fmt$(ptPmt)} ({total > 0 ? ((ptPmt / total) * 100).toFixed(1) : 0}%)</div>
                      </div>
                    );
                  }}
                />
                <Legend verticalAlign="top" height={28} />
                <Bar dataKey="InsPmt" name="Insurance Payment" stackId="a" fill="#1e40af" />
                <Bar dataKey="PtPmt" name="Patient Payment" stackId="a" fill="#f97316" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="panel-header" style={{ background: 'var(--card)', borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0', border: '1px solid var(--border)', borderBottom: 'none', padding: '12px 16px' }}>
        <div className="panel-title">Patient vs Insurance Payment Split by Payer</div>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Sorted by Patient % (highest first)</span>
      </div>
      <SortableTable
        columns={columns}
        data={splitData}
        pageSize={25}
        exportFilename="patient_insurance_split.csv"
        emptyMessage="No payer data found."
      />
    </div>
  );
}
