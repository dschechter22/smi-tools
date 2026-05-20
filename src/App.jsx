import React, { useState, useCallback } from 'react';
import FileUpload from './components/FileUpload.jsx';
import Dashboard from './components/Dashboard.jsx';

export default function App() {
  const [rawData, setRawData] = useState(null);
  const [columnMeta, setColumnMeta] = useState(null);
  const [fileName, setFileName] = useState('');
  const [benchmarkMethod, setBenchmarkMethod] = useState('mean');

  const handleDataLoaded = useCallback(({ rows, columnMeta }, name) => {
    setRawData(rows);
    setColumnMeta(columnMeta);
    setFileName(name);
  }, []);

  const handleReset = useCallback(() => {
    setRawData(null);
    setColumnMeta(null);
    setFileName('');
  }, []);

  return (
    <>
      <header className="app-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1>Hospital Payment Analyzer</h1>
          </div>
          <div className="header-sub">Revenue Cycle Analysis · Browser-only · No data leaves your device</div>
        </div>
        <span className="header-badge">PHI Safe</span>
      </header>

      {rawData === null ? (
        <FileUpload onDataLoaded={handleDataLoaded} />
      ) : (
        <Dashboard
          rawData={rawData}
          columnMeta={columnMeta}
          fileName={fileName}
          onReset={handleReset}
          benchmarkMethod={benchmarkMethod}
          onBenchmarkMethodChange={setBenchmarkMethod}
        />
      )}
    </>
  );
}
