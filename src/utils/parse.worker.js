import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { normalizeRow, buildColumnMeta, validateColumns } from './parseHelpers.js';

function post(type, payload) {
  self.postMessage({ type, ...payload });
}

// Detect encoding from BOM bytes and return decoded text
async function readAsText(file) {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);

  let encoding = 'UTF-8';
  let sliceFrom = 0;

  if (bytes[0] === 0xFF && bytes[1] === 0xFE) {
    encoding = 'UTF-16LE';
    sliceFrom = 2;
  } else if (bytes[0] === 0xFE && bytes[1] === 0xFF) {
    encoding = 'UTF-16BE';
    sliceFrom = 2;
  } else if (bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) {
    sliceFrom = 3; // UTF-8 BOM — encoding stays UTF-8, just skip the BOM bytes
  }

  return new TextDecoder(encoding).decode(buffer.slice(sliceFrom));
}

function parseCSV(text, fileSize, ext) {
  return new Promise((resolve, reject) => {
    const rawRows = [];
    const estimatedTotal = Math.max(1, Math.round(text.length / 120));
    let rowCount = 0;
    let lastPct = 15;

    // Sniff delimiter from first 2KB so we can show it in error messages
    const sniff = Papa.parse(text.slice(0, 2048), { preview: 1 });
    const detectedDelimiter = sniff.meta?.delimiter || ',';

    Papa.parse(text, {
      header: true,
      skipEmptyLines: true,
      delimiter: detectedDelimiter,
      step(results, parser) {
        if (results.errors?.length && rawRows.length === 0 && results.errors[0].type === 'Quotes') {
          // Recoverable quote error — continue
        }
        if (results.data && Object.keys(results.data).length > 1) {
          rawRows.push(results.data);
          rowCount++;
          if (rowCount % 8000 === 0) {
            const pct = Math.min(88, 15 + Math.round((rowCount / estimatedTotal) * 73));
            if (pct > lastPct) {
              lastPct = pct;
              post('progress', { pct, status: `Parsing… ${rowCount.toLocaleString()} rows` });
            }
          }
        }
      },
      complete(results) {
        if (rawRows.length === 0) {
          // Provide a diagnostic message to help debug
          const fields = results.meta?.fields ?? [];
          const delim = results.meta?.delimiter ?? '?';
          reject(new Error(
            `File parsed but returned 0 data rows.\n` +
            `Detected delimiter: "${delim === '\t' ? '\\t (tab)' : delim}"\n` +
            `Detected columns (${fields.length}): ${fields.slice(0, 6).join(', ')}${fields.length > 6 ? '…' : ''}\n\n` +
            `If the file has data, it may be empty after the header, or all rows were filtered as empty.`
          ));
        } else {
          resolve({ rawRows, delimiter: results.meta?.delimiter });
        }
      },
      error(err) {
        reject(new Error(err.message || String(err)));
      },
    });
  });
}

function findDataSheet(wb) {
  for (const name of wb.SheetNames) {
    const sheet = wb.Sheets[name];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '', range: 0 });
    if (rows.length > 0) return { sheet, name };
  }
  return { sheet: wb.Sheets[wb.SheetNames[0]], name: wb.SheetNames[0] };
}

self.onmessage = async (e) => {
  const { file, fileSize, ext } = e.data;

  try {
    let rawRows = [];

    if (ext === 'csv' || ext === 'txt' || ext === 'tsv') {
      post('progress', { pct: 5, status: 'Reading file…' });
      const text = await readAsText(file);

      post('progress', { pct: 15, status: 'Parsing rows…' });
      const result = await parseCSV(text, fileSize, ext);
      rawRows = result.rawRows;

    } else {
      post('progress', { pct: 5, status: 'Reading Excel file…' });
      const wb = XLSX.read(file, { type: 'array' });

      post('progress', { pct: 35, status: 'Finding data sheet…' });
      const { sheet, name } = findDataSheet(wb);

      post('progress', { pct: 55, status: `Converting sheet "${name}"…` });
      rawRows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

      if (rawRows.length === 0) {
        throw new Error(
          `Excel file parsed but sheet "${name}" has no data rows. ` +
          `Available sheets: ${wb.SheetNames.join(', ')}`
        );
      }
      post('progress', { pct: 75, status: `Read ${rawRows.length.toLocaleString()} rows…` });
    }

    validateColumns(rawRows);

    post('progress', { pct: 91, status: 'Normalizing rows…' });
    const rows = rawRows.map(normalizeRow);

    post('progress', { pct: 97, status: 'Building filter metadata…' });
    const columnMeta = buildColumnMeta(rows);

    post('complete', { rows, columnMeta });

  } catch (err) {
    post('error', { message: err.message || 'Unknown parse error' });
  }
};
