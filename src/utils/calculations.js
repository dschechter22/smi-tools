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
// Returns {cptCode: rate} — minimum 3 data points required

export function calculateCPTBenchmarks(filteredData, method = 'mean') {
  // method ignored now — always dollar-weighted (sum InsPmt / sum ChgAmt)
  // kept for API compatibility
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

export function calculateUnderpaymentStats(filteredData, benchmarks, method = 'mean', threshold = 15) {
  // Group by Payer + CPT
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
        chgCt: 0,
        rowCount: 0,
      };
    }
    const g = groups[key];
    g.totalChgAmt += fmt(row.ChgAmt);
    g.totalInsPmtAmt += fmt(row.InsPmtAmt);
    g.chgCt += fmt(row.ChgCt) || 1;
    g.rowCount += 1;
  }

  const rows = [];
  const threshFraction = threshold / 100;

  for (const g of Object.values(groups)) {
    if (g.totalChgAmt === 0) continue;
    const cpt = g.cpt;
    const benchmark = benchmarks[cpt];

    // Dollar-weighted rate: sum InsPmt / sum ChgAmt (ignore method param — always correct for aggregated data)
    const payerRate = g.totalChgAmt > 0 ? g.totalInsPmtAmt / g.totalChgAmt : 0;
    const benchmarkVal = benchmark !== undefined ? benchmark : null;

    let gapPct = null;
    let dollarImpact = 0;
    let flag = false;

    if (benchmarkVal !== null) {
      gapPct = benchmarkVal > 0 ? ((payerRate - benchmarkVal) / benchmarkVal) * 100 : null;
      if (benchmarkVal > payerRate) {
        const underpaymentGap = benchmarkVal - payerRate;
        dollarImpact = underpaymentGap * g.totalChgAmt;
        flag = (benchmarkVal - payerRate) / benchmarkVal >= threshFraction;
      }
    }

    rows.push({
      payer: g.payer,
      cpt: g.cpt,
      payerType: g.payerType,
      chgCt: g.chgCt,
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

export function calculatePayerDenialStats(filteredData) {
  const payerMap = {};
  for (const row of filteredData) {
    const payer = row.PrimIns || '(Unknown)';
    if (!payerMap[payer]) {
      payerMap[payer] = {
        payer,
        totalChgAmt: 0,
        totalChgCt: 0,
        deniedChgAmt: 0,
        deniedChgCt: 0,
        redeniedChgAmt: 0,
        redeniedChgCt: 0,
        codes: {},
      };
    }
    const p = payerMap[payer];
    p.totalChgAmt += fmt(row.ChgAmt);
    p.totalChgCt += fmt(row.ChgCt) || 1;

    if (isDenialCode(row.FirstDenialCode)) {
      p.deniedChgAmt += fmt(row.ChgAmt);
      p.deniedChgCt += fmt(row.ChgCt) || 1;
      const code = row.FirstDenialCode.trim();
      p.codes[code] = (p.codes[code] || 0) + (fmt(row.ChgCt) || 1);
      if (isDenialCode(row.LastDenialCode) && row.LastDenialCode.trim() !== row.FirstDenialCode.trim()) {
        p.redeniedChgAmt += fmt(row.ChgAmt);
        p.redeniedChgCt += fmt(row.ChgCt) || 1;
      }
    }
  }
  return Object.values(payerMap)
    .map((p) => {
      const top3 = Object.entries(p.codes)
        .sort((a, b) => b[1] - a[1]).slice(0, 3)
        .map(([code, cnt]) => `${code} (${cnt})`).join(', ');
      return {
        payer: p.payer,
        totalChgAmt: p.totalChgAmt,
        totalChgCt: p.totalChgCt,
        deniedChgAmt: p.deniedChgAmt,
        deniedChgCt: p.deniedChgCt,
        denialRateDollar: p.totalChgAmt > 0 ? (p.deniedChgAmt / p.totalChgAmt) * 100 : 0,
        denialRateCount: p.totalChgCt > 0 ? (p.deniedChgCt / p.totalChgCt) * 100 : 0,
        redeniedChgAmt: p.redeniedChgAmt,
        redeniedChgCt: p.redeniedChgCt,
        redenialRateDollar: p.deniedChgAmt > 0 ? (p.redeniedChgAmt / p.deniedChgAmt) * 100 : 0,
        top3Codes: top3 || '—',
      };
    })
    .sort((a, b) => b.deniedChgAmt - a.deniedChgAmt);
}

export function calculateTopDenialCodes(filteredData) {
  const totalChgAmt = filteredData.reduce((s, r) => s + fmt(r.ChgAmt), 0);
  const codeCounts = {};
  for (const row of filteredData) {
    if (!isDenialCode(row.FirstDenialCode)) continue;
    const code = row.FirstDenialCode.trim();
    if (!codeCounts[code]) codeCounts[code] = { chgAmt: 0, chgCt: 0 };
    codeCounts[code].chgAmt += fmt(row.ChgAmt);
    codeCounts[code].chgCt += fmt(row.ChgCt) || 1;
  }
  return Object.entries(codeCounts)
    .sort((a, b) => b[1].chgAmt - a[1].chgAmt)
    .slice(0, 10)
    .map(([code, data]) => ({
      code,
      chgAmt: data.chgAmt,
      chgCt: data.chgCt,
      pctOfTotal: totalChgAmt > 0 ? (data.chgAmt / totalChgAmt) * 100 : 0,
    }));
}

// ── Re-denial ─────────────────────────────────────────────────────────────────
// Re-denial = FirstDenialCode ≠ LastDenialCode AND both non-empty

export function calculateReDenials(filteredData) {
  const rows = filteredData.filter((row) => {
    return isDenialCode(row.FirstDenialCode) &&
           isDenialCode(row.LastDenialCode) &&
           row.FirstDenialCode.trim() !== row.LastDenialCode.trim();
  });

  // Pathway summary: FirstDenialCode → LastDenialCode
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
        count: 0,
        rowCount: 0,
        totalBalance: 0,
        totalChgAmt: 0,
      };
    }
    pathways[key].count += fmt(row.ChgCt) || 1;
    pathways[key].rowCount += 1;
    pathways[key].totalBalance += fmt(row.Balance);
    pathways[key].totalChgAmt += fmt(row.ChgAmt);
  }

  const pathwayList = Object.values(pathways).sort((a, b) => b.count - a.count);

  const totalExposure = rows.reduce((s, r) => s + fmt(r.Balance), 0);

  return { rows, pathways: pathwayList, totalCount: rows.length, totalExposure };
}

// ── Location Comparison ───────────────────────────────────────────────────────

export function calculateLocationComparison(filteredData) {
  // Group by Payer + CPT + State
  const groups = {};
  for (const row of filteredData) {
    const key = `${row.PrimIns}|||${row.CPTCode}`;
    if (!groups[key]) {
      groups[key] = {
        payer: row.PrimIns || '',
        cpt: row.CPTCode || '',
        states: {},
        totalChgAmt: 0,
        totalChgCt: 0,
      };
    }
    const g = groups[key];
    const state = row.Location_State || '(Unknown)';
    if (!g.states[state]) g.states[state] = { rates: [], chgAmt: 0, chgCt: 0 };
    const rate = getPaymentRate(row);
    if (rate !== null) g.states[state].rates.push(rate);
    g.states[state].chgAmt += fmt(row.ChgAmt);
    g.states[state].chgCt += fmt(row.ChgCt) || 1;
    g.totalChgAmt += fmt(row.ChgAmt);
    g.totalChgCt += fmt(row.ChgCt) || 1;
  }

  const results = [];
  for (const g of Object.values(groups)) {
    const stateEntries = Object.entries(g.states);
    // Only show combos in 2+ states with at least 5 total charges
    if (stateEntries.length < 2 || g.totalChgCt < 5) continue;

    const stateRates = {};
    for (const [state, data] of stateEntries) {
      if (data.rates.length > 0) {
        stateRates[state] = mean(data.rates);
      }
    }
    const rateValues = Object.values(stateRates).filter((r) => r !== null);
    if (rateValues.length < 2) continue;

    const minRate = Math.min(...rateValues);
    const maxRate = Math.max(...rateValues);
    const variance = maxRate - minRate;

    results.push({
      payer: g.payer,
      cpt: g.cpt,
      states: Object.keys(g.states).sort().join(', '),
      stateCount: stateEntries.length,
      minRate,
      maxRate,
      variance,
      totalChgAmt: g.totalChgAmt,
      totalChgCt: g.totalChgCt,
    });
  }

  return results.sort((a, b) => b.variance - a.variance);
}

// ── Patient / Insurance Split ─────────────────────────────────────────────────

export function calculatePatientInsuranceSplit(filteredData) {
  const payerMap = {};
  for (const row of filteredData) {
    const payer = row.PrimIns || '(Unknown)';
    if (!payerMap[payer]) {
      payerMap[payer] = {
        payer,
        totalChgAmt: 0,
        totalInsPmt: 0,
        totalPtPmt: 0,
        totalBalance: 0,
        chgCt: 0,
      };
    }
    const p = payerMap[payer];
    p.totalChgAmt += fmt(row.ChgAmt);
    p.totalInsPmt += fmt(row.InsPmtAmt);
    p.totalPtPmt += fmt(row.PtPmtAmt);
    p.totalBalance += fmt(row.Balance);
    p.chgCt += fmt(row.ChgCt) || 1;
  }

  return Object.values(payerMap)
    .map((p) => {
      const totalPmt = p.totalInsPmt + p.totalPtPmt;
      const insPct = totalPmt > 0 ? (p.totalInsPmt / totalPmt) * 100 : 0;
      const ptPct = totalPmt > 0 ? (p.totalPtPmt / totalPmt) * 100 : 0;
      const impliedWriteoffs = p.totalChgAmt - p.totalInsPmt - p.totalPtPmt - p.totalBalance;
      return {
        payer: p.payer,
        totalChgAmt: p.totalChgAmt,
        totalInsPmt: p.totalInsPmt,
        totalPtPmt: p.totalPtPmt,
        totalBalance: p.totalBalance,
        insPct,
        ptPct,
        impliedWriteoffs,
        chgCt: p.chgCt,
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
  let totalDeniedChgCt = 0;
  let totalChgCtAll = 0;
  const payers = new Set();
  const cpts = new Set();

  for (const row of filteredData) {
    totalChgAmt += fmt(row.ChgAmt);
    totalInsPmt += fmt(row.InsPmtAmt);
    totalPtPmt += fmt(row.PtPmtAmt);
    totalBalance += fmt(row.Balance);
    totalPmtAmt += fmt(row.PmtAmt);
    totalChgCtAll += fmt(row.ChgCt) || 1;
    if (row.PrimIns) payers.add(row.PrimIns);
    if (row.CPTCode) cpts.add(row.CPTCode);
    if (isDenialCode(row.FirstDenialCode)) {
      totalDeniedChgAmt += fmt(row.ChgAmt);
      totalDeniedChgCt += fmt(row.ChgCt) || 1;
    }
  }

  const overallPaymentRate = totalChgAmt > 0 ? totalInsPmt / totalChgAmt : 0;
  const impliedWriteoffs = totalChgAmt - totalInsPmt - totalPtPmt - totalBalance;

  // ChgStatus breakdown
  const statusCounts = {};
  for (const row of filteredData) {
    const s = row.ChgStatus || '(Unknown)';
    statusCounts[s] = (statusCounts[s] || 0) + 1;
  }

  // PrimInsType breakdown
  const insTypeCounts = {};
  for (const row of filteredData) {
    const t = row.PrimInsType || '(Unknown)';
    insTypeCounts[t] = (insTypeCounts[t] || 0) + 1;
  }

  // Top 5 payers by dollar left on table (balance)
  const payerBalance = {};
  for (const row of filteredData) {
    const p = row.PrimIns || '(Unknown)';
    if (!payerBalance[p]) payerBalance[p] = 0;
    payerBalance[p] += fmt(row.Balance);
  }
  const top5Payers = Object.entries(payerBalance)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([payer, balance]) => ({ payer, balance }));

  // Top 5 denial codes by charge amount
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
    overallPaymentRate,
    impliedWriteoffs,
    payerCount: payers.size,
    cptCount: cpts.size,
    rowCount: filteredData.length,
    totalChgCt: totalChgCtAll,
    denialRateDollar: totalChgAmt > 0 ? (totalDeniedChgAmt / totalChgAmt) * 100 : 0,
    denialRateCount: totalChgCtAll > 0 ? (totalDeniedChgCt / totalChgCtAll) * 100 : 0,
    statusCounts,
    insTypeCounts,
    top5Payers,
    top5DenialCodes,
  };
}
