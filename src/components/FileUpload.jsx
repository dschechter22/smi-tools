import React, { useRef, useState, useCallback } from 'react';
import { parseFile } from '../utils/parseFile.js';

export default function FileUpload({ onDataLoaded }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleFile = useCallback(
    async (file) => {
      if (!file) return;
      setError('');
      setLoading(true);
      try {
        const result = await parseFile(file);
        if (result.rows.length === 0) {
          throw new Error('The file appears to be empty or has no valid rows.');
        }
        onDataLoaded(result, file.name);
      } catch (err) {
        setError(err.message || 'Failed to parse file. Please check the format.');
      } finally {
        setLoading(false);
      }
    },
    [onDataLoaded]
  );

  const onInputChange = (e) => {
    handleFile(e.target.files?.[0]);
    e.target.value = '';
  };

  const onDrop = useCallback(
    (e) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files?.[0];
      handleFile(file);
    },
    [handleFile]
  );

  const onDragOver = (e) => {
    e.preventDefault();
    setDragging(true);
  };

  const onDragLeave = () => setDragging(false);

  return (
    <div className="upload-screen">
      {loading && (
        <div className="loading-overlay">
          <div className="loading-card">
            <div className="spinner" />
            <div style={{ fontWeight: 600, color: 'var(--primary)' }}>Parsing file…</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
              Large files may take a moment
            </div>
          </div>
        </div>
      )}

      <div className="upload-card">
        <h2>Hospital Payment Analyzer</h2>
        <p>
          Upload a CSV or Excel file with revenue cycle data. All processing happens in your browser
          — no data is ever transmitted or stored.
        </p>

        <div
          className={`upload-dropzone ${dragging ? 'drag-over' : ''}`}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onClick={() => inputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={onInputChange}
          />
          <div className="upload-icon">📂</div>
          <h3>Drop file here or click to browse</h3>
          <p>Supported formats: CSV, Excel (.xlsx, .xls)</p>
          <button
            className="btn btn-primary"
            onClick={(e) => {
              e.stopPropagation();
              inputRef.current?.click();
            }}
          >
            Select File
          </button>
        </div>

        {error && <div className="upload-error">⚠ {error}</div>}

        <div className="upload-formats">
          <strong>Required columns:</strong> Location_State, LocationName, PrimIns, PrimInsType,
          Modality, CPTCode, FirstDenialGroup, FirstDenialCode, LastDenialGroup, LastDenialCode,
          ChgStatus, ChgCt, ChgAmt, PmtAmt, Balance, InsPmtAmt, PtPmtAmt
        </div>
      </div>
    </div>
  );
}
