import React, { useMemo } from 'react';
import { calculateLocationComparison } from '../../utils/calculations.js';
import SortableTable from '../SortableTable.jsx';

function fmtPct(n) {
  if (n == null) return '—';
  return `${(n * 100).toFixed(1)}%`;
}

function fmt$(n) {
  if (n == null) return '—';
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

function VarianceBar({ variance }) {
  const pct = Math.min(variance * 100, 100);
  const color = pct < 10 ? 'var(--success)' : pct < 25 ? 'var(--warning)' : 'var(--danger)';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 8, background: '#e2e8f0', borderRadius: 4, overflow: 'hidden', maxWidth: 80 }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 4 }} />
      </div>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color }}>{fmtPct(variance)}</span>
    </div>
  );
}

export default function LocationComparisonTab({ filteredData }) {
  const comparisons = useMemo(() => calculateLocationComparison(filteredData), [filteredData]);

  const columns = [
    { key: 'payer', label: 'Payer', sortable: true },
    { key: 'cpt', label: 'CPT', sortable: true },
    {
      key: 'states',
      label: 'States',
      sortable: false,
      render: (r) => (
        <span style={{ fontSize: 12 }}>
          {r.states.split(', ').map((s) => (
            <span key={s} className="badge badge-navy" style={{ marginRight: 3, marginBottom: 2, display: 'inline-block' }}>{s}</span>
          ))}
        </span>
      ),
    },
    {
      key: 'stateCount',
      label: '# States',
      sortable: true,
      cellClass: 'td-mono text-right',
      headerClass: 'text-right',
    },
    {
      key: 'minRate',
      label: 'Min Rate',
      sortable: true,
      cellClass: 'td-mono text-right',
      headerClass: 'text-right',
      render: (r) => <span className="rate-red">{fmtPct(r.minRate)}</span>,
      csvValue: (r) => r.minRate != null ? (r.minRate * 100).toFixed(2) + '%' : '',
    },
    {
      key: 'maxRate',
      label: 'Max Rate',
      sortable: true,
      cellClass: 'td-mono text-right',
      headerClass: 'text-right',
      render: (r) => <span className="rate-green">{fmtPct(r.maxRate)}</span>,
      csvValue: (r) => r.maxRate != null ? (r.maxRate * 100).toFixed(2) + '%' : '',
    },
    {
      key: 'variance',
      label: 'Rate Variance',
      sortable: true,
      render: (r) => <VarianceBar variance={r.variance} />,
      csvValue: (r) => r.variance != null ? (r.variance * 100).toFixed(2) + '%' : '',
    },
    {
      key: 'totalChgAmt',
      label: 'Total Chg Amt',
      sortable: true,
      cellClass: 'td-mono text-right',
      headerClass: 'text-right',
      render: (r) => fmt$(r.totalChgAmt),
      csvValue: (r) => r.totalChgAmt?.toFixed(2),
    },
    {
      key: 'totalChgCt',
      label: 'Total Chg Ct',
      sortable: true,
      cellClass: 'td-mono text-right',
      headerClass: 'text-right',
      render: (r) => r.totalChgCt.toLocaleString(),
    },
  ];

  if (filteredData.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon">🗺</div>
        <p>No data matches the current filters.</p>
      </div>
    );
  }

  const highVarianceCount = comparisons.filter((r) => r.variance > 0.1).length;

  return (
    <div className="section-gap">
      {/* Explanation */}
      <div className="panel">
        <div className="panel-body">
          <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>
            <strong style={{ color: 'var(--text)' }}>Location comparison</strong> shows payer/CPT combinations that appear in 2+ states (with at least 5 total charges). A high rate variance between states for the same payer and CPT code likely indicates a contract issue or credentialing problem at a specific location.
            Results are sorted by rate variance, highest first.
          </p>
        </div>
      </div>

      {/* Summary */}
      <div className="summary-row">
        <div className="summary-item">
          <div className="si-label">Cross-State Combos</div>
          <div className="si-value">{comparisons.length}</div>
        </div>
        <div className="summary-item">
          <div className="si-label">High Variance (&gt;10%)</div>
          <div className="si-value" style={{ color: highVarianceCount > 0 ? 'var(--danger)' : 'var(--success)' }}>
            {highVarianceCount}
          </div>
        </div>
        {comparisons.length > 0 && (
          <div className="summary-item">
            <div className="si-label">Highest Variance</div>
            <div className="si-value" style={{ color: 'var(--danger)' }}>
              {fmtPct(comparisons[0].variance)}
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="panel">
        <div className="panel-body" style={{ display: 'flex', gap: 16, fontSize: 12, flexWrap: 'wrap' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 16, height: 8, background: 'var(--success)', borderRadius: 4 }} />
            &lt; 10% variance — likely OK
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 16, height: 8, background: 'var(--warning)', borderRadius: 4 }} />
            10–25% variance — review recommended
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 16, height: 8, background: 'var(--danger)', borderRadius: 4 }} />
            &gt; 25% variance — potential contract issue
          </span>
        </div>
      </div>

      <SortableTable
        columns={columns}
        data={comparisons}
        pageSize={25}
        exportFilename="location_comparison.csv"
        emptyMessage="No payer/CPT combinations found in 2+ states with at least 5 charges. Ensure your data has Location_State populated."
      />
    </div>
  );
}
