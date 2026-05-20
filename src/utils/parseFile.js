import Papa from 'papaparse';
import * as XLSX from 'xlsx';

const NUMERIC_COLS = ['ChgCt', 'ChgAmt', 'PmtAmt', 'Balance', 'InsPmtAmt', 'PtPmtAmt'];
const STRING_COLS = [
  'Location_State', 'LocationName', 'PrimIns', 'PrimInsType', 'Modality',
  'CPTCode', 'FirstDenialGroup', 'FirstDenialCode', 'LastDenialGroup',
  'LastDenialCode', 'ChgStatus',
];

function normalizeRow(raw) {
  const row = {};
  for (const key of Object.keys(raw)) {
    const trimKey = key.trim();
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

function sheetToRows(sheet) {
  const raw = XLSX.utils.sheet_to_json(sheet, { defval: '' });
  return raw;
}

export async function parseFile(file) {
  const ext = file.name.split('.').pop().toLowerCase();

  let rawRows;
  if (ext === 'csv') {
    rawRows = await new Promise((resolve, reject) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (result) => resolve(result.data),
        error: (err) => reject(err),
      });
    });
  } else if (ext === 'xlsx' || ext === 'xls') {
    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer, { type: 'array' });
    const sheetName = wb.SheetNames[0];
    rawRows = sheetToRows(wb.Sheets[sheetName]);
  } else {
    throw new Error(`Unsupported file type: .${ext}. Please upload a .csv, .xlsx, or .xls file.`);
  }

  const rows = rawRows.map(normalizeRow);
  const columnMeta = buildColumnMeta(rows);
  return { rows, columnMeta };
}
