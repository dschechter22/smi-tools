import React, { useMemo } from 'react';
import { calculateReDenials } from '../../utils/calculations.js';
import SortableTable from '../SortableTable.jsx';
import { fmt$ } from '../../utils/format.js';

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

export default function ReDenialTab({ filteredData }) {
  const { rows, pathways, totalCount, totalExposure } = useMemo(
    () => calculateReDenials(filteredData),
    [filteredData]
  );

  const rowColumns = [
    { key: 'PrimIns', label: 'Payer', sortable: true, filterType: 'multiselect' },
    { key: 'CPTCode', label: 'CPT', sortable: true, filterType: 'multiselect' },
    {
      key: 'FirstDenialCode',
      label: '1st Denial Code',
      sortable: true,
      filterType: 'multiselect',
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
      filterType: 'multiselect',
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
      filterType: 'number',
      cellClass: 'td-mono text-right',
      headerClass: 'text-right',
      render: (r) => fmt$(r.ChgAmt),
      csvValue: (r) => r.ChgAmt?.toFixed(2),
    },
    {
      key: 'Balance',
      label: 'Balance',
      sortable: true,
      filterType: 'number',
      cellClass: 'td-mono text-right',
      headerClass: 'text-right',
      render: (r) => <span style={{ color: r.Balance > 0 ? 'var(--danger)' : 'inherit' }}>{fmt$(r.Balance)}</span>,
      csvValue: (r) => r.Balance?.toFixed(2),
    },
    {
      key: 'ChgStatus',
      label: 'Status',
      sortable: true,
      filterType: 'multiselect',
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
      filterType: 'text',
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
      key: 'totalChgAmt',
      label: 'Total Chg Amt',
      sortable: true,
      filterType: 'number',
      cellClass: 'td-mono text-right',
      headerClass: 'text-right',
      render: (r) => fmt$(r.totalChgAmt),
      csvValue: (r) => r.totalChgAmt?.toFixed(2),
    },
    {
      key: 'totalBalance',
      label: 'Total Balance',
      sortable: true,
      filterType: 'number',
      cellClass: 'td-mono text-right',
      headerClass: 'text-right',
      render: (r) => <span style={{ color: r.totalBalance > 0 ? 'var(--danger)' : 'inherit' }}>{fmt$(r.totalBalance)}</span>,
      csvValue: (r) => r.totalBalance?.toFixed(2),
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
      <InfoBox>
        <strong>Re-denial Tracking</strong> — Only rows where the <em>first</em> denial code is a true denial are included. A re-denial occurs when FirstDenialCode ≠ LastDenialCode, meaning the claim was worked but denied again. The pathway summary groups by transition (e.g., 503 → 461) to surface systemic patterns. All volumes are measured in charge dollars.
      </InfoBox>

      {/* Summary */}
      <div className="summary-row">
        <div className="summary-item">
          <div className="si-label">Re-denied Buckets</div>
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
          <div className="si-label">% of Total Buckets</div>
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

      {/* Individual Re-denied Buckets */}
      {rows.length > 0 && (
        <>
          <div className="panel-header" style={{ background: 'var(--card)', borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0', border: '1px solid var(--border)', borderBottom: 'none', padding: '12px 16px' }}>
            <div className="panel-title">Individual Re-denied Buckets</div>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{rows.length} buckets</span>
          </div>
          <SortableTable
            columns={rowColumns}
            data={rows}
            pageSize={25}
            exportFilename="redenial_claims.csv"
            emptyMessage="No re-denied buckets found."
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
