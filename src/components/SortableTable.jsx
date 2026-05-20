import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';

function downloadCSV(columns, data, filename = 'export.csv') {
  const headers = columns.map((c) => c.label).join(',');
  const rows = data.map((row) =>
    columns
      .map((c) => {
        const rawVal = c.csvValue ? c.csvValue(row) : row[c.key];
        const val = rawVal == null ? '' : String(rawVal);
        if (val.includes(',') || val.includes('"') || val.includes('\n')) {
          return '"' + val.replace(/"/g, '""') + '"';
        }
        return val;
      })
      .join(',')
  );
  const csv = [headers, ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// Compact multiselect dropdown for table column headers
function ColMultiSelect({ options, selected, onChange }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const visibleOptions = search
    ? options.filter((o) => o.toLowerCase().includes(search.toLowerCase()))
    : options;

  const toggle = (val) =>
    onChange(selected.includes(val) ? selected.filter((v) => v !== val) : [...selected, val]);

  const label =
    selected.length === 0 ? 'All' : selected.length === 1 ? selected[0] : `${selected.length} sel`;

  return (
    <div className="col-multi-select" ref={ref}>
      <button
        type="button"
        className="col-multi-trigger"
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
      >
        <span>{label}</span>
        {selected.length > 0 && <span className="col-multi-badge">{selected.length}</span>}
        <span style={{ fontSize: 9, color: 'var(--text-light)' }}>▾</span>
      </button>
      {open && (
        <div className="col-multi-dropdown">
          <input
            autoFocus
            type="text"
            placeholder="Search…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onClick={(e) => e.stopPropagation()}
          />
          <div className="col-multi-actions">
            <button type="button" onClick={(e) => { e.stopPropagation(); onChange([...visibleOptions]); }}>Select all</button>
            <button type="button" onClick={(e) => { e.stopPropagation(); onChange([]); }}>Clear</button>
          </div>
          <div className="col-multi-list">
            {visibleOptions.length === 0 ? (
              <div style={{ padding: '10px', textAlign: 'center', fontSize: 12, color: 'var(--text-light)' }}>No matches</div>
            ) : (
              visibleOptions.map((opt) => (
                <label key={opt} className="col-multi-option">
                  <input
                    type="checkbox"
                    checked={selected.includes(opt)}
                    onChange={() => toggle(opt)}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <span title={opt}>{opt}</span>
                </label>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function SortableTable({
  columns,
  data,
  pageSize = 25,
  exportFilename = 'export.csv',
  showExport = true,
  emptyMessage = 'No data available.',
}) {
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState('asc');
  const [page, setPage] = useState(1);
  const [colFilters, setColFilters] = useState({});
  const [filtersVisible, setFiltersVisible] = useState(false);

  const handleSort = useCallback(
    (key) => {
      if (sortKey === key) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortKey(key);
        setSortDir('asc');
      }
      setPage(1);
    },
    [sortKey]
  );

  // Compute unique values for multiselect columns
  const uniqueValues = useMemo(() => {
    const result = {};
    for (const col of columns) {
      if (col.filterType === 'multiselect') {
        const vals = new Set();
        for (const row of data) {
          const v = row[col.key];
          if (v != null && String(v).trim() !== '') vals.add(String(v));
        }
        result[col.key] = Array.from(vals).sort((a, b) => a.localeCompare(b));
      }
    }
    return result;
  }, [data, columns]);

  const sorted = useMemo(() => {
    if (!sortKey) return data;
    return [...data].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      const cmp =
        typeof av === 'number' && typeof bv === 'number'
          ? av - bv
          : String(av).localeCompare(String(bv));
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [data, sortKey, sortDir]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    for (const col of columns) {
      if (!col.filterType) continue;
      const f = colFilters[col.key];
      if (!f) continue;
      if (col.filterType === 'text' && typeof f === 'string' && f.trim() !== '') count++;
      if (col.filterType === 'multiselect' && Array.isArray(f) && f.length > 0) count++;
      if (col.filterType === 'number' && typeof f === 'object') {
        if ((f.gte != null && f.gte !== '') || (f.lte != null && f.lte !== '')) count++;
      }
    }
    return count;
  }, [colFilters, columns]);

  const filtered = useMemo(() => {
    if (activeFilterCount === 0) return sorted;
    return sorted.filter((row) => {
      for (const col of columns) {
        if (!col.filterType) continue;
        const filter = colFilters[col.key];
        if (!filter) continue;
        const rawVal = row[col.key];

        if (col.filterType === 'text') {
          if (typeof filter === 'string' && filter.trim() !== '') {
            const val = rawVal == null ? '' : String(rawVal).toLowerCase();
            if (!val.includes(filter.trim().toLowerCase())) return false;
          }
        } else if (col.filterType === 'multiselect') {
          if (Array.isArray(filter) && filter.length > 0) {
            const val = rawVal == null ? '' : String(rawVal);
            if (!filter.includes(val)) return false;
          }
        } else if (col.filterType === 'number') {
          if (typeof filter === 'object') {
            const num = typeof rawVal === 'number' ? rawVal : parseFloat(rawVal);
            if (filter.gte !== '' && filter.gte != null) {
              if (isNaN(num) || num < parseFloat(filter.gte)) return false;
            }
            if (filter.lte !== '' && filter.lte != null) {
              if (isNaN(num) || num > parseFloat(filter.lte)) return false;
            }
          }
        }
      }
      return true;
    });
  }, [sorted, colFilters, columns, activeFilterCount]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * pageSize;
  const pageEnd = Math.min(pageStart + pageSize, filtered.length);
  const pageRows = filtered.slice(pageStart, pageEnd);

  const handleExport = () => downloadCSV(columns, filtered, exportFilename);

  const handleTextFilter = (key, value) => {
    setColFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const handleMultiselectFilter = (key, value) => {
    setColFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const handleNumberFilter = (key, bound, value) => {
    setColFilters((prev) => ({
      ...prev,
      [key]: { ...(prev[key] || {}), [bound]: value },
    }));
    setPage(1);
  };

  const clearNumberFilter = (key) => {
    setColFilters((prev) => ({ ...prev, [key]: { gte: '', lte: '' } }));
    setPage(1);
  };

  const clearAllFilters = () => {
    setColFilters({});
    setPage(1);
  };

  const hasFilterRow = columns.some((c) => c.filterType);

  return (
    <div className="panel">
      {/* Toolbar: filter toggle + export */}
      {hasFilterRow && (
        <div className="table-toolbar">
          <button
            className={`btn btn-sm ${filtersVisible ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFiltersVisible((v) => !v)}
          >
            ⚙ Column Filters{activeFilterCount > 0 ? ` (${activeFilterCount} active)` : ''}
            {filtersVisible ? ' ▲' : ' ▼'}
          </button>
          {activeFilterCount > 0 && !filtersVisible && (
            <button
              className="btn btn-sm btn-secondary"
              style={{ color: 'var(--danger)' }}
              onClick={clearAllFilters}
            >
              Clear {activeFilterCount} filter{activeFilterCount !== 1 ? 's' : ''}
            </button>
          )}
        </div>
      )}
      <div className="table-wrapper">
        {sorted.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📋</div>
            <p>{emptyMessage}</p>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                {columns.map((col) => {
                  const isSorted = sortKey === col.key;
                  const sortable = col.sortable !== false;
                  return (
                    <th
                      key={col.key}
                      className={`${sortable ? 'sortable' : ''} ${isSorted ? 'sort-active' : ''} ${col.headerClass || ''}`}
                      onClick={sortable ? () => handleSort(col.key) : undefined}
                      style={col.headerStyle}
                    >
                      {col.label}
                      {sortable && (
                        <span className="sort-indicator">
                          {isSorted ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ' ↕'}
                        </span>
                      )}
                    </th>
                  );
                })}
              </tr>
              {hasFilterRow && filtersVisible && (
                <tr className="col-filter-row">
                  {columns.map((col) => (
                    <th key={col.key} style={{ position: 'relative' }}>
                      {col.filterType === 'text' && (
                        <input
                          type="text"
                          className="col-filter-input"
                          placeholder="Search…"
                          value={colFilters[col.key] || ''}
                          onChange={(e) => handleTextFilter(col.key, e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      )}
                      {col.filterType === 'multiselect' && (
                        <ColMultiSelect
                          options={uniqueValues[col.key] || []}
                          selected={colFilters[col.key] || []}
                          onChange={(val) => handleMultiselectFilter(col.key, val)}
                        />
                      )}
                      {col.filterType === 'number' && (
                        <div className="col-filter-number">
                          <span>≥</span>
                          <input
                            type="number"
                            placeholder="min"
                            value={(colFilters[col.key] || {}).gte || ''}
                            onChange={(e) => handleNumberFilter(col.key, 'gte', e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                          />
                          <span>≤</span>
                          <input
                            type="number"
                            placeholder="max"
                            value={(colFilters[col.key] || {}).lte || ''}
                            onChange={(e) => handleNumberFilter(col.key, 'lte', e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                          />
                          {((colFilters[col.key] || {}).gte || (colFilters[col.key] || {}).lte) && (
                            <button
                              className="col-filter-clear-btn"
                              onClick={(e) => { e.stopPropagation(); clearNumberFilter(col.key); }}
                              title="Clear filter"
                            >
                              ×
                            </button>
                          )}
                        </div>
                      )}
                    </th>
                  ))}
                </tr>
              )}
            </thead>
            <tbody>
              {pageRows.map((row, i) => (
                <tr key={i}>
                  {columns.map((col) => (
                    <td key={col.key} className={col.cellClass || ''} style={col.cellStyle}>
                      {col.render ? col.render(row) : row[col.key] ?? '—'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {sorted.length > 0 && (
        <div className="pagination">
          <span>
            {filtered.length} row{filtered.length !== 1 ? 's' : ''}
            {activeFilterCount > 0 && sorted.length !== filtered.length &&
              ` (filtered from ${sorted.length})`}
            {' '}— showing {filtered.length > 0 ? pageStart + 1 : 0}–{pageEnd}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {activeFilterCount > 0 && filtersVisible && (
              <span className="table-filter-active-note">
                <button onClick={clearAllFilters}>Clear all filters</button>
              </span>
            )}
            {showExport && (
              <button className="btn btn-secondary btn-sm" onClick={handleExport}>
                Export CSV
              </button>
            )}
            <div className="pagination-controls">
              <button onClick={() => setPage(1)} disabled={safePage === 1}>«</button>
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={safePage === 1}>‹</button>
              <span className="page-num">Page {safePage} / {totalPages}</span>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={safePage === totalPages}>›</button>
              <button onClick={() => setPage(totalPages)} disabled={safePage === totalPages}>»</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
