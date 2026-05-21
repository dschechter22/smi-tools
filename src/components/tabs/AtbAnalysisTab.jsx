import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  enrichAtbRows,
  buildAtbDefaultFilters,
  applyAtbFilters,
  countAtbActiveFilters,
  buildAtbSummary,
  buildAtbColumnMeta,
} from '../../utils/atbCalculations.js';
import UnbilledTab from '../atb/UnbilledTab.jsx';
import BilledArTab from '../atb/BilledArTab.jsx';
import AtbDenialsTab from '../atb/AtbDenialsTab.jsx';
import PayerAnalysisTab from '../atb/PayerAnalysisTab.jsx';
import { fmt$ } from '../../utils/format.js';
import { parseAtbFile } from '../../utils/parseAtbFile.js';

const STANDARD_BUCKET_ORDER = [
  '0-30', '31-60', '61-90', '91-120', '121-150', '151-180', '181-365', '366+',
];

const ATB_TABS = [
  { id: 'unbilled', label: 'Unbilled AR' },
  { id: 'billed', label: 'Billed AR' },
  { id: 'denials', label: 'Denials' },
  { id: 'payer', label: 'Payer Analysis' },
];

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
                  <input type="checkbox" checked={selected.includes(opt)} onChange={() => toggle(opt)} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{opt}</span>
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
        <MultiSelect label="Carrier" options={columnMeta['_carrier'] || []} selected={filters.carrier} onChange={(v) => set('carrier', v)} />
        <MultiSelect label="State" options={columnMeta['Location State'] || []} selected={filters.locationState} onChange={(v) => set('locationState', v)} />
        <MultiSelect label="Insurance Type" options={columnMeta['InsuranceType'] || []} selected={filters.insuranceType} onChange={(v) => set('insuranceType', v)} />
        <MultiSelect label="DOS Bucket" options={columnMeta['_dosBucket'] || STANDARD_BUCKET_ORDER} selected={filters.dosBucket} onChange={(v) => set('dosBucket', v)} />
        <MultiSelect label="CPT Code" options={columnMeta['CPTCode'] || []} selected={filters.cptCode} onChange={(v) => set('cptCode', v)} />
        <MultiSelect label="Modality" options={columnMeta['Modality'] || []} selected={filters.modality} onChange={(v) => set('modality', v)} />
        <MultiSelect label="Action Group" options={columnMeta['New Action Grouping'] || []} selected={filters.actionGroup} onChange={(v) => set('actionGroup', v)} />
        <MultiSelect label="Work List" options={columnMeta['Work List'] || []} selected={filters.workList} onChange={(v) => set('workList', v)} />
        <MultiSelect label="$ Tier" options={columnMeta['$ Tier'] || []} selected={filters.dollarTier} onChange={(v) => set('dollarTier', v)} />

        <div className="filter-chip-divider" />

        <label className={`filter-toggle-chip${filters.nonPiOnly ? ' active' : ''}`}>
          <input type="checkbox" checked={filters.nonPiOnly} onChange={(e) => onFilterChange({ ...filters, nonPiOnly: e.target.checked })} />
          Non-PI only
        </label>
        <label className={`filter-toggle-chip${filters.excludeNonPayer ? ' active' : ''}`}>
          <input type="checkbox" checked={filters.excludeNonPayer} onChange={(e) => onFilterChange({ ...filters, excludeNonPayer: e.target.checked })} />
          Excl. non-payer
        </label>
        <label className={`filter-toggle-chip${filters.excludeCredits ? ' active' : ''}`}>
          <input type="checkbox" checked={filters.excludeCredits} onChange={(e) => onFilterChange({ ...filters, excludeCredits: e.target.checked })} />
          Excl. credits
        </label>

        <div style={{ flex: 1 }} />
        {activeCount > 0 && (
          <>
            <span className="filter-active-badge">{activeCount} active</span>
            <button className="filter-clear-btn" type="button" onClick={onClearAll}>✕ Clear all</button>
          </>
        )}
      </div>
    </div>
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
      const { rows, sheetName, sampleKeys } = await parseAtbFile(file, (pct, status) => {
        if (pct !== null) setProgress(pct);
        if (status) setStatusText(status);
      });
      if (rows.length === 0) {
        setError(`No rows found in sheet "${sheetName}". Columns seen: ${sampleKeys || 'none'}`);
        return;
      }
      onAtbDataLoaded(rows, file.name);
    } catch (err) {
      setError(err.message || 'Failed to parse ATB file.');
    } finally {
      setLoading(false);
      setProgress(null);
      setStatusText('');
    }
  };

  const onInputChange = (e) => { handleFile(e.target.files?.[0]); e.target.value = ''; };
  const onDrop = (e) => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files?.[0]); };

  return (
    <div style={{ padding: '40px 24px', display: 'flex', justifyContent: 'center' }}>
      {loading && (
        <div className="loading-overlay">
          <div className="loading-card">
            <div className="progress-status">{statusText || 'Parsing ATB file…'}</div>
            {progress !== null ? (
              <>
                <div className="progress-bar-track"><div className="progress-bar-fill" style={{ width: `${progress}%` }} /></div>
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
        <p>Upload an ATB CSV file (export the Debit sheet from Excel as CSV). All processing is local — no data leaves your device.</p>
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
          <input ref={inputRef} type="file" accept=".csv,.xlsb,.xlsx,.xls" onChange={onInputChange} />
          <div className="upload-icon">📂</div>
          <h3>Drop ATB file here or click to browse</h3>
          <p>Supported: CSV (recommended) · .xlsb / .xlsx / .xls</p>
          <button className="btn btn-primary" onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }}>
            Select ATB File
          </button>
        </div>
        {error && <div className="upload-error">⚠ {error}</div>}
        <div className="upload-formats">
          <strong>Expected columns:</strong> Source.Name, ServiceDate, InitialFileDate, Balance,
          ChargeAmount, New Responsible Ins Carrier, Response Status, PI/Non PI, MAD Age, MAD Aging Bucket, InsurancePlanDescription, and more.
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function AtbAnalysisTab({ atbRawRows, atbFileName, onAtbDataLoaded }) {
  const [filters, setFilters] = useState(() => buildAtbDefaultFilters());
  const [activeTab, setActiveTab] = useState('unbilled');

  const enrichedData = useMemo(
    () => (atbRawRows ? enrichAtbRows(atbRawRows) : []),
    [atbRawRows]
  );

  const columnMeta = useMemo(() => buildAtbColumnMeta(enrichedData), [enrichedData]);

  const filteredData = useMemo(
    () => applyAtbFilters(enrichedData, filters),
    [enrichedData, filters]
  );

  const summary = useMemo(() => buildAtbSummary(filteredData), [filteredData]);

  const handleClearAll = () => setFilters(buildAtbDefaultFilters());

  if (!atbRawRows) return <AtbUploadCard onAtbDataLoaded={onAtbDataLoaded} />;

  const atbDateFormatted = summary.atbDate
    ? summary.atbDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '—';

  function renderTab() {
    switch (activeTab) {
      case 'unbilled': return <UnbilledTab filteredData={filteredData} totalData={enrichedData} />;
      case 'billed':  return <BilledArTab filteredData={filteredData} />;
      case 'denials': return <AtbDenialsTab filteredData={filteredData} />;
      case 'payer':   return <PayerAnalysisTab filteredData={filteredData} />;
      default:        return null;
    }
  }

  return (
    <div className="section-gap">
      {/* File context row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: 'var(--text-muted)', flexWrap: 'wrap' }}>
        <span>📁 <strong>{atbFileName}</strong></span>
        <span>·</span>
        <span>
          <strong style={{ color: 'var(--primary)', fontFamily: 'var(--font-mono)' }}>{filteredData.length.toLocaleString()}</strong>
          {' / '}{enrichedData.length.toLocaleString()} rows
        </span>
        <span>·</span>
        <span>ATB Date: <strong>{atbDateFormatted}</strong></span>
        <span>·</span>
        <button className="btn btn-secondary btn-sm" onClick={() => onAtbDataLoaded(null, '')} title="Load a different ATB file">
          ↩ Load New ATB
        </button>
      </div>

      {/* Filter Bar */}
      <AtbFilterBar filters={filters} onFilterChange={setFilters} onClearAll={handleClearAll} columnMeta={columnMeta} />

      {/* Top-level summary */}
      <div className="summary-row">
        <div className="summary-item">
          <div className="si-label">Total Open Balance</div>
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
          <div className="si-label">Total Claims</div>
          <div className="si-value">{summary.totalClaims.toLocaleString()}</div>
        </div>
        <div className="summary-item">
          <div className="si-label">Avg DOS Age</div>
          <div className="si-value">{summary.avgDosAge != null ? `${summary.avgDosAge}d` : '—'}</div>
        </div>
      </div>

      {/* Sub-tab bar */}
      <div className="tab-bar">
        {ATB_TABS.map((t) => (
          <button
            key={t.id}
            className={`tab-btn ${activeTab === t.id ? 'active' : ''}`}
            onClick={() => setActiveTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Sub-tab content */}
      {renderTab()}
    </div>
  );
}
