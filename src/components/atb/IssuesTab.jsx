import React, { useMemo, useState } from 'react';
import {
  buildBucketBreakdown, STANDARD_BUCKET_ORDER, BALANCE_TIER_ORDER,
  hasDenialCode,
} from '../../utils/atbCalculations.js';
import SortableTable from '../SortableTable.jsx';
import DrillAnalyticsPanel from './DrillAnalyticsPanel.jsx';
import { fmt$, fmtPct } from '../../utils/format.js';

// ── Thresholds ────────────────────────────────────────────────────────────────

const T = {
  MAD_CRIT: 120, MAD_WARN: 60,
  FILE_AGE_CRIT: 90, FILE_AGE_WARN: 60,
  DENIAL_RATE_CRIT: 25, DENIAL_RATE_WARN: 15,
  RESP_RATE_CRIT: 25, RESP_RATE_WARN: 50,
  BILLING_LAG_CRIT: 30, BILLING_LAG_WARN: 14,
  STALE_DOS_CRIT: 60, STALE_DOS_WARN: 30,
  HIGH_VALUE: 2500,
  MIN_CLAIMS: 5,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function flag(value, warnThreshold, critThreshold, reverse = false) {
  if (value == null) return null;
  const isCrit = reverse ? value <= critThreshold : value >= critThreshold;
  const isWarn = reverse ? value <= warnThreshold : value >= warnThreshold;
  if (isCrit) return <span className="issue-flag issue-flag-crit">Critical</span>;
  if (isWarn) return <span className="issue-flag issue-flag-warn">Warning</span>;
  return null;
}

function ageBadge(days) {
  if (days == null) return '—';
  const f = flag(days, T.MAD_WARN, T.MAD_CRIT);
  return <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>{days}d {f}</span>;
}

// ── Section wrapper ───────────────────────────────────────────────────────────

function IssueSection({ title, subtitle, alertCount, children }) {
  return (
    <div className="panel">
      <div className="panel-header" style={{ flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="panel-title">{title}</span>
          {alertCount > 0 && (
            <span className="issue-flag issue-flag-crit">{alertCount} alert{alertCount !== 1 ? 's' : ''}</span>
          )}
        </div>
        {subtitle && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{subtitle}</span>}
      </div>
      {children}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function IssuesTab({ filteredData }) {
  const [drill, setDrill] = useState(null); // { rows, title, subtitle }

  const billedRows   = useMemo(() => filteredData.filter((r) => !r._isUnbilled), [filteredData]);
  const unbilledRows = useMemo(() => filteredData.filter((r) => r._isUnbilled),  [filteredData]);
  const denialRows   = useMemo(() => filteredData.filter(hasDenialCode),          [filteredData]);

  const openDrill = (rows, title, subtitle) => setDrill({ rows, title, subtitle });
  const closeDrill = () => setDrill(null);

  // ── 1. Aged Billed AR — By Carrier ─────────────────────────────────────────
  const agedCarriers = useMemo(() => {
    const map = {};
    for (const r of billedRows) {
      const c = r._carrier || '(Unknown)';
      if (!map[c]) map[c] = { carrier: c, balance: 0, count: 0, madSum: 0, madN: 0, fileAgeSum: 0, fileAgeN: 0 };
      const g = map[c];
      g.balance += r._balance; g.count++;
      const mad = parseFloat(r['MAD Age']);
      if (!isNaN(mad)) { g.madSum += mad; g.madN++; }
      if (r._initialFileDateAge != null) { g.fileAgeSum += r._initialFileDateAge; g.fileAgeN++; }
    }
    return Object.values(map).map((g) => ({
      carrier: g.carrier, balance: g.balance, count: g.count,
      avgMadAge: g.madN > 0 ? Math.round(g.madSum / g.madN) : null,
      avgFileAge: g.fileAgeN > 0 ? Math.round(g.fileAgeSum / g.fileAgeN) : null,
    })).filter((r) => r.count >= T.MIN_CLAIMS).sort((a, b) => (b.avgMadAge || 0) - (a.avgMadAge || 0));
  }, [billedRows]);

  const agedCarrierAlerts = agedCarriers.filter((r) => (r.avgMadAge || 0) >= T.MAD_WARN || (r.avgFileAge || 0) >= T.FILE_AGE_WARN).length;

  // ── 2. Aged Billed AR — By Plan ────────────────────────────────────────────
  const agedPlans = useMemo(() => {
    const map = {};
    for (const r of billedRows) {
      const p = String(r.InsurancePlanDescription || '').trim() || '(Unknown)';
      if (!map[p]) map[p] = { plan: p, carrier: r._carrier || '', balance: 0, count: 0, madSum: 0, madN: 0, fileAgeSum: 0, fileAgeN: 0 };
      const g = map[p];
      g.balance += r._balance; g.count++;
      const mad = parseFloat(r['MAD Age']);
      if (!isNaN(mad)) { g.madSum += mad; g.madN++; }
      if (r._initialFileDateAge != null) { g.fileAgeSum += r._initialFileDateAge; g.fileAgeN++; }
    }
    return Object.values(map).map((g) => ({
      plan: g.plan, carrier: g.carrier, balance: g.balance, count: g.count,
      avgMadAge: g.madN > 0 ? Math.round(g.madSum / g.madN) : null,
      avgFileAge: g.fileAgeN > 0 ? Math.round(g.fileAgeSum / g.fileAgeN) : null,
    })).filter((r) => r.count >= T.MIN_CLAIMS).sort((a, b) => (b.avgMadAge || 0) - (a.avgMadAge || 0));
  }, [billedRows]);

  const agedPlanAlerts = agedPlans.filter((r) => (r.avgMadAge || 0) >= T.MAD_WARN || (r.avgFileAge || 0) >= T.FILE_AGE_WARN).length;

  // ── 3. Stale Unbilled Claims ────────────────────────────────────────────────
  const staleUnbilled = useMemo(() => {
    const map = {};
    for (const r of unbilledRows) {
      if ((r._dosAge || 0) < T.STALE_DOS_WARN) continue;
      const c = r._carrier || '(Unknown)';
      if (!map[c]) map[c] = { carrier: c, balance: 0, count: 0, maxDosAge: 0 };
      const g = map[c];
      g.balance += r._balance; g.count++;
      if ((r._dosAge || 0) > g.maxDosAge) g.maxDosAge = r._dosAge;
    }
    return Object.values(map).sort((a, b) => b.balance - a.balance);
  }, [unbilledRows]);

  const staleAlerts = staleUnbilled.filter((r) => r.maxDosAge >= T.STALE_DOS_CRIT).length;

  // ── 4. Denial Rate — By CPT Code ───────────────────────────────────────────
  const denialByCpt = useMemo(() => {
    const billed = {}, denied = {};
    for (const r of billedRows) {
      const cpt = String(r.CPTCode || '').trim() || '(Unknown)';
      billed[cpt] = (billed[cpt] || 0) + r._balance;
    }
    for (const r of denialRows) {
      const cpt = String(r.CPTCode || '').trim() || '(Unknown)';
      if (!denied[cpt]) denied[cpt] = { balance: 0, count: 0, topCode: null, topBal: 0, codes: {} };
      denied[cpt].balance += r._balance;
      denied[cpt].count++;
      const code = String(r.FirstDenialCode || '').trim();
      if (code) {
        denied[cpt].codes[code] = (denied[cpt].codes[code] || 0) + r._balance;
        if (denied[cpt].codes[code] > denied[cpt].topBal) { denied[cpt].topCode = code; denied[cpt].topBal = denied[cpt].codes[code]; }
      }
    }
    return Object.keys(billed)
      .filter((cpt) => billed[cpt] > 0 && denied[cpt])
      .map((cpt) => ({
        cpt, billedBalance: billed[cpt],
        deniedBalance: denied[cpt].balance,
        deniedCount: denied[cpt].count,
        topCode: denied[cpt].topCode,
        denialRate: (denied[cpt].balance / billed[cpt]) * 100,
      }))
      .filter((r) => r.denialRate >= T.DENIAL_RATE_WARN)
      .sort((a, b) => b.denialRate - a.denialRate);
  }, [billedRows, denialRows]);

  const cptDenialAlerts = denialByCpt.filter((r) => r.denialRate >= T.DENIAL_RATE_CRIT).length;

  // ── 5. Denial Rate — By Carrier ────────────────────────────────────────────
  const denialByCarrier = useMemo(() => {
    const billed = {}, denied = {};
    for (const r of billedRows) {
      const c = r._carrier || '(Unknown)';
      billed[c] = (billed[c] || 0) + r._balance;
    }
    for (const r of denialRows) {
      const c = r._carrier || '(Unknown)';
      if (!denied[c]) denied[c] = { balance: 0, count: 0 };
      denied[c].balance += r._balance;
      denied[c].count++;
    }
    return Object.keys(billed)
      .filter((c) => denied[c])
      .map((c) => ({
        carrier: c,
        billedBalance: billed[c],
        deniedBalance: denied[c].balance,
        deniedCount: denied[c].count,
        denialRate: (denied[c].balance / billed[c]) * 100,
      }))
      .filter((r) => r.denialRate >= T.DENIAL_RATE_WARN)
      .sort((a, b) => b.denialRate - a.denialRate);
  }, [billedRows, denialRows]);

  const carrierDenialAlerts = denialByCarrier.filter((r) => r.denialRate >= T.DENIAL_RATE_CRIT).length;

  // ── 6. Re-denied Claims (Escalating Denials) ───────────────────────────────
  const redenials = useMemo(() => {
    const map = {};
    for (const r of denialRows) {
      const first = String(r.FirstDenialCode || '').trim();
      const last = String(r.LastDenialCode || '').trim();
      if (!first || !last || first === last) continue;
      const key = `${first} → ${last}`;
      if (!map[key]) map[key] = { pathway: key, firstCode: first, lastCode: last, balance: 0, count: 0 };
      map[key].balance += r._balance;
      map[key].count++;
    }
    return Object.values(map).sort((a, b) => b.balance - a.balance);
  }, [denialRows]);

  // ── 7. High-Value Exposed Claims ───────────────────────────────────────────
  const highValueExposed = useMemo(() =>
    filteredData
      .filter((r) => r._balance >= T.HIGH_VALUE && (r._status === 'Unresponded' || hasDenialCode(r)))
      .sort((a, b) => b._balance - a._balance)
      .slice(0, 100),
    [filteredData],
  );

  // ── 8. Carrier Response Rate Laggards ──────────────────────────────────────
  const responseLaggards = useMemo(() => {
    const map = {};
    for (const r of billedRows) {
      const c = r._carrier || '(Unknown)';
      if (!map[c]) map[c] = { carrier: c, balance: 0, total: 0, responded: 0, respondedBal: 0, unrespondedBal: 0 };
      const g = map[c];
      g.balance += r._balance; g.total++;
      if (r._status === 'Responded') { g.responded++; g.respondedBal += r._balance; }
      else g.unrespondedBal += r._balance;
    }
    return Object.values(map)
      .map((g) => ({
        carrier: g.carrier, balance: g.balance,
        responseRate: g.total > 0 ? (g.responded / g.total) * 100 : 0,
        unrespondedBalance: g.unrespondedBal,
        respondedBalance: g.respondedBal,
        claimCount: g.total,
      }))
      .filter((r) => r.claimCount >= T.MIN_CLAIMS && r.responseRate < T.RESP_RATE_WARN)
      .sort((a, b) => a.responseRate - b.responseRate);
  }, [billedRows]);

  const respAlerts = responseLaggards.filter((r) => r.responseRate < T.RESP_RATE_CRIT).length;

  // ── 9. Billing Lag (DOS → Initial File Date) ───────────────────────────────
  const billingLag = useMemo(() => {
    const map = {};
    for (const r of billedRows) {
      if (r._dosAge == null || r._initialFileDateAge == null) continue;
      const lag = r._dosAge - r._initialFileDateAge;
      if (lag < 0) continue;
      const c = r._carrier || '(Unknown)';
      if (!map[c]) map[c] = { carrier: c, lagSum: 0, lagN: 0, balance: 0 };
      map[c].lagSum += lag; map[c].lagN++; map[c].balance += r._balance;
    }
    return Object.values(map)
      .map((g) => ({ carrier: g.carrier, avgBillingLag: Math.round(g.lagSum / g.lagN), balance: g.balance, claimCount: g.lagN }))
      .filter((r) => r.claimCount >= T.MIN_CLAIMS && r.avgBillingLag >= T.BILLING_LAG_WARN)
      .sort((a, b) => b.avgBillingLag - a.avgBillingLag);
  }, [billedRows]);

  const lagAlerts = billingLag.filter((r) => r.avgBillingLag >= T.BILLING_LAG_CRIT).length;

  // ── 10. Carrier Concentration Risk ─────────────────────────────────────────
  const totalBalance = useMemo(() => filteredData.reduce((s, r) => s + r._balance, 0), [filteredData]);

  const concentrationRisk = useMemo(() => {
    const map = {};
    for (const r of filteredData) {
      const c = r._carrier || '(Unknown)';
      if (!map[c]) map[c] = { carrier: c, balance: 0, billed: 0, denied: 0, unresponded: 0, total: 0 };
      const g = map[c];
      g.balance += r._balance; g.total++;
      if (!r._isUnbilled) {
        g.billed += r._balance;
        if (hasDenialCode(r)) g.denied += r._balance;
        else if (r._status === 'Unresponded') g.unresponded += r._balance;
      }
    }
    return Object.values(map)
      .map((g) => ({
        carrier: g.carrier, balance: g.balance,
        arShare: totalBalance > 0 ? (g.balance / totalBalance) * 100 : 0,
        denialRate: g.billed > 0 ? (g.denied / g.billed) * 100 : 0,
        unrespondedRate: g.billed > 0 ? (g.unresponded / g.billed) * 100 : 0,
        claimCount: g.total,
      }))
      .filter((r) => r.arShare >= 5)
      .sort((a, b) => b.balance - a.balance);
  }, [filteredData, totalBalance]);

  const concAlerts = concentrationRisk.filter((r) => r.arShare >= 10 && r.denialRate >= T.DENIAL_RATE_WARN).length;

  if (filteredData.length === 0) return <div className="empty-state"><p>No data matches current filters.</p></div>;

  // ── Column definitions ────────────────────────────────────────────────────

  const AGED_CARRIER_COLS = [
    { key: 'carrier', label: 'Carrier', filterType: 'text' },
    { key: 'balance', label: 'Billed Balance', filterType: 'number', render: (r) => fmt$(r.balance) },
    { key: 'count', label: 'Claims', filterType: 'number' },
    {
      key: 'avgMadAge', label: 'Avg MAD Age', filterType: 'number',
      render: (r) => r.avgMadAge != null ? <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>{r.avgMadAge}d {flag(r.avgMadAge, T.MAD_WARN, T.MAD_CRIT)}</span> : '—',
    },
    {
      key: 'avgFileAge', label: 'Avg File Date Age', filterType: 'number',
      render: (r) => r.avgFileAge != null ? <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>{r.avgFileAge}d {flag(r.avgFileAge, T.FILE_AGE_WARN, T.FILE_AGE_CRIT)}</span> : '—',
    },
  ];

  const AGED_PLAN_COLS = [
    { key: 'plan', label: 'Plan', filterType: 'text' },
    { key: 'carrier', label: 'Carrier', filterType: 'text' },
    { key: 'balance', label: 'Billed Balance', filterType: 'number', render: (r) => fmt$(r.balance) },
    { key: 'count', label: 'Claims', filterType: 'number' },
    {
      key: 'avgMadAge', label: 'Avg MAD Age', filterType: 'number',
      render: (r) => r.avgMadAge != null ? <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>{r.avgMadAge}d {flag(r.avgMadAge, T.MAD_WARN, T.MAD_CRIT)}</span> : '—',
    },
    {
      key: 'avgFileAge', label: 'Avg File Date Age', filterType: 'number',
      render: (r) => r.avgFileAge != null ? <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>{r.avgFileAge}d {flag(r.avgFileAge, T.FILE_AGE_WARN, T.FILE_AGE_CRIT)}</span> : '—',
    },
  ];

  const STALE_UNBILLED_COLS = [
    { key: 'carrier', label: 'Carrier', filterType: 'text' },
    { key: 'balance', label: 'Balance', filterType: 'number', render: (r) => <span style={{ color: 'var(--danger)', fontWeight: 700 }}>{fmt$(r.balance)}</span> },
    { key: 'count', label: 'Claims', filterType: 'number' },
    {
      key: 'maxDosAge', label: 'Max DOS Age', filterType: 'number',
      render: (r) => <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>{r.maxDosAge}d {flag(r.maxDosAge, T.STALE_DOS_WARN, T.STALE_DOS_CRIT)}</span>,
    },
  ];

  const DENIAL_CPT_COLS = [
    { key: 'cpt', label: 'CPT Code', filterType: 'text' },
    { key: 'billedBalance', label: 'Billed Balance', filterType: 'number', render: (r) => fmt$(r.billedBalance) },
    { key: 'deniedBalance', label: 'Denied Balance', filterType: 'number', render: (r) => <span style={{ color: 'var(--danger)' }}>{fmt$(r.deniedBalance)}</span> },
    { key: 'deniedCount', label: 'Denied Claims', filterType: 'number' },
    {
      key: 'denialRate', label: 'Denial Rate', filterType: 'number',
      render: (r) => <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>{r.denialRate.toFixed(1)}% {flag(r.denialRate, T.DENIAL_RATE_WARN, T.DENIAL_RATE_CRIT)}</span>,
    },
    {
      key: 'topCode', label: 'Top Denial Code', filterType: 'text',
      render: (r) => r.topCode ? <span className="badge badge-yellow">{r.topCode}</span> : '—',
    },
  ];

  const DENIAL_CARRIER_COLS = [
    { key: 'carrier', label: 'Carrier', filterType: 'text' },
    { key: 'billedBalance', label: 'Billed Balance', filterType: 'number', render: (r) => fmt$(r.billedBalance) },
    { key: 'deniedBalance', label: 'Denied Balance', filterType: 'number', render: (r) => <span style={{ color: 'var(--danger)' }}>{fmt$(r.deniedBalance)}</span> },
    { key: 'deniedCount', label: 'Denied Claims', filterType: 'number' },
    {
      key: 'denialRate', label: 'Denial Rate', filterType: 'number',
      render: (r) => <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>{r.denialRate.toFixed(1)}% {flag(r.denialRate, T.DENIAL_RATE_WARN, T.DENIAL_RATE_CRIT)}</span>,
    },
  ];

  const REDENIAL_COLS = [
    { key: 'pathway', label: 'Pathway (First → Last Code)', filterType: 'text' },
    { key: 'balance', label: 'Balance', filterType: 'number', render: (r) => <span style={{ color: 'var(--danger)', fontWeight: 700 }}>{fmt$(r.balance)}</span> },
    { key: 'count', label: 'Claims', filterType: 'number' },
  ];

  const HIGH_VALUE_COLS = [
    { key: '_status', label: 'Status', filterType: 'multiselect', render: (r) => <span className={`badge ${hasDenialCode(r) ? 'badge-red' : 'badge-orange'}`}>{hasDenialCode(r) ? 'Denied' : r._status}</span> },
    { key: '_carrier', label: 'Carrier', filterType: 'text' },
    { key: 'InsurancePlanDescription', label: 'Plan', filterType: 'text' },
    { key: 'CPTCode', label: 'CPT', filterType: 'text' },
    { key: '_balance', label: 'Balance', filterType: 'number', render: (r) => <span style={{ color: 'var(--danger)', fontWeight: 700 }}>{fmt$(r._balance)}</span>, csvValue: (r) => r._balance?.toFixed(2) },
    { key: '_dosAge', label: 'DOS Age', filterType: 'number', render: (r) => r._dosAge != null ? `${r._dosAge}d` : '—' },
    { key: 'MAD Aging Bucket', label: 'MAD Bucket', filterType: 'multiselect' },
    { key: 'FirstDenialCode', label: 'Denial Code', filterType: 'text', render: (r) => r.FirstDenialCode && String(r.FirstDenialCode).trim() ? <span className="badge badge-yellow">{r.FirstDenialCode}</span> : '—' },
  ];

  const RESP_LAGGARD_COLS = [
    { key: 'carrier', label: 'Carrier', filterType: 'text' },
    { key: 'balance', label: 'Billed Balance', filterType: 'number', render: (r) => fmt$(r.balance) },
    { key: 'unrespondedBalance', label: 'Unresponded', filterType: 'number', render: (r) => <span style={{ color: 'var(--orange)' }}>{fmt$(r.unrespondedBalance)}</span> },
    { key: 'claimCount', label: 'Claims', filterType: 'number' },
    {
      key: 'responseRate', label: 'Response Rate', filterType: 'number',
      render: (r) => <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>{r.responseRate.toFixed(1)}% {flag(r.responseRate, T.RESP_RATE_WARN, T.RESP_RATE_CRIT, true)}</span>,
    },
  ];

  const BILLING_LAG_COLS = [
    { key: 'carrier', label: 'Carrier', filterType: 'text' },
    { key: 'balance', label: 'Balance', filterType: 'number', render: (r) => fmt$(r.balance) },
    { key: 'claimCount', label: 'Claims', filterType: 'number' },
    {
      key: 'avgBillingLag', label: 'Avg Billing Lag (DOS → Filed)', filterType: 'number',
      render: (r) => <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>{r.avgBillingLag}d {flag(r.avgBillingLag, T.BILLING_LAG_WARN, T.BILLING_LAG_CRIT)}</span>,
    },
  ];

  const CONCENTRATION_COLS = [
    { key: 'carrier', label: 'Carrier', filterType: 'text' },
    { key: 'balance', label: 'Total AR Balance', filterType: 'number', render: (r) => fmt$(r.balance) },
    {
      key: 'arShare', label: '% of Total AR', filterType: 'number',
      render: (r) => <strong style={{ color: r.arShare >= 15 ? 'var(--danger)' : 'inherit' }}>{r.arShare.toFixed(1)}%</strong>,
    },
    {
      key: 'denialRate', label: 'Denial Rate', filterType: 'number',
      render: (r) => <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>{r.denialRate.toFixed(1)}% {flag(r.denialRate, T.DENIAL_RATE_WARN, T.DENIAL_RATE_CRIT)}</span>,
    },
    {
      key: 'unrespondedRate', label: 'Unresponded Rate', filterType: 'number',
      render: (r) => `${r.unrespondedRate.toFixed(1)}%`,
    },
    { key: 'claimCount', label: 'Claims', filterType: 'number' },
  ];

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="section-gap">

      {/* Issues legend */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', fontSize: 12, color: 'var(--text-muted)', flexWrap: 'wrap' }}>
        <span>Thresholds:</span>
        <span><span className="issue-flag issue-flag-crit">Critical</span> MAD/File Age &gt;{T.MAD_CRIT}d / Denial Rate &gt;{T.DENIAL_RATE_CRIT}% / Response Rate &lt;{T.RESP_RATE_CRIT}% / Billing Lag &gt;{T.BILLING_LAG_CRIT}d</span>
        <span><span className="issue-flag issue-flag-warn">Warning</span> MAD/File Age &gt;{T.MAD_WARN}d / Denial Rate &gt;{T.DENIAL_RATE_WARN}% / Response Rate &lt;{T.RESP_RATE_WARN}% / Billing Lag &gt;{T.BILLING_LAG_WARN}d</span>
        <span style={{ marginLeft: 'auto', fontStyle: 'italic' }}>Click any row to drill into claims</span>
      </div>

      {/* 1. Aged Billed AR — By Carrier */}
      <IssueSection
        title="Aged Billed AR — By Carrier"
        subtitle={`MAD age or file date age flagged on carriers with ≥${T.MIN_CLAIMS} claims`}
        alertCount={agedCarrierAlerts}
      >
        <SortableTable
          columns={AGED_CARRIER_COLS}
          data={agedCarriers}
          pageSize={15}
          exportFilename="issues-aged-carriers.csv"
          emptyMessage="No carriers with aged billed AR in current filter."
          onRowClick={(row) => openDrill(
            billedRows.filter((r) => r._carrier === row.carrier),
            row.carrier,
            `Billed AR — Avg MAD: ${row.avgMadAge != null ? row.avgMadAge + 'd' : '—'} · Avg File Age: ${row.avgFileAge != null ? row.avgFileAge + 'd' : '—'}`,
          )}
        />
      </IssueSection>

      {/* 2. Aged Billed AR — By Plan */}
      <IssueSection
        title="Aged Billed AR — By Plan"
        subtitle={`Plan-level MAD and file date aging for plans with ≥${T.MIN_CLAIMS} claims`}
        alertCount={agedPlanAlerts}
      >
        <SortableTable
          columns={AGED_PLAN_COLS}
          data={agedPlans}
          pageSize={15}
          exportFilename="issues-aged-plans.csv"
          emptyMessage="No plans with aged billed AR in current filter."
          onRowClick={(row) => {
            const pRows = billedRows.filter((r) => {
              const p = String(r.InsurancePlanDescription || '').trim() || '(Unknown)';
              return p === row.plan;
            });
            openDrill(pRows, row.plan, `${row.carrier} — Billed AR`);
          }}
        />
      </IssueSection>

      {/* 3. Stale Unbilled Claims */}
      <IssueSection
        title="Stale Unbilled Claims"
        subtitle={`Unbilled claims with DOS age ≥ ${T.STALE_DOS_WARN} days — need immediate billing`}
        alertCount={staleAlerts}
      >
        <SortableTable
          columns={STALE_UNBILLED_COLS}
          data={staleUnbilled}
          pageSize={15}
          exportFilename="issues-stale-unbilled.csv"
          emptyMessage={`No unbilled claims older than ${T.STALE_DOS_WARN} days.`}
          onRowClick={(row) => openDrill(
            unbilledRows.filter((r) => r._carrier === row.carrier && (r._dosAge || 0) >= T.STALE_DOS_WARN),
            `${row.carrier} — Stale Unbilled`,
            `${row.count} claims · Max DOS age ${row.maxDosAge}d`,
          )}
        />
      </IssueSection>

      {/* 4. Denial Rate — By CPT Code */}
      <IssueSection
        title="Denial Rate Outliers — By CPT Code"
        subtitle={`CPT codes with denial rate ≥ ${T.DENIAL_RATE_WARN}% vs billed balance`}
        alertCount={cptDenialAlerts}
      >
        <SortableTable
          columns={DENIAL_CPT_COLS}
          data={denialByCpt}
          pageSize={15}
          exportFilename="issues-denial-cpt.csv"
          emptyMessage={`No CPT codes with denial rate ≥ ${T.DENIAL_RATE_WARN}%.`}
          onRowClick={(row) => openDrill(
            denialRows.filter((r) => String(r.CPTCode || '').trim() === row.cpt),
            `CPT ${row.cpt} — Denied Claims`,
            `${row.denialRate.toFixed(1)}% denial rate · Top code: ${row.topCode || 'N/A'}`,
          )}
        />
      </IssueSection>

      {/* 5. Denial Rate — By Carrier */}
      <IssueSection
        title="Denial Rate Outliers — By Carrier"
        subtitle={`Carriers with denial rate ≥ ${T.DENIAL_RATE_WARN}% of billed balance`}
        alertCount={carrierDenialAlerts}
      >
        <SortableTable
          columns={DENIAL_CARRIER_COLS}
          data={denialByCarrier}
          pageSize={15}
          exportFilename="issues-denial-carriers.csv"
          emptyMessage={`No carriers with denial rate ≥ ${T.DENIAL_RATE_WARN}%.`}
          onRowClick={(row) => openDrill(
            denialRows.filter((r) => r._carrier === row.carrier),
            `${row.carrier} — Denied Claims`,
            `${row.denialRate.toFixed(1)}% denial rate`,
          )}
        />
      </IssueSection>

      {/* 6. Re-denied Claims */}
      <IssueSection
        title="Escalating Re-denials"
        subtitle="Claims denied under a different code than original — indicates unresolved issues"
        alertCount={redenials.length}
      >
        <SortableTable
          columns={REDENIAL_COLS}
          data={redenials}
          pageSize={15}
          exportFilename="issues-redenials.csv"
          emptyMessage="No re-denied claims found."
          onRowClick={(row) => openDrill(
            denialRows.filter((r) =>
              String(r.FirstDenialCode || '').trim() === row.firstCode &&
              String(r.LastDenialCode || '').trim() === row.lastCode,
            ),
            `Pathway: ${row.pathway}`,
            `${row.count} re-denied claims`,
          )}
        />
      </IssueSection>

      {/* 7. High-Value Exposed Claims */}
      <IssueSection
        title={`High-Value Exposed Claims (≥ ${fmt$(T.HIGH_VALUE)})`}
        subtitle="Individual unresponded or denied claims above balance threshold — highest revenue recovery priority"
        alertCount={highValueExposed.length}
      >
        <SortableTable
          columns={HIGH_VALUE_COLS}
          data={highValueExposed}
          pageSize={25}
          exportFilename="issues-high-value.csv"
          emptyMessage={`No unresponded or denied claims ≥ ${fmt$(T.HIGH_VALUE)}.`}
          onRowClick={(row) => openDrill([row], `${row._carrier} — ${row.CPTCode}`, fmt$(row._balance))}
        />
      </IssueSection>

      {/* 8. Response Rate Laggards */}
      <IssueSection
        title="Carrier Response Rate Laggards"
        subtitle={`Carriers where response rate is below ${T.RESP_RATE_WARN}%`}
        alertCount={respAlerts}
      >
        <SortableTable
          columns={RESP_LAGGARD_COLS}
          data={responseLaggards}
          pageSize={15}
          exportFilename="issues-response-rate.csv"
          emptyMessage={`All carriers have response rate ≥ ${T.RESP_RATE_WARN}%.`}
          onRowClick={(row) => openDrill(
            billedRows.filter((r) => r._carrier === row.carrier),
            `${row.carrier} — Billed AR`,
            `${row.responseRate.toFixed(1)}% response rate`,
          )}
        />
      </IssueSection>

      {/* 9. Billing Lag */}
      <IssueSection
        title="Billing Lag — DOS to Initial File Date"
        subtitle={`Carriers with average lag ≥ ${T.BILLING_LAG_WARN} days — indicates slow billing workflow`}
        alertCount={lagAlerts}
      >
        <SortableTable
          columns={BILLING_LAG_COLS}
          data={billingLag}
          pageSize={15}
          exportFilename="issues-billing-lag.csv"
          emptyMessage={`No carriers with billing lag ≥ ${T.BILLING_LAG_WARN} days.`}
          onRowClick={(row) => openDrill(
            billedRows.filter((r) => r._carrier === row.carrier),
            `${row.carrier} — Billed AR`,
            `Avg billing lag: ${row.avgBillingLag}d`,
          )}
        />
      </IssueSection>

      {/* 10. Carrier Concentration Risk */}
      <IssueSection
        title="Carrier Concentration Risk"
        subtitle="Carriers with ≥ 5% of total AR — cross-referenced with denial and unresponded rates"
        alertCount={concAlerts}
      >
        <SortableTable
          columns={CONCENTRATION_COLS}
          data={concentrationRisk}
          pageSize={15}
          exportFilename="issues-concentration.csv"
          emptyMessage="No concentration data."
          onRowClick={(row) => openDrill(
            filteredData.filter((r) => r._carrier === row.carrier),
            `${row.carrier} — All AR`,
            `${row.arShare.toFixed(1)}% of total AR`,
          )}
        />
      </IssueSection>

      {/* Drill panel */}
      {drill && (
        <DrillAnalyticsPanel
          title={drill.title}
          subtitle={drill.subtitle}
          rows={drill.rows}
          onClose={closeDrill}
          exportFilename="issues-drill"
        />
      )}
    </div>
  );
}
