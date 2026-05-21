import React, { useMemo } from 'react';
import { hasDenialCode } from '../../utils/atbCalculations.js';
import { fmt$ } from '../../utils/format.js';

// Reference benchmarks — shown as context, not hard rules
const BENCH = {
  pct90:      { warn: 25, crit: 40 },
  pct120:     { warn: 15, crit: 30 },
  pct365:     { warn: 5,  crit: 10 },
  denialRate: { warn: 15, crit: 25 },
  avgDosAge:  { warn: 90, crit: 120 },
  avgFileAge: { warn: 75, crit: 120 },
  avgMadAge:  { warn: 60, crit: 90  },
  billingLag: { warn: 14, crit: 30  },
};

function getStatus(val, bench) {
  if (val == null || !bench) return null;
  if (val >= bench.crit) return 'crit';
  if (val >= bench.warn) return 'warn';
  return 'ok';
}

const STATUS_COLOR = {
  crit: 'var(--danger)',
  warn: 'var(--orange)',
  ok:   'var(--success)',
};
const STATUS_LABEL = { crit: 'Critical', warn: 'Warning', ok: 'On Track' };
const STATUS_CLASS = { crit: 'issue-flag-crit', warn: 'issue-flag-warn', ok: 'kpi-flag-ok' };

function KpiCard({ label, primary, secondary, benchKey, description }) {
  const status = getStatus(
    typeof primary === 'number' ? primary : null,
    benchKey ? BENCH[benchKey] : null,
  );
  const color = status ? STATUS_COLOR[status] : 'var(--text)';

  return (
    <div className="kpi-card">
      <div className="kpi-card-label">{label}</div>
      <div className="kpi-card-value" style={{ color }}>
        {primary != null ? primary : '—'}
      </div>
      {secondary != null && <div className="kpi-card-secondary">{secondary}</div>}
      {status && (
        <div style={{ marginTop: 6 }}>
          <span className={`issue-flag ${STATUS_CLASS[status]}`}>{STATUS_LABEL[status]}</span>
        </div>
      )}
      {description && <div className="kpi-card-desc">{description}</div>}
    </div>
  );
}

function KpiSection({ title, children }) {
  return (
    <div className="panel">
      <div className="panel-header"><span className="panel-title">{title}</span></div>
      <div className="kpi-card-grid">{children}</div>
    </div>
  );
}

export default function KpiTab({ filteredData }) {
  const kpis = useMemo(() => {
    let totalBal = 0;
    let bal90 = 0, bal120 = 0, bal365 = 0;
    let deniedBal = 0, unbilledBal = 0;
    let dosAgeSum = 0, dosAgeN = 0;
    let fileAgeSum = 0, fileAgeN = 0;
    let madAgeSum = 0, madAgeN = 0;
    let lagSum = 0, lagN = 0;
    let totalClaims = 0;

    for (const r of filteredData) {
      const bal = r._balance;
      totalBal += bal;
      totalClaims++;

      if (r._dosAge != null) {
        dosAgeSum += r._dosAge; dosAgeN++;
        if (r._dosAge > 90)  bal90  += bal;
        if (r._dosAge > 120) bal120 += bal;
        if (r._dosAge > 365) bal365 += bal;
      }

      if (hasDenialCode(r)) deniedBal += bal;
      if (r._isUnbilled)    unbilledBal += bal;

      const mad = parseFloat(r['MAD Age']);
      if (!isNaN(mad)) { madAgeSum += mad; madAgeN++; }

      if (r._initialFileDateAge != null) { fileAgeSum += r._initialFileDateAge; fileAgeN++; }

      // Billing lag only for billed AR where both dates are present
      if (!r._isUnbilled && r._dosAge != null && r._initialFileDateAge != null) {
        const lag = r._dosAge - r._initialFileDateAge;
        if (lag >= 0) { lagSum += lag; lagN++; }
      }
    }

    const pct = (n) => (totalBal > 0 ? (n / totalBal) * 100 : null);

    return {
      totalBal,
      totalClaims,
      pct90:      pct(bal90),
      pct120:     pct(bal120),
      pct365:     pct(bal365),
      bal90, bal120, bal365,
      denialRate: pct(deniedBal),
      deniedBal,
      unbilledPct: pct(unbilledBal),
      unbilledBal,
      avgDosAge:  dosAgeN  > 0 ? Math.round(dosAgeSum  / dosAgeN)  : null,
      avgFileAge: fileAgeN > 0 ? Math.round(fileAgeSum / fileAgeN) : null,
      avgMadAge:  madAgeN  > 0 ? Math.round(madAgeSum  / madAgeN)  : null,
      avgBillingLag: lagN > 0 ? Math.round(lagSum / lagN) : null,
    };
  }, [filteredData]);

  if (filteredData.length === 0) {
    return <div className="empty-state"><p>No data matches current filters.</p></div>;
  }

  const fmtPct1 = (v) => (v != null ? `${v.toFixed(1)}%` : null);

  return (
    <div className="section-gap">

      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
        Based on <strong>{kpis.totalClaims.toLocaleString()}</strong> claims · Total open balance: <strong style={{ color: 'var(--danger)' }}>{fmt$(kpis.totalBal)}</strong>
        <span style={{ marginLeft: 12, fontStyle: 'italic' }}>Status badges are reference benchmarks — not hard rules.</span>
      </div>

      {/* Aging Exposure */}
      <KpiSection title="Aging Exposure — % of AR$ by DOS Age">
        <KpiCard
          label="% AR > 90 Days (DOS)"
          primary={kpis.pct90 != null ? parseFloat(kpis.pct90.toFixed(1)) : null}
          secondary={kpis.bal90 > 0 ? fmt$(kpis.bal90) : null}
          benchKey="pct90"
          description="Share of total open balance with DOS > 90 days"
        />
        <KpiCard
          label="% AR > 120 Days (DOS)"
          primary={kpis.pct120 != null ? parseFloat(kpis.pct120.toFixed(1)) : null}
          secondary={kpis.bal120 > 0 ? fmt$(kpis.bal120) : null}
          benchKey="pct120"
          description="Share of total open balance with DOS > 120 days"
        />
        <KpiCard
          label="% AR > 365 Days (DOS)"
          primary={kpis.pct365 != null ? parseFloat(kpis.pct365.toFixed(1)) : null}
          secondary={kpis.bal365 > 0 ? fmt$(kpis.bal365) : null}
          benchKey="pct365"
          description="Share of total open balance with DOS > 365 days — high write-off risk"
        />
      </KpiSection>

      {/* AR Composition */}
      <KpiSection title="AR Composition">
        <KpiCard
          label="Unbilled AR"
          primary={fmtPct1(kpis.unbilledPct)}
          secondary={fmt$(kpis.unbilledBal)}
          description="Percentage of total open balance not yet submitted to payer"
        />
        <KpiCard
          label="% AR with Denials"
          primary={kpis.denialRate != null ? parseFloat(kpis.denialRate.toFixed(1)) : null}
          secondary={kpis.deniedBal > 0 ? fmt$(kpis.deniedBal) : null}
          benchKey="denialRate"
          description="Share of total open balance classified as denied"
        />
      </KpiSection>

      {/* Average Age Metrics */}
      <KpiSection title="Average Age Metrics">
        <KpiCard
          label="Avg Days Since DOS"
          primary={kpis.avgDosAge != null ? parseFloat(kpis.avgDosAge) : null}
          secondary={kpis.avgDosAge != null ? `${kpis.avgDosAge} days` : null}
          benchKey="avgDosAge"
          description="Average age of all open claims from date of service"
        />
        <KpiCard
          label="Avg Days Since Initial File"
          primary={kpis.avgFileAge != null ? parseFloat(kpis.avgFileAge) : null}
          secondary={kpis.avgFileAge != null ? `${kpis.avgFileAge} days` : null}
          benchKey="avgFileAge"
          description="Average age from initial file date to today"
        />
        <KpiCard
          label="Average MAD Age"
          primary={kpis.avgMadAge != null ? parseFloat(kpis.avgMadAge) : null}
          secondary={kpis.avgMadAge != null ? `${kpis.avgMadAge} days` : null}
          benchKey="avgMadAge"
          description="Average Most Aged Date across all open claims"
        />
        <KpiCard
          label="Avg Billing Lag"
          primary={kpis.avgBillingLag != null ? parseFloat(kpis.avgBillingLag) : null}
          secondary={kpis.avgBillingLag != null ? `${kpis.avgBillingLag} days` : null}
          benchKey="billingLag"
          description="Avg days from DOS to initial file date (billed AR only)"
        />
      </KpiSection>

    </div>
  );
}
