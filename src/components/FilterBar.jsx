import React, { useState, useRef, useEffect, useCallback } from 'react';

// ── Multi-Select Chip ─────────────────────────────────────────────────────────

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
            <button type="button" onClick={() => onChange(selected.length === 0 ? [...filtered] : [])}>
              {selected.length === 0 ? 'Select all' : 'Clear all'}
            </button>
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

// ── Range Filter ──────────────────────────────────────────────────────────────

function RangeFilter({ label, value, onChange }) {
  return (
    <div className="filter-group">
      <label>{label}</label>
      <div className="range-inputs">
        <input
          type="number"
          placeholder="Min"
          value={value[0] === '' ? '' : value[0]}
          onChange={(e) => onChange([e.target.value === '' ? '' : Number(e.target.value), value[1]])}
        />
        <span>–</span>
        <input
          type="number"
          placeholder="Max"
          value={value[1] === '' ? '' : value[1]}
          onChange={(e) => onChange([value[0], e.target.value === '' ? '' : Number(e.target.value)])}
        />
      </div>
    </div>
  );
}

// ── Constants ─────────────────────────────────────────────────────────────────

const CATEGORICAL_COLS = [
  { key: 'ChgStatus', label: 'Charge Status' },
  { key: 'PrimIns', label: 'Primary Payer' },
  { key: 'PrimInsType', label: 'Payer Type' },
  { key: 'Location_State', label: 'State' },
  { key: 'LocationName', label: 'Location' },
  { key: 'Modality', label: 'Modality' },
  { key: 'CPTCode', label: 'CPT Code' },
  { key: 'FirstDenialGroup', label: '1st Denial Group' },
  { key: 'FirstDenialCode', label: '1st Denial Code' },
  { key: 'LastDenialGroup', label: 'Last Denial Group' },
  { key: 'LastDenialCode', label: 'Last Denial Code' },
];

const NUMERIC_COLS = [
  { key: 'ChgAmt', label: 'Charge Amt ($)' },
  { key: 'PmtAmt', label: 'Payment Amt ($)' },
  { key: 'InsPmtAmt', label: 'Ins Payment ($)' },
  { key: 'PtPmtAmt', label: 'Pt Payment ($)' },
  { key: 'Balance', label: 'Balance ($)' },
];

// ── Exported Helpers ──────────────────────────────────────────────────────────

export function buildDefaultFilters() {
  const f = {};
  for (const c of CATEGORICAL_COLS) f[c.key] = [];
  for (const c of NUMERIC_COLS) f[c.key] = ['', ''];
  f.excludeCredits = true;
  f.excludeNonType1CPT = false;
  return f;
}

export function applyFilters(data, filters) {
  return data.filter((row) => {
    if (filters.excludeCredits && (row.ChgAmt == null || row.ChgAmt <= 0)) return false;
    if (filters.excludeNonType1CPT && row.CPTCode && /[a-zA-Z]/.test(row.CPTCode)) return false;
    for (const { key } of CATEGORICAL_COLS) {
      const sel = filters[key];
      if (sel && sel.length > 0 && !sel.includes(row[key])) return false;
    }
    for (const { key } of NUMERIC_COLS) {
      const range = filters[key];
      if (!range) continue;
      const [lo, hi] = range;
      const val = row[key];
      if (lo !== '' && lo !== null && lo !== undefined && val < Number(lo)) return false;
      if (hi !== '' && hi !== null && hi !== undefined && val > Number(hi)) return false;
    }
    return true;
  });
}

export function countActiveFilters(filters) {
  let count = 0;
  if (filters.excludeNonType1CPT) count++;
  for (const { key } of CATEGORICAL_COLS) {
    if (filters[key] && filters[key].length > 0) count++;
  }
  for (const { key } of NUMERIC_COLS) {
    const r = filters[key];
    if (r && (r[0] !== '' || r[1] !== '')) count++;
  }
  return count;
}

// ── FilterBar Component ───────────────────────────────────────────────────────

export default function FilterBar({ columnMeta, filters, onFilterChange, onClearAll }) {
  const [rangesOpen, setRangesOpen] = useState(false);
  const activeCount = countActiveFilters(filters);

  const handleCat = useCallback(
    (key, val) => onFilterChange({ ...filters, [key]: val }),
    [filters, onFilterChange]
  );

  const handleRange = useCallback(
    (key, val) => onFilterChange({ ...filters, [key]: val }),
    [filters, onFilterChange]
  );

  if (!columnMeta) return null;

  const hasNumericFilters = NUMERIC_COLS.some(({ key }) => {
    const r = filters[key];
    return r && (r[0] !== '' || r[1] !== '');
  });

  return (
    <div className="filter-bar">
      <div className="filter-chips-row">

        {/* Categorical chips */}
        {CATEGORICAL_COLS.map(({ key, label }) => {
          const meta = columnMeta[key];
          if (!meta || meta.type !== 'categorical') return null;
          return (
            <MultiSelect
              key={key}
              label={label}
              options={meta.values}
              selected={filters[key] || []}
              onChange={(val) => handleCat(key, val)}
            />
          );
        })}

        <div className="filter-chip-divider" />

        {/* Toggle chips */}
        <label
          className={`filter-toggle-chip${filters.excludeCredits ? ' active' : ''}`}
          title="Exclude rows where ChgAmt ≤ 0 (credits / takebacks)"
        >
          <input
            type="checkbox"
            checked={filters.excludeCredits}
            onChange={(e) => onFilterChange({ ...filters, excludeCredits: e.target.checked })}
          />
          Excl. credits
        </label>

        <label
          className={`filter-toggle-chip${filters.excludeNonType1CPT ? ' active' : ''}`}
          title="Exclude HCPCS / Category II / Category III CPT codes (contain letters)"
        >
          <input
            type="checkbox"
            checked={filters.excludeNonType1CPT}
            onChange={(e) => onFilterChange({ ...filters, excludeNonType1CPT: e.target.checked })}
          />
          Type-1 CPT only
        </label>

        <div className="filter-chip-divider" />

        {/* Numeric ranges toggle */}
        <button
          type="button"
          className={`filter-chip${hasNumericFilters ? ' has-selection' : ''}`}
          onClick={() => setRangesOpen((o) => !o)}
          title="Numeric range filters"
        >
          $ Ranges
          {hasNumericFilters && <span className="chip-count">!</span>}
          <span style={{ fontSize: 9, opacity: 0.55 }}>{rangesOpen ? '▲' : '▼'}</span>
        </button>

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

      {rangesOpen && (
        <div className="filter-ranges-row">
          <div className="filter-ranges-body">
            {NUMERIC_COLS.map(({ key, label }) => {
              const meta = columnMeta[key];
              if (!meta || meta.type !== 'numeric') return null;
              return (
                <RangeFilter
                  key={key}
                  label={label}
                  value={filters[key] || ['', '']}
                  onChange={(val) => handleRange(key, val)}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
