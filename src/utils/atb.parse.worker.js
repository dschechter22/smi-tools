import * as XLSX from 'xlsx';
import Papa from 'papaparse';

function post(type, payload) { self.postMessage({ type, ...payload }); }

self.onmessage = async (e) => {
  const { file, ext } = e.data;
  try {
    if (!['xlsx', 'xls', 'xlsb', 'csv'].includes(ext)) {
      throw new Error('ATB files must be .csv, .xlsb, .xlsx, or .xls.');
    }
    if (ext === 'csv') {
      await parseCsv(file);
    } else {
      await parseExcel(file, ext);
    }
  } catch (err) {
    post('error', { message: err.message || 'Unknown parse error' });
  }
};

// ── CSV ───────────────────────────────────────────────────────────────────────

function parseCsv(file) {
  return new Promise((resolve, reject) => {
    post('progress', { pct: 2, status: 'Starting CSV parse…' });
    const totalBytes = file.size;
    const rawRows = [];
    let rowCount = 0;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      step(result) {
        const row = result.data;

        // Filter out PI rows at load time — user confirmed non-PI only
        const piVal = String(row['PI/Non PI'] || '').trim().toUpperCase();
        if (piVal === 'PI') return;

        rawRows.push(row);
        rowCount++;

        if (rowCount % 10000 === 0) {
          const pct = Math.min(92, Math.round((result.meta.cursor / totalBytes) * 90) + 2);
          post('progress', { pct, status: `Parsed ${rowCount.toLocaleString()} rows…` });
        }
      },
      complete() {
        if (rawRows.length === 0) {
          reject(new Error('No rows found after parsing. Check that the file has a "PI/Non PI" column and Non-PI data.'));
          return;
        }
        const sampleKeys = Object.keys(rawRows[0]).slice(0, 8).join(', ');
        post('progress', { pct: 96, status: `Loaded ${rawRows.length.toLocaleString()} rows` });
        post('complete', { rows: rawRows, sheetName: 'CSV', sampleKeys });
        resolve();
      },
      error(err) {
        reject(new Error(err.message || 'CSV parse error'));
      },
    });
  });
}

// ── Excel ─────────────────────────────────────────────────────────────────────

async function parseExcel(file, ext) {
  post('progress', { pct: 5, status: 'Reading sheet names…' });

  const wbMeta = XLSX.read(file, { type: 'array', bookSheets: true });
  const sheetNames = wbMeta.SheetNames;
  post('progress', { pct: 20, status: `Found sheets: ${sheetNames.join(', ')}` });

  const targetName = sheetNames.find(n => n.trim().toLowerCase() === 'debit') ?? sheetNames[0];
  post('progress', { pct: 30, status: `Loading sheet "${targetName}" only…` });

  const wb = XLSX.read(file, { type: 'array', dense: true, sheets: targetName });
  const sheet = wb.Sheets[targetName];
  if (!sheet) throw new Error(`Sheet "${targetName}" could not be loaded. Available: ${sheetNames.join(', ')}`);

  const ref = sheet['!ref'] || (sheet['!data'] ? `dense(${sheet['!data'].length}r)` : 'none');
  post('progress', { pct: 60, status: `Parsing "${targetName}" — range: ${ref}` });

  const rawArrays = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  post('progress', { pct: 80, status: `Raw rows: ${rawArrays.length}, cols: ${rawArrays[0]?.length ?? 0}` });

  if (rawArrays.length < 2) {
    throw new Error(`Sheet "${targetName}" returned ${rawArrays.length} rows (range=${ref}).`);
  }

  const headers = rawArrays[0].map(h => String(h == null ? '' : h).trim());
  const rawRows = rawArrays.slice(1)
    .filter(arr => arr.some(v => v !== ''))
    .map(arr => {
      const obj = {};
      headers.forEach((h, i) => { obj[h] = arr[i] ?? ''; });
      return obj;
    });

  if (rawRows.length === 0) {
    throw new Error(`Sheet "${targetName}" has headers but no data rows. Headers: ${headers.slice(0, 6).join(', ')}`);
  }

  const sampleKeys = headers.slice(0, 8).join(', ');
  post('progress', { pct: 95, status: `Loaded ${rawRows.length.toLocaleString()} rows` });
  post('complete', { rows: rawRows, sheetName: targetName, sampleKeys });
}
