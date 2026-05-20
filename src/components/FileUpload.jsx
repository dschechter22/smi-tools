import React, { useRef, useState, useCallback } from 'react';
import { parseFile } from '../utils/parseFile.js';

export default function FileUpload({ onDataLoaded }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(null);
  const [statusText, setStatusText] = useState('');
  const [error, setError] = useState('');

  const handleFile = useCallback(
    async (file) => {
      if (!file) return;
      setError('');
      setLoading(true);
      setProgress(0);
      setStatusText('Starting…');
      try {
        const result = await parseFile(file, (pct, status) => {
          setProgress(pct);
          if (status) setStatusText(status);
        });
        onDataLoaded(result, file.name);
      } catch (err) {
        setError(err.message || 'Failed to parse file. Please check the format.');
      } finally {
        setLoading(false);
        setProgress(null);
        setStatusText('');
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
      handleFile(e.dataTransfer.files?.[0]);
    },
    [handleFile]
  );

  const onDragOver = (e) => { e.preventDefault(); setDragging(true); };
  const onDragLeave = () => setDragging(false);

  return (
    <div className="upload-screen">
      {loading && (
        <div className="loading-overlay">
          <div className="loading-card">
            <div className="progress-status">{statusText || 'Parsing file…'}</div>
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
            <div className="progress-note">
              Processing in background — UI stays responsive
            </div>
          </div>
        </div>
      )}

      <div className="upload-card">
        <h2>Hospital Payment Analyzer</h2>
        <p>
          Upload a CSV or Excel file with revenue cycle data. All processing happens in your
          browser — no data is ever transmitted or stored.
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
            accept=".csv,.xlsx,.xls,.txt,.tsv"
            onChange={onInputChange}
          />
          <div className="upload-icon">📂</div>
          <h3>Drop file here or click to browse</h3>
          <p>Supported: CSV, Excel (.xlsx / .xls), TSV, TXT</p>
          <button
            className="btn btn-primary"
            onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }}
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
