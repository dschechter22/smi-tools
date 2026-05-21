import React, { useState, useMemo } from 'react';
import FilterBar, { buildDefaultFilters, applyFilters, countActiveFilters } from './FilterBar.jsx';
import OverviewTab from './tabs/OverviewTab.jsx';
import UnderpaymentTab from './tabs/UnderpaymentTab.jsx';
import DollarImpactTab from './tabs/DollarImpactTab.jsx';
import DenialAnalysisTab from './tabs/DenialAnalysisTab.jsx';
import ReDenialTab from './tabs/ReDenialTab.jsx';
import LocationComparisonTab from './tabs/LocationComparisonTab.jsx';
import PatientInsuranceSplitTab from './tabs/PatientInsuranceSplitTab.jsx';
import AtbAnalysisTab from './tabs/AtbAnalysisTab.jsx';

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'underpayment', label: 'Underpayment' },
  { id: 'dollar-impact', label: 'Dollar Impact' },
  { id: 'denial-analysis', label: 'Denial Analysis' },
  { id: 'redenial', label: 'Re-denial' },
  { id: 'location', label: 'Location Comparison' },
  { id: 'pt-ins-split', label: 'Pt vs Ins Split' },
  { id: 'atb', label: 'ATB Analysis' },
];

export default function Dashboard({ rawData, columnMeta, fileName, onReset, benchmarkMethod, onBenchmarkMethodChange }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [filters, setFilters] = useState(() => buildDefaultFilters());
  const [atbRawRows, setAtbRawRows] = useState(null);
  const [atbFileName, setAtbFileName] = useState('');

  const filteredData = useMemo(
    () => applyFilters(rawData, filters),
    [rawData, filters]
  );

  const activeFilterCount = countActiveFilters(filters);

  const handleClearAll = () => setFilters(buildDefaultFilters());

  function renderTab() {
    switch (activeTab) {
      case 'overview':
        return <OverviewTab filteredData={filteredData} />;
      case 'underpayment':
        return (
          <UnderpaymentTab
            filteredData={filteredData}
            benchmarkMethod={benchmarkMethod}
            onBenchmarkMethodChange={onBenchmarkMethodChange}
          />
        );
      case 'dollar-impact':
        return <DollarImpactTab filteredData={filteredData} benchmarkMethod={benchmarkMethod} />;
      case 'denial-analysis':
        return <DenialAnalysisTab filteredData={filteredData} />;
      case 'redenial':
        return <ReDenialTab filteredData={filteredData} />;
      case 'location':
        return <LocationComparisonTab filteredData={filteredData} />;
      case 'pt-ins-split':
        return <PatientInsuranceSplitTab filteredData={filteredData} />;
      case 'atb':
        return (
          <AtbAnalysisTab
            atbRawRows={atbRawRows}
            atbFileName={atbFileName}
            onAtbDataLoaded={(rows, name) => { setAtbRawRows(rows); setAtbFileName(name || ''); }}
          />
        );
      default:
        return null;
    }
  }

  return (
    <div className="app-body">
      {/* Filter Bar */}
      <FilterBar
        columnMeta={columnMeta}
        filters={filters}
        onFilterChange={setFilters}
        onClearAll={handleClearAll}
      />

      {/* Data context row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: 'var(--text-muted)' }}>
        <span>
          📁 <strong>{fileName}</strong>
        </span>
        <span>·</span>
        <span>
          <strong style={{ color: 'var(--primary)', fontFamily: 'var(--font-mono)' }}>
            {filteredData.length.toLocaleString()}
          </strong>{' '}
          / {rawData.length.toLocaleString()} rows
          {activeFilterCount > 0 && (
            <span style={{ color: 'var(--warning)', marginLeft: 4 }}>
              ({activeFilterCount} filter{activeFilterCount !== 1 ? 's' : ''} active)
            </span>
          )}
        </span>
        <span>·</span>
        <button
          className="btn btn-secondary btn-sm"
          onClick={onReset}
          title="Load a different file"
        >
          ↩ Load New File
        </button>
      </div>

      {/* Tab Bar */}
      <div className="tab-bar">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`tab-btn ${activeTab === t.id ? 'active' : ''}`}
            onClick={() => setActiveTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div>{renderTab()}</div>
    </div>
  );
}
