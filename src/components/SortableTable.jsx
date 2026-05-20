import React, { useState, useMemo, useCallback } from 'react';

function downloadCSV(columns, data, filename = 'export.csv') {
  const headers = columns.map((c) => c.label).join(',');
  const rows = data.map((row) =>
    columns
      .map((c) => {
        const rawVal = c.csvValue ? c.csvValue(row) : row[c.key];
        const val = rawVal == null ? '' : String(rawVal);
        // Escape quotes and wrap if needed
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

  const sorted = useMemo(() => {
    if (!sortKey) return data;
    return [...data].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      const cmp = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv));
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [data, sortKey, sortDir]);

  const hasActiveFilters = useMemo(() => {
    return Object.values(colFilters).some((f) => {
      if (!f) return false;
      if (typeof f === 'string') return f.trim() !== '';
      if (typeof f === 'object') return (f.gte != null && f.gte !== '') || (f.lte != null && f.lte !== '');
      return false;
    });
  }, [colFilters]);

  const filtered = useMemo(() => {
    if (!hasActiveFilters) return sorted;
    return sorted.filter((row) => {
      for (const col of columns) {
        if (!col.filterType) continue;
        const filter = colFilters[col.key];
        if (!filter) continue;
        const rawVal = row[col.key];
        if (col.filterType === 'text') {
          if (typeof filter === 'string' && filter.trim() !== '') {
            const search = filter.trim().toLowerCase();
            const val = rawVal == null ? '' : String(rawVal).toLowerCase();
            if (!val.includes(search)) return false;
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
  }, [sorted, colFilters, columns, hasActiveFilters]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * pageSize;
  const pageEnd = Math.min(pageStart + pageSize, filtered.length);
  const pageRows = filtered.slice(pageStart, pageEnd);

  const handleExport = () => {
    downloadCSV(columns, filtered, exportFilename);
  };

  const handleTextFilter = (key, value) => {
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
              {hasFilterRow && (
                <tr className="col-filter-row">
                  {columns.map((col) => (
                    <th key={col.key}>
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
            {hasActiveFilters && sorted.length !== filtered.length && ` (filtered from ${sorted.length})`}
            {' '}— showing {filtered.length > 0 ? pageStart + 1 : 0}–{pageEnd}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {hasActiveFilters && (
              <span className="table-filter-active-note">
                <button onClick={clearAllFilters}>Clear filters</button>
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
              <span className="page-num">
                Page {safePage} / {totalPages}
              </span>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={safePage === totalPages}>›</button>
              <button onClick={() => setPage(totalPages)} disabled={safePage === totalPages}>»</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
