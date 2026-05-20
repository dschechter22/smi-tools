import React, { useMemo } from 'react';
import { calculateReDenials } from '../../utils/calculations.js';
import SortableTable from '../SortableTable.jsx';

function fmt$(n) {
  if (n == null) return '—';
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

export default function ReDenialTab({ filteredData }) {
  const { rows, pathways, totalCount, totalExposure } = useMemo(
    () => calculateReDenials(filteredData),
    [filteredData]
  );

  const rowColumns = [
    { key: 'PrimIns', label: 'Payer', sortable: true },
    { key: 'CPTCode', label: 'CPT', sortable: true },
    {
      key: 'FirstDenialCode',
      label: '1st Denial Code',
      sortable: true,
      render: (r) => (
        <span>
          <span className="badge badge-yellow" style={{ marginRight: 4 }}>{r.FirstDenialCode}</span>
          {r.FirstDenialGroup && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{r.FirstDenialGroup}</span>}
        </span>
      ),
    },
    {
      key: 'LastDenialCode',
      label: 'Last Denial Code',
      sortable: true,
      render: (r) => (
        <span>
          <span className="badge badge-red" style={{ marginRight: 4 }}>{r.LastDenialCode}</span>
          {r.LastDenialGroup && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{r.LastDenialGroup}</span>}
        </span>
      ),
    },
    {
      key: 'ChgAmt',
      label: 'Charge Amt',
      sortable: true,
      cellClass: 'td-mono text-right',
      headerClass: 'text-right',
      render: (r) => fmt$(r.ChgAmt),
      csvValue: (r) => r.ChgAmt?.toFixed(2),
    },
    {
      key: 'Balance',
      label: 'Balance',
      sortable: true,
      cellClass: 'td-mono text-right',
      headerClass: 'text-right',
      render: (r) => <span style={{ color: r.Balance > 0 ? 'var(--danger)' : 'inherit' }}>{fmt$(r.Balance)}</span>,
      csvValue: (r) => r.Balance?.toFixed(2),
    },
    {
      key: 'ChgStatus',
      label: 'Status',
      sortable: true,
      render: (r) => {
        const cls =
          r.ChgStatus === 'Closed / Paid' ? 'badge-green'
          : r.ChgStatus === 'Closed / Not Paid' ? 'badge-red'
          : r.ChgStatus === 'Open / Paid' ? 'badge-navy'
          : r.ChgStatus === 'Open / Not Paid' ? 'badge-orange'
          : 'badge-gray';
        return <span className={`badge ${cls}`}>{r.ChgStatus || '—'}</span>;
      },
    },
  ];

  const pathwayColumns = [
    {
      key: 'pathway',
      label: 'Denial Pathway (1st → Last)',
      sortable: true,
      render: (r) => (
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>
          <span className="badge badge-yellow">{r.firstCode}</span>
          {r.firstGroup && <span style={{ color: 'var(--text-muted)', fontSize: 11, margin: '0 4px' }}>({r.firstGroup})</span>}
          <span style={{ margin: '0 6px', color: 'var(--text-muted)' }}>→</span>
          <span className="badge badge-red">{r.lastCode}</span>
          {r.lastGroup && <span style={{ color: 'var(--text-muted)', fontSize: 11, margin: '0 4px' }}>({r.lastGroup})</span>}
        </span>
      ),
      csvValue: (r) => r.pathway,
    },
    {
      key: 'count',
      label: 'Count',
      sortable: true,
      cellClass: 'td-mono text-right',
      headerClass: 'text-right',
      render: (r) => r.count.toLocaleString(),
    },
    {
      key: 'totalBalance',
      label: 'Total Balance',
      sortable: true,
      cellClass: 'td-mono text-right',
      headerClass: 'text-right',
      render: (r) => <span style={{ color: r.totalBalance > 0 ? 'var(--danger)' : 'inherit' }}>{fmt$(r.totalBalance)}</span>,
      csvValue: (r) => r.totalBalance?.toFixed(2),
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
  ];

  if (filteredData.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon">🔄</div>
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
            <strong style={{ color: 'var(--text)' }}>Re-denial</strong> occurs when a claim has both a first denial code and a last denial code, and they differ. This indicates the claim was worked (appealed or resubmitted) but denied again for a different reason — often a workflow or documentation problem.
          </p>
        </div>
      </div>

      {/* Summary */}
      <div className="summary-row">
        <div className="summary-item">
          <div className="si-label">Re-denied Claims</div>
          <div className="si-value" style={{ color: totalCount > 0 ? 'var(--danger)' : 'var(--success)' }}>
            {totalCount.toLocaleString()}
          </div>
        </div>
        <div className="summary-item">
          <div className="si-label">Dollar Exposure (Balance)</div>
          <div className="si-value" style={{ color: totalExposure > 0 ? 'var(--danger)' : 'var(--success)' }}>
            {fmt$(totalExposure)}
          </div>
        </div>
        <div className="summary-item">
          <div className="si-label">Unique Pathways</div>
          <div className="si-value">{pathways.length.toLocaleString()}</div>
        </div>
        <div className="summary-item">
          <div className="si-label">% of Total Claims</div>
          <div className="si-value">
            {filteredData.length > 0
              ? `${((totalCount / filteredData.length) * 100).toFixed(1)}%`
              : '—'}
          </div>
        </div>
      </div>

      {/* Pathway Summary Table */}
      {pathways.length > 0 && (
        <>
          <div className="panel-header" style={{ background: 'var(--card)', borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0', border: '1px solid var(--border)', borderBottom: 'none', padding: '12px 16px' }}>
            <div className="panel-title">Most Common Re-denial Pathways</div>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{pathways.length} unique pathways</span>
          </div>
          <SortableTable
            columns={pathwayColumns}
            data={pathways}
            pageSize={25}
            exportFilename="redenial_pathways.csv"
            emptyMessage="No pathways found."
          />
        </>
      )}

      {/* Individual Re-denied Claims */}
      {rows.length > 0 && (
        <>
          <div className="panel-header" style={{ background: 'var(--card)', borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0', border: '1px solid var(--border)', borderBottom: 'none', padding: '12px 16px' }}>
            <div className="panel-title">Individual Re-denied Claims</div>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{rows.length} claims</span>
          </div>
          <SortableTable
            columns={rowColumns}
            data={rows}
            pageSize={25}
            exportFilename="redenial_claims.csv"
            emptyMessage="No re-denied claims found."
          />
        </>
      )}

      {totalCount === 0 && (
        <div className="empty-state">
          <div className="empty-icon">✓</div>
          <p>No re-denial patterns detected in the filtered data.</p>
        </div>
      )}
    </div>
  );
}
