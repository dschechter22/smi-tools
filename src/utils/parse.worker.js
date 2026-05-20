import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import {
  normalizeRow,
  buildColumnMeta,
  validateColumns,
} from './parseHelpers.js';

function post(type, payload) {
  self.postMessage({ type, ...payload });
}

self.onmessage = async (e) => {
  const { file, fileSize, ext } = e.data;

  try {
    let rawRows = [];

    if (ext === 'csv' || ext === 'txt' || ext === 'tsv') {
      await new Promise((resolve, reject) => {
        Papa.parse(file, {
          header: true,
          skipEmptyLines: true,
          delimiter: '',
          encoding: 'UTF-8',
          chunk: (results) => {
            rawRows.push(...results.data);
            if (fileSize > 0) {
              const pct = Math.min(90, Math.round((results.meta.cursor / fileSize) * 90));
              post('progress', { pct, status: `Parsing… ${rawRows.length.toLocaleString()} rows` });
            }
          },
          complete: () => resolve(),
          error: (err) => reject(new Error(err.message || String(err))),
        });
      });
    } else {
      post('progress', { pct: 5, status: 'Reading Excel file…' });
      const rows = XLSX.utils.sheet_to_json(
        (() => {
          const wb = XLSX.read(file, { type: 'array' });
          for (const name of wb.SheetNames) {
            const sheet = wb.Sheets[name];
            const r = XLSX.utils.sheet_to_json(sheet, { defval: '' });
            if (r.length > 0) return sheet;
          }
          return wb.Sheets[wb.SheetNames[0]];
        })(),
        { defval: '' }
      );
      rawRows = rows;
      post('progress', { pct: 70, status: `Read ${rawRows.length.toLocaleString()} rows, normalizing…` });
    }

    if (rawRows.length === 0) {
      throw new Error('The file appears to be empty or has no data rows.');
    }

    validateColumns(rawRows);

    post('progress', { pct: 92, status: 'Normalizing rows…' });
    const rows = rawRows.map(normalizeRow);

    post('progress', { pct: 97, status: 'Building filter metadata…' });
    const columnMeta = buildColumnMeta(rows);

    post('complete', { rows, columnMeta });
  } catch (err) {
    post('error', { message: err.message || 'Unknown parse error' });
  }
};
