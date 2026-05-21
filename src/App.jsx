import React, { useState, useCallback } from 'react';
import FileUpload from './components/FileUpload.jsx';
import Dashboard from './components/Dashboard.jsx';
import AtbAnalysisTab from './components/tabs/AtbAnalysisTab.jsx';

export default function App() {
  const [mode, setMode] = useState('payment');
  const [rawData, setRawData] = useState(null);
  const [columnMeta, setColumnMeta] = useState(null);
  const [fileName, setFileName] = useState('');
  const [benchmarkMethod, setBenchmarkMethod] = useState('mean');
  const [atbRawRows, setAtbRawRows] = useState(null);
  const [atbFileName, setAtbFileName] = useState('');

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
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div className="mode-switcher">
            <button className={mode === 'payment' ? 'active' : ''} onClick={() => setMode('payment')}>
              Payment Analyzer
            </button>
            <button className={mode === 'atb' ? 'active' : ''} onClick={() => setMode('atb')}>
              ATB Analysis
            </button>
          </div>
          <span className="header-badge">PHI Safe</span>
        </div>
      </header>

      {mode === 'payment' ? (
        rawData === null ? (
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
        )
      ) : (
        <AtbAnalysisTab
          atbRawRows={atbRawRows}
          atbFileName={atbFileName}
          onAtbDataLoaded={(rows, name) => { setAtbRawRows(rows); setAtbFileName(name || ''); }}
        />
      )}
    </>
  );
}
