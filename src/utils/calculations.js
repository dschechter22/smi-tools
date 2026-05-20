// ── Helpers ──────────────────────────────────────────────────────────────────

// Returns true only for a real denial code — filters out NULL, empty, N/A, etc.
function isDenialCode(val) {
  if (val == null) return false;
  const s = String(val).trim().toUpperCase();
  return s !== '' && s !== 'NULL' && s !== 'N/A' && s !== 'NA' && s !== 'NONE' && s !== '0';
}

export function median(arr) {
  if (!arr || arr.length === 0) return null;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function mean(arr) {
  if (!arr || arr.length === 0) return null;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

export function getPaymentRate(row) {
  if (!row.ChgAmt || row.ChgAmt === 0) return null;
  return row.InsPmtAmt / row.ChgAmt;
}

function fmt(n) {
  return typeof n === 'number' && isFinite(n) ? n : 0;
}

// ── CPT Benchmarks ────────────────────────────────────────────────────────────
// Dollar-weighted: sum(InsPmtAmt) / sum(ChgAmt) per CPT across all payers.
// Requires at least 3 data rows to be considered reliable.

export function calculateCPTBenchmarks(filteredData) {
  const byCode = {};
  for (const row of filteredData) {
    if (!row.ChgAmt || row.ChgAmt === 0) continue;
    const code = row.CPTCode || '';
    if (!byCode[code]) byCode[code] = { totalIns: 0, totalChg: 0, rowCount: 0 };
    byCode[code].totalIns += fmt(row.InsPmtAmt);
    byCode[code].totalChg += fmt(row.ChgAmt);
    byCode[code].rowCount += 1;
  }
  const benchmarks = {};
  for (const [code, d] of Object.entries(byCode)) {
    if (d.rowCount < 3 || d.totalChg === 0) continue;
    benchmarks[code] = d.totalIns / d.totalChg;
  }
  return benchmarks;
}

// ── Underpayment Stats ────────────────────────────────────────────────────────
// All rates are dollar-weighted: sum(InsPmtAmt) / sum(ChgAmt) per payer+CPT.

export function calculateUnderpaymentStats(filteredData, benchmarks, method = 'mean', threshold = 15) {
  const groups = {};
  for (const row of filteredData) {
    const key = `${row.PrimIns}|||${row.CPTCode}`;
    if (!groups[key]) {
      groups[key] = {
        payer: row.PrimIns || '',
        cpt: row.CPTCode || '',
        payerType: row.PrimInsType || '',
        totalChgAmt: 0,
        totalInsPmtAmt: 0,
        rowCount: 0,
      };
    }
    const g = groups[key];
    g.totalChgAmt += fmt(row.ChgAmt);
    g.totalInsPmtAmt += fmt(row.InsPmtAmt);
    g.rowCount += 1;
  }

  const rows = [];
  const threshFraction = threshold / 100;

  for (const g of Object.values(groups)) {
    if (g.totalChgAmt === 0) continue;
    const benchmark = benchmarks[g.cpt];
    const payerRate = g.totalInsPmtAmt / g.totalChgAmt;
    const benchmarkVal = benchmark !== undefined ? benchmark : null;

    let gapPct = null;
    let dollarImpact = 0;
    let flag = false;

    if (benchmarkVal !== null) {
      gapPct = benchmarkVal > 0 ? ((payerRate - benchmarkVal) / benchmarkVal) * 100 : null;
      if (benchmarkVal > payerRate) {
        dollarImpact = (benchmarkVal - payerRate) * g.totalChgAmt;
        flag = (benchmarkVal - payerRate) / benchmarkVal >= threshFraction;
      }
    }

    rows.push({
      payer: g.payer,
      cpt: g.cpt,
      payerType: g.payerType,
      totalChgAmt: g.totalChgAmt,
      payerRate,
      benchmark: benchmarkVal,
      gapPct,
      dollarImpact,
      flag,
      sampleSize: g.rowCount,
    });
  }

  return rows.sort((a, b) => b.dollarImpact - a.dollarImpact);
}

// ── Denial Stats ──────────────────────────────────────────────────────────────
// Denial rate = denied ChgAmt / total ChgAmt (dollar-based only).

export function calculatePayerDenialStats(filteredData) {
  const payerMap = {};
  for (const row of filteredData) {
    const payer = row.PrimIns || '(Unknown)';
    if (!payerMap[payer]) {
      payerMap[payer] = {
        payer,
        totalChgAmt: 0,
        deniedChgAmt: 0,
        redeniedChgAmt: 0,
        codes: {},
      };
    }
    const p = payerMap[payer];
    p.totalChgAmt += fmt(row.ChgAmt);

    if (isDenialCode(row.FirstDenialCode)) {
      p.deniedChgAmt += fmt(row.ChgAmt);
      const code = row.FirstDenialCode.trim();
      p.codes[code] = (p.codes[code] || 0) + fmt(row.ChgAmt);
      if (isDenialCode(row.LastDenialCode) && row.LastDenialCode.trim() !== row.FirstDenialCode.trim()) {
        p.redeniedChgAmt += fmt(row.ChgAmt);
      }
    }
  }
  return Object.values(payerMap)
    .map((p) => {
      const top3 = Object.entries(p.codes)
        .sort((a, b) => b[1] - a[1]).slice(0, 3)
        .map(([code]) => code).join(', ');
      return {
        payer: p.payer,
        totalChgAmt: p.totalChgAmt,
        deniedChgAmt: p.deniedChgAmt,
        denialRateDollar: p.totalChgAmt > 0 ? (p.deniedChgAmt / p.totalChgAmt) * 100 : 0,
        redeniedChgAmt: p.redeniedChgAmt,
        redenialRateDollar: p.deniedChgAmt > 0 ? (p.redeniedChgAmt / p.deniedChgAmt) * 100 : 0,
        top3Codes: top3 || '—',
      };
    })
    .sort((a, b) => b.deniedChgAmt - a.deniedChgAmt);
}

export function calculateTopDenialCodes(filteredData) {
  const totalChgAmt = filteredData.reduce((s, r) => s + fmt(r.ChgAmt), 0);
  const codeAmts = {};
  for (const row of filteredData) {
    if (!isDenialCode(row.FirstDenialCode)) continue;
    const code = row.FirstDenialCode.trim();
    codeAmts[code] = (codeAmts[code] || 0) + fmt(row.ChgAmt);
  }
  return Object.entries(codeAmts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([code, chgAmt]) => ({
      code,
      chgAmt,
      pctOfTotal: totalChgAmt > 0 ? (chgAmt / totalChgAmt) * 100 : 0,
    }));
}

// ── Re-denial ─────────────────────────────────────────────────────────────────
// Re-denial = FirstDenialCode ≠ LastDenialCode AND both non-empty.
// Pathway volumes measured in dollars (ChgAmt).

export function calculateReDenials(filteredData) {
  const rows = filteredData.filter((row) =>
    isDenialCode(row.FirstDenialCode) &&
    isDenialCode(row.LastDenialCode) &&
    row.FirstDenialCode.trim() !== row.LastDenialCode.trim()
  );

  const pathways = {};
  for (const row of rows) {
    const key = `${row.FirstDenialCode.trim()} → ${row.LastDenialCode.trim()}`;
    if (!pathways[key]) {
      pathways[key] = {
        pathway: key,
        firstCode: row.FirstDenialCode.trim(),
        firstGroup: row.FirstDenialGroup || '',
        lastCode: row.LastDenialCode.trim(),
        lastGroup: row.LastDenialGroup || '',
        totalChgAmt: 0,
        totalBalance: 0,
      };
    }
    pathways[key].totalChgAmt += fmt(row.ChgAmt);
    pathways[key].totalBalance += fmt(row.Balance);
  }

  const pathwayList = Object.values(pathways).sort((a, b) => b.totalChgAmt - a.totalChgAmt);
  const totalExposure = rows.reduce((s, r) => s + fmt(r.Balance), 0);
  const totalChgAmt = rows.reduce((s, r) => s + fmt(r.ChgAmt), 0);

  return { rows, pathways: pathwayList, totalCount: rows.length, totalExposure, totalChgAmt };
}

// ── Location Comparison ───────────────────────────────────────────────────────
// Dollar-weighted payment rate per payer+CPT+state; threshold uses ChgAmt.

export function calculateLocationComparison(filteredData) {
  const groups = {};
  for (const row of filteredData) {
    const key = `${row.PrimIns}|||${row.CPTCode}`;
    if (!groups[key]) {
      groups[key] = { payer: row.PrimIns || '', cpt: row.CPTCode || '', states: {}, totalChgAmt: 0 };
    }
    const g = groups[key];
    const state = row.Location_State || '(Unknown)';
    if (!g.states[state]) g.states[state] = { totalIns: 0, totalChg: 0 };
    g.states[state].totalIns += fmt(row.InsPmtAmt);
    g.states[state].totalChg += fmt(row.ChgAmt);
    g.totalChgAmt += fmt(row.ChgAmt);
  }

  const results = [];
  for (const g of Object.values(groups)) {
    const stateEntries = Object.entries(g.states);
    if (stateEntries.length < 2 || g.totalChgAmt < 500) continue;

    const stateRates = {};
    for (const [state, d] of stateEntries) {
      if (d.totalChg > 0) stateRates[state] = d.totalIns / d.totalChg;
    }
    const rateValues = Object.values(stateRates);
    if (rateValues.length < 2) continue;

    const minRate = Math.min(...rateValues);
    const maxRate = Math.max(...rateValues);

    results.push({
      payer: g.payer,
      cpt: g.cpt,
      states: Object.keys(g.states).sort().join(', '),
      stateCount: stateEntries.length,
      minRate,
      maxRate,
      variance: maxRate - minRate,
      totalChgAmt: g.totalChgAmt,
    });
  }

  return results.sort((a, b) => b.variance - a.variance);
}

// ── Patient / Insurance Split ─────────────────────────────────────────────────
// All dollar-based. % of collected payments from ins vs patient.

export function calculatePatientInsuranceSplit(filteredData) {
  const payerMap = {};
  for (const row of filteredData) {
    const payer = row.PrimIns || '(Unknown)';
    if (!payerMap[payer]) {
      payerMap[payer] = { payer, totalChgAmt: 0, totalInsPmt: 0, totalPtPmt: 0, totalBalance: 0 };
    }
    const p = payerMap[payer];
    p.totalChgAmt += fmt(row.ChgAmt);
    p.totalInsPmt += fmt(row.InsPmtAmt);
    p.totalPtPmt += fmt(row.PtPmtAmt);
    p.totalBalance += fmt(row.Balance);
  }

  return Object.values(payerMap)
    .map((p) => {
      const totalPmt = p.totalInsPmt + p.totalPtPmt;
      return {
        payer: p.payer,
        totalChgAmt: p.totalChgAmt,
        totalInsPmt: p.totalInsPmt,
        totalPtPmt: p.totalPtPmt,
        totalBalance: p.totalBalance,
        insPct: totalPmt > 0 ? (p.totalInsPmt / totalPmt) * 100 : 0,
        ptPct: totalPmt > 0 ? (p.totalPtPmt / totalPmt) * 100 : 0,
        impliedWriteoffs: p.totalChgAmt - p.totalInsPmt - p.totalPtPmt - p.totalBalance,
      };
    })
    .sort((a, b) => b.ptPct - a.ptPct);
}

// ── Overview Stats ────────────────────────────────────────────────────────────

export function calculateOverviewStats(filteredData) {
  let totalChgAmt = 0;
  let totalInsPmt = 0;
  let totalPtPmt = 0;
  let totalBalance = 0;
  let totalPmtAmt = 0;
  let totalDeniedChgAmt = 0;
  const payers = new Set();
  const cpts = new Set();

  for (const row of filteredData) {
    totalChgAmt += fmt(row.ChgAmt);
    totalInsPmt += fmt(row.InsPmtAmt);
    totalPtPmt += fmt(row.PtPmtAmt);
    totalBalance += fmt(row.Balance);
    totalPmtAmt += fmt(row.PmtAmt);
    if (row.PrimIns) payers.add(row.PrimIns);
    if (row.CPTCode) cpts.add(row.CPTCode);
    if (isDenialCode(row.FirstDenialCode)) totalDeniedChgAmt += fmt(row.ChgAmt);
  }

  // ChgStatus breakdown by ChgAmt
  const statusAmts = {};
  for (const row of filteredData) {
    const s = row.ChgStatus || '(Unknown)';
    statusAmts[s] = (statusAmts[s] || 0) + fmt(row.ChgAmt);
  }

  // PrimInsType breakdown by ChgAmt
  const insTypeAmts = {};
  for (const row of filteredData) {
    const t = row.PrimInsType || '(Unknown)';
    insTypeAmts[t] = (insTypeAmts[t] || 0) + fmt(row.ChgAmt);
  }

  // Top 5 payers by outstanding balance
  const payerBalance = {};
  for (const row of filteredData) {
    const p = row.PrimIns || '(Unknown)';
    payerBalance[p] = (payerBalance[p] || 0) + fmt(row.Balance);
  }
  const top5Payers = Object.entries(payerBalance)
    .sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([payer, balance]) => ({ payer, balance }));

  // Top 5 denial codes by denied ChgAmt
  const denialCodeAmts = {};
  for (const row of filteredData) {
    if (!isDenialCode(row.FirstDenialCode)) continue;
    const c = row.FirstDenialCode.trim();
    denialCodeAmts[c] = (denialCodeAmts[c] || 0) + fmt(row.ChgAmt);
  }
  const top5DenialCodes = Object.entries(denialCodeAmts)
    .sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([code, amt]) => ({ code, amt }));

  return {
    totalChgAmt,
    totalInsPmt,
    totalPtPmt,
    totalBalance,
    totalPmtAmt,
    overallPaymentRate: totalChgAmt > 0 ? totalInsPmt / totalChgAmt : 0,
    impliedWriteoffs: totalChgAmt - totalInsPmt - totalPtPmt - totalBalance,
    denialRateDollar: totalChgAmt > 0 ? (totalDeniedChgAmt / totalChgAmt) * 100 : 0,
    payerCount: payers.size,
    cptCount: cpts.size,
    rowCount: filteredData.length,
    statusAmts,
    insTypeAmts,
    top5Payers,
    top5DenialCodes,
  };
}
