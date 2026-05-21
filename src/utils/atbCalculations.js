import { isTrueDenial } from './calculations.js';

// ── Constants ──────────────────────────────────────────────────────────────────

export const STANDARD_BUCKET_ORDER = [
  '0-30', '31-60', '61-90', '91-120', '121-150', '151-180', '181-365', '366+',
];

const UNBILLED_BUCKET_ORDER = ['0-2', '3-5', '6-10', '11-15', '16-30', '31-60', '61+'];

const NON_PAYER_KEYWORDS = [
  'attorney', 'automobile', 'patient', 'self pay', 'company account',
];

// ── Helpers ────────────────────────────────────────────────────────────────────

export function isNonPayerCarrier(carrier) {
  if (!carrier) return false;
  const lower = String(carrier).toLowerCase();
  return NON_PAYER_KEYWORDS.some((kw) => lower.includes(kw));
}

function parseExcelDate(val) {
  if (val == null || val === '') return null;
  if (val instanceof Date) {
    // 1/1/1900 sentinel — year < 1950 means unbilled/null
    return val.getFullYear() < 1950 ? null : val;
  }
  if (typeof val === 'number') {
    // Excel serial: <= 2 means 1900-01-01 or earlier (sentinel)
    if (val <= 2) return null;
    // Excel epoch: Dec 30, 1899
    const epoch = new Date(1899, 11, 30);
    epoch.setDate(epoch.getDate() + Math.floor(val));
    return epoch.getFullYear() < 1950 ? null : epoch;
  }
  if (typeof val === 'string' && val.trim() !== '') {
    const d = new Date(val);
    if (!isNaN(d.getTime())) {
      return d.getFullYear() < 1950 ? null : d;
    }
  }
  return null;
}

function daysBetween(start, end) {
  if (!start || !end) return null;
  const ms = end.getTime() - start.getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

function standardBucket(days) {
  if (days == null) return null;
  if (days <= 30) return '0-30';
  if (days <= 60) return '31-60';
  if (days <= 90) return '61-90';
  if (days <= 120) return '91-120';
  if (days <= 150) return '121-150';
  if (days <= 180) return '151-180';
  if (days <= 365) return '181-365';
  return '366+';
}

function unbilledDosBucket(days) {
  if (days == null) return null;
  if (days <= 2) return '0-2';
  if (days <= 5) return '3-5';
  if (days <= 10) return '6-10';
  if (days <= 15) return '11-15';
  if (days <= 30) return '16-30';
  if (days <= 60) return '31-60';
  return '61+';
}

export const BALANCE_TIER_ORDER = [
  '$0-$25', '$25-$50', '$50-$100', '$100-$250', '$250-$500',
  '$500-$1,000', '$1,000-$1,500', '$1,500-$2,000', '$2,000-$2,500',
  '$2,500-$5,000', '$5,000+',
];

export function balanceTier(bal) {
  if (bal < 25)   return '$0-$25';
  if (bal < 50)   return '$25-$50';
  if (bal < 100)  return '$50-$100';
  if (bal < 250)  return '$100-$250';
  if (bal < 500)  return '$250-$500';
  if (bal < 1000) return '$500-$1,000';
  if (bal < 1500) return '$1,000-$1,500';
  if (bal < 2000) return '$1,500-$2,000';
  if (bal < 2500) return '$2,000-$2,500';
  if (bal < 5000) return '$2,500-$5,000';
  return '$5,000+';
}

// ── ATB Date Parsing ──────────────────────────────────────────────────────────

export function parseAtbDate(sourceName) {
  if (!sourceName) return null;
  const match = String(sourceName).match(/(\d{2})\.(\d{2})\.(\d{4})/);
  if (!match) return null;
  const [, mm, dd, yyyy] = match;
  return new Date(parseInt(yyyy), parseInt(mm) - 1, parseInt(dd));
}

// ── Row Enrichment ────────────────────────────────────────────────────────────

export function enrichAtbRows(rawRows) {
  if (!rawRows || rawRows.length === 0) return [];

  const atbDate = parseAtbDate(rawRows[0]['Source.Name']);

  return rawRows.map((row) => {
    const balance = parseFloat(row.Balance) || 0;
    const chargeAmount = parseFloat(row.ChargeAmount) || 0;
    const carrier = String(row['New Responsible Ins Carrier'] || '').trim();
    const piField = String(row['PI/Non PI'] || '').trim();

    // InitialFileDate — 1/1/1900 sentinel = unbilled
    const initialFileDateRaw = parseExcelDate(row.InitialFileDate);
    const isUnbilled = initialFileDateRaw === null;

    // Status derivation
    let status;
    if (isUnbilled) {
      status = 'Unbilled';
    } else {
      const responseStatus = String(row['Response Status'] || '').toLowerCase();
      if (responseStatus.includes('unresponded')) {
        status = 'Unresponded';
      } else {
        status = 'Responded';
      }
    }

    // Age calculations
    const serviceDate = parseExcelDate(row.ServiceDate);
    const lastInsFiledDate = parseExcelDate(row.LastInsuranceFiledDate);

    const dosAge = daysBetween(serviceDate, atbDate);
    const initialFileDateAge = isUnbilled ? null : daysBetween(initialFileDateRaw, atbDate);
    const lastInsFileDateAge = daysBetween(lastInsFiledDate, atbDate);

    return {
      ...row,
      _status: status,
      _isUnbilled: isUnbilled,
      _carrier: carrier,
      _balance: balance,
      _chargeAmount: chargeAmount,
      _piField: piField,
      _dosAge: dosAge,
      _dosBucket: standardBucket(dosAge),
      _initialFileDateAge: initialFileDateAge,
      _initialFileDateBucket: isUnbilled ? 'Unbilled' : standardBucket(initialFileDateAge),
      _lastInsFileDateAge: lastInsFileDateAge,
      _lastInsFileDateBucket: standardBucket(lastInsFileDateAge),
      _unbilledDosBucket: isUnbilled ? unbilledDosBucket(dosAge) : null,
      _balanceTier: balanceTier(balance),
    };
  });
}

// ── Filters ───────────────────────────────────────────────────────────────────

export function buildAtbDefaultFilters() {
  return {
    status: [],
    carrier: [],
    insuranceType: [],
    dosBucket: [],
    madBucket: [],
    modality: [],
    locationState: [],
    actionGroup: [],
    workList: [],
    dollarTier: [],
    cptCode: [],
  };
}

export function applyAtbFilters(data, filters) {
  return data.filter((row) => {
    if (filters.status.length > 0 && !filters.status.includes(row._status)) return false;
    if (filters.carrier.length > 0 && !filters.carrier.includes(row._carrier)) return false;
    if (filters.insuranceType.length > 0 && !filters.insuranceType.includes(row.InsuranceType)) return false;
    if (filters.dosBucket.length > 0 && !filters.dosBucket.includes(row._dosBucket)) return false;
    if (filters.madBucket && filters.madBucket.length > 0 && !filters.madBucket.includes(row['MAD Aging Bucket'])) return false;
    if (filters.modality.length > 0 && !filters.modality.includes(row.Modality)) return false;
    if (filters.locationState.length > 0 && !filters.locationState.includes(row['Location State'])) return false;
    if (filters.actionGroup.length > 0 && !filters.actionGroup.includes(row['New Action Grouping'])) return false;
    if (filters.workList.length > 0 && !filters.workList.includes(row['Work List'])) return false;
    if (filters.dollarTier.length > 0 && !filters.dollarTier.includes(row['$ Tier'])) return false;
    if (filters.cptCode.length > 0 && !filters.cptCode.includes(row.CPTCode)) return false;

    return true;
  });
}

export function countAtbActiveFilters(filters) {
  let count = 0;
  const multiselects = [
    'status', 'carrier', 'insuranceType', 'dosBucket', 'madBucket', 'modality',
    'locationState', 'actionGroup', 'workList', 'dollarTier', 'cptCode',
  ];
  for (const key of multiselects) {
    if (filters[key] && filters[key].length > 0) count++;
  }
  return count;
}

// ── Summary ───────────────────────────────────────────────────────────────────

export function buildAtbSummary(data) {
  let totalBalance = 0;
  let unbilledBalance = 0;
  let unrespondedBalance = 0;
  let respondedBalance = 0;
  let totalDosAge = 0;
  let dosAgeCount = 0;
  let atbDate = null;

  for (const row of data) {
    const bal = row._balance;
    totalBalance += bal;
    if (row._status === 'Unbilled') unbilledBalance += bal;
    else if (row._status === 'Unresponded') unrespondedBalance += bal;
    else respondedBalance += bal;

    if (row._dosAge != null) {
      totalDosAge += row._dosAge;
      dosAgeCount++;
    }

    if (!atbDate && row['Source.Name']) {
      atbDate = parseAtbDate(row['Source.Name']);
    }
  }

  return {
    totalBalance,
    unbilledBalance,
    unrespondedBalance,
    respondedBalance,
    totalClaims: data.length,
    avgDosAge: dosAgeCount > 0 ? Math.round(totalDosAge / dosAgeCount) : null,
    atbDate,
  };
}

// ── Payer Breakdown ───────────────────────────────────────────────────────────

export function buildAtbPayerBreakdown(data) {
  const map = {};

  for (const row of data) {
    const carrier = row._carrier || '(Unknown)';
    if (!map[carrier]) {
      map[carrier] = {
        carrier,
        totalBalance: 0,
        unbilledBalance: 0,
        unrespondedBalance: 0,
        respondedBalance: 0,
        claimCount: 0,
        totalDosAge: 0,
        dosAgeCount: 0,
      };
    }
    const g = map[carrier];
    g.totalBalance += row._balance;
    if (row._status === 'Unbilled') g.unbilledBalance += row._balance;
    else if (row._status === 'Unresponded') g.unrespondedBalance += row._balance;
    else g.respondedBalance += row._balance;
    g.claimCount++;
    if (row._dosAge != null) {
      g.totalDosAge += row._dosAge;
      g.dosAgeCount++;
    }
  }

  return Object.values(map)
    .map((g) => ({
      carrier: g.carrier,
      totalBalance: g.totalBalance,
      unbilledBalance: g.unbilledBalance,
      unrespondedBalance: g.unrespondedBalance,
      respondedBalance: g.respondedBalance,
      claimCount: g.claimCount,
      avgDosAge: g.dosAgeCount > 0 ? Math.round(g.totalDosAge / g.dosAgeCount) : null,
    }))
    .sort((a, b) => b.totalBalance - a.totalBalance);
}

// ── Aging Breakdown ───────────────────────────────────────────────────────────

export function buildAtbAgingBreakdown(data) {
  const map = {};

  for (const row of data) {
    const bucket = row._dosBucket;
    if (!bucket) continue;
    if (!map[bucket]) map[bucket] = { bucket, Unbilled: 0, Unresponded: 0, Responded: 0 };
    if (row._status === 'Unbilled') map[bucket].Unbilled += row._balance;
    else if (row._status === 'Unresponded') map[bucket].Unresponded += row._balance;
    else map[bucket].Responded += row._balance;
  }

  return STANDARD_BUCKET_ORDER
    .filter((b) => map[b] && (map[b].Unbilled + map[b].Unresponded + map[b].Responded) > 0)
    .map((b) => map[b]);
}

function parseBucketStart(s) {
  const m = String(s).match(/(\d+)/);
  return m ? parseInt(m[1], 10) : 9999;
}

export function buildStackedAgingByBucket(rows, bucketCol, bucketOrder) {
  const map = {};
  for (const row of rows) {
    const bucket = String(row[bucketCol] || '').trim();
    if (!bucket) continue;
    if (!map[bucket]) map[bucket] = { bucket, Unbilled: 0, Unresponded: 0, Responded: 0 };
    if (row._status === 'Unbilled') map[bucket].Unbilled += row._balance;
    else if (row._status === 'Unresponded') map[bucket].Unresponded += row._balance;
    else map[bucket].Responded += row._balance;
  }
  const ordered = (bucketOrder || []).filter((b) => map[b]).map((b) => map[b]);
  const seen = new Set(bucketOrder || []);
  const extra = Object.values(map)
    .filter((r) => !seen.has(r.bucket))
    .sort((a, b) => parseBucketStart(a.bucket) - parseBucketStart(b.bucket));
  return [...ordered, ...extra].filter((r) => (r.Unbilled + r.Unresponded + r.Responded) > 0);
}

// ── Denial Breakdown ──────────────────────────────────────────────────────────

export function buildAtbDenialBreakdown(data) {
  let totalDenied = 0;
  const codes = {};

  for (const row of data) {
    const code = row.FirstDenialCode;
    if (!isTrueDenial(code)) continue;
    const codeKey = String(code).trim().toUpperCase();
    if (!codes[codeKey]) {
      codes[codeKey] = {
        code: codeKey,
        group: row.LastDenialGroup || '',
        balance: 0,
        count: 0,
      };
    }
    codes[codeKey].balance += row._balance;
    codes[codeKey].count++;
    totalDenied += row._balance;
  }

  const codeList = Object.values(codes)
    .map((c) => ({
      ...c,
      pctOfTotal: totalDenied > 0 ? (c.balance / totalDenied) * 100 : 0,
    }))
    .sort((a, b) => b.balance - a.balance);

  return { totalDenied, codes: codeList };
}

// ── New Sub-tab Helpers ───────────────────────────────────────────────────────

export function hasDenialCode(row) {
  return isTrueDenial(row.FirstDenialCode);
}

// Generic: group rows by a key function → [{[keyName], balance, count}] sorted by balance
export function buildKeyBreakdown(rows, keyFn, keyName = 'key') {
  const map = {};
  for (const row of rows) {
    const k = keyFn(row);
    if (k == null || k === '') continue;
    const ks = String(k);
    if (!map[ks]) map[ks] = { [keyName]: ks, balance: 0, count: 0 };
    map[ks].balance += row._balance;
    map[ks].count++;
  }
  return Object.values(map).sort((a, b) => b.balance - a.balance);
}

// Generic: group rows by a pre-computed bucket column → ordered by bucketOrder
export function buildBucketBreakdown(rows, bucketColKey, bucketOrder) {
  const map = {};
  let total = 0;
  for (const row of rows) {
    const b = String(row[bucketColKey] || '').trim();
    if (!b) continue;
    if (!map[b]) map[b] = { bucket: b, balance: 0, count: 0 };
    map[b].balance += row._balance;
    map[b].count++;
    total += row._balance;
  }
  const ordered = bucketOrder.filter(b => map[b]).map(b => ({ ...map[b], pct: total > 0 ? (map[b].balance / total) * 100 : 0 }));
  const seen = new Set(bucketOrder);
  const extra = Object.values(map).filter(r => !seen.has(r.bucket)).map(r => ({ ...r, pct: total > 0 ? (r.balance / total) * 100 : 0 })).sort((a, b) => b.balance - a.balance);
  return [...ordered, ...extra];
}

// Billed AR: carrier → performance metrics
export function buildPayerPerformance(rows) {
  const map = {};
  for (const row of rows) {
    const c = row._carrier || '(Unknown)';
    if (!map[c]) map[c] = { carrier: c, balance: 0, count: 0, respondedCount: 0, unrespondedCount: 0, respondedBalance: 0, unrespondedBalance: 0, madAgeSum: 0, madAgeCount: 0, initFileAgeSum: 0, initFileAgeCount: 0 };
    const g = map[c];
    g.balance += row._balance;
    g.count++;
    if (row._status === 'Responded') { g.respondedCount++; g.respondedBalance += row._balance; }
    if (row._status === 'Unresponded') { g.unrespondedCount++; g.unrespondedBalance += row._balance; }
    const mad = parseFloat(row['MAD Age']);
    if (!isNaN(mad)) { g.madAgeSum += mad; g.madAgeCount++; }
    if (row._initialFileDateAge != null) { g.initFileAgeSum += row._initialFileDateAge; g.initFileAgeCount++; }
  }
  return Object.values(map).map(g => ({
    carrier: g.carrier, balance: g.balance, count: g.count,
    respondedBalance: g.respondedBalance, unrespondedBalance: g.unrespondedBalance,
    responseRate: g.count > 0 ? (g.respondedCount / g.count) * 100 : 0,
    avgMadAge: g.madAgeCount > 0 ? Math.round(g.madAgeSum / g.madAgeCount) : null,
    avgInitFileAge: g.initFileAgeCount > 0 ? Math.round(g.initFileAgeSum / g.initFileAgeCount) : null,
  })).sort((a, b) => b.balance - a.balance);
}

// Denials: code-level ranking
export function buildDenialCodeRanking(rows) {
  let total = 0;
  const map = {};
  for (const row of rows) {
    const code = String(row.FirstDenialCode || '').trim();
    if (!code) continue;
    if (!map[code]) map[code] = { code, group: String(row.FirstDenialGroup || '').trim(), balance: 0, count: 0, carriers: new Set() };
    map[code].balance += row._balance;
    map[code].count++;
    map[code].carriers.add(row._carrier);
    total += row._balance;
  }
  return Object.values(map).map(c => ({ code: c.code, group: c.group, balance: c.balance, count: c.count, carrierCount: c.carriers.size, pct: total > 0 ? (c.balance / total) * 100 : 0 })).sort((a, b) => b.balance - a.balance);
}

// Denials: carrier → denied $ + rate vs all billed
export function buildPayerDenialMatrix(denialRows, allBilledRows) {
  const billedByCarrier = {};
  for (const row of allBilledRows) { const c = row._carrier || '(Unknown)'; billedByCarrier[c] = (billedByCarrier[c] || 0) + row._balance; }
  const map = {};
  for (const row of denialRows) {
    const c = row._carrier || '(Unknown)';
    if (!map[c]) map[c] = { carrier: c, balance: 0, count: 0, topCode: null, topCodeBal: 0, codes: {} };
    const g = map[c];
    g.balance += row._balance;
    g.count++;
    const code = String(row.FirstDenialCode || '').trim();
    if (code) { g.codes[code] = (g.codes[code] || 0) + row._balance; if (g.codes[code] > g.topCodeBal) { g.topCode = code; g.topCodeBal = g.codes[code]; } }
  }
  return Object.values(map).map(g => ({ carrier: g.carrier, balance: g.balance, count: g.count, topCode: g.topCode, denialRate: billedByCarrier[g.carrier] > 0 ? (g.balance / billedByCarrier[g.carrier]) * 100 : null })).sort((a, b) => b.balance - a.balance);
}

// Denials: re-denial pathways (first ≠ last code)
export function buildDenialPathways(rows) {
  const map = {};
  for (const row of rows) {
    const first = String(row.FirstDenialCode || '').trim();
    const last = String(row.LastDenialCode || '').trim();
    if (!first || !last || first === last) continue;
    const key = `${first} → ${last}`;
    if (!map[key]) map[key] = { pathway: key, firstCode: first, lastCode: last, balance: 0, count: 0 };
    map[key].balance += row._balance;
    map[key].count++;
  }
  return Object.values(map).sort((a, b) => b.balance - a.balance);
}

// Payer Analysis: plan breakdown
export function buildPlanBreakdown(rows) {
  const map = {};
  for (const row of rows) {
    const plan = String(row.InsurancePlanDescription || '').trim() || '(Unknown)';
    if (!map[plan]) map[plan] = { plan, carrier: row._carrier || '', balance: 0, count: 0, unbilledBal: 0, unrespondedBal: 0, respondedBal: 0, deniedBal: 0 };
    const g = map[plan];
    g.balance += row._balance;
    g.count++;
    if (row._isUnbilled) g.unbilledBal += row._balance;
    else if (hasDenialCode(row)) g.deniedBal += row._balance;
    else if (row._status === 'Unresponded') g.unrespondedBal += row._balance;
    else g.respondedBal += row._balance;
  }
  return Object.values(map).sort((a, b) => b.balance - a.balance);
}

// Payer Analysis: plan aging averages
export function buildPlanAging(rows) {
  const map = {};
  for (const row of rows) {
    const plan = String(row.InsurancePlanDescription || '').trim() || '(Unknown)';
    if (!map[plan]) map[plan] = { plan, balance: 0, count: 0, madSum: 0, madN: 0, dosSum: 0, dosN: 0, initSum: 0, initN: 0 };
    const g = map[plan];
    g.balance += row._balance;
    g.count++;
    const mad = parseFloat(row['MAD Age']);
    if (!isNaN(mad)) { g.madSum += mad; g.madN++; }
    if (row._dosAge != null) { g.dosSum += row._dosAge; g.dosN++; }
    if (row._initialFileDateAge != null) { g.initSum += row._initialFileDateAge; g.initN++; }
  }
  return Object.values(map).map(g => ({ plan: g.plan, balance: g.balance, count: g.count, avgMadAge: g.madN > 0 ? Math.round(g.madSum / g.madN) : null, avgDosAge: g.dosN > 0 ? Math.round(g.dosSum / g.dosN) : null, avgInitFileAge: g.initN > 0 ? Math.round(g.initSum / g.initN) : null })).sort((a, b) => b.balance - a.balance);
}

// Payer Analysis: plan denial profile
export function buildPlanDenialProfile(denialRows, allRows) {
  const totalByPlan = {};
  for (const row of allRows) { const p = String(row.InsurancePlanDescription || '').trim() || '(Unknown)'; totalByPlan[p] = (totalByPlan[p] || 0) + row._balance; }
  const map = {};
  for (const row of denialRows) {
    const plan = String(row.InsurancePlanDescription || '').trim() || '(Unknown)';
    if (!map[plan]) map[plan] = { plan, balance: 0, count: 0, topCode: null, topCodeBal: 0, codes: {} };
    const g = map[plan];
    g.balance += row._balance;
    g.count++;
    const code = String(row.FirstDenialCode || '').trim();
    if (code) { g.codes[code] = (g.codes[code] || 0) + row._balance; if (g.codes[code] > g.topCodeBal) { g.topCode = code; g.topCodeBal = g.codes[code]; } }
  }
  return Object.values(map).map(g => ({ plan: g.plan, balance: g.balance, count: g.count, topCode: g.topCode, denialRate: totalByPlan[g.plan] > 0 ? (g.balance / totalByPlan[g.plan]) * 100 : null })).sort((a, b) => b.balance - a.balance);
}

// Payer Analysis: state breakdown
export function buildStateBreakdown(rows) {
  const map = {};
  for (const row of rows) {
    const state = String(row['Location State'] || '').trim() || '(Unknown)';
    if (!map[state]) map[state] = { state, balance: 0, count: 0, carriers: new Set() };
    map[state].balance += row._balance;
    map[state].count++;
    map[state].carriers.add(row._carrier);
  }
  return Object.values(map).map(g => ({ state: g.state, balance: g.balance, count: g.count, carrierCount: g.carriers.size })).sort((a, b) => b.balance - a.balance);
}

// ── Column Meta ───────────────────────────────────────────────────────────────

export function buildAtbColumnMeta(data) {
  const fields = [
    '_status',
    '_carrier',
    'InsuranceType',
    '_dosBucket',
    '_unbilledDosBucket',
    'MAD Aging Bucket',
    'Modality',
    'Location State',
    'New Action Grouping',
    'Work List',
    '$ Tier',
    'CPTCode',
    'BillStage',
  ];

  const result = {};

  for (const field of fields) {
    const valSet = new Set();
    for (const row of data) {
      const v = row[field];
      if (v != null && String(v).trim() !== '') valSet.add(String(v));
    }
    // For bucket fields, use defined order; otherwise sort alphabetically
    if (field === '_dosBucket') {
      result[field] = STANDARD_BUCKET_ORDER.filter((b) => valSet.has(b));
    } else if (field === '_unbilledDosBucket') {
      result[field] = UNBILLED_BUCKET_ORDER.filter((b) => valSet.has(b));
    } else if (field === 'MAD Aging Bucket') {
      const orderedMad = STANDARD_BUCKET_ORDER.filter((b) => valSet.has(b));
      const seenMad = new Set(STANDARD_BUCKET_ORDER);
      const extraMad = Array.from(valSet)
        .filter((v) => !seenMad.has(v))
        .sort((a, b) => parseBucketStart(a) - parseBucketStart(b));
      result[field] = [...orderedMad, ...extraMad];
    } else {
      result[field] = Array.from(valSet).sort((a, b) => a.localeCompare(b));
    }
  }

  return result;
}
