import Papa from 'papaparse';
import * as XLSX from 'xlsx';

const NUMERIC_COLS = ['ChgCt', 'ChgAmt', 'PmtAmt', 'Balance', 'InsPmtAmt', 'PtPmtAmt'];
const STRING_COLS = [
  'Location_State', 'LocationName', 'PrimIns', 'PrimInsType', 'Modality',
  'CPTCode', 'FirstDenialGroup', 'FirstDenialCode', 'LastDenialGroup',
  'LastDenialCode', 'ChgStatus',
];
const ALL_EXPECTED = [...NUMERIC_COLS, ...STRING_COLS];

function stripBOM(str) {
  return str.charCodeAt(0) === 0xFEFF ? str.slice(1) : str;
}

function normalizeRow(raw) {
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

function buildColumnMeta(rows) {
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

function validateColumns(rows) {
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

function sheetToRows(sheet) {
  return XLSX.utils.sheet_to_json(sheet, { defval: '' });
}

function findDataSheet(wb) {
  for (const name of wb.SheetNames) {
    const rows = sheetToRows(wb.Sheets[name]);
    if (rows.length > 0) return rows;
  }
  return [];
}

export async function parseFile(file) {
  const ext = file.name.split('.').pop().toLowerCase();

  let rawRows;
  if (ext === 'csv' || ext === 'txt' || ext === 'tsv') {
    rawRows = await new Promise((resolve, reject) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        delimiter: '',        // auto-detect: handles comma, tab, pipe, etc.
        encoding: 'UTF-8',
        complete: (result) => {
          if (result.errors.length > 0 && result.data.length === 0) {
            reject(new Error(`CSV parse error: ${result.errors[0].message}`));
          } else {
            resolve(result.data);
          }
        },
        error: (err) => reject(err),
      });
    });
  } else if (ext === 'xlsx' || ext === 'xls') {
    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer, { type: 'array' });
    rawRows = findDataSheet(wb);
  } else {
    throw new Error(
      `Unsupported file type: .${ext}. Please upload a .csv, .xlsx, .xls, or .txt file.`
    );
  }

  if (rawRows.length === 0) {
    throw new Error('The file appears to be empty or has no data rows.');
  }

  validateColumns(rawRows);

  const rows = rawRows.map(normalizeRow);
  const columnMeta = buildColumnMeta(rows);
  return { rows, columnMeta };
}
