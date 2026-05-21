import React, { useMemo, useState } from 'react';
import { hasDenialCode } from '../../utils/atbCalculations.js';
import SortableTable from '../SortableTable.jsx';
import DrillAnalyticsPanel from './DrillAnalyticsPanel.jsx';
import { fmt$ } from '../../utils/format.js';

// ── Default thresholds ────────────────────────────────────────────────────────

const DEFAULT_T = {
  DOS_WARN: 60,       DOS_CRIT: 90,
  MAD_WARN: 30,       MAD_CRIT: 60,
  FILE_AGE_WARN: 60,  FILE_AGE_CRIT: 90,
  LAST_INS_WARN: 60,  LAST_INS_CRIT: 90,
  DENIAL_RATE_WARN: 15, DENIAL_RATE_CRIT: 25,
  RESP_RATE_WARN: 50,   RESP_RATE_CRIT: 25,
  STALE_DOS_WARN: 30,   STALE_DOS_CRIT: 60,
  HIGH_VALUE: 2500,
  MIN_CLAIMS: 5,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function isAgedClaim(r, T) {
  const mad = parseFloat(r['MAD Age']);
  return (
    (T.MAD_WARN > 0 && !isNaN(mad) && mad >= T.MAD_WARN) ||
    (T.DOS_WARN > 0 && r._dosAge != null && r._dosAge >= T.DOS_WARN) ||
    (T.FILE_AGE_WARN > 0 && r._initialFileDateAge != null && r._initialFileDateAge >= T.FILE_AGE_WARN) ||
    (T.LAST_INS_WARN > 0 && r._lastInsFileDateAge != null && r._lastInsFileDateAge >= T.LAST_INS_WARN)
  );
}

function flagVal(value, warn, crit, reverse = false) {
  if (value == null || warn <= 0) return null;
  const isCrit = reverse ? (crit > 0 && value <= crit) : (crit > 0 && value >= crit);
  const isWarn = reverse ? value <= warn : value >= warn;
  if (isCrit) return <span className="issue-flag issue-flag-crit">Critical</span>;
  if (isWarn) return <span className="issue-flag issue-flag-warn">Warning</span>;
  return null;
}

// ── Threshold settings panel ──────────────────────────────────────────────────

function TInput({ label, warnKey, critKey, T, onChange, reverse }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, color: 'var(--text-muted)', minWidth: 36 }}>{reverse ? 'Warn ≤' : 'Warn ≥'}</span>
        <input
          type="number" min={0}
          style={{ width: 70, padding: '3px 6px', fontSize: 12, border: '1px solid var(--border)', borderRadius: 4, background: 'var(--card-bg)', color: 'var(--text)' }}
          value={T[warnKey]}
          onChange={(e) => onChange(warnKey, e.target.value)}
        />
        <span style={{ fontSize: 11, color: 'var(--text-muted)', minWidth: 36 }}>{reverse ? 'Crit ≤' : 'Crit ≥'}</span>
        <input
          type="number" min={0}
          style={{ width: 70, padding: '3px 6px', fontSize: 12, border: '1px solid var(--border)', borderRadius: 4, background: 'var(--card-bg)', color: 'var(--text)' }}
          value={T[critKey]}
          onChange={(e) => onChange(critKey, e.target.value)}
        />
      </div>
    </div>
  );
}

function ThresholdPanel({ T, onChange }) {
  const [open, setOpen] = useState(false);
  const set = (key, val) => onChange({ ...T, [key]: val === '' ? 0 : Number(val) });

  return (
    <div className="panel">
      <div
        className="panel-header"
        style={{ cursor: 'pointer', userSelect: 'none' }}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="panel-title">⚙ Issue Thresholds</span>
        <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 8 }}>
          {open ? 'Collapse' : 'Click to configure — set warn/crit to 0 to disable a category'}
        </span>
        <span style={{ marginLeft: 'auto', fontSize: 12 }}>{open ? '▲' : '▼'}</span>
      </div>
      {open && (
        <div className="panel-body" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(270px, 1fr))', gap: 20 }}>
          <TInput label="DOS Age (days)" warnKey="DOS_WARN" critKey="DOS_CRIT" T={T} onChange={set} />
          <TInput label="MAD Age (days)" warnKey="MAD_WARN" critKey="MAD_CRIT" T={T} onChange={set} />
          <TInput label="Initial File Date Age (days)" warnKey="FILE_AGE_WARN" critKey="FILE_AGE_CRIT" T={T} onChange={set} />
          <TInput label="Last Ins. File Date Age (days)" warnKey="LAST_INS_WARN" critKey="LAST_INS_CRIT" T={T} onChange={set} />
          <TInput label="Denial Rate (%)" warnKey="DENIAL_RATE_WARN" critKey="DENIAL_RATE_CRIT" T={T} onChange={set} />
          <TInput label="Response Rate (%) — lower is worse" warnKey="RESP_RATE_WARN" critKey="RESP_RATE_CRIT" T={T} onChange={set} reverse />
          <TInput label="Stale Unbilled DOS Age (days)" warnKey="STALE_DOS_WARN" critKey="STALE_DOS_CRIT" T={T} onChange={set} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.4 }}>High-Value Balance ($)</div>
            <input type="number" min={0}
              style={{ width: 120, padding: '3px 6px', fontSize: 12, border: '1px solid var(--border)', borderRadius: 4, background: 'var(--card-bg)', color: 'var(--text)' }}
              value={T.HIGH_VALUE} onChange={(e) => set('HIGH_VALUE', e.target.value)} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.4 }}>Min Claims (significance)</div>
            <input type="number" min={1}
              style={{ width: 80, padding: '3px 6px', fontSize: 12, border: '1px solid var(--border)', borderRadius: 4, background: 'var(--card-bg)', color: 'var(--text)' }}
              value={T.MIN_CLAIMS} onChange={(e) => set('MIN_CLAIMS', e.target.value)} />
          </div>
        </div>
      )}
    </div>
  );
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

// ── Main ──────────────────────────────────────────────────────────────────────

export default function IssuesTab({ filteredData }) {
  const [T, setT] = useState(DEFAULT_T);
  const [drill, setDrill] = useState(null);

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
      if (!map[c]) map[c] = { carrier: c, agedBalance: 0, agedCount: 0, madSum: 0, madN: 0, fileAgeSum: 0, fileAgeN: 0 };
      const g = map[c];
      const mad = parseFloat(r['MAD Age']);
      if (!isNaN(mad)) { g.madSum += mad; g.madN++; }
      if (r._initialFileDateAge != null) { g.fileAgeSum += r._initialFileDateAge; g.fileAgeN++; }
      if (isAgedClaim(r, T)) { g.agedBalance += r._balance; g.agedCount++; }
    }
    return Object.values(map)
      .map((g) => ({
        carrier: g.carrier,
        agedBalance: g.agedBalance,
        agedCount: g.agedCount,
        avgMadAge: g.madN > 0 ? Math.round(g.madSum / g.madN) : null,
        avgFileAge: g.fileAgeN > 0 ? Math.round(g.fileAgeSum / g.fileAgeN) : null,
      }))
      .filter((r) => r.agedCount >= T.MIN_CLAIMS)
      .sort((a, b) => b.agedBalance - a.agedBalance);
  }, [billedRows, T]);

  const agedCarrierAlerts = agedCarriers.filter((r) =>
    (r.avgMadAge != null && T.MAD_CRIT > 0 && r.avgMadAge >= T.MAD_CRIT) ||
    (r.avgFileAge != null && T.FILE_AGE_CRIT > 0 && r.avgFileAge >= T.FILE_AGE_CRIT)
  ).length;

  // ── 2. Aged Billed AR — By Plan ────────────────────────────────────────────
  const agedPlans = useMemo(() => {
    const map = {};
    for (const r of billedRows) {
      const p = String(r.InsurancePlanDescription || '').trim() || '(Unknown)';
      if (!map[p]) map[p] = { plan: p, carrier: r._carrier || '', agedBalance: 0, agedCount: 0, madSum: 0, madN: 0, fileAgeSum: 0, fileAgeN: 0 };
      const g = map[p];
      const mad = parseFloat(r['MAD Age']);
      if (!isNaN(mad)) { g.madSum += mad; g.madN++; }
      if (r._initialFileDateAge != null) { g.fileAgeSum += r._initialFileDateAge; g.fileAgeN++; }
      if (isAgedClaim(r, T)) { g.agedBalance += r._balance; g.agedCount++; }
    }
    return Object.values(map)
      .map((g) => ({
        plan: g.plan, carrier: g.carrier,
        agedBalance: g.agedBalance, agedCount: g.agedCount,
        avgMadAge: g.madN > 0 ? Math.round(g.madSum / g.madN) : null,
        avgFileAge: g.fileAgeN > 0 ? Math.round(g.fileAgeSum / g.fileAgeN) : null,
      }))
      .filter((r) => r.agedCount >= T.MIN_CLAIMS)
      .sort((a, b) => b.agedBalance - a.agedBalance);
  }, [billedRows, T]);

  const agedPlanAlerts = agedPlans.filter((r) =>
    (r.avgMadAge != null && T.MAD_CRIT > 0 && r.avgMadAge >= T.MAD_CRIT) ||
    (r.avgFileAge != null && T.FILE_AGE_CRIT > 0 && r.avgFileAge >= T.FILE_AGE_CRIT)
  ).length;

  // ── 3. Stale Unbilled ──────────────────────────────────────────────────────
  const staleUnbilled = useMemo(() => {
    const map = {};
    for (const r of unbilledRows) {
      if (T.STALE_DOS_WARN <= 0 || (r._dosAge || 0) < T.STALE_DOS_WARN) continue;
      const c = r._carrier || '(Unknown)';
      if (!map[c]) map[c] = { carrier: c, balance: 0, count: 0, maxDosAge: 0 };
      map[c].balance += r._balance;
      map[c].count++;
      if ((r._dosAge || 0) > map[c].maxDosAge) map[c].maxDosAge = r._dosAge;
    }
    return Object.values(map).sort((a, b) => b.balance - a.balance);
  }, [unbilledRows, T.STALE_DOS_WARN]);

  const staleAlerts = staleUnbilled.filter((r) => T.STALE_DOS_CRIT > 0 && r.maxDosAge >= T.STALE_DOS_CRIT).length;

  // ── 4. Denial Rate Outliers — Plan × CPT ───────────────────────────────────
  const denialByPlanCpt = useMemo(() => {
    const cptMap = {};
    for (const r of billedRows) {
      const cpt = String(r.CPTCode || '').trim() || '(Unknown)';
      const plan = String(r.InsurancePlanDescription || '').trim() || '(Unknown)';
      if (!cptMap[cpt]) cptMap[cpt] = { totalBilled: 0, totalDenied: 0, plans: {} };
      cptMap[cpt].totalBilled += r._balance;
      if (!cptMap[cpt].plans[plan]) cptMap[cpt].plans[plan] = { billed: 0, denied: 0, deniedCount: 0, carrier: r._carrier || '' };
      cptMap[cpt].plans[plan].billed += r._balance;
      if (hasDenialCode(r)) {
        cptMap[cpt].totalDenied += r._balance;
        cptMap[cpt].plans[plan].denied += r._balance;
        cptMap[cpt].plans[plan].deniedCount++;
      }
    }
    const results = [];
    for (const [cpt, cd] of Object.entries(cptMap)) {
      const cptAvgRate = cd.totalBilled > 0 ? (cd.totalDenied / cd.totalBilled) * 100 : 0;
      const planEntries = Object.entries(cd.plans);
      if (planEntries.length < 2) continue;
      for (const [plan, pd] of planEntries) {
        if (pd.deniedCount < 1 || pd.billed === 0) continue;
        const planRate = (pd.denied / pd.billed) * 100;
        if (T.DENIAL_RATE_WARN > 0 && planRate >= T.DENIAL_RATE_WARN) {
          results.push({
            cpt, plan, carrier: pd.carrier,
            deniedBalance: pd.denied,
            deniedCount: pd.deniedCount,
            billedBalance: pd.billed,
            planDenialRate: planRate,
            cptAvgRate,
            vsAvg: planRate - cptAvgRate,
          });
        }
      }
    }
    return results.sort((a, b) => b.vsAvg - a.vsAvg);
  }, [billedRows, T.DENIAL_RATE_WARN]);

  const planCptDenialAlerts = denialByPlanCpt.filter((r) => T.DENIAL_RATE_CRIT > 0 && r.planDenialRate >= T.DENIAL_RATE_CRIT).length;

  // ── 5. Denial Rate Outliers — By Carrier ───────────────────────────────────
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
      .filter((c) => denied[c] && T.DENIAL_RATE_WARN > 0 && (denied[c].balance / billed[c]) * 100 >= T.DENIAL_RATE_WARN)
      .map((c) => ({
        carrier: c,
        billedBalance: billed[c],
        deniedBalance: denied[c].balance,
        deniedCount: denied[c].count,
        denialRate: (denied[c].balance / billed[c]) * 100,
      }))
      .sort((a, b) => b.denialRate - a.denialRate);
  }, [billedRows, denialRows, T.DENIAL_RATE_WARN]);

  const carrierDenialAlerts = denialByCarrier.filter((r) => T.DENIAL_RATE_CRIT > 0 && r.denialRate >= T.DENIAL_RATE_CRIT).length;

  // ── 6. Re-denials ──────────────────────────────────────────────────────────
  const redenials = useMemo(() => {
    const map = {};
    for (const r of denialRows) {
      const first = String(r.FirstDenialCode || '').trim();
      const last  = String(r.LastDenialCode  || '').trim();
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
    T.HIGH_VALUE > 0
      ? filteredData
          .filter((r) => r._balance >= T.HIGH_VALUE && (r._status === 'Unresponded' || hasDenialCode(r)))
          .sort((a, b) => b._balance - a._balance)
          .slice(0, 100)
      : [],
    [filteredData, T.HIGH_VALUE],
  );

  // ── 8. Response Rate Laggards ──────────────────────────────────────────────
  const responseLaggards = useMemo(() => {
    const map = {};
    for (const r of billedRows) {
      const c = r._carrier || '(Unknown)';
      if (!map[c]) map[c] = { carrier: c, total: 0, responded: 0, unrespondedBal: 0 };
      map[c].total++;
      if (r._status === 'Responded') map[c].responded++;
      else map[c].unrespondedBal += r._balance;
    }
    return Object.values(map)
      .map((g) => ({
        carrier: g.carrier,
        responseRate: g.total > 0 ? (g.responded / g.total) * 100 : 0,
        unrespondedBalance: g.unrespondedBal,
        claimCount: g.total,
      }))
      .filter((r) => r.claimCount >= T.MIN_CLAIMS && T.RESP_RATE_WARN > 0 && r.responseRate < T.RESP_RATE_WARN)
      .sort((a, b) => a.responseRate - b.responseRate);
  }, [billedRows, T.MIN_CLAIMS, T.RESP_RATE_WARN]);

  const respAlerts = responseLaggards.filter((r) => T.RESP_RATE_CRIT > 0 && r.responseRate < T.RESP_RATE_CRIT).length;

  // ── 9. Aging Outliers — Plan × CPT (within carrier) ───────────────────────
  const agingByPlanCpt = useMemo(() => {
    const ccMap = {};
    for (const r of billedRows) {
      const cpt     = String(r.CPTCode || '').trim() || '(Unknown)';
      const plan    = String(r.InsurancePlanDescription || '').trim() || '(Unknown)';
      const carrier = r._carrier || '(Unknown)';
      const key     = `${carrier}|||${cpt}`;
      if (!ccMap[key]) ccMap[key] = { carrier, cpt, madSum: 0, madN: 0, plans: {} };
      const mad = parseFloat(r['MAD Age']);
      if (!isNaN(mad)) { ccMap[key].madSum += mad; ccMap[key].madN++; }
      if (!ccMap[key].plans[plan]) ccMap[key].plans[plan] = { plan, madSum: 0, madN: 0, agedBalance: 0, agedCount: 0, totalCount: 0 };
      const g = ccMap[key].plans[plan];
      g.totalCount++;
      if (!isNaN(mad)) { g.madSum += mad; g.madN++; }
      if (isAgedClaim(r, T)) { g.agedBalance += r._balance; g.agedCount++; }
    }
    const results = [];
    for (const ccData of Object.values(ccMap)) {
      const planList = Object.values(ccData.plans);
      if (planList.length < 2) continue;
      const carrierAvg = ccData.madN > 0 ? ccData.madSum / ccData.madN : null;
      if (carrierAvg == null) continue;
      for (const pd of planList) {
        if (pd.totalCount < T.MIN_CLAIMS || pd.madN === 0) continue;
        const planAvg = pd.madSum / pd.madN;
        if (T.MAD_WARN > 0 && planAvg >= T.MAD_WARN) {
          const vsAvgPct = carrierAvg > 0 ? Math.round(((planAvg - carrierAvg) / carrierAvg) * 100) : 0;
          if (vsAvgPct > 0) {
            results.push({
              cpt: ccData.cpt,
              plan: pd.plan,
              carrier: ccData.carrier,
              agedBalance: pd.agedBalance,
              agedCount: pd.agedCount,
              avgMad: Math.round(planAvg),
              carrierAvgMad: Math.round(carrierAvg),
              vsAvgPct,
            });
          }
        }
      }
    }
    return results.sort((a, b) => b.vsAvgPct - a.vsAvgPct);
  }, [billedRows, T]);

  const agingOutlierAlerts = agingByPlanCpt.filter((r) => T.MAD_CRIT > 0 && r.avgMad >= T.MAD_CRIT).length;

  if (filteredData.length === 0) {
    return <div className="empty-state"><p>No data matches current filters.</p></div>;
  }

  // ── Column definitions ────────────────────────────────────────────────────

  const AGED_CARRIER_COLS = [
    { key: 'carrier', label: 'Carrier', filterType: 'text' },
    { key: 'agedBalance', label: 'Aged Balance', filterType: 'number',
      render: (r) => <span style={{ color: 'var(--danger)', fontWeight: 700 }}>{fmt$(r.agedBalance)}</span> },
    { key: 'agedCount', label: 'Aged Claims', filterType: 'number' },
    { key: 'avgMadAge', label: 'Avg MAD Age', filterType: 'number',
      render: (r) => r.avgMadAge != null
        ? <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>{r.avgMadAge}d {flagVal(r.avgMadAge, T.MAD_WARN, T.MAD_CRIT)}</span>
        : '—' },
    { key: 'avgFileAge', label: 'Avg File Date Age', filterType: 'number',
      render: (r) => r.avgFileAge != null
        ? <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>{r.avgFileAge}d {flagVal(r.avgFileAge, T.FILE_AGE_WARN, T.FILE_AGE_CRIT)}</span>
        : '—' },
  ];

  const AGED_PLAN_COLS = [
    { key: 'plan', label: 'Plan', filterType: 'text' },
    { key: 'carrier', label: 'Carrier', filterType: 'text' },
    { key: 'agedBalance', label: 'Aged Balance', filterType: 'number',
      render: (r) => <span style={{ color: 'var(--danger)', fontWeight: 700 }}>{fmt$(r.agedBalance)}</span> },
    { key: 'agedCount', label: 'Aged Claims', filterType: 'number' },
    { key: 'avgMadAge', label: 'Avg MAD Age', filterType: 'number',
      render: (r) => r.avgMadAge != null
        ? <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>{r.avgMadAge}d {flagVal(r.avgMadAge, T.MAD_WARN, T.MAD_CRIT)}</span>
        : '—' },
    { key: 'avgFileAge', label: 'Avg File Date Age', filterType: 'number',
      render: (r) => r.avgFileAge != null
        ? <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>{r.avgFileAge}d {flagVal(r.avgFileAge, T.FILE_AGE_WARN, T.FILE_AGE_CRIT)}</span>
        : '—' },
  ];

  const STALE_UNBILLED_COLS = [
    { key: 'carrier', label: 'Carrier', filterType: 'text' },
    { key: 'balance', label: 'Stale Balance', filterType: 'number',
      render: (r) => <span style={{ color: 'var(--danger)', fontWeight: 700 }}>{fmt$(r.balance)}</span> },
    { key: 'count', label: 'Stale Claims', filterType: 'number' },
    { key: 'maxDosAge', label: 'Max DOS Age', filterType: 'number',
      render: (r) => <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>{r.maxDosAge}d {flagVal(r.maxDosAge, T.STALE_DOS_WARN, T.STALE_DOS_CRIT)}</span> },
  ];

  const DENIAL_PLAN_CPT_COLS = [
    { key: 'cpt', label: 'CPT Code', filterType: 'text' },
    { key: 'plan', label: 'Plan', filterType: 'text' },
    { key: 'carrier', label: 'Carrier', filterType: 'text' },
    { key: 'deniedBalance', label: 'Denied $', filterType: 'number',
      render: (r) => <span style={{ color: 'var(--danger)' }}>{fmt$(r.deniedBalance)}</span> },
    { key: 'deniedCount', label: 'Denied Claims', filterType: 'number' },
    { key: 'planDenialRate', label: 'Plan Rate', filterType: 'number',
      render: (r) => <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {r.planDenialRate.toFixed(1)}% {flagVal(r.planDenialRate, T.DENIAL_RATE_WARN, T.DENIAL_RATE_CRIT)}
      </span> },
    { key: 'cptAvgRate', label: 'Avg Rate (CPT)', filterType: 'number',
      render: (r) => `${r.cptAvgRate.toFixed(1)}%` },
    { key: 'vsAvg', label: 'vs. CPT Avg', filterType: 'number',
      render: (r) => <strong style={{ color: r.vsAvg > 0 ? 'var(--danger)' : 'var(--success)' }}>
        {r.vsAvg > 0 ? '+' : ''}{r.vsAvg.toFixed(1)}%
      </strong> },
  ];

  const DENIAL_CARRIER_COLS = [
    { key: 'carrier', label: 'Carrier', filterType: 'text' },
    { key: 'billedBalance', label: 'Billed Balance', filterType: 'number', render: (r) => fmt$(r.billedBalance) },
    { key: 'deniedBalance', label: 'Denied Balance', filterType: 'number',
      render: (r) => <span style={{ color: 'var(--danger)' }}>{fmt$(r.deniedBalance)}</span> },
    { key: 'deniedCount', label: 'Denied Claims', filterType: 'number' },
    { key: 'denialRate', label: 'Denial Rate', filterType: 'number',
      render: (r) => <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {r.denialRate.toFixed(1)}% {flagVal(r.denialRate, T.DENIAL_RATE_WARN, T.DENIAL_RATE_CRIT)}
      </span> },
  ];

  const REDENIAL_COLS = [
    { key: 'pathway', label: 'Pathway (First → Last Code)', filterType: 'text' },
    { key: 'balance', label: 'Denied Balance', filterType: 'number',
      render: (r) => <span style={{ color: 'var(--danger)', fontWeight: 700 }}>{fmt$(r.balance)}</span> },
    { key: 'count', label: 'Claims', filterType: 'number' },
  ];

  const HIGH_VALUE_COLS = [
    { key: '_status', label: 'Status', filterType: 'multiselect',
      render: (r) => <span className={`badge ${hasDenialCode(r) ? 'badge-red' : 'badge-orange'}`}>{hasDenialCode(r) ? 'Denied' : r._status}</span> },
    { key: '_carrier', label: 'Carrier', filterType: 'text' },
    { key: 'InsurancePlanDescription', label: 'Plan', filterType: 'text' },
    { key: 'CPTCode', label: 'CPT', filterType: 'text' },
    { key: '_balance', label: 'Balance', filterType: 'number',
      render: (r) => <span style={{ color: 'var(--danger)', fontWeight: 700 }}>{fmt$(r._balance)}</span>,
      csvValue: (r) => r._balance?.toFixed(2) },
    { key: '_dosAge', label: 'DOS Age', filterType: 'number',
      render: (r) => r._dosAge != null ? `${r._dosAge}d` : '—' },
    { key: 'MAD Aging Bucket', label: 'MAD Bucket', filterType: 'multiselect' },
    { key: 'FirstDenialCode', label: 'Denial Code', filterType: 'text',
      render: (r) => r.FirstDenialCode && String(r.FirstDenialCode).trim()
        ? <span className="badge badge-yellow">{r.FirstDenialCode}</span>
        : '—' },
  ];

  const RESP_LAGGARD_COLS = [
    { key: 'carrier', label: 'Carrier', filterType: 'text' },
    { key: 'unrespondedBalance', label: 'Unresponded $', filterType: 'number',
      render: (r) => <span style={{ color: 'var(--orange)', fontWeight: 700 }}>{fmt$(r.unrespondedBalance)}</span> },
    { key: 'claimCount', label: 'Claims', filterType: 'number' },
    { key: 'responseRate', label: 'Response Rate', filterType: 'number',
      render: (r) => <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {r.responseRate.toFixed(1)}% {flagVal(r.responseRate, T.RESP_RATE_WARN, T.RESP_RATE_CRIT, true)}
      </span> },
  ];

  const AGING_PLAN_CPT_COLS = [
    { key: 'cpt', label: 'CPT Code', filterType: 'text' },
    { key: 'plan', label: 'Plan', filterType: 'text' },
    { key: 'carrier', label: 'Carrier', filterType: 'text' },
    { key: 'agedBalance', label: 'Aged Balance', filterType: 'number',
      render: (r) => <span style={{ color: 'var(--danger)', fontWeight: 700 }}>{fmt$(r.agedBalance)}</span> },
    { key: 'agedCount', label: 'Aged Claims', filterType: 'number' },
    { key: 'avgMad', label: 'Plan Avg MAD', filterType: 'number',
      render: (r) => <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {r.avgMad}d {flagVal(r.avgMad, T.MAD_WARN, T.MAD_CRIT)}
      </span> },
    { key: 'carrierAvgMad', label: 'Carrier Avg MAD', filterType: 'number',
      render: (r) => `${r.carrierAvgMad}d` },
    { key: 'vsAvgPct', label: '% Above Carrier Avg', filterType: 'number',
      render: (r) => <strong style={{ color: 'var(--danger)' }}>+{r.vsAvgPct}%</strong> },
  ];

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="section-gap">

      <ThresholdPanel T={T} onChange={setT} />

      {/* 1. Aged Billed AR — By Carrier */}
      <IssueSection
        title="Aged Billed AR — By Carrier"
        subtitle={`Aged claims only (MAD ≥${T.MAD_WARN}d or DOS ≥${T.DOS_WARN}d or File Age ≥${T.FILE_AGE_WARN}d)`}
        alertCount={agedCarrierAlerts}
      >
        <SortableTable
          columns={AGED_CARRIER_COLS}
          data={agedCarriers}
          pageSize={15}
          exportFilename="issues-aged-carriers.csv"
          emptyMessage="No carriers with aged billed AR in current filter."
          onRowClick={(row) => openDrill(
            billedRows.filter((r) => r._carrier === row.carrier && isAgedClaim(r, T)),
            row.carrier,
            `Aged Billed AR · Avg MAD ${row.avgMadAge != null ? row.avgMadAge + 'd' : '—'} · Avg File Age ${row.avgFileAge != null ? row.avgFileAge + 'd' : '—'}`,
          )}
        />
      </IssueSection>

      {/* 2. Aged Billed AR — By Plan */}
      <IssueSection
        title="Aged Billed AR — By Plan"
        subtitle={`Aged claims only (MAD ≥${T.MAD_WARN}d or DOS ≥${T.DOS_WARN}d or File Age ≥${T.FILE_AGE_WARN}d)`}
        alertCount={agedPlanAlerts}
      >
        <SortableTable
          columns={AGED_PLAN_COLS}
          data={agedPlans}
          pageSize={15}
          exportFilename="issues-aged-plans.csv"
          emptyMessage="No plans with aged billed AR in current filter."
          onRowClick={(row) => {
            const plan = row.plan;
            openDrill(
              billedRows.filter((r) => (String(r.InsurancePlanDescription || '').trim() || '(Unknown)') === plan && isAgedClaim(r, T)),
              plan,
              `${row.carrier} — Aged Billed AR`,
            );
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
          emptyMessage={T.STALE_DOS_WARN <= 0 ? 'Stale unbilled threshold disabled.' : `No unbilled claims older than ${T.STALE_DOS_WARN} days.`}
          onRowClick={(row) => openDrill(
            unbilledRows.filter((r) => r._carrier === row.carrier && (r._dosAge || 0) >= T.STALE_DOS_WARN),
            `${row.carrier} — Stale Unbilled`,
            `${row.count} claims · Max DOS age ${row.maxDosAge}d`,
          )}
        />
      </IssueSection>

      {/* 4. Denial Rate Outliers — Plan × CPT */}
      <IssueSection
        title="Denial Rate Outliers — Plan × CPT"
        subtitle={`Plans with denial rate ≥ ${T.DENIAL_RATE_WARN}% for a CPT, vs. the average denial rate for that CPT across all plans`}
        alertCount={planCptDenialAlerts}
      >
        <SortableTable
          columns={DENIAL_PLAN_CPT_COLS}
          data={denialByPlanCpt}
          pageSize={20}
          exportFilename="issues-denial-plan-cpt.csv"
          emptyMessage={T.DENIAL_RATE_WARN <= 0 ? 'Denial rate threshold disabled.' : `No plan × CPT combinations with denial rate ≥ ${T.DENIAL_RATE_WARN}%.`}
          onRowClick={(row) => openDrill(
            denialRows.filter((r) => {
              const p = String(r.InsurancePlanDescription || '').trim() || '(Unknown)';
              return p === row.plan && String(r.CPTCode || '').trim() === row.cpt;
            }),
            `${row.plan} — CPT ${row.cpt}`,
            `${row.planDenialRate.toFixed(1)}% denial rate (CPT avg: ${row.cptAvgRate.toFixed(1)}%)`,
          )}
        />
      </IssueSection>

      {/* 5. Denial Rate Outliers — By Carrier */}
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
          emptyMessage={T.DENIAL_RATE_WARN <= 0 ? 'Denial rate threshold disabled.' : `No carriers with denial rate ≥ ${T.DENIAL_RATE_WARN}%.`}
          onRowClick={(row) => openDrill(
            denialRows.filter((r) => r._carrier === row.carrier),
            `${row.carrier} — Denied Claims`,
            `${row.denialRate.toFixed(1)}% denial rate`,
          )}
        />
      </IssueSection>

      {/* 6. Re-denials */}
      <IssueSection
        title="Escalating Re-denials"
        subtitle="Claims denied under a different code than the first denial — indicates unresolved dispute cycles"
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
              String(r.LastDenialCode  || '').trim() === row.lastCode
            ),
            `Pathway: ${row.pathway}`,
            `${row.count} re-denied claims`,
          )}
        />
      </IssueSection>

      {/* 7. High-Value Exposed Claims */}
      <IssueSection
        title={`High-Value Exposed Claims (≥ ${fmt$(T.HIGH_VALUE)})`}
        subtitle="Unresponded or denied claims above balance threshold — highest individual revenue recovery priority"
        alertCount={highValueExposed.length}
      >
        <SortableTable
          columns={HIGH_VALUE_COLS}
          data={highValueExposed}
          pageSize={25}
          exportFilename="issues-high-value.csv"
          emptyMessage={T.HIGH_VALUE <= 0 ? 'High-value threshold disabled.' : `No unresponded or denied claims ≥ ${fmt$(T.HIGH_VALUE)}.`}
          onRowClick={(row) => openDrill([row], `${row._carrier} — ${row.CPTCode}`, fmt$(row._balance))}
        />
      </IssueSection>

      {/* 8. Response Rate Laggards */}
      <IssueSection
        title="Carrier Response Rate Laggards"
        subtitle={`Carriers where response rate < ${T.RESP_RATE_WARN}% — showing unresponded balance only`}
        alertCount={respAlerts}
      >
        <SortableTable
          columns={RESP_LAGGARD_COLS}
          data={responseLaggards}
          pageSize={15}
          exportFilename="issues-response-rate.csv"
          emptyMessage={T.RESP_RATE_WARN <= 0 ? 'Response rate threshold disabled.' : `All carriers have response rate ≥ ${T.RESP_RATE_WARN}%.`}
          onRowClick={(row) => openDrill(
            billedRows.filter((r) => r._carrier === row.carrier && r._status !== 'Responded'),
            `${row.carrier} — Unresponded AR`,
            `${row.responseRate.toFixed(1)}% response rate`,
          )}
        />
      </IssueSection>

      {/* 9. Aging Outliers — Plan × CPT within carrier */}
      <IssueSection
        title="Aging Outliers — Plan × CPT (vs. Carrier Average)"
        subtitle="Plans whose avg MAD age for a specific CPT is higher than the carrier average for that CPT — showing aged claims only"
        alertCount={agingOutlierAlerts}
      >
        <SortableTable
          columns={AGING_PLAN_CPT_COLS}
          data={agingByPlanCpt}
          pageSize={20}
          exportFilename="issues-aging-plan-cpt.csv"
          emptyMessage="No plan × CPT aging outliers found."
          onRowClick={(row) => {
            const plan    = row.plan;
            const cpt     = row.cpt;
            const carrier = row.carrier;
            openDrill(
              billedRows.filter((r) =>
                (String(r.InsurancePlanDescription || '').trim() || '(Unknown)') === plan &&
                String(r.CPTCode || '').trim() === cpt &&
                r._carrier === carrier &&
                isAgedClaim(r, T)
              ),
              `${plan} — CPT ${cpt}`,
              `+${row.vsAvgPct}% above ${carrier} avg MAD for this CPT`,
            );
          }}
        />
      </IssueSection>

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
