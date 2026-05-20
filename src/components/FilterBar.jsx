import React, { useState, useRef, useEffect, useCallback } from 'react';

// ── Multi-Select Dropdown ─────────────────────────────────────────────────────

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
    ? options.filter((o) => o.toLowerCase().includes(search.toLowerCase()))
    : options;

  const toggle = (val) => {
    if (selected.includes(val)) {
      onChange(selected.filter((v) => v !== val));
    } else {
      onChange([...selected, val]);
    }
  };

  const selectAll = () => {
    onChange(filtered.length === options.length ? [] : [...filtered]);
    // If filtering, only select visible items; otherwise clear
  };

  const clearAll = () => onChange([]);

  const triggerText =
    selected.length === 0
      ? 'All'
      : selected.length === 1
      ? selected[0]
      : `${selected.length} selected`;

  return (
    <div className="filter-group">
      <label>{label}</label>
      <div className="multi-select" ref={containerRef}>
        <button
          type="button"
          className="multi-select-trigger"
          onClick={() => setOpen((o) => !o)}
          title={selected.length > 0 ? selected.join(', ') : 'All values'}
        >
          <span className="trigger-text">{triggerText}</span>
          {selected.length > 0 && (
            <span className="trigger-count">{selected.length}</span>
          )}
          <span style={{ color: 'var(--text-light)', fontSize: 10 }}>{open ? '▲' : '▼'}</span>
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
              <button type="button" onClick={selectAll}>
                {selected.length === 0 ? 'Select visible' : 'Clear all'}
              </button>
              {selected.length > 0 && (
                <button type="button" onClick={clearAll}>
                  Clear
                </button>
              )}
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
    </div>
  );
}

// ── Range Filter ──────────────────────────────────────────────────────────────

function RangeFilter({ label, min: metaMin, max: metaMax, value, onChange }) {
  return (
    <div className="filter-group">
      <label>{label}</label>
      <div className="range-inputs">
        <input
          type="number"
          placeholder={`Min`}
          value={value[0] === '' ? '' : value[0]}
          onChange={(e) => onChange([e.target.value === '' ? '' : Number(e.target.value), value[1]])}
        />
        <span>–</span>
        <input
          type="number"
          placeholder={`Max`}
          value={value[1] === '' ? '' : value[1]}
          onChange={(e) => onChange([value[0], e.target.value === '' ? '' : Number(e.target.value)])}
        />
      </div>
    </div>
  );
}

// ── Main FilterBar ────────────────────────────────────────────────────────────

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

export function buildDefaultFilters() {
  const f = {};
  for (const c of CATEGORICAL_COLS) f[c.key] = [];
  for (const c of NUMERIC_COLS) f[c.key] = ['', ''];
  f.excludeCredits = true;        // new: exclude ChgAmt <= 0 rows by default
  f.excludeNonType1CPT = false;   // new: exclude CPT codes with letters
  return f;
}

export function applyFilters(data, filters) {
  return data.filter((row) => {
    // Credits/takebacks exclusion
    if (filters.excludeCredits && (row.ChgAmt == null || row.ChgAmt <= 0)) return false;
    // Non-type-1 CPT exclusion
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
  // excludeCredits defaults ON — don't count it as active unless turned off
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

export default function FilterBar({ columnMeta, filters, onFilterChange, onClearAll }) {
  const [open, setOpen] = useState(false);
  const activeCount = countActiveFilters(filters);

  const handleCat = useCallback(
    (key, val) => {
      onFilterChange({ ...filters, [key]: val });
    },
    [filters, onFilterChange]
  );

  const handleRange = useCallback(
    (key, val) => {
      onFilterChange({ ...filters, [key]: val });
    },
    [filters, onFilterChange]
  );

  if (!columnMeta) return null;

  return (
    <div className="filter-bar">
      <div className="filter-bar-header" onClick={() => setOpen((o) => !o)}>
        <span className="filter-bar-title">🔍 Filters</span>
        {activeCount > 0 && (
          <span className="filter-badge">{activeCount} active</span>
        )}
        <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{open ? '▲ collapse' : '▼ expand'}</span>
      </div>

      {/* Quick toggles — always visible */}
      <div className="filter-quick-toggles">
        <label className="filter-toggle-label">
          <input
            type="checkbox"
            checked={filters.excludeCredits}
            onChange={(e) => onFilterChange({ ...filters, excludeCredits: e.target.checked })}
          />
          Exclude credits/takebacks (ChgAmt ≤ 0)
        </label>
        <label className="filter-toggle-label">
          <input
            type="checkbox"
            checked={filters.excludeNonType1CPT}
            onChange={(e) => onFilterChange({ ...filters, excludeNonType1CPT: e.target.checked })}
          />
          Exclude non-type-1 CPTs (HCPCS / Cat II / Cat III)
        </label>
      </div>

      {open && (
        <>
          <div className="filter-bar-body">
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
            {NUMERIC_COLS.map(({ key, label }) => {
              const meta = columnMeta[key];
              if (!meta || meta.type !== 'numeric') return null;
              return (
                <RangeFilter
                  key={key}
                  label={label}
                  min={meta.min}
                  max={meta.max}
                  value={filters[key] || ['', '']}
                  onChange={(val) => handleRange(key, val)}
                />
              );
            })}
          </div>
          <div className="filter-actions">
            <button className="btn btn-secondary btn-sm" onClick={onClearAll}>
              Clear All Filters
            </button>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {activeCount === 0 ? 'No filters applied — showing all data' : `${activeCount} filter${activeCount !== 1 ? 's' : ''} applied`}
            </span>
          </div>
        </>
      )}
    </div>
  );
}
