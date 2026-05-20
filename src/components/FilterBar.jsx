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

// ── Exported Helpers ──────────────────────────────────────────────────────────

export function buildDefaultFilters() {
  const f = {};
  for (const c of CATEGORICAL_COLS) f[c.key] = [];
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
    return true;
  });
}

export function countActiveFilters(filters) {
  let count = 0;
  if (filters.excludeNonType1CPT) count++;
  for (const { key } of CATEGORICAL_COLS) {
    if (filters[key] && filters[key].length > 0) count++;
  }
  return count;
}

// ── FilterBar Component ───────────────────────────────────────────────────────

export default function FilterBar({ columnMeta, filters, onFilterChange, onClearAll }) {
  const activeCount = countActiveFilters(filters);

  const handleCat = useCallback(
    (key, val) => onFilterChange({ ...filters, [key]: val }),
    [filters, onFilterChange]
  );

  if (!columnMeta) return null;

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
