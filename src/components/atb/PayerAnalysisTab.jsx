import React, { useMemo, useState } from 'react';
import {
  buildPlanBreakdown,
  buildPlanAging,
  buildPlanDenialProfile,
  buildStateBreakdown,
  hasDenialCode,
} from '../../utils/atbCalculations.js';
import SortableTable from '../SortableTable.jsx';
import DrillAnalyticsPanel from './DrillAnalyticsPanel.jsx';
import { fmt$, fmtPct } from '../../utils/format.js';

// ── Module-level column definitions ───────────────────────────────────────────

const PLAN_BREAKDOWN_COLS = [
  { key: 'plan', label: 'Plan', sortable: true, filterType: 'text' },
  { key: 'carrier', label: 'Carrier', sortable: true, filterType: 'text' },
  {
    key: 'balance', label: 'Balance', sortable: true, filterType: 'number',
    cellClass: 'td-mono text-right', headerClass: 'text-right',
    render: (r) => <span style={{ color: 'var(--danger)', fontWeight: 700 }}>{fmt$(r.balance)}</span>,
    csvValue: (r) => r.balance?.toFixed(2),
  },
  { key: 'count', label: 'Claims', sortable: true, filterType: 'number', cellClass: 'td-mono text-right', headerClass: 'text-right' },
  {
    key: 'unbilledBal', label: 'Unbilled', sortable: true, filterType: 'number',
    cellClass: 'td-mono text-right', headerClass: 'text-right',
    render: (r) => fmt$(r.unbilledBal), csvValue: (r) => r.unbilledBal?.toFixed(2),
  },
  {
    key: 'unrespondedBal', label: 'Unresponded', sortable: true, filterType: 'number',
    cellClass: 'td-mono text-right', headerClass: 'text-right',
    render: (r) => fmt$(r.unrespondedBal), csvValue: (r) => r.unrespondedBal?.toFixed(2),
  },
  {
    key: 'respondedBal', label: 'Responded', sortable: true, filterType: 'number',
    cellClass: 'td-mono text-right', headerClass: 'text-right',
    render: (r) => fmt$(r.respondedBal), csvValue: (r) => r.respondedBal?.toFixed(2),
  },
  {
    key: 'deniedBal', label: 'Denied', sortable: true, filterType: 'number',
    cellClass: 'td-mono text-right', headerClass: 'text-right',
    render: (r) => fmt$(r.deniedBal), csvValue: (r) => r.deniedBal?.toFixed(2),
  },
];

const PLAN_AGING_COLS = [
  { key: 'plan', label: 'Plan', sortable: true, filterType: 'text' },
  {
    key: 'balance', label: 'Balance', sortable: true, filterType: 'number',
    cellClass: 'td-mono text-right', headerClass: 'text-right',
    render: (r) => fmt$(r.balance), csvValue: (r) => r.balance?.toFixed(2),
  },
  { key: 'count', label: 'Claims', sortable: true, filterType: 'number', cellClass: 'td-mono text-right', headerClass: 'text-right' },
  {
    key: 'avgDosAge', label: 'Avg DOS Age', sortable: true, filterType: 'number',
    cellClass: 'td-mono text-right', headerClass: 'text-right',
    render: (r) => r.avgDosAge != null ? `${r.avgDosAge}d` : '—',
    csvValue: (r) => r.avgDosAge ?? '',
  },
  {
    key: 'avgInitFileAge', label: 'Avg Init File Age', sortable: true, filterType: 'number',
    cellClass: 'td-mono text-right', headerClass: 'text-right',
    render: (r) => r.avgInitFileAge != null ? `${r.avgInitFileAge}d` : '—',
    csvValue: (r) => r.avgInitFileAge ?? '',
  },
  {
    key: 'avgMadAge', label: 'Avg MAD Age', sortable: true, filterType: 'number',
    cellClass: 'td-mono text-right', headerClass: 'text-right',
    render: (r) => r.avgMadAge != null ? `${r.avgMadAge}d` : '—',
    csvValue: (r) => r.avgMadAge ?? '',
  },
];

const PLAN_DENIAL_COLS = [
  { key: 'plan', label: 'Plan', sortable: true, filterType: 'text' },
  {
    key: 'balance', label: 'Denied Balance', sortable: true, filterType: 'number',
    cellClass: 'td-mono text-right', headerClass: 'text-right',
    render: (r) => <span style={{ color: 'var(--danger)', fontWeight: 700 }}>{fmt$(r.balance)}</span>,
    csvValue: (r) => r.balance?.toFixed(2),
  },
  { key: 'count', label: 'Claims', sortable: true, filterType: 'number', cellClass: 'td-mono text-right', headerClass: 'text-right' },
  {
    key: 'topCode', label: 'Top Code', sortable: true, filterType: 'text',
    render: (r) => r.topCode
      ? <span className="badge badge-yellow">{r.topCode}</span>
      : '—',
  },
  {
    key: 'denialRate', label: 'Denial Rate', sortable: true, filterType: 'number',
    cellClass: 'td-mono text-right', headerClass: 'text-right',
    render: (r) => r.denialRate != null ? `${r.denialRate.toFixed(1)}%` : '—',
    csvValue: (r) => r.denialRate != null ? r.denialRate.toFixed(2) + '%' : '',
  },
];

const STATE_BREAKDOWN_COLS = [
  { key: 'state', label: 'State', sortable: true, filterType: 'text' },
  {
    key: 'balance', label: 'Balance', sortable: true, filterType: 'number',
    cellClass: 'td-mono text-right', headerClass: 'text-right',
    render: (r) => fmt$(r.balance), csvValue: (r) => r.balance?.toFixed(2),
  },
  { key: 'count', label: 'Claims', sortable: true, filterType: 'number', cellClass: 'td-mono text-right', headerClass: 'text-right' },
  { key: 'carrierCount', label: 'Carriers', sortable: true, filterType: 'number', cellClass: 'td-mono text-right', headerClass: 'text-right' },
];

const DRILL_CLAIM_COLS = [
  {
    key: '_status', label: 'Status', sortable: true, filterType: 'multiselect',
    render: (r) => {
      if (r._status === 'Unbilled') return <span className="badge badge-navy">Unbilled</span>;
      if (r._status === 'Unresponded') return <span className="badge badge-orange">Unresponded</span>;
      return <span className="badge badge-green">Responded</span>;
    },
  },
  { key: '_carrier', label: 'Carrier', sortable: true, filterType: 'text' },
  { key: 'CPTCode', label: 'CPT', sortable: true, filterType: 'text' },
  {
    key: '_balance', label: 'Balance', sortable: true, filterType: 'number',
    cellClass: 'td-mono text-right', headerClass: 'text-right',
    render: (r) => <span style={{ color: 'var(--danger)', fontWeight: 700 }}>{fmt$(r._balance)}</span>,
    csvValue: (r) => r._balance?.toFixed(2),
  },
  { key: '_dosBucket', label: 'DOS Bucket', sortable: true, filterType: 'multiselect' },
  { key: 'MAD Aging Bucket', label: 'MAD Bucket', sortable: true, filterType: 'multiselect' },
  {
    key: 'FirstDenialCode', label: '1st Denial', sortable: true, filterType: 'text',
    render: (r) => r.FirstDenialCode && String(r.FirstDenialCode).trim()
      ? <span className="badge badge-yellow">{r.FirstDenialCode}</span>
      : '—',
  },
];

// Chip button style helpers
const chipStyle = (active) => ({
  padding: '4px 10px',
  fontSize: 12,
  borderRadius: 4,
  cursor: 'pointer',
  border: active ? '1px solid var(--primary)' : '1px solid var(--border)',
  background: active ? 'var(--primary)' : 'var(--card)',
  color: active ? '#fff' : 'var(--text)',
  lineHeight: 1.4,
  whiteSpace: 'nowrap',
});

// ── ChipSelector ──────────────────────────────────────────────────────────────
// An inline chip-toggle multi-select with optional search (shown when > 10 options)

function ChipSelector({ label, options, selected, onChange }) {
  const [search, setSearch] = useState('');
  const showSearch = options.length > 10;

  const visible = showSearch && search.trim()
    ? options.filter((o) => o.toLowerCase().includes(search.trim().toLowerCase()))
    : options;

  const isAllSelected = selected.length === 0;

  const toggle = (val) => {
    if (selected.includes(val)) {
      onChange(selected.filter((v) => v !== val));
    } else {
      onChange([...selected, val]);
    }
  };

  const clearAll = () => onChange([]);

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
          {label}
        </span>
        {selected.length > 0 && (
          <span style={{ fontSize: 11, color: 'var(--primary)', fontWeight: 600 }}>
            {selected.length} selected
          </span>
        )}
        <button
          type="button"
          onClick={() => onChange([...options])}
          style={{ fontSize: 11, color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px' }}
        >
          Select all
        </button>
        {selected.length > 0 && (
          <button
            type="button"
            onClick={clearAll}
            style={{ fontSize: 11, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px' }}
          >
            Clear
          </button>
        )}
      </div>
      {showSearch && (
        <input
          type="text"
          placeholder={`Search ${label.toLowerCase()}…`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            width: '100%', maxWidth: 280, padding: '4px 8px', fontSize: 12,
            border: '1px solid var(--border)', borderRadius: 4,
            background: 'var(--card)', color: 'var(--text)', marginBottom: 6,
          }}
        />
      )}
      <div className="filter-chips-row" style={{ flexWrap: 'wrap', gap: 6 }}>
        <button
          type="button"
          style={chipStyle(isAllSelected)}
          onClick={clearAll}
        >
          All {label}
        </button>
        {visible.map((opt) => (
          <button
            key={opt}
            type="button"
            style={chipStyle(selected.includes(opt))}
            onClick={() => toggle(opt)}
            title={opt}
          >
            {opt.length > 28 ? opt.slice(0, 26) + '…' : opt}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── KPI helpers ───────────────────────────────────────────────────────────────

function kpisFromRows(rows) {
  let totalBalance = 0;
  let unbilledBalance = 0;
  let deniedBalance = 0;
  let unrespondedBalance = 0;
  const planSet = new Set();

  for (const row of rows) {
    totalBalance += row._balance;
    if (row._isUnbilled) unbilledBalance += row._balance;
    if (hasDenialCode(row)) deniedBalance += row._balance;
    if (row._status === 'Unresponded') unrespondedBalance += row._balance;
    if (row.InsurancePlanDescription) planSet.add(String(row.InsurancePlanDescription).trim());
  }

  return {
    totalBalance,
    unbilledBalance,
    deniedBalance,
    unrespondedBalance,
    claimCount: rows.length,
    uniquePlans: planSet.size,
  };
}

function agingKpisFromRows(rows) {
  let dosSum = 0, dosN = 0;
  let madSum = 0, madN = 0;
  let initSum = 0, initN = 0;

  for (const row of rows) {
    if (row._dosAge != null) { dosSum += row._dosAge; dosN++; }
    const mad = parseFloat(row['MAD Age']);
    if (!isNaN(mad)) { madSum += mad; madN++; }
    if (row._initialFileDateAge != null) { initSum += row._initialFileDateAge; initN++; }
  }

  return {
    avgDosAge: dosN > 0 ? Math.round(dosSum / dosN) : null,
    avgMadAge: madN > 0 ? Math.round(madSum / madN) : null,
    avgInitFileAge: initN > 0 ? Math.round(initSum / initN) : null,
  };
}

// State carrier breakdown for drill
function buildStateCarrierBreakdown(stateRows) {
  const map = {};
  for (const row of stateRows) {
    const c = row._carrier || '(Unknown)';
    if (!map[c]) map[c] = { carrier: c, balance: 0, count: 0 };
    map[c].balance += row._balance;
    map[c].count++;
  }
  return Object.values(map).sort((a, b) => b.balance - a.balance);
}

// Denial code breakdown for drill
function buildDrillDenialCodeBreakdown(denialRows) {
  let total = 0;
  const map = {};
  for (const row of denialRows) {
    const code = String(row.FirstDenialCode || '').trim();
    if (!code) continue;
    if (!map[code]) map[code] = { code, balance: 0, count: 0 };
    map[code].balance += row._balance;
    map[code].count++;
    total += row._balance;
  }
  return Object.values(map)
    .map((c) => ({ ...c, pct: total > 0 ? (c.balance / total) * 100 : 0 }))
    .sort((a, b) => b.balance - a.balance);
}

const STATE_CARRIER_COLS = [
  { key: 'carrier', label: 'Carrier', sortable: true, filterType: 'text' },
  {
    key: 'balance', label: 'Balance', sortable: true, filterType: 'number',
    cellClass: 'td-mono text-right', headerClass: 'text-right',
    render: (r) => fmt$(r.balance), csvValue: (r) => r.balance?.toFixed(2),
  },
  { key: 'count', label: 'Claims', sortable: true, filterType: 'number', cellClass: 'td-mono text-right', headerClass: 'text-right' },
];

const DENIAL_CODE_BREAKDOWN_COLS = [
  {
    key: 'code', label: 'Code', sortable: true, filterType: 'text',
    render: (r) => <span className="badge badge-red">{r.code}</span>,
  },
  {
    key: 'balance', label: 'Balance', sortable: true, filterType: 'number',
    cellClass: 'td-mono text-right', headerClass: 'text-right',
    render: (r) => <span style={{ color: 'var(--danger)' }}>{fmt$(r.balance)}</span>,
    csvValue: (r) => r.balance?.toFixed(2),
  },
  { key: 'count', label: 'Claims', sortable: true, filterType: 'number', cellClass: 'td-mono text-right', headerClass: 'text-right' },
  {
    key: 'pct', label: '% of Plan Denials', sortable: true, filterType: 'number',
    cellClass: 'td-mono text-right', headerClass: 'text-right',
    render: (r) => fmtPct(r.pct), csvValue: (r) => r.pct?.toFixed(2) + '%',
  },
];

// ── Drill-Down content ─────────────────────────────────────────────────────────

function DrillPlanContent({ drillRow, selectedData }) {
  const planRows = useMemo(
    () => selectedData.filter((r) => String(r.InsurancePlanDescription || '').trim() === drillRow.plan || (drillRow.plan === '(Unknown)' && !String(r.InsurancePlanDescription || '').trim())),
    [drillRow.plan, selectedData]
  );

  const kpis = useMemo(() => kpisFromRows(planRows), [planRows]);

  return (
    <div className="section-gap">
      <div className="summary-row">
        <div className="summary-item">
          <div className="si-label">Total Balance</div>
          <div className="si-value" style={{ color: 'var(--danger)' }}>{fmt$(kpis.totalBalance)}</div>
        </div>
        <div className="summary-item">
          <div className="si-label">Unbilled</div>
          <div className="si-value">{fmt$(kpis.unbilledBalance)}</div>
        </div>
        <div className="summary-item">
          <div className="si-label">Denied</div>
          <div className="si-value" style={{ color: 'var(--danger)' }}>{fmt$(kpis.deniedBalance)}</div>
        </div>
        <div className="summary-item">
          <div className="si-label">Unresponded</div>
          <div className="si-value" style={{ color: 'var(--orange)' }}>{fmt$(kpis.unrespondedBalance)}</div>
        </div>
        <div className="summary-item">
          <div className="si-label">Claims</div>
          <div className="si-value">{kpis.claimCount.toLocaleString()}</div>
        </div>
      </div>
      <div className="panel">
        <div className="panel-header">
          <span className="panel-title">Claim Detail</span>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{planRows.length.toLocaleString()} claims</span>
        </div>
        <SortableTable
          columns={DRILL_CLAIM_COLS}
          data={planRows}
          pageSize={50}
          exportFilename={`plan_${drillRow.plan}.csv`}
          emptyMessage="No claims."
        />
      </div>
    </div>
  );
}

function DrillPlanAgingContent({ drillRow, selectedData }) {
  const planRows = useMemo(
    () => selectedData.filter((r) => String(r.InsurancePlanDescription || '').trim() === drillRow.plan || (drillRow.plan === '(Unknown)' && !String(r.InsurancePlanDescription || '').trim())),
    [drillRow.plan, selectedData]
  );

  const aging = useMemo(() => agingKpisFromRows(planRows), [planRows]);
  const balance = useMemo(() => planRows.reduce((s, r) => s + r._balance, 0), [planRows]);

  return (
    <div className="section-gap">
      <div className="summary-row">
        <div className="summary-item">
          <div className="si-label">Balance</div>
          <div className="si-value">{fmt$(balance)}</div>
        </div>
        <div className="summary-item">
          <div className="si-label">Claims</div>
          <div className="si-value">{planRows.length.toLocaleString()}</div>
        </div>
        <div className="summary-item">
          <div className="si-label">Avg DOS Age</div>
          <div className="si-value">{aging.avgDosAge != null ? `${aging.avgDosAge}d` : '—'}</div>
        </div>
        <div className="summary-item">
          <div className="si-label">Avg MAD Age</div>
          <div className="si-value">{aging.avgMadAge != null ? `${aging.avgMadAge}d` : '—'}</div>
        </div>
        <div className="summary-item">
          <div className="si-label">Avg Init File Age</div>
          <div className="si-value">{aging.avgInitFileAge != null ? `${aging.avgInitFileAge}d` : '—'}</div>
        </div>
      </div>
      <div className="panel">
        <div className="panel-header">
          <span className="panel-title">Claim Detail — Aging</span>
        </div>
        <SortableTable
          columns={DRILL_CLAIM_COLS}
          data={planRows}
          pageSize={50}
          exportFilename={`plan_aging_${drillRow.plan}.csv`}
          emptyMessage="No claims."
        />
      </div>
    </div>
  );
}

function DrillPlanDenialContent({ drillRow, selectedData }) {
  const planRows = useMemo(
    () => selectedData.filter((r) => {
      const planMatch = String(r.InsurancePlanDescription || '').trim() === drillRow.plan || (drillRow.plan === '(Unknown)' && !String(r.InsurancePlanDescription || '').trim());
      return planMatch && hasDenialCode(r);
    }),
    [drillRow.plan, selectedData]
  );

  const codeBreakdown = useMemo(() => buildDrillDenialCodeBreakdown(planRows), [planRows]);
  const balance = useMemo(() => planRows.reduce((s, r) => s + r._balance, 0), [planRows]);

  return (
    <div className="section-gap">
      <div className="summary-row">
        <div className="summary-item">
          <div className="si-label">Denied Balance</div>
          <div className="si-value" style={{ color: 'var(--danger)' }}>{fmt$(balance)}</div>
        </div>
        <div className="summary-item">
          <div className="si-label">Denied Claims</div>
          <div className="si-value">{planRows.length.toLocaleString()}</div>
        </div>
        <div className="summary-item">
          <div className="si-label">Top Code</div>
          <div className="si-value">
            {drillRow.topCode
              ? <span className="badge badge-yellow">{drillRow.topCode}</span>
              : '—'}
          </div>
        </div>
        <div className="summary-item">
          <div className="si-label">Denial Rate</div>
          <div className="si-value" style={{ color: 'var(--danger)' }}>
            {drillRow.denialRate != null ? `${drillRow.denialRate.toFixed(1)}%` : '—'}
          </div>
        </div>
      </div>
      {codeBreakdown.length > 0 && (
        <div className="panel">
          <div className="panel-header">
            <span className="panel-title">Denial Code Breakdown</span>
          </div>
          <SortableTable
            columns={DENIAL_CODE_BREAKDOWN_COLS}
            data={codeBreakdown}
            pageSize={15}
            exportFilename={`plan_denial_codes_${drillRow.plan}.csv`}
            emptyMessage="No denial codes."
          />
        </div>
      )}
      <div className="panel">
        <div className="panel-header">
          <span className="panel-title">Denied Claims</span>
        </div>
        <SortableTable
          columns={DRILL_CLAIM_COLS}
          data={planRows}
          pageSize={50}
          exportFilename={`plan_denials_${drillRow.plan}.csv`}
          emptyMessage="No denied claims."
        />
      </div>
    </div>
  );
}

function DrillStateContent({ drillRow, selectedData }) {
  const stateRows = useMemo(
    () => selectedData.filter((r) => String(r['Location State'] || '').trim() === drillRow.state || (drillRow.state === '(Unknown)' && !String(r['Location State'] || '').trim())),
    [drillRow.state, selectedData]
  );

  const kpis = useMemo(() => kpisFromRows(stateRows), [stateRows]);
  const carrierBreakdown = useMemo(() => buildStateCarrierBreakdown(stateRows), [stateRows]);

  return (
    <div className="section-gap">
      <div className="summary-row">
        <div className="summary-item">
          <div className="si-label">Total Balance</div>
          <div className="si-value">{fmt$(kpis.totalBalance)}</div>
        </div>
        <div className="summary-item">
          <div className="si-label">Unbilled</div>
          <div className="si-value">{fmt$(kpis.unbilledBalance)}</div>
        </div>
        <div className="summary-item">
          <div className="si-label">Denied</div>
          <div className="si-value" style={{ color: 'var(--danger)' }}>{fmt$(kpis.deniedBalance)}</div>
        </div>
        <div className="summary-item">
          <div className="si-label">Claims</div>
          <div className="si-value">{kpis.claimCount.toLocaleString()}</div>
        </div>
        <div className="summary-item">
          <div className="si-label">Carriers</div>
          <div className="si-value">{drillRow.carrierCount}</div>
        </div>
      </div>
      <div className="panel">
        <div className="panel-header">
          <span className="panel-title">Carrier Breakdown — {drillRow.state}</span>
        </div>
        <SortableTable
          columns={STATE_CARRIER_COLS}
          data={carrierBreakdown}
          pageSize={15}
          exportFilename={`state_${drillRow.state}_carriers.csv`}
          emptyMessage="No carriers."
        />
      </div>
      <div className="panel">
        <div className="panel-header">
          <span className="panel-title">Claim Detail</span>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{stateRows.length.toLocaleString()} claims</span>
        </div>
        <SortableTable
          columns={DRILL_CLAIM_COLS}
          data={stateRows}
          pageSize={50}
          exportFilename={`state_${drillRow.state}_claims.csv`}
          emptyMessage="No claims."
        />
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function PayerAnalysisTab({ filteredData }) {
  const [selectedPayers, setSelectedPayers] = useState([]);
  const [selectedStates, setSelectedStates] = useState([]);
  const [drillData, setDrillData] = useState(null);

  // Build option lists
  const payerOptions = useMemo(() => {
    const s = new Set();
    for (const row of filteredData) {
      if (row._carrier && String(row._carrier).trim()) s.add(String(row._carrier).trim());
    }
    return Array.from(s).sort((a, b) => a.localeCompare(b));
  }, [filteredData]);

  const stateOptions = useMemo(() => {
    const s = new Set();
    for (const row of filteredData) {
      const state = String(row['Location State'] || '').trim();
      if (state) s.add(state);
    }
    return Array.from(s).sort((a, b) => a.localeCompare(b));
  }, [filteredData]);

  // Apply payer + state sub-filters
  const selectedData = useMemo(() => {
    let data = filteredData;
    if (selectedPayers.length > 0) {
      data = data.filter((r) => selectedPayers.includes(r._carrier));
    }
    if (selectedStates.length > 0) {
      data = data.filter((r) => selectedStates.includes(String(r['Location State'] || '').trim()));
    }
    return data;
  }, [filteredData, selectedPayers, selectedStates]);

  // KPIs
  const kpis = useMemo(() => kpisFromRows(selectedData), [selectedData]);

  // Section data
  const planBreakdown = useMemo(() => buildPlanBreakdown(selectedData), [selectedData]);
  const planAging = useMemo(() => buildPlanAging(selectedData), [selectedData]);
  const denialRows = useMemo(() => selectedData.filter(hasDenialCode), [selectedData]);
  const planDenialProfile = useMemo(() => buildPlanDenialProfile(denialRows, selectedData), [denialRows, selectedData]);
  const stateBreakdown = useMemo(() => buildStateBreakdown(selectedData), [selectedData]);

  function getPlanRows(planName) {
    return selectedData.filter((r) => {
      const p = String(r.InsurancePlanDescription || '').trim();
      return planName === '(Unknown)' ? !p : p === planName;
    });
  }

  function getStateRows(stateName) {
    return selectedData.filter((r) => {
      const s = String(r['Location State'] || '').trim();
      return stateName === '(Unknown)' ? !s : s === stateName;
    });
  }

  if (!filteredData || filteredData.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon">📋</div>
        <p>No data matches the current filters.</p>
      </div>
    );
  }

  return (
    <div className="section-gap">

      {/* Section 1: Selectors + KPIs */}
      <div className="panel">
        <div className="panel-header">
          <span className="panel-title">Payer &amp; State Filter</span>
          {(selectedPayers.length > 0 || selectedStates.length > 0) && (
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {selectedData.length.toLocaleString()} / {filteredData.length.toLocaleString()} claims
            </span>
          )}
        </div>
        <div className="panel-body">
          <ChipSelector
            label="Payers"
            options={payerOptions}
            selected={selectedPayers}
            onChange={setSelectedPayers}
          />
          {stateOptions.length > 0 && (
            <ChipSelector
              label="States"
              options={stateOptions}
              selected={selectedStates}
              onChange={setSelectedStates}
            />
          )}
        </div>
      </div>

      {/* KPI Summary Row */}
      <div className="summary-row">
        <div className="summary-item" style={{ borderTop: '3px solid var(--danger)' }}>
          <div className="si-label">Total Balance</div>
          <div className="si-value" style={{ color: 'var(--danger)' }}>{fmt$(kpis.totalBalance)}</div>
        </div>
        <div className="summary-item">
          <div className="si-label">Unbilled Balance</div>
          <div className="si-value">{fmt$(kpis.unbilledBalance)}</div>
        </div>
        <div className="summary-item">
          <div className="si-label">Denied Balance</div>
          <div className="si-value" style={{ color: 'var(--danger)' }}>{fmt$(kpis.deniedBalance)}</div>
        </div>
        <div className="summary-item">
          <div className="si-label">Unresponded Balance</div>
          <div className="si-value" style={{ color: 'var(--orange)' }}>{fmt$(kpis.unrespondedBalance)}</div>
        </div>
        <div className="summary-item">
          <div className="si-label">Claim Count</div>
          <div className="si-value">{kpis.claimCount.toLocaleString()}</div>
        </div>
        <div className="summary-item">
          <div className="si-label">Unique Plans</div>
          <div className="si-value">{kpis.uniquePlans.toLocaleString()}</div>
        </div>
      </div>

      {/* Section 2: Plan Breakdown */}
      <div className="panel">
        <div className="panel-header">
          <span className="panel-title">Plan Breakdown</span>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Click a row to drill down</span>
        </div>
        <SortableTable
          columns={PLAN_BREAKDOWN_COLS}
          data={planBreakdown}
          pageSize={25}
          exportFilename="payer_plan_breakdown.csv"
          emptyMessage="No plan data."
          onRowClick={(row) => setDrillData({ rows: getPlanRows(row.plan), title: row.plan, subtitle: `${row.carrier} — Plan Detail` })}
        />
      </div>

      {/* Section 3: Plan Aging */}
      <div className="panel">
        <div className="panel-header">
          <span className="panel-title">Plan Aging</span>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Average aging metrics by plan — click to drill down</span>
        </div>
        <SortableTable
          columns={PLAN_AGING_COLS}
          data={planAging}
          pageSize={25}
          exportFilename="payer_plan_aging.csv"
          emptyMessage="No aging data."
          onRowClick={(row) => setDrillData({ rows: getPlanRows(row.plan), title: row.plan, subtitle: 'Plan Aging Detail' })}
        />
      </div>

      {/* Section 4: Plan Denial Profile */}
      {planDenialProfile.length > 0 && (
        <div className="panel">
          <div className="panel-header">
            <span className="panel-title">Plan Denial Profile</span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {denialRows.length.toLocaleString()} denied claims — click to drill down
            </span>
          </div>
          <SortableTable
            columns={PLAN_DENIAL_COLS}
            data={planDenialProfile}
            pageSize={25}
            exportFilename="payer_plan_denial_profile.csv"
            emptyMessage="No denial data."
            onRowClick={(row) => setDrillData({ rows: getPlanRows(row.plan), title: row.plan, subtitle: 'Plan Denial Profile' })}
          />
        </div>
      )}

      {/* Section 5: State Distribution */}
      {stateBreakdown.length > 0 && (
        <div className="panel">
          <div className="panel-header">
            <span className="panel-title">State Distribution</span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Click a row to drill down</span>
          </div>
          <SortableTable
            columns={STATE_BREAKDOWN_COLS}
            data={stateBreakdown}
            pageSize={25}
            exportFilename="payer_state_breakdown.csv"
            emptyMessage="No state data."
            onRowClick={(row) => setDrillData({ rows: getStateRows(row.state), title: row.state, subtitle: 'State Detail' })}
          />
        </div>
      )}

      {/* Drill-Down Panel */}
      {drillData && (
        <DrillAnalyticsPanel
          title={drillData.title}
          subtitle={drillData.subtitle}
          rows={drillData.rows}
          onClose={() => setDrillData(null)}
          exportFilename="payer-drill"
        />
      )}

    </div>
  );
}
