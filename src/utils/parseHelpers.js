export const NUMERIC_COLS = ['ChgCt', 'ChgAmt', 'PmtAmt', 'Balance', 'InsPmtAmt', 'PtPmtAmt'];
export const STRING_COLS = [
  'Location_State', 'LocationName', 'PrimIns', 'PrimInsType', 'Modality',
  'CPTCode', 'FirstDenialGroup', 'FirstDenialCode', 'LastDenialGroup',
  'LastDenialCode', 'ChgStatus',
];
export const ALL_EXPECTED = [...NUMERIC_COLS, ...STRING_COLS];

export function stripBOM(str) {
  return str.charCodeAt(0) === 0xFEFF ? str.slice(1) : str;
}

export function normalizeRow(raw) {
  const row = {};
  for (const key of Object.keys(raw)) {
    const trimKey = stripBOM(key.trim());
    const val = raw[key];
    if (NUMERIC_COLS.includes(trimKey)) {
      const str = (val == null ? '' : String(val)).trim().replace(/[$,]/g, '');
      row[trimKey] = str === '' ? 0 : parseFloat(str) || 0;
    } else if (STRING_COLS.includes(trimKey)) {
      const s = (val == null ? '' : String(val)).trim();
      row[trimKey] = s === '' ? '' : s;
    } else {
      row[trimKey] = val;
    }
  }
  return row;
}

export function buildColumnMeta(rows) {
  const meta = {};
  for (const col of STRING_COLS) {
    const vals = new Set();
    for (const r of rows) {
      if (r[col] != null && r[col] !== '') vals.add(r[col]);
    }
    meta[col] = { type: 'categorical', values: Array.from(vals).sort() };
  }
  for (const col of NUMERIC_COLS) {
    let min = Infinity, max = -Infinity;
    for (const r of rows) {
      if (r[col] != null) {
        if (r[col] < min) min = r[col];
        if (r[col] > max) max = r[col];
      }
    }
    meta[col] = {
      type: 'numeric',
      min: min === Infinity ? 0 : min,
      max: max === -Infinity ? 0 : max,
    };
  }
  return meta;
}

export function validateColumns(rows) {
  if (rows.length === 0) return;
  const found = Object.keys(rows[0]).map(k => stripBOM(k.trim()));
  const missing = ALL_EXPECTED.filter(c => !found.includes(c));
  if (missing.length === ALL_EXPECTED.length) {
    throw new Error(
      `No expected columns found. Detected columns: ${found.slice(0, 8).join(', ')}${found.length > 8 ? '…' : ''}. ` +
      `Expected columns include: ${ALL_EXPECTED.slice(0, 5).join(', ')}…`
    );
  }
  if (missing.length > 0) {
    console.warn('Missing columns (will default to empty/0):', missing.join(', '));
  }
}
