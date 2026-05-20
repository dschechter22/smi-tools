// ── Helpers ──────────────────────────────────────────────────────────────────

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
  const byCode = {};
  for (const row of filteredData) {
    const rate = getPaymentRate(row);
    if (rate === null) continue;
    const code = row.CPTCode || '';
    if (!byCode[code]) byCode[code] = [];
    byCode[code].push(rate);
  }
  const benchmarks = {};
  for (const [code, rates] of Object.entries(byCode)) {
    if (rates.length < 3) continue;
    benchmarks[code] = method === 'median' ? median(rates) : mean(rates);
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
        rates: [],
        totalChgAmt: 0,
        chgCt: 0,
      };
    }
    const g = groups[key];
    g.totalChgAmt += fmt(row.ChgAmt);
    g.chgCt += fmt(row.ChgCt) || 1;
    const rate = getPaymentRate(row);
    if (rate !== null) g.rates.push(rate);
  }

  const rows = [];
  const threshFraction = threshold / 100;

  for (const g of Object.values(groups)) {
    if (g.rates.length === 0) continue;
    const cpt = g.cpt;
    const benchmark = benchmarks[cpt];

    const payerRate = method === 'median' ? median(g.rates) : mean(g.rates);
    const benchmarkVal = benchmark !== undefined ? benchmark : null;

    let gapPct = null;
    let dollarImpact = 0;
    let flag = false;

    if (benchmarkVal !== null && payerRate !== null) {
      gapPct = ((payerRate - benchmarkVal) / benchmarkVal) * 100;
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
      sampleSize: g.rates.length,
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
        total: 0,
        denied: 0,
        redenied: 0,
        codes: {},
      };
    }
    const p = payerMap[payer];
    p.total += 1;

    const hasDenial = row.FirstDenialCode && row.FirstDenialCode.trim() !== '';
    if (hasDenial) {
      p.denied += 1;
      const code = row.FirstDenialCode.trim();
      p.codes[code] = (p.codes[code] || 0) + 1;

      const hasLastDenial = row.LastDenialCode && row.LastDenialCode.trim() !== '';
      if (hasLastDenial && row.LastDenialCode.trim() !== row.FirstDenialCode.trim()) {
        p.redenied += 1;
      }
    }
  }

  return Object.values(payerMap)
    .map((p) => {
      const top3 = Object.entries(p.codes)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([code, cnt]) => `${code} (${cnt})`)
        .join(', ');
      return {
        payer: p.payer,
        total: p.total,
        denied: p.denied,
        denialRate: p.total > 0 ? (p.denied / p.total) * 100 : 0,
        redenied: p.redenied,
        redenialRate: p.denied > 0 ? (p.redenied / p.denied) * 100 : 0,
        top3Codes: top3 || '—',
      };
    })
    .sort((a, b) => b.denied - a.denied);
}

export function calculateTopDenialCodes(filteredData) {
  const total = filteredData.length;
  const codeCounts = {};
  for (const row of filteredData) {
    const code = row.FirstDenialCode && row.FirstDenialCode.trim();
    if (code) codeCounts[code] = (codeCounts[code] || 0) + 1;
  }
  return Object.entries(codeCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([code, cnt]) => ({
      code,
      count: cnt,
      pct: total > 0 ? (cnt / total) * 100 : 0,
    }));
}

// ── Re-denial ─────────────────────────────────────────────────────────────────
// Re-denial = FirstDenialCode ≠ LastDenialCode AND both non-empty

export function calculateReDenials(filteredData) {
  const rows = filteredData.filter((row) => {
    const first = row.FirstDenialCode && row.FirstDenialCode.trim();
    const last = row.LastDenialCode && row.LastDenialCode.trim();
    return first && last && first !== last;
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
        totalBalance: 0,
        totalChgAmt: 0,
      };
    }
    pathways[key].count += 1;
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

  // Top 5 denial codes
  const denialCodeCounts = {};
  for (const row of filteredData) {
    const c = row.FirstDenialCode && row.FirstDenialCode.trim();
    if (c) denialCodeCounts[c] = (denialCodeCounts[c] || 0) + 1;
  }
  const top5DenialCodes = Object.entries(denialCodeCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([code, count]) => ({ code, count }));

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
    statusCounts,
    insTypeCounts,
    top5Payers,
    top5DenialCodes,
  };
}
