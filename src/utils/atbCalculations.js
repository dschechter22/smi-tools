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
    modality: [],
    locationState: [],
    actionGroup: [],
    workList: [],
    dollarTier: [],
    cptCode: [],
    excludeNonPayer: true,
    nonPiOnly: true,
    excludeCredits: true,
  };
}

export function applyAtbFilters(data, filters) {
  return data.filter((row) => {
    if (filters.excludeCredits && row._balance <= 0) return false;
    if (filters.excludeNonPayer && isNonPayerCarrier(row._carrier)) return false;
    if (filters.nonPiOnly && row._piField !== 'Non PI') return false;

    if (filters.status.length > 0 && !filters.status.includes(row._status)) return false;
    if (filters.carrier.length > 0 && !filters.carrier.includes(row._carrier)) return false;
    if (filters.insuranceType.length > 0 && !filters.insuranceType.includes(row.InsuranceType)) return false;
    if (filters.dosBucket.length > 0 && !filters.dosBucket.includes(row._dosBucket)) return false;
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
    'status', 'carrier', 'insuranceType', 'dosBucket', 'modality',
    'locationState', 'actionGroup', 'workList', 'dollarTier', 'cptCode',
  ];
  for (const key of multiselects) {
    if (filters[key] && filters[key].length > 0) count++;
  }
  if (filters.nonPiOnly) count++;
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

// ── Column Meta ───────────────────────────────────────────────────────────────

export function buildAtbColumnMeta(data) {
  const fields = [
    '_status',
    '_carrier',
    'InsuranceType',
    '_dosBucket',
    '_unbilledDosBucket',
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
    } else {
      result[field] = Array.from(valSet).sort((a, b) => a.localeCompare(b));
    }
  }

  return result;
}
