import React, { useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { buildBucketBreakdown, buildKeyBreakdown, STANDARD_BUCKET_ORDER } from '../../utils/atbCalculations.js';
import SortableTable from '../SortableTable.jsx';
import DrillDownPanel from '../DrillDownPanel.jsx';
import { fmt$, fmtPct } from '../../utils/format.js';

const UNBILLED_BUCKET_ORDER = ['0-2', '3-5', '6-10', '11-15', '16-30', '31-60', '61+'];

const AGING_COLUMNS = [
  { key: 'bucket', label: 'DOS Bucket', filterType: 'text' },
  { key: 'balance', label: 'Balance', filterType: 'number', render: (r) => fmt$(r.balance) },
  { key: 'count', label: 'Claims', filterType: 'number' },
  { key: 'pct', label: '% of Unbilled', filterType: 'number', render: (r) => fmtPct(r.pct) },
];

const TIER_COLUMNS = [
  { key: 'tier', label: 'Dollar Tier', filterType: 'text' },
  { key: 'balance', label: 'Balance', filterType: 'number', render: (r) => fmt$(r.balance) },
  { key: 'count', label: 'Claims', filterType: 'number' },
];

const CARRIER_COLUMNS = [
  { key: 'carrier', label: 'Carrier', filterType: 'text' },
  { key: 'balance', label: 'Balance', filterType: 'number', render: (r) => fmt$(r.balance) },
  { key: 'count', label: 'Claims', filterType: 'number' },
  { key: 'avgDosAge', label: 'Avg DOS Age', filterType: 'number', render: (r) => r.avgDosAge != null ? `${r.avgDosAge}d` : '—' },
];

const CPT_COLUMNS = [
  { key: 'cpt', label: 'CPT Code', filterType: 'text' },
  { key: 'balance', label: 'Balance', filterType: 'number', render: (r) => fmt$(r.balance) },
  { key: 'count', label: 'Claims', filterType: 'number' },
];

const DRILL_COLUMNS = [
  {
    key: '_status',
    label: 'Status',
    filterType: 'multiselect',
    render: (r) => <span className="badge badge-navy">{r._status}</span>,
  },
  { key: '_carrier', label: 'Carrier', filterType: 'text' },
  { key: 'InsurancePlanDescription', label: 'Plan', filterType: 'text' },
  { key: 'CPTCode', label: 'CPT', filterType: 'text' },
  {
    key: '_balance',
    label: 'Balance',
    filterType: 'number',
    render: (r) => <span style={{ color: 'var(--danger)' }}>{fmt$(r._balance)}</span>,
  },
  {
    key: '_dosAge',
    label: 'DOS Age',
    filterType: 'number',
    render: (r) => r._dosAge != null ? `${r._dosAge}d` : '—',
  },
  { key: '_unbilledDosBucket', label: 'Unbilled Bucket', filterType: 'multiselect' },
  { key: '$ Tier', label: '$ Tier', filterType: 'multiselect' },
  { key: 'Location State', label: 'State', filterType: 'multiselect' },
];

export default function UnbilledTab({ filteredData, totalData }) {
  const [drillRow, setDrillRow] = useState(null);
  const [drillType, setDrillType] = useState(null);

  const unbilledRows = useMemo(
    () => (filteredData || []).filter((r) => r._isUnbilled),
    [filteredData]
  );

  const kpis = useMemo(() => {
    const balance = unbilledRows.reduce((s, r) => s + r._balance, 0);
    const count = unbilledRows.length;
    const dosAgeRows = unbilledRows.filter((r) => r._dosAge != null);
    const avgDosAge = dosAgeRows.length > 0
      ? Math.round(dosAgeRows.reduce((s, r) => s + r._dosAge, 0) / dosAgeRows.length)
      : null;
    const totalBalance = (totalData || []).reduce((s, r) => s + r._balance, 0);
    const pctOfTotal = totalBalance > 0 ? (balance / totalBalance) * 100 : null;
    const avgBalance = count > 0 ? balance / count : null;
    return { balance, count, avgDosAge, pctOfTotal, avgBalance };
  }, [unbilledRows, totalData]);

  const agingData = useMemo(
    () => buildBucketBreakdown(unbilledRows, '_unbilledDosBucket', UNBILLED_BUCKET_ORDER),
    [unbilledRows]
  );

  const tierData = useMemo(
    () => buildKeyBreakdown(unbilledRows, (r) => r['$ Tier'], 'tier'),
    [unbilledRows]
  );

  const carrierData = useMemo(() => {
    const map = {};
    for (const r of unbilledRows) {
      const c = r._carrier || '(Unknown)';
      if (!map[c]) map[c] = { carrier: c, balance: 0, count: 0, dosAgeSum: 0, dosAgeCount: 0 };
      map[c].balance += r._balance;
      map[c].count++;
      if (r._dosAge != null) {
        map[c].dosAgeSum += r._dosAge;
        map[c].dosAgeCount++;
      }
    }
    return Object.values(map)
      .map((g) => ({
        carrier: g.carrier,
        balance: g.balance,
        count: g.count,
        avgDosAge: g.dosAgeCount > 0 ? Math.round(g.dosAgeSum / g.dosAgeCount) : null,
      }))
      .sort((a, b) => b.balance - a.balance);
  }, [unbilledRows]);

  const cptData = useMemo(
    () => buildKeyBreakdown(unbilledRows, (r) => r.CPTCode, 'cpt'),
    [unbilledRows]
  );

  const drillClaims = useMemo(() => {
    if (!drillRow || !drillType) return [];
    switch (drillType) {
      case 'bucket': return unbilledRows.filter((r) => r._unbilledDosBucket === drillRow.bucket);
      case 'tier': return unbilledRows.filter((r) => r['$ Tier'] === drillRow.tier);
      case 'carrier': return unbilledRows.filter((r) => r._carrier === drillRow.carrier);
      case 'cpt': return unbilledRows.filter((r) => r.CPTCode === drillRow.cpt);
      default: return [];
    }
  }, [drillRow, drillType, unbilledRows]);

  const drillKpis = useMemo(() => {
    const balance = drillClaims.reduce((s, r) => s + r._balance, 0);
    const count = drillClaims.length;
    const dosAgeRows = drillClaims.filter((r) => r._dosAge != null);
    const avgDosAge = dosAgeRows.length > 0
      ? Math.round(dosAgeRows.reduce((s, r) => s + r._dosAge, 0) / dosAgeRows.length)
      : null;
    return { balance, count, avgDosAge };
  }, [drillClaims]);

  const drillTitle = useMemo(() => {
    if (!drillRow || !drillType) return '';
    switch (drillType) {
      case 'bucket': return drillRow.bucket;
      case 'tier': return drillRow.tier;
      case 'carrier': return drillRow.carrier;
      case 'cpt': return drillRow.cpt;
      default: return '';
    }
  }, [drillRow, drillType]);

  const handleCloseDrill = () => {
    setDrillRow(null);
    setDrillType(null);
  };

  if (unbilledRows.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon">✓</div>
        <p>No unbilled claims in the current filter.</p>
      </div>
    );
  }

  return (
    <div className="section-gap">
      <div className="panel">
        <div className="panel-header">
          <span className="panel-title">Unbilled AR Summary</span>
        </div>
        <div className="summary-row">
          <div className="summary-item" style={{ borderTop: '3px solid var(--danger)' }}>
            <div className="card-label">Total Unbilled Balance</div>
            <div className="card-value" style={{ color: 'var(--danger)' }}>{fmt$(kpis.balance)}</div>
          </div>
          <div className="summary-item">
            <div className="card-label">Claim Count</div>
            <div className="card-value">{kpis.count.toLocaleString()}</div>
          </div>
          <div className="summary-item">
            <div className="card-label">Avg DOS Age</div>
            <div className="card-value">{kpis.avgDosAge != null ? `${kpis.avgDosAge}d` : '—'}</div>
          </div>
          <div className="summary-item">
            <div className="card-label">% of Total AR</div>
            <div className="card-value">{fmtPct(kpis.pctOfTotal)}</div>
          </div>
          <div className="summary-item">
            <div className="card-label">Avg Balance / Claim</div>
            <div className="card-value">{fmt$(kpis.avgBalance)}</div>
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <span className="panel-title">Unbilled DOS Aging</span>
        </div>
        <div className="panel-body">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={agingData} margin={{ top: 4, right: 16, left: 16, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="bucket" tick={{ fontSize: 12 }} />
              <YAxis tickFormatter={fmt$} tick={{ fontSize: 12 }} width={64} />
              <Tooltip
                formatter={(value) => [fmt$(value), 'Balance']}
                contentStyle={{ fontSize: 12 }}
              />
              <Bar dataKey="balance" fill="#1e40af" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <SortableTable
          columns={AGING_COLUMNS}
          data={agingData}
          exportFilename="unbilled-aging.csv"
          onRowClick={(row) => { setDrillRow(row); setDrillType('bucket'); }}
        />
      </div>

      <div className="panel">
        <div className="panel-header">
          <span className="panel-title">Balance Tiers</span>
        </div>
        <SortableTable
          columns={TIER_COLUMNS}
          data={tierData}
          exportFilename="unbilled-tiers.csv"
          onRowClick={(row) => { setDrillRow(row); setDrillType('tier'); }}
        />
      </div>

      <div className="panel">
        <div className="panel-header">
          <span className="panel-title">Payer Breakdown</span>
        </div>
        <SortableTable
          columns={CARRIER_COLUMNS}
          data={carrierData}
          exportFilename="unbilled-carriers.csv"
          onRowClick={(row) => { setDrillRow(row); setDrillType('carrier'); }}
        />
      </div>

      <div className="panel">
        <div className="panel-header">
          <span className="panel-title">CPT / Modality Mix</span>
        </div>
        <SortableTable
          columns={CPT_COLUMNS}
          data={cptData}
          exportFilename="unbilled-cpt.csv"
          onRowClick={(row) => { setDrillRow(row); setDrillType('cpt'); }}
        />
      </div>

      {drillRow && drillType && (
        <DrillDownPanel title={drillTitle} onClose={handleCloseDrill}>
          <div className="summary-row" style={{ marginBottom: 16 }}>
            <div className="summary-item">
              <div className="card-label">Balance</div>
              <div className="card-value" style={{ color: 'var(--danger)' }}>{fmt$(drillKpis.balance)}</div>
            </div>
            <div className="summary-item">
              <div className="card-label">Claims</div>
              <div className="card-value">{drillKpis.count.toLocaleString()}</div>
            </div>
            <div className="summary-item">
              <div className="card-label">Avg DOS Age</div>
              <div className="card-value">{drillKpis.avgDosAge != null ? `${drillKpis.avgDosAge}d` : '—'}</div>
            </div>
          </div>
          <SortableTable
            columns={DRILL_COLUMNS}
            data={drillClaims}
            exportFilename="unbilled-drill.csv"
            pageSize={50}
          />
        </DrillDownPanel>
      )}
    </div>
  );
}
