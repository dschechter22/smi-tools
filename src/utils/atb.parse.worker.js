import * as XLSX from 'xlsx';
import Papa from 'papaparse';

function post(type, payload) { self.postMessage({ type, ...payload }); }

const CHUNK_SIZE = 10000;

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
    let rowCount = 0;
    let totalKept = 0;
    let pending = [];
    let sampleKeys = null;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      step(result) {
        const row = result.data;

        // Capture column names from first row
        if (sampleKeys === null) {
          sampleKeys = Object.keys(row).slice(0, 8).join(', ');
        }

        rowCount++;

        // Filter out PI rows at load time
        const piVal = String(row['PI/Non PI'] || '').trim().toUpperCase();
        if (piVal === 'PI') return;

        pending.push(row);
        totalKept++;

        // Flush chunk — frees worker memory so it never holds the full dataset
        if (pending.length >= CHUNK_SIZE) {
          post('chunk', { rows: pending, kept: totalKept });
          pending = [];
        }

        if (rowCount % 10000 === 0) {
          const pct = Math.min(90, Math.round((result.meta.cursor / totalBytes) * 90) + 2);
          post('progress', { pct, status: `Parsed ${rowCount.toLocaleString()} rows, kept ${totalKept.toLocaleString()}…` });
        }
      },
      complete() {
        // Flush remainder
        if (pending.length > 0) {
          post('chunk', { rows: pending, kept: totalKept });
          pending = [];
        }
        if (totalKept === 0) {
          reject(new Error('No Non-PI rows found. Check that the file has a "PI/Non PI" column.'));
          return;
        }
        post('progress', { pct: 96, status: `Done — ${totalKept.toLocaleString()} rows loaded` });
        post('complete', { total: totalKept, sheetName: 'CSV', sampleKeys });
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

  post('progress', { pct: 60, status: `Converting rows…` });

  const rawArrays = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  if (rawArrays.length < 2) throw new Error(`Sheet "${targetName}" returned ${rawArrays.length} rows.`);

  const headers = rawArrays[0].map(h => String(h == null ? '' : h).trim());
  const sampleKeys = headers.slice(0, 8).join(', ');
  let kept = 0;

  post('progress', { pct: 75, status: `Transferring ${(rawArrays.length - 1).toLocaleString()} rows…` });

  // Send in chunks so postMessage never has to clone the full array at once
  for (let i = 1; i < rawArrays.length; i += CHUNK_SIZE) {
    const chunk = [];
    for (let j = i; j < Math.min(i + CHUNK_SIZE, rawArrays.length); j++) {
      const arr = rawArrays[j];
      if (!arr.some(v => v !== '')) continue;
      const obj = {};
      headers.forEach((h, k) => { obj[h] = arr[k] ?? ''; });
      chunk.push(obj);
      kept++;
    }
    if (chunk.length > 0) post('chunk', { rows: chunk, kept });
    const pct = Math.min(94, Math.round(75 + ((i / rawArrays.length) * 20)));
    post('progress', { pct, status: `Transferred ${kept.toLocaleString()} rows…` });
  }

  post('progress', { pct: 96, status: `Done — ${kept.toLocaleString()} rows loaded` });
  post('complete', { total: kept, sheetName: targetName, sampleKeys });
}
