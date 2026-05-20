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

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * pageSize;
  const pageEnd = Math.min(pageStart + pageSize, sorted.length);
  const pageRows = sorted.slice(pageStart, pageEnd);

  const handleExport = () => {
    downloadCSV(columns, sorted, exportFilename);
  };

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
            {sorted.length} row{sorted.length !== 1 ? 's' : ''} — showing {pageStart + 1}–{pageEnd}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
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
