import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import {
  enrichAtbRows,
  buildAtbDefaultFilters,
  applyAtbFilters,
  countAtbActiveFilters,
  buildAtbSummary,
  buildAtbPayerBreakdown,
  buildAtbAgingBreakdown,
  buildAtbDenialBreakdown,
  buildAtbColumnMeta,
  STANDARD_BUCKET_ORDER,
} from '../../utils/atbCalculations.js';
import SortableTable from '../SortableTable.jsx';
import DrillDownPanel from '../DrillDownPanel.jsx';
import { isTrueDenial } from '../../utils/calculations.js';
import { fmt$, fmtPct } from '../../utils/format.js';
import { parseAtbFile } from '../../utils/parseAtbFile.js';

const UNBILLED_BUCKET_ORDER = ['0-2', '3-5', '6-10', '11-15', '16-30', '31-60', '61+'];

// ── Local MultiSelect ─────────────────────────────────────────────────────────

function MultiSelect({ label, options, selected, onChange }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
        setSearch('');
      }
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const filtered = search
    ? options.filter((o) => String(o).toLowerCase().includes(search.toLowerCase()))
    : options;

  const toggle = (val) => {
    if (selected.includes(val)) onChange(selected.filter((v) => v !== val));
    else onChange([...selected, val]);
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        className={`filter-chip${selected.length > 0 ? ' has-selection' : ''}`}
        onClick={() => setOpen((o) => !o)}
        title={selected.length > 0 ? selected.join(', ') : `All ${label}`}
      >
        {label}
        {selected.length > 0 && <span className="chip-count">{selected.length}</span>}
        <span style={{ fontSize: 9, opacity: 0.55 }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="multi-select-dropdown">
          <div className="multi-select-search">
            <input
              autoFocus
              type="text"
              placeholder="Search…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
          <div className="multi-select-actions">
            <button type="button" onClick={() => onChange([...filtered])}>Select all</button>
            <button type="button" onClick={() => onChange([])}>Clear</button>
          </div>
          <div className="multi-select-list">
            {filtered.length === 0 ? (
              <div className="multi-select-empty">No matches</div>
            ) : (
              filtered.map((opt) => (
                <label key={opt} className="multi-select-option">
                  <input
                    type="checkbox"
                    checked={selected.includes(opt)}
                    onChange={() => toggle(opt)}
                  />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {opt}
                  </span>
                </label>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── ATB Filter Bar ────────────────────────────────────────────────────────────

function AtbFilterBar({ filters, onFilterChange, onClearAll, columnMeta }) {
  const activeCount = countAtbActiveFilters(filters);
  const set = (key, val) => onFilterChange({ ...filters, [key]: val });

  return (
    <div className="filter-bar">
      <div className="filter-chips-row">
        <MultiSelect
          label="Status"
          options={['Unbilled', 'Unresponded', 'Responded']}
          selected={filters.status}
          onChange={(v) => set('status', v)}
        />
        <MultiSelect
          label="Carrier"
          options={columnMeta['_carrier'] || []}
          selected={filters.carrier}
          onChange={(v) => set('carrier', v)}
        />
        <MultiSelect
          label="Insurance Type"
          options={columnMeta['InsuranceType'] || []}
          selected={filters.insuranceType}
          onChange={(v) => set('insuranceType', v)}
        />
        <MultiSelect
          label="DOS Bucket"
          options={columnMeta['_dosBucket'] || STANDARD_BUCKET_ORDER}
          selected={filters.dosBucket}
          onChange={(v) => set('dosBucket', v)}
        />
        <MultiSelect
          label="CPT Code"
          options={columnMeta['CPTCode'] || []}
          selected={filters.cptCode}
          onChange={(v) => set('cptCode', v)}
        />
        <MultiSelect
          label="Modality"
          options={columnMeta['Modality'] || []}
          selected={filters.modality}
          onChange={(v) => set('modality', v)}
        />
        <MultiSelect
          label="State"
          options={columnMeta['Location State'] || []}
          selected={filters.locationState}
          onChange={(v) => set('locationState', v)}
        />
        <MultiSelect
          label="Action Group"
          options={columnMeta['New Action Grouping'] || []}
          selected={filters.actionGroup}
          onChange={(v) => set('actionGroup', v)}
        />
        <MultiSelect
          label="Work List"
          options={columnMeta['Work List'] || []}
          selected={filters.workList}
          onChange={(v) => set('workList', v)}
        />
        <MultiSelect
          label="$ Tier"
          options={columnMeta['$ Tier'] || []}
          selected={filters.dollarTier}
          onChange={(v) => set('dollarTier', v)}
        />

        <div className="filter-chip-divider" />

        <label
          className={`filter-toggle-chip${filters.nonPiOnly ? ' active' : ''}`}
          title="Show only Non-PI claims"
        >
          <input
            type="checkbox"
            checked={filters.nonPiOnly}
            onChange={(e) => onFilterChange({ ...filters, nonPiOnly: e.target.checked })}
          />
          Non-PI only
        </label>

        <label
          className={`filter-toggle-chip${filters.excludeNonPayer ? ' active' : ''}`}
          title="Exclude attorney, automobile, patient, self pay carriers"
        >
          <input
            type="checkbox"
            checked={filters.excludeNonPayer}
            onChange={(e) => onFilterChange({ ...filters, excludeNonPayer: e.target.checked })}
          />
          Excl. non-payer
        </label>

        <label
          className={`filter-toggle-chip${filters.excludeCredits ? ' active' : ''}`}
          title="Exclude rows where Balance ≤ 0"
        >
          <input
            type="checkbox"
            checked={filters.excludeCredits}
            onChange={(e) => onFilterChange({ ...filters, excludeCredits: e.target.checked })}
          />
          Excl. credits
        </label>

        <div style={{ flex: 1 }} />

        {activeCount > 0 && (
          <>
            <span className="filter-active-badge">{activeCount} active</span>
            <button className="filter-clear-btn" type="button" onClick={onClearAll}>
              ✕ Clear all
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ── Payer Drill-Down ──────────────────────────────────────────────────────────

function PayerDrillDown({ row, filteredData, onClose }) {
  const carrierData = useMemo(
    () => filteredData.filter((r) => r._carrier === row.carrier),
    [filteredData, row.carrier]
  );

  const summary = useMemo(() => {
    let totalBalance = 0, unbilledBalance = 0, unrespondedBalance = 0, respondedBalance = 0;
    let totalDosAge = 0, dosAgeCount = 0;
    for (const r of carrierData) {
      totalBalance += r._balance;
      if (r._status === 'Unbilled') unbilledBalance += r._balance;
      else if (r._status === 'Unresponded') unrespondedBalance += r._balance;
      else respondedBalance += r._balance;
      if (r._dosAge != null) { totalDosAge += r._dosAge; dosAgeCount++; }
    }
    return {
      totalBalance,
      unbilledBalance,
      unrespondedBalance,
      respondedBalance,
      claimCount: carrierData.length,
      avgDosAge: dosAgeCount > 0 ? Math.round(totalDosAge / dosAgeCount) : null,
    };
  }, [carrierData]);

  const cptRows = useMemo(() => {
    const groups = {};
    for (const r of carrierData) {
      const cpt = r.CPTCode || '(Unknown)';
      if (!groups[cpt]) {
        groups[cpt] = { cpt, balance: 0, unbilledBal: 0, unrespondedBal: 0, respondedBal: 0, count: 0 };
      }
      const g = groups[cpt];
      g.balance += r._balance;
      if (r._status === 'Unbilled') g.unbilledBal += r._balance;
      else if (r._status === 'Unresponded') g.unrespondedBal += r._balance;
      else g.respondedBal += r._balance;
      g.count++;
    }
    return Object.values(groups).sort((a, b) => b.balance - a.balance);
  }, [carrierData]);

  const denialRows = useMemo(() => {
    const codes = {};
    let totalDeniedBal = 0;
    for (const r of carrierData) {
      if (!isTrueDenial(r.FirstDenialCode)) continue;
      const code = String(r.FirstDenialCode).trim().toUpperCase();
      if (!codes[code]) {
        codes[code] = { code, group: r.LastDenialGroup || '', balance: 0, count: 0 };
      }
      codes[code].balance += r._balance;
      codes[code].count++;
      totalDeniedBal += r._balance;
    }
    return Object.values(codes)
      .map((c) => ({ ...c, pct: totalDeniedBal > 0 ? (c.balance / totalDeniedBal) * 100 : 0 }))
      .sort((a, b) => b.balance - a.balance);
  }, [carrierData]);

  const CPT_COLS = [
    { key: 'cpt', label: 'CPT', sortable: true, filterType: 'text' },
    { key: 'balance', label: 'Balance', sortable: true, filterType: 'number', cellClass: 'td-mono text-right', headerClass: 'text-right', render: (r) => <span style={{ color: 'var(--danger)', fontWeight: 700 }}>{fmt$(r.balance)}</span>, csvValue: (r) => r.balance?.toFixed(2) },
    { key: 'unbilledBal', label: 'Unbilled', sortable: true, filterType: 'number', cellClass: 'td-mono text-right', headerClass: 'text-right', render: (r) => fmt$(r.unbilledBal), csvValue: (r) => r.unbilledBal?.toFixed(2) },
    { key: 'unrespondedBal', label: 'Unresponded', sortable: true, filterType: 'number', cellClass: 'td-mono text-right', headerClass: 'text-right', render: (r) => fmt$(r.unrespondedBal), csvValue: (r) => r.unrespondedBal?.toFixed(2) },
    { key: 'respondedBal', label: 'Responded', sortable: true, filterType: 'number', cellClass: 'td-mono text-right', headerClass: 'text-right', render: (r) => fmt$(r.respondedBal), csvValue: (r) => r.respondedBal?.toFixed(2) },
    { key: 'count', label: 'Claims', sortable: true, filterType: 'number', cellClass: 'td-mono text-right', headerClass: 'text-right' },
  ];

  const DENIAL_COLS = [
    { key: 'code', label: 'Code', sortable: true, filterType: 'text', render: (r) => <span className="badge badge-red">{r.code}</span> },
    { key: 'group', label: 'Group', sortable: true, filterType: 'text', render: (r) => <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>{r.group || '—'}</span> },
    { key: 'balance', label: 'Balance', sortable: true, filterType: 'number', cellClass: 'td-mono text-right', headerClass: 'text-right', render: (r) => fmt$(r.balance), csvValue: (r) => r.balance?.toFixed(2) },
    { key: 'count', label: 'Claims', sortable: true, filterType: 'number', cellClass: 'td-mono text-right', headerClass: 'text-right' },
    { key: 'pct', label: '% of Denials', sortable: true, filterType: 'number', cellClass: 'td-mono text-right', headerClass: 'text-right', render: (r) => fmtPct(r.pct), csvValue: (r) => r.pct?.toFixed(2) + '%' },
  ];

  return (
    <DrillDownPanel title={row.carrier} subtitle="ATB Payer Detail" onClose={onClose}>
      <div className="section-gap">
        <div className="summary-row">
          <div className="summary-item">
            <div className="si-label">Total Balance</div>
            <div className="si-value" style={{ color: 'var(--danger)' }}>{fmt$(summary.totalBalance)}</div>
          </div>
          <div className="summary-item">
            <div className="si-label">Unbilled</div>
            <div className="si-value" style={{ color: '#005276' }}>{fmt$(summary.unbilledBalance)}</div>
          </div>
          <div className="summary-item">
            <div className="si-label">Unresponded</div>
            <div className="si-value" style={{ color: 'var(--orange)' }}>{fmt$(summary.unrespondedBalance)}</div>
          </div>
          <div className="summary-item">
            <div className="si-label">Responded</div>
            <div className="si-value" style={{ color: 'var(--success)' }}>{fmt$(summary.respondedBalance)}</div>
          </div>
          <div className="summary-item">
            <div className="si-label">Claims</div>
            <div className="si-value">{summary.claimCount.toLocaleString()}</div>
          </div>
          <div className="summary-item">
            <div className="si-label">Avg DOS Age</div>
            <div className="si-value">{summary.avgDosAge != null ? `${summary.avgDosAge}d` : '—'}</div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <span className="panel-title">By CPT Code</span>
          </div>
          <SortableTable columns={CPT_COLS} data={cptRows} pageSize={15} exportFilename={`atb_${row.carrier}_cpts.csv`} />
        </div>

        {denialRows.length > 0 && (
          <div className="panel">
            <div className="panel-header">
              <span className="panel-title">True Denials</span>
            </div>
            <SortableTable columns={DENIAL_COLS} data={denialRows} pageSize={15} exportFilename={`atb_${row.carrier}_denials.csv`} />
          </div>
        )}
      </div>
    </DrillDownPanel>
  );
}

// ── ATB Upload Card ───────────────────────────────────────────────────────────

function AtbUploadCard({ onAtbDataLoaded }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(null);
  const [statusText, setStatusText] = useState('');
  const [error, setError] = useState('');

  const handleFile = async (file) => {
    if (!file) return;
    setError('');
    setLoading(true);
    setProgress(0);
    setStatusText('Starting…');
    try {
      const rows = await parseAtbFile(file, (pct, status) => {
        setProgress(pct);
        if (status) setStatusText(status);
      });
      onAtbDataLoaded(rows, file.name);
    } catch (err) {
      setError(err.message || 'Failed to parse ATB file.');
    } finally {
      setLoading(false);
      setProgress(null);
      setStatusText('');
    }
  };

  const onInputChange = (e) => {
    handleFile(e.target.files?.[0]);
    e.target.value = '';
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    handleFile(e.dataTransfer.files?.[0]);
  };

  return (
    <div style={{ padding: '40px 24px', display: 'flex', justifyContent: 'center' }}>
      {loading && (
        <div className="loading-overlay">
          <div className="loading-card">
            <div className="progress-status">{statusText || 'Parsing ATB file…'}</div>
            {progress !== null ? (
              <>
                <div className="progress-bar-track">
                  <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
                </div>
                <div className="progress-pct">{progress}%</div>
              </>
            ) : (
              <div className="spinner" />
            )}
            <div className="progress-note">Processing in background — UI stays responsive</div>
          </div>
        </div>
      )}

      <div className="upload-card" style={{ maxWidth: 480, padding: '32px 40px' }}>
        <h2 style={{ fontSize: 18 }}>Load ATB File</h2>
        <p>Upload an ATB Excel file (.xlsb, .xlsx, or .xls). All processing is local — no data leaves your device.</p>

        <div
          className={`upload-dropzone ${dragging ? 'drag-over' : ''}`}
          onDrop={onDrop}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onClick={() => inputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".xlsb,.xlsx,.xls"
            onChange={onInputChange}
          />
          <div className="upload-icon">📂</div>
          <h3>Drop ATB file here or click to browse</h3>
          <p>Supported: Excel (.xlsb / .xlsx / .xls)</p>
          <button
            className="btn btn-primary"
            onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }}
          >
            Select ATB File
          </button>
        </div>

        {error && <div className="upload-error">⚠ {error}</div>}

        <div className="upload-formats">
          <strong>Expected columns:</strong> Source.Name, ServiceDate, InitialFileDate, Balance,
          ChargeAmount, New Responsible Ins Carrier, Response Status, PI/Non PI, and more.
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function AtbAnalysisTab({ atbRawRows, atbFileName, onAtbDataLoaded }) {
  const [filters, setFilters] = useState(() => buildAtbDefaultFilters());
  const [drillPayer, setDrillPayer] = useState(null);

  // Enrich raw rows once
  const enrichedData = useMemo(
    () => (atbRawRows ? enrichAtbRows(atbRawRows) : []),
    [atbRawRows]
  );

  // Build column meta from enriched data (unfiltered)
  const columnMeta = useMemo(() => buildAtbColumnMeta(enrichedData), [enrichedData]);

  // Apply filters
  const filteredData = useMemo(
    () => applyAtbFilters(enrichedData, filters),
    [enrichedData, filters]
  );

  const summary = useMemo(() => buildAtbSummary(filteredData), [filteredData]);
  const payerBreakdown = useMemo(() => buildAtbPayerBreakdown(filteredData), [filteredData]);
  const agingBreakdown = useMemo(() => buildAtbAgingBreakdown(filteredData), [filteredData]);
  const denialBreakdown = useMemo(() => buildAtbDenialBreakdown(filteredData), [filteredData]);

  const unbilledRows = useMemo(() => filteredData.filter((r) => r._isUnbilled), [filteredData]);

  const unbilledAgingData = useMemo(() => {
    const map = {};
    for (const r of unbilledRows) {
      const bucket = r._unbilledDosBucket;
      if (!bucket) continue;
      if (!map[bucket]) map[bucket] = { bucket, balance: 0, count: 0 };
      map[bucket].balance += r._balance;
      map[bucket].count++;
    }
    const totalUnbilledBal = unbilledRows.reduce((s, r) => s + r._balance, 0);
    return UNBILLED_BUCKET_ORDER
      .filter((b) => map[b])
      .map((b) => ({
        ...map[b],
        pct: totalUnbilledBal > 0 ? (map[b].balance / totalUnbilledBal) * 100 : 0,
      }));
  }, [unbilledRows]);

  const handleClearAll = () => setFilters(buildAtbDefaultFilters());

  if (!atbRawRows) {
    return <AtbUploadCard onAtbDataLoaded={onAtbDataLoaded} />;
  }

  const atbDateFormatted = summary.atbDate
    ? summary.atbDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '—';

  // ── Column Definitions ──────────────────────────────────────────────────────

  const UNBILLED_AGING_COLS = [
    { key: 'bucket', label: 'Unbilled Bucket', sortable: false, filterType: 'multiselect' },
    { key: 'balance', label: 'Balance', sortable: true, filterType: 'number', cellClass: 'td-mono text-right', headerClass: 'text-right', render: (r) => fmt$(r.balance), csvValue: (r) => r.balance?.toFixed(2) },
    { key: 'count', label: 'Claims', sortable: true, filterType: 'number', cellClass: 'td-mono text-right', headerClass: 'text-right' },
    { key: 'pct', label: '% of Unbilled', sortable: true, filterType: 'number', cellClass: 'td-mono text-right', headerClass: 'text-right', render: (r) => fmtPct(r.pct), csvValue: (r) => r.pct?.toFixed(2) + '%' },
  ];

  const PAYER_COLS = [
    { key: 'carrier', label: 'Carrier', sortable: true, filterType: 'text' },
    { key: 'totalBalance', label: 'Total Balance', sortable: true, filterType: 'number', cellClass: 'td-mono text-right', headerClass: 'text-right', render: (r) => <span style={{ color: 'var(--danger)', fontWeight: 700 }}>{fmt$(r.totalBalance)}</span>, csvValue: (r) => r.totalBalance?.toFixed(2) },
    { key: 'unbilledBalance', label: 'Unbilled', sortable: true, filterType: 'number', cellClass: 'td-mono text-right', headerClass: 'text-right', render: (r) => fmt$(r.unbilledBalance), csvValue: (r) => r.unbilledBalance?.toFixed(2) },
    { key: 'unrespondedBalance', label: 'Unresponded', sortable: true, filterType: 'number', cellClass: 'td-mono text-right', headerClass: 'text-right', render: (r) => fmt$(r.unrespondedBalance), csvValue: (r) => r.unrespondedBalance?.toFixed(2) },
    { key: 'respondedBalance', label: 'Responded', sortable: true, filterType: 'number', cellClass: 'td-mono text-right', headerClass: 'text-right', render: (r) => fmt$(r.respondedBalance), csvValue: (r) => r.respondedBalance?.toFixed(2) },
    { key: 'claimCount', label: 'Claims', sortable: true, filterType: 'number', cellClass: 'td-mono text-right', headerClass: 'text-right' },
    { key: 'avgDosAge', label: 'Avg DOS Age', sortable: true, filterType: 'number', cellClass: 'td-mono text-right', headerClass: 'text-right', render: (r) => r.avgDosAge != null ? `${r.avgDosAge}d` : '—', csvValue: (r) => r.avgDosAge ?? '' },
  ];

  const DENIAL_COLS = [
    { key: 'code', label: 'Code', sortable: true, filterType: 'text', render: (r) => <span className="badge badge-red">{r.code}</span> },
    { key: 'group', label: 'Group', sortable: true, filterType: 'text', render: (r) => <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>{r.group || '—'}</span> },
    { key: 'balance', label: 'Balance', sortable: true, filterType: 'number', cellClass: 'td-mono text-right', headerClass: 'text-right', render: (r) => <span style={{ color: 'var(--danger)' }}>{fmt$(r.balance)}</span>, csvValue: (r) => r.balance?.toFixed(2) },
    { key: 'count', label: 'Claims', sortable: true, filterType: 'number', cellClass: 'td-mono text-right', headerClass: 'text-right' },
    { key: 'pctOfTotal', label: '% of Denials', sortable: true, filterType: 'number', cellClass: 'td-mono text-right', headerClass: 'text-right', render: (r) => fmtPct(r.pctOfTotal), csvValue: (r) => r.pctOfTotal?.toFixed(2) + '%' },
  ];

  const WORK_QUEUE_COLS = [
    {
      key: '_status', label: 'Status', sortable: true, filterType: 'multiselect',
      render: (r) => {
        if (r._status === 'Unbilled') return <span className="badge badge-navy">Unbilled</span>;
        if (r._status === 'Unresponded') return <span className="badge badge-orange">Unresponded</span>;
        return <span className="badge badge-green">Responded</span>;
      },
    },
    { key: '_carrier', label: 'Carrier', sortable: true, filterType: 'text' },
    { key: 'InsuranceType', label: 'Ins Type', sortable: true, filterType: 'multiselect' },
    { key: 'CPTCode', label: 'CPT', sortable: true, filterType: 'text' },
    { key: 'Modality', label: 'Modality', sortable: true, filterType: 'multiselect' },
    {
      key: '_balance', label: 'Balance', sortable: true, filterType: 'number',
      cellClass: 'td-mono text-right', headerClass: 'text-right',
      render: (r) => <span style={{ color: 'var(--danger)', fontWeight: 700 }}>{fmt$(r._balance)}</span>,
      csvValue: (r) => r._balance?.toFixed(2),
    },
    {
      key: '_chargeAmount', label: 'Charge Amt', sortable: true, filterType: 'number',
      cellClass: 'td-mono text-right', headerClass: 'text-right',
      render: (r) => fmt$(r._chargeAmount),
      csvValue: (r) => r._chargeAmount?.toFixed(2),
    },
    {
      key: 'AllowedAmount', label: 'Allowed', sortable: true, filterType: 'number',
      cellClass: 'td-mono text-right', headerClass: 'text-right',
      render: (r) => fmt$(parseFloat(r.AllowedAmount) || 0),
      csvValue: (r) => (parseFloat(r.AllowedAmount) || 0).toFixed(2),
    },
    {
      key: '_dosAge', label: 'DOS Age', sortable: true, filterType: 'number',
      cellClass: 'td-mono text-right', headerClass: 'text-right',
      render: (r) => r._dosAge != null ? `${r._dosAge}d` : '—',
    },
    { key: '_dosBucket', label: 'DOS Bucket', sortable: true, filterType: 'multiselect' },
    {
      key: '_initialFileDateAge', label: 'Init File Age', sortable: true, filterType: 'number',
      cellClass: 'td-mono text-right', headerClass: 'text-right',
      render: (r) => r._isUnbilled ? '—' : (r._initialFileDateAge != null ? `${r._initialFileDateAge}d` : '—'),
    },
    {
      key: '_initialFileDateBucket', label: 'Init File Bucket', sortable: true, filterType: 'multiselect',
      render: (r) => r._isUnbilled
        ? <span className="badge badge-navy">Unbilled</span>
        : (r._initialFileDateBucket || '—'),
    },
    {
      key: '_lastInsFileDateAge', label: 'Last Filed Age', sortable: true, filterType: 'number',
      cellClass: 'td-mono text-right', headerClass: 'text-right',
      render: (r) => r._lastInsFileDateAge != null ? `${r._lastInsFileDateAge}d` : '—',
    },
    { key: '_lastInsFileDateBucket', label: 'Last Filed Bucket', sortable: true, filterType: 'multiselect' },
    {
      key: '_unbilledDosBucket', label: 'Unbilled Bucket', sortable: true, filterType: 'multiselect',
      render: (r) => r._isUnbilled ? (r._unbilledDosBucket || '—') : '—',
    },
    {
      key: 'FirstDenialCode', label: '1st Denial', sortable: true, filterType: 'text',
      render: (r) => r.FirstDenialCode && String(r.FirstDenialCode).trim()
        ? <span className="badge badge-yellow">{r.FirstDenialCode}</span>
        : '—',
    },
    {
      key: 'LastDenialCode', label: 'Last Denial', sortable: true, filterType: 'text',
      render: (r) => r.LastDenialCode && String(r.LastDenialCode).trim()
        ? <span className="badge badge-red">{r.LastDenialCode}</span>
        : '—',
    },
    { key: 'LastDenialGroup', label: 'Denial Group', sortable: true, filterType: 'text' },
    { key: 'BillStage', label: 'Bill Stage', sortable: true, filterType: 'multiselect' },
    { key: 'New Action Grouping', label: 'Action Group', sortable: true, filterType: 'multiselect' },
    { key: 'Work List', label: 'Work List', sortable: true, filterType: 'multiselect' },
    { key: '$ Tier', label: '$ Tier', sortable: true, filterType: 'multiselect' },
    { key: 'Location State', label: 'State', sortable: true, filterType: 'multiselect' },
    { key: 'LocationName', label: 'Location', sortable: true, filterType: 'text' },
  ];

  const agingTooltipFormatter = (value, name) => [fmt$(value), name];

  return (
    <div className="section-gap">
      {/* Data context row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: 'var(--text-muted)', flexWrap: 'wrap' }}>
        <span>
          📁 <strong>{atbFileName}</strong>
        </span>
        <span>·</span>
        <span>
          <strong style={{ color: 'var(--primary)', fontFamily: 'var(--font-mono)' }}>
            {filteredData.length.toLocaleString()}
          </strong>
          {' / '}
          {enrichedData.length.toLocaleString()} rows
        </span>
        <span>·</span>
        <span>ATB Date: <strong>{atbDateFormatted}</strong></span>
        <span>·</span>
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => onAtbDataLoaded(null, '')}
          title="Load a different ATB file"
        >
          ↩ Load New ATB
        </button>
      </div>

      {/* Filter Bar */}
      <AtbFilterBar
        filters={filters}
        onFilterChange={setFilters}
        onClearAll={handleClearAll}
        columnMeta={columnMeta}
      />

      {/* Summary KPIs */}
      <div className="summary-row">
        <div className="summary-item">
          <div className="si-label">Total Open Balance</div>
          <div className="si-value" style={{ color: 'var(--danger)' }}>{fmt$(summary.totalBalance)}</div>
        </div>
        <div className="summary-item">
          <div className="si-label">Unbilled Balance</div>
          <div className="si-value" style={{ color: '#005276' }}>{fmt$(summary.unbilledBalance)}</div>
        </div>
        <div className="summary-item">
          <div className="si-label">Unresponded Balance</div>
          <div className="si-value" style={{ color: 'var(--orange)' }}>{fmt$(summary.unrespondedBalance)}</div>
        </div>
        <div className="summary-item">
          <div className="si-label">Responded Balance</div>
          <div className="si-value" style={{ color: 'var(--success)' }}>{fmt$(summary.respondedBalance)}</div>
        </div>
        <div className="summary-item">
          <div className="si-label">Total Claims</div>
          <div className="si-value">{summary.totalClaims.toLocaleString()}</div>
        </div>
        <div className="summary-item">
          <div className="si-label">Avg DOS Age</div>
          <div className="si-value">{summary.avgDosAge != null ? `${summary.avgDosAge}d` : '—'}</div>
        </div>
      </div>

      {/* Aging Chart */}
      <div className="panel">
        <div className="panel-header">
          <span className="panel-title">DOS Aging by Status</span>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Open balance by age bucket</span>
        </div>
        <div className="panel-body">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={agingBreakdown} margin={{ top: 8, right: 20, left: 10, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis
                dataKey="bucket"
                tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                angle={-35}
                textAnchor="end"
                interval={0}
              />
              <YAxis
                tickFormatter={(v) => fmt$(v)}
                tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                width={72}
              />
              <Tooltip formatter={agingTooltipFormatter} />
              <Legend verticalAlign="top" wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Unbilled" stackId="a" fill="#1e40af" />
              <Bar dataKey="Unresponded" stackId="a" fill="#f97316" />
              <Bar dataKey="Responded" stackId="a" fill="#16a34a" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Unbilled DOS Aging Table */}
      {unbilledRows.length > 0 && (
        <div className="panel">
          <div className="panel-header">
            <span className="panel-title">Unbilled DOS Aging</span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              How long since service for unfiled claims
            </span>
          </div>
          <SortableTable
            columns={UNBILLED_AGING_COLS}
            data={unbilledAgingData}
            pageSize={10}
            exportFilename="atb_unbilled_aging.csv"
            showExport={true}
            emptyMessage="No unbilled claims."
          />
        </div>
      )}

      {/* Payer Breakdown Table */}
      <div className="panel">
        <div className="panel-header">
          <span className="panel-title">Open AR by Payer</span>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Click a row to drill down</span>
        </div>
        <SortableTable
          columns={PAYER_COLS}
          data={payerBreakdown}
          pageSize={25}
          exportFilename="atb_payer_breakdown.csv"
          showExport={true}
          onRowClick={setDrillPayer}
        />
      </div>

      {/* Denial Breakdown */}
      {denialBreakdown.totalDenied > 0 && (
        <div className="panel">
          <div className="panel-header">
            <span className="panel-title">Denial Analysis (True Denials)</span>
            <div className="summary-item" style={{ margin: 0, padding: '6px 14px' }}>
              <div className="si-label">Total Denied Balance</div>
              <div className="si-value" style={{ fontSize: 16, color: 'var(--danger)' }}>
                {fmt$(denialBreakdown.totalDenied)}
              </div>
            </div>
          </div>
          <SortableTable
            columns={DENIAL_COLS}
            data={denialBreakdown.codes}
            pageSize={15}
            exportFilename="atb_denials.csv"
            showExport={true}
          />
        </div>
      )}

      {/* Work Queue */}
      <div className="panel">
        <div className="panel-header">
          <span className="panel-title">Claim-Level Work Queue</span>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {filteredData.length.toLocaleString()} claims
          </span>
        </div>
        <SortableTable
          columns={WORK_QUEUE_COLS}
          data={filteredData}
          pageSize={50}
          exportFilename="atb_work_queue.csv"
          showExport={true}
          emptyMessage="No claims match the current filters."
        />
      </div>

      {/* Payer Drill-Down */}
      {drillPayer && (
        <PayerDrillDown
          row={drillPayer}
          filteredData={filteredData}
          onClose={() => setDrillPayer(null)}
        />
      )}
    </div>
  );
}
