import React, { useMemo, useState } from 'react';
import { calculateLocationComparison, fmt } from '../../utils/calculations.js';
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

function VarianceBar({ variance }) {
  const pct = Math.min(variance * 100, 100);
  const color = pct < 10 ? 'var(--success)' : pct < 25 ? 'var(--warning)' : 'var(--danger)';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 8, background: '#e2e8f0', borderRadius: 4, overflow: 'hidden', maxWidth: 80 }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 4 }} />
      </div>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color }}>{fmtRate(variance)}</span>
    </div>
  );
}

function LocationDrillDown({ row, filteredData }) {
  const stateRows = useMemo(() => {
    const byState = {};
    for (const r of filteredData) {
      if (r.PrimIns !== row.payer || r.CPTCode !== row.cpt) continue;
      const state = r.Location_State || '(Unknown)';
      if (!byState[state]) byState[state] = { state, chgAmt: 0, insPmt: 0 };
      byState[state].chgAmt += fmt(r.ChgAmt);
      byState[state].insPmt += fmt(r.InsPmtAmt);
    }
    return Object.values(byState)
      .map(s => ({ ...s, rate: s.chgAmt > 0 ? s.insPmt / s.chgAmt : 0 }))
      .sort((a, b) => b.rate - a.rate);
  }, [row, filteredData]);

  const bestRate = stateRows.length > 0 ? stateRows[0].rate : 0;
  const totalChg = stateRows.reduce((s, r) => s + r.chgAmt, 0);

  return (
    <>
      <div>
        <div className="drill-section-title">Summary</div>
        <div className="drill-kpis">
          <div className="drill-kpi"><div className="drill-kpi-label">Payer</div><div className="drill-kpi-value" style={{ fontSize: 13 }}>{row.payer}</div></div>
          <div className="drill-kpi"><div className="drill-kpi-label">CPT Code</div><div className="drill-kpi-value">{row.cpt}</div></div>
          <div className="drill-kpi"><div className="drill-kpi-label">Rate Variance</div><div className="drill-kpi-value" style={{ color: row.variance > 0.25 ? 'var(--danger)' : row.variance > 0.1 ? 'var(--warning)' : 'var(--success)' }}>{fmtRate(row.variance)}</div></div>
          <div className="drill-kpi"><div className="drill-kpi-label">States</div><div className="drill-kpi-value">{row.stateCount}</div></div>
        </div>
      </div>
      <div>
        <div className="drill-section-title">Rate by State</div>
        <table className="drill-mini-table">
          <thead><tr><th>State</th><th className="r">Total Chg</th><th className="r">Ins Pmt</th><th className="r">Rate</th><th className="r">vs Best</th><th className="r">Dollar Gap</th></tr></thead>
          <tbody>
            {stateRows.map(s => {
              const ppDiff = s.rate - bestRate;
              const dollarGap = (bestRate - s.rate) * s.chgAmt;
              return (
                <tr key={s.state}>
                  <td><strong>{s.state}</strong></td>
                  <td className="r">{fmt$(s.chgAmt)}</td>
                  <td className="r">{fmt$(s.insPmt)}</td>
                  <td className="r"><span className={s.rate === bestRate ? 'rate-green' : 'rate-red'}>{fmtRate(s.rate)}</span></td>
                  <td className="r" style={{ color: ppDiff < 0 ? 'var(--danger)' : 'var(--success)', fontSize: 12 }}>{ppDiff >= 0 ? '+' : ''}{(ppDiff * 100).toFixed(1)} pp</td>
                  <td className="r" style={{ color: dollarGap > 0 ? 'var(--danger)' : 'inherit' }}>{dollarGap > 0 ? `-${fmt$(dollarGap)}` : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

export default function LocationComparisonTab({ filteredData }) {
  const [drillRow, setDrillRow] = useState(null);
  const comparisons = useMemo(() => calculateLocationComparison(filteredData), [filteredData]);

  const columns = [
    { key: 'payer', label: 'Payer', sortable: true, filterType: 'multiselect' },
    { key: 'cpt', label: 'CPT', sortable: true, filterType: 'multiselect' },
    {
      key: 'states',
      label: 'States',
      sortable: false,
      filterType: 'text',
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
      filterType: 'number',
      cellClass: 'td-mono text-right',
      headerClass: 'text-right',
    },
    {
      key: 'minRate',
      label: 'Min Rate',
      sortable: true,
      filterType: 'number',
      cellClass: 'td-mono text-right',
      headerClass: 'text-right',
      render: (r) => <span className="rate-red">{fmtRate(r.minRate)}</span>,
      csvValue: (r) => r.minRate != null ? (r.minRate * 100).toFixed(2) + '%' : '',
    },
    {
      key: 'maxRate',
      label: 'Max Rate',
      sortable: true,
      filterType: 'number',
      cellClass: 'td-mono text-right',
      headerClass: 'text-right',
      render: (r) => <span className="rate-green">{fmtRate(r.maxRate)}</span>,
      csvValue: (r) => r.maxRate != null ? (r.maxRate * 100).toFixed(2) + '%' : '',
    },
    {
      key: 'variance',
      label: 'Rate Variance',
      sortable: true,
      filterType: 'number',
      render: (r) => <VarianceBar variance={r.variance} />,
      csvValue: (r) => r.variance != null ? (r.variance * 100).toFixed(2) + '%' : '',
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
        <div className="empty-icon">🗺</div>
        <p>No data matches the current filters.</p>
      </div>
    );
  }

  const highVarianceCount = comparisons.filter((r) => r.variance > 0.1).length;

  return (
    <div className="section-gap">
      <InfoBox>
        <strong>Location / State Comparison</strong> — Shows the same payer+CPT combination across multiple states. A large rate variance between states suggests a contract issue at a specific location rather than systemic payer behavior. Only combinations appearing in 2+ states with at least $500 in total charges are shown.
      </InfoBox>

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
              {fmtRate(comparisons[0].variance)}
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
        onRowClick={setDrillRow}
      />

      {drillRow && (
        <DrillDownPanel
          title={`${drillRow.payer} — CPT ${drillRow.cpt}`}
          subtitle="Location Comparison — State-by-State Detail"
          onClose={() => setDrillRow(null)}
        >
          <LocationDrillDown row={drillRow} filteredData={filteredData} />
        </DrillDownPanel>
      )}
    </div>
  );
}
